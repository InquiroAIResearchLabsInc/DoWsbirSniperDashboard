# Data-Flow Diagnostic — LAW_1 invariant gap

**Generated:** 2026-05-15  T+0 of PR (receipt-invariant fix)
**Branch:** `claude/fix-receipt-invariant-Vbrve`
**Scope:** identify the three stacked gaps in the ingest → persist → present chain and the missing stoprule that lets a "successful" deploy ship with an empty `opportunities` table. No source changes in this commit.

## The invariant

```
opportunities.count > 0 within 60s of deploy
```

This is the LAW_1 invariant for the demo. Every system-boundary failure mode below silently violates it — receipts emit, the chain stays intact, the server returns 200s, and the UI still has zero PRIME-tier rows.

## Gap 1 — Writer has no top-level entry point with an invariant check

| File | Line | Observation |
|---|---|---|
| `src/diff/engine.js` | 10–49 | `upsertOpportunity(db, opp)` is the actual writer — but it is a **private helper** of `computeDiffs`. There is no module-level `upsertOpportunities(rows, ...)` callable from the ingest path with batch semantics. |
| `src/diff/engine.js` | 51–98 | `computeDiffs(source, fresh)` runs upserts in a loop. Emits `diffs_computed` with counts of *diff types* (`new`, `closed`, `changed`, `closing_soon`, `warning`) but **never emits per-row write receipts and never asserts that the table count moved**. |
| `src/ingest/sbir_api.js` | 79–90 | `scrape()` emits `ingest` receipt with `count: deduped.length` — that's the count of *items returned by the API*, not the count of *rows persisted*. An `ingest` receipt with `count: 137` is consistent with `opportunities.count: 0`. |
| `src/scheduler/cron.js` | 30–39 | The daily SBIR job calls `sbir.scrape()` then `computeDiffs('sbir_gov', opps)`. No second receipt confirms persistence; no stoprule fires if the table count didn't change. |

**Effect:** A scrape that returns 0 items (auth failure, schema drift, rate-limit storm that exhausts the retry budget) walks through `computeDiffs` cleanly — `prev` and `fresh` are both empty, `counts.new=0`, `counts.closed=0`, `diffs_computed` emits with all zeros. No receipt says "the table is still empty." That's the LAW_1 hole.

## Gap 2 — Scheduler invocation is not gated and emits before the server is reachable

| File | Line | Observation |
|---|---|---|
| `src/api/server.js` | 118–133 | `start()` calls `require('../scheduler/cron').schedule()` **before** `app.listen()`, and **with no environment gate**. |
| `src/scheduler/cron.js` | 60 | `emitReceipt('scheduler_started', ...)` fires synchronously inside `schedule()`. |
| `tests/test_landing_page.js` | 19–28 | Tests import `app` and call `app.listen(0, ...)` directly, never `start()` — so this path is never test-covered. |

**Effect today:** Production runs the scheduler. But there is no formal contract:
1. The `scheduler_started` receipt emits *before* the server is listening, so an external `/health` probe that catches the receipt cannot trust that the API is reachable.
2. Nothing prevents a future test that calls `start()` (or `npm run dev` in a CI matrix) from spinning up real cron jobs with side effects (writing receipts, hitting the SBIR API at 05:00 UTC the next day, etc.).
3. The receipt does not carry `next_runs` (next fire time per job) — so we cannot prove from the ledger when the next scrape will land. If the demo deploys at 04:55 UTC, we want the ledger to say "next sbir_daily fire = 05:00 UTC, +5 min."

## Gap 3 — Bootstrap path is wired to a test fixture, not a curated seed

| File | Line | Observation |
|---|---|---|
| `src/api/server.js` | 82–116 | `bootstrapDataIfEmpty()` loads `tests/fixtures/sbir_sample.json`. That fixture contains **5 topics** across a partial component set (Army, Space Force, Air Force, DARPA, CBD) — it's a calibration fixture, not a demo seed. |
| `seed/` | — | The seed directory contains `components.json`, `sponsor_registry.json`, `demo_accounts.json`, weights and keyword files. **No `opportunities_bootstrap.json`.** |
| `scripts/seed_load.js` | 10–55 | `load()` seeds components, sponsors, demo accounts, and weights — never opportunities. |

