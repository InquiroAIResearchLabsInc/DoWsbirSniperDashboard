# PHASE 3 CONTEXT LOADED

Confirms green v0.2 state at Phase 3 entry. Per spec §0, Phase 3 cannot proceed until this commit lands.

## v0.2 verification (executed at Phase 3 entry)

```
npm install                      → OK, 0 vulnerabilities
npm run db:migrate               → Migrated 18 tables
npm run seed                     → 8 components, 30 sponsors, 6 demo accounts
npm run calibrate                → topic 8/8, art 4/4
node scripts/verify_chain.js     → ok=true, count=380, broken_at=null
```

Merkle root at Phase 3 entry:
`4f6a10b880445fc288dfaeffc1bfbb6fbe49b34e18c94e501e0204360deba6b7:ee0122b24f95080f48d6b41ad8e9b6c534f8554e239ccc10ab801cb11a96da84`

## What Phase 3 adds (per `docs/PHASE_3_*` strategy in turn body)

1. **Public landing page (`/`)** — no-auth entry; token in query string bypasses to dashboard.
2. **Sandbox mode (`/demo`)** — pre-seeded `tenant_id = "sandbox"`, hourly reset cron.
3. **Local test harness** (`npm run test:local`) — 9 test groups, summary table.
4. **Recording-ready local mirror** — sealed snapshot generator + demo beats sheet.
5. **Gina link generation flow** — issue/verify/revoke documented in `docs/PILOT_PLAYBOOK.md`.
6. **LinkedIn series scaffolds** — `docs/copy/linkedin_series/day_{1..7}_*.md` placeholders.

## Three Laws check (CLAUDEME v5.0)

- Law 1: every Phase 3 write emits a receipt (sandbox reset, snapshot generation, token revocation, landing page view, sandbox feedback).
- Law 2: every Phase 3 feature has at least one test group in `npm run test:local`.
- Law 3: T+2h / T+24h / T+48h gates from the strategy doc are the live blocks.

## Scope discipline

No new auth model. No new DB. No new scheduler infrastructure. Sandbox is a tenant.
Public landing is one route + one HTML file. Test runner is one orchestrator file.
