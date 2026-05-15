# Architecture — DSIP Sentinel · ART Edition

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          DSIP Sentinel · ART Edition                      │
│                                                                           │
│  ┌────────────┐  ┌────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │ INGEST     │  │ SCORING    │  │ ART MODULE   │  │ LEARNING        │   │
│  │ sbir_api   │→ │ engine_    │  │ tech_extract │  │ individual (L0) │   │
│  │ sam_       │  │ topic      │  │ priority_    │  │ anonymizer      │   │
│  │ sources_   │  │ engine_    │  │ matcher      │  │ (k≥5 gate)      │   │
│  │ sought     │  │ art        │  │ transition_  │  │ component_      │   │
│  │ normalize  │  │ why_this   │  │ history      │  │ aggregator (L1) │   │
│  │ component_ │  │ weights    │  │ scouting_    │  │ (data capture   │   │
│  │ router     │  │            │  │ signals      │  │  only in v0.1)  │   │
│  │            │  │            │  │ sba_         │  │                 │   │
│  │            │  │            │  │ eligibility  │  │                 │   │
│  │            │  │            │  │ match_       │  │                 │   │
│  │            │  │            │  │ orchestrator │  │                 │   │
│  └────────────┘  └────────────┘  └──────────────┘  └─────────────────┘   │
│         │              │                │                  │              │
│         └──────────────┴────────────────┴──────────────────┘              │
│                                  │                                        │
│                            CORE PRIMITIVES                                │
│             hash · receipt · tenant · stoprule · copy                     │
│                                  │                                        │
│                            STORAGE (SQLite)                               │
│   tenants · profiles · opportunities · scores · pipeline · outcomes       │
│   lessons · weight_history · phase_ii_techs · sponsor_candidates          │
│   art_matches · sponsor_pipeline · sba_eligibility · component_patterns   │
│   diffs · digests · source_status · snapshots                             │
│                                  │                                        │
│                          RECEIPTS LEDGER (JSONL)                          │
│  parent_hash chain · Merkle root every MERKLE_BATCH_SIZE receipts         │
│                                  │                                        │
│                         API LAYER (Express, 11 routes)                    │
│  opportunities · pipeline · outcomes · why · art_matches                  │
│  sponsor_pipeline · sba_eligibility · auth · profile · admin · receipts   │
│                                  │                                        │
│                     AUTH (HMAC) — pre-issued demo tokens                  │
│                     magic_link built but dormant in v0.1                  │
│                                  │                                        │
│                          FRONTEND (vanilla JS)                            │
│  4-tab single-page app: Topics · ART Match · Component Patterns · Admin   │
│  DEMO_STEALTH_BOMBER palette: matte black / bone white / amber. No green. │
└──────────────────────────────────────────────────────────────────────────┘
```

## Receipts — the audit chain

Every state change emits one of these receipts (incomplete list — full list in `src/`):

| Receipt type | Where |
|---|---|
| `phase_0_context_loaded` | `docs/PHASE_0_CONTEXT_LOADED.md` commit |
| `db_migrate_complete` | `src/db/migrate.js` |
| `seed_loaded` | `scripts/seed_load.js` |
| `weight_history_seeded` / `weights_applied` | `src/scoring/weights.js` |
| `topic_score_computed` | `src/scoring/engine_topic.js` |
| `art_match_computed` / `art_match_surfaced` | `src/art/match_orchestrator.js` |
| `art_match_disagreement` | `src/art/match_orchestrator.js`, `src/api/routes/why.js` |
| `art_sponsor_pipeline_added` | `src/art/match_orchestrator.js` |
| `sba_eligibility_flag_emitted` | `src/art/sba_eligibility.js` |
| `kanon_blocked` | `src/learning/anonymizer.js` |
| `component_pattern_emitted` | `src/learning/component_aggregator.js` |
| `sponsor_priority_match` | `src/art/priority_matcher.js` |
| `scouting_signals_computed` | `src/art/scouting_signals.js` |
| `outcome_recorded` | `src/learning/individual.js` |
| `demo_token_issued` / `demo_token_used` / `demo_token_revoked` | `src/auth/demo_token.js` |
| `ingest` / `ingest_error` / `ingest_warning` | ingest layer |
| `server_boot` / `server_error` | `src/api/server.js` |
| `anchor` | `src/core/receipt.js` (Merkle batch) |

Every receipt has: `receipt_type, ts, tenant_id, payload_hash (sha256:blake3), parent_hash (chain), receipt_hash (this row's own hash), body`.

## The three tiers of learning

- **L0 — individual.** Active. Per-tenant weight calibration from outcome capture. Mirror of personal Sniper feedback loop.
- **L1 — component.** Capture-only in v0.1. `component_aggregator` runs nightly, computes per-(component × dimension) win/loss averages, writes to `component_patterns`. **k ≥ 5 distinct tenants required before any pattern emits.** Below threshold → `kanon_blocked` receipt. Patterns are visible in admin/patterns tab but do NOT modify scores in v0.1.
- **L2 — agency.** Deferred to v0.3. Receipt schema reserved. No computation here.

## Failure modes that are intentionally surfaced

- **Empty state on Topics.** When zero PRIME tier topics are visible, the API returns `empty_state: true` with the top 3 EVALUATEs and a banner from `docs/copy/empty_state_title.md` + `docs/copy/empty_state_body.md`. The center panel is never blank as long as the DB has any opportunity.
- **Unwritten copy is visible as `<PLACEHOLDER_*>`.** Per spec §13a. This is the signal that Bubba has not yet written that string.
- **Capped ART scores.** When the composite would land Strong (≥75) but there is no citable signal in the last 90 days, the score is hard-capped at 74 ("Promising") with `capped_reason: no_citable_public_signal_in_90d` in the evidence.

## Three Laws status

| Law | Enforced by |
|---|---|
| No receipt → not real | `src/core/receipt.js` (every state change emits) + `gate_t24h.sh` (greps for `emitReceipt`) |
| No test → not shipped | `tests/` + `gate_t24h.sh`, `gate_t48h.sh` |
| No gate → not alive | `gates/gate_t2h.sh` / `gate_t24h.sh` / `gate_t48h.sh` |
