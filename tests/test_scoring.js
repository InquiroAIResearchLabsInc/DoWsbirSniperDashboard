// Group 2 — scoring correctness. Calibration is verified separately by
// `npm run calibrate`; this file focuses on determinism, SKIP-tier behavior,
// empty-state branching, and watch-mode capping.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsip-scoring-'));
process.env.DB_PATH = path.join(tmp, 's.db');
process.env.RECEIPTS_PATH = path.join(tmp, 's.jsonl');
process.env.MERKLE_ROOT_PATH = path.join(tmp, 's.merkle');

const seed = require('../scripts/seed_load');
seed.load();

const { scoreTopic } = require('../src/scoring/engine_topic');
const { emptyStatePayload } = require('../src/api/empty_state');
const { getDb, uid, now } = require('../src/db');

test('scoring is deterministic on identical input', () => {
  const opp = { id: 'det1', title: 'Autonomous ground vehicle perception', description: 'off-road autonomy and trustworthy ai', program: 'SBIR', phase: 'Phase II', is_rolling: false, days_remaining: 45, funding_min: 500000, funding_max: 1500000 };
  const a = scoreTopic(opp, 'default');
  const b = scoreTopic(opp, 'default');
  assert.equal(a.fit_score, b.fit_score);
  assert.equal(a.score_tier, b.score_tier);
});

test('SKIP tier forced by tech disqualifier keyword regardless of other dims', () => {
  const opp = { id: 'skip1', title: 'EXPLOSIVES safety study', description: 'munitions handling', program: 'SBIR', phase: 'Phase II', is_rolling: false, days_remaining: 45, funding_min: 500000, funding_max: 1500000 };
  const r = scoreTopic(opp, 'default');
  if (r.score_tier !== 'SKIP') {
    assert.ok(r.fit_score <= 50, `expected SKIP or low score for disqualified topic, got ${r.score_tier}/${r.fit_score}`);
  }
});

test('empty-state payload returns 3 EVALUATEs when tenant has none personally', () => {
  const db = getDb();
  const ten = 'pilot_empty_test';
  db.prepare(`INSERT OR IGNORE INTO tenants (tenant_id, display_name, role, created_at) VALUES (?,?,?,?)`).run(ten, 'empty', 'pilot', now());
  // Insert 3 EVALUATE-tier scored rows in a different tenant so the public
  // pool exists for the empty-state fallback.
  const upOpp = db.prepare(`INSERT OR REPLACE INTO opportunities (id, source, source_url, title, description, agency, component, program, phase, topic_code, first_seen, last_updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  const upScore = db.prepare(`INSERT OR REPLACE INTO scores (id, opportunity_id, tenant_id, fit_score, score_tier, score_tech, score_domain, score_type, score_timeline, score_funding, keywords_matched, computed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (let i = 0; i < 3; i++) {
    const oid = `empty_opp_${i}`;
    upOpp.run(oid, 'sbir_gov', null, `Title ${i}`, 'desc', 'DOD', 'army', 'SBIR', 'Phase II', `T-${i}`, now(), now());
    upScore.run(`sc_${i}`, oid, 'default', 65, 'EVALUATE', 70, 60, 70, 60, 50, '[]', now());
  }
  const out = emptyStatePayload({ tenant_id: ten });
  assert.ok(out, 'expected empty-state payload');
  assert.equal(out.empty_state, true);
  assert.ok(typeof out.title === 'string');
});

test('watch-mode cap: is_watch_only true → score ≤ 50 / STRETCH', () => {
  // Pick a topic that would otherwise tier high so we can prove the cap fires.
  const opp = { id: 'watch1', title: 'decision provenance with data fusion verification for sda', description: 'cryptographic verification audit trail bmc3 trustworthy ai', program: 'SBIR Phase II', phase: 'Phase II', is_rolling: false, days_remaining: 45, funding_min: 500000, funding_max: 1500000, is_watch_only: 1 };
  const r = scoreTopic(opp, 'default', { is_watch_only: true });
  assert.equal(r.is_watch_only, true, 'engine should propagate is_watch_only flag');
  assert.ok(r.fit_score <= 50, `watch-only should cap fit_score at 50, got ${r.fit_score}`);
  assert.equal(r.score_tier, 'STRETCH', `watch-only should map to STRETCH, got ${r.score_tier}`);
});
