const express = require('express');
const { getDb, safeJson } = require('../../db');
const { scoreTopic, persist } = require('../../scoring/engine_topic');
const { emptyStatePayload } = require('../empty_state');
const { emitReceipt } = require('../../core/receipt');

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  const tenant_id = req.tenant_id;
  const filters = req.query || {};

  let sql = `SELECT o.*, s.fit_score, s.score_tier, s.score_tech, s.score_domain, s.score_type, s.score_timeline, s.score_funding, s.keywords_matched
             FROM opportunities o
             LEFT JOIN scores s ON s.opportunity_id = o.id AND s.tenant_id = ?
             WHERE 1=1`;
  const args = [tenant_id];
  if (filters.component) { sql += ' AND o.component = ?'; args.push(filters.component); }
  if (filters.source) { sql += ' AND o.source = ?'; args.push(filters.source); }
  if (filters.tier) { sql += ' AND s.score_tier = ?'; args.push(filters.tier); }
  if (filters.min_score) { sql += ' AND s.fit_score >= ?'; args.push(Number(filters.min_score)); }
  sql += ' ORDER BY s.fit_score DESC, o.close_date ASC LIMIT 200';

  const rows = db.prepare(sql).all(...args).map(r => ({
    ...r,
    is_rolling: r.is_rolling === 1,
    keywords_matched: safeJson(r.keywords_matched, []),
  }));

  emitReceipt('opportunities_listed', { tenant_id, returned: rows.length, filters });

  const primes = rows.filter(r => r.score_tier === 'PRIME');
  if (primes.length === 0) {
    const fallback = rows.filter(r => r.score_tier === 'EVALUATE').slice(0, 3);
    return res.json({ ...emptyStatePayload({ tenant_id, fallback_opps: fallback }), opportunities: rows });
  }
  res.json({ opportunities: rows, empty_state: false });
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

module.exports = router;
