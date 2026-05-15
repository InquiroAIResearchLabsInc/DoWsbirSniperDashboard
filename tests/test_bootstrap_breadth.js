// Group — bootstrap fixture breadth. The bundled bootstrap fixture
// (seed/opportunities_bootstrap.json) must seed a demo-credible spread:
// >= 25 topics across >= 5 of the 12 DoW components, so a deploy that
// cannot reach the live SBIR API still shows a populated, varied feed.
// Forces the fixture path via INITIAL_INGEST_SKIP_LIVE=1 for determinism.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsip-boot-breadth-'));
process.env.DB_PATH = path.join(tmp, 'bs.db');
process.env.RECEIPTS_PATH = path.join(tmp, 'bs.jsonl');
process.env.MERKLE_ROOT_PATH = path.join(tmp, 'bs.merkle');
process.env.INITIAL_INGEST_SKIP_LIVE = '1';

const seed = require('../scripts/seed_load');
seed.load();

const { loadBootstrap } = require('../scripts/seed_load');
const { getDb } = require('../src/db');

test('bootstrap fixture seeds >= 25 topics across >= 5 components on an empty DB', async () => {
  const db = getDb();
  assert.equal(db.prepare('SELECT COUNT(*) c FROM opportunities').get().c, 0,
    'pre-condition: opportunities table empty after seed.load()');

  const out = await loadBootstrap();
  assert.equal(out.skipped, false, 'should not skip on an empty table');
  assert.equal(out.source_used, 'fixture', 'with INITIAL_INGEST_SKIP_LIVE=1 the fixture path must run');

  const count = db.prepare('SELECT COUNT(*) c FROM opportunities').get().c;
  assert.ok(count >= 25, `expected >= 25 seeded topics, got ${count}`);

  const components = db.prepare(
    'SELECT DISTINCT component c FROM opportunities WHERE component IS NOT NULL'
  ).all().map(r => r.c);
  assert.ok(components.length >= 5,
    `expected >= 5 components covered, got ${components.length}: ${components.join(',')}`);

  const raw = db.prepare("SELECT COUNT(*) c FROM opportunities WHERE title LIKE 'sbir_gov:%'").get().c;
  assert.equal(raw, 0, 'no opportunity title should be a raw sbir_gov: id');
});

test('bootstrap is idempotent — a >= 20-row table is skipped', async () => {
  const out = await loadBootstrap();
  assert.equal(out.skipped, true, 'second run on a populated table must skip');
  assert.match(out.reason, /already populated/);
});
