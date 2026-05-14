const express = require('express');
const demo = require('../../auth/demo_token');
const magic = require('../../auth/magic_link');
const { emitReceipt } = require('../../core/receipt');
const { requireAdmin } = require('../../auth/middleware');

const router = express.Router();

router.post('/demo-token', requireAdmin, (req, res) => {
  const { tenant_id, ttl_days, role } = req.body || {};
  if (!tenant_id) return res.status(400).json({ error: 'tenant_id required' });
  const out = demo.issue({ tenant_id, ttl_days, role, issued_by: req.tenant_id });
  res.json(out);
});

router.post('/revoke', requireAdmin, (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'token required' });
  res.json(demo.revoke(token, { revoked_by: req.tenant_id }));
});

router.get('/use', (req, res) => {
  const token = req.query.t;
  if (!token) return res.status(400).json({ error: 't query param required' });
  const v = demo.verify(token);
  if (!v.ok) return res.status(401).json({ error: 'invalid_token', reason: v.reason });
  demo.recordUsage({ tenant_id: v.tenant_id, token, ip: req.ip, user_agent: req.headers['user-agent'] });
  res.cookie ? res.cookie('dsip_t', token, { httpOnly: true, sameSite: 'lax' }) : null;
  res.json({ ok: true, tenant_id: v.tenant_id, role: v.role });
});

router.post('/magic-link', (req, res) => {
  const { tenant_id, email_hash } = req.body || {};
  if (!tenant_id) return res.status(400).json({ error: 'tenant_id required' });
  res.json(magic.issue({ tenant_id, email_hash }));
});

module.exports = router;
