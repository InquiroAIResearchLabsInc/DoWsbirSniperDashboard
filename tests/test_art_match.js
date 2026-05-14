const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsip-art-'));
process.env.DB_PATH = path.join(tmp, 'art.db');
process.env.RECEIPTS_PATH = path.join(tmp, 'art.jsonl');
process.env.MERKLE_ROOT_PATH = path.join(tmp, 'art.merkle');
process.env.SAM_USE_FIXTURE = 'true';

const seed = require('../scripts/seed_load');
seed.load();

const cases = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'seed', 'calibration_cases.json'), 'utf8')).art_cases;
const { computeAllMatches } = require('../src/art/match_orchestrator');

const profile = { tech_keywords: [], private_match_secured: true, commercial_viability: true };

for (const c of cases) {
  test(`ART case ${c.id}: ${c.name}`, () => {
    const tech = c.phase_ii_tech;
    tech.id = `${c.id}:${tech.topic_code}`;
    const top = computeAllMatches({ tenant_id: 'admin', profile, phase_ii_tech: tech, limit: 30 });
    const winner = top[0];
    if (c.expected_top_sponsor_id) {
      assert.equal(winner.payload.sponsor_id, c.expected_top_sponsor_id, `expected top sponsor ${c.expected_top_sponsor_id} got ${winner.payload.sponsor_id}`);
    }
    if (c.expected_band) {
      assert.equal(winner.payload.match_band, c.expected_band, `expected band ${c.expected_band} got ${winner.payload.match_band}`);
    }
    if (c.expected_score_min != null) assert.ok(winner.payload.match_score >= c.expected_score_min, `score ${winner.payload.match_score} < min ${c.expected_score_min}`);
    if (c.expected_score_max != null) assert.ok(winner.payload.match_score <= c.expected_score_max, `score ${winner.payload.match_score} > max ${c.expected_score_max}`);
    if (c.expected_promising_min_count != null) {
      const promising = top.filter(m => m.payload.match_band === 'Promising');
      assert.ok(promising.length >= c.expected_promising_min_count, `expected >= ${c.expected_promising_min_count} Promising, got ${promising.length}`);
    }
    if (c.expected_no_strong_band) {
      const strong = top.filter(m => m.payload.match_band === 'Strong');
      assert.equal(strong.length, 0, `expected no Strong band, got ${strong.length}`);
    }
  });
}
