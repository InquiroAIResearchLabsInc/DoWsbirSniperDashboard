# DSIP Sniper · ART Edition

<!-- POSITIONING — Bubba writes the lead paragraph in docs/copy/readme_positioning.md. -->
<PLACEHOLDER_POSITIONING_PARAGRAPH>

**Doctrine:** CLAUDEME v5.0. No receipt → not real. No test → not shipped. No gate → not alive.

## What this is

A receipts-native lens for the DoW SBIR/STTR pipeline. Topic surfacing at the front. ART sponsor matching at the back. One audit chain across both. Every recommendation comes with a Why panel that cites public sources. Every weight change is auditable in append-only history. Every match score traces to a payload hash and a parent-hash chain that verifies in milliseconds.

## What this is not

A DSIP replacement. A proposal writer. A Phase III negotiator. A POM-tracking tool. A TTA drafter.

## Quick start

```bash
git clone <this-repo>
cd dsip-sniper
npm install
cp .env.example .env   # edit DEMO_TOKEN_SECRET and MAGIC_LINK_SECRET
npm run db:migrate
npm run seed
npm run dev            # http://localhost:3000
```

Mint a pilot token:

```bash
node scripts/issue_demo_token.js --tenant pilot_army_autonomy --ttl 30d --role pilot --base http://localhost:3000
```

Open the URL the script prints. The dashboard loads with the pilot's profile and Phase II tech pre-seeded.

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
- `docs/PHASE_0_CONTEXT_LOADED.md` — the §0b commit acknowledging v1→v2 deltas.
- `docs/Dsip sniper mvp build strategy v2.md` — full v0.2 strategy.
- `docs/ARCHITECTURE.md` — system map.
- `docs/DEMO_SCRIPT.md` — 5-minute single-wow-moment demo.
- `docs/PILOT_PLAYBOOK.md` — 7-day, three-touch pilot.
- `docs/inquiro-sniper/` — vendored read-only personal Sniper reference.

## Scope discipline

This system does NOT auto-email program managers. It does NOT draft TTAs. It does NOT generate POM language. It does NOT scrape internal DoW systems. It does NOT make claims about classified or POM-internal data. All data is public. All claims are sourced. If a match cannot cite a public signal, the score is capped at Promising — never Strong.

## Branch

Development branch: `claude/dsip-sniper-mvp-build-qatZz`.
