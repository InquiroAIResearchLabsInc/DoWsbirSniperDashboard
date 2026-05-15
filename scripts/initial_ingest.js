#!/usr/bin/env node
// initial_ingest: populate opportunities + scores so the dashboard has data on
// first boot. Tries the live SBIR API first, falls back to the bundled fixture
// if the API is unreachable or returns zero rows. Then scores every
// opportunity for every known tenant (including 'sandbox' and 'default').

const fs = require('fs');
const path = require('path');
const config = require('../src/core/config');
const { getDb } = require('../src/db');
const { computeDiffs } = require('../src/diff/engine');
const { normalizeTopic, normalizeSolicitation } = require('../src/ingest/normalize');
const { scoreTopic, persist } = require('../src/scoring/engine_topic');
const { emitReceipt } = require('../src/core/receipt');

const FIXTURE_PATH = path.join(config.ROOT, 'tests', 'fixtures', 'sbir_sample.json');

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

async function liveOpps() {
  const sbir = require('../src/ingest/sbir_api');
  try {
    const opps = await sbir.scrape();
    return Array.isArray(opps) ? opps : [];
  } catch (e) {
    emitReceipt('ingest_error', { tenant_id: 'admin', source: 'sbir_gov', stage: 'initial_ingest', error: e.message });
    return [];
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
    opps = fixtureOpps();
    source_used = 'fixture';
  }
  const counts = computeDiffs('sbir_gov', opps);
  const db = getDb();
  const scoring = scoreForAllTenants(db);
  const opp_total = db.prepare('SELECT COUNT(*) c FROM opportunities').get().c;
  emitReceipt('initial_ingest', {
    tenant_id: 'admin',
    source_used,
    fresh: opps.length,
    opportunities_total: opp_total,
    diff_counts: counts,
    scoring,
  });
  console.log(JSON.stringify({ source_used, fresh: opps.length, opportunities_total: opp_total, diff_counts: counts, scoring }, null, 2));
})().catch(e => {
  console.error('initial_ingest failed:', e.message);
  // Do not exit non-zero — build should not break if ingest is best-effort.
  process.exit(0);
});
