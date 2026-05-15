#!/usr/bin/env node
// run_now — one on-demand SBIR scan, spawned as a child process by
// POST /api/scrape/trigger (the inquiro-sniper "Scrape Now" pattern). It
// streams plain progress lines to stdout — the parent keeps a 4KB tail — and
// ends with a single `__SCAN_RESULT__ <json>` line the parent parses into
// last_result.
//
// Data source: the live SBIR API by default. SCAN_SOURCE=fixture ingests the
// bundled sample instead — an offline scan for hosts that cannot reach
// api.www.sbir.gov (mirrors the fixture fallback already in initial_ingest.js).
const fs = require('fs');
const path = require('path');
const config = require('../core/config');
const { getDb } = require('../db');
const { emitReceipt } = require('../core/receipt');
const sbir = require('../ingest/sbir_api');
const { computeDiffs } = require('../diff/engine');
const { normalizeTopic, normalizeSolicitation } = require('../ingest/normalize');
const { scoreUnscoredForAllTenants } = require('./cron');

function log(msg) { process.stdout.write('scan: ' + msg + '\n'); }
function result(obj) { process.stdout.write('__SCAN_RESULT__ ' + JSON.stringify(obj) + '\n'); }

function fixtureOpps() {
  const p = path.join(config.ROOT, 'tests', 'fixtures', 'sbir_sample.json');
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  const out = [];
  for (const sol of raw.solicitations || []) {
    const topics = sol.solicitation_topics || sol.topics || [];
    if (topics.length) for (const t of topics) out.push(normalizeTopic(t, sol, sol.agency || 'DOD'));
    else out.push(normalizeSolicitation(sol, sol.agency || 'DOD'));
  }
  return out;
}

async function fetchOpps() {
  if (process.env.SCAN_SOURCE === 'fixture') {
    log('source = bundled fixture (SCAN_SOURCE=fixture)');
    return { opps: fixtureOpps(), source: 'fixture' };
  }
  log('pulling the live SBIR feed…');
  const opps = await sbir.scrape();
  return { opps: Array.isArray(opps) ? opps : [], source: 'sbir_gov_live' };
}

(async () => {
  getDb();
  log('starting');
  let opps, source;
  try {
    ({ opps, source } = await fetchOpps());
  } catch (e) {
    log('SBIR pull failed — ' + e.message);
    emitReceipt('scan_error', { tenant_id: 'admin', stage: 'fetch', error: e.message });
    result({ inserted: 0, updated: 0, errors: 1, message: e.message });
    process.exit(1);
  }
  const fetched = opps.length;
  log('fetched ' + fetched + ' opportunities (' + source + ')');
  if (!fetched) {
    // An empty result must not reach computeDiffs — it would mark every
    // existing opportunity as closed. Treat it as a failed scan.
    const msg = 'no opportunities returned — this host may be unable to reach api.www.sbir.gov';
    log(msg);
    emitReceipt('scan_error', { tenant_id: 'admin', stage: 'fetch', error: msg });
    result({ inserted: 0, updated: 0, errors: 1, message: msg });
    process.exit(1);
  }
  const counts = computeDiffs('sbir_gov', opps);
  const inserted = counts.new;
  const updated = fetched - counts.new;
  log(inserted + ' new, ' + updated + ' updated, ' + counts.closed + ' closed');
  const scoring = scoreUnscoredForAllTenants();
  log('scored ' + scoring.scored + ' rows across ' + scoring.tenants + ' tenants');
  emitReceipt('scan_completed', {
    tenant_id: 'admin', source, fetched, inserted, updated,
    diff_counts: counts, scored: scoring.scored,
  });
  result({ inserted, updated, errors: 0, fetched });
  log('done');
  process.exit(0);
})().catch(e => {
  log('fatal — ' + e.message);
  emitReceipt('scan_error', { tenant_id: 'admin', stage: 'fatal', error: e.message });
  result({ inserted: 0, updated: 0, errors: 1, message: e.message });
  process.exit(1);
});
