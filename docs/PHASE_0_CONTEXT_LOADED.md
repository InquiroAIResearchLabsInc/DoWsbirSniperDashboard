# Phase 0 — Context Loaded

**Branch:** `claude/dsip-sniper-mvp-build-qatZz`
**Target:** DSIP Sniper · ART Edition (v0.2)
**Doctrine:** CLAUDEME v5.0 — Three Laws active.
**Gate:** Cannot proceed to §1 until this commit lands (per spec §0b).

This document is the §0b receipt: every required read enumerated by file:line, every v1→v2 fix from §0a internalized one line at a time. Nothing aspirational here. If a line is not citable, it is not in this doc.

---

## §1 — Required reads, with file:line citations

| Required by §0b | File | Lines that anchored the read |
|---|---|---|
| Three Laws + receipt schema + gates | `CLAUDEME.md` | §0 lines 16–24 (Three Laws); §4 lines 86–128 (`dual_hash`, `emit_receipt`, `StopRule`, `merkle`); §3 lines 56–80 (gate scripts); §7 lines 214–228 (anti-patterns); §11 lines 293–304 (security baseline) |
| Map of what exists in personal Sniper | `docs/inquiro-sniper/docs/AUDIT_REPORT.md` | §2 lines 19–37 (sources + verified problems); §3 lines 41–107 (architecture, 9-table schema, frontend layout); §4 lines 111–164 (5-dim engine, 8/8 calibration, weight-history audit); §6 lines 221–249 (outcome capture → calibration → ROI loop); §8 lines 275–284 (known gaps incl. SAM key block) |
| SBIR.gov scraper to reuse | `docs/inquiro-sniper/src/scrapers/sbir.js` | lines 4 (`BASE_URL` constant); 6 (`parseRetryAfterMs` for `Retry-After` header); 7–18 (`fetchPage` with 8-attempt 1.8× exponential backoff, cap 120s); 20–28 (`normalizeTopic` / `normalizeSolicitation` — id shape, close_date fallback chain); 29–36 (`scrapeAgency` paging + dedup); 37–42 (`scrape` cross-agency loop) |
| Scoring engine to adapt | `docs/inquiro-sniper/src/scorer.js` | lines 3–10 (144 scoring tokens across 8 buckets); 11 (`SUBMISSION_TYPE_SCORES`); 12 (`DEFAULT_WEIGHTS` — 40/25/15/10/10); 14–23 (`getCurrentWeights` loads latest snapshot from `weight_history`); 24–36 (`applyWeights` validates sum ≈ 1.0 ± 0.01, writes append-only row); 37 (`WEIGHTS` Proxy — runtime read-through); 38–80 (`scoreOpportunity` — disqualifier short-circuit, tier-A/B/C cap math, watch-mode hard cap at line 40); 82–86 (`buildResult` + divergence flag); 87–96 (8 calibration cases); 97–109 (`runCalibration`, ≤15-pt delta acceptance) |
| Schema patterns + append-only tables | `docs/inquiro-sniper/src/db/index.js` | lines 14–15 (WAL + FK pragmas); 22–28 (`snapshots`); 31–70 (`opportunities` — 38 cols, score breakdown stored); 78–88 (`diffs` append-only); 94–106 (`pipeline`); 109–141 (`outcomes` — frozen score snapshot at insert); 144–154 (`lessons` append-only); 157–170 (`weight_history` — append-only, `weights_snapshot` JSON); 173–178 (`digests`); 181–188 (`source_status`); 200–212 (initial weight-history seed); 216–222 (`uid`/`now` helpers); 224–279 (`upsertOpportunity` insert vs update branching); 281–312 (filter-driven SQL builder); 316–326 (`resurrectExpiredDismissals` idempotent UPDATE); 330–344 (volatile fields computed at read time) |
| Outcome / calibration loop to extend | `docs/inquiro-sniper/src/feedback.js` | lines 8–58 (`recordOutcome` — freezes score breakdown, computes `score_accuracy`, auto-runs calibration on threshold); 62–85 (`generateLesson` per terminal status); 88–145 (`runCalibrationReport` — win/loss avg per dimension, predictive flag on Δ > 10, keyword frequency); 147–159 (`generateRecommendations` weight + keyword suggestions, advisory only); 162–197 (`computeROI` per-source ranking, dollars/hour) |
| Diff engine to reuse | `docs/inquiro-sniper/src/diff.js` | lines 4 (TRACKED_FIELDS — 12 fields); 7–11 (load prev map by source); 15–18 (new-opp branch + emit `new` diff); 19–30 (changed-field loop, only when new value non-empty); 31–35 (closing_soon ≤14d and warning ≤7d via config); 37–42 (closed-set diff for ids missing from fresh) |
| 3-panel layout reference | `docs/inquiro-sniper/dashboard/index.html` | lines 8–17 (CSS variables — colors that v2 must REPLACE for stealth-bomber palette); 48 (`.main { grid-template-columns: 320px 1fr 340px }`); 64–94 (`.opp-card` + tier badge + score num — primitives to reskin); 96–110 (pipeline card); 112–127 (diff entry); 130–149 (modal pattern + score grid); 188–242 (the three panels — Pipeline left, Opportunities center w/ filter bar, Diff Feed right); 246–296 (pipeline-add and outcome-capture modal HTML — to be retained shape, palette swapped) |
| v2 build doc end-to-end | `docs/Dsip sniper mvp build strategy v2.md` | read in conversation context |

