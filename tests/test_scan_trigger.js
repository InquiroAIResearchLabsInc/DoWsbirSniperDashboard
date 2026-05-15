// Group — on-demand scan. POST /api/scrape/trigger must spawn the scan as a
// child process and return immediately (non-blocking); GET /api/scrape/status
// must report the run while it is in flight and its result when it finishes.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsip-scan-'));
process.env.DB_PATH = path.join(tmp, 's.db');
process.env.RECEIPTS_PATH = path.join(tmp, 's.jsonl');
process.env.MERKLE_ROOT_PATH = path.join(tmp, 's.merkle');
process.env.NODE_ENV = 'test';
process.env.SCAN_SOURCE = 'fixture'; // offline scan — no live SBIR network call

const { getDb } = require('../src/db');
const { app } = require('../src/api/server');

const SANDBOX = { 'x-dsip-sandbox': '1' };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

test('scrape trigger is non-blocking and status tracks the run', async () => {
  getDb(); // create the schema before the child process opens the db
  const server = app.listen(0);
  try {
    const base = `http://127.0.0.1:${server.address().port}`;

    const t0 = Date.now();
    const tr = await fetch(`${base}/api/scrape/trigger`, { method: 'POST', headers: SANDBOX });
    const elapsed = Date.now() - t0;
    assert.equal(tr.status, 202, 'trigger accepted');
    const started = await tr.json();
    assert.equal(started.status, 'started');
    assert.ok(started.job_id, 'job_id returned');
    assert.ok(elapsed < 500, `trigger returned in ${elapsed}ms — under 500ms, non-blocking`);

    // The child process cannot have booted, run and exited yet — status must
    // still report the scan as running.
    const sr = await fetch(`${base}/api/scrape/status`, { headers: SANDBOX });
    assert.equal(sr.status, 200);
    const running = await sr.json();
    assert.equal(running.running, true, 'status reports the scan running');

    // Poll to completion — also verifies the last_result shape and leaves no
    // child process behind.
    let status = running;
    for (let i = 0; i < 60 && status.running; i++) {
      await sleep(200);
      status = await (await fetch(`${base}/api/scrape/status`, { headers: SANDBOX })).json();
    }
    assert.equal(status.running, false, 'scan finished');
    assert.ok(status.last_result, 'last_result recorded');
    assert.equal(typeof status.last_result.inserted, 'number');
    assert.equal(typeof status.last_result.updated, 'number');
    assert.equal(typeof status.last_result.errors, 'number');
  } finally {
    server.close();
  }
});
