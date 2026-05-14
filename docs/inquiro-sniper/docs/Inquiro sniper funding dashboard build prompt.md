# INQUIRO SNIPER FUNDING DASHBOARD
## Build Prompt for Claude Cowork

**Author:** Claude (meta-strategic command layer)
**Date:** 2026-05-05
**Purpose:** Complete build specification for an automated funding opportunity discovery, scoring, and recommendation system. This document gives Cowork everything needed to build, deploy, and operate the system. Cowork has access to CLAUDEME.md but no other Inquiro context. Everything required is in this document.

**Governing principle:** No receipt → not real. No test → not shipped. No gate → not alive.

---

## 1. WHAT THIS SYSTEM DOES

One sentence: Automatically discover every non-dilutive funding opportunity globally that Inquiro AI Research Labs could win, score each one for fit, and surface the best ones for human review.

Three functions, one pipeline:

1. **SCRAPE** — Scheduled pulls from five verified funding APIs and four scrapeable portals. Snapshots stored locally. Diffs computed against previous snapshot.
2. **SCORE** — Every opportunity scored against Inquiro's technology capabilities and strategic priorities. Output: ranked list with fit scores and rationale.
3. **SURFACE** — Dashboard showing scored opportunities alongside raw diffs. Human reviews, flags winners, dismisses non-fits.

The system does NOT write proposals. It tells the founder which proposals to write.

---

## 2. THE COMPANY AND ITS TECHNOLOGY

Inquiro AI Research Labs Inc. is a Delaware C-Corp building Receipts-Native Architecture (RNA): a cryptographic decision provenance layer for autonomous AI systems. Solo founder, 100% equity, self-funded, no prior federal awards, first-time SBIR applicant.

### 2.1 What We Build (score FOR these)

- **Receipts-native processing:** Every computational step emits a cryptographically verifiable receipt as a first-class output (not a log). Dual-hash: SHA-256 + BLAKE3. Merkle lineage.
- **Hierarchical orchestration:** Six specialized teams (Integrity, Health, Correlation, Topology, Downlink, Compliance), 18 specialists, central orchestrator. Every operation receipted.
- **Zero-trust enforcement:** Declarative policy gate (OPA). Per-operation gating. Cryptographic agent identity (HMAC). Denial receipting.
- **Multi-source evidence triangulation:** Three channels (agent self-report, external telemetry, third-party attestation). Convergence/divergence detection.
- **Sandboxed AI/ML evaluation:** Cascade framework. Shadow → limited production → full production. Every evaluation receipted.
- **Multi-dimensional entropy analysis:** Four dimensions (temporal, spatial, sequential, compression). Context-specific baselines. Anomaly detection.
- **Offline/denied-environment operation:** No cloud dependency. No consensus. Compute-local verification.
- **Data sovereignty:** Per-operation classification, export control, coalition partition enforcement.

### 2.2 What We Don't Build (score AGAINST these)

- Hardware (sensors, satellites, radios, batteries, materials, optics)
- Networking infrastructure (routers, switches, RF systems, antennas)
- Chemical/biological/nuclear detection or protection
- Manufacturing processes or materials science
- Medical devices, pharmaceuticals, or biotech
- Propulsion, energy generation, or power systems
- Kinetic weapons or munitions

### 2.3 Key Facts for Scoring

- Patent: Non-provisional filed March 2026, under examination
- Maturity: 60+ private repos, working prototype deployed, defense prime sandbox validation
- Registration: SAM.gov (All Awards), NAICS 541715/541511/541519
- Awards: Zero prior SBIR/STTR (first-time applicant)
- Team: Solo founder, US citizen
- Location: Redmond, WA (no relocation)

---

## 3. DATA SOURCES — VERIFIED, WITH API SPECIFICATIONS

### SOURCE 1: DoD SBIR/STTR (API — no auth required)

**What it covers:** All Department of Defense SBIR and STTR topics across Army, Air Force, Space Force, Navy, DARPA, SOCOM, DTRA, MDA, CBD, DMEA.

**Base URL:** `https://api.www.sbir.gov/public/api/solicitations`

**Parameters:**
```
keyword    — string, searches topic descriptions
agency     — string: DOD, HHS, NASA, DOE, USDA, DOC, ED, DOT, DHS, NSF, EPA
open       — 1 (open only)
closed     — 1 (closed only)
rows       — int, max 50 per request
start      — int, pagination offset
```

**Response → solicitation object:**
```
solicitation_title, solicitation_number, program, phase, agency, branch,
solicitation_year, release_date, open_date, close_date,
application_due_date[], current_status, solicitation_topics[]
```

**Response → topic object (nested):**
```
topic_title, branch, topic_number, topic_description,
sbir_topic_link, subtopics[]
```

**Scrape config:** Pull `agency=DOD` with `open=1` daily. Paginate with `start` offset until no more results. Also pull `agency=NASA`, `agency=DHS`, `agency=DOE` for cross-agency coverage.

**Rate limit:** No documented limit. Use 1 request/second.

---

### SOURCE 2: SAM.gov Contract Opportunities (API — free key required)

**What it covers:** ALL federal contract opportunities including BAAs (Broad Agency Announcements), RFIs, Sources Sought, and contract solicitations. This catches non-SBIR opportunities like AFRL Extreme Computing BAA ($109M), DIU Commercial Solutions Openings, and any BAA posted by any federal agency.

