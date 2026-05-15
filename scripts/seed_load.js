const fs = require('fs');
const path = require('path');
const config = require('../src/core/config');
const { getDb, uid, now } = require('../src/db');
const { emitReceipt } = require('../src/core/receipt');
const { getWeights } = require('../src/scoring/weights');

function read(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

function load() {
  const db = getDb();
  const seedDir = path.join(config.ROOT, 'seed');

  const components = read(path.join(seedDir, 'components.json'));

  const sponsors = read(path.join(seedDir, 'sponsor_registry.json')).sponsors;
  const upSponsor = db.prepare(`INSERT OR REPLACE INTO sponsor_candidates (id, name, component, parent_command, public_url, priority_tags, historical_phase_iii_count, historical_phase_iii_total_usd, last_refreshed_at) VALUES (?,?,?,?,?,?,?,?,?)`);
  for (const s of sponsors) {
    upSponsor.run(s.id, s.name, s.component, s.parent_command || null, s.public_url || null, JSON.stringify(s.priority_tags || []), 0, 0, now());
  }

  const accounts = read(path.join(seedDir, 'demo_accounts.json')).accounts;
  const upTenant = db.prepare(`INSERT OR IGNORE INTO tenants (tenant_id, display_name, role, created_at) VALUES (?,?,?,?)`);
  const upProfile = db.prepare(`INSERT OR REPLACE INTO profiles (tenant_id, company_name, uei, tech_keywords, trl_self_declared, private_match_secured, commercial_viability, pom_commitment_secured, dow_match_secured, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`);
  const upTech = db.prepare(`INSERT OR IGNORE INTO phase_ii_techs (id, tenant_id, topic_code, title, award_date, originating_component, tech_keywords, trl, sbir_award_url, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`);

  for (const a of accounts) {
    upTenant.run(a.tenant_id, a.display_name, a.role, now());
    const p = a.profile || {};
    upProfile.run(a.tenant_id, p.company_name || null, p.uei || null,
      JSON.stringify(p.tech_keywords || []), p.trl_self_declared || null,
      p.private_match_secured ? 1 : 0, p.commercial_viability ? 1 : 0,
      p.pom_commitment_secured ? 1 : 0, p.dow_match_secured ? 1 : 0, now());
    for (const t of a.phase_ii_techs || []) {
      upTech.run(`${a.tenant_id}:${t.topic_code}`, a.tenant_id, t.topic_code, t.title, t.award_date || null, t.originating_component, JSON.stringify(t.tech_keywords || []), t.trl || null, null, now());
    }
  }

  // Initialize default topic + ART weights for admin and each demo tenant.
  for (const a of accounts) {
    getWeights('topic', a.tenant_id);
    getWeights('art', a.tenant_id);
  }
  getWeights('topic', 'default');
  getWeights('art', 'default');

  // Pre-seed sandbox pipeline + outcome history so /demo is populated on first
  // visit after deploy (the hourly reset keeps it fresh thereafter).
  let activity = { pipeline: 0, outcomes: 0 };
  try {
    activity = require('../src/learning/individual').loadSandboxActivity();
  } catch (e) {
    emitReceipt('sandbox_seed_error', { tenant_id: 'admin', error: e.message });
  }

  emitReceipt('seed_loaded', {
    tenant_id: 'admin',
    components: components.length,
    sponsors: sponsors.length,
    tenants: accounts.length,
    sandbox_activity: activity,
  });

  console.log(`Seed loaded: ${components.length} components, ${sponsors.length} sponsors, ${accounts.length} demo accounts, ${activity.pipeline} sandbox pipeline rows.`);
}

function loadSandbox() {
  const db = getDb();
  const seedDir = path.join(config.ROOT, 'seed');
  const accounts = read(path.join(seedDir, 'demo_accounts.json')).accounts;
  const sandbox = accounts.find(a => a.tenant_id === 'sandbox');
  if (!sandbox) return 0;
  db.prepare(`INSERT OR IGNORE INTO tenants (tenant_id, display_name, role, created_at) VALUES (?,?,?,?)`)
    .run(sandbox.tenant_id, sandbox.display_name, sandbox.role, now());
  const p = sandbox.profile || {};
  db.prepare(`INSERT OR REPLACE INTO profiles (tenant_id, company_name, uei, tech_keywords, trl_self_declared, private_match_secured, commercial_viability, pom_commitment_secured, dow_match_secured, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(sandbox.tenant_id, p.company_name || null, p.uei || null,
      JSON.stringify(p.tech_keywords || []), p.trl_self_declared || null,
      p.private_match_secured ? 1 : 0, p.commercial_viability ? 1 : 0,
      p.pom_commitment_secured ? 1 : 0, p.dow_match_secured ? 1 : 0, now());
  const upTech = db.prepare(`INSERT OR IGNORE INTO phase_ii_techs (id, tenant_id, topic_code, title, award_date, originating_component, tech_keywords, trl, sbir_award_url, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`);
  for (const t of sandbox.phase_ii_techs || []) {
    upTech.run(`${sandbox.tenant_id}:${t.topic_code}`, sandbox.tenant_id, t.topic_code, t.title, t.award_date || null, t.originating_component, JSON.stringify(t.tech_keywords || []), t.trl || null, null, now());
  }
  getWeights('topic', sandbox.tenant_id);
  getWeights('art', sandbox.tenant_id);
  // Pre-seed a populated Pipeline + outcome history so the public sandbox
  // shows the full feedback loop with zero setup. Self-healing: the hourly
  // sandbox reset calls loadSandbox(), so this stays populated.
  let activity = { pipeline: 0, outcomes: 0 };
  try {
    activity = require('../src/learning/individual').loadSandboxActivity();
  } catch (e) {
    emitReceipt('sandbox_seed_error', { tenant_id: 'admin', error: e.message });
  }
  return (sandbox.phase_ii_techs || []).length + activity.pipeline;
}

// Bootstrap the opportunities table on first deploy. Mirrors the
// inquiro-sniper FIRST_SCRAPE pattern: try the live SBIR API first,
// fall back to the bundled fixture if the API is unreachable or returns
// zero rows. Idempotent — skip if rows already exist.
async function loadBootstrap({ force = false, skipLive } = {}) {
  const db = getDb();
  const oppCount = db.prepare('SELECT COUNT(*) c FROM opportunities').get().c;
  // Idempotent: a demo-credible table is >= 20 rows, so re-running the
  // bootstrap on an already-populated DB is a no-op.
  if (oppCount >= 20 && !force) {
    const msg = `bootstrap skipped — opportunities table already populated (${oppCount} rows)`;
    console.log(msg);
    return { skipped: true, reason: 'opportunities table already populated', existing_count: oppCount };
  }

  const { normalizeTopic, normalizeSolicitation } = require('../src/ingest/normalize');
  const { upsertOpportunities } = require('../src/ingest/persist');
  const { scoreTopic, persist } = require('../src/scoring/engine_topic');

  const skip = skipLive == null ? process.env.INITIAL_INGEST_SKIP_LIVE === '1' : !!skipLive;
  let opps = [];
  let source_used = null;
  if (!skip) {
    try {
      const sbir = require('../src/ingest/sbir_api');
      const live = await sbir.scrape();
      opps = Array.isArray(live) ? live : [];
      source_used = 'sbir_gov_live';
    } catch (e) {
      emitReceipt('ingest_error', { tenant_id: 'admin', source: 'sbir_gov', stage: 'bootstrap', error: e.message });
    }
  }
  if (!opps.length) {
    // Prefer the broad bootstrap fixture (25 topics across 12 components) so a
    // deploy that cannot reach the live SBIR API still seeds a credible demo;
    // fall back to the smaller test sample only if it is absent.
    const bootstrapPath = path.join(config.ROOT, 'seed', 'opportunities_bootstrap.json');
    const samplePath = path.join(config.ROOT, 'tests', 'fixtures', 'sbir_sample.json');
    const fixturePath = fs.existsSync(bootstrapPath) ? bootstrapPath : samplePath;
    if (fs.existsSync(fixturePath)) {
      const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
      for (const sol of raw.solicitations || []) {
        const topics = sol.solicitation_topics || sol.topics || [];
        if (topics.length) for (const t of topics) opps.push(normalizeTopic(t, sol, sol.agency || 'DOD'));
        else opps.push(normalizeSolicitation(sol, sol.agency || 'DOD'));
      }
      source_used = 'fixture';
    }
  }

  const persisted = upsertOpportunities(opps, 'admin');

  const tenants = db.prepare('SELECT tenant_id FROM tenants').all().map(r => r.tenant_id);
  if (!tenants.includes('default')) tenants.push('default');
  if (!tenants.includes('sandbox')) tenants.push('sandbox');
  const allOpps = db.prepare('SELECT * FROM opportunities').all().map(o => ({ ...o, is_rolling: o.is_rolling === 1 }));
  let scored = 0;
  for (const tenant_id of tenants) {
    for (const opp of allOpps) {
      try { persist(scoreTopic(opp, tenant_id)); scored++; } catch (_) {}
    }
  }
  const components = Array.from(new Set(allOpps.map(o => o.component).filter(Boolean)));
  emitReceipt('bootstrap_completed', {
    tenant_id: 'admin',
    source_used,
    rows_seeded: persisted.inserted,
    rows_total: allOpps.length,
    components_covered: components,
    scored,
    tenants: tenants.length,
  });
  return { skipped: false, source_used, ...persisted, scored, components };
}

if (require.main === module) {
  const arg = process.argv[2];
  if (arg === 'bootstrap') {
    loadBootstrap()
      .then(out => { console.log(JSON.stringify(out, null, 2)); })
      .catch(e => { console.error('bootstrap failed:', e.message); process.exit(1); });
  } else {
    load();
  }
}
module.exports = { load, loadSandbox, loadBootstrap };
