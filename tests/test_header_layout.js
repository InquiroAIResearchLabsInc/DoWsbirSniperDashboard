// Group — header layout. The header is one unified 48px band: brand left,
// inline counter strip immediately right of brand, actions right. These
// assertions read the shipped index.html / styles.css so a regression in
// the markup or the zone CSS fails the build.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const CSS = fs.readFileSync(path.join(__dirname, '..', 'public', 'styles.css'), 'utf8');
const APP = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

// The <header>…</header> block only.
const HEADER = (HTML.match(/<header>[\s\S]*?<\/header>/) || [''])[0];

test('tagline is gone from the app header', () => {
  assert.ok(HEADER, 'header block found');
  assert.equal(HEADER.includes('product-tagline'), false, 'no #product-tagline element');
  assert.equal(HEADER.includes('class="tagline"'), false, 'no .tagline element in header');
  assert.equal(APP.includes('loadCopy'), false, 'loadCopy() removed from app.js');
});

test('all five counter IDs exist in the header', () => {
  const ids = ['stat-primes', 'stat-evaluates', 'stat-closing', 'stat-art', 'stat-pipeline'];
  for (const id of ids) {
    assert.ok(HEADER.includes(`id="${id}"`), `counter #${id} present`);
  }
});

test('counter labels are inline uppercase (no flex-direction column on .stat)', () => {
  // The stat elements must be inline — spec: [NUMBER] [LABEL] on one line.
  const statRule = (CSS.match(/\.stat\s*\{([^}]*)\}/) || [])[1] || '';
  assert.equal(statRule.includes('flex-direction: column'), false,
    '.stat must not stack (no flex-direction: column)');
  // Confirm inline display is used
  assert.ok(statRule.includes('inline-flex') || statRule.includes('flex'),
    '.stat uses flex layout');
});

test('PRIMES counter is not hardcoded amber in the markup', () => {
  // app.js toggles the amber/primes-zero class by value; the markup starts neutral.
  assert.ok(/id="stat-primes"/.test(HEADER), 'stat-primes element present');
  assert.equal(/class="stat-val amber" id="stat-primes"/.test(HEADER), false,
    'PRIMES must not carry a hardcoded amber class');
});

test('SCAN button contains ⟳ icon and DAILY BRIEF label is absent', () => {
  assert.ok(HEADER.includes('id="refresh-btn"'), 'SCAN button present');
  assert.ok(HEADER.includes('⟳'), 'SCAN button contains ⟳ icon');
  assert.equal(HEADER.includes('Daily Brief'), false, 'DAILY BRIEF label removed from header');
  assert.equal(HEADER.includes('DAILY BRIEF'), false, 'no DAILY BRIEF variant present');
  // Brief button is present and renamed
  assert.ok(HEADER.includes('id="digest-btn"'), 'BRIEF button present');
  assert.ok(/id="digest-btn"[^>]*>BRIEF</.test(HEADER), 'digest-btn labelled BRIEF');
});

test('header is a 48px band; counter strip does not stretch', () => {
  const headerRule = (CSS.match(/\nheader\s*\{([^}]*)\}/) || [])[1] || '';
  assert.match(headerRule, /height:\s*48px/, 'header height is 48px');
  assert.match(headerRule, /display:\s*flex/, 'header is a flex band');

  const stats = (CSS.match(/\.stats-bar\s*\{([^}]*)\}/) || [])[1] || '';
  assert.match(stats, /flex:\s*0 0 auto/, 'counter strip does not stretch');

  const lbl = (CSS.match(/\.stat-lbl\s*\{([^}]*)\}/) || [])[1] || '';
  assert.match(lbl, /font-size:\s*10px/, 'counter label is 10px');
  assert.match(lbl, /letter-spacing:\s*0\.1em/, 'counter label letter-spacing is 0.1em');
});

test('rail width is 40px in collapsed state', () => {
  const collapsedRule = (CSS.match(/\.panel\.side\.collapsed\s*\{([^}]*)\}/) || [])[1] || '';
  assert.match(collapsedRule, /width:\s*40px/, 'collapsed rail width is 40px');
});