---

## §2 — v1→v2 deltas from §0a (one line per fix)

1. **Topic-only blind spot fixed.** New §3a ART Transition Match module — sponsor-matching is the post-Phase-II problem the director actually owns; we ship the lens for it.
2. **Component Pulse cut.** L1 capture retained; UI replaced by a single static read-only `component_patterns_static.js` panel — no animation, no demo-time failure surface.
3. **Magic link demoted for the pilot.** Pre-issued HMAC demo tokens (`src/auth/demo_token.js`) issued by `scripts/issue_demo_token.js`; the director clicks a URL and lands on a populated dashboard. Magic link plumbing is built but dormant for v0.1.
4. **Strategic Breakthrough Awards surfaced.** New `src/art/sba_eligibility.js` computes the §3 P.L. 119-83 flag from five inputs and emits `sba_eligibility_flag_emitted_receipt` with per-criterion evidence linkage.
5. **k-anonymity hard gate.** `src/learning/anonymizer.js` blocks any L1 emit when supporting set has <5 distinct tenants per (component × dimension); blocked emits write a `kanon_blocked_receipt` (proof the gate is real, not assumed).
6. **Component modernization priorities seeded.** `seed/component_priorities.json` hand-curated from DAF FY26 Posture Statement, Army modernization priorities, USSF mission areas, DARPA office areas; drives the 35% priority-alignment sub-score in ART matching.
7. **Demo script tightened to 5 minutes with single wow moment.** `docs/DEMO_SCRIPT.md` structures the ART Match score-reveal as the emotional climax — five sub-score bars filling staggered, then composite score counts up.
8. **L2 fully deferred to v0.3.** Receipt schema reserved; no admin-visible half-built version in MVP; director will believe architecture is possible without seeing it ship half-baked.
9. **Local-mirror rescue mode added.** `scripts/local_mirror.js` + `data/demo_snapshot.db` lets `npm run demo:local` serve identical UI on localhost if Render hiccups during the demo.
10. **Space Force routed as its own component.** `src/ingest/component_router.js` maps topic prefix `SF` → `space_force` and `AF` → `air_force`; USSF acquisition is organizationally distinct in 2026 and the director audience will read conflation as sloppy.
11. **Calibration breadth doubled-plus.** 12 reference cases in `seed/calibration_cases.json` — 8 inherited from personal Sniper (`scorer.js:87-96`) + 4 new ART cases (autonomous ground / space domain awareness / benign commercial SKIP / cross-component EVALUATE).

---

## §3 — Receipt for this commit

```json
{
  "receipt_type": "phase_0_context_loaded",
  "branch": "claude/dsip-sniper-mvp-build-qatZz",
  "spec_version": "v0.2",
  "claudeme_version": "5.0",
  "files_read": [
    "CLAUDEME.md",
    "docs/inquiro-sniper/docs/AUDIT_REPORT.md",
    "docs/inquiro-sniper/src/scrapers/sbir.js",
    "docs/inquiro-sniper/src/scorer.js",
    "docs/inquiro-sniper/src/db/index.js",
    "docs/inquiro-sniper/src/feedback.js",
    "docs/inquiro-sniper/src/diff.js",
    "docs/inquiro-sniper/dashboard/index.html"
  ],
  "v1_to_v2_fixes_acknowledged": 11,
  "next_step": "scaffold T+2h skeleton (core/hash, core/receipt, core/tenant, core/stoprule, Express boot, /health, demo_token round-trip)",
  "blockers": []
}
```

---

## §4 — What I will NOT do (anti-patterns hard-blocked from CLAUDEME §7)

- No `sha256()` alone → use `dual_hash`
- No silent `except: pass` → every catch raises a typed `StopRule`
- No `print(result)` → every result emits a receipt
- No file write without a receipt
- No receipt without `tenant_id`
- No prose strings inside `src/` or `public/` — every visible string traces to `docs/copy/` (spec §13a)
- No green in palette (spec §15) — `--sniper: #22c55e` from the personal Sniper does NOT cross over

The receipt is the territory. The ledger is the truth. The lesson is the memory.