**Registration:** Get a free API key at `https://api.data.gov/signup/`

**Base URL:** `https://api.sam.gov/opportunities/v2/search`

**Key parameters:**
```
api_key        — required, from api.data.gov
keyword        — string, searches title and description
naics           — string, NAICS code filter
postedFrom     — date (MM/dd/yyyy), start of date range
postedTo       — date (MM/dd/yyyy), end of date range
limit          — int, results per page (max 1000)
offset         — int, pagination
ptype          — opportunity type filter:
                 o = solicitation
                 p = presolicitation
                 r = sources sought
                 s = special notice
                 k = combined synopsis/solicitation
noticeType     — string filter (same as ptype but named differently in some versions)
```

**Response fields:**
```
noticeId, title, solicitationNumber, department, subtier, office,
postedDate, type, baseType, archiveType, archiveDate,
responseDeadLine, naicsCode, classificationCode,
description (full text via separate endpoint),
organizationType, officeAddress, placeOfPerformance,
pointOfContact[], links[]
```

**NAICS codes to monitor (6 total):**
```
541715  — R&D in Physical, Engineering, and Life Sciences
         (primary — matches SBIR R&D classification)
541511  — Custom Computer Programming Services
         (primary — software development)
541519  — Other Computer Related Services
         (primary — AI/ML services, cybersecurity consulting)
541512  — Computer Systems Design Services
         (adjacent — systems integration, architecture design)
541330  — Engineering Services
         (adjacent — catches defense engineering BAAs)
518210  — Computing Infrastructure Providers, Data Processing
         (adjacent — cloud/edge compute, hosting)
```

**Scrape config:** Daily pull for each NAICS code with `postedFrom` = yesterday. Also run keyword searches for: `autonomous systems`, `data fusion`, `zero trust`, `AI governance`, `decision provenance`, `cryptographic`, `audit trail`. Deduplicate by `noticeId`.

**CRITICAL — Two-step fetch required for accurate scoring:** The search endpoint returns truncated or empty `description` fields. The full opportunity text (where all scoring keywords live) requires a second fetch per opportunity via `https://api.sam.gov/opportunities/v2/{noticeId}?api_key=YOUR_KEY`. This is especially true for BAAs and Sources Sought, which are the highest-value SAM catches. The scoring engine MUST use the full-text response, not the search summary. Budget the extra API calls into the daily scrape — at 10 req/sec you have headroom even for 200+ opportunities per day.

**Rate limit:** 10 requests/second with API key.

---

### SOURCE 3: Grants.gov (API — no auth required)

**What it covers:** All federal grants across all agencies. Catches NSF SBIR/STTR, DOE grants, DHS grants, and any non-SBIR grant vehicle.

**Base URL:** `https://api.grants.gov/v1/api/search2`

**Method:** POST with JSON body

**Request body:**
```json
{
  "keyword": "autonomous systems",
  "oppStatuses": "forecasted|posted",
  "sortBy": "openDate|closeDate",
  "rows": 25,
  "oppStartDateFrom": "MM/dd/yyyy",
  "oppStartDateTo": "MM/dd/yyyy"
}
```

**Response fields:**
```
id, number, title, agency, openDate, closeDate,
opportunityCategory, fundingInstrumentTypes,
categoryOfFundingActivity, additionalInformationUrl,
synopsis (summary text)
```

**Full opportunity details:** `https://api.grants.gov/v1/api/fetchOpp?oppId={id}`

**Keywords to search (rotate daily across these):**
```
"autonomous systems governance"
"AI verification"
"cryptographic audit"
"zero trust"
"data fusion"
"decision accountability"
"trustworthy AI"
"cybersecurity R&D"
```

**IMPORTANT — Phrase matching quirk:** The `search2` endpoint behaves differently with quoted vs. unquoted phrases. Test `"decision provenance"` (exact phrase) vs `decision provenance` (any-word match) in Phase 0 before building the rotation logic. Start with unquoted keywords for broader coverage, then tighten with exact phrases only where unquoted returns too much noise.

**Scrape config:** Daily pull using keyword rotation. Filter to `oppStatuses=posted`. Deduplicate by `number`.

**Rate limit:** No documented limit. Use 1 request/second.

---

### SOURCE 4: NSF SBIR/STTR (page scrape)

**What it covers:** NSF-specific SBIR/STTR topics, Project Pitch windows, BAA appendices. NSF runs on a different cycle than DoD and uses a Project Pitch gateway before full proposals.

**URL to scrape:** `https://seedfund.nsf.gov/topics/`

**What to extract:**
- Topic titles and descriptions
- Current submission windows (open/closed/upcoming)
- Project Pitch deadlines
- BAA appendix release dates

**Key topic for Inquiro:** `AI7: Technologies for Trustworthy AI` — direct fit for RNA as trustworthy AI infrastructure.

**Scrape config:** Weekly (NSF changes slowly). Parse the topics page for open/upcoming topics. Diff against previous week.

**Fallback:** NSF opportunities also appear in Grants.gov (Source 3), so this source provides more granular NSF-specific detail.

---

### SOURCE 5: UK DASA (page scrape — currently CLOSED, reopens July 2026)

