# lessons.md — DoW SBIR Sentinel Correction Ledger

**APPEND-ONLY. No edits to existing entries. No deletions.**
Standard: CLAUDEME v5.0 §12 — every session appends here before continuing after any correction.
Format mirrors `docs/inquiro-sniper/docs/lessons_final.md`.

---

## FORMAT (strict)

```
## YYYY-MM-DD | repo: [name] | receipt: [dual_hash prefix of RULE text]
**Broke:** [what — one sentence]
**Why:** [root cause — one sentence]
**RULE:** [MUST or NEVER — imperative]
```

---

## ENTRIES

## 2026-05-15 | repo: DoWSBIRSentinel | receipt: 65afc365e3c445e21c8426b40c34f2d3

**Broke:** "Open in DSIP" 404'd on the live deploy — the link pointed at `https://www.sbir.gov/topics/<code>`, a path that does not exist.
**Why:** The bundled test fixture (`tests/fixtures/sbir_sample.json`) carried invented `sbir_topic_link` values, and the deploy ran on that fixture, so every opportunity shipped a fabricated URL.
**RULE:** NEVER ship fixture or placeholder URLs as real links; source links must come from live ingestion.

---

## 2026-05-15 | repo: DoWSBIRSentinel | receipt: 2e77635bf720e47dd293d174f4a879c8

**Broke:** Claimed the DSIP-link fix would take effect, but the live deploy kept 404ing.
**Why:** `render.yaml` set `INITIAL_INGEST_SKIP_LIVE=1`, so the deploy never scraped the SBIR API — it ran entirely on the fixture. The fix to the live-ingestion path was therefore inert.
**RULE:** MUST verify the deploy data path (live vs fixture) before claiming a data fix is live.

---

## 2026-05-15 | repo: DoWSBIRSentinel | receipt: 21b31c5f61d6951cd5f799dfab1e57cb

**Broke:** Correcting `normalize.js` + the fixture did not fix the rows already on the deployed instance.
**Why:** Render uses a persistent disk; existing `opportunities` rows keep their old `source_url`. Ingestion-code fixes only affect rows ingested *after* the change.
**RULE:** MUST backfill existing stored rows in db:migrate when changing how a field is produced.

---

## 2026-05-15 | repo: DoWSBIRSentinel | receipt: 20c6df22ffb3d6ca1c3eb82d671908e5

**Broke:** The team could not experience the full demo — the Admin tab told the public sandbox "Admin tab requires an admin token."
**Why:** The Admin view was gated `requireAdmin` (tenant === 'admin'); the public sandbox is role `pilot`, so the audit-trail view — the core "no receipt → not real" proof — was walled off from the demo.
**RULE:** MUST give the public sandbox the full read-only demo — no token walls on any tab.

---
