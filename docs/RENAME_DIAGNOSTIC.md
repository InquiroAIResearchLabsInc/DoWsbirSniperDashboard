# Rename Diagnostic — Sniper → Sentinel

**Generated:** 2026-05-15  T+0 of PR #2 (rename)
**Branch:** `claude/rename-sniper-to-sentinel`
**Scope:** every file containing `sniper` / `Sniper` / `SNIPER` outside the read-only carve-out, with line numbers and the planned action per the rule table.

## Carve-outs (NOT touched)

- `docs/inquiro-sniper/**` — vendored read-only personal Sniper reference. Filenames and contents stay literal.
- `node_modules/**`, `.git/**`, `data/**`, `package-lock.json`, `receipts.jsonl`, `merkle_root.txt`.
- The GitHub repo name `DoWsbirSniperDashboard` (out of scope per rules).
- Historical references to the original development branch name `claude/dsip-sniper-mvp-build-qatZz` in record-keeping docs (`MANIFEST.anchor`, `docs/PHASE_0_CONTEXT_LOADED.md`, `spec.md`) — that branch literally existed under that name; renaming the historical record would be wrong. The active dev branch is now `claude/rename-sniper-to-sentinel` (this branch).
- The phrase **"personal Sniper"** in `docs/Dsip sniper mvp build strategy v2.md`, `docs/PHASE_0_CONTEXT_LOADED.md`, `seed/calibration_cases.json`, `seed/default_weights_topic.json`, and `docs/ARCHITECTURE.md` — refers to the vendored Sniper in `docs/inquiro-sniper/`, whose name we are preserving.
- The regex literal `'#22c55e|sniper-bg.*#052e16|sniper-border.*#166534'` in `gates/gate_t48h.sh:23` — this guard exists specifically to catch leakage of the personal-Sniper green palette into our CSS. Pattern stays literal so it keeps catching the source it's meant to catch.

## Rule table (recap)

| Find | Replace | Domain |
|---|---|---|
| `SNIPER` | `PRIME` | scoring tier in code, DB strings, UI |
| `sniper` | `sentinel` | identifiers, route names, file names, paths |
| `Sniper` | `Sentinel` | display strings, prose (when referring to this product) |
| `DSIP Sniper` | `DSIP Sentinel` | product name |
| `dsip-sniper` | `dsip-sentinel` | npm name, hostnames, db file names |
| `dsip_sniper` | `dsip_sentinel` | DB tables/columns (none currently exist) |

## Inventory — 27 files, 93 occurrences

### Code: scoring tier (SNIPER → PRIME)

| File | Line | Current | Action |
|---|---|---|---|
| `src/scoring/weights.js` | 63 | `if (score >= 80) return 'SNIPER';` | `'SNIPER'` → `'PRIME'` |
| `src/api/routes/opportunities.js` | 33 | `const snipers = rows.filter(r => r.score_tier === 'SNIPER');` | `'SNIPER'` → `'PRIME'`; rename `snipers` → `primes` |
| `src/api/routes/opportunities.js` | 34 | `if (snipers.length === 0) {` | rename `snipers` → `primes` |
| `src/api/empty_state.js` | 6 | `title: getCopy('empty_state').split('\n')[0] \|\| 'No SNIPER tier topics right now',` | `'No SNIPER ...'` → `'No PRIME ...'` |
| `seed/calibration_cases.json` | 12,19,47 | `"expected_tier": "SNIPER"` (×3) | → `"PRIME"` |
| `tests/test_why_panel.js` | 16 | `score_tier: 'SNIPER'` | → `'PRIME'` |
| `public/app.js` | 26 | `await api('/api/opportunities?tier=SNIPER');` | → `?tier=PRIME` |
| `public/app.js` | 27 | `.filter(o => o.score_tier === 'SNIPER').length;` | → `'PRIME'` |
| `public/app.js` | 30 | `document.getElementById('stat-snipers').textContent = snipers;` | rename id `stat-snipers` → `stat-primes`; rename var `snipers` → `primes` |
| `public/index.html` | 14 | `id="stat-snipers"`, label `Snipers` | id → `stat-primes`, label → `Primes` |
| `public/index.html` | 49 | `<option value="SNIPER">SNIPER only</option>` | `value="PRIME"`, label `PRIME only` |
| `public/styles.css` | 111 | `.card.opp.sniper { border-left-color: var(--amber); }` | `.sniper` → `.prime` |
| `public/styles.css` | 124 | `.tier-badge.sniper { ... }` | `.sniper` → `.prime` |
| `public/styles.css` | 128 | `.score-num.sniper { color: var(--amber); }` | `.sniper` → `.prime` |
| `docs/copy/empty_state.md` | 3,5 | `SNIPER` (×2) in copy | → `PRIME` |

### Code: product/identifier (sniper → sentinel, Sniper → Sentinel)

