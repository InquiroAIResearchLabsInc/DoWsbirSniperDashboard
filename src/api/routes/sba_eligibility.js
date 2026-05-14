const express = require('express');
const { getDb, safeJson } = require('../../db');
const { requireAuth } = require('../../auth/middleware');
const { compute, SBA_CRITERIA } = require('../../art/sba_eligibility');
const { getCopy } = require('../../core/copy');

const router = express.Router();

router.get('/criteria', (req, res) => res.json({ criteria: SBA_CRITERIA, explainer: getCopy('sba_eligibility_explainer') }));

router.get('/', requireAuth, (req, res) => {
  const row = getDb().prepare('SELECT * FROM sba_eligibility WHERE tenant_id = ? ORDER BY computed_at DESC LIMIT 1').get(req.tenant_id);
  if (!row) return res.json({ eligibility: null });
  res.json({ eligibility: { ...row, eligible: row.eligible === 1, missing_criteria: safeJson(row.missing_criteria, []), evidence: safeJson(row.evidence, []) } });
});

router.post('/compute', requireAuth, (req, res) => {
  const db = getDb();
  const profile = db.prepare('SELECT * FROM profiles WHERE tenant_id = ?').get(req.tenant_id) || {};
  const phase_ii_count = db.prepare('SELECT COUNT(*) c FROM phase_ii_techs WHERE tenant_id = ?').get(req.tenant_id).c;
  const r = compute({ tenant_id: req.tenant_id, profile, phase_ii_count });
  res.json(r);
});

module.exports = router;
