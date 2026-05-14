const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsip-t2h-'));
process.env.DB_PATH = path.join(tmpDir, 't2h.db');
process.env.RECEIPTS_PATH = path.join(tmpDir, 't2h.jsonl');
process.env.MERKLE_ROOT_PATH = path.join(tmpDir, 't2h.merkle');
process.env.DEMO_TOKEN_SECRET = 'unit-test-secret';

const { dualHash, merkleRoot, stableStringify } = require('../src/core/hash');
const { emitReceipt, verifyChain, getCurrentMerkleRoot } = require('../src/core/receipt');
const { validateTenantId } = require('../src/core/tenant');
const { StopRule } = require('../src/core/stoprule');
const demo = require('../src/auth/demo_token');

test('dualHash produces sha256:blake3 shape', () => {
  const h = dualHash('test');
  assert.match(h, /^[a-f0-9]{64}:[a-f0-9]+$/);
});

test('stableStringify is order-independent for objects', () => {
  assert.equal(stableStringify({ a: 1, b: 2 }), stableStringify({ b: 2, a: 1 }));
});

test('merkleRoot empty case is stable', () => {
  const r = merkleRoot([]);
  assert.match(r, /^[a-f0-9]{64}:/);
});

test('emit_receipt writes parent_hash chain', () => {
  emitReceipt('t2h_test_a', { tenant_id: 'admin', n: 1 });
  emitReceipt('t2h_test_b', { tenant_id: 'admin', n: 2 });
  const v = verifyChain();
  assert.equal(v.ok, true, JSON.stringify(v));
  assert.ok(v.count >= 2, `expected >= 2 receipts, got ${v.count}`);
});

test('validateTenantId rejects garbage', () => {
  assert.throws(() => validateTenantId(''), StopRule);
  assert.throws(() => validateTenantId('a b'), StopRule);
  assert.equal(validateTenantId('admin'), 'admin');
});

test('demo token round trip', () => {
  const issued = demo.issue({ tenant_id: 'pilot_round_trip', ttl_days: 1, role: 'pilot' });
  const v = demo.verify(issued.token);
  assert.equal(v.ok, true, JSON.stringify(v));
  assert.equal(v.tenant_id, 'pilot_round_trip');
});

test('demo token tampering rejected', () => {
  const issued = demo.issue({ tenant_id: 'pilot_tamper', ttl_days: 1, role: 'pilot' });
  const parts = issued.token.split('.');
  parts[3] = 'AAAA' + parts[3].slice(4);
  const v = demo.verify(parts.join('.'));
  assert.equal(v.ok, false);
});

test('demo token expiry rejected', () => {
  const issued = demo.issue({ tenant_id: 'pilot_expiry', ttl_days: -1, role: 'pilot' });
  const v = demo.verify(issued.token);
  assert.equal(v.ok, false);
  assert.equal(v.reason, 'expired');
});
