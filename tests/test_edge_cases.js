// Group 9 — edge cases. Component router coverage, copy loader placeholder
// behavior, rate-limit stub interaction, missing-doc halt check.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsip-edge-'));
process.env.DB_PATH = path.join(tmp, 'e.db');
process.env.RECEIPTS_PATH = path.join(tmp, 'e.jsonl');
process.env.MERKLE_ROOT_PATH = path.join(tmp, 'e.merkle');

const seed = require('../scripts/seed_load');
seed.load();

const { getCopy } = require('../src/core/copy');
const { route } = require('../src/ingest/component_router');

test('component router covers every seeded topic prefix without falling to unknown', () => {
  const cases = [
    { topic_code: 'A234-001', agency: 'DOD', sub_agency: 'Army' },
    { topic_code: 'SF234-D2', agency: 'DOD', sub_agency: 'Space Force' },
    { topic_code: 'DARPA-AIE-2025', agency: 'DARPA' },
    { topic_code: 'AF234-D2-AFWERX', agency: 'DOD', sub_agency: 'Air Force' },
  ];
  for (const c of cases) {
    const r = route(c);
    assert.ok(r && r !== 'unknown', `topic ${c.topic_code} routed to ${r} — expected a known component`);
  }
});

test('getCopy returns placeholder token unchanged when file body is a placeholder', () => {
  const v = getCopy('sandbox_banner_text');
  assert.ok(v && v.length > 0, 'expected non-empty value from copy loader');
  // Placeholder tokens of the form <PLACEHOLDER_*> must round-trip; the loader
  // must NOT collapse them to empty string.
  if (/<PLACEHOLDER_/.test(v)) {
    assert.match(v, /<PLACEHOLDER_[A-Z_]+>/);
  }
});

test('getCopy returns sentinel for missing keys (not empty string)', () => {
  const v = getCopy('this_key_does_not_exist_anywhere');
  assert.ok(v && v.length > 0, 'expected non-empty sentinel for missing key');
  assert.match(v, /<MISSING_COPY:/);
});

test('rate-limit stub returns 429 with Retry-After then 200 after threshold', async () => {
  const stub = require('./fixtures/rate_limit_stub');
  const srv = await stub.start({ fails_before_success: 2, retry_after_seconds: 1 });
  try {
    const r1 = await fetch(srv.url);
    assert.equal(r1.status, 429);
    assert.equal(r1.headers.get('retry-after'), '1');
    const r2 = await fetch(srv.url);
    assert.equal(r2.status, 429);
    const r3 = await fetch(srv.url);
    assert.equal(r3.status, 200);
    assert.equal(srv.hits(), 3);
  } finally {
    await srv.close();
  }
});

test('docs/inquiro-sniper/ presence check is human-readable (Phase 0 halt path)', () => {
  // The Phase 0 halt check is a *startup* gate, not a test failure. We just
  // verify the directory exists (or would emit a clear error if not).
  const p = path.join(__dirname, '..', 'docs', 'inquiro-sniper');
  if (!fs.existsSync(p)) {
    assert.fail(`docs/inquiro-sniper/ missing; the Phase 0 halt would fire with a non-cryptic message. Build dir before continuing.`);
  }
  assert.ok(true);
});

test('docs/copy/linkedin_series/ has 7 day files', () => {
  const dir = path.join(__dirname, '..', 'docs', 'copy', 'linkedin_series');
  assert.ok(fs.existsSync(dir), 'linkedin_series dir missing');
  const days = fs.readdirSync(dir).filter(f => /^day_\d_(mon|tue|wed|thu|fri|sat|sun)\.md$/.test(f));
  assert.equal(days.length, 7, `expected 7 day files, got ${days.length}: ${days.join(',')}`);
});
