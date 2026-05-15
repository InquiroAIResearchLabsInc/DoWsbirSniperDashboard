// Group — colour compliance. DEMO_STEALTH_BOMBER doctrine: amber marks one
// signal per surface. On an opportunity card that signal is the score — and
// only the score. Keyword chips and the Dismiss action carry no amber fill.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

// Minimal DOM shim so the browser component renders in node.
global.window = {};
global.document = {
  createElement() {
    return {
      className: '', innerHTML: '', style: {}, title: '',
      querySelector() { return { addEventListener() {} }; },
      addEventListener() {},
    };
  },
};
require('../public/components/opportunity_card.js');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'public', 'styles.css'), 'utf8');
const AMBER = /#F59E0B/i;

// Pull the declaration block for an exact selector out of styles.css. Returns
// the first rule whose selector is exactly `selector` (not a longer selector
// it is merely a tail of, e.g. `.x.refresh-btn`).
function rule(selector) {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(esc + '\\s*\\{([^}]*)\\}', 'g');
  let m;
  while ((m = re.exec(CSS)) !== null) {
    const before = CSS[m.index - 1];
    if (before && /[\w.#:\-]/.test(before)) continue; // tail of a longer selector
    return m[1];
  }
  return null;
}

function card(tier, score) {
  return window.renderOpportunityCard({
    id: 'sbir_gov:T1', title: 'Edge fusion for kill web composability',
    component: 'air_force', program: 'SBIR', phase: 'Phase I',
    score_tier: tier, fit_score: score,
    keywords_matched: ['autonomy', 'data fusion'], days_remaining: 20,
  });
}

test('PRIME card: the score is amber and nothing else on the card is', () => {
  const scoreRule = rule('.score-num.prime');
  assert.ok(scoreRule, '.score-num.prime rule present');
  assert.match(scoreRule, AMBER, 'PRIME score number is amber');

  // Everything else a PRIME card can show must NOT be amber.
  for (const sel of ['.tier-badge.prime', '.card.opp.prime', '.deadline.warning',
                      '.deadline.ok', '.kw-tag', '.opp-title', '.score-num']) {
    const r = rule(sel);
    assert.ok(r != null, `${sel} rule present`);
    assert.equal(AMBER.test(r), false, `${sel} is not amber`);
  }

  // The rendered PRIME card carries the amber class on exactly one element.
  const c = card('PRIME', 92);
  const markup = c.className + ' ' + c.innerHTML;
  assert.equal(AMBER.test(markup), false, 'card markup uses classes, no inline amber');
  const scoreEls = markup.match(/class="score-num prime"/g) || [];
  assert.equal(scoreEls.length, 1, 'exactly one amber score element');
});

test('keyword chips and Dismiss have no amber fill', () => {
  const chip = rule('.kw-tag');
  assert.ok(chip);
  assert.equal(/background[^;]*(#F59E0B|--amber)/i.test(chip), false, 'chips: no amber background');

  const dismiss = rule('.card.opp .card-actions .btn.dismiss');
  assert.ok(dismiss, 'scoped dismiss rule present');
  assert.equal(/background[^;]*(#F59E0B|--amber)/i.test(dismiss), false, 'Dismiss: no amber background');
  assert.equal(AMBER.test(dismiss), false, 'Dismiss carries no amber at all');
});

test('EVALUATE card carries no amber', () => {
  const c = card('EVALUATE', 64);
  const markup = c.className + ' ' + c.innerHTML;
  assert.equal(AMBER.test(markup), false, 'no inline amber');
  assert.equal((markup.match(/score-num prime/g) || []).length, 0, 'no PRIME amber score class');
});

test('scan button is an amber outline, not an amber fill', () => {
  const r = rule('.refresh-btn');
  assert.ok(r, '.refresh-btn rule present');
  assert.match(r, AMBER, 'scan button uses amber');
  assert.match(r, /background:\s*transparent/i, 'scan button is an outline — no amber fill');
});
