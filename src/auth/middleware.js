const demo = require('./demo_token');
const magic = require('./magic_link');
const { ADMIN_TENANT, DEFAULT_TENANT } = require('../core/tenant');

function extractToken(req) {
  const auth = req.headers['authorization'];
  if (auth && auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  if (req.query && req.query.t) return String(req.query.t);
  if (req.cookies && req.cookies.dsip_t) return req.cookies.dsip_t;
  return null;
}

function attachTenant(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    req.tenant_id = DEFAULT_TENANT;
    req.role = 'anonymous';
    return next();
  }
  let result = demo.verify(token);
  let kind = 'demo';
  if (!result.ok) {
    const ml = magic.verify(token);
    if (ml.ok) { result = ml; kind = 'magic'; }
  }
  if (!result.ok) {
    req.tenant_id = DEFAULT_TENANT;
    req.role = 'anonymous';
    req.auth_error = result.reason;
    return next();
  }
  req.tenant_id = result.tenant_id;
  req.role = result.role || (kind === 'magic' ? 'authenticated' : 'pilot');
  req.token = token;
  req.auth_kind = kind;
  return next();
}

function requireAuth(req, res, next) {
  if (!req.tenant_id || req.tenant_id === DEFAULT_TENANT || req.role === 'anonymous') {
    return res.status(401).json({ error: 'unauthorized', reason: req.auth_error || 'no_token' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (req.tenant_id !== ADMIN_TENANT) {
    return res.status(403).json({ error: 'forbidden', reason: 'admin_only' });
  }
  next();
}

module.exports = { attachTenant, requireAuth, requireAdmin, extractToken };
