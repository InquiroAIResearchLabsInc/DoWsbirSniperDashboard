# DSIP Sniper · ART Edition — Build Spec (executor-facing)

**Source-of-truth strategy:** `docs/Dsip sniper mvp build strategy v2.md`.
**Standard:** CLAUDEME v5.0. Three Laws active.
**Branch:** `claude/dsip-sniper-mvp-build-qatZz`.

This file is the executor-facing summary, sized for the T+2h gate. It does NOT replace v0.2 strategy — it confirms the executable contract.

## Header

- Target executor: Claude Code (this run).
- Task: 48-hour MVP per v0.2 with ART Transition Match, SBA flag, k≥5 anonymizer, pre-issued demo tokens, Space Force routed separately, local-mirror fallback.

## Directory tree (no file contents)

See repository root. Matches §9 of v0.2 strategy.

## File specs

Each file documented under `src/`, `public/`, `scripts/`, `tests/`, `gates/`. Purpose and shape per v0.2 §10 and the audit report. Bodies live in the files themselves.

## Integration points

- SBIR.gov public API (live in production; fixture in `tests/fixtures/sbir_sample.json` for tests).
- SAM.gov sources-sought (fixture-only in v0.1 per AUDIT §8 — key access blocker).
- DSIP topic pages — outbound link target only.
- Render — primary deploy.
- Local-mirror via `scripts/local_mirror.js` — Render fallback.

## Verification commands

```bash
npm install
npm run db:migrate
npm run seed
npm run calibrate
node --test tests/
bash gates/gate_t2h.sh
bash gates/gate_t24h.sh
bash gates/gate_t48h.sh
node scripts/verify_chain.js
TEST_URL=http://localhost:3000 npm run smoke
```

## Explicit exclusions (matches v0.2 §16)

1. No DSIP scraping or API integration in v0.1.
2. No Navy (separate annual BAA).
3. No open registration; pre-issued demo tokens for the pilot.
4. No animated Component Pulse ticker.
5. No real-time TTA drafting; no POM line-item lookup.
6. No L1 score application in v0.1 (capture only).
7. No L2 user UI in v0.1.
8. No auto-emailing of program managers.
9. No mobile responsive.
10. No paid services beyond Render and optional email-sender for magic links.
11. No green in palette (DEMO_STEALTH_BOMBER, §15).
12. No prose inside source files — copy traces to `docs/copy/`.

## §18 open questions — resolved defaults (Bubba overrides any of these by editing copy or seed files)

| # | Question | Default chosen | Where to override |
|---|---|---|---|
| 18.1 | Public-facing name | "DSIP Sniper · ART Edition" | `package.json`, `public/index.html` `<h1>`, copy `product_tagline.md` |
| 18.2 | Director's actual name | Placeholder `<PLACEHOLDER_DIRECTOR_NAME>` | `docs/copy/day_0_message.md`, `docs/copy/day_7_recap.md` |
| 18.3 | Four demo profile selection | Scaffolds for Army autonomy / Space Force SDA / DARPA AI / AFWERX battle network | `seed/demo_accounts.json`, `tests/fixtures/phase_ii_awardees_sample.json` |
| 18.4 | Pilot send timing | Defer to Bubba; system does not auto-send | Manual send of `docs/copy/day_0_message.md` |
| 18.5 | SAM.gov key status | Fixture path active by default (`SAM_USE_FIXTURE=true`) | `.env` |
| 18.6 | Sponsor registry expansion | 30 starter sponsors seeded | `seed/sponsor_registry.json` |
| 18.7 | k-anonymity threshold | 5 (matches spec) | `KANON_MIN_TENANTS` in `.env` |
| 18.8 | "ART Match" framing | Used as the public label | `docs/copy/art_match_intro.md` once Bubba writes it |

## What Changed and Why

See `docs/PHASE_0_CONTEXT_LOADED.md` §2 — eleven v1→v2 fixes, one line each.

## Commit message convention

```
<type>(<scope>): <description ≤50 chars>

Receipt: <receipt_type>
SLO: <threshold | none>
Gate: <t2h | t24h | t48h | post>
```