**What it covers:** UK Ministry of Defence innovation grants. Open Call for Innovation accepts proposals from US companies. Two categories: Emerging Innovations (£50K-£100K, TRL 3-4) and Rapid Impact (£200K-£350K, TRL 6-7). Zero equity taken.

**URL to monitor:** `https://www.gov.uk/government/organisations/defence-and-security-accelerator`
**Apply for funding page:** `https://www.gov.uk/guidance/apply-for-funding-from-the-defence-and-security-accelerator`
**Submission portal:** `https://ecs.dasa.service.mod.uk/` (requires account)

**Current status:** CLOSED. Transitioning to UK Defence Innovation (UKDI). Reopening prior to July 2026 Full Operating Capability. The dashboard should monitor the GOV.UK page for reopening announcements.

**Scrape config:** Weekly check of the apply-for-funding page. Flag any new competition or cycle announcement. This is a WATCH source until it reopens.

---

### SOURCE 6: NATO DIANA (page scrape — annual challenge calls)

**What it covers:** NATO Defence Innovation Accelerator. Challenge-based calls 1-2 times per year. Themes typically include autonomy, AI, data, cyber.

**URL to monitor:** `https://diana.nato.int/`
**Challenges page:** `https://diana.nato.int/challenges/`

**Scrape config:** Monthly check of challenges page. DIANA calls are infrequent but high-value (€200K-€400K). Flag any new challenge announcement. Expected next call: mid-2026.

---

### SOURCE 7: DIU Commercial Solutions Openings (page scrape)

**What it covers:** Defense Innovation Unit rapid prototype contracts. Commercial rates, OTA authority. DIU moves in months, not years. Relevant areas: autonomy, AI, space, cyber.

**URL to monitor:** `https://www.diu.mil/solutions`
**Active CSOs:** Listed on the solutions page with submission links.

**Scrape config:** Weekly check. Parse for new CSOs. Each CSO has a title, description, and submission link. Score against Inquiro capabilities.

---

### SOURCE 8: SpaceWERX (page scrape)

**What it covers:** Space Force-specific innovation accelerator. SBIR, STTR, Primes, STRATFI, Tacticals.

**URL to monitor:** `https://spacewerx.us/what-we-fund/`

**Scrape config:** Weekly check. Parse for new opportunities. SpaceWERX opportunities also appear in SBIR.gov (Source 1) but this page surfaces them earlier and with more context.

---

### SOURCE 9: AFWERX (page scrape)

**What it covers:** Air Force innovation accelerator. Open Topics, Specific Topics, Primes, STRATFI.

**URL to monitor:** `https://afwerx.com/divisions/sbir-sttr/`
**Get funded page:** `https://afwerx.com/get-funded/`

**Scrape config:** Weekly check. AFWERX opportunities also appear in SBIR.gov but this page shows upcoming topics before they hit DSIP.

---

## 4. UNIFIED DATA MODEL

All sources normalize into one common format:

```typescript
interface Opportunity {
  // Identity
  id: string                    // source-specific ID
  source: Source                // which API/scrape produced this
  source_url: string            // direct link to the opportunity
  
  // Content
  title: string
  description: string           // full text for scoring
  agency: string                // e.g., "DOD", "NSF", "UK MOD"
  sub_agency: string            // e.g., "Space Force", "DARPA", "DASA"
  program: string               // e.g., "SBIR", "STTR", "BAA", "CSO", "Open Call"
  phase: string                 // e.g., "Phase I", "D2P2", "Open", "N/A"
  naics_codes: string[]
  keywords: string[]
  
  // Timeline
  posted_date: string           // ISO date
  open_date: string
  close_date: string            // null if rolling/always-open
  is_rolling: boolean           // true if no fixed deadline
  days_remaining: number | null
  
  // Funding
  funding_min: number | null
  funding_max: number | null
  currency: string              // "USD", "GBP", "EUR"
  
  // Scoring (enriched by scoring engine)
  fit_score: number             // 0-100
  ai_score: number | null
  ai_rationale: string | null
  score_tier: "SNIPER" | "EVALUATE" | "STRETCH" | "SKIP"
  divergence_flag: boolean      // true if keyword and AI scores differ by 20+
  
  // User state
  dismissed: boolean
  dismissed_at: string | null
  added_to_pipeline: boolean
  pipeline_status: string | null
  notes: string | null
  
  // Metadata
  first_seen: string            // ISO timestamp
  last_updated: string
  snapshot_id: string
}

type Source = 
  | "sbir_gov"
  | "sam_gov" 
  | "grants_gov"
  | "nsf_seedfund"
  | "dasa_uk"
  | "diana_nato"
  | "diu"
  | "spacewerx"
  | "afwerx"

interface DailyDiff {
  date: string
  source: Source
  new_opportunities: Opportunity[]
  closed_opportunities: Opportunity[]
  changed_opportunities: {
    id: string
    field: string
    old_value: string
    new_value: string
  }[]
  closing_soon: Opportunity[]     // < 14 days
  deadline_warnings: Opportunity[] // < 7 days
}

interface PipelineItem {
  id: string
  opportunity_id: string
  title: string
  source: Source
  status: "watching" | "drafting" | "in_review" | "submitted" | "awarded" | "rejected"
  deadline: string | null
  funding_amount: number | null
  notes: string
  created_at: string
  updated_at: string
}
```

