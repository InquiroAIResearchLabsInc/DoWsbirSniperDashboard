// Group — stoprule ingest invariant. A scrape that produces zero row
// deltas (or an empty batch) must emit ingest_noop and log [STOPRULE].
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsip-stoprule-'));
process.env.DB_PATH = path.join(tmp, 's.db');
process.env.RECEIPTS_PATH = path.join(tmp, 's.jsonl');
process.env.MERKLE_ROOT_PATH = path.join(tmp, 's.merkle');

const seed = require('../scripts/seed_load');
seed.load();

const { upsertOpportunities, stoprule_ingest_invariant } = require('../src/ingest/persist');
const { readReceipts } = require('../src/core/receipt');

test('stoprule fires ingest_noop when scrape returns 0 deltas', () => {
  let errMsg = null;
  const origError = console.error;
  console.error = (msg) => { errMsg = String(msg); };
  try {
    upsertOpportunities([], 'admin', 'run_zero_delta');
  } finally {
    console.error = origError;
  }
  assert.ok(errMsg && /\[STOPRULE\]/.test(errMsg), `expected [STOPRULE] log, got: ${errMsg}`);
  const recent = readReceipts({ receipt_type: 'ingest_noop', limit: 5 });
  const match = recent.find(r => r.body && r.body.run_id === 'run_zero_delta');
  assert.ok(match, 'expected an ingest_noop receipt for run_zero_delta');
  assert.equal(match.body.before_count, match.body.after_count);
  assert.match(match.body.reason, /no rows changed/);
});

test('stoprule helper returns false on invariant violation, true on growth', () => {
  // Direct unit assertion of the helper — no DB needed.
  assert.equal(stoprule_ingest_invariant('rid', 10, 10), false);
  assert.equal(stoprule_ingest_invariant('rid', 10, 9), false);
  assert.equal(stoprule_ingest_invariant('rid', 10, 11), true);
});

test('stoprule does NOT fire when at least one row is inserted', () => {
  const opp = {
    id: 'sbir_gov:STOP-001', source: 'sbir_gov', source_url: null, title: 'x',
    description: '', agency: 'DOD', sub_agency: 'Army', component: 'army',
    program: 'SBIR', phase: 'I', topic_code: 'STOP-001',
    naics_codes: [], keywords: [], posted_date: null, open_date: null,
    close_date: null, is_rolling: true, days_remaining: null,
    funding_min: null, funding_max: null, currency: 'USD',
  };
  const before = readReceipts({ receipt_type: 'ingest_noop', limit: 100 }).length;
  upsertOpportunities([opp], 'admin', 'run_one_insert');
  const after = readReceipts({ receipt_type: 'ingest_noop', limit: 100 }).length;
  assert.equal(after, before, 'ingest_noop must not fire when rows are inserted');
});
