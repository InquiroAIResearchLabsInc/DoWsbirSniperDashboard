const express = require('express');
const { getDb, uid, now } = require('../../db');
const { emitReceipt } = require('../../core/receipt');
const { requireAuth } = require('../../auth/middleware');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const rows = getDb().prepare('SELECT * FROM pipeline WHERE tenant_id = ? ORDER BY created_at DESC').all(req.tenant_id);
  res.json({ pipeline: rows });
});

router.post('/', requireAuth, (req, res) => {
  const { opportunity_id, title, source, deadline, funding_amount, notes } = req.body || {};
  if (!opportunity_id || !title || !source) return res.status(400).json({ error: 'opportunity_id, title, source required' });
  const id = uid();
  getDb().prepare('INSERT INTO pipeline (id, tenant_id, opportunity_id, title, source, status, deadline, funding_amount, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, req.tenant_id, opportunity_id, title, source, 'watching', deadline || null, funding_amount || null, notes || null, now(), now());
  emitReceipt('pipeline_added', { tenant_id: req.tenant_id, opportunity_id, pipeline_id: id });
  res.status(201).json({ id });
});

router.put('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM pipeline WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenant_id);
  if (!row) return res.status(404).json({ error: 'not_found' });
  const { status, notes } = req.body || {};
  db.prepare('UPDATE pipeline SET status = COALESCE(?, status), notes = COALESCE(?, notes), updated_at = ? WHERE id = ?')
    .run(status || null, notes || null, now(), req.params.id);
  emitReceipt('pipeline_updated', { tenant_id: req.tenant_id, pipeline_id: req.params.id, status });
  res.json({ ok: true });
});

module.exports = router;
