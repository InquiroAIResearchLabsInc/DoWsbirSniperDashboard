# Architecture — DSIP Sentinel · ART Edition

A receipts-native lens for the **12-component Department of War SBIR/STTR
pipeline** (Army, Air Force, Space Force, CBD, DARPA, DLA, DMEA, DTRA, MDA,
NGA, OSD, SOCOM). Navy is out of scope — separate annual BAA, `spec.md` §16.2.

## System map

```
INGEST            sbir_api (live SBIR API, agency=DOD)  ·  sam_sources_sought
                  refresh (user-triggered live scrape)  ·  normalize
                  component_router (routes topics to the 12 components)
                  persist (upsert + ingest-invariant stoprule)

SCORING           engine_topic  ·  engine_art  ·  why_this  ·  weights
                  (weights are per-tenant, audited in weight_history)

ART MODULE        tech_extractor · priority_matcher · transition_history
                  scouting_signals · sba_eligibility · match_orchestrator

LEARNING          individual (L0) — outcomes → lessons → calibration → ROI;
                                     Apply calibration re-weights + rescores
                  anonymizer (k≥5 gate)  ·  component_aggregator (L1)

DIGEST            digest — per-tenant daily summary (new / closing / pipeline)

CORE              hash · receipt · tenant · stoprule · copy

STORAGE (SQLite)  tenants · profiles · opportunities · scores · pipeline
                  dismissals · outcomes · lessons · weight_history · digests
                  phase_ii_techs · sponsor_candidates · art_matches
                  sponsor_pipeline · sba_eligibility · component_patterns
                  diffs · source_status · snapshots

LEDGER (JSONL)    parent_hash chain · Merkle root every MERKLE_BATCH_SIZE

API (Express)     opportunities (+dismiss) · pipeline · outcomes (+calibration
                  /apply) · digest · why · art-matches · sponsor-pipeline
                  · sba-eligibility · auth · profile · admin (+scrape) · receipts
                  · copy

AUTH (HMAC)       pre-issued demo tokens · public /demo sandbox · magic_link
                  (built, dormant in v0.1)

FRONTEND          vanilla JS single-page app — tabs: Topics · ART Match ·
                  Component Patterns · Admin. Header: Refresh + Digest.
                  Modals: Why · Add-to-Pipeline · Record-Outcome · Learnings
                  · Digest. DEMO_STEALTH_BOMBER palette — black/bone/amber,
                  no green.
```

## The opportunity loop (ported from personal Sniper, DoW-scoped)

```
Topics ──Add to Pipeline──> Pipeline ──Record Outcome──> Lessons
   ▲                                                        │
   └────── Apply calibration (re-weight + rescore) ◄── Calibration ◄┘
```

Every step emits a receipt. The Learnings view shows calibration (win/loss by
score dimension), return-on-effort, and lessons; **Apply calibration** derives
new topic weights from the tenant's own win/loss history and rescores the board.

## Data sources — real data

Topics come from the **live SBIR.gov API** (`agency=DOD`). Three landing paths:

1. **Refresh button** — `POST /api/admin/scrape`, an in-process live scrape.
2. **Build-time** — `npm run ingest:initial` on deploy.
3. **Committed snapshot** — `npm run snapshot:sbir` captures the live feed from
   any machine that can reach the API (gov APIs IP-block some cloud hosts);
   commit `seed/sbir_snapshot.json` and the deploy serves it. The bundled
   fixture is a last-resort fallback only and its topics are purged once real
   data is present. `db:migrate` backfills any stale `source_url` so
   "Open in DSIP" never resolves to a dead link.

## Receipts — the audit chain

Every state change emits a receipt (incomplete list — full set in `src/`):

| Receipt type | Where |
|---|---|
| `db_migrate_complete` / `source_url_backfill` | `src/db/migrate.js` |
| `seed_loaded` / `sandbox_activity_seeded` | `scripts/seed_load.js`, `src/learning/individual.js` |
| `weight_history_seeded` / `weights_applied` | `src/scoring/weights.js` |
| `topic_score_computed` | `src/scoring/engine_topic.js` |
| `art_match_computed` / `art_match_disagreement` | `src/art/match_orchestrator.js` |
| `sba_eligibility_flag_emitted` | `src/art/sba_eligibility.js` |
| `kanon_blocked` / `component_pattern_emitted` | `src/learning/` |
| `pipeline_added` / `pipeline_updated` | `src/api/routes/pipeline.js` |
| `outcome_recorded` | `src/learning/individual.js` |
| `calibration_report_computed` / `calibration_applied` | `src/learning/individual.js` |
| `opportunity_dismissed` / `opportunity_undismissed` | `src/api/routes/opportunities.js` |
| `digest_generated` | `src/digest/digest.js` |
| `manual_refresh` / `manual_refresh_error` | `src/ingest/refresh.js` |
| `ingest` / `fixture_opps_purged` / `ingest_error` | ingest layer |
| `demo_token_issued` / `sandbox_session_start` | `src/auth/`, `src/api/server.js` |
| `server_boot` / `server_error` / `anchor` | `src/api/server.js`, `src/core/receipt.js` |

Every receipt has: `receipt_type, ts, tenant_id, payload_hash (sha256:blake3),
parent_hash (chain), receipt_hash (this row's own hash), body`.

## The three tiers of learning

- **L0 — individual.** Active, fully wired. Per-tenant outcome capture →
  lessons → calibration → **Apply calibration** re-weights the scorer and
  rescores. Mirror of the personal Sniper feedback loop.
- **L1 — component.** Capture-only in v0.1. `component_aggregator` runs nightly,
  computes per-(component × dimension) win/loss averages, writes to
  `component_patterns`. **k ≥ 5 distinct tenants required** before any pattern
  emits — below threshold → `kanon_blocked`. Patterns are visible in the
  Patterns tab but do NOT modify scores in v0.1.
- **L2 — agency.** Deferred to v0.3. Receipt schema reserved. No computation.

## Failure modes that are intentionally surfaced

- **Empty state on Topics.** Zero PRIME-tier topics → API returns
  `empty_state: true` with the top 3 EVALUATEs and a banner from `docs/copy/`.
- **Unwritten copy is visible as `<PLACEHOLDER_*>`.** Per spec §13a.
- **Capped ART scores.** A Strong composite (≥75) with no citable signal in the
  last 90 days is hard-capped at 74 with `capped_reason` in the evidence.
- **Refresh with no data.** If the live scrape returns nothing it reports the
  error and leaves existing data intact — it never blanks the board.

## Three Laws status

| Law | Enforced by |
|---|---|
| No receipt → not real | `src/core/receipt.js` (every state change emits) + `gate_t24h.sh` |
| No test → not shipped | `tests/` + `gate_t24h.sh`, `gate_t48h.sh` |
| No gate → not alive | `gates/gate_t2h.sh` / `gate_t24h.sh` / `gate_t48h.sh` |

Corrections during the build are logged append-only in `docs/LESSONS.md`
(CLAUDEME v5.0 §12).
