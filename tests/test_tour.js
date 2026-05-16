// Group — guided tour. Phase 1 spotlight walk + Phase 2 hotspots, exercised
// through a small DOM shim. The tour is a pure UI layer: it writes no
// receipts, so verify_chain is unaffected; these tests cover the state
// machine, localStorage gating, step advancement, and hotspot lifecycle.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const COMPONENT = path.join(__dirname, '..', 'public', 'components', 'tour.js');

// --- DOM shim ---------------------------------------------------------------
function makeEl(tag) {
  const cls = new Set();
  const attrs = {};
  const listeners = {};
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    children: [],
    parentNode: null,
    style: {},
    dataset: {},
    textContent: '',
    _cls: cls,
    _attrs: attrs,
    _rect: { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 },
  };
  Object.defineProperty(el, 'id', {
    get() { return attrs.id || ''; },
    set(v) { attrs.id = v; },
  });
  Object.defineProperty(el, 'className', {
    get() { return Array.from(cls).join(' '); },
    set(v) { cls.clear(); String(v || '').split(/\s+/).forEach(c => { if (c) cls.add(c); }); },
  });
  Object.defineProperty(el, 'firstChild', { get() { return el.children[0] || null; } });
  el.classList = {
    add: c => cls.add(c),
    remove: c => cls.delete(c),
    contains: c => cls.has(c),
    toggle: (c, force) => {
      const want = force === undefined ? !cls.has(c) : !!force;
      if (want) cls.add(c); else cls.delete(c);
      return want;
    },
  };
  el.setAttribute = (k, v) => {
    attrs[k] = String(v);
    if (k.indexOf('data-') === 0) el.dataset[k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(v);
  };
  el.getAttribute = k => (k in attrs ? attrs[k] : null);
  el.hasAttribute = k => k in attrs;
  el.appendChild = child => { child.parentNode = el; el.children.push(child); return child; };
  el.removeChild = child => {
    const i = el.children.indexOf(child);
    if (i >= 0) { el.children.splice(i, 1); child.parentNode = null; }
    return child;
  };
  el.remove = () => { if (el.parentNode) el.parentNode.removeChild(el); };
  el.addEventListener = (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); };
  el.removeEventListener = (type, fn) => {
    const arr = listeners[type] || [];
    const i = arr.indexOf(fn);
    if (i >= 0) arr.splice(i, 1);
  };
  el.dispatchEvent = ev => {
    const type = typeof ev === 'string' ? ev : ev.type;
    const evt = typeof ev === 'string'
      ? { type, preventDefault() {}, stopPropagation() {} }
      : ev;
    (listeners[type] || []).slice().forEach(fn => fn(evt));
  };
  el.click = () => el.dispatchEvent('click');
  el.getBoundingClientRect = () => el._rect;
  return el;
}

