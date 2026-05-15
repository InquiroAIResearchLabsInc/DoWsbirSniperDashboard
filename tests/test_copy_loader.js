// Group — copy loader. Per-key files contain plain prose only; no
// LABEL: / TITLE: / BODY: / BANNER: / CTA: prefixes leak through to the
// returned value. Missing keys return a clear sentinel.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsip-copy-'));
process.env.DB_PATH = path.join(tmp, 'c.db');
process.env.RECEIPTS_PATH = path.join(tmp, 'c.jsonl');
process.env.MERKLE_ROOT_PATH = path.join(tmp, 'c.merkle');

const { getCopy, clearCache, listKeys } = require('../src/core/copy');

const FORBIDDEN_LABEL_RE = /^(TITLE|BODY|BANNER|CTA|LABEL|BUTTON LABEL|ADJACENT TEXT|CONFIRMATION):/m;

test('getCopy returns clean prose for empty_state_title (no TITLE: prefix)', () => {
  clearCache();
  const v = getCopy('empty_state_title');
  assert.ok(v.length > 0);
  assert.doesNotMatch(v, /<MISSING_COPY:/);
  assert.doesNotMatch(v, FORBIDDEN_LABEL_RE);
  assert.match(v, /PRIME/i);
});

test('getCopy returns clean prose for empty_state_body (no BODY: prefix)', () => {
  const v = getCopy('empty_state_body');
  assert.doesNotMatch(v, FORBIDDEN_LABEL_RE);
});

test('getCopy returns clean prose for sandbox_banner_text and sandbox_banner_cta', () => {
  assert.doesNotMatch(getCopy('sandbox_banner_text'), FORBIDDEN_LABEL_RE);
  assert.doesNotMatch(getCopy('sandbox_banner_cta'), FORBIDDEN_LABEL_RE);
});

test('getCopy returns clean prose for the dsip and disagreement atoms', () => {
  for (const k of ['dsip_button_label', 'dsip_button_subtext', 'disagreement_label', 'disagreement_confirmation']) {
    const v = getCopy(k);
    assert.doesNotMatch(v, FORBIDDEN_LABEL_RE, `${k} leaked a LABEL: prefix`);
    assert.ok(v.length > 0, `${k} returned empty`);
  }
});

test('getCopy returns <MISSING_COPY:...> sentinel for missing key', () => {
  const v = getCopy('definitely_not_a_real_key_xyz');
  assert.match(v, /^<MISSING_COPY:definitely_not_a_real_key_xyz>$/);
});

test('listKeys exposes the flattened atoms and not the deleted parent keys', () => {
  const keys = new Set(listKeys());
  // Deleted parent keys should be gone.
  for (const dead of ['empty_state', 'sandbox_banner', 'dsip_handoff_microcopy', 'disagreement_button']) {
    assert.ok(!keys.has(dead), `expected legacy key ${dead} to be removed`);
  }
  // New atoms should be present.
  for (const live of ['empty_state_title', 'empty_state_body', 'sandbox_banner_text', 'sandbox_banner_cta', 'dsip_button_label', 'dsip_button_subtext', 'disagreement_label', 'disagreement_confirmation']) {
    assert.ok(keys.has(live), `expected ${live} to exist`);
  }
});
