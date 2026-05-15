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

app.use(express.static(path.join(config.ROOT, 'public'), { index: false }));

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
  ['/api/why', require('./routes/why')],
  ['/api/art-matches', require('./routes/art_matches')],
  ['/api/sponsor-pipeline', require('./routes/sponsor_pipeline')],
  ['/api/sba-eligibility', require('./routes/sba_eligibility')],
  ['/api/auth', require('./routes/auth')],
  ['/api/profile', require('./routes/profile')],
  ['/api/admin', require('./routes/admin')],
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
  try {
    const db = getDb();
    const oppCount = db.prepare('SELECT COUNT(*) c FROM opportunities').get().c;
    if (oppCount > 0) return;
    const fs = require('fs');
    const path = require('path');
    const fixturePath = path.join(config.ROOT, 'tests', 'fixtures', 'sbir_sample.json');
    if (!fs.existsSync(fixturePath)) return;
    const { normalizeTopic, normalizeSolicitation } = require('../ingest/normalize');
    const { computeDiffs } = require('../diff/engine');
    const { scoreTopic, persist } = require('../scoring/engine_topic');
    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const opps = [];
    for (const sol of raw.solicitations || []) {
      const topics = sol.solicitation_topics || sol.topics || [];
      if (topics.length) for (const t of topics) opps.push(normalizeTopic(t, sol, sol.agency || 'DOD'));
      else opps.push(normalizeSolicitation(sol, sol.agency || 'DOD'));
    }
    computeDiffs('sbir_gov', opps);
    const tenants = db.prepare('SELECT tenant_id FROM tenants').all().map(r => r.tenant_id);
    if (!tenants.includes('default')) tenants.push('default');
    if (!tenants.includes('sandbox')) tenants.push('sandbox');
    const allOpps = db.prepare('SELECT * FROM opportunities').all().map(o => ({ ...o, is_rolling: o.is_rolling === 1 }));
    let scored = 0;
    for (const tenant_id of tenants) {
      for (const opp of allOpps) {
        try { persist(scoreTopic(opp, tenant_id)); scored++; } catch (_) {}
      }
    }
    emitReceipt('boot_fixture_ingest', { tenant_id: 'admin', opportunities: allOpps.length, scored, tenants: tenants.length });
  } catch (e) {
    emitReceipt('boot_fixture_ingest_error', { tenant_id: 'admin', error: e.message });
  }
}

function start() {
  getDb();
  bootstrapDataIfEmpty();
  try { require('../scheduler/cron').schedule(); } catch (e) {
    emitReceipt('scheduler_start_error', { tenant_id: 'admin', error: e.message });
  }
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
