#!/usr/bin/env node
// demo_snapshot: wipes data/demo_snapshot.db, runs migrations + seed against
// it, loads ART matches for every demo profile, writes demo_snapshot_meta.json,
// and emits snapshot_generated_receipt to the main ledger.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SNAP_PATH = process.env.DEMO_SNAPSHOT_PATH || path.join(ROOT, 'data', 'demo_snapshot.db');
const META_PATH = path.join(path.dirname(SNAP_PATH), 'demo_snapshot_meta.json');

// Point the DB at the snapshot file BEFORE loading any modules that open the DB.
process.env.DB_PATH = SNAP_PATH;

if (fs.existsSync(SNAP_PATH)) fs.unlinkSync(SNAP_PATH);
fs.mkdirSync(path.dirname(SNAP_PATH), { recursive: true });

const { emitReceipt } = require('../src/core/receipt');
const { getDb, closeDb } = require('../src/db');
const seed = require('./seed_load');
const { computeAllMatches } = require('../src/art/match_orchestrator');

(async () => {
  getDb();
  seed.load();

  const db = getDb();
  const tenants = db.prepare("SELECT tenant_id, display_name, role FROM tenants WHERE tenant_id LIKE 'pilot_%' OR tenant_id = 'sandbox' ORDER BY tenant_id").all();
  let matchCount = 0;
  for (const t of tenants) {
    const techs = db.prepare('SELECT * FROM phase_ii_techs WHERE tenant_id = ?').all(t.tenant_id);
    const profile = db.prepare('SELECT * FROM profiles WHERE tenant_id = ?').get(t.tenant_id) || {};
    profile.tech_keywords = (() => { try { return JSON.parse(profile.tech_keywords || '[]'); } catch { return []; } })();
    for (const tech of techs) {
      tech.tech_keywords = (() => { try { return JSON.parse(tech.tech_keywords || '[]'); } catch { return []; } })();
      const top = computeAllMatches({ tenant_id: t.tenant_id, profile, phase_ii_tech: tech, limit: 10 });
      matchCount += (top || []).length;
    }
  }

  const opps = db.prepare('SELECT COUNT(*) c FROM opportunities').get().c;
  const sponsors = db.prepare('SELECT COUNT(*) c FROM sponsor_candidates').get().c;
  const meta = {
    snapshot_date: new Date().toISOString(),
    db_path: SNAP_PATH,
    profiles: tenants,
    opportunities: opps,
    sponsors,
    art_matches_generated: matchCount,
    snapshot_version: '0.3.0-phase3',
  };
  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2));
  closeDb();

  // Switch back to the main ledger to record the snapshot generation receipt.
  delete process.env.DB_PATH;
  delete require.cache[require.resolve('../src/core/config')];
  delete require.cache[require.resolve('../src/core/receipt')];
  delete require.cache[require.resolve('../src/db')];
  const liveReceipt = require('../src/core/receipt').emitReceipt;
  liveReceipt('snapshot_generated', {
    tenant_id: 'admin',
    snapshot_date: meta.snapshot_date,
    db_path: SNAP_PATH,
    opportunities: opps,
    sponsors,
    profile_count: tenants.length,
    art_matches_generated: matchCount,
  });

  console.log(JSON.stringify(meta, null, 2));
  console.log(`Snapshot generated: ${SNAP_PATH}`);
  console.log(`Metadata: ${META_PATH}`);
})().catch(e => { console.error(e); process.exit(1); });
