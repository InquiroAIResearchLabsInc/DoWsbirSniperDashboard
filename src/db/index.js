const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const config = require('../core/config');

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

function closeDb() { if (_db) { _db.close(); _db = null; } }

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function now() { return new Date().toISOString(); }

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      tenant_id     TEXT PRIMARY KEY,
      display_name  TEXT,
      role          TEXT NOT NULL DEFAULT 'pilot',
      created_at    TEXT NOT NULL,
      last_seen_at  TEXT
    );

    CREATE TABLE IF NOT EXISTS profiles (
      tenant_id              TEXT PRIMARY KEY,
      company_name           TEXT,
      uei                    TEXT,
      phase_ii_count_self    INTEGER DEFAULT 0,
      tech_keywords          TEXT,
      trl_self_declared      INTEGER,
      private_match_secured  INTEGER DEFAULT 0,
      commercial_viability   INTEGER DEFAULT 0,
      pom_commitment_secured INTEGER DEFAULT 0,
      dow_match_secured      INTEGER DEFAULT 0,
      updated_at             TEXT NOT NULL,
      FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
    );

    CREATE TABLE IF NOT EXISTS snapshots (
      id          TEXT PRIMARY KEY,
      source      TEXT NOT NULL,
      scraped_at  TEXT NOT NULL,
      count       INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS opportunities (
      id                  TEXT PRIMARY KEY,
      source              TEXT NOT NULL,
      source_url          TEXT,
      title               TEXT NOT NULL,
      description         TEXT,
      agency              TEXT,
      sub_agency          TEXT,
      component           TEXT,
      program             TEXT,
      phase               TEXT,
      topic_code          TEXT,
      naics_codes         TEXT,
      keywords            TEXT,
      posted_date         TEXT,
      open_date           TEXT,
      close_date          TEXT,
      is_rolling          INTEGER DEFAULT 0,
      days_remaining      INTEGER,
      funding_min         REAL,
      funding_max         REAL,
      currency            TEXT DEFAULT 'USD',
      first_seen          TEXT NOT NULL,
      last_updated        TEXT NOT NULL,
      snapshot_id         TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_opp_source ON opportunities(source);
    CREATE INDEX IF NOT EXISTS idx_opp_component ON opportunities(component);
    CREATE INDEX IF NOT EXISTS idx_opp_close_date ON opportunities(close_date);

    CREATE TABLE IF NOT EXISTS scores (
      id                  TEXT PRIMARY KEY,
      opportunity_id      TEXT NOT NULL,
      tenant_id           TEXT NOT NULL,
      fit_score           REAL,
      score_tier          TEXT,
      score_tech          REAL,
      score_domain        REAL,
      score_type          REAL,
      score_timeline      REAL,
      score_funding       REAL,
      keywords_matched    TEXT,
      computed_at         TEXT NOT NULL,
      weights_snapshot    TEXT,
      receipt_hash        TEXT,
      FOREIGN KEY (opportunity_id) REFERENCES opportunities(id)
    );
    CREATE INDEX IF NOT EXISTS idx_scores_opp_tenant ON scores(opportunity_id, tenant_id);
    CREATE INDEX IF NOT EXISTS idx_scores_tier ON scores(score_tier);

    CREATE TABLE IF NOT EXISTS diffs (
      id              TEXT PRIMARY KEY,
      diff_date       TEXT NOT NULL,
      source          TEXT NOT NULL,
      diff_type       TEXT NOT NULL,
      opportunity_id  TEXT NOT NULL,
      field_changed   TEXT,
      old_value       TEXT,
      new_value       TEXT,
      created_at      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_diffs_date ON diffs(diff_date);

    CREATE TABLE IF NOT EXISTS pipeline (
      id              TEXT PRIMARY KEY,
      tenant_id       TEXT NOT NULL,
      opportunity_id  TEXT NOT NULL,
      title           TEXT NOT NULL,
      source          TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'watching',
      deadline        TEXT,
      funding_amount  REAL,
      notes           TEXT,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_pipeline_tenant ON pipeline(tenant_id);

    CREATE TABLE IF NOT EXISTS dismissals (
      id              TEXT PRIMARY KEY,
      tenant_id       TEXT NOT NULL,
      opportunity_id  TEXT NOT NULL,
      dismissed_at    TEXT NOT NULL,
      expires_at      TEXT,
      reason          TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_dismissals_tenant ON dismissals(tenant_id, opportunity_id);

    CREATE TABLE IF NOT EXISTS outcomes (
      id                         TEXT PRIMARY KEY,
      tenant_id                  TEXT NOT NULL,
      opportunity_id             TEXT NOT NULL,
      pipeline_id                TEXT NOT NULL,
      component                  TEXT,
      original_score             REAL,
      original_tier              TEXT,
      original_tech_alignment    REAL,
      original_domain_alignment  REAL,
      original_submission_type   REAL,
      original_timeline          REAL,
      original_funding_efficiency REAL,
      source                     TEXT,
      agency                     TEXT,
      sub_agency                 TEXT,
      program                    TEXT,
      phase                      TEXT,
      topic_number               TEXT,
      title                      TEXT,
      keywords_matched           TEXT,
      funding_amount             REAL,
      terminal_status            TEXT NOT NULL,
      outcome_date               TEXT NOT NULL,
      rejection_reason           TEXT,
      what_worked                TEXT,
      what_failed                TEXT,
      would_submit_again         INTEGER,
      actual_effort_hours        REAL,
      score_accuracy             REAL,
      created_at                 TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_outcomes_tenant ON outcomes(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_outcomes_component ON outcomes(component);

    CREATE TABLE IF NOT EXISTS lessons (
      id              TEXT PRIMARY KEY,
      tenant_id       TEXT NOT NULL,
      outcome_id      TEXT NOT NULL,
      opportunity_id  TEXT NOT NULL,
      title           TEXT NOT NULL,
      outcome         TEXT NOT NULL,
      lesson          TEXT NOT NULL,
      tags            TEXT,
      created_at      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS weight_history (
      id              TEXT PRIMARY KEY,
      tenant_id       TEXT NOT NULL,
      engine          TEXT NOT NULL DEFAULT 'topic',
      changed_at      TEXT NOT NULL,
      trigger         TEXT NOT NULL,
      dimension       TEXT,
      old_weight      REAL,
      new_weight      REAL,
      reason          TEXT,
      outcomes_count  INTEGER,
      weights_snapshot TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_wh_tenant_engine ON weight_history(tenant_id, engine);

    CREATE TABLE IF NOT EXISTS component_patterns (
      id              TEXT PRIMARY KEY,
      component       TEXT NOT NULL,
      dimension       TEXT NOT NULL,
      pattern_value   TEXT NOT NULL,
      supporting_n    INTEGER NOT NULL,
      computed_at     TEXT NOT NULL,
      kanon_min       INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cp_component ON component_patterns(component);

    -- ART v2 tables

    CREATE TABLE IF NOT EXISTS phase_ii_techs (
      id                     TEXT PRIMARY KEY,
      tenant_id              TEXT NOT NULL,
      topic_code             TEXT,
      title                  TEXT,
      award_date             TEXT,
      originating_component  TEXT,
      tech_keywords          TEXT,
      trl                    INTEGER,
      sbir_award_url         TEXT,
      created_at             TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_p2_tenant ON phase_ii_techs(tenant_id);

    CREATE TABLE IF NOT EXISTS sponsor_candidates (
      id                          TEXT PRIMARY KEY,
      name                        TEXT NOT NULL,
      component                   TEXT NOT NULL,
      parent_command              TEXT,
      public_url                  TEXT,
      priority_tags               TEXT,
      historical_phase_iii_count  INTEGER DEFAULT 0,
      historical_phase_iii_total_usd REAL DEFAULT 0,
      last_refreshed_at           TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sc_component ON sponsor_candidates(component);

    CREATE TABLE IF NOT EXISTS art_matches (
      id                       TEXT PRIMARY KEY,
      tenant_id                TEXT NOT NULL,
      phase_ii_tech_id         TEXT NOT NULL,
      sponsor_candidate_id     TEXT NOT NULL,
      match_score              REAL NOT NULL,
      match_band               TEXT NOT NULL,
      sub_score_priority       REAL,
      sub_score_transition     REAL,
      sub_score_scouting       REAL,
      sub_score_maturity       REAL,
      sub_score_recency        REAL,
      evidence                 TEXT,
      computed_at              TEXT NOT NULL,
      payload_hash             TEXT,
      receipt_hash             TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_am_tenant ON art_matches(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_am_tech ON art_matches(phase_ii_tech_id);

    CREATE TABLE IF NOT EXISTS sponsor_pipeline (
      id                       TEXT PRIMARY KEY,
      tenant_id                TEXT NOT NULL,
      phase_ii_tech_id         TEXT NOT NULL,
      sponsor_candidate_id     TEXT NOT NULL,
      status                   TEXT NOT NULL DEFAULT 'targeting',
      notes                    TEXT,
      created_at               TEXT NOT NULL,
      updated_at               TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sp_tenant ON sponsor_pipeline(tenant_id);

    CREATE TABLE IF NOT EXISTS sba_eligibility (
      id                       TEXT PRIMARY KEY,
      tenant_id                TEXT NOT NULL,
      computed_at              TEXT NOT NULL,
      eligible                 INTEGER NOT NULL,
      missing_criteria         TEXT,
      evidence                 TEXT,
      receipt_hash             TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sba_tenant ON sba_eligibility(tenant_id);

    CREATE TABLE IF NOT EXISTS source_status (
      source        TEXT PRIMARY KEY,
      last_run      TEXT,
      last_success  TEXT,
      last_count    INTEGER,
      last_error    TEXT,
      status        TEXT DEFAULT 'ok'
    );

    CREATE TABLE IF NOT EXISTS digests (
      id          TEXT PRIMARY KEY,
      digest_date TEXT NOT NULL,
      content     TEXT NOT NULL,
      generated_at TEXT NOT NULL
    );
  `);

  const sources = ['sbir_gov', 'sam_sources_sought', 'manual'];
  const upsertSrc = db.prepare("INSERT OR IGNORE INTO source_status (source, status) VALUES (?, 'ok')");
  for (const s of sources) upsertSrc.run(s);

  const adminCount = db.prepare("SELECT COUNT(*) c FROM tenants WHERE tenant_id = 'admin'").get();
  if (adminCount.c === 0) {
    db.prepare("INSERT INTO tenants (tenant_id, display_name, role, created_at) VALUES ('admin', 'Admin', 'admin', ?)").run(now());
  }
  const defaultCount = db.prepare("SELECT COUNT(*) c FROM tenants WHERE tenant_id = 'default'").get();
  if (defaultCount.c === 0) {
    db.prepare("INSERT INTO tenants (tenant_id, display_name, role, created_at) VALUES ('default', 'Public', 'anonymous', ?)").run(now());
  }
}

function safeJson(str, fallback) {
  try { return str ? JSON.parse(str) : fallback; } catch { return fallback; }
}

module.exports = { getDb, closeDb, uid, now, safeJson };
