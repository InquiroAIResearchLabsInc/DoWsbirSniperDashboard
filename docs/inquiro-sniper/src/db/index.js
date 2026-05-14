// ─── DATABASE SCHEMA & HELPERS ────────────────────────────────────────────────
const Database = require('better-sqlite3');
const config = require('../config');
const path = require('path');
const fs = require('fs');

let _db = null;

function getDb() {
  if (_db) return _db;
  const dir = path.dirname(config.DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  _db = new Database(config.DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  initSchema(_db);
  return _db;
}

function initSchema(db) {
  db.exec(`
    -- ── SNAPSHOTS ─────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS snapshots (
      id          TEXT PRIMARY KEY,
      source      TEXT NOT NULL,
      scraped_at  TEXT NOT NULL,
      count       INTEGER NOT NULL DEFAULT 0
    );

    -- ── OPPORTUNITIES ─────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS opportunities (
      id                  TEXT PRIMARY KEY,
      source              TEXT NOT NULL,
      source_url          TEXT,
      title               TEXT NOT NULL,
      description         TEXT,
      agency              TEXT,
      sub_agency          TEXT,
      program             TEXT,
      phase               TEXT,
      naics_codes         TEXT,        -- JSON array string
      keywords            TEXT,        -- JSON array string
      posted_date         TEXT,
      open_date           TEXT,
      close_date          TEXT,
      is_rolling          INTEGER DEFAULT 0,
      days_remaining      INTEGER,
      funding_min         REAL,
      funding_max         REAL,
      currency            TEXT DEFAULT 'USD',
      fit_score           REAL DEFAULT 0,
      ai_score            REAL,
      ai_rationale        TEXT,
      score_tier          TEXT DEFAULT 'SKIP',
      score_tech          REAL DEFAULT 0,
      score_domain        REAL DEFAULT 0,
      score_type          REAL DEFAULT 0,
      score_timeline      REAL DEFAULT 0,
      score_funding       REAL DEFAULT 0,
      keywords_matched    TEXT,        -- JSON array of matched keyword strings
      divergence_flag     INTEGER DEFAULT 0,
      dismissed           INTEGER DEFAULT 0,
      dismissed_at        TEXT,
      added_to_pipeline   INTEGER DEFAULT 0,
      pipeline_status     TEXT,
      notes               TEXT,
      first_seen          TEXT NOT NULL,
      last_updated        TEXT NOT NULL,
      snapshot_id         TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_opp_source ON opportunities(source);
    CREATE INDEX IF NOT EXISTS idx_opp_score_tier ON opportunities(score_tier);
    CREATE INDEX IF NOT EXISTS idx_opp_close_date ON opportunities(close_date);
    CREATE INDEX IF NOT EXISTS idx_opp_dismissed ON opportunities(dismissed);

    -- ── DIFFS ─────────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS diffs (
      id              TEXT PRIMARY KEY,
      diff_date       TEXT NOT NULL,
      source          TEXT NOT NULL,
      diff_type       TEXT NOT NULL,   -- new | closed | changed | closing_soon | warning
      opportunity_id  TEXT NOT NULL,
      field_changed   TEXT,            -- for 'changed' type
      old_value       TEXT,
      new_value       TEXT,
      created_at      TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_diffs_date ON diffs(diff_date);
    CREATE INDEX IF NOT EXISTS idx_diffs_source ON diffs(source);

    -- ── PIPELINE ──────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS pipeline (
      id              TEXT PRIMARY KEY,
      opportunity_id  TEXT NOT NULL,
      title           TEXT NOT NULL,
      source          TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'watching',
      deadline        TEXT,
      funding_amount  REAL,
      notes           TEXT,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL,
      FOREIGN KEY (opportunity_id) REFERENCES opportunities(id)
    );

    -- ── OUTCOMES ──────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS outcomes (
      id                        TEXT PRIMARY KEY,
      opportunity_id            TEXT NOT NULL,
      pipeline_id               TEXT NOT NULL,
      original_score            REAL,
      original_tier             TEXT,
      original_tech_alignment   REAL,
      original_domain_alignment REAL,
      original_submission_type  REAL,
      original_timeline         REAL,
      original_funding_efficiency REAL,
      ai_score                  REAL,
      source                    TEXT,
      agency                    TEXT,
      sub_agency                TEXT,
      program                   TEXT,
      phase                     TEXT,
      topic_number              TEXT,
      title                     TEXT,
      keywords_matched          TEXT,  -- JSON
      funding_amount            REAL,
      terminal_status           TEXT NOT NULL,
      outcome_date              TEXT NOT NULL,
      rejection_reason          TEXT,
      what_worked               TEXT,
      what_failed               TEXT,
      would_submit_again        INTEGER,
      actual_effort_hours       REAL,
      score_accuracy            REAL,
      created_at                TEXT NOT NULL,
      FOREIGN KEY (opportunity_id) REFERENCES opportunities(id),
      FOREIGN KEY (pipeline_id) REFERENCES pipeline(id)
    );

    -- ── LESSONS ───────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS lessons (
      id              TEXT PRIMARY KEY,
      outcome_id      TEXT NOT NULL,
      opportunity_id  TEXT NOT NULL,
      title           TEXT NOT NULL,
      outcome         TEXT NOT NULL,
      lesson          TEXT NOT NULL,
      tags            TEXT,            -- JSON array
      created_at      TEXT NOT NULL,
      FOREIGN KEY (outcome_id) REFERENCES outcomes(id)
    );

    -- ── WEIGHT HISTORY ────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS weight_history (
      id              TEXT PRIMARY KEY,
      changed_at      TEXT NOT NULL,
      trigger         TEXT NOT NULL,   -- calibration | manual | initial
      dimension       TEXT,
      old_weight      REAL,
      new_weight      REAL,
      keyword         TEXT,
      old_tier        TEXT,
      new_tier        TEXT,
      reason          TEXT,
      outcomes_count  INTEGER,
      weights_snapshot TEXT            -- JSON of all weights at time of change
    );

    -- ── DIGEST HISTORY ────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS digests (
      id          TEXT PRIMARY KEY,
      digest_date TEXT NOT NULL,
      content     TEXT NOT NULL,       -- JSON digest data
      generated_at TEXT NOT NULL
    );

    -- ── SOURCE STATUS ─────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS source_status (
      source        TEXT PRIMARY KEY,
      last_run      TEXT,
      last_success  TEXT,
      last_count    INTEGER,
      last_error    TEXT,
      status        TEXT DEFAULT 'ok'  -- ok | error | watch
    );
  `);

  // Seed initial source statuses
  const sources = ['sbir_gov','sam_gov','grants_gov','nsf_seedfund','dasa_uk','diana_nato','diu','spacewerx','afwerx'];
  const upsert = db.prepare(`
    INSERT OR IGNORE INTO source_status (source, status)
    VALUES (?, 'ok')
  `);
  for (const src of sources) upsert.run(src);

  // Seed initial weight history entry
  const hasWeights = db.prepare('SELECT COUNT(*) as c FROM weight_history').get();
  if (hasWeights.c === 0) {
    db.prepare(`
      INSERT INTO weight_history (id, changed_at, trigger, dimension, old_weight, new_weight, reason, outcomes_count, weights_snapshot)
      VALUES (?, ?, 'initial', 'all', null, null, 'Initial weights per spec Section 5', 0, ?)
    `).run(uid(), new Date().toISOString(), JSON.stringify({
      tech_alignment: 0.40,
      domain_alignment: 0.25,
      submission_type: 0.15,
      timeline: 0.10,
      funding_efficiency: 0.10
    }));
  }
}

// ── HELPERS ──────────────────────────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function now() {
  return new Date().toISOString();
}

function upsertOpportunity(opp) {
  const db = getDb();
  const existing = db.prepare('SELECT id, first_seen FROM opportunities WHERE id = ?').get(opp.id);
  const ts = now();
  if (existing) {
    db.prepare(`
      UPDATE opportunities SET
        source_url=?, title=?, description=?, agency=?, sub_agency=?, program=?, phase=?,
        naics_codes=?, keywords=?, posted_date=?, open_date=?, close_date=?, is_rolling=?,
        days_remaining=?, funding_min=?, funding_max=?, currency=?,
        fit_score=?, ai_score=?, ai_rationale=?, score_tier=?,
        score_tech=?, score_domain=?, score_type=?, score_timeline=?, score_funding=?,
        keywords_matched=?, divergence_flag=?,
        last_updated=?, snapshot_id=?
      WHERE id=?
    `).run(
      opp.source_url, opp.title, opp.description, opp.agency, opp.sub_agency,
      opp.program, opp.phase, JSON.stringify(opp.naics_codes || []),
      JSON.stringify(opp.keywords || []), opp.posted_date, opp.open_date,
      opp.close_date, opp.is_rolling ? 1 : 0, opp.days_remaining,
      opp.funding_min, opp.funding_max, opp.currency || 'USD',
      opp.fit_score || 0, opp.ai_score, opp.ai_rationale, opp.score_tier || 'SKIP',
      opp.score_tech || 0, opp.score_domain || 0, opp.score_type || 0,
      opp.score_timeline || 0, opp.score_funding || 0,
      JSON.stringify(opp.keywords_matched || []), opp.divergence_flag ? 1 : 0,
      ts, opp.snapshot_id, opp.id
    );
    return { action: 'updated', existing };
  } else {
    db.prepare(`
      INSERT INTO opportunities (
        id, source, source_url, title, description, agency, sub_agency, program, phase,
        naics_codes, keywords, posted_date, open_date, close_date, is_rolling,
        days_remaining, funding_min, funding_max, currency,
        fit_score, ai_score, ai_rationale, score_tier,
        score_tech, score_domain, score_type, score_timeline, score_funding,
        keywords_matched, divergence_flag,
        dismissed, added_to_pipeline, first_seen, last_updated, snapshot_id
      ) VALUES (
        ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,0,?,?,?
      )
    `).run(
      opp.id, opp.source, opp.source_url, opp.title, opp.description,
      opp.agency, opp.sub_agency, opp.program, opp.phase,
      JSON.stringify(opp.naics_codes || []), JSON.stringify(opp.keywords || []),
      opp.posted_date, opp.open_date, opp.close_date, opp.is_rolling ? 1 : 0,
      opp.days_remaining, opp.funding_min, opp.funding_max, opp.currency || 'USD',
      opp.fit_score || 0, opp.ai_score, opp.ai_rationale, opp.score_tier || 'SKIP',
      opp.score_tech || 0, opp.score_domain || 0, opp.score_type || 0,
      opp.score_timeline || 0, opp.score_funding || 0,
      JSON.stringify(opp.keywords_matched || []), opp.divergence_flag ? 1 : 0,
      ts, ts, opp.snapshot_id
    );
    return { action: 'inserted' };
  }
}

function getOpportunities(filters = {}) {
  const db = getDb();

  // P0.2: auto-resurrect rows dismissed more than DISMISS_EXPIRY_DAYS ago.
  // Hide forever was wrong — spec Section 6 calls for 90-day hide, then return.
  resurrectExpiredDismissals();

  // Build SELECT
  let query = 'SELECT * FROM opportunities WHERE dismissed = 0';
  const params = [];
  if (filters.tier) { query += ' AND score_tier = ?'; params.push(filters.tier); }
  if (filters.source) { query += ' AND source = ?'; params.push(filters.source); }
  if (filters.min_score != null) { query += ' AND fit_score >= ?'; params.push(filters.min_score); }
  if (filters.max_score != null) { query += ' AND fit_score <= ?'; params.push(filters.max_score); }
  if (filters.agency) { query += ' AND agency LIKE ?'; params.push(`%${filters.agency}%`); }
  if (filters.program) { query += ' AND (program LIKE ? OR phase LIKE ? OR title LIKE ? OR description LIKE ?)';
    const p = `%${filters.program}%`; params.push(p, p, p, p); }
  if (filters.phase) { query += ' AND (phase LIKE ? OR title LIKE ?)';
    const p = `%${filters.phase}%`; params.push(p, p); }
  if (filters.funding_min != null) { query += ' AND (funding_max IS NULL OR funding_max >= ?)'; params.push(filters.funding_min); }
  if (filters.funding_max != null) { query += ' AND (funding_min IS NULL OR funding_min <= ?)'; params.push(filters.funding_max); }
  if (filters.closing_within_days != null) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + filters.closing_within_days);
    query += ' AND (is_rolling = 1 OR (close_date IS NOT NULL AND close_date <= ?))';
    params.push(cutoff.toISOString().slice(0, 10));
  }
  query += ' ORDER BY fit_score DESC, close_date ASC';
  if (filters.limit) { query += ' LIMIT ?'; params.push(filters.limit); }
  const rows = db.prepare(query).all(...params);
  return rows.map(deserializeOpp);
}

