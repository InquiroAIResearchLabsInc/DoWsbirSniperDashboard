// Group — panel state persistence. The collapsed/expanded choice for the
// Pipeline and Diff feed panels survives a reload via localStorage. Default is
// collapsed; a stored 'true' (and only 'true') opens the panel on load.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { buildDashboardEnv } = require('./fixtures/mini_dom');

const COMPONENT = path.join(__dirname, '..', 'public', 'components', 'panel_collapse.js');

// Seed localStorage, then load the component — simulating a page reload with
// pre-existing state.
function loadWith(env) {
  global.window = env.window;
  global.document = env.document;
  delete require.cache[require.resolve(COMPONENT)];
  return require(COMPONENT);
}

test('sentinel_pipeline_open=true opens the pipeline on load', () => {
  const env = buildDashboardEnv();
  env.localStorage.setItem('sentinel_pipeline_open', 'true');
  loadWith(env);
  assert.equal(env.byId['left-panel'].classList.contains('collapsed'), false, 'pipeline starts expanded');
  assert.equal(env.byId['right-panel'].classList.contains('collapsed'), true, 'diff feed, with no stored state, stays collapsed');
});

test('sentinel_diff_open=true opens the diff feed on load', () => {
  const env = buildDashboardEnv();
  env.localStorage.setItem('sentinel_diff_open', 'true');
  loadWith(env);
  assert.equal(env.byId['right-panel'].classList.contains('collapsed'), false, 'diff feed starts expanded');
  assert.equal(env.byId['left-panel'].classList.contains('collapsed'), true, 'pipeline, with no stored state, stays collapsed');
});

test('a non-true stored value keeps the panel collapsed', () => {
  const env = buildDashboardEnv();
  env.localStorage.setItem('sentinel_pipeline_open', 'false');
  loadWith(env);
  assert.equal(env.byId['left-panel'].classList.contains('collapsed'), true, "'false' keeps it collapsed");
});

test('shouldExpand treats only the exact string true as expanded', () => {
  const env = buildDashboardEnv();
  const mod = loadWith(env);
  assert.equal(mod.shouldExpand('true'), true);
  assert.equal(mod.shouldExpand('false'), false);
  assert.equal(mod.shouldExpand(null), false);
  assert.equal(mod.shouldExpand(''), false);
  assert.equal(mod.shouldExpand('TRUE'), false, 'case-sensitive — only lowercase true');
});
