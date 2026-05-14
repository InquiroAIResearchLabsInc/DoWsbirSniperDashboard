const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('../core/config');
const { emitReceipt } = require('../core/receipt');
const { validateTenantId } = require('../core/tenant');
const { StopRule } = require('../core/stoprule');
const { dualHash } = require('../core/hash');

const REVOCATION_PATH = path.join(config.ROOT, 'data', 'revoked_tokens.json');

function sign(payload) {
  return crypto.createHmac('sha256', config.DEMO_TOKEN_SECRET).update(payload).digest('base64url');
}

function issue({ tenant_id, ttl_days, role = 'pilot', issued_by = 'admin' }) {
  validateTenantId(tenant_id);
  const days = ttl_days || config.DEMO_TOKEN_DEFAULT_TTL_DAYS;
  const expires_at = Math.floor(Date.now() / 1000) + days * 86400;
  const payload = `${tenant_id}.${expires_at}.${role}`;
  const sig = sign(payload);
  const token = `${payload}.${sig}`;
  const token_hash = dualHash(token);
  emitReceipt('demo_token_issued', {
    tenant_id,
    role,
    token_hash,
    expires_at_iso: new Date(expires_at * 1000).toISOString(),
    issued_by_tenant_id: issued_by,
  });
  return { token, expires_at, tenant_id, role };
}

function verify(token) {
  if (!token || typeof token !== 'string') return { ok: false, reason: 'missing' };
  const parts = token.split('.');
  if (parts.length !== 4) return { ok: false, reason: 'malformed' };
  const [tenant_id, expires_at_str, role, sig] = parts;
  const payload = `${tenant_id}.${expires_at_str}.${role}`;
  const expected = sign(payload);
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return { ok: false, reason: 'invalid_signature' };
  }
  const expires_at = parseInt(expires_at_str, 10);
  if (!Number.isFinite(expires_at)) return { ok: false, reason: 'malformed_expiry' };
  if (Math.floor(Date.now() / 1000) > expires_at) return { ok: false, reason: 'expired' };
  if (isRevoked(dualHash(token))) return { ok: false, reason: 'revoked' };
  try { validateTenantId(tenant_id); } catch { return { ok: false, reason: 'invalid_tenant_id' }; }
  return { ok: true, tenant_id, role, expires_at };
}

function loadRevocations() {
  if (!fs.existsSync(REVOCATION_PATH)) return new Set();
  try {
    const arr = JSON.parse(fs.readFileSync(REVOCATION_PATH, 'utf8'));
    return new Set(Array.isArray(arr) ? arr : []);
  } catch { return new Set(); }
}

function isRevoked(token_hash) {
  return loadRevocations().has(token_hash);
}

function revoke(token, { revoked_by = 'admin' } = {}) {
  const token_hash = dualHash(token);
  const set = loadRevocations();
  set.add(token_hash);
  const dir = path.dirname(REVOCATION_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(REVOCATION_PATH, JSON.stringify([...set], null, 2));
  emitReceipt('demo_token_revoked', { token_hash, revoked_by_tenant_id: revoked_by, tenant_id: revoked_by });
  return { ok: true, token_hash };
}

function recordUsage({ tenant_id, token, ip, user_agent }) {
  const token_hash = dualHash(token);
  return emitReceipt('demo_token_used', {
    tenant_id,
    token_hash,
    ip: ip || null,
    user_agent: user_agent || null,
  });
}

module.exports = { issue, verify, revoke, recordUsage, isRevoked };
