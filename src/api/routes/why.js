const express = require('express');
const { getDb, safeJson } = require('../../db');
const { buildTopicWhy, buildArtWhy } = require('../../scoring/why_this');
const { getWeights } = require('../../scoring/weights');
const { emitReceipt } = require('../../core/receipt');

const router = express.Router();

router.get('/topic/:opportunity_id', (req, res) => {
  const db = getDb();
  const opp = db.prepare('SELECT * FROM opportunities WHERE id = ?').get(req.params.opportunity_id);
  if (!opp) return res.status(404).json({ error: 'not_found' });
  const score = db.prepare('SELECT * FROM scores WHERE opportunity_id = ? AND tenant_id = ? ORDER BY computed_at DESC LIMIT 1').get(req.params.opportunity_id, req.tenant_id);
  if (!score) return res.status(404).json({ error: 'no_score' });
  score.keywords_matched = safeJson(score.keywords_matched, []);
  const weights = getWeights('topic', req.tenant_id);
  res.json({ why: buildTopicWhy(score, weights, opp) });
});

router.get('/art/:match_id', (req, res) => {
  const db = getDb();
  const m = db.prepare('SELECT * FROM art_matches WHERE id = ? AND tenant_id = ?').get(req.params.match_id, req.tenant_id);
  if (!m) return res.status(404).json({ error: 'not_found' });
  const sponsor = db.prepare('SELECT * FROM sponsor_candidates WHERE id = ?').get(m.sponsor_candidate_id) || { id: m.sponsor_candidate_id, name: 'unknown', public_url: null };
  const tech = db.prepare('SELECT * FROM phase_ii_techs WHERE id = ?').get(m.phase_ii_tech_id) || {};
  const weights = getWeights('art', req.tenant_id);
  const match = {
    id: m.id,
    payload: {
      match_score: m.match_score,
      match_band: m.match_band,
      sub_scores: {
        priority_alignment: m.sub_score_priority,
        transition_history: m.sub_score_transition,
        active_scouting: m.sub_score_scouting,
        tech_maturity_fit: m.sub_score_maturity,
        recency_boost: m.sub_score_recency,
      },
    },
    evidence: safeJson(m.evidence, {}),
  };
  res.json({ why: buildArtWhy(match, sponsor, tech, weights) });
});

router.post('/disagree', (req, res) => {
  const { kind, id, reason } = req.body || {};
  emitReceipt(kind === 'art' ? 'art_match_disagreement' : 'topic_score_disagreement', {
    tenant_id: req.tenant_id,
    target_id: id,
    reason: (reason || '').slice(0, 500),
  });
  res.json({ ok: true });
});

module.exports = router;
