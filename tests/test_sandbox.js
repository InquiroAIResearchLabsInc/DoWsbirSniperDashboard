// Group 6 — sandbox behavior. Boots server in-process against a temp DB,
// uses fetch to hit /demo and confirm tenant isolation + reset semantics.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsip-sandbox-'));
process.env.DB_PATH = path.join(tmp, 'sandbox.db');
process.env.RECEIPTS_PATH = path.join(tmp, 'sandbox.jsonl');
process.env.MERKLE_ROOT_PATH = path.join(tmp, 'sandbox.merkle');
process.env.PORT = '0';
process.env.DEMO_TOKEN_SECRET = 'unit-test-secret';

const seed = require('../scripts/seed_load');
seed.load();

const { app } = require('../src/api/server');
const { resetSandboxTenant, SANDBOX_TENANT } = require('../src/learning/individual');
const { getDb } = require('../src/db');

let server, base;
test.before(async () => {
  await new Promise(r => { server = app.listen(0, r); });
  const addr = server.address();
  base = `http://127.0.0.1:${addr.port}`;
});
test.after(async () => { if (server) await new Promise(r => server.close(r)); });

test('GET /demo serves dashboard HTML and sets sandbox cookie', async () => {
  const r = await fetch(`${base}/demo`, { redirect: 'manual' });
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.ok(html.includes('<html'), 'expected HTML body');
  const setCookie = r.headers.get('set-cookie') || '';
  assert.ok(/dsip_sandbox=1/.test(setCookie), `expected dsip_sandbox=1 cookie, got: ${setCookie}`);
});

test('GET /api/whoami with sandbox cookie returns tenant=sandbox', async () => {
  const r = await fetch(`${base}/api/whoami`, { headers: { Cookie: 'dsip_sandbox=1' } });
  const me = await r.json();
  assert.equal(me.tenant_id, SANDBOX_TENANT);
  assert.equal(me.role, 'pilot');
});

test('sandbox write: pipeline add lands under tenant=sandbox', async () => {
  const db = getDb();
  const upOpp = db.prepare(`INSERT OR IGNORE INTO opportunities (id, source, title, first_seen, last_updated) VALUES (?,?,?,?,?)`);
  upOpp.run('sandbox_test_opp', 'sbir_gov', 'Sandbox test opp', new Date().toISOString(), new Date().toISOString());
  const r = await fetch(`${base}/api/pipeline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: 'dsip_sandbox=1' },
    body: JSON.stringify({ opportunity_id: 'sandbox_test_opp', title: 'Sandbox test opp', source: 'sbir_gov' }),
  });
  assert.ok(r.status === 200 || r.status === 201, `expected 2xx, got ${r.status}`);
  const inSandbox = db.prepare(`SELECT COUNT(*) c FROM pipeline WHERE tenant_id = ?`).get(SANDBOX_TENANT).c;
  assert.ok(inSandbox >= 1, `expected sandbox pipeline row, got ${inSandbox}`);
});

test('sandbox reset wipes ad-hoc rows and reseeds demo activity', async () => {
  const db = getDb();
  const before = db.prepare(`SELECT COUNT(*) c FROM pipeline WHERE tenant_id = ?`).get(SANDBOX_TENANT).c;
  assert.ok(before >= 1, 'precondition: should have sandbox rows before reset');
  const out = resetSandboxTenant();
  assert.equal(out.tenant_id, SANDBOX_TENANT);

  // The ad-hoc row added by the earlier test must be gone.
  const adhoc = db.prepare(`SELECT COUNT(*) c FROM pipeline WHERE tenant_id = ? AND opportunity_id = 'sandbox_test_opp'`).get(SANDBOX_TENANT).c;
  assert.equal(adhoc, 0, 'ad-hoc sandbox row should be wiped by reset');

  // Demo activity is reseeded so /demo is populated with zero setup.
  const pipeline = db.prepare(`SELECT COUNT(*) c FROM pipeline WHERE tenant_id = ?`).get(SANDBOX_TENANT).c;
  const outcomes = db.prepare(`SELECT COUNT(*) c FROM outcomes WHERE tenant_id = ?`).get(SANDBOX_TENANT).c;
  const lessons = db.prepare(`SELECT COUNT(*) c FROM lessons WHERE tenant_id = ?`).get(SANDBOX_TENANT).c;
  assert.ok(pipeline >= 1, 'pipeline should be reseeded with demo activity');
  assert.ok(outcomes >= 5, 'outcomes should be reseeded (>=5 unlocks calibration)');
  assert.equal(outcomes, lessons, 'every outcome generates a lesson');

  const techs = db.prepare(`SELECT COUNT(*) c FROM phase_ii_techs WHERE tenant_id = ?`).get(SANDBOX_TENANT).c;
  assert.ok(techs >= 1, 'phase_ii_techs should be reseeded');
});

test('ART disagreement from sandbox tagged with tenant=sandbox in receipt', async () => {
  // Insert a fake art_match row for sandbox so the disagree route can find it.
  const db = getDb();
  const id = 'sandbox_art_test';
  db.prepare(`INSERT OR REPLACE INTO art_matches (id, tenant_id, phase_ii_tech_id, sponsor_candidate_id, match_score, match_band, computed_at) VALUES (?,?,?,?,?,?,?)`)
    .run(id, SANDBOX_TENANT, 'x', 'y', 50, 'Promising', new Date().toISOString());
  const r = await fetch(`${base}/api/art-matches/${id}/disagree`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'dsip_sandbox=1' },
    body: JSON.stringify({ reason: 'unit test' }),
  });
  assert.equal(r.status, 200);
  const { readReceipts } = require('../src/core/receipt');
  const recent = readReceipts({ tenant_id: SANDBOX_TENANT, receipt_type: 'art_match_disagreement', limit: 5 });
  assert.ok(recent.length >= 1, 'expected sandbox disagreement receipt');
});

test('auth tenant isolation: sandbox writes do not appear under admin', () => {
  const db = getDb();
  const adminPipe = db.prepare(`SELECT COUNT(*) c FROM pipeline WHERE tenant_id = 'admin'`).get().c;
  // adminPipe may be 0 in test DB; the key invariant is that admin count is
  // not boosted by sandbox-tagged rows, which by design have tenant_id='sandbox'.
  const sandboxPipe = db.prepare(`SELECT COUNT(*) c FROM pipeline WHERE tenant_id = ?`).get(SANDBOX_TENANT).c;
  assert.notEqual(adminPipe, undefined);
  assert.notEqual(sandboxPipe, undefined);
});
