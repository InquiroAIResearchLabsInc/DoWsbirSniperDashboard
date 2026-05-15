const express = require('express');
const { getDb } = require('../../db');
const { recordOutcome, runCalibration, computeROI, getLessons, applyCalibration } = require('../../learning/individual');
const { requireAuth } = require('../../auth/middleware');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const rows = getDb().prepare('SELECT * FROM outcomes WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 200').all(req.tenant_id);
  res.json({ outcomes: rows });
});

router.post('/', requireAuth, (req, res) => {
  const body = req.body || {};
  body.tenant_id = req.tenant_id;
  if (!body.opportunity_id || !body.pipeline_id || !body.terminal_status) {
    return res.status(400).json({ error: 'opportunity_id, pipeline_id, terminal_status required' });
  }
  const id = recordOutcome(body);
  res.status(201).json({ id });
});

router.get('/calibration', requireAuth, (req, res) => {
  res.json({ calibration: runCalibration({ tenant_id: req.tenant_id }) });
});

// Apply the calibration: derive new topic weights from the win/loss analysis,
// persist them (audited via weight_history), and rescore the board.
router.post('/calibration/apply', requireAuth, (req, res) => {
  const result = applyCalibration({ tenant_id: req.tenant_id });
  if (!result.applied) return res.status(400).json({ error: result.reason });
  res.json(result);
});

router.get('/roi', requireAuth, (req, res) => {
  res.json({ roi: computeROI({ tenant_id: req.tenant_id }) });
});

router.get('/lessons', requireAuth, (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);
  res.json({ lessons: getLessons({ tenant_id: req.tenant_id, limit }) });
});

module.exports = router;
