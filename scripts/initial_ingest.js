#!/usr/bin/env node
// initial_ingest: populate opportunities + scores so the dashboard has data on
// first boot. Data source priority:
//   1. live SBIR API (if the build host can reach it)
//   2. seed/sbir_snapshot.json — a real snapshot captured by scripts/sbir_snapshot.js
//      from a machine that CAN reach the API (commit it; survives IP-blocked hosts)
//   3. tests/fixtures/sbir_sample.json — placeholder fallback of last resort
// Then scores every opportunity for every known tenant.

const fs = require('fs');
const path = require('path');
const config = require('../src/core/config');
const { getDb } = require('../src/db');
const { computeDiffs } = require('../src/diff/engine');
const { normalizeTopic, normalizeSolicitation } = require('../src/ingest/normalize');
const { scoreTopic, persist } = require('../src/scoring/engine_topic');
const { emitReceipt } = require('../src/core/receipt');

const FIXTURE_PATH = path.join(config.ROOT, 'tests', 'fixtures', 'sbir_sample.json');
const SNAPSHOT_PATH = path.join(config.ROOT, 'seed', 'sbir_snapshot.json');

function fixtureOpps() {
  const raw = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  const sols = raw.solicitations || [];
  const out = [];
  for (const sol of sols) {
    const topics = sol.solicitation_topics || sol.topics || [];
    if (topics.length) for (const t of topics) out.push(normalizeTopic(t, sol, sol.agency || 'DOD'));
    else out.push(normalizeSolicitation(sol, sol.agency || 'DOD'));
  }
  return out;
}

// A real, committed snapshot of live SBIR data — already normalized opportunities.
function snapshotOpps() {
  if (!fs.existsSync(SNAPSHOT_PATH)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
    return Array.isArray(raw.opportunities) ? raw.opportunities : [];
  } catch (e) {
    emitReceipt('ingest_error', { tenant_id: 'admin', source: 'sbir_snapshot', error: e.message });
    return [];
  }
}

async function liveOpps() {
  const sbir = require('../src/ingest/sbir_api');
  // Wall-clock cap so a slow or rate-limited SBIR API can never hang the
  // deploy build. On timeout we return [] and the caller uses the fixture.
  const capMs = parseInt(process.env.INGEST_LIVE_CAP_MS || '120000', 10);
  let timer;
  try {
    const opps = await Promise.race([
      sbir.scrape(),
      new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`live ingest exceeded ${capMs}ms cap`)), capMs); }),
    ]);
    return Array.isArray(opps) ? opps : [];
  } catch (e) {
    emitReceipt('ingest_error', { tenant_id: 'admin', source: 'sbir_gov', stage: 'initial_ingest', error: e.message });
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function scoreForAllTenants(db) {
  const tenants = db.prepare('SELECT tenant_id FROM tenants').all().map(r => r.tenant_id);
  if (!tenants.includes('default')) tenants.push('default');
  if (!tenants.includes('sandbox')) tenants.push('sandbox');
  const opps = db.prepare('SELECT * FROM opportunities').all().map(o => ({ ...o, is_rolling: o.is_rolling === 1 }));
  let scored = 0;
  for (const tenant_id of tenants) {
    const existing = new Set(
      db.prepare('SELECT opportunity_id FROM scores WHERE tenant_id = ?').all(tenant_id).map(r => r.opportunity_id)
    );
    for (const opp of opps) {
      if (existing.has(opp.id)) continue;
      try { persist(scoreTopic(opp, tenant_id)); scored++; } catch (_) {}
    }
  }
  return { tenants: tenants.length, scored };
}

(async () => {
  getDb();
  let opps = [];
  const skipLive = process.env.INITIAL_INGEST_SKIP_LIVE === '1';
  if (!skipLive) opps = await liveOpps();
  let source_used = 'sbir_gov_live';
  if (!opps.length) {
    const snap = snapshotOpps();
    if (snap.length) { opps = snap; source_used = 'sbir_snapshot'; }
  }
  if (!opps.length) {
    opps = fixtureOpps();
    source_used = 'fixture';
  }
  const counts = computeDiffs('sbir_gov', opps);
  const db = getDb();

  // Once real SBIR data is in hand (live API or a committed snapshot), drop the
  // placeholder fixture topics so the dashboard shows only real opportunities
  // with working source links. Only the bundled fixture ids are removed.
  const REAL = source_used === 'sbir_gov_live' || source_used === 'sbir_snapshot';
  let fixture_purged = 0;
  if (REAL && opps.length) {
    const liveIds = new Set(opps.map(o => o.id));
    for (const f of fixtureOpps()) {
      if (liveIds.has(f.id)) continue;
      db.prepare('DELETE FROM scores WHERE opportunity_id = ?').run(f.id);
      db.prepare('DELETE FROM diffs WHERE opportunity_id = ?').run(f.id);
      fixture_purged += db.prepare('DELETE FROM opportunities WHERE id = ?').run(f.id).changes;
    }
    if (fixture_purged) emitReceipt('fixture_opps_purged', { tenant_id: 'admin', count: fixture_purged });
  }

  const scoring = scoreForAllTenants(db);
  const opp_total = db.prepare('SELECT COUNT(*) c FROM opportunities').get().c;
  emitReceipt('initial_ingest', {
    tenant_id: 'admin',
    source_used,
    fresh: opps.length,
    fixture_purged,
    opportunities_total: opp_total,
    diff_counts: counts,
    scoring,
  });
  console.log(JSON.stringify({ source_used, fresh: opps.length, fixture_purged, opportunities_total: opp_total, diff_counts: counts, scoring }, null, 2));
})().catch(e => {
  console.error('initial_ingest failed:', e.message);
  // Do not exit non-zero — build should not break if ingest is best-effort.
  process.exit(0);
});
