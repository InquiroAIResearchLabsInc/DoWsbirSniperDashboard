# DSIP SNIPER — MVP BUILD STRATEGY v0.2 (OPTIMIZED, ART-EXTENDED)

**Target executor:** Claude Code
**Working name:** DSIP Sniper · ART Edition
**Build window:** 48 hours from T0
**Doctrine:** CLAUDEME v3.1. No receipt → not real. No test → not shipped. No gate → not alive.
**Aesthetic standard:** DEMO_STEALTH_BOMBER v1.0
**Supersedes:** v0.1. v1 weaknesses red-teamed in §0a.

---

## §0a — RED TEAM OF v0.1 (WHAT BROKE, WHAT'S FIXED)

| v1 weakness | Why it broke | v2 fix |
|---|---|---|
| Surfaced topics only; ignored post-Phase-II lifecycle | The director's actual problem is ART, not topic discovery. v1 left the highest-value space empty. | New §3a: **ART Transition Match module** — sponsor-matching for Phase II awardees. |
| "Component Pulse" UI was a hero feature | High build cost, abstract for the director audience, distracts from ART. | L1 data capture retained. UI dropped to a single static read-only panel. No animation. |
| Magic-link auth + invite codes for the pilot | Director should not have to enter an email and wait for a link to see a demo. | **Pre-issued demo accounts** for pilot. Magic-link plumbing built but used only by Bubba's admin access in v0.1. |
| No mention of Strategic Breakthrough Awards | $30M / 48-month ceiling is the single biggest change in the new Act; surfacing eligibility is high-leverage. | New §3b: SBA eligibility flag on every Phase II awardee profile. |
| Anonymization said "strip free-text"; no k-anonymity floor | With 5–10 users, quantitative aggregation can re-identify a tenant from a unique (component, submission_type, score) triple. | **k ≥ 5** before any L1 pattern emits. Hard gate in `anonymizer.js`. |
| No tie to component modernization priorities | These are the actual ART pull signals. v1 had no place for them. | Seed file `seed/component_priorities.json` loaded from published DAF/Army/Space Force posture statements. |
| Demo script was 7 minutes | Director attention is the constraint; pad signals weak product. | 5-minute script with single "wow" moment around ART match reveal. |
| L2 agency learning was admin-visible in MVP | More surface area = more failure modes. Director needs to *believe* it's possible, not see a half-built version. | L2 fully deferred to v0.3. Receipts retained for future replay. |
| Render-only deployment | If Render hiccups during the demo, no fallback. | **Local-mirror mode**: `npm run demo:local` boots from a sealed SQLite snapshot and serves the same UI on localhost. |
| Component classifier conflated Space Force into Air Force | Organizationally correct but confuses the director audience. | Space Force becomes its own routed component (`space_force`). Topic prefix `SF` → space_force; `AF` → air_force; `USSF` → space_force. |
| 8 calibration reference cases were all from Bubba's domain | Director will spot the bias. | Expand to 12 cases: 8 from personal Sniper + 4 ART-relevant scenarios (one per major DoW component sponsor type). |

---

## §0b — FIRST ACTIONS (REQUIRED BEFORE ANY FILE IS CREATED)

1. `view CLAUDEME.md` at repo root. Internalize Three Laws, receipt schema, gates.
2. **Read these files from existing `northstaraokeystone/inquiro-sniper` repo:**
   - `src/scrapers/sbir.js` — SBIR.gov scraper. Reuse.
   - `src/scorer.js` — 5-dim engine. Adapt to multi-tenant + ART matching.
   - `src/db/index.js` — schema patterns, append-only tables.
   - `src/feedback.js` — outcome/calibration logic.
   - `src/diff.js`, `dashboard/index.html` — diff engine and 3-panel layout reference.
3. **Read this v2 doc end-to-end. Cite §0a fixes in the Phase 0 commit message.**
4. Diagnostic commit lands as `docs/PHASE_0_CONTEXT_LOADED.md` enumerating reads with file:line citations and a one-line per fix from §0a confirming you've understood the v1→v2 deltas.

Cannot proceed to §1 until commit lands.

---

## §1 — STRATEGIC CONTEXT

**The trigger:** Bubba demoed his personal Sniper publicly. The Director of SBIR at DoW saw it. She referenced revisiting DSIP. She also mentioned leading the **ART (Accelerated Research for Transition) Program** — established April 20, 2026 by the DoW Office for Small Business Innovation, almost certainly under Gina Sims, the office's stated director ([war.gov press release](https://www.war.gov/News/Releases/Release/Article/4463884/), [executivegov.com](https://www.executivegov.com/articles/dow-sbir-sttr-reauthorization-solicitation)).