---

## 5. SCORING ENGINE

### 5.1 Five Weighted Dimensions

#### Dimension 1: Core Technology Alignment (40%)

**Tier A keywords (10 pts each, cap 40):**
`data fusion verification`, `decision provenance`, `cryptographic verification`, `zero trust enforcement`, `audit trail`, `AI governance`, `autonomous decision accountability`, `data integrity verification`, `chain of custody`, `tamper detection`, `evidence-grade`, `verifiable AI`, `reproducible`, `attestation`, `trustworthy AI infrastructure`

**Tier B keywords (5 pts each, cap 20):**
`multi-source fusion`, `heterogeneous data`, `sensor fusion`, `anomaly detection`, `threat detection`, `data sovereignty`, `access control`, `sandbox evaluation`, `AI/ML evaluation`, `edge computing`, `denied environment`, `DDIL`, `intermittent connectivity`, `offline operation`, `multi-level security`, `coalition operations`

**Tier C keywords (2 pts each, cap 10):**
`cybersecurity`, `data analytics`, `machine learning`, `artificial intelligence`, `autonomous systems`, `compliance`, `monitoring`, `logging`, `telemetry`, `provenance`

**Disqualifier keywords (score = 0, skip):**
`battery`, `propulsion`, `antenna design`, `RF hardware`, `chemical detection`, `biological agent`, `pharmaceutical`, `manufacturing process`, `materials science`, `optics fabrication`, `kinetic`, `munitions`, `radar hardware`, `power generation`, `respirator`, `vaccine`, `deorbit`, `infrared sensor hardware`

Normalize to 0-100 by: `min(100, (sum of keyword points / 40) * 100)`

#### Dimension 2: Domain Alignment (25%)

**Tier 1 (100%):** Space / pLEO / constellation / SDA / PWSA / BMC3, Autonomous aviation / UAS / BVLOS / drone, Autonomous weapons systems / DoDD 3000.09, Command and control / C2 / kill chain, Evidence / forensic / after-action review / FRE 901, AI agent governance / AI safety infrastructure

**Tier 2 (75%):** Logistics / supply chain / in-transit visibility, Intelligence / ISR / multi-INT fusion, Cyber operations / network defense, Maritime autonomous systems

**Tier 3 (50%):** Enterprise IT / cloud security, Test and evaluation, Training and simulation

**Disqualified (0%):** Hardware-only, chemical/bio/nuclear, medical, manufacturing, propulsion

#### Dimension 3: Submission Type Fit (15%)

| Type | Score | Rationale |
|------|-------|-----------|
| D2P2 (Direct to Phase II) | 100% | We have feasibility evidence from sandbox |
| Open Topic (AFWERX/SpaceWERX) | 95% | No topic-matching, open scope |
| BAA / White Paper | 90% | Rolling submission, less competitive pressure |
| DIU CSO | 85% | Commercial rates, OTA, fast timeline |
| Phase I (specific topic) | 80% | Standard path, competitive |
| DASA Open Call | 75% | International, different format, reopening July 2026 |
| NATO DIANA Challenge | 70% | Annual, competitive, multi-national |
| STTR | 30% | Requires university partner we don't have |
| Phase II (requires Phase I) | 0% | No prior Phase I awards |
| Grant requiring match funding | 20% | We have no revenue to match |

#### Dimension 4: Timeline Feasibility (10%)

| Condition | Score |
|-----------|-------|
| Rolling / always open | 100% |
| 30+ days to deadline | 100% |
| 21-30 days | 80% |
| 14-21 days | 60% |
| 7-14 days | 30% |
| < 7 days | 10% |
| Already closed | 0% |

#### Dimension 5: Funding Efficiency (10%)

| Funding range | Score |
|---------------|-------|
| $750K - $2M (D2P2 / Phase II sweet spot) | 100% |
| $250K - $749K (strong Phase I / small BAA) | 90% |
| $50K - $249K (Phase I / DASA emerging) | 70% |
| $2M+ (large BAA, high competition) | 60% |
| < $50K (not worth proposal effort) | 20% |
| Unknown | 50% |

### 5.2 Final Score

```
final_score = (
  tech_alignment * 0.40 +
  domain_alignment * 0.25 +
  submission_type * 0.15 +
  timeline * 0.10 +
  funding_efficiency * 0.10
)
```

### 5.3 Score Tiers

| Score | Tier | Color | Action |
|-------|------|-------|--------|
| 80-100 | SNIPER | Green | Review immediately. High-confidence fit. |
| 60-79 | EVALUATE | Amber | Worth reading. May need angle development. |
| 40-59 | STRETCH | Gray | Weak fit. Only if pipeline is empty. |
| 0-39 | SKIP | Hidden | Not a fit. Don't waste time. |

### 5.4 AI Enhancement (optional, Phase 4)

For SNIPER and EVALUATE opportunities only (controls API cost), pass the description plus Section 2 capabilities to an LLM:

```
Given this funding opportunity and this company's capabilities,
rate fit 0-100 and explain in 2-3 sentences. Be specific about
which capabilities map to which requirements. If it's a stretch, say so.
```

When keyword score and AI score diverge by 20+, flag for human review.

### 5.5 Calibration Data

Use these real opportunities to validate scoring accuracy:

| Opportunity | Expected Tier | Expected Score | Why |
|------------|---------------|----------------|-----|
| SF254-D1204: Secure Multi-Source Data Fusion for pLEO | SNIPER | 95 | Direct fit: data fusion, zero-trust, AI/ML sandbox, pLEO, SDA |
| AFWERX Open Topic (CHORD equiv) | SNIPER | 85 | Open topic, autonomous systems governance |
| SF25D-T1201: Adaptive and Intelligent Space | EVALUATE | 65 | Good tech fit but STTR = needs university partner |
| AFRL Extreme Computing BAA | EVALUATE | 70 | Edge AI fits, but broad BAA with high competition |
| NSF AI7: Trustworthy AI | EVALUATE | 72 | Strong topic fit, different agency, Project Pitch gateway |
| DIU Autonomy CSO (if active) | SNIPER | 82 | Commercial rates, autonomy domain, OTA speed |
| A254-049: Ka-Band Radar | SKIP | 5 | Hardware-only |
| CBD254-005: Respirators | SKIP | 0 | Completely unrelated |

If the engine does not produce approximately these scores, the weights need tuning.

---

## 6. DASHBOARD SPECIFICATION

### 6.1 Three-Panel Layout

**Left Panel: Pipeline Tracker**
- Items manually added from scored opportunities
- Status: Watching → Drafting → In Review → Submitted → Awarded / Rejected
- Deadline countdown for each (red < 7 days, amber < 14 days)
- Funding amount (if known)
- Link to source portal
- Notes field

**Center Panel: Scored Opportunities**
- Default: SNIPER and EVALUATE only
- **Empty-state behavior:** When zero SNIPERs exist in the current view, automatically show the top 3 EVALUATE items. If zero EVALUATEs exist either, show a "No high-fit opportunities today — last SNIPER was [date]" message with a link to expand filters. The dashboard should never show an empty center panel — an empty panel makes the tool feel broken on quiet days, which are most days.
- Toggle to show all tiers
- Each card shows:
  - Source badge (SBIR, SAM, Grants.gov, NSF, DASA, DIANA, DIU, SpaceWERX, AFWERX)
  - Title
  - Agency / sub-agency / branch
  - Program type and phase
  - Open date / close date / days remaining (or "Rolling")
  - Funding range
  - Fit score with tier badge
  - AI score (if available) with rationale tooltip
  - Divergence flag if scores differ by 20+
  - "Add to Pipeline" button
  - "Dismiss" button (hidden 90 days)

**Right Panel: Diff Feed**
- Chronological feed of changes across all sources
- New opportunities: green highlight
- Closing soon (< 14 days): amber highlight
- Closed/withdrawn: gray strikethrough
- Changed: field-level diff (old → new)
- Source badge on each entry
- Default: last 7 days. Expandable to 30.

### 6.2 Filters

- Source: checkboxes for all 9 sources
- Agency: DOD, NASA, NSF, DOE, DHS, UK MOD, NATO
- Branch: Air Force, Space Force, Army, Navy, DARPA, SOCOM, SDA, DIU, etc.
- Program: SBIR, STTR, BAA, CSO, Open Call, Grant
- Phase: Phase I, D2P2, Open, Rolling
- Score: slider 0-100
- Deadline: "closing within N days" slider
- Funding: min/max range

### 6.3 Daily Digest Notification

Generate at 07:00 UTC after all scrapes complete:

```
INQUIRO SNIPER DAILY BRIEF — [DATE]

━━━ NEW OPPORTUNITIES ━━━
[count] new across [sources]
🟢 SNIPER: [list with score, source, deadline]
🟡 EVALUATE: [list with score, source, deadline]

━━━ DEADLINE WARNINGS ━━━
🔴 < 7 DAYS: [list]
🟡 < 14 DAYS: [list]

━━━ PIPELINE STATUS ━━━
[active items with status and days to deadline]

━━━ SOURCE STATUS ━━━
DASA: CLOSED (reopens ~July 2026)
DIANA: No active challenge (next expected mid-2026)
[any source errors or connectivity issues]
```

Delivery: Display as pinned card at top of dashboard. Email integration optional (use any SMTP provider if desired).

---

## 7. SCRAPE SCHEDULE

| Source | Frequency | Time (UTC) | Method |
|--------|-----------|------------|--------|
| DoD SBIR/STTR | Daily | 05:00 | API call |
| SAM.gov | Daily | 05:15 | API call (key required) |
| Grants.gov | Daily | 05:30 | API call |
| NSF Seedfund | Weekly (Monday) | 06:00 | Page scrape |
| DIU | Weekly (Monday) | 06:15 | Page scrape |
| SpaceWERX | Weekly (Monday) | 06:30 | Page scrape |
| AFWERX | Weekly (Monday) | 06:45 | Page scrape |
| DASA | Weekly (Monday) | 07:00 | Page scrape (watch mode) |
| NATO DIANA | Monthly (1st) | 07:15 | Page scrape (watch mode) |

All scrapes complete before 07:00 UTC daily digest generation (weekly sources only run on their scheduled day).

---

## 8. TECH STACK

Free and open source first:

