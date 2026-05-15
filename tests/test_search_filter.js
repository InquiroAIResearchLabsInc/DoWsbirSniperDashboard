const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsip-sf-'));
process.env.DB_PATH = path.join(tmp, 'sf.db');
process.env.RECEIPTS_PATH = path.join(tmp, 'sf.jsonl');
process.env.MERKLE_ROOT_PATH = path.join(tmp, 'sf.merkle');

const { getDb, uid, now } = require('../src/db');
const db = getDb();

// ── Seed opportunities + scores ──────────────────────────────────────────────

const TS = now();
function opp(id, title, component, description = '') {
  db.prepare('INSERT INTO opportunities (id, source, title, description, component, first_seen, last_updated) VALUES (?,?,?,?,?,?,?)')
    .run(id, 'test', title, description, component, TS, TS);
}
function score(id, oppId, tenantId, fitScore, tier) {
  db.prepare('INSERT INTO scores (id, opportunity_id, tenant_id, fit_score, score_tier, computed_at) VALUES (?,?,?,?,?,?)')
    .run(id, oppId, tenantId, fitScore, tier, TS);
}

opp('o1', 'Autonomous UAS Swarm Technology', 'army', 'machine learning coordination');
opp('o2', 'Quantum Sensing for Navigation', 'navy', 'GPS-denied environments');
opp('o3', 'Directed Energy Weapon Integration', 'air_force', 'laser systems');
opp('o4', 'Biodefense Detection Platform', 'cbd', 'chemical biological detection');
opp('o5', 'Space Domain Awareness', 'space_force', 'orbital tracking sensors');

score('s1', 'o1', 'admin', 85, 'PRIME');
score('s2', 'o2', 'admin', 72, 'EVALUATE');
score('s3', 'o3', 'admin', 55, 'STRETCH');
score('s4', 'o4', 'admin', 88, 'PRIME');
score('s5', 'o5', 'admin', 30, 'SKIP');

// ── Seed ART data ─────────────────────────────────────────────────────────────

const sc1 = uid(), sc2 = uid(), sc3 = uid();
db.prepare('INSERT INTO sponsor_candidates (id, name, component, priority_tags) VALUES (?,?,?,?)')
  .run(sc1, 'Army AI Lab', 'army', '[]');
db.prepare('INSERT INTO sponsor_candidates (id, name, component, priority_tags) VALUES (?,?,?,?)')
  .run(sc2, 'NavSea Research Division', 'navy', '[]');
db.prepare('INSERT INTO sponsor_candidates (id, name, component, priority_tags) VALUES (?,?,?,?)')
  .run(sc3, 'AFRL Directed Energy', 'air_force', '[]');

const t1 = uid(), t2 = uid();
db.prepare('INSERT INTO phase_ii_techs (id, tenant_id, topic_code, title, originating_component, tech_keywords, created_at) VALUES (?,?,?,?,?,?,?)')
  .run(t1, 'admin', 'A22-001', 'Swarm Autonomy Framework', 'army', '[]', TS);
db.prepare('INSERT INTO phase_ii_techs (id, tenant_id, topic_code, title, originating_component, tech_keywords, created_at) VALUES (?,?,?,?,?,?,?)')
  .run(t2, 'admin', 'N22-042', 'Quantum Navigation Chip', 'navy', '[]', TS);

const am1 = uid(), am2 = uid(), am3 = uid();
db.prepare('INSERT INTO art_matches (id, tenant_id, phase_ii_tech_id, sponsor_candidate_id, match_score, match_band, computed_at) VALUES (?,?,?,?,?,?,?)')
  .run(am1, 'admin', t1, sc1, 91, 'Strong', TS);
db.prepare('INSERT INTO art_matches (id, tenant_id, phase_ii_tech_id, sponsor_candidate_id, match_score, match_band, computed_at) VALUES (?,?,?,?,?,?,?)')
  .run(am2, 'admin', t2, sc2, 74, 'Promising', TS);
db.prepare('INSERT INTO art_matches (id, tenant_id, phase_ii_tech_id, sponsor_candidate_id, match_score, match_band, computed_at) VALUES (?,?,?,?,?,?,?)')
  .run(am3, 'admin', t1, sc3, 45, 'Weak', TS);

// ── Helpers matching route SQL ────────────────────────────────────────────────

function queryOpps(filters = {}, tenantId = 'admin') {
  const args = [tenantId];
  let sql = `SELECT o.*, s.fit_score, s.score_tier FROM opportunities o
             LEFT JOIN scores s ON s.opportunity_id = o.id AND s.tenant_id = ?
             WHERE 1=1`;
  if (filters.component) { sql += ' AND o.component = ?'; args.push(filters.component); }
  if (filters.tier) {
    const tier = String(filters.tier).toUpperCase();
    const TIERS = new Set(['PRIME', 'EVALUATE', 'STRETCH', 'SKIP']);
    if (TIERS.has(tier)) { sql += ' AND s.score_tier = ?'; args.push(tier); }
  }
  if (filters.min_score) {
    const ms = Number(filters.min_score);
    if (Number.isFinite(ms) && ms > 0) { sql += ' AND s.fit_score >= ?'; args.push(ms); }
  }
  if (filters.q) {
    const q = `%${String(filters.q).trim()}%`;
    if (q.length > 2) {
      sql += ' AND (o.title LIKE ? COLLATE NOCASE OR o.description LIKE ? COLLATE NOCASE OR o.topic_code LIKE ? COLLATE NOCASE)';
      args.push(q, q, q);
    }
  }
  const limit = Number.isFinite(Number(filters.limit)) ? Math.min(Math.max(Number(filters.limit), 1), 200) : 50;
  const offset = Number.isFinite(Number(filters.offset)) ? Math.min(Math.max(Number(filters.offset), 0), 100000) : 0;
  sql += ' ORDER BY s.fit_score DESC, o.close_date ASC LIMIT ? OFFSET ?';
  args.push(limit, offset);
  return db.prepare(sql).all(...args);
}