**Effect:** First-deploy state on a fresh container is:
- `opportunities.count = 5` (from the test fixture) — barely enough for the demo to look alive, and missing components (Navy, SOCOM and others have no rows).
- The next scheduled scrape is 05:00 UTC. If the deploy is at 14:00 UTC, the live SBIR scrape lands ~15 hours later. If that scrape fails, see Gap 1 — we never notice.

## The missing stoprule

CLAUDEME §0 LAW_1: *No receipt → not real.* The corollary: every system-boundary operation needs a receipt that **asserts the invariant the operation was supposed to maintain**.

For ingest, the invariant is "after this run, the table is at least as populated as before, *and at least one row moved*." Three failure modes violate it:

| Failure mode | Current receipt trail | What we'd want |
|---|---|---|
| Scrape returns 0 items | `ingest{count:0}` → `diffs_computed{new:0,changed:0,closed:0}` | `ingest_noop` receipt that explicitly says "before=N, after=N, scrape produced no row deltas" + `console.error` so the platform alerting catches it |
| Scrape returns rows but `id` collisions cause every row to be a no-op update of identical fields | `ingest{count:N}` → `diffs_computed{new:0,changed:0}` | Same — `ingest_noop` because the *table count* didn't move |
| Scrape succeeds, persist throws inside the diff loop | `ingest{count:N}` → uncaught exception → `cron_error` | The exception path emits `cron_error` today; this is the one already-covered failure mode |

The `ingest_noop` receipt is the missing artifact. Adding it closes the invariant: any first-deploy that ships with zero rows leaves a literal `ingest_noop` line in `receipts.jsonl` saying *the scrape happened and nothing moved*. That's the receipt that would have caught Gap 1, Gap 2 (no scheduler → no scrape → no receipt → silent failure becomes "no `cron_run` after deploy"), and Gap 3 (bootstrap didn't run → first scrape is the only chance).

## What the fix commit does

The follow-on commit lands four changes that close the gap end-to-end. Each change is a SCHEMA + EMIT + TEST + STOPRULE block per CLAUDEME §4:

1. **`src/ingest/persist.js`** — new module. Exports `upsertOpportunities(rows, tenant_id, run_id)` with batch semantics, per-row `opportunity_upserted` receipts, and the `stoprule_ingest_invariant` that compares `before_count` to `after_count` and emits `ingest_noop` on no-op.
2. **`src/api/server.js`** — scheduler invocation moves into the `app.listen` callback and is gated by `NODE_ENV !== 'test'`. The `scheduler_started` receipt now carries `next_runs` per job.
3. **`seed/opportunities_bootstrap.json`** + `scripts/seed_load.js loadBootstrap()` — curated bootstrap seed (~35 DoW topics, 7 components, tier mix). Idempotent — skips if `opportunities.count > 0`. Emits `bootstrap_completed` on success.
4. **`src/scheduler/cron.js`** — daily SBIR job calls `persist.upsertOpportunities(...)` *before* `computeDiffs(...)`. Persist owns the stoprule; diffs continue to own row-by-row diff classification.

Plus, the copy loader leak (`TITLE:` / `BODY:` / `BANNER:` / `CTA:` labels rendering as UI text) is fixed in the same PR by flattening the copy file format — one key per atom of copy, no `LABEL:` prefixes.

## Why park LangGraph

System-boundary invariants of this shape (assert after a write, fall back to a soft-halt receipt) want an agentic DAG eventually — a `verify` node downstream of every `write` node, edges defined by which invariant a node maintains. That's the correct long-run architecture. But it's the conversation **after** the demo lands. For now, one stoprule closes one invariant; we add LangGraph when there's a third invariant that wants the same shape, not before.
