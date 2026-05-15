# demo_beats — recording cue sheet

Structure is fixed (Claude Code).
Narration is yours (Bubba) — `<PLACEHOLDER_*>` slots load from `docs/copy/` and
get filled before recording. Lean, no prose.

| Beat | Time | Action | Narration source |
|------|------|--------|------------------|
| 1 | 0:00 | Landing page. Show URL bar. Click **Open Sandbox**. | `docs/copy/video_1_brief.md` HOOK |
| 2 | 0:08 | Dashboard loads. Sandbox banner visible. 4 profiles in pipeline. Point at score badges. | live |
| 3 | 0:20 | Click **Why This** on the top-scoring Army topic. Bars fill (score_reveal). | live |
| 4 | 0:45 | Walk the 7 items: amber composite, 5 dimension bars, matched keywords, weight provenance. | `docs/copy/why_panel_header.md` |
| 5 | 1:15 | Click **ART Match** tab. Sponsor cards appear. score_reveal fires for top sponsor. | live |
| 6 | 1:40 | Click **Why This** on top sponsor. 5 sub-scores. SAM.gov link visible. | `docs/copy/art_match_intro.md` |
| 7 | 2:10 | Click **This Sponsor Is Wrong**. Receipt toast appears in corner. | `docs/copy/disagreement_label.md` |
| 8 | 2:20 | Closing narration. | `<PLACEHOLDER_CLOSING_NARRATION>` |
| 9 | 2:30 | Show sandbox banner CTA. Point at `https://dowsbirsniperdashboard.onrender.com/demo`. | `docs/copy/sandbox_banner_cta.md` |
| 10 | 2:40 | Cut. | — |

## Recording prerequisites

1. `npm run demo:snapshot` has been run on the recording branch. `data/demo_snapshot.db` and `data/demo_snapshot_meta.json` exist and are committed.
2. `npm run demo:local` boots on `localhost:3000`. `/health` returns `mode: "local-mirror"`.
3. `npm run test:local` is green. All 9 groups PASS. Output saved to `docs/PHASE3_TEST_RESULTS.md`.
4. `?annotate=true` URL flag toggles bone-white overlay labels for explanatory recordings. Toggle OFF for the Gina link.

## What is *not* in this file

- The actual narration text. That lives in `docs/copy/`.
- Sound design, transitions, color grading. Bubba owns the recording.
- Any commitment to a specific runtime per beat beyond the table above.