// P0.2: Resurrect rows whose dismissal has expired (DISMISS_EXPIRY_DAYS).
// Idempotent — safe to call on every read.
function resurrectExpiredDismissals() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (config.DISMISS_EXPIRY_DAYS || 90));
  getDb().prepare(`
    UPDATE opportunities
       SET dismissed = 0, dismissed_at = NULL
     WHERE dismissed = 1
       AND dismissed_at IS NOT NULL
       AND dismissed_at < ?
  `).run(cutoff.toISOString());
}

// P0.3: Compute volatile fields at read time so they're always fresh.
// days_remaining ages every day; score_tier follows fit_score.
function computeDaysRemaining(closeDate, isRolling) {
  if (isRolling) return null;
  if (!closeDate) return null;
  const t = Date.parse(closeDate);
  if (isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86400000);
}

function computeScoreTier(score) {
  if (score == null) return 'SKIP';
  if (score >= 80) return 'SNIPER';
  if (score >= 60) return 'EVALUATE';
  if (score >= 40) return 'STRETCH';
  return 'SKIP';
}

function deserializeOpp(row) {
  if (!row) return null;
  const isRolling = row.is_rolling === 1;
  // P0.3: always recompute volatile fields on read — stored values go stale.
  const daysRemaining = computeDaysRemaining(row.close_date, isRolling);
  const scoreTier = computeScoreTier(row.fit_score);
  return {
    ...row,
    naics_codes: safeJson(row.naics_codes, []),
    keywords: safeJson(row.keywords, []),
    keywords_matched: safeJson(row.keywords_matched, []),
    is_rolling: isRolling,
    dismissed: row.dismissed === 1,
    added_to_pipeline: row.added_to_pipeline === 1,
    divergence_flag: row.divergence_flag === 1,
    days_remaining: daysRemaining,
    score_tier: scoreTier,
  };
}