- **Runtime:** Node.js (matches CLAUDEME stack preference for TypeScript adapters)
- **HTTP client:** `node-fetch` or `axios` (free)
- **HTML scraping:** `cheerio` (free, lightweight, no headless browser needed) for most sources. **RISK: AFWERX and SpaceWERX use JavaScript-rendered content in some sections that `cheerio` alone won't catch.** Test both sites in Phase 1. If opportunity listings don't appear in raw HTML, add `playwright` (free, headless Chromium) as a fallback for those two sources specifically. Do not use Playwright for all sources — it's heavier and slower than cheerio for sites that serve static HTML.
- **Storage:** SQLite via `better-sqlite3` (free, single file, no server)
- **Scheduling:** `node-cron` (free) or system crontab
- **Dashboard:** Single-page React app or plain HTML + vanilla JS
- **Email (optional):** `nodemailer` with any SMTP provider

No paid services required. No database server. Runs on a single machine or a free-tier Render/Railway deployment.

---

## 9. DEPLOYMENT SEQUENCE

### Phase 0: Core Scraper (ship first, test immediately)
1. Implement SBIR.gov API client (no auth, easiest)
2. Implement snapshot storage in SQLite
3. Implement diff engine
4. Run first scrape. Verify data matches sbir.gov website.
5. Run second scrape next day. Verify diff correctness.
6. **Gate:** Diffs correctly identify new/closed/changed topics.

### Phase 1: Multi-Source Expansion
1. Add SAM.gov API client (requires API key from api.data.gov)
2. Add Grants.gov API client
3. Add page scrapers for NSF, DIU, SpaceWERX, AFWERX
4. Add watch-mode scrapers for DASA and DIANA
5. Normalize all sources into unified Opportunity format
6. Deduplicate across sources (same opportunity may appear in SBIR.gov AND SAM.gov)
7. **Gate:** All 9 sources producing normalized data. Deduplication working.

### Phase 2: Scoring Engine
1. Implement keyword scoring per Section 5
2. Score all opportunities from latest snapshot
3. Validate against calibration data (Section 5.5)
4. Tune weights if calibration fails
5. **Gate:** Calibration opportunities produce correct tier assignments.

### Phase 3: Dashboard
1. Build three-panel layout
2. Wire to scored data
3. Implement filters
4. Implement pipeline tracking
5. Implement dismiss functionality
6. Implement daily digest
7. **Gate:** Dashboard displays scored opportunities. Pipeline tracking works. Digest generates correctly.

### Phase 4: AI Enhancement (optional)
1. Add LLM API call for SNIPER + EVALUATE opportunities only
2. Display AI rationale alongside keyword score
3. Implement divergence flagging
4. **Gate:** AI scores correlate with keyword scores. Divergence flags fire correctly.

---

## 10. ACCEPTANCE CRITERIA

System is done when:

1. [ ] Daily scrapes run automatically for all API sources
2. [ ] Weekly scrapes run for all page-scrape sources
3. [ ] All opportunities normalized into unified format
4. [ ] Cross-source deduplication working
5. [ ] Diffs correctly identify new, closed, changed, and closing-soon opportunities
6. [ ] Every opportunity has a fit score with correct tier assignment
7. [ ] Calibration data produces expected tier assignments (Section 5.5)
8. [ ] Dashboard displays scored opportunities with all filters functional
9. [ ] Pipeline tracking works (add, update status, view deadline, notes)
10. [ ] Dismissed opportunities stay hidden for 90 days
11. [ ] Daily digest generates correctly
12. [ ] DASA and DIANA in watch mode (flag reopening only)
13. [ ] First real scrape produces at least one SNIPER result
14. [ ] Feedback loop captures outcome data on every pipeline item (Section 10A)
15. [ ] Scoring calibration runs after every 5 terminal outcomes (Section 10A.3)

---

## 10A. FEEDBACK, OPTIMIZATION, AND LEARNING LOOP

The scoring engine starts with hardcoded weights and keyword lists. Over time, it must learn from actual outcomes. This section specifies how.

### 10A.1 Outcome Data Model

Every pipeline item that reaches a terminal status produces an outcome record:

```typescript
interface OutcomeRecord {
  // Identity
  id: string
  opportunity_id: string
  pipeline_id: string
  
  // Original scoring snapshot (frozen at time of pipeline entry)
  original_score: number
  original_tier: string
  original_tech_alignment: number
  original_domain_alignment: number
  original_submission_type: number
  original_timeline: number
  original_funding_efficiency: number
  ai_score: number | null
  
  // Opportunity metadata (frozen)
  source: Source
  agency: string
  sub_agency: string
  program: string
  phase: string
  topic_number: string
  title: string
  keywords_matched: string[]     // which scoring keywords actually fired
  funding_amount: number | null
  
  // Outcome (captured by user)
  terminal_status: "awarded" | "rejected" | "withdrawn" | "no_response"
  outcome_date: string
  
  // User annotations (captured at outcome time via simple form)
  rejection_reason: string | null   // free text: "too early stage", "wrong domain", etc.
  what_worked: string | null        // free text: "sandbox validation was key differentiator"
  what_failed: string | null        // free text: "budget was too low for D2P2"
  would_submit_again: boolean       // binary: knowing what you know now
  actual_effort_hours: number | null // how long the proposal actually took
  
  // Computed
  score_accuracy: number            // how far off was the score? see 10A.3
  created_at: string
}
```

### 10A.2 Outcome Capture Flow

