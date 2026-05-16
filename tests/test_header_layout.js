// Group — header layout. The header is one unified band: brand left, the
// counter band centred, the actions right. The tagline was removed from the
// app header entirely (it lives on the landing page). These assertions read
// the shipped index.html / styles.css so a regression in the markup or the
// zone CSS fails the build.
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

test('all five counter elements exist with the right labels', () => {
  const counters = [
    ['stat-primes', 'Primes'],
    ['stat-evaluates', 'Evaluate'],
    ['stat-closing', 'Closing'],
    ['stat-art', 'ART Strong'],
    ['stat-pipeline', 'Pipeline'],
  ];
  for (const [id, label] of counters) {
    assert.ok(HEADER.includes(`id="${id}"`), `counter #${id} present`);
    assert.ok(HEADER.includes(`>${label}</div>`), `counter label "${label}" present`);
  }
});

test('PRIMES counter is not hardcoded amber in the markup', () => {
  // app.js toggles the amber class by value; the markup must start neutral.
  assert.ok(/id="stat-primes">/.test(HEADER), 'stat-primes element present');
  assert.equal(/class="stat-val amber" id="stat-primes"/.test(HEADER), false,
    'PRIMES must not carry a hardcoded amber class');
});

test('Scan and Daily Brief buttons are present, right-anchored', () => {
  assert.ok(HEADER.includes('id="refresh-btn"'), 'Scan button present');
  assert.ok(/id="refresh-btn"[^>]*>Scan</.test(HEADER), 'Scan button labelled Scan');
  assert.ok(HEADER.includes('id="digest-btn"'), 'Daily Brief button present');
  assert.ok(HEADER.includes('class="header-actions"'), 'actions zone present');
});

test('header is a fixed 56px band and the counters are the centred zone', () => {
  const headerRule = (CSS.match(/\nheader\s*\{([^}]*)\}/) || [])[1] || '';
  assert.match(headerRule, /height:\s*56px/, 'header height is 56px');
  assert.match(headerRule, /display:\s*flex/, 'header is a flex band');

  const stats = (CSS.match(/\.stats-bar\s*\{([^}]*)\}/) || [])[1] || '';
  assert.match(stats, /flex:\s*0 0 auto/, 'counter band does not stretch');
  assert.match(stats, /gap:\s*32px/, 'counter gap is 32px');

  const lbl = (CSS.match(/\.stat-lbl\s*\{([^}]*)\}/) || [])[1] || '';
  assert.match(lbl, /font-size:\s*9px/, 'counter label is 9px');
  assert.match(lbl, /letter-spacing:\s*0\.12em/, 'counter label letter-spacing is 0.12em');
});
