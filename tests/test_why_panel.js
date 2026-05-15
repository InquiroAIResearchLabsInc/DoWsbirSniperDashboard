const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsip-why-'));
process.env.DB_PATH = path.join(tmp, 'w.db');
process.env.RECEIPTS_PATH = path.join(tmp, 'w.jsonl');
process.env.MERKLE_ROOT_PATH = path.join(tmp, 'w.merkle');

const { buildTopicWhy, buildArtWhy } = require('../src/scoring/why_this');

test('buildTopicWhy returns 7 items including handoff and disagree', () => {
  const w = { tech_alignment: 0.4, domain_alignment: 0.25, submission_type: 0.15, timeline: 0.1, funding_efficiency: 0.1 };
  const out = buildTopicWhy({ fit_score: 80, score_tier: 'PRIME', score_tech: 90, score_domain: 80, score_type: 80, score_timeline: 70, score_funding: 60, keywords_matched: ['ai governance'], disqualified_by: null }, w, { source_url: 'https://www.sbir.gov/topics/x' });
  assert.equal(out.payload_type, 'topic');
  assert.equal(out.items.length, 7, JSON.stringify(out.items.map(i => i.label)));
  assert.ok(out.items.some(i => i.label.toLowerCase().includes('handoff')));
  assert.ok(out.items.some(i => i.label.toLowerCase().includes('disagree')));
});

const RENDERABLE_KINDS = ['score', 'bars', 'chips', 'entries', 'text', 'link', 'action'];

test('every buildTopicWhy item is a typed kind the panel can render — no raw JSON', () => {
  const w = { tech_alignment: 0.4, domain_alignment: 0.25, submission_type: 0.15, timeline: 0.1, funding_efficiency: 0.1 };
  const out = buildTopicWhy(
    { fit_score: 92, score_tier: 'PRIME', score_tech: 100, score_domain: 100, score_type: 80, score_timeline: 100, score_funding: 50, keywords_matched: ['data fusion', 'ai governance'], disqualified_by: null },
    w,
    { id: 'sbir_gov:T1', source_url: 'https://www.dodsbirsttr.mil/topics-app/' }
  );
  for (const it of out.items) {
    assert.ok(RENDERABLE_KINDS.includes(it.kind), `item "${it.label}" has unrenderable kind: ${it.kind}`);
  }
  const bars = out.items.find(i => i.kind === 'bars');
  assert.ok(bars && Array.isArray(bars.rows) && bars.rows.length === 5, 'five dimension bars');
  assert.equal(typeof bars.rows[0].score, 'number');
  assert.equal(typeof bars.rows[0].weight, 'number');
  const score = out.items.find(i => i.kind === 'score');
  assert.equal(score.score, 92);
  assert.equal(score.tier, 'PRIME');
});

test('every buildArtWhy item is a typed kind the panel can render — no raw JSON', () => {
  const w = { priority_alignment: 0.35, transition_history: 0.25, active_scouting: 0.2, tech_maturity_fit: 0.1, recency_boost: 0.1 };
  const match = {
    id: 'art_1',
    payload: { match_score: 80, match_band: 'Strong', sub_scores: { priority_alignment: 90, transition_history: 80, active_scouting: 75, tech_maturity_fit: 100, recency_boost: 90 } },
    evidence: {
      priority_alignment: { matches: [{ priority_name: 'X', tier: 'A', matched_keywords: ['kw'], score: 95 }] },
      transition_history: { count: 5, total_usd: 25000000, sample: [] },
      active_scouting: { notices: [], has_signal: false },
      capped_reason: null,
    },
  };
  const sponsor = { id: 's', name: 'Sponsor', component: 'army', public_url: 'https://example/', parent_command: 'AMC' };
  const out = buildArtWhy(match, sponsor, { topic_code: 'A1', tech_keywords: [] }, w);
  for (const it of out.items) {
    assert.ok(RENDERABLE_KINDS.includes(it.kind), `item "${it.label}" has unrenderable kind: ${it.kind}`);
  }
  const disagree = out.items.find(i => i.kind === 'action' && i.disagree);
  assert.equal(disagree.disagree.id, 'art_1');
});

test('buildArtWhy returns 7 items including sponsor contact and disagree', () => {
  const w = { priority_alignment: 0.35, transition_history: 0.25, active_scouting: 0.2, tech_maturity_fit: 0.1, recency_boost: 0.1 };
  const match = {
    payload: { match_score: 80, match_band: 'Strong', sub_scores: { priority_alignment: 90, transition_history: 80, active_scouting: 75, tech_maturity_fit: 100, recency_boost: 90 } },
    evidence: {
      priority_alignment: { matches: [{ priority_name: 'X', tier: 'A', matched_keywords: ['kw'], source_url: 'u', source_doc: 'd', score: 95 }] },
      transition_history: { count: 5, total_usd: 25000000, sample: [] },
      active_scouting: { notices: [], has_signal: false },
      capped_reason: null,
    },
  };
  const sponsor = { id: 's', name: 'Sponsor', component: 'army', public_url: 'https://example/', parent_command: 'AMC' };
  const out = buildArtWhy(match, sponsor, { topic_code: 'A1', tech_keywords: [] }, w);
  assert.equal(out.payload_type, 'art');
  assert.equal(out.items.length, 7);
  assert.ok(out.items.some(i => i.label.toLowerCase().includes('contact')));
  assert.ok(out.items.some(i => i.label.toLowerCase().includes('wrong')));
});
