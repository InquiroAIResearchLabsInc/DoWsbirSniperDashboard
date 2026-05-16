# Layout Diagnostic — Header Unification + Panel Collapse

**Generated:** 2026-05-16  T+0 of the header-unification / panel-collapse PR
**Branch:** `claude/header-unification-panel-collapse-gL4mh`
**Scope:** `public/index.html`, `public/styles.css` — UI only. No backend, no receipts.
**Doctrine:** CLAUDEME. §0 first-action: capture the current state before any source change.

---

## 1. Current header HTML structure

`public/index.html`, lines 10–22:

```html
<header>
  <h1>DSIP SENTINEL</h1>
  <div class="tagline" id="product-tagline">loading…</div>
  <div class="stats-bar">
    <div class="stat"><div class="stat-val amber" id="stat-primes">—</div><div class="stat-lbl">Primes</div></div>
    <div class="stat"><div class="stat-val" id="stat-evaluates">—</div><div class="stat-lbl">Evaluate</div></div>
    <div class="stat"><div class="stat-val red" id="stat-closing">—</div><div class="stat-lbl">Closing</div></div>
    <div class="stat"><div class="stat-val" id="stat-art">—</div><div class="stat-lbl">ART Strong</div></div>
    <div class="stat"><div class="stat-val" id="stat-pipeline">—</div><div class="stat-lbl">Pipeline</div></div>
  </div>
  <button id="digest-btn" class="refresh-btn ghost" type="button" hidden>Daily Brief</button>
  <button id="refresh-btn" class="refresh-btn" type="button" hidden>Scan</button>
</header>
```

Observations:

- The header is a single flex row. `<h1>` anchors hard left.
- `.tagline` is populated at runtime by `loadCopy()` in `public/app.js` from
  `/api/copy/product_tagline` (sourced from `docs/copy/product_tagline.md`).
- `.stats-bar` is pushed to the far right by `margin-left: auto`.
- The two buttons trail after the stats, also far right.
- Net effect: brand on the far left, everything else on the far right.
  Nothing is centered; the eye splits across the full header width.
- `#stat-primes` carries a hardcoded `amber` class — it is amber even at 0.

### Current header CSS

`public/styles.css`, lines 37–85:

```css
header {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  padding: 12px 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}
header h1 { font-size: 17px; font-weight: 800; letter-spacing: 0.18em; color: var(--bone); text-transform: uppercase; }
header .tagline { color: var(--muted); font-size: 13px; font-style: italic; }
.stats-bar { margin-left: auto; display: flex; gap: 22px; align-items: center; }
.stat { display: flex; flex-direction: column; align-items: center; }
.stat-val { font-size: 22px; font-weight: 800; color: var(--bone); }
.stat-val.amber { color: var(--amber); }
.stat-val.red { color: var(--red); }
.stat-val.closing-zero { color: rgba(226, 232, 240, 0.3); }
.stat-lbl { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }
```

Header height is implicit: `12px` top/bottom padding + tallest child.

---

## 2. Current panel layout + width definitions

`public/index.html`, lines 31–80 — three sibling `.panel` blocks inside `.layout`:

```html
<div class="layout">
  <div class="panel">            <!-- LEFT: pipeline -->
    <div class="panel-header" id="left-panel-header">Pipeline <span class="count" id="pipeline-count">0</span></div>
    <div class="panel-body scrollbar-thin" id="left-panel-body"></div>
  </div>
  <div class="panel">            <!-- CENTER: opportunities (+ filter-bar) -->
    <div class="filter-bar" id="filter-bar"> … </div>
    <div class="panel-header" id="center-panel-header"> … </div>
    <div class="panel-body scrollbar-thin" id="center-panel-body"></div>
  </div>
  <div class="panel">            <!-- RIGHT: diff feed -->
    <div class="panel-header" id="right-panel-header">Diff feed <span class="count" id="diff-count">—</span></div>
    <div class="panel-body scrollbar-thin" id="right-panel-body"></div>
  </div>
</div>
```

### Current panel CSS width definitions

`public/styles.css`, lines 87–104:

```css
.layout { flex: 1; display: grid; grid-template-columns: 320px 1fr 360px; min-height: 0; }
.panel { border-right: 1px solid var(--border); display: flex; flex-direction: column; min-height: 0; }
.panel:last-child { border-right: none; }
```

Mobile override, `public/styles.css`, lines 701–724 (`@media (max-width: 720px)`):

```css
.layout { display: flex; flex-direction: column; }
.panel { border-right: none; border-bottom: 1px solid var(--border); min-height: 0; }
.panel.m-collapsible.m-collapsed > .panel-body { display: none; }
```

Observations:

- Desktop layout is a fixed three-column CSS grid: **left 320px / center fluid /
  right 360px**. There is no width state — all three panels are always shown at
  full width simultaneously.
- The left (pipeline) and right (diff feed) panels compete for attention with
  the center opportunities feed on every load.
- A collapse mechanism already exists, but **only for mobile**: `mobile_nav.js`
  adds `m-collapsible` / `m-collapsed` to the side panels below 720px. Those
  CSS rules use the direct-child combinator `> .panel-header` / `> .panel-body`,
  so any new wrapper element between `.panel` and its header/body would break
  them — the desktop collapse must not introduce such a wrapper.
- There is no `localStorage`-backed panel state today.

---

## 3. Planned changes (no source touched in this commit)

| Area | Current | Target |
|---|---|---|
| Header | brand left, stats+buttons right | three zones: brand left / counters centered / buttons right |
| Tagline | rendered in app header via `loadCopy()` | removed from header (already on landing page) |
| Counter label | `font-size: 11px`, `letter-spacing: 0.08em` | `font-size: 9px`, `letter-spacing: 0.12em` |
| PRIMES colour | hardcoded `amber` (amber even at 0) | amber only when `> 0` |
| Header height | implicit (~46px) | fixed `56px` |
| Layout | `grid` 320 / 1fr / 360 | `flex`; side panels collapsible |
| Pipeline / Diff | always full width | start collapsed to a 32px rail; expand on demand |
| Panel state | none | `localStorage`: `sentinel_pipeline_open`, `sentinel_diff_open` |
| Empty-state banner | amber title + amber body, 2px amber border | faint amber tint bg, 3px amber border, amber title, bone body |

No receipt changes. `node scripts/verify_chain.js` must still pass.
