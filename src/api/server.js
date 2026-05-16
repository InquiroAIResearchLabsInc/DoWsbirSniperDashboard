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

const publicRoute = require('./routes/public');
app.use(publicRoute.router);

app.get('/dashboard', (req, res) => res.sendFile(path.join(config.ROOT, 'public', 'index.html')));
app.get('/demo', (req, res) => {
  res.set('Set-Cookie', 'dsip_sandbox=1; Path=/; SameSite=Lax; Max-Age=3600');
  emitReceipt('sandbox_session_start', {
    tenant_id: 'sandbox',
    user_agent: (req.headers['user-agent'] || '').slice(0, 200),
  });
  res.sendFile(path.join(config.ROOT, 'public', 'index.html'));
});

app.use(express.static(path.join(config.ROOT, 'public'), {
  index: false,
  setHeaders(res, filePath) {
    if (/\.(js|css|html)$/.test(filePath)) res.set('Cache-Control', 'no-store');
  },
}));

app.get('/favicon.ico', (req, res) => res.status(204).end());

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

app.get('/favicon.ico', (req, res) => res.status(204).end());

const routes = [
  ['/api/copy', require('./routes/copy')],
  ['/api/opportunities', require('./routes/opportunities')],
  ['/api/pipeline', require('./routes/pipeline')],
  ['/api/outcomes', require('./routes/outcomes')],
  ['/api/digest', require('./routes/digest')],
  ['/api/why', require('./routes/why')],
  ['/api/art-matches', require('./routes/art_matches')],
  ['/api/sponsor-pipeline', require('./routes/sponsor_pipeline')],
  ['/api/sba-eligibility', require('./routes/sba_eligibility')],
  ['/api/auth', require('./routes/auth')],
  ['/api/profile', require('./routes/profile')],
  ['/api/admin', require('./routes/admin')],
  ['/api/scrape', require('./routes/scrape')],
  ['/api/receipts', require('./routes/receipts')],
  ['/api/copy', require('./routes/copy')],
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

function bootstrapDataIfEmpty() {
  const db = getDb();
  const oppCount = db.prepare('SELECT COUNT(*) c FROM opportunities').get().c;
  if (oppCount > 0) return;
  // loadBootstrap is async (live SBIR scrape with fixture fallback); run it in
  // the background so app.listen does not wait on the network call.
  const { loadBootstrap } = require('../../scripts/seed_load');
  loadBootstrap()
    .then(out => { if (out && out.skipped) emitReceipt('boot_fixture_skipped', { tenant_id: 'admin', reason: out.reason }); })
    .catch(e => emitReceipt('boot_fixture_ingest_error', { tenant_id: 'admin', error: e.message }));
}

function start() {
  getDb();
  bootstrapDataIfEmpty();
  let schedulerHandle = null;
  const server = app.listen(config.PORT, () => {
    emitReceipt('server_boot', {
      tenant_id: 'admin',
      port: config.PORT,
      env: config.NODE_ENV,
    });
    if (process.env.NODE_ENV !== 'test') {
      try { schedulerHandle = require('../scheduler/cron').schedule(); } catch (e) {
        emitReceipt('scheduler_start_error', { tenant_id: 'admin', error: e.message });
      }
    }
    console.log(`DSIP Sentinel · ART Edition listening on :${config.PORT}`);
  });
  const origClose = server.close.bind(server);
  server.close = (cb) => {
    if (schedulerHandle) { try { schedulerHandle.stop(); } catch (_) {} schedulerHandle = null; }
    return origClose(cb);
  };
  return server;
}

if (require.main === module) start();

module.exports = { app, start };
