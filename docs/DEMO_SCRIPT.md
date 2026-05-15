# Demo Script — 5 minutes, single wow moment

**Audience:** Director of DoW Office for Small Business Innovation (ART program owner).
**Mode:** Bubba shares screen. Director observes.
**Goal:** The matching logic earns the right to a procurement conversation.
**Doctrine:** No prose narration is built in; the script structure below is the executor's blocking. Exact spoken language is Bubba's — see `docs/copy/` files for every visible string the system shows on screen.

---

## 0:00 — 0:30 — Open

- Screen: dashboard at the topics tab, demo account `pilot_army_autonomy` loaded.
- Bubba (verbal — not in build): one sentence on what they're looking at.
- The system displays the product tagline from `docs/copy/product_tagline.md`. If the tagline is still `<PLACEHOLDER_PRODUCT_TAGLINE>`, the director sees that token. That is by design until Bubba writes the line.

## 0:30 — 1:15 — Topics

- Filter to component = Army.
- Open the top PRIME card → "Why this?" → seven-item topic Why panel renders.
- Director reads the matched keywords, weights, source link, and disagreement button.

## 1:15 — 2:00 — Switch to ART Match

- Click the "ART Match" tab.
- The page loads the Phase II tech declared on this account: A234-001 — off-road perception for UGVs.
- The system computes (or shows already-computed) top sponsor matches.

## 2:00 — 3:30 — The wow moment (single)

- Director clicks the top match card: PEO Ground Combat Systems.
- The ART score reveal runs: five sub-score bars fill staggered, then the composite score counts up. Five bars in amber/bone. No green.
- The card shows: Priority alignment, Transition history (5 phase III, $X total), Active scouting (3 sources-sought ≤90d), Maturity fit, Recency boost.
- The "Why this?" panel renders the seven-item ART Why with citations.

## 3:30 — 4:15 — The receipt loop

- Director clicks "This sponsor is wrong" — modal prompt → reason "we have no Army relationship."
- Switch to Admin tab. The most recent receipt at the top is `art_match_disagreement` with the director's reason in the body and a timestamp 90 seconds old.
- Bubba points at the receipt and delivers the closing line (Bubba writes it; see `docs/copy/closing_line.md`).

## 4:15 — 5:00 — SBA flag + chain integrity

- Switch back to ART Match for a tenant whose profile satisfies all five SBA criteria (`pilot_space_sda` is set up that way in seed).
- The SBA flag appears amber: "SBA eligible."
- Click the explainer; the system reads `docs/copy/sba_eligibility_explainer.md`.
- Footer shows live merkle root and `chain: ok`. Refresh the page — root persists.

---

## Pre-flight checklist (executor)

- [ ] `bash gates/gate_t48h.sh` returns `PASS: T+48h — SHIP IT`.
- [ ] `node scripts/verify_chain.js` returns `"ok": true`.
- [ ] `npm run demo:local` starts cleanly against `data/demo_snapshot.db` if Render is degraded.
- [ ] All four demo tokens minted via `scripts/issue_demo_token.js`, tested in incognito browser.
- [ ] Readability check (Bubba, in-person): open the ART Match Why panel for `pilot_army_autonomy`. In two sentences, explain to a non-technical reviewer why PEO Ground Combat Systems was surfaced as top match. If yes — ship.