// --- selector engine --------------------------------------------------------
function parseCompound(s) {
  const c = { tag: null, id: null, classes: [], attrs: [] };
  const re = /([#.]?[a-zA-Z][\w-]*)|(\[[^\]]+\])/g;
  let m;
  while ((m = re.exec(s))) {
    const tok = m[0];
    if (tok[0] === '#') c.id = tok.slice(1);
    else if (tok[0] === '.') c.classes.push(tok.slice(1));
    else if (tok[0] === '[') {
      const am = /\[([\w-]+)(?:=("?)([^\]]*?)\2)?\]/.exec(tok);
      if (am) c.attrs.push({ name: am[1], val: am[3] !== undefined ? am[3] : null });
    } else c.tag = tok.toLowerCase();
  }
  return c;
}
function matchCompound(el, c) {
  if (!el || !el.tagName) return false;
  if (c.tag && el.tagName.toLowerCase() !== c.tag) return false;
  if (c.id && el.id !== c.id) return false;
  for (const cl of c.classes) if (!el._cls.has(cl)) return false;
  for (const a of c.attrs) {
    const v = el.getAttribute(a.name);
    if (a.val === null) { if (v == null) return false; }
    else if (v !== a.val) return false;
  }
  return true;
}
function matchGroup(el, parts) {
  if (!matchCompound(el, parts[parts.length - 1])) return false;
  let i = parts.length - 2;
  let anc = el.parentNode;
  while (i >= 0 && anc) {
    if (matchCompound(anc, parts[i])) i--;
    anc = anc.parentNode;
  }
  return i < 0;
}
function compileSelector(sel) {
  return String(sel).split(',').map(g =>
    g.trim().split(/\s+/).filter(Boolean).map(parseCompound));
}
function walk(root, fn) {
  fn(root);
  for (const c of root.children) walk(c, fn);
}

function buildEnv() {
  const html = makeEl('html');
  const body = makeEl('body');
  html.appendChild(body);

  const document = {
    documentElement: html,
    body,
    createElement: makeEl,
    getElementById(id) {
      let found = null;
      walk(html, el => { if (!found && el.id === id) found = el; });
      return found;
    },
    querySelectorAll(sel) {
      const groups = compileSelector(sel);
      const out = [];
      walk(html, el => {
        if (el === html) return;
        if (groups.some(parts => matchGroup(el, parts))) out.push(el);
      });
      return out;
    },
    querySelector(sel) {
      return document.querySelectorAll(sel)[0] || null;
    },
    addEventListener() {},
  };

  const store = new Map();
  const localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
    clear: () => store.clear(),
  };
  let reloadCount = 0;
  const window = {
    localStorage,
    innerWidth: 1440,
    innerHeight: 900,
    scrollX: 0,
    scrollY: 0,
    addEventListener() {},
    removeEventListener() {},
    location: { reload: () => { reloadCount += 1; } },
  };

  // index.html structure subset the tour touches.
  const tabsBar = makeEl('div'); tabsBar.className = 'tabs';
  const tabNames = ['topics', 'art', 'patterns', 'admin'];
  const tabs = {};
  for (const name of tabNames) {
    const t = makeEl('div');
    t.className = 'tab' + (name === 'topics' ? ' active' : '');
    t.setAttribute('data-tab', name);
    tabsBar.appendChild(t);
    tabs[name] = t;
  }
  body.appendChild(tabsBar);

  const layout = makeEl('div'); layout.className = 'layout';
  body.appendChild(layout);

  function sidePanel(panelId, railId, headerId) {
    const panel = makeEl('div'); panel.className = 'panel side collapsed'; panel.id = panelId;
    const rail = makeEl('button'); rail.className = 'panel-rail'; rail.id = railId;
    rail._rect = { left: 0, top: 100, right: 32, bottom: 240, width: 32, height: 140 };
    const header = makeEl('div'); header.className = 'panel-header'; header.id = headerId;
    panel.appendChild(rail); panel.appendChild(header);
    layout.appendChild(panel);
    return panel;
  }
  sidePanel('left-panel', 'left-rail', 'left-panel-header');

  const center = makeEl('div'); center.className = 'panel center';
  center._rect = { left: 360, top: 96, right: 1080, bottom: 900, width: 720, height: 804 };
  const filterBar = makeEl('div'); filterBar.className = 'filter-bar';
  const filterComponent = makeEl('select'); filterComponent.id = 'filter-component';
  filterComponent._rect = { left: 470, top: 60, right: 590, bottom: 84, width: 120, height: 24 };
  filterBar.appendChild(filterComponent);
  center.appendChild(filterBar);
  const centerHeader = makeEl('div'); centerHeader.id = 'center-panel-header';
  center.appendChild(centerHeader);
  const centerBody = makeEl('div'); centerBody.id = 'center-panel-body';
  center.appendChild(centerBody);
  layout.appendChild(center);

  sidePanel('right-panel', 'right-rail', 'right-panel-header');

  const whyModal = makeEl('div'); whyModal.className = 'modal-overlay'; whyModal.id = 'why-modal';
  body.appendChild(whyModal);

  // Scored opportunity cards: first PRIME, rest EVALUATE.
  function addCards(n) {
    for (let i = 0; i < n; i++) {
      const card = makeEl('div');
      card.className = 'card opp ' + (i === 0 ? 'prime' : 'evaluate');
      const title = makeEl('div'); title.className = 'opp-title'; title.textContent = 'Topic ' + i;
      const why = makeEl('button'); why.className = 'btn'; why.setAttribute('data-action', 'why');
      card.appendChild(title); card.appendChild(why);
      centerBody.appendChild(card);
    }
  }
  addCards(3);

  return { window, document, localStorage, tabs, whyModal, reloads: () => reloadCount };
}

function load(env) {
  global.window = env.window;
  global.document = env.document;
  global.localStorage = env.localStorage;
  global.fetch = () => Promise.resolve({ ok: false, json: () => Promise.resolve(null) });
  delete require.cache[require.resolve(COMPONENT)];
  return require(COMPONENT);
}

// --- tests ------------------------------------------------------------------

test('initTour starts the tour when no tour state is stored', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const env = buildEnv();
  const tour = load(env);
  tour.initTour();
  const backdrop = env.document.querySelector('.tour-backdrop');
  const tip = env.document.querySelector('.tour-tooltip');
  assert.ok(backdrop, 'backdrop renders on a first visit');
  assert.ok(tip, 'step tooltip renders');
  assert.equal(tip.getAttribute('data-step'), '1', 'tour opens on step 1');
});

test('initTour does nothing when the tour is fully completed', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const env = buildEnv();
  env.localStorage.setItem('sentinel_tour_completed', 'true');
  env.localStorage.setItem('sentinel_tour_hotspots_dismissed', 'true');
  const tour = load(env);
  tour.initTour();
  assert.equal(env.document.querySelector('.tour-backdrop'), null, 'no backdrop');
  assert.equal(env.document.querySelector('.tour-hotspot'), null, 'no hotspots');
});

test('initTour recovers Phase 2 hotspots after a reload mid-explore', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const env = buildEnv();
  env.localStorage.setItem('sentinel_tour_completed', 'true');
  const tour = load(env);
  tour.initTour();
  assert.equal(env.document.querySelector('.tour-backdrop'), null, 'guided phase does not replay');
  assert.equal(env.document.querySelectorAll('.tour-hotspot').length, 3, 'hotspots restored');
});

test('skip() marks the tour complete and jumps to Phase 2 hotspots', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const env = buildEnv();
  const tour = load(env);
  tour.initTour();
  tour.skip();
  assert.equal(env.localStorage.getItem('sentinel_tour_completed'), 'true', 'tour marked complete');
  assert.equal(env.document.querySelector('.tour-backdrop'), null, 'backdrop removed');
  assert.equal(env.document.querySelectorAll('.tour-hotspot').length, 3, 'hotspots appear after skip');
});