function safeJson(str, fallback) {
  try { return str ? JSON.parse(str) : fallback; } catch { return fallback; }
}

function updateSourceStatus(source, data) {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO source_status (source, last_run, last_success, last_count, last_error, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(source, data.last_run || now(), data.last_success, data.last_count, data.last_error, data.status || 'ok');
}

function getSourceStatuses() {
  return getDb().prepare('SELECT * FROM source_status').all();
}

function insertDiff(diff) {
  getDb().prepare(`
    INSERT OR IGNORE INTO diffs (id, diff_date, source, diff_type, opportunity_id, field_changed, old_value, new_value, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uid(), diff.diff_date, diff.source, diff.diff_type, diff.opportunity_id, diff.field_changed, diff.old_value, diff.new_value, now());
}

function getDiffs(windowDays = 7) {
  const since = new Date();
  since.setDate(since.getDate() - windowDays);
  return getDb().prepare(
    'SELECT d.*, o.title, o.agency, o.score_tier, o.fit_score FROM diffs d LEFT JOIN opportunities o ON d.opportunity_id = o.id WHERE d.diff_date >= ? ORDER BY d.created_at DESC'
  ).all(since.toISOString().slice(0, 10));
}

function insertSnapshot(source, count) {
  const id = uid();
  getDb().prepare('INSERT INTO snapshots (id, source, scraped_at, count) VALUES (?, ?, ?, ?)').run(id, source, now(), count);
  return id;
}

module.exports = { getDb, uid, now, upsertOpportunity, getOpportunities, deserializeOpp, safeJson, updateSourceStatus, getSourceStatuses, insertDiff, getDiffs, insertSnapshot, resurrectExpiredDismissals, computeDaysRemaining, computeScoreTier };