When a pipeline item status changes to a terminal state, the dashboard prompts for outcome data:

```
┌─────────────────────────────────────────────┐
│  OUTCOME: SF254-D1204 (SNIPER, score: 95)   │
│                                              │
│  Result:  ○ Awarded  ○ Rejected              │
│           ○ Withdrawn  ○ No Response          │
│                                              │
│  If rejected, why? (short):                  │
│  [________________________________]          │
│                                              │
│  What worked in this proposal?               │
│  [________________________________]          │
│                                              │
│  What didn't work?                           │
│  [________________________________]          │
│                                              │
│  Knowing what you know now,                  │
│  would you submit again?  ○ Yes  ○ No        │
│                                              │
│  Hours spent on this proposal: [___]          │
│                                              │
│  [Save Outcome]                              │
└─────────────────────────────────────────────┘
```

This form is mandatory for terminal states. The pipeline item cannot be archived without completing it. This is the training data. Skipping it degrades the entire system.

### 10A.3 Scoring Calibration Engine

After every 5 terminal outcomes (configurable), the system runs a calibration check:

#### Step 1: Score Accuracy Measurement

For each outcome, compute:
```
score_accuracy = {
  if awarded:    original_score    (higher score + win = accurate)
  if rejected:   100 - original_score  (higher score + loss = inaccurate)
  if withdrawn:  null (excluded from calibration)
  if no_response: null (excluded from calibration)
}
```

#### Step 2: Dimension-Level Analysis

Group outcomes by which scoring dimensions were strongest vs. weakest:

```
For each awarded opportunity:
  → Which dimension contributed most to the score?
  → Log: "tech_alignment was the primary driver for wins"

For each rejected opportunity:
  → Which dimension inflated the score most?
  → Log: "domain_alignment scored high but we still lost — domain scoring may be too generous"
```

#### Step 3: Weight Adjustment Recommendations

The system does NOT auto-adjust weights. It produces recommendations that the human reviews:

```
┌─────────────────────────────────────────────────────┐
│  CALIBRATION REPORT — After 10 outcomes             │
│                                                      │
│  Overall accuracy: 72%                               │
│  Win rate: 3/10 (30%)                                │
│                                                      │
│  DIMENSION ANALYSIS:                                 │
│  ✅ tech_alignment: Strong predictor. Wins avg 85,   │
│     losses avg 62. Weight seems correct.             │
│  ⚠️ domain_alignment: Weak predictor. Wins avg 70,  │
│     losses avg 68. Consider reducing weight from     │
│     25% to 20%.                                      │
│  ✅ submission_type: Strong predictor. D2P2 wins     │
│     at 2x rate of Phase I. Weight seems correct.     │
│  ❌ funding_efficiency: Not predictive. Wins and     │
│     losses have same distribution. Consider reducing │
│     weight from 10% to 5% and redistributing.        │
│                                                      │
│  KEYWORD ANALYSIS:                                   │
│  Top keywords in WINS: "data fusion", "zero trust",  │
│    "sandbox", "autonomous"                           │
│  Top keywords in LOSSES: "cybersecurity", "AI/ML",   │
│    "compliance"                                      │
│  Suggestion: Promote "sandbox" from Tier B to Tier A │
│  Suggestion: Demote "compliance" from Tier C to      │
│    disqualifier-adjacent                             │
│                                                      │
│  PATTERN FLAGS:                                      │
│  🔍 Space Force topics win at 2x Army rate           │
│  🔍 D2P2 submissions win at 3x Phase I rate          │
│  🔍 Proposals taking 20+ hours win at higher rate    │
│     than proposals taking <10 hours                  │
│                                                      │
│  [Accept Suggestions] [Dismiss] [Review Manually]    │
└─────────────────────────────────────────────────────┘
```

**"Accept Suggestions" applies the recommended weight changes.** The old weights are logged (append-only weight history) so you can always roll back.

**"Review Manually" opens the weight editor** where you can adjust any dimension weight or move keywords between tiers.

### 10A.4 Weight History (Append-Only)

Every weight change is logged:

```typescript
interface WeightChange {
  id: string
  timestamp: string
  trigger: "calibration" | "manual" | "initial"
  
  // What changed
  dimension: string          // e.g., "domain_alignment"
  old_weight: number
  new_weight: number
  
  // Or keyword tier change
  keyword: string | null
  old_tier: string | null    // e.g., "tier_b"
  new_tier: string | null    // e.g., "tier_a"
  
  // Why
  reason: string             // e.g., "Calibration after 10 outcomes: domain_alignment not predictive"
  outcomes_at_time: number   // how many outcomes existed when this change was made
}
```

This is the system's memory. It answers: "Why do we score things the way we do?" Every weight traces back to either the initial calibration or a data-driven adjustment.

### 10A.5 Lessons Ledger

Beyond scoring, the system captures strategic learnings from outcome annotations. This is a simple append-only text log surfaced in the dashboard:

```typescript
interface LessonEntry {
  id: string
  timestamp: string
  opportunity_id: string
  title: string
  outcome: string
  lesson: string             // synthesized from what_worked + what_failed + would_submit_again
  tags: string[]             // e.g., ["d2p2", "space_force", "budget", "feasibility"]
}
```

**Auto-generated lessons from outcome data:**

When an outcome is recorded, the system generates a lesson entry:

```
If awarded:
  "[title] — WON. [what_worked]. Effort: [hours]h. Score was [score] ([tier])."

If rejected:
  "[title] — LOST. [what_failed]. [rejection_reason]. Would submit again: [yes/no]. Score was [score] ([tier])."

If withdrawn:
  "[title] — WITHDRAWN before submission. Reason: [rejection_reason]. Effort wasted: [hours]h."
```

The lessons ledger is displayed as a collapsible section in the dashboard sidebar. Before submitting a new proposal, the founder can scan recent lessons to avoid repeating mistakes.

### 10A.6 Proposal Effort ROI

The system computes and displays return on effort:

```
For each terminal outcome:
  effort_roi = funding_amount / actual_effort_hours

Across all outcomes:
  avg_hours_per_win = sum(hours for wins) / count(wins)
  avg_hours_per_loss = sum(hours for losses) / count(losses)
  best_roi_source = source with highest (wins / total_hours)
  worst_roi_source = source with lowest (wins / total_hours)
```

Display as a summary card in the dashboard:

```
┌────────────────────────────────────────┐
│  PROPOSAL ROI (lifetime)               │
│                                        │
│  Submitted: 10  |  Won: 3  |  Rate: 30%│
│  Total hours: 280  |  Avg/proposal: 28h│
│  Avg hours per WIN: 35h                │
│  Avg hours per LOSS: 25h               │
│                                        │
│  Best ROI source: Space Force D2P2     │
│    (2 wins, 70h, $3.5M awarded)        │
│  Worst ROI source: Army Phase I        │
│    (0 wins, 60h, $0 awarded)           │
│                                        │
│  $/hour across all wins: $1,250/hr     │
└────────────────────────────────────────┘
```

This tells the founder: "Stop submitting Army Phase Is. Double down on Space Force D2P2s."

### 10A.7 Deployment: Learning Loop Phases

The learning loop ships in stages alongside the main dashboard:

**Phase 3 addition (ships with dashboard):**
- Outcome capture form on terminal pipeline status
- OutcomeRecord storage in SQLite
- Lessons ledger (append-only)
- **Gate:** Outcome form fires on every terminal status change. Lessons auto-generate.

**Phase 5: Calibration Engine (ships after 5+ outcomes)**
- Score accuracy computation
- Dimension-level analysis
- Weight adjustment recommendations
- Weight history log
- **Gate:** Calibration report generates correctly. Weight changes logged. Rollback works.

**Phase 6: ROI Analytics (ships after 10+ outcomes)**
- Effort ROI computation
- Source-level win rate analysis
- Pattern detection across outcomes
- Summary card in dashboard
- **Gate:** ROI numbers compute correctly. Best/worst source identification works.

---

## 11. SOURCE VERIFICATION LOG

All URLs verified as of 2026-05-05:

| Source | URL | Status |
|--------|-----|--------|
| SBIR.gov Solicitations API | `https://api.www.sbir.gov/public/api/solicitations` | ✅ Active, public, no auth |
| SBIR.gov Awards API | `https://api.www.sbir.gov/public/api/awards` | ✅ Active, public, no auth |
| SAM.gov Opportunities API | `https://api.sam.gov/opportunities/v2/search` | ✅ Active, requires free api.data.gov key |
| API key registration | `https://api.data.gov/signup/` | ✅ Active, free |
| SAM.gov API docs | `https://open.gsa.gov/api/get-opportunities-public-api/` | ✅ Active |
| Grants.gov API | `https://api.grants.gov/v1/api/search2` | ✅ Active, public, POST endpoint |
| Grants.gov API docs | `https://api.grants.gov/v1/api-docs/` | ✅ Active |
| NSF Seedfund topics | `https://seedfund.nsf.gov/topics/` | ✅ Active |
| DASA main page | `https://www.gov.uk/government/organisations/defence-and-security-accelerator` | ✅ Active (Open Call CLOSED until July 2026) |
| DASA apply page | `https://www.gov.uk/guidance/apply-for-funding-from-the-defence-and-security-accelerator` | ✅ Active |
| NATO DIANA | `https://diana.nato.int/` | ✅ Active |
| DIANA challenges | `https://diana.nato.int/challenges/` | ✅ Active |
| DIU solutions | `https://www.diu.mil/solutions` | ✅ Active |
| SpaceWERX | `https://spacewerx.us/what-we-fund/` | ✅ Active |
| AFWERX | `https://afwerx.com/divisions/sbir-sttr/` | ✅ Active |
| AFWERX get funded | `https://afwerx.com/get-funded/` | ✅ Active |
| DSIP portal (submission) | `https://www.dodsbirsttr.mil/` | ✅ Active |

---

## 12. FUTURE ENHANCEMENTS (not for initial build)

- **Competitive intelligence:** For SNIPER topics, query SBIR Awards API to find prior winners on similar topics. Surface as "likely competitors."
- **Proposal template generator:** For pipeline items, auto-generate a proposal outline pre-filled with Inquiro standard sections.
- **Multi-agency calendar:** Visual Gantt-style timeline of all upcoming deadlines.
- **Historical win rate analysis:** By agency, branch, and topic area. Inform where Inquiro's odds are best.
- **RSS/Atom feed ingestion:** Some agencies publish opportunity feeds. Add as supplementary sources.