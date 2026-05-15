#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../src/core/config');
const demo = require('../src/auth/demo_token');
const { emitReceipt } = require('../src/core/receipt');
const { dualHash } = require('../src/core/hash');
const { readReceipts } = require('../src/core/receipt');

function arg(name, def) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx < 0) return def;
  return process.argv[idx + 1];
}

const tenant_id = arg('tenant');
const tokenArg = arg('token');
if (!tenant_id && !tokenArg) {
  console.error('Usage: node scripts/revoke_demo_token.js --tenant <tenant_id> [--token <full_token>]');
  console.error('       Either --tenant or --token must be provided.');
  process.exit(1);
}

if (tokenArg) {
  const r = demo.revoke(tokenArg, { revoked_by: 'admin' });
  console.log(JSON.stringify({ ok: true, tenant_id: tokenArg.split('.')[0], token_hash: r.token_hash }, null, 2));
  process.exit(0);
}

const REVOCATION_PATH = path.join(config.ROOT, 'data', 'revoked_tokens.json');
function loadRev() {
  if (!fs.existsSync(REVOCATION_PATH)) return new Set();
  try { return new Set(JSON.parse(fs.readFileSync(REVOCATION_PATH, 'utf8'))); } catch { return new Set(); }
}

const issued = readReceipts({ receipt_type: 'demo_token_issued', tenant_id, limit: 1000 });
if (!issued.length) {
  console.error(`No demo_token_issued receipts found for tenant ${tenant_id}.`);
  process.exit(1);
}
const set = loadRev();
let revoked = 0;
for (const r of issued) {
  const th = r.body && r.body.token_hash;
  if (!th) continue;
  if (!set.has(th)) { set.add(th); revoked++; }
}
fs.mkdirSync(path.dirname(REVOCATION_PATH), { recursive: true });
fs.writeFileSync(REVOCATION_PATH, JSON.stringify([...set], null, 2));
emitReceipt('demo_token_revoked', { tenant_id, revoked_by_tenant_id: 'admin', revoked_count: revoked, scope: 'all_known_for_tenant' });
console.log(JSON.stringify({ ok: true, tenant_id, revoked_count: revoked, total_hashes: set.size }, null, 2));
