const fs = require('fs');
const path = require('path');
const { dualHash, stableStringify, merkleRoot } = require('./hash');
const config = require('./config');
const { StopRule } = require('./stoprule');
const { validateTenantId, DEFAULT_TENANT } = require('./tenant');

let _lastHash = null;
let _writtenSinceAnchor = 0;
let _initialized = false;

function ensureInitialized() {
  if (_initialized) return;
  const dir = path.dirname(config.RECEIPTS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(config.RECEIPTS_PATH)) {
    const content = fs.readFileSync(config.RECEIPTS_PATH, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    if (lines.length > 0) {
      try { _lastHash = JSON.parse(lines[lines.length - 1]).receipt_hash || null; } catch { _lastHash = null; }
    }
  }
  _initialized = true;
}

function emitReceipt(receiptType, data = {}) {
  ensureInitialized();
  if (!receiptType || typeof receiptType !== 'string') {
    throw new StopRule('emit_receipt: receipt_type is required', { receiptType });
  }
  const tenant_id = data.tenant_id || DEFAULT_TENANT;
  validateTenantId(tenant_id);
  const ts = new Date().toISOString();
  const body = { ...data, tenant_id };
  const payload_hash = dualHash(stableStringify(body));
  const parent_hash = _lastHash;
  const receipt = {
    receipt_type: receiptType,
    ts,
    tenant_id,
    payload_hash,
    parent_hash,
    body,
  };
  receipt.receipt_hash = dualHash(stableStringify({
    receipt_type: receipt.receipt_type,
    ts: receipt.ts,
    tenant_id: receipt.tenant_id,
    payload_hash: receipt.payload_hash,
    parent_hash: receipt.parent_hash,
  }));
  fs.appendFileSync(config.RECEIPTS_PATH, JSON.stringify(receipt) + '\n');
  _lastHash = receipt.receipt_hash;
  _writtenSinceAnchor++;
  if (_writtenSinceAnchor >= config.MERKLE_BATCH_SIZE) {
    anchorBatch();
  }
  return receipt;
}

function anchorBatch() {
  ensureInitialized();
  if (!fs.existsSync(config.RECEIPTS_PATH)) return null;
  const lines = fs.readFileSync(config.RECEIPTS_PATH, 'utf8').split('\n').filter(Boolean);
  const tail = lines.slice(-config.MERKLE_BATCH_SIZE).map(l => JSON.parse(l));
  const root = merkleRoot(tail);
  const anchor = {
    receipt_type: 'anchor',
    ts: new Date().toISOString(),
    tenant_id: 'admin',
    merkle_root: root,
    hash_algos: ['SHA256', 'BLAKE3'],
    batch_size: tail.length,
    parent_hash: _lastHash,
  };
  anchor.receipt_hash = dualHash(stableStringify({
    receipt_type: anchor.receipt_type,
    ts: anchor.ts,
    merkle_root: anchor.merkle_root,
    parent_hash: anchor.parent_hash,
  }));
  fs.appendFileSync(config.RECEIPTS_PATH, JSON.stringify(anchor) + '\n');
  fs.writeFileSync(config.MERKLE_ROOT_PATH, root + '\n');
  _lastHash = anchor.receipt_hash;
  _writtenSinceAnchor = 0;
  return anchor;
}

function readReceipts({ tenant_id, receipt_type, limit = 100 } = {}) {
  ensureInitialized();
  if (!fs.existsSync(config.RECEIPTS_PATH)) return [];
  const lines = fs.readFileSync(config.RECEIPTS_PATH, 'utf8').split('\n').filter(Boolean);
  const out = [];
  for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
    try {
      const r = JSON.parse(lines[i]);
      if (tenant_id && r.tenant_id !== tenant_id) continue;
      if (receipt_type && r.receipt_type !== receipt_type) continue;
      out.push(r);
    } catch (_) { /* skip malformed */ }
  }
  return out;
}

function verifyChain() {
  ensureInitialized();
  if (!fs.existsSync(config.RECEIPTS_PATH)) return { ok: true, count: 0, broken_at: null };
  const lines = fs.readFileSync(config.RECEIPTS_PATH, 'utf8').split('\n').filter(Boolean);
  let prev = null;
  for (let i = 0; i < lines.length; i++) {
    let r;
    try { r = JSON.parse(lines[i]); } catch { return { ok: false, count: i, broken_at: i, reason: 'malformed_json' }; }
    if (prev && r.parent_hash !== prev.receipt_hash) {
      return { ok: false, count: i, broken_at: i, reason: 'parent_hash_mismatch', expected: prev.receipt_hash, got: r.parent_hash };
    }
    prev = r;
  }
  return { ok: true, count: lines.length, broken_at: null };
}

function getCurrentMerkleRoot() {
  ensureInitialized();
  try { return fs.readFileSync(config.MERKLE_ROOT_PATH, 'utf8').trim(); } catch { return null; }
}

module.exports = { emitReceipt, anchorBatch, readReceipts, verifyChain, getCurrentMerkleRoot };
