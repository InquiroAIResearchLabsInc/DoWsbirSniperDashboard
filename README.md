# DSIP Sentinel · ART Edition

<!-- POSITIONING — Bubba writes the lead paragraph in docs/copy/readme_positioning.md. -->
<PLACEHOLDER_POSITIONING_PARAGRAPH>

**Doctrine:** CLAUDEME v5.0. No receipt → not real. No test → not shipped. No gate → not alive.

## What this is

A receipts-native lens for the **12-component Department of War SBIR/STTR pipeline** (Army, Air Force, Space Force, CBD, DARPA, DLA, DMEA, DTRA, MDA, NGA, OSD, SOCOM — Navy runs a separate annual BAA and is out of scope, per `spec.md` §16.2). Topic surfacing at the front. ART sponsor matching at the back. One audit chain across both. Every recommendation comes with a Why panel that cites public sources. Every weight change is auditable in append-only history. Every match score traces to a payload hash and a parent-hash chain that verifies in milliseconds.

## What it does

The opportunity → decision → outcome loop, ported from personal Sniper and DoW-scoped:

- **Topics** — live DoW SBIR/STTR topics, scored and tiered (PRIME / EVALUATE / STRETCH / SKIP) per tenant, with a sourced Why panel.
- **Refresh** — one button pulls the live SBIR API on demand (Sniper's "Scrape Now").
- **Pipeline** — "Add to Pipeline" captures the questions that matter (deadline, expected funding, your read); de-duplicated per opportunity.
- **Record Outcome** — closes the loop (awarded / rejected / withdrawn, what worked, hours, funding) and writes a lesson.
- **Learnings** — calibration (win/loss by score dimension), return-on-effort, lessons; **Apply calibration** re-weights the scorer from your own outcomes and rescores the board.
- **Digest** — a per-tenant daily summary: new in 24h, PRIME picks, closing deadlines, active pipeline.
- **Dismiss** — hide an irrelevant topic; it auto-resurfaces after 30 days.
- **ART Match** — sponsor matching for declared Phase II tech, SBA-eligibility flag.
- **Admin / audit** — the live receipt ledger and Merkle root, open to the public demo.

## What this is not

A DSIP replacement. A proposal writer. A Phase III negotiator. A POM-tracking tool. A TTA drafter.

## Quick start

```bash
git clone <this-repo>
cd dsip-sentinel
npm install
cp .env.example .env   # edit DEMO_TOKEN_SECRET and MAGIC_LINK_SECRET
npm run db:migrate
npm run seed
npm run dev            # http://localhost:3000
```

**No-friction demo (the team / a reviewer):** open `/demo`. It loads the public **sandbox** tenant — pre-seeded with a pipeline, recorded outcomes and lessons so the full loop (Pipeline → Record Outcome → Learnings → Digest) and the Admin/audit view are populated with zero setup. The hourly sandbox reset keeps it fresh.

**Pilot token (a named company):**

```bash
node scripts/issue_demo_token.js --tenant pilot_army_autonomy --ttl 30d --role pilot --base http://localhost:3000
```

Open the URL the script prints. The dashboard loads with the pilot's profile and Phase II tech pre-seeded.

## Real data — the SBIR feed

The dashboard's topics come from the **live SBIR.gov API** (`agency=DOD`, the 12 components). Three ways data lands:

- **Refresh button** — pulls the live feed on demand.
- **Build-time ingest** — `npm run ingest:initial` runs on deploy.
- **Committed snapshot** — gov APIs sometimes IP-block cloud build hosts; run `npm run snapshot:sbir` from any machine that reaches the API, commit `seed/sbir_snapshot.json`, and the deploy serves real topics regardless. The bundled fixture is a last-resort fallback only.

"Open in DSIP" uses the API's real topic link, falling back to the DSIP topics app — never a dead link.

## Verification

```bash
bash gates/gate_t2h.sh
bash gates/gate_t24h.sh
bash gates/gate_t48h.sh
npm run calibrate              # 8/8 topic + 4/4 ART
npm run test                   # all tests
node scripts/verify_chain.js   # receipt chain + Merkle root
```

## Local-mirror (Render fallback)

```bash
npm run demo:local             # boots from data/demo_snapshot.db if present
```

## Doctrine references

- `CLAUDEME.md` — the standard. Three Laws + receipt schema + anti-patterns.
- `docs/LESSONS.md` — append-only correction ledger (CLAUDEME §12).
- `docs/PHASE_0_CONTEXT_LOADED.md` — the §0b commit acknowledging v1→v2 deltas.
- `docs/Dsip sentinel mvp build strategy v2.md` — full v0.2 strategy.
- `docs/ARCHITECTURE.md` — system map.
- `docs/DEMO_SCRIPT.md` — 5-minute single-wow-moment demo.
- `docs/PILOT_PLAYBOOK.md` — 7-day, three-touch pilot.
- `docs/inquiro-sniper/` — vendored read-only personal Sniper reference.

## Scope discipline

This system does NOT auto-email program managers. It does NOT draft TTAs. It does NOT generate POM language. It does NOT scrape internal DoW systems. It does NOT make claims about classified or POM-internal data. All data is public. All claims are sourced. If a match cannot cite a public signal, the score is capped at Promising — never Strong.

## Branch

Development branch: `claude/dsip-sniper-mvp-build-qatZz`.
