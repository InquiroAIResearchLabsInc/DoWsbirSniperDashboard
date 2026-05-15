// Group — diff feed. Verifies listDiffs joins the opportunity so the feed
// renders a human title + component/program/phase + deadline, not a raw id.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsip-diff-'));
process.env.DB_PATH = path.join(tmp, 'd.db');
process.env.RECEIPTS_PATH = path.join(tmp, 'd.jsonl');
process.env.MERKLE_ROOT_PATH = path.join(tmp, 'd.merkle');

const { computeDiffs, listDiffs } = require('../src/diff/engine');

function mkOpp(id, overrides = {}) {
  return {
    id,
    source: 'sbir_gov',
    source_url: 'https://www.dodsbirsttr.mil/topics-app/',
    title: `Topic ${id}`,
    description: 'd',
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

test('listDiffs renders human-readable rows: title, component, days, category', () => {
  const close = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
  computeDiffs('sbir_gov', [mkOpp('sbir_gov:DF-1', {
    title: 'Attestable Inference for DDIL',
    component: 'darpa',
    close_date: close,
    is_rolling: false,
  })]);
  const d = listDiffs(7).find(x => x.opportunity_id === 'sbir_gov:DF-1');
  assert.ok(d, 'diff row present for DF-1');
  assert.equal(d.title, 'Attestable Inference for DDIL');
  assert.equal(d.component, 'darpa');
  assert.equal(d.program, 'SBIR');
  assert.equal(d.diff_type, 'new');
  assert.equal(typeof d.days_remaining, 'number');
  assert.ok(d.days_remaining >= 9 && d.days_remaining <= 11, `days ~10, got ${d.days_remaining}`);
});
