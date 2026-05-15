// Group 7 — public landing page. Boots server in-process and verifies the
// no-auth entry, the token redirect, the expired-token soft fall, and the
// public stats endpoint.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsip-landing-'));
process.env.DB_PATH = path.join(tmp, 'l.db');
process.env.RECEIPTS_PATH = path.join(tmp, 'l.jsonl');
process.env.MERKLE_ROOT_PATH = path.join(tmp, 'l.merkle');
process.env.DEMO_TOKEN_SECRET = 'unit-test-secret';

const seed = require('../scripts/seed_load');
seed.load();

const { app } = require('../src/api/server');
const demo = require('../src/auth/demo_token');

let server, base;
test.before(async () => {
  await new Promise(r => { server = app.listen(0, r); });
  const addr = server.address();
  base = `http://127.0.0.1:${addr.port}`;
});
test.after(async () => { if (server) await new Promise(r => server.close(r)); });

test('GET / with no token returns 200 + landing HTML', async () => {
  const r = await fetch(`${base}/`, { redirect: 'manual' });
  assert.equal(r.status, 200);
  const body = await r.text();
  assert.ok(body.includes('Open Sandbox'), 'expected primary CTA in landing HTML');
  assert.ok(!body.includes('Request Access'), 'Request Access CTA should be removed');
  assert.ok(!body.includes('Topics scored'), 'stat chips should be removed');
});

test('GET /?token=<valid> redirects to /dashboard', async () => {
  const issued = demo.issue({ tenant_id: 'landing_test_tenant', ttl_days: 1, role: 'pilot' });
  const r = await fetch(`${base}/?token=${encodeURIComponent(issued.token)}`, { redirect: 'manual' });
  assert.equal(r.status, 302, `expected 302 redirect, got ${r.status}`);
  const loc = r.headers.get('location');
  assert.ok(loc && loc.startsWith('/dashboard'), `expected /dashboard redirect, got ${loc}`);
});

test('GET /?token=<expired> renders landing (token treated as absent, not error)', async () => {
  const issued = demo.issue({ tenant_id: 'landing_expired', ttl_days: -1, role: 'pilot' });
  const r = await fetch(`${base}/?token=${encodeURIComponent(issued.token)}`, { redirect: 'manual' });
  assert.equal(r.status, 200);
  const body = await r.text();
  assert.ok(body.includes('Open Sandbox'), 'expected landing HTML for expired token');
});

test('GET /api/stats returns 3 fields and no tenant data', async () => {
  const r = await fetch(`${base}/api/stats`);
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.ok('topics_scored' in j, 'missing topics_scored');
  assert.ok('components' in j, 'missing components');
  assert.ok('art_matches' in j, 'missing art_matches');
  // No tenant_id, no email, no per-tenant arrays
  assert.equal(j.tenant_id, undefined);
  assert.equal(j.tenants, undefined);
});

test('landing emits landing_page_view receipt', async () => {
  await fetch(`${base}/`);
  const { readReceipts } = require('../src/core/receipt');
  const recent = readReceipts({ receipt_type: 'landing_page_view', limit: 10 });
  assert.ok(recent.length >= 1, 'expected at least one landing_page_view receipt');
});
