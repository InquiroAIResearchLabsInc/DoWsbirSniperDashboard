// Group — scheduler boot. Spinning the server with NODE_ENV=production
// must call schedule() inside the listen callback and emit
// scheduler_started with jobs_registered + next_runs. NODE_ENV=test must
// suppress the call.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsip-sched-'));
process.env.DB_PATH = path.join(tmp, 'b.db');
process.env.RECEIPTS_PATH = path.join(tmp, 'b.jsonl');
process.env.MERKLE_ROOT_PATH = path.join(tmp, 'b.merkle');
process.env.PORT = '0';

const seed = require('../scripts/seed_load');
seed.load();

const { readReceipts } = require('../src/core/receipt');

test('NODE_ENV=production: scheduler_started receipt emits within 2s of listen', async () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  delete require.cache[require.resolve('../src/api/server')];
  const { start } = require('../src/api/server');
  const server = start();
  const baseRoots = readReceipts({ receipt_type: 'scheduler_started', limit: 50 }).length;
  const deadline = Date.now() + 2000;
  let count = baseRoots;
  while (Date.now() < deadline && count <= baseRoots) {
    await new Promise(r => setTimeout(r, 50));
    count = readReceipts({ receipt_type: 'scheduler_started', limit: 50 }).length;
  }
  await new Promise(r => server.close(r));
  process.env.NODE_ENV = prev;
  assert.ok(count > baseRoots, 'expected a new scheduler_started receipt within 2s');
  const r = readReceipts({ receipt_type: 'scheduler_started', limit: 1 })[0];
  assert.ok(Array.isArray(r.body.jobs_registered));
  assert.ok(r.body.jobs_registered.length >= 3);
  assert.ok(Array.isArray(r.body.next_runs));
  for (const j of r.body.next_runs) {
    assert.ok(j.name && j.expression && j.next_fire_utc, `next_run row malformed: ${JSON.stringify(j)}`);
  }
});

test('NODE_ENV=test: server starts but scheduler does NOT', async () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  delete require.cache[require.resolve('../src/api/server')];
  const { start } = require('../src/api/server');
  const before = readReceipts({ receipt_type: 'scheduler_started', limit: 100 }).length;
  const server = start();
  await new Promise(r => setTimeout(r, 200));
  const after = readReceipts({ receipt_type: 'scheduler_started', limit: 100 }).length;
  await new Promise(r => server.close(r));
  process.env.NODE_ENV = prev;
  assert.equal(after, before, 'scheduler must not fire when NODE_ENV=test');
});
