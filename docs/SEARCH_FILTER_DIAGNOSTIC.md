# Search + Filter Diagnostic — pre-implementation inventory

**Generated:** 2026-05-15  T+0 of PR #3 (search + filter)
**Branch:** `claude/dynamic-search-filter` (off `claude/rename-sniper-to-sentinel`)
**Scope:** every file that participates in filtering today, with line references and the deltas the build strategy implies. No source changes in this commit.

## Files in scope

| File | Lines | Role today |
|---|---|---|
| `public/components/filter_bar.js` | 1–15 | Wires three controls: component select, tier select, min_score range. Exposes `window.wireFilterBar(onChange)` and `window.getFilters()` returning `{component, tier, min_score}`. |
| `public/index.html` | 35–53 | Filter bar HTML inside the center panel: `#filter-component`, `#filter-tier`, `#filter-score`, `#filter-score-val`. Lives only on the Topics tab — the layout is shared but the bar is built into the template, so it shows on ART Match too. |
| `src/api/routes/opportunities.js` | 9–39 | `GET /` accepts `component`, `source`, `tier`, `min_score`. Returns up to 200 rows ordered by `fit_score DESC, close_date ASC`. Emits `opportunities_listed` receipt. Empty-state branches when no PRIME rows. |
| `src/api/routes/art_matches.js` | 9–15 | `GET /` accepts no filter params. Returns up to 200 rows for the tenant ordered by `computed_at DESC, match_score DESC`. No receipt emit. Auth-required. |
| `public/app.js` | 51–90, 92–130 | `renderTopics()` calls `window.getFilters()` and builds the URL. `renderArt()` does not call `getFilters()` and does not pass any params. Filter bar is wired in `DOMContentLoaded` (line 179). |
| `public/components/component_patterns_static.js` | 1–18 | Renders `component_patterns` rows. No filter UI. |
| `src/core/copy.js` | 9–24 | `getCopy(key)` is the path the strategy expects for the search placeholder. `docs/copy/search_placeholder.md` does not exist yet. |
| `tests/test_*.js` | — | No existing test exercises filter behavior beyond `engine_topic` math; need a new file. |

## Detailed line references

### Filter bar wiring (`public/components/filter_bar.js`)

```
1: window.wireFilterBar = function (onChange) {
2:   const score = document.getElementById('filter-score');
3:   const scoreVal = document.getElementById('filter-score-val');
4:   score.addEventListener('input', () => { scoreVal.textContent = score.value; });
5:   score.addEventListener('change', onChange);          // "release" semantics — fires on mouseup, not on every input
6:   document.getElementById('filter-component').addEventListener('change', onChange);
7:   document.getElementById('filter-tier').addEventListener('change', onChange);
8: };
9: window.getFilters = function () {
10:  return {
11:    component: document.getElementById('filter-component').value,
12:    tier: document.getElementById('filter-tier').value,
13:    min_score: document.getElementById('filter-score').value,
14:  };
15: };
```

`onChange` already fires on slider release (`change` event, not `input`) and on dropdown change. The strategy's "immediate on dropdown and slider release" matches today. **Need to add:** debounced text input handler; q in the returned object; the bar/Clear-link DOM creation.

### Filter bar HTML (`public/index.html` lines 35–53)

```
35:     <div class="filter-bar" id="filter-bar">
36:       <select id="filter-component">
37:         <option value="">All components</option>
38–46:     <!-- 8 component options: army, air_force, space_force, cbd, darpa, dmea, dtra, socom -->
46:       </select>
47:       <select id="filter-tier">
48:         <option value="">All tiers</option>
49:         <option value="PRIME">PRIME only</option>
50:         <option value="EVALUATE">EVALUATE</option>
51:       </select>
52:       <label>Min score <input type="range" id="filter-score" min="0" max="100" value="0"> <span id="filter-score-val">0</span></label>
53:     </div>
```

Issues to address in the build commit:
- Tier dropdown is missing **STRETCH** and **SKIP** — strategy specifies `?tier=<PRIME|EVALUATE|STRETCH|SKIP>`. Add both options.
- Need `<input type="search" id="filter-q">` placed left of `#filter-component` (per §1).
- Need `<a id="filter-clear">Clear</a>` placed inline after `#opp-count` (per §4 visual rules).