const BAND_NORMALIZE = { strong: 'Strong', promising: 'Promising', weak: 'Weak' };

function queryArt(filters = {}, tenantId = 'admin') {
  const args = [tenantId];
  let sql = `SELECT am.*, sc.name AS sponsor_name, sc.component AS sponsor_component,
                    p2.title AS phase_ii_title, p2.originating_component AS phase_ii_component
             FROM art_matches am
             LEFT JOIN sponsor_candidates sc ON sc.id = am.sponsor_candidate_id
             LEFT JOIN phase_ii_techs p2     ON p2.id = am.phase_ii_tech_id
             WHERE am.tenant_id = ?`;
  if (filters.component) { sql += ' AND p2.originating_component = ?'; args.push(filters.component); }
  if (filters.band) {
    const norm = BAND_NORMALIZE[String(filters.band).toLowerCase()];
    if (norm) { sql += ' AND am.match_band = ?'; args.push(norm); }
  }
  if (filters.min_score) {
    const ms = Number(filters.min_score);
    if (Number.isFinite(ms) && ms > 0) { sql += ' AND am.match_score >= ?'; args.push(ms); }
  }
  if (filters.q) {
    const q = `%${String(filters.q).trim()}%`;
    if (q.length > 2) {
      sql += ' AND (p2.title LIKE ? COLLATE NOCASE OR sc.name LIKE ? COLLATE NOCASE)';
      args.push(q, q);
    }
  }
  const limit = Number.isFinite(Number(filters.limit)) ? Math.min(Math.max(Number(filters.limit), 1), 200) : 50;
  const offset = Number.isFinite(Number(filters.offset)) ? Math.min(Math.max(Number(filters.offset), 0), 100000) : 0;
  sql += ' ORDER BY am.computed_at DESC, am.match_score DESC LIMIT ? OFFSET ?';
  args.push(limit, offset);
  return db.prepare(sql).all(...args);
}

// ── Topics: 7 assertions ─────────────────────────────────────────────────────

test('Topics: q matches title', () => {
  const rows = queryOpps({ q: 'quantum' });
  assert.equal(rows.length, 1);
  assert.ok(rows[0].title.toLowerCase().includes('quantum'));
});

test('Topics: q matches description', () => {
  const rows = queryOpps({ q: 'machine learning' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'o1');
});

test('Topics: component filter', () => {
  const rows = queryOpps({ component: 'navy' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].component, 'navy');
});

test('Topics: tier filter returns only PRIME', () => {
  const rows = queryOpps({ tier: 'PRIME' });
  assert.equal(rows.length, 2);
  assert.ok(rows.every(r => r.score_tier === 'PRIME'));
});

test('Topics: min_score filter excludes below threshold', () => {
  const rows = queryOpps({ min_score: 80 });
  assert.ok(rows.length >= 2);
  assert.ok(rows.every(r => r.fit_score >= 80));
});

test('Topics: q + component combined', () => {
  const rows = queryOpps({ q: 'sensing', component: 'navy' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'o2');
});

test('Topics: limit and offset pagination', () => {
  const page1 = queryOpps({ limit: 2, offset: 0 });
  const page2 = queryOpps({ limit: 2, offset: 2 });
  assert.equal(page1.length, 2);
  assert.ok(page2.length > 0);
  assert.ok(!page2.some(r => page1.some(p => p.id === r.id)), 'pages should not overlap');
});

// ── ART: 7 assertions ─────────────────────────────────────────────────────────

test('ART: q matches phase_ii_tech title', () => {
  const rows = queryArt({ q: 'swarm' });
  assert.ok(rows.length >= 1);
  assert.ok(rows.some(r => r.phase_ii_title && r.phase_ii_title.toLowerCase().includes('swarm')));
});

test('ART: q matches sponsor name', () => {
  const rows = queryArt({ q: 'NavSea' });
  assert.equal(rows.length, 1);
  assert.ok(rows[0].sponsor_name.toLowerCase().includes('navsea'));
});

test('ART: component filter on originating_component', () => {
  const rows = queryArt({ component: 'army' });
  assert.ok(rows.length >= 1);
  assert.ok(rows.every(r => r.phase_ii_component === 'army'));
});

test('ART: band filter normalises STRONG to Strong', () => {
  const rows = queryArt({ band: 'STRONG' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].match_band, 'Strong');
});

test('ART: min_score filter', () => {
  const rows = queryArt({ min_score: 80 });
  assert.ok(rows.length >= 1);
  assert.ok(rows.every(r => r.match_score >= 80));
});

test('ART: q + component combined', () => {
  const rows = queryArt({ q: 'quantum', component: 'navy' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].phase_ii_component, 'navy');
});

test('ART: limit and offset pagination', () => {
  const all = queryArt({});
  assert.equal(all.length, 3);
  const page1 = queryArt({ limit: 2, offset: 0 });
  const page2 = queryArt({ limit: 2, offset: 2 });
  assert.equal(page1.length, 2);
  assert.equal(page2.length, 1);
});
