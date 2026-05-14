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

  emitReceipt('seed_loaded', {
    tenant_id: 'admin',
    components: components.length,
    sponsors: sponsors.length,
    tenants: accounts.length,
  });

  console.log(`Seed loaded: ${components.length} components, ${sponsors.length} sponsors, ${accounts.length} demo accounts.`);
}

if (require.main === module) load();
module.exports = { load };
