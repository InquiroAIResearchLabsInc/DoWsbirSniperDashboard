const fs = require('fs');
const path = require('path');
const config = require('../core/config');
const { getDb, uid, now } = require('../db');
const { emitReceipt } = require('../core/receipt');
const { dualHash, stableStringify } = require('../core/hash');
const { getWeights, tier } = require('./weights');

const KEYWORDS = JSON.parse(fs.readFileSync(path.join(config.ROOT, 'seed', 'default_keywords.json'), 'utf8'));

function scoreTopic(opp, tenant_id = 'default', opts = {}) {
  const w = getWeights('topic', tenant_id);
  const text = [opp.title || '', opp.description || '', opp.program || '', opp.phase || ''].join(' ').toLowerCase();

  for (const dq of KEYWORDS.disqualifiers) if (text.includes(dq)) return buildResult(opp, tenant_id, w, 0, 0, 0, 0, 0, 0, [], 'SKIP', { disqualified_by: dq });

  let techPts = 0;
  const matched = [];
  for (const kw of KEYWORDS.tier_a) if (text.includes(kw)) { techPts += 10; matched.push(kw); }
  for (const kw of KEYWORDS.tier_b) if (text.includes(kw)) { techPts += 5; matched.push(kw); }
  for (const kw of KEYWORDS.tier_c) if (text.includes(kw)) { techPts += 2; matched.push(kw); }
  const techScore = Math.min(100, (techPts / 40) * 100);

  let domainScore = 0;
  let domainDisqualified = false;
  for (const kw of KEYWORDS.domain_disqualifiers) if (text.includes(kw)) { domainDisqualified = true; break; }
  if (!domainDisqualified) {
    let best = 0;
    for (const kw of KEYWORDS.domain_tier1) if (text.includes(kw)) best = Math.max(best, 100);
    for (const kw of KEYWORDS.domain_tier2) if (text.includes(kw)) best = Math.max(best, 75);
    for (const kw of KEYWORDS.domain_tier3) if (text.includes(kw)) best = Math.max(best, 50);
    domainScore = best;
  }

  let typeScore = 0.80;
  const programText = [opp.program || '', opp.phase || ''].join(' ').toLowerCase();
  for (const [key, val] of Object.entries(KEYWORDS.submission_type_scores)) {
    if (text.includes(key) || programText.includes(key)) typeScore = Math.max(typeScore, val);
  }
  if ((text.includes('sttr') || programText.includes('sttr')) && typeScore === 0.80) typeScore = 0.30;
  const typeScoreNorm = typeScore * 100;

  let timelineScore = 100;
  if (!opp.is_rolling && opp.days_remaining != null) {
    const d = opp.days_remaining;
    if (d < 0) timelineScore = 0;
    else if (d < 7) timelineScore = 10;
    else if (d < 14) timelineScore = 30;
    else if (d < 21) timelineScore = 60;
    else if (d < 30) timelineScore = 80;
  }

  let fundingScore = 50;
  const rate = (KEYWORDS.currency_rates && KEYWORDS.currency_rates[opp.currency || 'USD']) || 1;
  const raw = opp.funding_max || opp.funding_min;
  const amount = raw ? raw * rate : null;
  if (amount) {
    if (amount >= 750000 && amount <= 2000000) fundingScore = 100;
    else if (amount >= 250000 && amount < 750000) fundingScore = 90;
    else if (amount >= 50000 && amount < 250000) fundingScore = 70;
    else if (amount > 2000000) fundingScore = 60;
    else if (amount < 50000) fundingScore = 20;
  }

  const finalScore = Math.round(
    techScore * w.tech_alignment +
    domainScore * w.domain_alignment +
    typeScoreNorm * w.submission_type +
    timelineScore * w.timeline +
    fundingScore * w.funding_efficiency
  );

  return buildResult(opp, tenant_id, w, finalScore, techScore, domainScore, typeScoreNorm, timelineScore, fundingScore, matched, tier(finalScore), { disqualified_by: null });
}

function buildResult(opp, tenant_id, weights, finalScore, tech, domain, type, timeline, funding, matched, tierLabel, extras = {}) {
  const result = {
    opportunity_id: opp.id || null,
    tenant_id,
    fit_score: finalScore,
    score_tier: tierLabel,
    score_tech: Math.round(tech),
    score_domain: Math.round(domain),
    score_type: Math.round(type),
    score_timeline: Math.round(timeline),
    score_funding: Math.round(funding),
    keywords_matched: matched,
    weights_snapshot: weights,
    computed_at: now(),
    disqualified_by: extras.disqualified_by || null,
  };
  result.payload_hash = dualHash(stableStringify(result));
  return result;
}

function persist(result) {
  const db = getDb();
  const id = uid();
  db.prepare(`INSERT INTO scores (id, opportunity_id, tenant_id, fit_score, score_tier, score_tech, score_domain, score_type, score_timeline, score_funding, keywords_matched, computed_at, weights_snapshot, receipt_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, result.opportunity_id, result.tenant_id, result.fit_score, result.score_tier, result.score_tech, result.score_domain, result.score_type, result.score_timeline, result.score_funding, JSON.stringify(result.keywords_matched), result.computed_at, JSON.stringify(result.weights_snapshot), result.payload_hash);
  const r = emitReceipt('topic_score_computed', {
    tenant_id: result.tenant_id,
    opportunity_id: result.opportunity_id,
    fit_score: result.fit_score,
    score_tier: result.score_tier,
    payload_hash: result.payload_hash,
    disqualified_by: result.disqualified_by,
  });
  return { ...result, score_id: id, receipt_hash: r.receipt_hash };
}

module.exports = { scoreTopic, persist };
