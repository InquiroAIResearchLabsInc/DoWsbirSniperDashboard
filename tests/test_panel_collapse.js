// Group — panel collapse. The Pipeline and Diff feed panels start collapsed
// (a 32px rail; CSS owns the width, the component owns the `collapsed` class).
// A rail click expands; the header collapse control re-collapses. This drives
// the shipped public/components/panel_collapse.js against a minimal DOM shim.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { buildDashboardEnv } = require('./fixtures/mini_dom');

const COMPONENT = path.join(__dirname, '..', 'public', 'components', 'panel_collapse.js');

// Load (or reload) the component against a fresh DOM env. The component is an
// IIFE that runs init() on require — clearing the cache re-runs it.
function load(env) {
  global.window = env.window;
  global.document = env.document;
  delete require.cache[require.resolve(COMPONENT)];
  return require(COMPONENT);
}

test('both side panels start collapsed when there is no stored state', () => {
  const env = buildDashboardEnv();
  load(env);
  assert.equal(env.byId['left-panel'].classList.contains('collapsed'), true, 'pipeline starts collapsed');
  assert.equal(env.byId['right-panel'].classList.contains('collapsed'), true, 'diff feed starts collapsed');
});

test('clicking a rail expands the panel (collapsed class removed)', () => {
  const env = buildDashboardEnv();
  load(env);
  assert.equal(env.byId['left-panel'].classList.contains('collapsed'), true);
  env.byId['left-rail'].click();
  assert.equal(env.byId['left-panel'].classList.contains('collapsed'), false, 'rail click expands');
});

test('the header collapse control re-collapses an open panel', () => {
  const env = buildDashboardEnv();
  load(env);
  env.byId['right-rail'].click();
  assert.equal(env.byId['right-panel'].classList.contains('collapsed'), false, 'opened by rail');
  env.byId['right-panel'].querySelector('.panel-collapse').click();
  assert.equal(env.byId['right-panel'].classList.contains('collapsed'), true, 'collapse control collapses');
});

test('toggling a panel persists the choice to localStorage', () => {
  const env = buildDashboardEnv();
  load(env);
  env.byId['left-rail'].click();
  assert.equal(env.localStorage.getItem('sentinel_pipeline_open'), 'true', 'expanded state stored');
  env.byId['left-panel'].querySelector('.panel-collapse').click();
  assert.equal(env.localStorage.getItem('sentinel_pipeline_open'), 'false', 'collapsed state stored');
});

test('setPanelRail writes the count and the amber alert flag onto the rail badge', () => {
  const env = buildDashboardEnv();
  load(env);
  global.window.setPanelRail('right', 5, true);
  assert.equal(env.byId['diff-rail-badge'].textContent, 5, 'badge shows the count');
  assert.equal(env.byId['diff-rail-badge'].classList.contains('alert'), true, 'badge amber when alerting');
  global.window.setPanelRail('right', 0, false);
  assert.equal(env.byId['diff-rail-badge'].textContent, 0, 'badge updates the count');
  assert.equal(env.byId['diff-rail-badge'].classList.contains('alert'), false, 'badge bone white when calm');
});
