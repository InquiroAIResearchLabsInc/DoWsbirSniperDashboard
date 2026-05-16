// Group — empty-state banner styling. The banner signals "warning, not
// critical": a barely-visible amber tint background + a 3px amber left
// border. No solid amber fill, no amber on the body text.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'public', 'styles.css'), 'utf8');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

test('empty-banner has amber left border and no solid amber background fill', () => {
  const rule = (CSS.match(/\.empty-banner\s*\{([^}]*)\}/) || [])[1] || '';
  assert.ok(rule, '.empty-banner rule found');

  // Must have the amber left border
  assert.ok(/border-left.*#F59E0B/.test(rule), 'amber left border present');

  // Background must be a translucent tint — never a solid #F59E0B
  const bg = (rule.match(/background:\s*([^;]+)/) || [])[1] || '';
  assert.equal(bg.includes('#F59E0B'), false,
    'background must not be solid amber #F59E0B — only left border is amber');
  assert.ok(bg.includes('rgba(245'), 'background is a translucent rgba amber tint');
});

test('empty-banner background opacity is at most 0.06 (not hot)', () => {
  const rule = (CSS.match(/\.empty-banner\s*\{([^}]*)\}/) || [])[1] || '';
  const bg = (rule.match(/background:\s*([^;]+)/) || [])[1] || '';
  // Extract the alpha value from rgba(245, 158, 11, X)
  const alpha = parseFloat((bg.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\s*\)/) || [])[1] || '1');
  assert.ok(alpha <= 0.06, `background opacity ${alpha} must be ≤ 0.06 — not hot amber`);
});

test('empty-banner title is amber; body text is muted bone, not amber', () => {
  const titleRule = (CSS.match(/\.empty-banner-title\s*\{([^}]*)\}/) || [])[1] || '';
  assert.ok(titleRule.includes('#F59E0B'), 'title is amber');

  const bodyRule = (CSS.match(/\.empty-banner-body\s*\{([^}]*)\}/) || [])[1] || '';
  assert.ok(bodyRule, '.empty-banner-body rule found');
  assert.equal(bodyRule.includes('#F59E0B'), false, 'body text must not be amber');
  assert.ok(bodyRule.includes('rgba(226'), 'body text is rgba bone');
});

test('empty-banner-title font-size is 11px (not hot 12px)', () => {
  const titleRule = (CSS.match(/\.empty-banner-title\s*\{([^}]*)\}/) || [])[1] || '';
  assert.match(titleRule, /font-size:\s*11px/, 'title font-size is 11px');
});
