const fs = require('fs');
const path = require('path');
const config = require('../core/config');
const { getDb, uid, now } = require('../db');
const { emitReceipt } = require('../core/receipt');
const { dualHash, stableStringify } = require('../core/hash');
const { getWeights, band, ART_META } = require('../scoring/weights');
const { combineProfileAndTech } = require('./tech_extractor');
const { matchPriorities } = require('./priority_matcher');
const transitionHistory = require('./transition_history');
const scoutingSignals = require('./scouting_signals');

const SPONSORS = JSON.parse(fs.readFileSync(path.join(config.ROOT, 'seed', 'sponsor_registry.json'), 'utf8')).sponsors;

function maturityFit(phase_ii_tech, sponsor) {
  const trl = phase_ii_tech.trl || 6;
  if (trl >= 6 && trl <= 8) return 100;
  if (trl === 5 || trl === 9) return 75;
  if (trl === 4) return 50;
  return 25;
}

function recencyBoost({ scouting, transition }) {
  if (scouting && scouting.has_signal) return 100;
  if (transition && transition.sample && transition.sample.length > 0) {
    const newest = transition.sample.reduce((a, b) => (Date.parse(a.award_date || '') > Date.parse(b.award_date || '') ? a : b));
    const ageDays = (Date.now() - Date.parse(newest.award_date || '1970-01-01')) / 86400000;
    if (ageDays < 180) return 90;
    if (ageDays < 365) return 70;
    if (ageDays < 730) return 50;
  }
  return 25;
}

function computeMatch({ tenant_id, profile, phase_ii_tech, sponsor }) {
  const weights = getWeights('art', tenant_id);
  const extracted = combineProfileAndTech(profile, phase_ii_tech);
  const priority = matchPriorities({ sponsor, tech_extracted: extracted, tenant_id, emit_receipt: false });
  const transition = transitionHistory.scoreFor(sponsor);
  const scouting = scoutingSignals.scoreFor({ sponsor, tech_keywords: phase_ii_tech.tech_keywords, tenant_id });
  const maturity = maturityFit(phase_ii_tech, sponsor);
  const recency = recencyBoost({ scouting, transition });

  let composite = Math.round(
    priority.score * weights.priority_alignment +
    transition.score * weights.transition_history +
    scouting.score * weights.active_scouting +
    maturity * weights.tech_maturity_fit +
    recency * weights.recency_boost
  );

  let cappedReason = null;
  if (composite >= ART_META.bands.strong_min && !scouting.has_signal && (!transition.sample || transition.sample.length === 0)) {
    composite = ART_META.bands.strong_min - 1;
    cappedReason = 'no_citable_public_signal_in_90d';
  }
  const bandLabel = band(composite);

  const evidence = {
    priority_alignment: { score: priority.score, matches: priority.matches.slice(0, 5) },
    transition_history: { score: transition.score, count: transition.count, total_usd: transition.total_usd, sample: transition.sample },
    active_scouting: { score: scouting.score, notices: scouting.relevant_notices, has_signal: scouting.has_signal },
    tech_maturity_fit: { score: maturity, trl: phase_ii_tech.trl || null },
    recency_boost: { score: recency },
    capped_reason: cappedReason,
  };

  const payload = {
    tenant_id,
    phase_ii_tech_id: phase_ii_tech.id || phase_ii_tech.topic_code,
    sponsor_id: sponsor.id,
    sponsor_name: sponsor.name,
    component: sponsor.component,
    match_score: composite,
    match_band: bandLabel,
    sub_scores: {
      priority_alignment: priority.score,
      transition_history: transition.score,
      active_scouting: scouting.score,
      tech_maturity_fit: maturity,
      recency_boost: recency,
    },
    weights_snapshot: weights,
  };
  const payload_hash = dualHash(stableStringify(payload));

  const db = getDb();
  const id = uid();
  db.prepare(`INSERT INTO art_matches (id, tenant_id, phase_ii_tech_id, sponsor_candidate_id, match_score, match_band, sub_score_priority, sub_score_transition, sub_score_scouting, sub_score_maturity, sub_score_recency, evidence, computed_at, payload_hash, receipt_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, tenant_id, payload.phase_ii_tech_id, sponsor.id, composite, bandLabel, priority.score, transition.score, scouting.score, maturity, recency, JSON.stringify(evidence), now(), payload_hash, null);
  const r = emitReceipt('art_match_computed', {
    tenant_id,
    phase_ii_tech_id: payload.phase_ii_tech_id,
    sponsor_id: sponsor.id,
    match_score: composite,
    match_band: bandLabel,
    payload_hash,
    capped_reason: cappedReason,
  });
  db.prepare('UPDATE art_matches SET receipt_hash = ? WHERE id = ?').run(r.receipt_hash, id);

  return {
    id, payload, evidence, payload_hash, receipt_hash: r.receipt_hash,
  };
}

function computeAllMatches({ tenant_id, profile, phase_ii_tech, limit = 10 }) {
  // Recompute REPLACES — clear this tech's prior matches first so repeated
  // compute calls (the ART tab triggers one per visit) don't pile up.
  getDb().prepare('DELETE FROM art_matches WHERE tenant_id = ? AND phase_ii_tech_id = ?')
    .run(tenant_id, phase_ii_tech.id);
  const results = SPONSORS.map(s => computeMatch({ tenant_id, profile, phase_ii_tech, sponsor: s }));
  results.sort((a, b) => b.payload.match_score - a.payload.match_score);
  const top = results.slice(0, limit);
  for (const m of top) {
    emitReceipt('art_match_surfaced', {
      tenant_id,
      phase_ii_tech_id: m.payload.phase_ii_tech_id,
      sponsor_id: m.payload.sponsor_id,
      match_score: m.payload.match_score,
      match_band: m.payload.match_band,
    });
  }
  return top;
}

function recordDisagreement({ tenant_id, match_id, reason }) {
  return emitReceipt('art_match_disagreement', { tenant_id, match_id, reason: (reason || '').slice(0, 500) });
}

function recordSponsorPipelineAdd({ tenant_id, phase_ii_tech_id, sponsor_id, status = 'targeting', notes }) {
  const db = getDb();
  const id = uid();
  db.prepare('INSERT INTO sponsor_pipeline (id, tenant_id, phase_ii_tech_id, sponsor_candidate_id, status, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, tenant_id, phase_ii_tech_id, sponsor_id, status, notes || null, now(), now());
  emitReceipt('art_sponsor_pipeline_added', { tenant_id, phase_ii_tech_id, sponsor_id, status });
  return { id };
}

module.exports = { computeMatch, computeAllMatches, recordDisagreement, recordSponsorPipelineAdd, SPONSORS };
