# Pilot Playbook — 7-day, three-touch

**Audience:** Bubba (operator). **Target:** Director of DoW Office for Small Business Innovation, plus 4 Phase II awardees Bubba selects.
**Source:** spec v0.2 §13.

The pilot's deliverable is a **calibrated system**, not a slide deck. Every interaction the director has with the system becomes training data — the system is more capable on Day 7 than Day 0, and that fact is auditably true.

## Pre-flight (T+48h, before send)

```bash
npm install
npm run db:migrate
npm run seed
bash gates/gate_t48h.sh
node scripts/issue_demo_token.js --tenant director_review --ttl 30d --role director --base https://<your-render-url>
node scripts/issue_demo_token.js --tenant pilot_army_autonomy --ttl 30d --role pilot --base https://<your-render-url>
node scripts/issue_demo_token.js --tenant pilot_space_sda --ttl 30d --role pilot --base https://<your-render-url>
node scripts/issue_demo_token.js --tenant pilot_darpa_ai --ttl 30d --role pilot --base https://<your-render-url>
node scripts/issue_demo_token.js --tenant pilot_afwerx_battle --ttl 30d --role pilot --base https://<your-render-url>
```

Each command prints a URL. Paste the director URL into `docs/copy/day_0_message.md` after Bubba writes the body.

## Day 0 — The send

Manual. Bubba composes the body of `docs/copy/day_0_message.md` (still placeholders today) and sends it on the channel of his choice. **The system does not auto-send.**

## Day 3 — The screenshare

30-minute call. The director clicks the link from Day 0 and lands authenticated. Bubba walks through the script in `docs/DEMO_SCRIPT.md`. The single close: point at the receipt for her own disagreement, written 90 seconds prior.

Capture in `docs/PILOT_NOTES.md` after the call:

- Did she engage with the dashboard? (Yes signal: `demo_token_used_receipt`.)
- Did she give structured feedback? (Yes signal: ≥1 `art_match_disagreement_receipt` from her account.)
- Did she ask a follow-up question? (Yes/no.)
- Did she agree to forward to ≥1 Phase II awardee? (Yes/no.)
- Did her team audit the receipt chain? (Optional: `GET /api/receipts` from her IP — verify in `receipts.jsonl` or admin recent-receipts view.)

3 of 5 = pilot delivering. 4+ = expand to 30-day extended pilot.

## Day 7 — The recap and the ask

Manual. Bubba composes `docs/copy/day_7_recap.md` body. The system generates `docs/copy/day_7_system_summary.html` from the receipt ledger before send (TODO: implement this generator if the pilot proceeds — for v0.1 it's a manual export).

Three asks (Bubba phrases them, defaults below for reference only):
1. Forward to 2 trusted Phase II awardees for 30-day extended pilot.
2. Share public modernization-priority refresh cadence.
3. Open the conversation about formal placement adjacent to DSIP.

## Failure modes and recovery

| Scenario | Recovery |
|---|---|
| Render is degraded the morning of Day 3 | `npm run demo:local`. The same UI is on `http://localhost:3000`. The director sees the same content. |
| Director doesn't click the Day 0 link by Day 2 | Lightweight nudge from Bubba. No auto-reminders. |
| The ART Match Why panel shows thin evidence and the director questions it | Honest answer: the score is capped at "Promising" precisely because evidence is thin. Show the `capped_reason` in the evidence object. |
| Calibration cases regress in a code change | `gate_t24h.sh` will fail. Roll back; the gate is the floor, not a checkpoint. |

## What this pilot is NOT

- Not a pitch deck.
- Not a procurement conversation.
- Not a TTA drafting service.
- Not a POM-tracking tool.

It is a focused test of whether the matching logic earns the right to a procurement conversation.
