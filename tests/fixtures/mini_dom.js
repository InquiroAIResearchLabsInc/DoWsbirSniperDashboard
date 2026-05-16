// mini_dom — a tiny DOM + localStorage shim, just enough to load and exercise
// public/components/panel_collapse.js inside node. It models the two
// collapsible side panels (Pipeline / Diff feed), each with its rail, rail
// badge, header, collapse control and body — the only nodes the component
// touches. Tests assign these onto `global` before requiring the component.
function buildDashboardEnv() {
  const byId = {};

  function makeEl(tag) {
    const classes = new Set();
    const listeners = {};
    const children = [];
    const el = {
      tagName: (tag || 'div').toUpperCase(),
      id: '',
      children,
      textContent: '',
      _classes: classes,
      classList: {
        contains: c => classes.has(c),
        add: c => classes.add(c),
        remove: c => classes.delete(c),
        toggle: (c, force) => {
          const want = force === undefined ? !classes.has(c) : !!force;
          if (want) classes.add(c); else classes.delete(c);
          return want;
        },
      },
      addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
      dispatchEvent: type => { (listeners[type] || []).forEach(fn => fn({ type })); },
      appendChild: child => { children.push(child); return child; },
      querySelector: sel => {
        const cls = sel.replace(/^\./, '');
        const walk = node => {
          for (const c of node.children) {
            if (c._classes.has(cls)) return c;
            const r = walk(c);
            if (r) return r;
          }
          return null;
        };
        return walk(el);
      },
    };
    el.click = () => el.dispatchEvent('click');
    return el;
  }

  function reg(id, el) { el.id = id; byId[id] = el; return el; }
  function withClasses(el) { for (let i = 1; i < arguments.length; i++) el._classes.add(arguments[i]); return el; }

  function sidePanel(panelId, railId, badgeId) {
    const panel = reg(panelId, withClasses(makeEl('div'), 'panel', 'side'));
    const rail = reg(railId, withClasses(makeEl('button'), 'panel-rail'));
    const badge = reg(badgeId, withClasses(makeEl('span'), 'rail-badge'));
    rail.appendChild(badge);
    const header = withClasses(makeEl('div'), 'panel-header');
    header.appendChild(withClasses(makeEl('button'), 'panel-collapse'));
    const body = withClasses(makeEl('div'), 'panel-body');
    panel.appendChild(rail);
    panel.appendChild(header);
    panel.appendChild(body);
    return panel;
  }

  sidePanel('left-panel', 'left-rail', 'pipeline-rail-badge');
  sidePanel('right-panel', 'right-rail', 'diff-rail-badge');

  const document = {
    readyState: 'complete',
    getElementById: id => byId[id] || null,
    addEventListener: () => {},
  };

  const store = new Map();
  const localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
    clear: () => store.clear(),
  };

  return { document, window: { localStorage }, localStorage, byId };
}

module.exports = { buildDashboardEnv };
