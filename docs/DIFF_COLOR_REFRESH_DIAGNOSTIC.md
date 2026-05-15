# DIFF FEED / COLOR / REFRESH — DIAGNOSTIC

Pre-change diagnostic per build-strategy §0. No source changes were made before
this document was committed. Findings below are from a **live call** against a
locally built instance (`db:migrate` → `seed` → `ingest:initial` with the
bundled SBIR fixture — the same path the deploy build runs), not from tests.

---

## 1. What `GET /api/admin/diffs` currently returns

Route: `src/api/routes/admin.js` → `router.get('/diffs')` → `listDiffs(days)`
(`src/diff/engine.js:110`). `listDiffs` LEFT-JOINs `diffs` to `opportunities`
on `o.id = d.opportunity_id` and returns the joined `title`, `component`,
`program`, `phase`, plus a computed `days_remaining`.

Live call — `curl 'localhost:3000/api/admin/diffs?days=14'` — 5 rows, all
healthy. Representative row:

```json
{
  "id": "mp79ofkvnlpypx",
  "diff_date": "2026-05-15",
  "source": "sbir_gov",
  "diff_type": "new",
  "opportunity_id": "sbir_gov:A234-001",
  "field_changed": null, "old_value": null, "new_value": null,
  "created_at": "2026-05-15T18:44:48.223Z",
  "title": "Off-road perception and traversability for unmanned ground vehicles",
  "component": "army",
  "program": "SBIR",
  "phase": "Phase I",
  "close_date": "2026-06-15",
  "is_rolling": false,
  "days_remaining": 31
}
```

**The API is correct.** For every diff whose `opportunity_id` matches a row in
`opportunities`, `title` / `component` / `program` / `phase` / `days_remaining`
are all populated. The JOIN added in commit `32f1ad0` works.

**But** the JOIN is a LEFT JOIN. A diff whose `opportunity_id` matches **no**
`opportunities.id` returns `title: null`. Proven — an orphan diff was inserted
and the same endpoint returned:

```json
{
  "opportunity_id": "sbir_gov:ORPHAN-999",
  "diff_type": "new",
  "title": null, "component": null, "program": null,
  "phase": null, "close_date": null, "days_remaining": null
}
```

---

## 2. What `public/components/diff_feed.js` currently renders

The render loop (`public/components/diff_feed.js:24-71`, post-`32f1ad0`):

```js
for (const d of list) {
  const type = d.diff_type || 'changed';
  const entry = document.createElement('div');
  entry.className = `diff-entry ${type}`;
  // ...badge + days...
  const title = document.createElement('div');
  title.className = 'diff-title';
  title.textContent = d.title || d.opportunity_id || '(unknown topic)';   // <-- line 46
  entry.appendChild(title);
  // ...meta line: [component, program, phase]...
}
```

The render reads `d.title` first — correct for healthy rows. The problem is the
fallback chain on **line 46**: `d.title || d.opportunity_id || '(unknown topic)'`.

---

## 3. Where the gap is

There is **no gap for healthy data** — verified: a fresh build returns a `title`
for every row and `diff_feed.js` renders it. The screenshot raw IDs
(`sbir_gov:A234-001`, `sbir_gov:SF234-D2`, `sbir_gov:AF234-D2-AFWERX`) are the
**`|| d.opportunity_id` fallback on line 46 firing**. That fallback fires
whenever `d.title` is falsy, which happens when:

- **The deployed bundle predates `32f1ad0`.** Before that commit `listDiffs`
  returned no `title` column at all and `renderDiffFeed` rendered
  `escape(d.opportunity_id)` directly — so *every* row showed a raw ID. A
  screenshot taken against a deploy that had not yet picked up `32f1ad0` shows
  exactly this. The persistent-disk DB (`render.yaml` mounts one) means a
  re-deploy alone re-runs the build but does not re-render an old cached bundle.
- **Orphan diff rows.** Any diff whose `opportunity_id` has no matching
  `opportunities.id` returns `title: null` (proven in §1) → line 46 falls back
  to the raw ID. No current code path creates orphans (only
  `initial_ingest.js`'s fixture-purge deletes opportunities, and it deletes
  their diffs in the same pass), but a stale persistent DB carried across
  schema/ID-format changes can hold them.
- A browser-cached pre-`32f1ad0` `diff_feed.js`.

**Conclusion:** the previous PR fixed both the API and the render path, but the
render path still has a latent escape hatch — `|| d.opportunity_id` — that puts
an internal key on screen whenever a title is missing for *any* reason. The fix
is to make a raw `sbir_gov:` ID structurally impossible to render:

1. `diff_feed.js` — drop `|| d.opportunity_id`. Display title becomes
   `d.title || d.topic_code || '(topic unavailable)'`. `opportunity_id` is used
   only as the click-handler key, never as visible text.
2. `engine.js` `listDiffs` — also select `o.topic_code` (meaningful fallback)
   and drop fully-orphaned diff rows (no joined opportunity at all) so the feed
   only shows renderable changes.
3. A render test passes the live `/api/admin/diffs` payload through the render
   function and asserts zero `sbir_gov:` substrings in the output HTML — so a
   regression cannot ship silently again.

This PR also restyles the feed (category/days/title/meta colors per
DEMO_STEALTH_BOMBER), rebuilds Refresh on the Sniper child-process pattern, and
collapses amber to one-signal-per-surface — covered in build-strategy §1–§4.
