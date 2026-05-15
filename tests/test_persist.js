// Group — persist writer. Verifies upsertOpportunities is idempotent,
// returns correct counts, and emits opportunity_upserted per row.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsip-persist-'));
process.env.DB_PATH = path.join(tmp, 'p.db');
process.env.RECEIPTS_PATH = path.join(tmp, 'p.jsonl');
process.env.MERKLE_ROOT_PATH = path.join(tmp, 'p.merkle');

const seed = require('../scripts/seed_load');
seed.load();

const { upsertOpportunities } = require('../src/ingest/persist');
const { getDb, now } = require('../src/db');
const { readReceipts } = require('../src/core/receipt');

function mkOpp(id, overrides = {}) {
  return {
    id,
    source: 'sbir_gov',
    source_url: `https://example.test/${id}`,
    title: `Topic ${id}`,
    description: `desc ${id}`,
    agency: 'DOD',
    sub_agency: 'Army',
    component: 'army',
    program: 'SBIR',
    phase: 'Phase I',
    topic_code: id.split(':').pop(),
    naics_codes: [],
    keywords: [],
    posted_date: null,
    open_date: null,
    close_date: null,
    is_rolling: true,
    days_remaining: null,
    funding_min: null,
    funding_max: null,
    currency: 'USD',
    ...overrides,
  };
}

test('upsertOpportunities inserts new rows and reports counts', () => {
  const rows = [mkOpp('sbir_gov:T-001'), mkOpp('sbir_gov:T-002')];
  const out = upsertOpportunities(rows, 'admin');
  assert.equal(out.inserted, 2);
  assert.equal(out.updated, 0);
  assert.ok(out.after_count > out.before_count, 'count must rise on insert');
});

test('upsertOpportunities is idempotent — replay reports updates, not inserts', () => {
  const rows = [mkOpp('sbir_gov:T-001'), mkOpp('sbir_gov:T-002')];
  const out = upsertOpportunities(rows, 'admin');
  assert.equal(out.inserted, 0);
  assert.equal(out.updated, 2);
});

test('upsertOpportunities emits one opportunity_upserted receipt per row', () => {
  const rows = [mkOpp('sbir_gov:T-101', { component: 'navy' })];
  upsertOpportunities(rows, 'admin');
  const recent = readReceipts({ receipt_type: 'opportunity_upserted', limit: 10 });
  const match = recent.find(r => r.body && r.body.topic_code === 'T-101');
  assert.ok(match, 'expected an opportunity_upserted receipt for T-101');
  assert.equal(match.body.component, 'navy');
  assert.equal(match.body.tenant_scope, 'global');
  assert.ok(['insert', 'update'].includes(match.body.action));
});

test('upsertOpportunities run_id flows into every per-row receipt', () => {
  const rows = [mkOpp('sbir_gov:T-201'), mkOpp('sbir_gov:T-202')];
  const out = upsertOpportunities(rows, 'admin', 'run_test_fixed');
  assert.equal(out.run_id, 'run_test_fixed');
  const recent = readReceipts({ receipt_type: 'opportunity_upserted', limit: 50 });
  const tagged = recent.filter(r => r.body && r.body.run_id === 'run_test_fixed');
  assert.equal(tagged.length, 2);
});
