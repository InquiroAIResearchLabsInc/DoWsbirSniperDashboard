// Group — panel localStorage persistence. A stored 'true' (and only 'true')
// opens the matching panel on load. Any other value (missing, 'false', junk)
// keeps the panel collapsed. Tests simulate a page reload by seeding
// localStorage before requiring the component.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { buildDashboardEnv } = require('./fixtures/mini_dom');

const COMPONENT = path.join(__dirname, '..', 'public', 'components', 'panel_collapse.js');

function loadWith(env) {
  global.window = env.window;
  global.document = env.document;
  delete require.cache[require.resolve(COMPONENT)];
  return require(COMPONENT);
}

test('sentinel_pipeline_open=true expands pipeline on load', () => {
  const env = buildDashboardEnv();
  env.localStorage.setItem('sentinel_pipeline_open', 'true');
  loadWith(env);
  assert.equal(env.byId['left-panel'].classList.contains('collapsed'), false,
    'pipeline starts expanded when key is true');
  assert.equal(env.byId['right-panel'].classList.contains('collapsed'), true,
    'diff feed stays collapsed — its key is absent');
});

test('sentinel_diff_open=true expands diff feed on load', () => {
  const env = buildDashboardEnv();
  env.localStorage.setItem('sentinel_diff_open', 'true');
  loadWith(env);
  assert.equal(env.byId['right-panel'].classList.contains('collapsed'), false,
    'diff feed starts expanded when key is true');
  assert.equal(env.byId['left-panel'].classList.contains('collapsed'), true,
    'pipeline stays collapsed — its key is absent');
});

test('both panels open when both keys are true', () => {
  const env = buildDashboardEnv();
  env.localStorage.setItem('sentinel_pipeline_open', 'true');
  env.localStorage.setItem('sentinel_diff_open', 'true');
  loadWith(env);
  assert.equal(env.byId['left-panel'].classList.contains('collapsed'), false, 'pipeline expanded');
  assert.equal(env.byId['right-panel'].classList.contains('collapsed'), false, 'diff feed expanded');
});

test('stored false keeps panels collapsed', () => {
  const env = buildDashboardEnv();
  env.localStorage.setItem('sentinel_pipeline_open', 'false');
  env.localStorage.setItem('sentinel_diff_open', 'false');
  loadWith(env);
  assert.equal(env.byId['left-panel'].classList.contains('collapsed'), true);
  assert.equal(env.byId['right-panel'].classList.contains('collapsed'), true);
});