**ART in one paragraph:** A *technology pull* program. Phase II awardees cannot apply alone — they need a DoW program office (sponsor) that (a) needs the technology, (b) commits a 1:1 dollar match, (c) signs a Technology Transition Agreement (TTA), and (d) commits to inclusion in the POM. The hardest problem in ART is not the technology — it is **sponsor matching**. No existing tool solves this. ([wisconsinctc.org/2026/04/20](https://wisconsinctc.org/2026/04/20/an-overview-of-the-art-program-at-dow/), [insidegovernmentcontracts.com](https://www.insidegovernmentcontracts.com/2026/04/sbir-sttr-is-back-and-the-department-of-war-is-wasting-no-time/))

**ART connects upstream to the Strategic Breakthrough Awards** under §3 of the Small Business Innovation and Economic Security Act (Public Law 119-83, signed April 13, 2026): up to **$30M per project**, up to **48 months**, requires ≥1 prior Phase II + 100% matching from new private capital + commercial viability. DoW adds two layers: POM commitment from a senior acquisition official, and 20% matching from new DoW sources.

**This MVP solves three problems, ranked by director-relevance:**

1. **(NEW, highest)** Sponsor matching for Phase II awardees pursuing ART.
2. (Inherited from v1) Personalized topic surfacing for SBIR/STTR open topics across seven DoW components.
3. (Inherited from v1) Learning loop that proves the system gets smarter over time, with full audit chain.

---

## §2 — PRODUCT POSITIONING

| Dimension | Stance |
|---|---|
| **What it is** | A receipts-native lens for the DoW SBIR/STTR pipeline. Topic surfacing at the front. **ART sponsor matching at the back.** One audit chain across both. |
| **What it is not** | A DSIP replacement. A proposal writer. A Phase III negotiator. A POM-tracking tool. |
| **Two audiences** | (a) Small businesses pursuing DoW SBIR/STTR — topic surfacing serves them. (b) The DoW Office for Small Business Innovation (Gina Sims's office) — ART sponsor matching serves them and the awardees they shepherd. |
| **Differentiation from DSIP** | DSIP is where you apply. Sniper is where you decide whether to apply, and after Phase II, where you find your sponsor. |
| **Differentiation from personal Sniper** | Multi-tenant, web-deployed, ART-extended, with anonymized cross-tenant learning at the component level. |
| **Public principle** | "Every recommendation comes with a receipt. Every score is explainable. Every weight change is auditable. Every sponsor match is sourced." |

---

## §3 — LOCKED MVP SCOPE

| In (MUST) | Deferred to v0.3 |
|---|---|
| SBIR.gov public API for open + pre-release DoW topics | DSIP scraping. DSIP API integration. |
| Seven components: army, air_force, **space_force** (own slot), cbd, darpa, dmea, dtra, socom | Navy (separate annual BAA) |
| Multi-tenant per-company; **pre-issued demo accounts** for the pilot | Open registration; Login.gov OAuth |
| Personalized 5-dim scoring per tenant (adapted from personal Sniper) | New scoring dimensions |
| **ART Transition Match module** (§3a) | Real-time TTA drafting; POM line-item lookup; OSW briefing automation |
| **Strategic Breakthrough Award eligibility flag** (§3b) | Full SBA application workflow |
| L0 individual learning (per-tenant weight calibration) | — |
| L1 component data capture + anonymized aggregation (k ≥ 5) | L1 calibration loop applying patterns to scores (collect data first, apply in v0.3) |
| Static read-only "Component Patterns" panel | Animated Component Pulse ticker |
| "Why this?" panel on every recommendation (7 mandatory items) | Generative AI explanations |
| Link out to DSIP for every topic; link to sponsor public source for every ART match | DSIP deep-link iframe; embedded TTA forms |
| Receipts ledger + Merkle root every 100 receipts | Public verification endpoints |
| DEMO_STEALTH_BOMBER aesthetic | Mobile responsive |
| **Local-mirror mode** for demo fallback | — |

**Build target:** 48 hours to a URL that survives the director's screenshare. If a feature is not in column 1, it does not ship.

---

## §3a — THE ART TRANSITION MATCH MODULE (THE HIGH-VALUE ADDITION)

### The problem
A small business with a Phase II win cannot apply for ART without a sponsor commitment. Finding a sponsor requires knowing which DoW program offices (a) have a modernization priority that matches the tech, (b) have historically transitioned SBIR work (signal of willingness), (c) are actively scouting (signal of intent — visible in SAM.gov sources-sought / RFI notices), (d) have an identifiable program manager. Today this is done by relationship + LinkedIn + cold email. ART will live or die on whether this matching becomes systematic.

### The output (the "wow" moment in the demo)
For any tenant flagged as a Phase II awardee, the dashboard surfaces an **ART Transition Match** view. For each owned Phase II technology, the system returns a ranked list of **potential sponsors**:

```
┌────────────────────────────────────────────────────────────────────┐
│  Phase II Tech: <topic_code>  ·  <title>                           │
│  Award date: <date>  ·  Component of origin: <component>           │
│                                                                    │
│  TOP SPONSOR MATCHES                                               │
│  ──────────────────────────────────────────────────────────────    │
│  ▌ Match score: 87  ·  PEO IEW&S (Army)                            │
│    Modernization priority match: Contested logistics (Tier-A)     │
│    Historical SBIR Phase III: 14 awards / 7 vendors / $182M total  │
│    Active sources sought (≤90d): 3 relevant notices                │
│    Why this?  ·  Open SAM.gov  ·  Add to Sponsor Pipeline          │
│                                                                    │
│  ▌ Match score: 79  ·  AFLCMC Battle Network (DAF)                 │
│    Modernization priority match: Data fusion / kill web (Tier-A)  │
│    Historical SBIR Phase III: 22 awards / 11 vendors / $341M       │
│    Active sources sought (≤90d): 1 relevant notice                 │
│    Why this?  ·  Open SAM.gov  ·  Add to Sponsor Pipeline          │
└────────────────────────────────────────────────────────────────────┘
```

### How the score is computed (deterministic, fully explainable)
Five sub-scores, weighted, sum to 0–100. **Same engine pattern as the topic scorer; new inputs.**

| Sub-score | Default weight | What it measures | Data source |
|---|---|---|---|
| Priority alignment | 35% | Match between Phase II tech keywords and the sponsor's published modernization priorities | Seed: `seed/component_priorities.json` (loaded from DAF FY26 Posture Statement, Army modernization priorities, USSF mission areas, etc.) |
| Transition history | 25% | Sponsor's historical SBIR Phase III award rate and dollar volume | SBIR.gov award data API (already in personal Sniper scrapers) |
| Active scouting | 20% | Recent (≤90 day) SAM.gov sources-sought / RFI / market research notices from this sponsor in this tech area | SAM.gov API (when key available; fixture data for demo) |
| Tech maturity fit | 10% | Whether the sponsor's typical Phase III ceiling matches the awardee's tech readiness level | SBIR.gov + Phase II profile |
| Recency boost | 10% | Decay function on age of latest signal — recent activity outweighs historical | Derived |

Each sub-score appears in the Why panel with its own data citation. Click any sub-score → see the raw signal that produced it.

### The Why panel for ART match (mandatory)
Same seven-item discipline as the topic Why panel:

1. Final match score and band (Strong / Promising / Weak)
2. Five sub-score breakdown with active weights
3. Matched modernization priority keywords (chips with hover to source quote)
4. Historical transition table (last 5 sponsored Phase III wins under this PEO)
5. Active scouting signals (clickable to SAM.gov source)
6. Sponsor contact pathway (named PMs from public award data — surface only, do not auto-email)
7. "This sponsor is wrong" feedback button → calibrates priority-alignment weights

### What ART Match explicitly DOES NOT do (scope discipline)
- Does **not** auto-email program managers.
- Does **not** draft the TTA.
- Does **not** generate POM language.
- Does **not** simulate sponsor responses.
- Does **not** scrape internal DoW systems.
- Does **not** make any claim about classified or POM-internal data.

All data is public. All claims are sourced. If a match cannot cite a public signal, the score is capped at "Promising" (≤74), never "Strong."

### Receipts emitted by the ART module
- `art_match_computed_receipt` — per (phase_ii_tech × sponsor_candidate) scoring event.
- `art_match_surfaced_receipt` — when a sponsor candidate appears in a tenant's view.
- `art_sponsor_pipeline_added_receipt` — when the tenant adds a sponsor to their pursuit pipeline.
- `art_match_disagreement_receipt` — when the tenant clicks "This sponsor is wrong."
- `sba_eligibility_flag_emitted_receipt` — see §3b.

### The "ART can learn" angle (why this matters for the director)
Every disagreement and every successful TTA outcome (if surfaced to the system in v0.3) flows into the priority-alignment dimension calibration. Over 6–12 months, the system learns which match patterns translate to actual transitions across each component. This is the **L2 agency signal** that comes online in v0.3 — but the data capture starts now. Every ART match receipt today is training data for the agency-level pattern engine tomorrow.

---

## §3b — STRATEGIC BREAKTHROUGH AWARD ELIGIBILITY FLAG

Under §3 of P.L. 119-83, agencies with annual SBIR expenditures exceeding $100M may award up to **$30M per project, period of performance ≤48 months**, to firms meeting three SBA criteria + two DoW-specific criteria:

| Criterion | Source | How we detect |
|---|---|---|
| ≥1 prior Phase II award | SBIR.gov award history | API lookup on tenant company name + UEI |
| 100% matching from new private capital or qualifying non-SBIR government sources | Tenant declaration | Tenant profile field; receipted |
| Demonstrated commercial viability | Tenant declaration | Tenant profile field; receipted |
| POM inclusion commitment from senior DoW acquisition official | Tenant declaration | Tenant profile field; receipted |
| ≥20% matching from new DoW sources | Tenant declaration | Tenant profile field; receipted |

The system surfaces eligibility as a **flag**, not a recommendation. Every flag carries a receipt. The flag links to the relevant SBA notice text and the DoW Office for Small Business Innovation guidance page.

---

## §4 — THE THREE-TIER LEARNING ARCHITECTURE (SIMPLIFIED FROM v1)

| Tier | Status in v0.2 | Notes |
|---|---|---|
| L0 — individual | Active | Same as personal Sniper. Per-tenant calibration on weight history. |
| L1 — component | **Data capture only.** Patterns computed nightly, written to `component_patterns`, displayed in a static admin panel. **Not applied to scoring in v0.1.** | k-anonymity ≥ 5 before any pattern emits. Anonymizer drops free-text + identifying fields. |
| L2 — agency | **Deferred to v0.3.** | Receipt schema reserved. No computation in MVP. |

Why this is tighter than v1: v1 promised three tiers of visible learning. The director will believe the architecture if she sees L0 working visibly + L1 captured with audit + L2 reserved with a schema. Building all three by T+48h is a scope trap.

---

## §5 — THE "WHY THIS?" REQUIREMENT (UNCHANGED FROM v1, EXTENDED TO ART)

Two Why panels in this system:
- **Topic Why panel:** the seven items from v1 §5. No change.
- **ART Match Why panel:** the seven items from §3a above.

Both panels share a single React-component-or-vanilla-JS primitive (`why_panel.js`) parameterized by payload type. One bar-animation primitive (`score_reveal.js`) drives both.

---

## §6 — DATA SOURCES (v2)

| Source | Use | MVP status |
|---|---|---|
| SBIR.gov public API | Open + pre-release DoW topics; historical Phase II/III award data for transition history + Strategic Breakthrough eligibility | Reuse personal Sniper scraper |
| DAF FY26 Posture Statement, Army modernization priorities (public), USSF mission areas, DARPA office focus areas | Sponsor priority library | Seed file, hand-curated to start, mechanically refreshable from public PDFs |
| SAM.gov sources-sought / RFI / special notices | Active scouting signals (≤90 day window) | Personal Sniper has SAM scraper. Reuse where key access permits; otherwise demo with fixture file. |
| DSIP topic pages | Outbound link target only | Every topic card → DSIP topic URL |

**No private data. No classified data. No internal DoW systems.**

---

## §7 — AUTH STRATEGY (v2: PILOT-OPTIMIZED)

| Mode | Use | Mechanism |
|---|---|---|
| **Demo accounts** | The pilot. The director and ≤5 named Phase II awardees Bubba selects. | Pre-issued URLs with embedded one-way HMAC token. No signup. Token has 30-day TTL and is revocable. |
| **Magic link** | Bubba's admin access and v0.3 production path. | Built but exercised only by Bubba in v0.1. |
| **Public registration** | Deferred to v0.3 production. | Not in MVP. |

This is the single biggest UX change from v1: **the director clicks a link and is on the dashboard.** No magic link wait. No invite code. No friction.

---

## §8 — MULTI-TENANCY (UPDATED FROM v1)

Same shape as v1, with these v2 additions:

- New table `phase_ii_techs` — one row per tenant-claimed Phase II win. Carries `topic_code`, `award_date`, `originating_component`, `tech_keywords[]` (extracted from topic description), `trl` (tenant declaration).
- New table `sponsor_candidates` — global registry of DoW program offices, with `name`, `component`, `priorities[]` (FK to `component_priorities`), `historical_phase_iii_count`, `historical_phase_iii_total_usd`.
- New table `art_matches` — per (tenant × phase_ii_tech × sponsor_candidate) scoring rows. Frozen at compute time; recomputed only on profile change.
- New table `sponsor_pipeline` — per-tenant ART pursuit pipeline (analog to topic pipeline). Same state machine: `targeting → outreach → conversation → tta_drafted → tta_signed → art_applied → art_awarded/rejected`.
- New table `sba_eligibility` — per-tenant Strategic Breakthrough flag with receipt linkage to each criterion's source.

k-anonymity gate (§4 L1): in `learning/component_aggregator.js`, before any pattern emits, the supporting outcome set must contain **≥5 distinct tenants**. Below 5, no pattern is generated for that component+dimension combination. Gate documented in receipt.

---

## §9 — DIRECTORY STRUCTURE (TIGHTER THAN v1)

```
dsip-sniper/
├── CLAUDEME.md
├── README.md
├── package.json
├── render.yaml
├── .env.example
├── spec.md                         # T+2h
├── ledger_schema.json
├── receipts.jsonl
├── merkle_root.txt
├── data/
│   └── dsip-sniper.db
├── seed/
│   ├── components.json
│   ├── default_keywords.json
│   ├── default_weights_topic.json
│   ├── default_weights_art.json    # NEW: ART sub-score weights
│   ├── component_priorities.json   # NEW: hand-curated modernization priorities by component
│   ├── sponsor_registry.json       # NEW: starter set of ~30 known DoW program offices
│   ├── demo_accounts.json          # NEW: pre-issued tokens for the pilot
│   └── calibration_cases.json      # 12 cases: 8 inherited + 4 ART
├── src/
│   ├── core/                       # hash, receipt, tenant, stoprule (as v1)
│   ├── auth/                       # magic_link (built, dormant), demo_token, middleware
│   ├── ingest/
│   │   ├── sbir_api.js             # Topics + historical awards (REUSE)
│   │   ├── sam_sources_sought.js   # NEW: SAM.gov sources-sought puller (or fixture)
│   │   ├── normalize.js
│   │   └── component_router.js     # NEW Space Force routing per §0a
│   ├── scoring/
│   │   ├── engine_topic.js         # The 5-dim topic engine (REUSE)
│   │   ├── engine_art.js           # NEW: the 5-sub-score ART match engine
│   │   ├── why_this.js             # SHARED primitive, parameterized payload
│   │   ├── component_bonus.js      # Reserved, dormant in v0.1 (L1 not applied yet)
│   │   └── weights.js
│   ├── art/                        # NEW MODULE
│   │   ├── tech_extractor.js       # Extract keywords from a Phase II topic description
│   │   ├── priority_matcher.js     # Match tech keywords to component priorities
│   │   ├── transition_history.js   # Per-sponsor historical Phase III stats from SBIR.gov
│   │   ├── scouting_signals.js     # Active SAM sources-sought aggregation per sponsor
│   │   ├── sba_eligibility.js      # Strategic Breakthrough Award flag computation
│   │   └── match_orchestrator.js   # Composes the five sub-scores, emits art_match_receipt
│   ├── learning/
│   │   ├── individual.js           # L0 (REUSE pattern from feedback.js)
│   │   ├── anonymizer.js           # k≥5 gate, field strip
│   │   └── component_aggregator.js # L1 nightly, data capture only
│   ├── db/                         # schema, migrations, index
│   ├── api/
│   │   ├── server.js
│   │   ├── routes/
│   │   │   ├── opportunities.js
│   │   │   ├── pipeline.js
│   │   │   ├── outcomes.js
│   │   │   ├── why.js              # Handles both topic + ART payloads
│   │   │   ├── art_matches.js      # NEW: list, recompute, feedback
│   │   │   ├── sponsor_pipeline.js # NEW
│   │   │   ├── sba_eligibility.js  # NEW
│   │   │   ├── auth.js
│   │   │   ├── profile.js          # Includes Phase II tech declarations + Strategic Breakthrough criteria
│   │   │   ├── admin.js
│   │   │   └── receipts.js
│   │   └── empty_state.js
│   ├── scheduler/cron.js
│   └── diff/engine.js
├── public/
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── components/
│   │   ├── opportunity_card.js
│   │   ├── art_match_card.js       # NEW
│   │   ├── why_panel.js            # Renders topic OR art payload
│   │   ├── pipeline_panel.js
│   │   ├── sponsor_pipeline_panel.js # NEW
│   │   ├── diff_feed.js
│   │   ├── component_patterns_static.js # Replaces ticker; static read-only list
│   │   ├── your_lens.js
│   │   ├── sba_flag.js             # NEW
│   │   ├── filter_bar.js
│   │   └── score_reveal.js
│   └── assets/
├── tests/
│   ├── test_t2h_gate.js
│   ├── test_t24h_gate.js
│   ├── test_t48h_gate.js
│   ├── test_why_panel.js
│   ├── test_art_match.js           # NEW: 4 ART calibration cases
│   ├── test_anonymizer_kanon.js    # NEW: k≥5 gate verified across 100 fuzz inputs
│   └── fixtures/
│       ├── sbir_sample.json
│       ├── sam_sources_sought_sample.json # NEW
│       └── phase_ii_awardees_sample.json  # NEW: 10 anonymized real awardees for demo
├── gates/                          # gate_t2h.sh, gate_t24h.sh, gate_t48h.sh
├── scripts/
│   ├── verify_chain.js
│   ├── issue_demo_token.js         # NEW: CLI to mint pre-issued tokens for pilot
│   ├── local_mirror.js             # NEW: boots local-mirror mode from sealed snapshot
│   └── seed_load.js
├── docs/
│   ├── PHASE_0_CONTEXT_LOADED.md
│   ├── DEMO_SCRIPT.md              # 5-min, ART-centric
│   ├── PILOT_PLAYBOOK.md           # NEW: the 7-day pilot recommendation (see §13)
│   └── ARCHITECTURE.md
└── MANIFEST.anchor
```

---

## §10 — FILE SPECS — DELTA FROM v1 ONLY

Only new or materially changed files documented here. v1 files unchanged in purpose are not repeated.

### ART module

- **`src/art/tech_extractor.js`** — Given a Phase II topic record, returns a normalized set of tech keywords (Tier-A/B/C) reusing the personal Sniper keyword library. Pure function. Output is the input to `priority_matcher.js`. Emits no receipt (intermediate computation).
- **`src/art/priority_matcher.js`** — Matches a tech keyword set against `component_priorities.json`. Returns a per-priority score 0–100 with the matched keywords as evidence. Deterministic. Drives the 35% priority-alignment sub-score.
- **`src/art/transition_history.js`** — Per-sponsor lookup of historical Phase III awards from SBIR.gov. Returns count, total USD, vendor diversity, and a 5-year decay-weighted score. Cached per-sponsor for 24h.
- **`src/art/scouting_signals.js`** — Pulls SAM.gov sources-sought/RFI notices ≤90 days old filtered to a sponsor's office. Returns a list of relevant notices with relevance score. Falls back to fixture (`fixtures/sam_sources_sought_sample.json`) if API key unavailable. Decision logged in `ingest_receipt` either way.
- **`src/art/sba_eligibility.js`** — Computes Strategic Breakthrough Award eligibility flag for a tenant. Five inputs from §3b. Returns `{eligible: bool, missing_criteria: [...], evidence_receipts: [...]}`. Emits `sba_eligibility_flag_emitted_receipt`.
- **`src/art/match_orchestrator.js`** — Composes the five sub-scores into a final ART match score per (tenant × phase_ii_tech × sponsor_candidate). Emits one `art_match_computed_receipt` per row. Builds the Why payload (seven items per §3a). Writes to `art_matches` table.

### Anonymizer (strengthened)

- **`src/learning/anonymizer.js`** — Before any L1 pattern emit, asserts ≥5 distinct tenants in the supporting outcome set for each (component × dimension) tuple. If the gate fails, the pattern is not emitted; instead a `kanon_blocked_receipt` is written with the component, dimension, and current N. This is the auditable proof that anonymization is enforced, not assumed.

### Auth

- **`src/auth/demo_token.js`** — HMAC-signed pre-issued tokens. Format: `<tenant_id>.<expires_at>.<signature>`. 30-day TTL default. Revocation list in `data/revoked_tokens.json`. `scripts/issue_demo_token.js` mints these for the pilot.

### Local fallback

- **`scripts/local_mirror.js`** — Boots Express on localhost:3000 against a sealed SQLite snapshot (`data/demo_snapshot.db`). Snapshot is committed to repo for deterministic demo state. `npm run demo:local` is the rescue command if Render is degraded.

### Seed files of strategic importance

- **`seed/component_priorities.json`** — Hand-curated from public sources for v0.1. Each component has a list of `{priority_name, tier (A/B/C), keywords[], source_doc, source_url}` entries. Examples must include:
  - Army: contested logistics, autonomous ground systems, soldier lethality, network modernization
  - Air Force: NGAD/F-47, Collaborative Combat Aircraft, Battle Network data fusion, nuclear C3 modernization, Golden Dome contribution
  - Space Force: resilient satellite architectures, space domain awareness, ground C2, launch
  - DARPA: AI/ML, biotech, microelectronics, quantum, hypersonics
  - CBD, DMEA, DTRA, SOCOM: 2–4 priorities each from public posture statements
- **`seed/sponsor_registry.json`** — Initial ~30 known DoW program offices (PEO IEW&S, AFLCMC Battle Network, USSF SSC, AFRL DT, etc.) with `name`, `component`, `parent_command`, `public_url`, `priority_tags[]`.
- **`seed/demo_accounts.json`** — 6 pre-issued tokens: 1 admin (Bubba), 1 director (Gina Sims or proxy), 4 Phase II awardee profiles representing diverse components and tech stages.
- **`seed/calibration_cases.json`** — 12 reference cases. Eight inherited from personal Sniper calibration suite. Four new ART cases:
  1. Phase II awardee in autonomous ground systems → expected SNIPER match with Army PEO Ground Combat Systems.
  2. Phase II awardee in space domain awareness → expected SNIPER match with USSF SSC.
  3. Phase II awardee in benign commercial software with no DoD pull → expected SKIP across all sponsors.
  4. Phase II awardee in cross-component tech (e.g., AI/ML data fusion) → expected EVALUATE matches across multiple components, no single SNIPER.

---

## §11 — RECEIPT TYPES (v2 ADDS)

New since v1, all dual-hashed and tenant-tagged:

| Receipt | Trigger | Notes |
|---|---|---|
| `art_match_computed_receipt` | Per sponsor candidate scored | Carries all 5 sub-scores + payload_hash |
| `art_match_surfaced_receipt` | When a candidate appears in tenant's view | Audit of which matches the user actually saw |
| `art_sponsor_pipeline_added_receipt` | Tenant pursues a sponsor | |
| `art_match_disagreement_receipt` | "This sponsor is wrong" | Input to v0.3 calibration |
| `sba_eligibility_flag_emitted_receipt` | Strategic Breakthrough flag computed | Links to each criterion's evidence receipt |
| `kanon_blocked_receipt` | L1 pattern emit blocked by k<5 | Proof anonymization gate is real |
| `sponsor_priority_match_receipt` | Sponsor priority matched to tech keywords | Volume — sampled at 1 in 5 unless audit flag |
| `demo_token_issued_receipt` | Admin mints a pilot token | Carries token hash, not token |
| `demo_token_used_receipt` | Pilot user lands via token | First access timestamp |

---

## §12 — THE THREE GATES (v2)

### T+2h: skeleton
- Phase 0 commit landed with §0a fix-by-fix acknowledgment.
- Core: hash, receipt, tenant, stoprule pass unit tests.
- Express boots; `/health` 200.
- One demo token round-trips: `scripts/issue_demo_token.js` → URL access → tenant attached to request → receipt written.
- `gate_t2h.sh` passes.

### T+24h: feature complete
- 7 components correctly classified (Space Force is its own slot).
- Topic scoring passes 8/8 inherited calibration cases.
- ART module passes 4/4 new calibration cases.
- Why panel renders correctly for both topic and ART payloads.
- Anonymizer k≥5 gate verified across 100 fuzz inputs (`test_anonymizer_kanon.js`).
- Pre-issued demo tokens for all 6 demo accounts exist; each lands on a populated dashboard.
- DEMO_STEALTH_BOMBER palette compliance: 100% (run `gates/gate_t24h.sh` palette grep).
- `gate_t24h.sh` passes.

### T+48h: demo ready
- Deployed to Render at a real URL.
- `npm run demo:local` succeeds against the sealed snapshot.
- Smoke test runs against the deployed URL end-to-end.
- Six demo tokens minted and tested in incognito.
- `docs/DEMO_SCRIPT.md` rehearsed.
- `docs/PILOT_PLAYBOOK.md` finalized (see §13).
- Receipts ledger has zero gaps in the smoke run. Merkle root verifies.
- **Readability Gate (Bubba):** open the ART Match Why panel for the autonomous-ground-systems demo profile. In two sentences, explain to a non-technical reviewer why PEO Ground Combat Systems was surfaced as the top sponsor match. If yes, ship.

---

## §13 — THE SIMPLE EASY PILOT RECOMMENDATION (`docs/PILOT_PLAYBOOK.md`)

A **7-day, three-touch pilot** with the Director of SBIR (Gina Sims or her stand-in) and her office. Zero signup friction. Zero infrastructure burden on her side. Concrete feedback loop in the system itself.

### Day 0 — The send
Bubba sends a short LinkedIn message or email:

> Director Sims — short follow-up from our call. I built a small, focused test of what an ART-aware sponsor-matching layer could look like on top of DSIP. No signup. No emails captured. Click the link, and you're on the dashboard with four representative Phase II awardee profiles already loaded. The ART Match view is the one to look at. Every recommendation has a receipt and a public-source citation. Spend 5 minutes; tell me if any of the four matches are clearly wrong. — Bubba

**Attached: one URL with her pre-issued token.** The link drops her on the dashboard already authenticated as her review account. Read-only by default; she can click "This sponsor is wrong" on any match to leave structured feedback.

### Day 3 — The screenshare
A scheduled 30-minute call. Bubba shares his screen. They walk through one profile together. The director sees:

1. The four pre-loaded Phase II profiles, each in a different component.
2. The ART Match output for one profile — top 3 sponsor candidates with score, modernization-priority match, historical transition count.
3. The Why panel for one candidate — five sub-scores, evidence, source citations.
4. The "This sponsor is wrong" path. She uses it once during the call. **The system writes a receipt in real time.** Bubba shows her the receipt in the admin view.
5. The Strategic Breakthrough Award eligibility flag on the one profile that qualifies.
6. The receipts ledger and Merkle root from the bottom of the admin view.

The single demo move that closes the call: **point at the receipt for her own disagreement, written 90 seconds prior, and say: "Every signal from your office is captured, attributable, and replayable. This is what ART learning looks like underneath."**

### Day 7 — The recap and the ask
Bubba sends a short note:

> Director Sims — recap of where we landed. Your feedback on profiles 2 and 3 has already updated the priority-alignment weights for those components; the calibration receipts are in the system if your team wants to audit. Three asks: (1) Would you forward this to two Phase II awardees you trust for a 30-day extended pilot? (2) Would your office consider sharing public source-doc lists (modernization priority refreshes) so the seed library reflects current intent? (3) Is there a formal channel to discuss whether this lens belongs adjacent to DSIP or in a separate access pattern? — Bubba

### Why this pilot is genuinely simple
- **No accounts, no auth flow.** Pre-issued tokens.
- **No fresh data work.** Four profiles seeded; SBIR.gov and SAM.gov fixtures cover the demo.
- **No deployment risk.** Render primary, local-mirror fallback.
- **No proposal-writing scope creep.** The pilot is purely about *whether the matching logic is credible to the program owner.*
- **The deliverable is a calibrated system, not a slide deck.** Every interaction the director has with the system becomes training data — the system is more capable on Day 7 than Day 0, and that fact is auditably true.

### Success criteria (binary, evaluable)
| Question | Yes signal |
|---|---|
| Did the director engage with the dashboard at all (token used)? | `demo_token_used_receipt` for her account exists. |
| Did she give structured feedback? | At least one `art_match_disagreement_receipt` from her account. |
| Did she ask a follow-up question on the call? | Yes/no, captured in `docs/PILOT_NOTES.md` post-call. |
| Did she agree to forward to ≥1 Phase II awardee? | Yes/no, captured. |
| Did her team audit the receipt chain? | Optional bonus — `GET /api/receipts` request from her IP. |

3 of 5 = the pilot is delivering. 4+ = expand to the 30-day extended pilot.

### What this is NOT
This is not a pitch deck. This is not a procurement conversation. This is a focused test of whether the matching logic earns the right to a procurement conversation.

---

## §14 — VERIFICATION COMMANDS

```bash
# Boot
npm install
npm run db:migrate
npm run seed                       # loads components, priorities, sponsors, demo accounts, calibration cases
npm run dev

# Gates
bash gates/gate_t2h.sh
bash gates/gate_t24h.sh
bash gates/gate_t48h.sh

# Calibration
npm run calibrate                  # runs all 12 cases (8 topic + 4 ART)

# Anonymizer fuzz
npm run test:anonymizer

# Demo token mint
node scripts/issue_demo_token.js --tenant gina_sims_review --ttl 30d
# Output: a URL to send

# Local mirror (Render fallback)
npm run demo:local

# Receipt chain integrity
node scripts/verify_chain.js       # asserts parent_hash chain + Merkle root match

# Deployed smoke
TEST_URL=https://dsip-sniper.onrender.com npm run smoke
```

---

## §15 — VISUAL DESIGN (DEMO_STEALTH_BOMBER, ART EXTENSION)

Unchanged from v1, with these v2 additions:

- The ART Match card uses the same matte-black/bone-white/amber-for-score discipline.
- Match score band uses three colors only: amber (Strong, ≥75), bone (Promising, 50–74), gray (Weak, <50). Red is reserved for closing deadlines and "This sponsor is wrong" feedback confirmation.
- The animation hero shifts from "Component Pulse ticker" (cut in v2) to the **ART Match score reveal** — five horizontal sub-score bars filling staggered, then the composite score counting up. This is the demo's emotional climax.
- No green anywhere. Success is muted gray.

---

## §16 — WHAT NOT TO BUILD (v2 EXPLICIT EXCLUSIONS)

In addition to v1's exclusions:

17. **No auto-emailing or auto-messaging of program managers from the system.** Surface PM names from public award data only.
18. **No TTA drafting or templating.** The director's office writes the TTA. The system identifies the sponsor.
19. **No POM line-item lookup.** POM is sensitive. We do not touch it.
20. **No classified or CUI data ingestion or display.**
21. **No L1 score application in v0.1.** L1 patterns are captured and visible in admin; they do not modify topic scores or ART match scores until v0.3 when calibration loop is ready.
22. **No L2 user UI in v0.1.** Receipt schema reserved.
23. **No sponsor scoring without a public source citation.** Strong tier (≥75) requires at least one citable signal in the last 90 days.
24. **No mobile.** Desktop + projector only.
25. **No paid services beyond Render and email-sender (if magic link gets used by Bubba).** No LLM API at runtime.

---

## §17 — WHAT CHANGED FROM v1 (SOURCE CITATIONS)

| Change | Source |
|---|---|
| ART Transition Match module added | DoW press release 2026-04-20, war.gov; ART program overview at wisconsinctc.org/2026/04/20; insidegovernmentcontracts.com 2026-04 analysis |
| Strategic Breakthrough Award eligibility flag | Public Law 119-83, §3; keepyourequity.co AFWERX/SpaceWERX summary 2026-04-29 |
| Space Force routed as own component | airandspaceforces.com Jan 2026 Space Force acquisition concerns; DAF FY26 Posture Statement |
| Component priorities seeded from public posture statements | DAF FY26 Posture Statement; grantedai.com DOD restart analysis 2026 |
| L1 reduced to data capture only with k≥5 | Internal red team — small-N re-identification risk |
| Pre-issued demo tokens instead of magic link for pilot | UX optimization for director audience |
| Local-mirror fallback mode | Operational risk reduction for live demo |
| 12 calibration cases (8 topic + 4 ART) | Calibration breadth, anti-bias |
| Demo script tightened to 5 min with single wow moment | Attention budget of executive audience |

---

## §18 — OPEN QUESTIONS FOR BUBBA (RESOLVE BEFORE T+24h)

1. **Public-facing name.** "DSIP Sniper · ART Edition" is the working name. Alternatives: "ART Lens," "Transition Compass," "Sponsor Sniper." Bubba decides.
2. **Director's actual name and office.** If not Gina Sims, who? The pilot playbook addresses Gina by name in the day-0 message — adjust before send.
3. **Four demo profile selection.** Bubba chooses which 4 anonymized Phase II awardees to seed. Recommend 1 each from Army, Space Force, DARPA, AFWERX. Real public award data only.
4. **Pilot send timing.** When does Bubba want to send the day-0 link? T+48h is the build target, not the send date. Confirm.
5. **SAM.gov API key status.** v1 audit noted Bubba's SAM key lacks Contract Opportunities API access. Does the same apply to sources-sought endpoints? If yes, fixture is the demo path; document the gap so the director knows it's an external blocker, not a code gap.
6. **Sponsor registry expansion.** Initial ~30 sponsors. Does Bubba have a target list to add? (PEOs the director's office shepherds most actively?)
7. **k-anonymity threshold.** Default 5. Director may prefer higher for component-level patterns. Confirm.
8. **External legal review of "ART Match" framing.** Before send: is the term "match" acceptable, or should it be "candidate sponsor"? Jim Haugen / Danny review for naming risk.

---

## §19 — STRATEGIC POSITIONING (FOR BUBBA, NOT CLAUDE CODE)

ART is the director's program. ART's hardest problem is sponsor matching. No tool today solves it systematically. A small, focused, receipts-native pilot that demonstrates credible matches across four real Phase II awardees — with every recommendation traceable to a public source — is the single most valuable artifact you can put in front of her.

Three things this MVP must prove:

1. **The matching logic earns trust.** When the director clicks a match, the Why panel must show evidence she'd accept from her own staff. If the evidence is thin, the score is capped at "Promising." Honesty about uncertainty is the credibility move.
2. **The system learns from her in real time.** The single most powerful demo moment is pointing at the receipt for her own disagreement, written 90 seconds earlier. This is what ART learning looks like underneath — and it requires no v0.3 features. It is already there.
3. **The architecture sits alongside DSIP cleanly.** Every topic links out to DSIP. Every sponsor links out to SAM.gov. Every claim cites a public source. We are not competing with the portal. We are providing the lens she needs to run her program.

The Three Laws hold. No receipt → not real. No test → not shipped. No gate → not alive.

---

**Hash of this document:** `COMPUTE_ON_SAVE`
**Version:** 0.2 (supersedes 0.1)
**Status:** READY FOR CLAUDE CODE EXECUTION

*ART is technology pull. The hardest pull is finding the puller. Build the lens that finds the pullers, and put a receipt on every match.*