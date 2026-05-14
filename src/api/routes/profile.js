const express = require('express');
const { getDb, now, safeJson } = require('../../db');
const { requireAuth } = require('../../auth/middleware');
const { emitReceipt } = require('../../core/receipt');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const row = getDb().prepare('SELECT * FROM profiles WHERE tenant_id = ?').get(req.tenant_id);
  if (!row) return res.json({ profile: null });
  res.json({ profile: { ...row, tech_keywords: safeJson(row.tech_keywords, []) } });
});

router.put('/', requireAuth, (req, res) => {
  const body = req.body || {};
  const db = getDb();
  const existing = db.prepare('SELECT * FROM profiles WHERE tenant_id = ?').get(req.tenant_id);
  const ts = now();
  if (existing) {
    db.prepare(`UPDATE profiles SET company_name = COALESCE(?, company_name), uei = COALESCE(?, uei),
        tech_keywords = COALESCE(?, tech_keywords), trl_self_declared = COALESCE(?, trl_self_declared),
        private_match_secured = COALESCE(?, private_match_secured), commercial_viability = COALESCE(?, commercial_viability),
        pom_commitment_secured = COALESCE(?, pom_commitment_secured), dow_match_secured = COALESCE(?, dow_match_secured),
        updated_at = ? WHERE tenant_id = ?`)
      .run(body.company_name || null, body.uei || null,
        body.tech_keywords != null ? JSON.stringify(body.tech_keywords) : null,
        body.trl_self_declared != null ? body.trl_self_declared : null,
        body.private_match_secured != null ? (body.private_match_secured ? 1 : 0) : null,
        body.commercial_viability != null ? (body.commercial_viability ? 1 : 0) : null,
        body.pom_commitment_secured != null ? (body.pom_commitment_secured ? 1 : 0) : null,
        body.dow_match_secured != null ? (body.dow_match_secured ? 1 : 0) : null,
        ts, req.tenant_id);
  } else {
    db.prepare(`INSERT INTO profiles (tenant_id, company_name, uei, tech_keywords, trl_self_declared, private_match_secured, commercial_viability, pom_commitment_secured, dow_match_secured, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(req.tenant_id, body.company_name || null, body.uei || null,
        JSON.stringify(body.tech_keywords || []),
        body.trl_self_declared || null,
        body.private_match_secured ? 1 : 0, body.commercial_viability ? 1 : 0,
        body.pom_commitment_secured ? 1 : 0, body.dow_match_secured ? 1 : 0, ts);
  }
  emitReceipt('profile_updated', { tenant_id: req.tenant_id, fields_changed: Object.keys(body) });
  res.json({ ok: true });
});

module.exports = router;
