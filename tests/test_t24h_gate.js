const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsip-t24h-'));
process.env.DB_PATH = path.join(tmp, 'g.db');
process.env.RECEIPTS_PATH = path.join(tmp, 'g.jsonl');
process.env.MERKLE_ROOT_PATH = path.join(tmp, 'g.merkle');

const seed = require('../scripts/seed_load');
seed.load();

const { scoreTopic } = require('../src/scoring/engine_topic');
const { route, classifyByTopicCode } = require('../src/ingest/component_router');
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'seed', 'calibration_cases.json'), 'utf8')).topic_cases;

test('topic calibration: 8/8 cases pass', () => {
  let pass = 0;
  const failures = [];
  for (const c of cases) {
    const opp = { id: c.id, title: c.title, description: c.description, program: c.description, phase: c.description, is_rolling: false, days_remaining: 45, funding_min: 500000, funding_max: 1500000 };
    const r = scoreTopic(opp, 'default');
    const tierMatch = r.score_tier === c.expected_tier;
    const delta = Math.abs(r.fit_score - c.expected_score);
    const ok = tierMatch && delta <= 15;
    if (ok) pass++; else failures.push({ id: c.id, expected_tier: c.expected_tier, got_tier: r.score_tier, expected_score: c.expected_score, got_score: r.fit_score, delta });
  }
  assert.equal(pass, cases.length, `topic calibration ${pass}/${cases.length}; failures: ${JSON.stringify(failures)}`);
});

test('component router routes Space Force to its own component, not Air Force', () => {
  assert.equal(classifyByTopicCode('SF234-D2'), 'space_force');
  assert.equal(classifyByTopicCode('AF234-D2-AFWERX'), 'air_force');
  assert.equal(classifyByTopicCode('A234-001'), 'army');
  assert.equal(classifyByTopicCode('DARPA-AIE-2025'), 'darpa');
  assert.equal(classifyByTopicCode('CBD234-001'), 'cbd');
});

test('component router falls back to agency name', () => {
  assert.equal(route({ topic_code: null, agency: 'U.S. Space Force', sub_agency: '' }), 'space_force');
  assert.equal(route({ topic_code: null, agency: 'Air Force', sub_agency: '' }), 'air_force');
});