test('clicking an opportunity title advances Phase 1 to step 2', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const env = buildEnv();
  const tour = load(env);
  tour.initTour();
  env.document.querySelectorAll('#center-panel-body .opp-title')[0].click();
  assert.equal(env.document.querySelector('.tour-tooltip').getAttribute('data-step'), '2');
});

test('clicking "Why this?" advances Phase 1 to step 3', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const env = buildEnv();
  const tour = load(env);
  tour.initTour();
  env.document.querySelectorAll('#center-panel-body .opp-title')[0].click();
  env.document.querySelectorAll('#center-panel-body [data-action="why"]')[0].click();
  assert.equal(env.document.querySelector('.tour-tooltip').getAttribute('data-step'), '3');
});

test('clicking the ART Match tab advances Phase 1 to step 4', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const env = buildEnv();
  const tour = load(env);
  tour.initTour();
  env.document.querySelectorAll('#center-panel-body .opp-title')[0].click();
  env.document.querySelectorAll('#center-panel-body [data-action="why"]')[0].click();
  env.tabs.art.click();
  assert.equal(env.document.querySelector('.tour-tooltip').getAttribute('data-step'), '4');
});

test('Phase 1 completes: Admin dwell shows the transition card and fades the backdrop', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const env = buildEnv();
  const tour = load(env);
  tour.initTour();
  env.document.querySelectorAll('#center-panel-body .opp-title')[0].click();
  env.document.querySelectorAll('#center-panel-body [data-action="why"]')[0].click();
  env.tabs.art.click();
  env.tabs.admin.click();

  t.mock.timers.tick(1500); // Admin dwell → endPhase1
  assert.ok(env.document.querySelector('.tour-transition'), 'transition card appears');
  assert.equal(env.localStorage.getItem('sentinel_tour_completed'), 'true', 'tour marked complete');

  t.mock.timers.tick(3000); // transition hold → backdrop fades
  const backdrop = env.document.querySelector('.tour-backdrop');
  assert.ok(backdrop && backdrop.classList.contains('tour-out'), 'backdrop is fading out');
});

test('Phase 2: three hotspots render then auto-dismiss after 45s', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const env = buildEnv();
  const tour = load(env);
  tour.startPhase2();
  assert.equal(env.document.querySelectorAll('.tour-hotspot').length, 3, 'all three hotspots render');

  t.mock.timers.tick(45000); // hotspot lifetime
  t.mock.timers.tick(1000);  // fade-out
  assert.equal(env.document.querySelector('.tour-hotspot'), null, 'hotspots auto-dismissed');
  assert.equal(env.localStorage.getItem('sentinel_tour_hotspots_dismissed'), 'true', 'dismissal recorded');
});

test('clicking a hotspot dismisses it permanently', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const env = buildEnv();
  const tour = load(env);
  tour.startPhase2();
  env.document.querySelector('.tour-hotspot').click();
  assert.equal(env.document.querySelectorAll('.tour-hotspot').length, 2, 'clicked hotspot removed');
});

test('"Take the tour again" clears tour state and reloads the page', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const env = buildEnv();
  env.localStorage.setItem('sentinel_tour_completed', 'true');
  env.localStorage.setItem('sentinel_tour_hotspots_dismissed', 'true');
  env.tabs.topics.classList.remove('active');
  env.tabs.admin.classList.add('active');
  const tour = load(env);
  tour.initTour();

  const link = env.document.querySelector('.tour-replay-link');
  assert.ok(link, 'replay link mounted in the center column');
  assert.ok(link.classList.contains('is-visible'), 'replay link visible on the Admin tab');

  link.click();
  assert.equal(env.localStorage.getItem('sentinel_tour_completed'), null, 'completed flag cleared');
  assert.equal(env.localStorage.getItem('sentinel_tour_hotspots_dismissed'), null, 'hotspot flag cleared');
  assert.equal(env.reloads(), 1, 'page reload requested');
});
