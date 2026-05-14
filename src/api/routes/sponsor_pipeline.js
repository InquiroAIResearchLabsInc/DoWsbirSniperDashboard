const express = require('express');
const { getDb, uid, now } = require('../../db');
const { requireAuth } = require('../../auth/middleware');
const { recordSponsorPipelineAdd } = require('../../art/match_orchestrator');
const { emitReceipt } = require('../../core/receipt');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const rows = getDb().prepare(`SELECT sp.*, sc.name AS sponsor_name, sc.public_url AS sponsor_url
                                FROM sponsor_pipeline sp LEFT JOIN sponsor_candidates sc ON sc.id = sp.sponsor_candidate_id
                                WHERE sp.tenant_id = ? ORDER BY sp.created_at DESC`).all(req.tenant_id);
  res.json({ sponsor_pipeline: rows });
});

router.post('/', requireAuth, (req, res) => {
  const { phase_ii_tech_id, sponsor_id, notes } = req.body || {};
  if (!phase_ii_tech_id || !sponsor_id) return res.status(400).json({ error: 'phase_ii_tech_id and sponsor_id required' });
  const r = recordSponsorPipelineAdd({ tenant_id: req.tenant_id, phase_ii_tech_id, sponsor_id, notes });
  res.status(201).json(r);
});

router.put('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM sponsor_pipeline WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenant_id);
  if (!row) return res.status(404).json({ error: 'not_found' });
  const { status, notes } = req.body || {};
  db.prepare('UPDATE sponsor_pipeline SET status = COALESCE(?, status), notes = COALESCE(?, notes), updated_at = ? WHERE id = ?')
    .run(status || null, notes || null, now(), req.params.id);
  emitReceipt('sponsor_pipeline_updated', { tenant_id: req.tenant_id, sponsor_pipeline_id: req.params.id, status });
  res.json({ ok: true });
});

module.exports = router;
