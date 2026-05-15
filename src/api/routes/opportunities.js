const express = require('express');
const { getDb, safeJson, uid, now } = require('../../db');
const { scoreTopic, persist } = require('../../scoring/engine_topic');
const { emitReceipt } = require('../../core/receipt');
const { requireAuth } = require('../../auth/middleware');
const { emptyStatePayload } = require('../empty_state');

const router = express.Router();

const TIER_VALUES = new Set(['PRIME', 'EVALUATE', 'STRETCH', 'SKIP']);
const DISMISS_TTL_DAYS = 30;

function clampInt(v, def, min, max) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(Math.max(n, min), max);
}

router.get('/', (req, res) => {
  const db = getDb();
  const tenant_id = req.tenant_id;
  const filters = req.query || {};

  let sql = `SELECT o.*, s.fit_score, s.score_tier, s.score_tech, s.score_domain, s.score_type, s.score_timeline, s.score_funding, s.keywords_matched
             FROM opportunities o
             LEFT JOIN scores s ON s.opportunity_id = o.id AND s.tenant_id = ?
             WHERE 1=1`;
  const args = [tenant_id];

  // Hide opportunities this tenant has dismissed, until the dismissal expires
  // (then they resurrect on their own — no cron needed).
  if (filters.include_dismissed !== '1') {
    sql += ` AND o.id NOT IN (SELECT opportunity_id FROM dismissals WHERE tenant_id = ? AND (expires_at IS NULL OR expires_at > ?))`;
    args.push(tenant_id, now());
  }

  if (filters.component) { sql += ' AND o.component = ?'; args.push(filters.component); }
  if (filters.source) { sql += ' AND o.source = ?'; args.push(filters.source); }
  if (filters.tier) {
    const tier = String(filters.tier).toUpperCase();
    if (TIER_VALUES.has(tier)) { sql += ' AND s.score_tier = ?'; args.push(tier); }
  }
  if (filters.min_score) {
    const ms = Number(filters.min_score);
    if (Number.isFinite(ms) && ms > 0) { sql += ' AND s.fit_score >= ?'; args.push(ms); }
  }
  if (filters.q) {
    const q = `%${String(filters.q).trim()}%`;
    if (q.length > 2) {
      sql += ' AND (o.title LIKE ? COLLATE NOCASE OR o.description LIKE ? COLLATE NOCASE OR o.topic_code LIKE ? COLLATE NOCASE)';
      args.push(q, q, q);
    }
  }
  const limit = clampInt(filters.limit, 50, 1, 200);
  const offset = clampInt(filters.offset, 0, 0, 100000);
  sql += ' ORDER BY s.fit_score DESC, o.close_date ASC LIMIT ? OFFSET ?';
  args.push(limit, offset);

  const rows = db.prepare(sql).all(...args).map(r => ({
    ...r,
    is_rolling: r.is_rolling === 1,
    keywords_matched: safeJson(r.keywords_matched, []),
  }));

  const primes = rows.filter(r => r.score_tier === 'PRIME');
  if (primes.length === 0) {
    const fallback = rows.filter(r => r.score_tier === 'EVALUATE').slice(0, 3);
    return res.json({ ...emptyStatePayload({ tenant_id, fallback_opps: fallback }), opportunities: rows, total_returned: rows.length });
  }
  res.json({ opportunities: rows, empty_state: false, total_returned: rows.length });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM opportunities WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json({ opportunity: { ...row, is_rolling: row.is_rolling === 1 } });
});

router.post('/:id/score', (req, res) => {
  const db = getDb();
  const opp = db.prepare('SELECT * FROM opportunities WHERE id = ?').get(req.params.id);
  if (!opp) return res.status(404).json({ error: 'not_found' });
  const result = persist(scoreTopic(opp, req.tenant_id));
  res.json({ score: result });
});

// Dismiss — hide an opportunity for this tenant. Dismissals auto-expire after
// DISMISS_TTL_DAYS so a still-relevant topic resurrects on its own.
router.post('/:id/dismiss', requireAuth, (req, res) => {
  const db = getDb();
  const opp = db.prepare('SELECT id FROM opportunities WHERE id = ?').get(req.params.id);
  if (!opp) return res.status(404).json({ error: 'not_found' });
  const expires_at = new Date(Date.now() + DISMISS_TTL_DAYS * 86400000).toISOString();
  db.prepare('DELETE FROM dismissals WHERE tenant_id = ? AND opportunity_id = ?').run(req.tenant_id, req.params.id);
  db.prepare('INSERT INTO dismissals (id, tenant_id, opportunity_id, dismissed_at, expires_at, reason) VALUES (?,?,?,?,?,?)')
    .run(uid(), req.tenant_id, req.params.id, now(), expires_at, (req.body && req.body.reason) || null);
  emitReceipt('opportunity_dismissed', { tenant_id: req.tenant_id, opportunity_id: req.params.id, expires_at });
  res.json({ ok: true, expires_at });
});

router.post('/:id/undismiss', requireAuth, (req, res) => {
  getDb().prepare('DELETE FROM dismissals WHERE tenant_id = ? AND opportunity_id = ?').run(req.tenant_id, req.params.id);
  emitReceipt('opportunity_undismissed', { tenant_id: req.tenant_id, opportunity_id: req.params.id });
  res.json({ ok: true });
});

module.exports = router;
