const crypto = require('crypto');
const config = require('../core/config');
const { emitReceipt } = require('../core/receipt');
const { validateTenantId } = require('../core/tenant');
const { dualHash } = require('../core/hash');

function sign(payload) {
  return crypto.createHmac('sha256', config.MAGIC_LINK_SECRET).update(payload).digest('base64url');
}

function issue({ tenant_id, email_hash }) {
  validateTenantId(tenant_id);
  const expires_at = Math.floor(Date.now() / 1000) + config.MAGIC_LINK_TTL_MINUTES * 60;
  const nonce = crypto.randomBytes(8).toString('base64url');
  const payload = `${tenant_id}.${expires_at}.${nonce}`;
  const sig = sign(payload);
  const token = `${payload}.${sig}`;
  emitReceipt('magic_link_issued', {
    tenant_id,
    email_hash: email_hash || null,
    token_hash: dualHash(token),
    expires_at_iso: new Date(expires_at * 1000).toISOString(),
  });
  return { token, expires_at };
}

function verify(token) {
  if (!token || typeof token !== 'string') return { ok: false, reason: 'missing' };
  const parts = token.split('.');
  if (parts.length !== 4) return { ok: false, reason: 'malformed' };
  const [tenant_id, expires_at_str, nonce, sig] = parts;
  const payload = `${tenant_id}.${expires_at_str}.${nonce}`;
  const expected = sign(payload);
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return { ok: false, reason: 'invalid_signature' };
  }
  const expires_at = parseInt(expires_at_str, 10);
  if (Math.floor(Date.now() / 1000) > expires_at) return { ok: false, reason: 'expired' };
  try { validateTenantId(tenant_id); } catch { return { ok: false, reason: 'invalid_tenant_id' }; }
  return { ok: true, tenant_id, expires_at };
}

module.exports = { issue, verify };
