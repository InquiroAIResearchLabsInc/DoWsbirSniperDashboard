const express = require('express');
const { getDb, safeJson, uid, now } = require('../../db');
const { requireAuth } = require('../../auth/middleware');
const { computeAllMatches, recordDisagreement } = require('../../art/match_orchestrator');
const { emitReceipt } = require('../../core/receipt');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const rows = db.prepare(`SELECT am.*, sc.name AS sponsor_name, sc.public_url AS sponsor_url, sc.component AS sponsor_component, sc.parent_command
                           FROM art_matches am LEFT JOIN sponsor_candidates sc ON sc.id = am.sponsor_candidate_id
                           WHERE am.tenant_id = ? ORDER BY am.computed_at DESC, am.match_score DESC LIMIT 200`).all(req.tenant_id);
  res.json({ matches: rows.map(r => ({ ...r, evidence: safeJson(r.evidence, {}) })) });
});

router.post('/compute', requireAuth, (req, res) => {
  const db = getDb();
  const { phase_ii_tech_id } = req.body || {};
  if (!phase_ii_tech_id) return res.status(400).json({ error: 'phase_ii_tech_id required' });
  const tech = db.prepare('SELECT * FROM phase_ii_techs WHERE id = ? AND tenant_id = ?').get(phase_ii_tech_id, req.tenant_id);
  if (!tech) return res.status(404).json({ error: 'phase_ii_tech_not_found' });
  tech.tech_keywords = safeJson(tech.tech_keywords, []);
  const profile = db.prepare('SELECT * FROM profiles WHERE tenant_id = ?').get(req.tenant_id) || {};
  profile.tech_keywords = safeJson(profile.tech_keywords, []);
  const top = computeAllMatches({ tenant_id: req.tenant_id, profile, phase_ii_tech: tech, limit: 10 });
  res.json({ matches: top });
});

router.post('/:id/disagree', requireAuth, (req, res) => {
  const r = recordDisagreement({ tenant_id: req.tenant_id, match_id: req.params.id, reason: req.body && req.body.reason });
  res.json({ ok: true, receipt_hash: r.receipt_hash });
});

router.post('/techs', requireAuth, (req, res) => {
  const db = getDb();
  const { topic_code, title, award_date, originating_component, tech_keywords, trl, sbir_award_url } = req.body || {};
  if (!topic_code || !title) return res.status(400).json({ error: 'topic_code and title required' });
  const id = uid();
  db.prepare('INSERT INTO phase_ii_techs (id, tenant_id, topic_code, title, award_date, originating_component, tech_keywords, trl, sbir_award_url, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(id, req.tenant_id, topic_code, title, award_date || null, originating_component || null, JSON.stringify(tech_keywords || []), trl || null, sbir_award_url || null, now());
  emitReceipt('phase_ii_tech_declared', { tenant_id: req.tenant_id, phase_ii_tech_id: id, topic_code });
  res.status(201).json({ id });
});

router.get('/techs', requireAuth, (req, res) => {
  const rows = getDb().prepare('SELECT * FROM phase_ii_techs WHERE tenant_id = ? ORDER BY created_at DESC').all(req.tenant_id);
  res.json({ techs: rows.map(r => ({ ...r, tech_keywords: safeJson(r.tech_keywords, []) })) });
});

module.exports = router;