| File | Line | Current | Action |
|---|---|---|---|
| `package.json` | 2 | `"name": "dsip-sniper"` | → `"dsip-sentinel"` |
| `package.json` | 4 | `"description": "DSIP Sniper · ART Edition — ..."` | → `DSIP Sentinel · ART Edition` |
| `render.yaml` | 3 | `name: dsip-sniper` | → `dsip-sentinel` |
| `render.yaml` | 19 | `value: /opt/render/project/src/data/dsip-sniper.db` | → `/.../dsip-sentinel.db` |
| `render.yaml` | 33 | `name: dsip-sniper-data` | → `dsip-sentinel-data` |
| `src/core/config.js` | 22 | `path.join(root, 'data', 'dsip-sniper.db')` | → `'dsip-sentinel.db'` |
| `src/api/server.js` | 71 | `` console.log(`DSIP Sniper · ART Edition ...`) `` | → `DSIP Sentinel · ART Edition` |
| `src/ingest/sbir_api.js` | 28 | `'User-Agent': 'DSIPSniper/0.2 (DoW SBIR topic discovery)'` | → `'DSIPSentinel/0.2 ...'` |
| `scripts/issue_demo_token.js` | 22 | usage example URL `https://dsip-sniper.example` | → `https://dsip-sentinel.example` |
| `gates/gate_t24h.sh` | 28 | `[ -f data/dsip-sniper.db ]` | → `data/dsip-sentinel.db` |
| `.env.example` | 1 | `# DSIP Sniper · ART Edition — environment variables` | → `# DSIP Sentinel · ART Edition` |
| `.env.example` | 9 | `DB_PATH=./data/dsip-sniper.db` | → `./data/dsip-sentinel.db` |
| `public/index.html` | 6 | `<title>DSIP SNIPER · ART EDITION</title>` | → `DSIP SENTINEL · ART EDITION` |
| `public/index.html` | 11 | `<h1>DSIP SNIPER</h1>` | → `<h1>DSIP SENTINEL</h1>` |
| `MANIFEST.anchor` | 2 | `"name": "dsip-sniper"` | → `"dsip-sentinel"` |

### Docs: product references (Sniper → Sentinel; "personal Sniper" preserved)

| File | Lines (this product) | Action |
|---|---|---|
| `README.md` | 1, 20, 57, 61 (only "Sniper reference"), 69 (branch ref kept) | "DSIP Sniper · ART Edition" → "DSIP Sentinel · ART Edition"; `cd dsip-sniper` → `cd dsip-sentinel`; doc filename ref updated; line 61 leave (refers to the personal Sniper folder); line 69 leave (historical branch name) |
| `docs/ARCHITECTURE.md` | 1, 5, 78 ("personal Sniper" — leave), 84 (`SNIPER` tier → `PRIME`) | rename product references; tier word → `PRIME` |
| `docs/DEMO_SCRIPT.md` | 19 | `SNIPER card` → `PRIME card` |
| `docs/Dsip sniper mvp build strategy v2.md` | 1 (`DSIP SNIPER`), 4, 30, 48 ("Bubba's personal Sniper" — leave), 69, 70 ("personal Sniper" — leave), 82, 133, 193, 215, 217, 253 (dir tree), 264 (db file name), 367 ("personal Sniper" — leave), 396, 397 (`SNIPER` tier), 398 (`SNIPER` tier), 400 (`SNIPER` tier), 535 (URL), 585 (product name) | product-name occurrences renamed; tier-word occurrences `SNIPER`→`PRIME`; `dsip-sniper` paths/URLs → `dsip-sentinel`; "personal Sniper" preserved |
| `docs/PHASE_0_CONTEXT_LOADED.md` | 3 (branch — leave), 4 (target product), 17–24 (paths into `docs/inquiro-sniper/` — leave; "personal Sniper" — leave), 40 ("personal Sniper" — leave), 46 (branch — leave), 49 (branch — leave), 54–60 (paths — leave), 78 ("personal Sniper" — leave) | only line 4 and any line that says "DSIP Sniper" referring to *this* product gets renamed |
| `docs/copy/readme_positioning.md` | 5 | `DSIP Sniper` → `DSIP Sentinel` |
| `spec.md` | 1, 3 (filename ref — update to renamed file), 5 (branch — leave), 64 (product-name row + UI placeholder ref) | rename product references |
| `seed/default_weights_topic.json` | 10 ("personal Sniper") | leave |
| `seed/calibration_cases.json` | 5 ("personal Sniper") | leave; only the three `expected_tier` strings get retired |

### File renames

| From | To | Reason |
|---|---|---|
| `docs/Dsip sniper mvp build strategy v2.md` | `docs/Dsip sentinel mvp build strategy v2.md` | filename rule (lowercase `sniper` → `sentinel`); inbound refs in `README.md:57` and `spec.md:3` are updated above |
| `docs/Inquiro_Sniper_v2.docx` | `docs/Inquiro_Sentinel_v2.docx` | filename rule (`Sniper` → `Sentinel`); binary content unchanged |

### Database / DB file

- The on-disk db file name is the only DB-side change: `dsip-sniper.db` → `dsip-sentinel.db`. The schema has no `dsip_sniper` table or column. No migration needed beyond the filename change in config and render.yaml.

## Verification plan after rename

1. `npm install` (no-op, package name change is local)
2. `rm -rf data/ && DB_PATH=$PWD/data/dsip-sentinel.db npm run db:migrate && npm run seed`
3. `npm run calibrate` → 12/12 (8 topic + 4 ART) — `PRIME` thresholds in `weights.js` and the calibration `expected_tier` must agree
4. `npm test` → 25/25
5. `bash gates/gate_t48h.sh` → PASS (the `_smoke.sh` invocation must still pass)
6. `node scripts/verify_chain.js` → `ok=true`

If calibration fails, the most likely cause is a stray `'SNIPER'` string left in `src/scoring/engine_topic.js` or `src/scoring/engine_art.js` — both currently call into `weights.js` for the tier label, but a literal comparison anywhere else would silently downgrade. The next look-place is the calibration cases themselves.
