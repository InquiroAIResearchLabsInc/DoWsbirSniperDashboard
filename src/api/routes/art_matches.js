const express = require('express');
const { getDb, safeJson, uid, now } = require('../../db');
const { requireAuth } = require('../../auth/middleware');
const { computeAllMatches, recordDisagreement } = require('../../art/match_orchestrator');
const { emitReceipt } = require('../../core/receipt');

const router = express.Router();

const BAND_NORMALIZE = { strong: 'Strong', promising: 'Promising', weak: 'Weak' };

function clampInt(v, def, min, max) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(Math.max(n, min), max);
}

router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const filters = req.query || {};
  const args = [req.tenant_id];
  let sql = `SELECT am.*,
                    sc.name AS sponsor_name, sc.public_url AS sponsor_url,
                    sc.component AS sponsor_component, sc.parent_command,
                    p2.title AS phase_ii_title, p2.originating_component AS phase_ii_component
             FROM art_matches am
             LEFT JOIN sponsor_candidates sc ON sc.id = am.sponsor_candidate_id
             LEFT JOIN phase_ii_techs p2     ON p2.id = am.phase_ii_tech_id
             WHERE am.tenant_id = ?`;
  if (filters.component) { sql += ' AND p2.originating_component = ?'; args.push(filters.component); }
  if (filters.band) {
    const norm = BAND_NORMALIZE[String(filters.band).toLowerCase()];
    if (norm) { sql += ' AND am.match_band = ?'; args.push(norm); }
  }
  if (filters.min_score) {
    const ms = Number(filters.min_score);
    if (Number.isFinite(ms) && ms > 0) { sql += ' AND am.match_score >= ?'; args.push(ms); }
  }
  if (filters.q) {
    const q = `%${String(filters.q).trim()}%`;
    if (q.length > 2) {
      sql += ' AND (p2.title LIKE ? COLLATE NOCASE OR sc.name LIKE ? COLLATE NOCASE)';
      args.push(q, q);
    }
  }
  const limit = clampInt(filters.limit, 50, 1, 200);
  const offset = clampInt(filters.offset, 0, 0, 100000);
  sql += ' ORDER BY am.computed_at DESC, am.match_score DESC LIMIT ? OFFSET ?';
  args.push(limit, offset);

  const rows = db.prepare(sql).all(...args);
  res.json({
    matches: rows.map(r => ({ ...r, evidence: safeJson(r.evidence, {}) })),
    total_returned: rows.length,
  });
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
