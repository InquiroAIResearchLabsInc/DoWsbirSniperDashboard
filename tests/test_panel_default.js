// Group — panel default state. On a fresh load with no localStorage the two
// side panels (Pipeline and Diff feed) must start collapsed so the centre
// Opportunities feed leads. CSS owns the rendered width; this test checks the
// collapsed class and the 40px width declared in the stylesheet.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { buildDashboardEnv } = require('./fixtures/mini_dom');

const COMPONENT = path.join(__dirname, '..', 'public', 'components', 'panel_collapse.js');
const CSS = fs.readFileSync(path.join(__dirname, '..', 'public', 'styles.css'), 'utf8');

function load(env) {
  global.window = env.window;
  global.document = env.document;
  delete require.cache[require.resolve(COMPONENT)];
  return require(COMPONENT);
}

test('both panels start collapsed on fresh load (no localStorage)', () => {
  const env = buildDashboardEnv();
  load(env);
  assert.equal(env.byId['left-panel'].classList.contains('collapsed'), true,
    'pipeline panel starts collapsed');
  assert.equal(env.byId['right-panel'].classList.contains('collapsed'), true,
    'diff feed panel starts collapsed');
});

test('collapsed rail width is 40px in the stylesheet', () => {
  const collapsedRule = (CSS.match(/\.panel\.side\.collapsed\s*\{([^}]*)\}/) || [])[1] || '';
  assert.match(collapsedRule, /width:\s*40px/, 'collapsed side panel CSS width is 40px');

  // Use line-anchored regex to match the standalone .panel-rail rule, not the child selector
  const railRule = (CSS.match(/^\.panel-rail\s*\{([^}]*)\}/m) || [])[1] || '';
  assert.match(railRule, /width:\s*40px/, 'panel-rail CSS width is 40px');
});

test('no localStorage state means no panel is open', () => {
  const env = buildDashboardEnv();
  // Confirm both keys are absent
  assert.equal(env.localStorage.getItem('sentinel_pipeline_open'), null);
  assert.equal(env.localStorage.getItem('sentinel_diff_open'), null);
  load(env);
  // Both should default collapsed
  assert.equal(env.byId['left-panel'].classList.contains('collapsed'), true);
  assert.equal(env.byId['right-panel'].classList.contains('collapsed'), true);
});
