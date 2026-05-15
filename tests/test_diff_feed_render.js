// Group — diff feed render. The screenshot bug: the rendered feed showed raw
// opportunity_ids (`sbir_gov:...`). This drives the live API response through
// the actual render function and asserts no raw id can reach the HTML — the
// API and the render path are verified together, not just the API.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsip-diffrender-'));
process.env.DB_PATH = path.join(tmp, 'd.db');
process.env.RECEIPTS_PATH = path.join(tmp, 'd.jsonl');
process.env.MERKLE_ROOT_PATH = path.join(tmp, 'd.merkle');
process.env.NODE_ENV = 'test';

const { computeDiffs } = require('../src/diff/engine');
const { getDb, uid, now } = require('../src/db');
const { renderDiffFeedHTML } = require('../public/components/diff_feed.js');
const { app } = require('../src/api/server');

function mkOpp(id, title, component) {
  return {
    id, source: 'sbir_gov', source_url: 'https://www.dodsbirsttr.mil/topics-app/',
    title, description: 'd', agency: 'DOD', sub_agency: 'Army', component,
    program: 'SBIR', phase: 'Phase I', topic_code: id.split(':').pop(),
    naics_codes: [], keywords: [], posted_date: null, open_date: null,
    close_date: new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10),
    is_rolling: false, days_remaining: 12, funding_min: null, funding_max: null, currency: 'USD',
  };
}

test('GET /api/admin/diffs rendered through the feed shows no raw IDs', async () => {
  computeDiffs('sbir_gov', [
    mkOpp('sbir_gov:A111-001', 'Off-road autonomy for unmanned ground vehicles', 'army'),
    mkOpp('sbir_gov:DARPA-X1', 'Attestable inference for DDIL environments', 'darpa'),
  ]);
  // An orphan diff — opportunity_id with no opportunity row. listDiffs' INNER
  // JOIN must drop it so the render can never fall back to a raw id.
  getDb().prepare('INSERT INTO diffs (id,diff_date,source,diff_type,opportunity_id,field_changed,old_value,new_value,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(uid(), new Date().toISOString().slice(0, 10), 'sbir_gov', 'new', 'sbir_gov:ORPHAN-DEAD', null, null, null, now());

  const server = app.listen(0);
  try {
    const port = server.address().port;
    const r = await fetch(`http://127.0.0.1:${port}/api/admin/diffs?days=14`);
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.ok(Array.isArray(body.diffs), 'diffs array present');
    assert.ok(body.diffs.length >= 2, 'joined diffs returned');

    const html = renderDiffFeedHTML(body.diffs);
    assert.equal(html.includes('sbir_gov:'), false, 'no raw opportunity_id in rendered HTML');
    assert.equal(html.includes('ORPHAN-DEAD'), false, 'orphan diff dropped, never rendered');
    assert.ok(html.includes('Off-road autonomy for unmanned ground vehicles'), 'human title rendered');
  } finally {
    server.close();
  }
});

test('renderDiffFeedHTML never emits a raw id even for an unjoined row', () => {
  // Defence in depth: a row with no title/topic_code must still not render the
  // opportunity_id as text.
  const html = renderDiffFeedHTML([{ diff_type: 'new', opportunity_id: 'sbir_gov:RAW-1' }]);
  assert.equal(html.includes('sbir_gov:'), false, 'opportunity_id is a key, never display text');
  assert.ok(html.includes('(topic unavailable)'), 'neutral fallback label used');
});