(The 5 missing DoW components — Navy, DLA, MDA, NGA, OSD — land in PR #1's deploy-fix branch, not here. When that PR merges, the dropdown picks up those options without further action from this PR.)

### Opportunities route (`src/api/routes/opportunities.js` lines 9–39)

```
 9: router.get('/', (req, res) => {
10:   const db = getDb();
11:   const tenant_id = req.tenant_id;
12:   const filters = req.query || {};
13:
14–17: SELECT o.*, s.* ... LEFT JOIN scores s ... WHERE 1=1
18:   const args = [tenant_id];
19:   if (filters.component)  { sql += ' AND o.component = ?';     args.push(filters.component); }
20:   if (filters.source)     { sql += ' AND o.source = ?';        args.push(filters.source); }
21:   if (filters.tier)       { sql += ' AND s.score_tier = ?';    args.push(filters.tier); }
22:   if (filters.min_score)  { sql += ' AND s.fit_score >= ?';    args.push(Number(filters.min_score)); }
23:   sql += ' ORDER BY s.fit_score DESC, o.close_date ASC LIMIT 200';
...
31:   emitReceipt('opportunities_listed', { tenant_id, returned: rows.length, filters });    // <-- §5 says read-only emits nothing
33:   const primes = rows.filter(r => r.score_tier === 'PRIME');
34:   if (primes.length === 0) {
35:     const fallback = rows.filter(r => r.score_tier === 'EVALUATE').slice(0, 3);
36:     return res.json({ ...emptyStatePayload({ tenant_id, fallback_opps: fallback }), opportunities: rows });
37:   }
38:   res.json({ opportunities: rows, empty_state: false });
```

Needed additions:
- **`?q=`** — case-insensitive text search across `o.title`, `o.description`, `o.topic_code`. SQLite has no portable case-insensitive `LIKE` for unicode; the working pattern is `LOWER(col) LIKE LOWER(?)` with `%term%` binding, or `col LIKE ? COLLATE NOCASE`. The latter is faster and built in to SQLite — use that.
- **`?limit=` / `?offset=`** — replace the hardcoded `LIMIT 200`. Default `limit=50`, cap at `200`. Ignore negatives.
- **Response shape extension** — add `total_returned` count alongside `opportunities` (the count is needed by the live "OPPORTUNITIES" header).
- **Drop the `opportunities_listed` receipt** — §5 requires zero receipts from read-only operations. The receipt is currently the only side-effect of GET; deletion is safe.

### ART matches route (`src/api/routes/art_matches.js` lines 9–15)

```
 9: router.get('/', requireAuth, (req, res) => {
10:   const db = getDb();
11:   const rows = db.prepare(`SELECT am.*, sc.name AS sponsor_name, sc.public_url AS sponsor_url, sc.component AS sponsor_component, sc.parent_command
12:                            FROM art_matches am LEFT JOIN sponsor_candidates sc ON sc.id = am.sponsor_candidate_id
13:                            WHERE am.tenant_id = ? ORDER BY am.computed_at DESC, am.match_score DESC LIMIT 200`).all(req.tenant_id);
14:   res.json({ matches: rows.map(r => ({ ...r, evidence: safeJson(r.evidence, {}) })) });
15: });
```

Filter columns this query has access to:
- `am.match_score` (REAL) → used by `?min_score=`
- `am.match_band` (TEXT, values `Strong|Promising|Weak`) → used by `?band=` (note: DB stores title-case, strategy spec uses uppercase `STRONG|PROMISING|WEAK` — diagnostic flagging this; the route should accept either case and normalize)
- `am.phase_ii_tech_id` → join to `phase_ii_techs.title` and `phase_ii_techs.originating_component` for `?q=` text + `?component=` filter
- `sc.name` → used by `?q=` text (sponsor name)

So `?q=` requires a second join to `phase_ii_techs` (already implicit through `am.phase_ii_tech_id`); SQL becomes:

```
SELECT am.*, sc.name AS sponsor_name, sc.public_url AS sponsor_url,
       sc.component AS sponsor_component, sc.parent_command,
       p2.title AS phase_ii_title, p2.originating_component AS phase_ii_component
FROM art_matches am
LEFT JOIN sponsor_candidates sc ON sc.id = am.sponsor_candidate_id
LEFT JOIN phase_ii_techs p2     ON p2.id = am.phase_ii_tech_id
WHERE am.tenant_id = ?
  [AND p2.originating_component = ?]
  [AND am.match_band            = ?]   -- normalized
  [AND am.match_score >=        ?]
  [AND (p2.title LIKE ? COLLATE NOCASE OR sc.name LIKE ? COLLATE NOCASE)]
ORDER BY am.computed_at DESC, am.match_score DESC
LIMIT ? OFFSET ?
```

Strategy spec text refers to the route as `/api/art_matches` (underscore). The existing mount is `/api/art-matches` (hyphen) and is already referenced from `public/app.js` (lines 95, 104, 111, etc.). Renaming the mount would be a breaking change with no benefit — keeping the hyphen mount and treating the strategy line as a typo. If the user disagrees we add the underscore alias as a one-line `app.use('/api/art_matches', require('./routes/art_matches'))` later.

### Frontend handlers (`public/app.js`)

```
 51: async function renderTopics() {
 52:   const f = window.getFilters();
 53:   const q = new URLSearchParams();
 54:   for (const k of Object.keys(f)) if (f[k]) q.set(k, f[k]);
 55:   const data = await api(`/api/opportunities?${q.toString()}`).catch(() => ({ opportunities: [] }));
 ...
 57:   document.getElementById('opp-count').textContent = opps.length;
 ...
 92: async function renderArt() {
 ...
 95:   const techs = await api('/api/art-matches/techs').catch(() => ({ techs: [] }));
 ...
111:   const matches = await api('/api/art-matches').catch(() => ({ matches: [] }));    // <-- no params today
112:   const forTech = (matches.matches || []).filter(m => m.phase_ii_tech_id === t.id).slice(0, 5);
```

Implementation deltas:
- `renderTopics` already wires through `getFilters()`; adding `q` to the returned object is enough — no caller change needed.
- `renderArt` needs to switch from "fetch all then filter client-side" to "pass filters to server." This means each tech's matches still get filtered to that tech's id client-side, but the server-side filters (`q`, `component`, `band`, `min_score`) apply across the whole result set first. Per the strategy the filter operates at the matches level, not per tech.
- The "OPPORTUNITIES" header live-update is already wired (`document.getElementById('opp-count').textContent = opps.length;`); only need to recolor amber when filters non-default.
- `wireFilterBar` is invoked once in `DOMContentLoaded`; need a second wireup pass when switching tabs so the same physical bar fires the right tab's render. Easier path: keep one `onChange` and dispatch on `state.tab`.

### Copy

- `docs/copy/search_placeholder.md` — does not exist. The build commit creates it with the same shape as `product_tagline.md` (heading + HTML comment + body).

### Tests

- No existing test exercises `/api/opportunities` or `/api/art-matches` filter behavior. New file `tests/test_search_filter.js` will be created (14 assertions: 7 per endpoint per §5).
- After the build commit, `npm run test:chain` (per §5) — must show the chain length unchanged by GETs, since read-only operations now emit no receipts.

## Open carve-outs

- ART route: keep mount as `/api/art-matches` (hyphen) — strategy text appears to be a typo; existing callers in `public/app.js` use the hyphen.
- Tier dropdown: add STRETCH and SKIP. SKIP is technically valid in the API (engine emits it on disqualifier hit), but pilot-facing the SKIP option is rarely useful. Adding it because the strategy enumerates it.
- DB column `match_band` values are title-case (`Strong|Promising|Weak`), not the uppercase `STRONG|PROMISING|WEAK` shown in the strategy. Route accepts either; comparator normalizes to title-case before the SQL bind.

## Cannot proceed past this commit until the user reads it and the diagnostic-only commit lands.
