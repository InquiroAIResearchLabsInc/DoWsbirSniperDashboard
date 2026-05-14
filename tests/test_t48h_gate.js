const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsip-t48h-'));
process.env.DB_PATH = path.join(tmp, '48.db');
process.env.RECEIPTS_PATH = path.join(tmp, '48.jsonl');
process.env.MERKLE_ROOT_PATH = path.join(tmp, '48.merkle');
process.env.MERKLE_BATCH_SIZE = '5';

const { emitReceipt, anchorBatch, verifyChain, getCurrentMerkleRoot } = require('../src/core/receipt');

test('receipt chain stays intact across many writes + anchors', () => {
  for (let i = 0; i < 12; i++) emitReceipt('t48_burst', { tenant_id: 'admin', i });
  anchorBatch();
  const v = verifyChain();
  assert.equal(v.ok, true, JSON.stringify(v));
  const root = getCurrentMerkleRoot();
  assert.match(root, /^[a-f0-9]{64}:/);
});

test('emit_receipt without tenant_id falls back to default', () => {
  const r = emitReceipt('t48_no_tenant', {});
  assert.equal(r.tenant_id, 'default');
});

test('emit_receipt rejects missing receipt_type', () => {
  assert.throws(() => emitReceipt(null, { tenant_id: 'admin' }));
});
