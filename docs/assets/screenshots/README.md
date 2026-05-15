# screenshots — capture instructions

Claude Code cannot capture images. This file is the spec; Bubba follows it.
Each screenshot is committed to `docs/assets/screenshots/` at the named path
and linked from `docs/copy/linkedin_series/*.md` when it ships.

---

## why_panel.png

- **URL**: `http://localhost:3000/demo?annotate=true`
- **State**: top-scoring Army topic card, Why This panel open
- **Capture**: full browser window, 1440×900 (no chrome required, no devtools)
- **Key elements to confirm present before capturing**:
  - Amber composite score visible
  - All 7 items in the Why panel visible (composite, 5 dimensions, matched keywords)
  - At least 3 matched keyword chips in the chip row
  - Weight provenance link in lower-right of the panel

## art_match.png

- **URL**: `http://localhost:3000/demo?annotate=true`
- **State**: ART Match tab active, top sponsor card visible
- **Capture**: full browser window, 1440×900
- **Key elements**:
  - Match score in amber
  - 5 sub-score bars
  - SAM.gov public link visible on the card
  - Band tag (Strong / Promising / Weak) legible

## landing_page.png

- **URL**: `http://localhost:3000/` (no token)
- **State**: as served
- **Capture**: full browser window, 1440×900
- **Key elements**:
  - Tagline visible (no `<PLACEHOLDER_*>` token unless Bubba intentionally hasn't filled copy yet)
  - Both CTA buttons visible
  - Three stat chips populated

## receipt_toast.png

- **URL**: `http://localhost:3000/demo`
- **State**: immediately after clicking "This Sponsor Is Wrong"
- **Capture**: 1440×900
- **Key elements**:
  - Toast/receipt confirmation visible
  - Receipt hash legible

---

After capturing, run `npm run test:local` once more to confirm no state
drift, then commit the .png files in a single commit with message
`docs(assets): refresh screenshots for series_<weeknum>`.
