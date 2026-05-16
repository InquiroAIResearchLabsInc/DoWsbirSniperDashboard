# HEADER + PANEL DIAGNOSTIC
*Pre-change snapshot — claude/fix-panel-header-layout-X917c*

---

## Current header HTML (verbatim from `public/index.html`)

```html
<header>
  <h1>DSIP SENTINEL</h1>
  <div class="stats-bar">
    <div class="stat"><div class="stat-val" id="stat-primes">—</div><div class="stat-lbl">Primes</div></div>
    <div class="stat"><div class="stat-val" id="stat-evaluates">—</div><div class="stat-lbl">Evaluate</div></div>
    <div class="stat"><div class="stat-val" id="stat-closing">—</div><div class="stat-lbl">Closing</div></div>
    <div class="stat"><div class="stat-val" id="stat-art">—</div><div class="stat-lbl">ART Strong</div></div>
    <div class="stat"><div class="stat-val" id="stat-pipeline">—</div><div class="stat-lbl">Pipeline</div></div>
  </div>
  <div class="header-actions">
    <button id="digest-btn" class="refresh-btn ghost" type="button" hidden>Daily Brief</button>
    <button id="refresh-btn" class="refresh-btn" type="button" hidden>Scan</button>
  </div>
</header>
```

**Issues:**
- Three separate zones (logo left / counters centre / buttons right): eye splits across 56px band
- Counters stacked (number over label, `flex-direction: column`): `stat-val` is 22px, `stat-lbl` is 9px
- Vertical separator rules between counters create visual noise
- Scan button has no function-indicating icon
- "Daily Brief" label is non-obvious about function
- Header height 56px — spec target is 48px

---

## Current panel open/closed default logic (verbatim from `public/components/panel_collapse.js`)

```js
function shouldExpand(storedValue) {
  return storedValue === 'true';
}

function read(key) {
  try { return window.localStorage.getItem(key); } catch (e) { return null; }
}

function applyState(panel, open) {
  if (panel) panel.classList.toggle('collapsed', !open);
}

function initPanel(cfg) {
  const panel = document.getElementById(cfg.panelId);
  if (!panel) return;
  let open = shouldExpand(read(cfg.key));  // false when key absent → collapsed
  applyState(panel, open);
  ...
}
```

**localStorage keys:** `sentinel_pipeline_open`, `sentinel_diff_open`

**Default:** `false` (collapsed) when key absent — correct per spec.

**Issue:** The expand affordance is the `›` (rsaquo) arrow only — too subtle to discover.

---

## Current rail CSS

```css
@media (min-width: 721px) {
  .panel.side { flex-shrink: 0; overflow: hidden; transition: width 200ms ease; }
  #left-panel { width: 240px; }
  #right-panel { width: 360px; }
  .panel.side.collapsed { width: 32px; }          /* ← target: 40px */
  .panel.side.collapsed > .panel-rail { display: flex; }
}
.panel-rail {
  display: none;
  width: 32px;                                     /* ← target: 40px */
  ...
}
.rail-arrow { color: var(--bone); font-size: 13px; }
.rail-label { writing-mode: vertical-rl; font-size: 10px; ... }
.rail-badge { font-size: 10px; font-weight: 700; color: var(--bone); }
.rail-badge.alert { color: var(--amber); }
```

**Issues:** Rail 32px wide (spec: 40px). Arrow is `›` HTML entity (spec: `▶`/`◀`). No inner border.

---

## Current empty-state CSS

```css
.empty-banner {
  background: rgba(245, 158, 11, 0.08);   /* ← spec: 0.06 */
  border-left: 3px solid #F59E0B;          /* ✓ correct */
  ...
}
.empty-banner-title {
  color: #F59E0B;
  font-size: 12px;                         /* ← spec: 11px */
  ...
}
.empty-banner-body {
  color: rgba(226, 232, 240, 0.7);         /* ← spec: 0.65 */
  ...
}
```
