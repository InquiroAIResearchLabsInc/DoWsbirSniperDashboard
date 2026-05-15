#!/usr/bin/env node
// sbir_snapshot — capture a real snapshot of live DoD SBIR/STTR topics.
//
// WHY THIS EXISTS:
//   inquiro-sniper's links work because it scrapes the live SBIR API from a
//   normal machine. A cloud build host (Render, CI) is sometimes IP-blocked by
//   api.www.sbir.gov, so the deploy can fall back to placeholder data with
//   non-resolving links. Run this script from ANY machine/network that can
//   reach the API, commit the resulting seed/sbir_snapshot.json, and the
//   deploy will serve real topics with real source links regardless of
//   whether the build host itself can reach the API.
//
// USAGE:
//   npm run snapshot:sbir      # writes seed/sbir_snapshot.json
//   git add seed/sbir_snapshot.json && git commit && push   # then redeploy

const fs = require('fs');
const path = require('path');
const config = require('../src/core/config');
const sbir = require('../src/ingest/sbir_api');

const OUT = path.join(config.ROOT, 'seed', 'sbir_snapshot.json');

(async () => {
  console.log(`Scraping live DoD SBIR topics from ${config.SBIR_API_BASE} ...`);
  let opps = [];
  try {
    opps = await sbir.scrape();
  } catch (e) {
    console.error(`FAIL: SBIR scrape errored — ${e.message}`);
    console.error('Run this from a network that can reach api.www.sbir.gov.');
    process.exit(1);
  }
  if (!Array.isArray(opps) || opps.length === 0) {
    console.error('FAIL: SBIR scrape returned 0 opportunities — not writing an empty snapshot.');
    console.error('The API may be unreachable or rate-limiting from this network.');
    process.exit(1);
  }
  const withLink = opps.filter(o => /^https?:\/\//i.test(o.source_url || '')).length;
  const snapshot = {
    generated_at: new Date().toISOString(),
    source: 'api.www.sbir.gov/public/api/solicitations',
    count: opps.length,
    with_source_link: withLink,
    opportunities: opps,
  };
  fs.writeFileSync(OUT, JSON.stringify(snapshot, null, 2));
  console.log(`OK: wrote ${opps.length} real opportunities (${withLink} with a source link) to seed/sbir_snapshot.json`);
  console.log('Next: commit seed/sbir_snapshot.json and redeploy — the dashboard will serve real topics.');
})();
