# TOUR_DIAGNOSTIC — guided tour target selectors

Pre-build diagnostic for the 4-step guided tour. No source changes in this
commit. This file confirms the DOM selectors the tour spotlights and wires its
advance triggers to are stable and unique against the current frontend.

Reference files: `public/index.html`, `public/components/opportunity_card.js`.

## The four Golden-Path targets

| # | Step | Spotlight target | Advance trigger | Selector source |
|---|------|------------------|-----------------|-----------------|
| 1 | Scored topic list | `.panel.center` | click `.opp-title` | index.html:46 / opportunity_card.js:17 |
| 2 | Why this? | first `.card.opp.prime` / `.card.opp.evaluate` | click `[data-action="why"]` | opportunity_card.js:8,25 |
| 3 | ART Match tab | `.tab[data-tab="art"]` | click `.tab[data-tab="art"]` | index.html:28 |
| 4 | Admin tab | `.tab[data-tab="admin"]` | click `.tab[data-tab="admin"]` | index.html:30 |

## Selector stability notes

- **`.panel.center`** — index.html:46, a single element carries both classes;
  unique. The cards live in `#center-panel-body` (unique id, index.html:88).
- **`.card.opp`** — opportunity_card.js:8 sets `class = "card opp <tier>"`, so
  the tier (`prime` / `evaluate` / `skip`) is a stable third class. The first
  actionable card is `#center-panel-body .card.opp.prime` (fallback
  `.card.opp.evaluate`).
- **`.opp-title`** — opportunity_card.js:17, one per card; unique within a card.
- **`[data-action="why"]`** — opportunity_card.js:25, the "Why this?" button;
  one per card; unique within a card.
- **`.tab[data-tab="art"]` / `.tab[data-tab="admin"]`** — index.html:28,30. The
  `data-tab` value is unique per tab; both selectors resolve to exactly one node.

## Phase 2 hotspot targets

| Hotspot | Primary selector | Mobile fallback |
|---------|------------------|-----------------|
| Filter component dropdown | `#filter-component` | `#filter-component` |
| Pipeline expand rail | `#left-rail` | `#left-panel-header` |
| Diff feed expand rail | `#right-rail` | `#right-panel-header` |

The desktop rails are CSS-hidden on `≤720px` (mobile_nav.js owns the panels
there), so each rail hotspot falls back to the panel header; a hotspot whose
target resolves to a zero-size box is skipped.

All four targets are stable and unique. No existing component is modified by
the tour — it layers nodes over the DOM and removes them when done.
