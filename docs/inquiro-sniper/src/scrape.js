// ─── MANUAL SCRAPE RUNNER ─────────────────────────────────────────────────────
// Usage:
//   node src/scrape.js              — scrape all daily sources
//   node src/scrape.js --all        — scrape all sources (daily + weekly)
//   node src/scrape.js --source sbir_gov
//   node src/scrape.js --calibrate  — run scoring calibration only
const { upsertOpportunity, insertSnapshot, updateSourceStatus, now } = require('./db');
const { scoreOpportunity } = require('./scorer');
const { computeDiffs } = require('./diff');
const { generateDigest } = require('./digest');
const { runCalibration } = require('./scorer');

const SCRAPERS = {
  sbir_gov:    () => require('./scrapers/sbir').scrape(),
  sam_gov:     () => require('./scrapers/sam').scrape(),
  grants_gov:  () => require('./scrapers/grants').scrape(),
  nsf_seedfund: () => require('./scrapers/nsf').scrape(),
  diu:         () => require('./scrapers/diu').scrape(),
  spacewerx:   () => require('./scrapers/spacewerx').scrape(),
  afwerx:      () => require('./scrapers/afwerx').scrape(),
  dasa_uk:     () => require('./scrapers/dasa').scrape(),
  diana_nato:  () => require('./scrapers/diana').scrape(),
};

const DAILY_SOURCES   = ['sbir_gov', 'sam_gov', 'grants_gov'];
const WEEKLY_SOURCES  = ['nsf_seedfund', 'diu', 'spacewerx', 'afwerx', 'dasa_uk', 'diana_nato'];

async function runScraper(source) {
  console.log(`\n[${new Date().toISOString()}] Scraping ${source}...`);
  const startMs = Date.now();

  let opportunities = [];
  let error = null;

  try {
    opportunities = await SCRAPERS[source]();
  } catch (err) {
    error = err.message;
    console.error(`  [${source}] FAILED:`, err.message);
    updateSourceStatus(source, { last_run: now(), status: 'error', last_error: err.message });
    return { source, count: 0, error };
  }

  // Score each opportunity
  const scored = [];
  for (const opp of opportunities) {
    const score = scoreOpportunity(opp);
    scored.push({ ...opp, ...score });
  }

  // Save snapshot ID
  const snapshotId = insertSnapshot(source, scored.length);

  // Compute diffs BEFORE upserting (compares against current DB state)
  const diffs = computeDiffs(source, scored.map(o => ({ ...o, snapshot_id: snapshotId })));

  // Upsert all opportunities
  let inserted = 0, updated = 0;
  for (const opp of scored) {
    const result = upsertOpportunity({ ...opp, snapshot_id: snapshotId });
    if (result.action === 'inserted') inserted++;
    else updated++;
  }

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  const snipers  = scored.filter(o => o.score_tier === 'SNIPER').length;
  const evaluates = scored.filter(o => o.score_tier === 'EVALUATE').length;

  console.log(`  [${source}] Done: ${scored.length} opps (${inserted} new, ${updated} updated) in ${elapsed}s`);
  console.log(`  [${source}] Tiers: ${snipers} SNIPER, ${evaluates} EVALUATE, ${scored.filter(o => o.score_tier === 'STRETCH').length} STRETCH`);
  console.log(`  [${source}] Diffs: ${diffs.new_opportunities.length} new, ${diffs.closed_opportunities.length} closed, ${diffs.changed_opportunities.length} changed`);

  // Don't overwrite a 'watch' / 'change_detected' status set by the scraper
  // itself (DASA, DIANA). Read the existing row and keep its status if the
  // scraper already set a non-default value.
  const { getDb } = require('./db');
  const existing = getDb().prepare('SELECT status FROM source_status WHERE source = ?').get(source);
  const preserveStatus = existing && existing.status && existing.status !== 'ok' && existing.status !== 'error'
    ? existing.status
    : 'ok';
  updateSourceStatus(source, {
    last_run: now(),
    last_success: now(),
    last_count: scored.length,
    last_error: null,
    status: preserveStatus,
  });

  return { source, count: scored.length, inserted, updated, snipers, evaluates, diffs };
}

async function main() {
  const args = process.argv.slice(2);

  // Calibration only
  if (args.includes('--calibrate')) {
    console.log('Running scoring calibration...\n');
    runCalibration(true);
    return;
  }

  // Digest only — used by 07:00 UTC cron after scrapes complete
  if (args.includes('--digest-only')) {
    console.log('Generating digest only (no scrape)...\n');
    const digest = generateDigest();
    console.log(`Digest: ${digest.sniper_count} SNIPER, ${digest.evaluate_count} EVALUATE, ${digest.critical_deadlines.length} critical deadlines`);
    return;
  }

  // Determine which sources to run
  let sources = [];
  const sourceArg = args.find(a => a.startsWith('--source=') || a === '--source');
  if (sourceArg) {
    const idx = args.indexOf('--source');
    const val = sourceArg.includes('=') ? sourceArg.split('=')[1] : args[idx + 1];
    sources = [val];
  } else if (args.includes('--all')) {
    sources = [...DAILY_SOURCES, ...WEEKLY_SOURCES];
  } else {
    // Default: daily sources only
    sources = [...DAILY_SOURCES];
    // Add weekly sources on Mondays
    const isMonday = new Date().getDay() === 1;
    const isFirst = new Date().getDate() === 1;
    if (isMonday) sources.push(...WEEKLY_SOURCES.filter(s => s !== 'diana_nato'));
    if (isFirst)  sources.push('diana_nato');
  }

  // Validate
  for (const s of sources) {
    if (!SCRAPERS[s]) { console.error(`Unknown source: ${s}`); process.exit(1); }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`INQUIRO SNIPER SCRAPE RUN — ${new Date().toISOString()}`);
  console.log(`Sources: ${sources.join(', ')}`);
  console.log('='.repeat(60));

  const results = [];
  for (const source of sources) {
    const result = await runScraper(source);
    results.push(result);
  }

  // Generate digest
  console.log('\n[digest] Generating daily digest...');
  const digest = generateDigest();

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('SCRAPE COMPLETE — SUMMARY');
  console.log('='.repeat(60));
  for (const r of results) {
    if (r.error) {
      console.log(`  ❌ ${r.source}: ERROR — ${r.error}`);
    } else {
      console.log(`  ✅ ${r.source}: ${r.count} opps | ${r.snipers || 0} SNIPER | ${r.evaluates || 0} EVALUATE`);
    }
  }

  const totalSnipers = results.reduce((n, r) => n + (r.snipers || 0), 0);
  const totalEvals   = results.reduce((n, r) => n + (r.evaluates || 0), 0);
  console.log(`\nTotal SNIPER: ${totalSnipers} | Total EVALUATE: ${totalEvals}`);
  if (digest.snipers?.length) {
    console.log('\n🟢 TOP SNIPERS:');
    for (const s of digest.snipers.slice(0, 5)) {
      console.log(`  [${s.score}] ${s.title} (${s.source})`);
    }
  }
  console.log('='.repeat(60));
}

main().catch(err => { console.error('Fatal error:', err); process.exit(1); });
