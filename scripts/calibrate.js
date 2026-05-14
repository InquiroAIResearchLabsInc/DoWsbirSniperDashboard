#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const seed = require('./seed_load');
seed.load();

const { scoreTopic } = require('../src/scoring/engine_topic');
const { computeAllMatches } = require('../src/art/match_orchestrator');
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'seed', 'calibration_cases.json'), 'utf8'));

const verbose = !process.argv.includes('--quiet');

let topicPass = 0;
const topicResults = [];
for (const c of cases.topic_cases) {
  const opp = { id: c.id, title: c.title, description: c.description, program: c.description, phase: c.description, is_rolling: false, days_remaining: 45, funding_min: 500000, funding_max: 1500000 };
  const r = scoreTopic(opp, 'default');
  const tierMatch = r.score_tier === c.expected_tier;
  const delta = Math.abs(r.fit_score - c.expected_score);
  const ok = tierMatch && delta <= 15;
  if (ok) topicPass++;
  topicResults.push({ id: c.id, expected_tier: c.expected_tier, got_tier: r.score_tier, expected_score: c.expected_score, got_score: r.fit_score, ok });
  if (verbose) console.log(`${ok ? '[PASS]' : '[FAIL]'} ${c.id}: ${c.expected_tier}→${r.score_tier} (${c.expected_score}→${r.fit_score})`);
}

let artPass = 0;
const artResults = [];
const profile = { tech_keywords: [], private_match_secured: true, commercial_viability: true };
for (const c of cases.art_cases) {
  const tech = { ...c.phase_ii_tech, id: `cal:${c.id}:${c.phase_ii_tech.topic_code}` };
  const top = computeAllMatches({ tenant_id: 'default', profile, phase_ii_tech: tech, limit: 30 });
  const winner = top[0] || { payload: { sponsor_id: null, match_band: 'Weak', match_score: 0 } };
  let ok = true;
  if (c.expected_top_sponsor_id && winner.payload.sponsor_id !== c.expected_top_sponsor_id) ok = false;
  if (c.expected_band && winner.payload.match_band !== c.expected_band) ok = false;
  if (c.expected_score_min != null && !(winner.payload.match_score >= c.expected_score_min)) ok = false;
  if (c.expected_score_max != null && !(winner.payload.match_score <= c.expected_score_max)) ok = false;
  if (c.expected_promising_min_count != null) {
    const promising = top.filter(m => m.payload.match_band === 'Promising').length;
    if (!(promising >= c.expected_promising_min_count)) ok = false;
  }
  if (c.expected_no_strong_band) {
    const strong = top.filter(m => m.payload.match_band === 'Strong').length;
    if (strong !== 0) ok = false;
  }
  if (ok) artPass++;
  artResults.push({ id: c.id, ok, top_sponsor_id: winner.payload.sponsor_id, top_score: winner.payload.match_score, top_band: winner.payload.match_band });
  if (verbose) console.log(`${ok ? '[PASS]' : '[FAIL]'} ART ${c.id}: ${winner.payload.sponsor_id} (${winner.payload.match_band}, ${winner.payload.match_score})`);
}

const summary = {
  topic_total: cases.topic_cases.length, topic_pass: topicPass,
  art_total: cases.art_cases.length, art_pass: artPass,
};
console.log(JSON.stringify(summary, null, 2));
if (topicPass !== cases.topic_cases.length || artPass !== cases.art_cases.length) process.exit(1);
