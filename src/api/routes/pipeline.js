const express = require('express');
const { getDb, uid, now, safeJson } = require('../../db');
const { emitReceipt } = require('../../core/receipt');
const { requireAuth } = require('../../auth/middleware');

const router = express.Router();

const TERMINAL = new Set(['awarded', 'rejected', 'withdrawn', 'no_response']);

function daysToDeadline(deadline) {
  if (!deadline) return null;
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d - new Date()) / 86400000);
}

// Pipeline rows joined with the opportunity + this tenant's score so the UI
// can render deadlines/tiers and the outcome modal can capture the original
// score breakdown without a second round-trip.
router.get('/', requireAuth, (req, res) => {
  const rows = getDb().prepare(`
    SELECT p.*,
           o.component, o.agency, o.sub_agency, o.program, o.phase, o.topic_code, o.source_url,
           s.fit_score, s.score_tier, s.score_tech, s.score_domain, s.score_type,
           s.score_timeline, s.score_funding, s.keywords_matched,
           (SELECT COUNT(*) FROM outcomes oc WHERE oc.pipeline_id = p.id) AS has_outcome
    FROM pipeline p
    LEFT JOIN opportunities o ON o.id = p.opportunity_id
    LEFT JOIN scores s ON s.opportunity_id = p.opportunity_id AND s.tenant_id = p.tenant_id
    WHERE p.tenant_id = ?
    ORDER BY p.created_at DESC
  `).all(req.tenant_id).map(r => ({
    ...r,
    has_outcome: r.has_outcome > 0,
    is_terminal: TERMINAL.has(r.status),
    days_to_deadline: daysToDeadline(r.deadline),
    keywords_matched: safeJson(r.keywords_matched, []),
  }));
  res.json({ pipeline: rows });
});

router.post('/', requireAuth, (req, res) => {
  const { opportunity_id, title, source, deadline, funding_amount, notes } = req.body || {};
  if (!opportunity_id || !title || !source) return res.status(400).json({ error: 'opportunity_id, title, source required' });
  const db = getDb();

  // Dedup: one pipeline entry per opportunity per tenant. A second "Add to
  // Pipeline" updates the existing row instead of stacking a duplicate.
  const existing = db.prepare('SELECT * FROM pipeline WHERE tenant_id = ? AND opportunity_id = ?').get(req.tenant_id, opportunity_id);
  if (existing) {
    db.prepare('UPDATE pipeline SET deadline = COALESCE(?, deadline), funding_amount = COALESCE(?, funding_amount), notes = COALESCE(?, notes), updated_at = ? WHERE id = ?')
      .run(deadline || null, funding_amount || null, notes || null, now(), existing.id);
    emitReceipt('pipeline_updated', { tenant_id: req.tenant_id, pipeline_id: existing.id, opportunity_id, reason: 'dedup_merge' });
    return res.status(200).json({ id: existing.id, deduped: true });
  }

  const id = uid();
  db.prepare('INSERT INTO pipeline (id, tenant_id, opportunity_id, title, source, status, deadline, funding_amount, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, req.tenant_id, opportunity_id, title, source, 'watching', deadline || null, funding_amount || null, notes || null, now(), now());
  emitReceipt('pipeline_added', { tenant_id: req.tenant_id, opportunity_id, pipeline_id: id });
  res.status(201).json({ id });
});

router.put('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM pipeline WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenant_id);
  if (!row) return res.status(404).json({ error: 'not_found' });
  const { status, notes, deadline, funding_amount } = req.body || {};
  db.prepare('UPDATE pipeline SET status = COALESCE(?, status), notes = COALESCE(?, notes), deadline = COALESCE(?, deadline), funding_amount = COALESCE(?, funding_amount), updated_at = ? WHERE id = ?')
    .run(status || null, notes || null, deadline || null, funding_amount == null ? null : funding_amount, now(), req.params.id);
  emitReceipt('pipeline_updated', { tenant_id: req.tenant_id, pipeline_id: req.params.id, status });
  res.json({ ok: true });
});

module.exports = router;
