const express = require('express');
const path = require('path');
const config = require('../core/config');
const { getDb } = require('../db');
const { attachTenant } = require('../auth/middleware');
const { emitReceipt, getCurrentMerkleRoot } = require('../core/receipt');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
app.use(attachTenant);

app.use(express.static(path.join(config.ROOT, 'public')));

app.get('/health', (req, res) => {
  const db = getDb();
  const opps = db.prepare('SELECT COUNT(*) c FROM opportunities').get().c;
  const tenants = db.prepare('SELECT COUNT(*) c FROM tenants').get().c;
  res.json({
    status: 'ok',
    version: '0.2.0',
    db_opportunities: opps,
    db_tenants: tenants,
    merkle_root: getCurrentMerkleRoot(),
    ts: new Date().toISOString(),
  });
});

app.get('/api/whoami', (req, res) => {
  res.json({
    tenant_id: req.tenant_id,
    role: req.role,
    auth_kind: req.auth_kind || null,
    auth_error: req.auth_error || null,
  });
});

const routes = [
  ['/api/opportunities', require('./routes/opportunities')],
  ['/api/pipeline', require('./routes/pipeline')],
  ['/api/outcomes', require('./routes/outcomes')],
  ['/api/why', require('./routes/why')],
  ['/api/art-matches', require('./routes/art_matches')],
  ['/api/sponsor-pipeline', require('./routes/sponsor_pipeline')],
  ['/api/sba-eligibility', require('./routes/sba_eligibility')],
  ['/api/auth', require('./routes/auth')],
  ['/api/profile', require('./routes/profile')],
  ['/api/admin', require('./routes/admin')],
  ['/api/receipts', require('./routes/receipts')],
];
for (const [mount, router] of routes) app.use(mount, router);

app.use((err, req, res, next) => {
  emitReceipt('server_error', {
    tenant_id: req.tenant_id || 'default',
    path: req.path,
    error_name: err.name,
    error_message: err.message,
  });
  res.status(err.statusCode || 500).json({ error: err.name || 'internal_error', message: err.message });
});

function start() {
  getDb();
  const server = app.listen(config.PORT, () => {
    emitReceipt('server_boot', {
      tenant_id: 'admin',
      port: config.PORT,
      env: config.NODE_ENV,
    });
    console.log(`DSIP Sentinel · ART Edition listening on :${config.PORT}`);
  });
  return server;
}

if (require.main === module) start();

module.exports = { app, start };
