// Group — bootstrap seed. First-deploy seed loads opportunities via the
// live SBIR scrape with fallback to the bundled fixture; replay on a
// populated DB skips and emits no bootstrap_completed receipt.
// Tests force the fallback path via INITIAL_INGEST_SKIP_LIVE=1 so they
// are deterministic and offline-safe.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsip-boot-'));
process.env.DB_PATH = path.join(tmp, 'bs.db');
process.env.RECEIPTS_PATH = path.join(tmp, 'bs.jsonl');
process.env.MERKLE_ROOT_PATH = path.join(tmp, 'bs.merkle');
process.env.INITIAL_INGEST_SKIP_LIVE = '1';

const seed = require('../scripts/seed_load');
seed.load();

const { loadBootstrap } = require('../scripts/seed_load');
const { getDb } = require('../src/db');
const { readReceipts } = require('../src/core/receipt');

test('loadBootstrap on empty opportunities table seeds rows and emits receipt', async () => {
  const db = getDb();
  const before = db.prepare('SELECT COUNT(*) c FROM opportunities').get().c;
  assert.equal(before, 0, 'pre-condition: opportunities table empty after seed.load()');

  const out = await loadBootstrap();
  assert.equal(out.skipped, false, 'should not skip on empty table');
  assert.equal(out.source_used, 'fixture', 'with INITIAL_INGEST_SKIP_LIVE=1, must use the fixture path');
  assert.ok(out.inserted >= 5, `expected >= 5 inserts from fixture, got ${out.inserted}`);

  const after = db.prepare('SELECT COUNT(*) c FROM opportunities').get().c;
  assert.ok(after >= 5, `expected >= 5 rows in DB, got ${after}`);

  const distinctComponents = db.prepare('SELECT DISTINCT component c FROM opportunities WHERE component IS NOT NULL').all().map(r => r.c);
  assert.ok(distinctComponents.length >= 3, `expected 3+ components from fixture, got ${distinctComponents.length}: ${distinctComponents.join(',')}`);

  const recent = readReceipts({ receipt_type: 'bootstrap_completed', limit: 5 });
  assert.ok(recent.length >= 1, 'expected a bootstrap_completed receipt');
  assert.ok(recent[0].body.rows_seeded >= 5);
  assert.equal(recent[0].body.source_used, 'fixture');
});

test('loadBootstrap on populated table skips and emits no bootstrap_completed receipt', async () => {
  const before = readReceipts({ receipt_type: 'bootstrap_completed', limit: 100 }).length;
  const out = await loadBootstrap();
  assert.equal(out.skipped, true);
  assert.match(out.reason, /already populated/);
  const after = readReceipts({ receipt_type: 'bootstrap_completed', limit: 100 }).length;
  assert.equal(after, before, 'no new bootstrap_completed receipt on skip');
});
