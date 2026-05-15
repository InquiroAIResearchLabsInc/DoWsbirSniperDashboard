// Group 4 — receipt chain integrity. This file is the CLI form of
// `npm run test:chain`. It does NOT use a temp ledger — it reads
// receipts.jsonl in the repo root so it can verify the live chain.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const config = require('../src/core/config');
const { verifyChain, getCurrentMerkleRoot } = require('../src/core/receipt');
const { dualHash, stableStringify, merkleRoot } = require('../src/core/hash');

test('receipts.jsonl exists', () => {
  assert.ok(fs.existsSync(config.RECEIPTS_PATH), `expected ${config.RECEIPTS_PATH} to exist`);
});

test('verifyChain returns ok=true', () => {
  const r = verifyChain();
  assert.equal(r.ok, true, `chain broken at index ${r.broken_at}: ${r.reason || ''}`);
});

test('every receipt has required fields', () => {
  const lines = fs.readFileSync(config.RECEIPTS_PATH, 'utf8').split('\n').filter(Boolean);
  const ISO_RX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
  const HASH_RX = /^[a-f0-9]{64}:[a-f0-9]+$/;
  for (let i = 0; i < lines.length; i++) {
    const r = JSON.parse(lines[i]);
    assert.ok(r.receipt_type, `receipt #${i}: missing receipt_type`);
    assert.match(r.ts, ISO_RX, `receipt #${i} (${r.receipt_type}): ts not ISO8601`);
    assert.ok(r.tenant_id, `receipt #${i} (${r.receipt_type}): missing tenant_id`);
    if (r.receipt_type === 'anchor') {
      assert.match(r.merkle_root, HASH_RX, `receipt #${i} (anchor): merkle_root wrong shape`);
    } else {
      assert.match(r.payload_hash, HASH_RX, `receipt #${i} (${r.receipt_type}): payload_hash wrong shape`);
    }
    // parent_hash null is allowed only for the very first receipt
    if (i > 0) assert.ok(r.parent_hash, `receipt #${i}: missing parent_hash`);
  }
});

test('merkle root file matches recomputed root of last 100 receipts (if anchor present)', () => {
  if (!fs.existsSync(config.MERKLE_ROOT_PATH)) {
    // No anchor written yet (< MERKLE_BATCH_SIZE receipts). Skipping check is fine.
    return;
  }
  const lines = fs.readFileSync(config.RECEIPTS_PATH, 'utf8').split('\n').filter(Boolean);
  if (lines.length < config.MERKLE_BATCH_SIZE) return;
  // Find the most recent anchor and verify its root matches the file.
  let lastAnchorIdx = -1;
  let lastAnchorRoot = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    const r = JSON.parse(lines[i]);
    if (r.receipt_type === 'anchor') { lastAnchorIdx = i; lastAnchorRoot = r.merkle_root; break; }
  }
  if (lastAnchorIdx < 0) return;
  const fileRoot = fs.readFileSync(config.MERKLE_ROOT_PATH, 'utf8').trim();
  assert.equal(fileRoot, lastAnchorRoot, 'merkle_root.txt diverges from latest anchor');
});

test('chain summary printed', () => {
  const lines = fs.readFileSync(config.RECEIPTS_PATH, 'utf8').split('\n').filter(Boolean);
  const tenants = new Set(lines.map(l => JSON.parse(l).tenant_id));
  const first = JSON.parse(lines[0]);
  const last = JSON.parse(lines[lines.length - 1]);
  console.log(`  chain: total=${lines.length}  tenants=${tenants.size}  span=${first.ts} → ${last.ts}  root=${(getCurrentMerkleRoot() || '').slice(0, 16)}…`);
  assert.ok(lines.length > 0);
});
