// ─── EXPRESS API SERVER ────────────────────────────────────────────────────────
const express = require('express');
const path = require('path');
const { spawn } = require('child_process');
const { getDb, uid, now, getOpportunities, deserializeOpp, getDiffs, getSourceStatuses } = require('./db');
const { generateDigest, getLatestDigest } = require('./digest');
const { recordOutcome, runCalibrationReport, computeROI, getLessons, getOutcomes } = require('./feedback');
const config = require('./config');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'dashboard')));

// In-process scrape state — single-user dashboard, so a Map is enough.
// { state: 'idle'|'running', started_at, finished_at, sources, exit_code, stderr_tail }
const scrapeState = {
  state: 'idle',
  started_at: null,
  finished_at: null,
  sources: null,
  exit_code: null,
  stderr_tail: '',
  log_tail: '',
};

// ── OPPORTUNITIES ─────────────────────────────────────────────────────────────
app.get('/api/opportunities', (req, res) => {
  try {
    const {
      tier, source, agency, program, phase,
      min_score, max_score, funding_min, funding_max,
      closing_within_days, limit, show_all,
    } = req.query;

    const filters = {
      tier: tier || undefined,
      source: source || undefined,
      agency: agency || undefined,
      program: program || undefined,
      phase: phase || undefined,
      min_score: min_score !== undefined && min_score !== '' ? parseFloat(min_score) : undefined,
      max_score: max_score !== undefined && max_score !== '' ? parseFloat(max_score) : undefined,
      funding_min: funding_min !== undefined && funding_min !== '' ? parseFloat(funding_min) : undefined,
      funding_max: funding_max !== undefined && funding_max !== '' ? parseFloat(funding_max) : undefined,
      closing_within_days: closing_within_days !== undefined && closing_within_days !== ''
        ? parseInt(closing_within_days, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : 200,
    };
    let opps = getOpportunities(filters);

    // Default filter: SNIPER + EVALUATE only (unless show_all or explicit tier).
    const showAllFlag = show_all === '1' || show_all === 'true';
    if (!showAllFlag && !tier) {
      opps = opps.filter(o => o.score_tier === 'SNIPER' || o.score_tier === 'EVALUATE');
    }

    // Spec line 515 — empty state: if no SNIPERs visible, surface top 3 EVALUATEs.
    const hasSniper = opps.some(o => o.score_tier === 'SNIPER');
    if (!hasSniper && !tier && !showAllFlag) {
      const evaluates = opps.filter(o => o.score_tier === 'EVALUATE').slice(0, 3);
      return res.json({
        opportunities: evaluates, empty_state: true,
        message: 'No SNIPERs today — showing top 3 EVALUATEs',
      });
    }

    res.json({ opportunities: opps, empty_state: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET-by-id (P2.5 partial — used by dashboard outcome modal so it works even
// when the opportunity isn't in the current filtered view).
app.get('/api/opportunities/:id', (req, res) => {
  try {
    const { getDb, deserializeOpp } = require('./db');
    const row = getDb().prepare('SELECT * FROM opportunities WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'not found' });
    res.json(deserializeOpp(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/opportunities/:id/dismiss', (req, res) => {
  try {
    const db = getDb();
    db.prepare('UPDATE opportunities SET dismissed=1, dismissed_at=? WHERE id=?').run(now(), req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PIPELINE ──────────────────────────────────────────────────────────────────
app.get('/api/pipeline', (req, res) => {
  try {
    const db = getDb();
    const items = db.prepare(`
      SELECT p.*, o.fit_score, o.score_tier, o.source_url, o.agency, o.sub_agency, o.program, o.phase
      FROM pipeline p LEFT JOIN opportunities o ON p.opportunity_id = o.id
      ORDER BY p.deadline ASC NULLS LAST, p.created_at DESC
    `).all();
    res.json(items.map(p => ({
      ...p,
      days_to_deadline: p.deadline ? Math.ceil((new Date(p.deadline) - new Date()) / 86400000) : null,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/pipeline', (req, res) => {
  try {
    const db = getDb();
    const { opportunity_id, title, source, deadline, funding_amount, notes } = req.body;
    const id = uid();
    const ts = now();
    db.prepare(`
      INSERT INTO pipeline (id, opportunity_id, title, source, status, deadline, funding_amount, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'watching', ?, ?, ?, ?, ?)
    `).run(id, opportunity_id, title, source, deadline, funding_amount, notes || '', ts, ts);
    db.prepare('UPDATE opportunities SET added_to_pipeline=1, pipeline_status=? WHERE id=?').run('watching', opportunity_id);
    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/pipeline/:id', (req, res) => {
  try {
    const db = getDb();
    const { status, deadline, funding_amount, notes } = req.body;
    db.prepare('UPDATE pipeline SET status=?, deadline=?, funding_amount=?, notes=?, updated_at=? WHERE id=?')
      .run(status, deadline, funding_amount, notes, now(), req.params.id);
    const item = db.prepare('SELECT * FROM pipeline WHERE id=?').get(req.params.id);
    if (item) db.prepare('UPDATE opportunities SET pipeline_status=? WHERE id=?').run(status, item.opportunity_id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DIFFS ─────────────────────────────────────────────────────────────────────
app.get('/api/diffs', (req, res) => {
  try {
    const days = parseInt(req.query.days || '7');
    res.json(getDiffs(days));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DIGEST ────────────────────────────────────────────────────────────────────
app.get('/api/digest', (req, res) => {
  try {
    let digest = getLatestDigest();
    if (!digest) digest = generateDigest();
    res.json(digest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/digest/generate', (req, res) => {
  try {
    res.json(generateDigest());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── OUTCOMES & FEEDBACK ───────────────────────────────────────────────────────
app.get('/api/outcomes', (req, res) => {
  try { res.json(getOutcomes()); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/outcomes', (req, res) => {
  try {
    const id = recordOutcome(req.body);
    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/calibration', (req, res) => {
  try {
    const report = runCalibrationReport();
    const { getCurrentWeights } = require('./scorer');
    res.json({
      report: report || { message: 'Need at least 5 terminal outcomes for calibration' },
      current_weights: getCurrentWeights(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// P1.7: apply weight changes (from calibration UI or manual adjustment).
// Body: { weights: { tech_alignment, domain_alignment, ... }, reason?, trigger? }
// Validation, weight_history append, and cache refresh all happen in scorer.applyWeights.
app.post('/api/calibration/apply', (req, res) => {
  try {
    const { applyWeights } = require('./scorer');
    const { weights, reason, trigger } = req.body || {};
    if (!weights || typeof weights !== 'object') {
      return res.status(400).json({ error: 'weights object required' });
    }
    const merged = applyWeights(weights, { reason, trigger: trigger || 'manual' });
    res.json({ ok: true, weights: merged });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/roi', (req, res) => {
  try { res.json(computeROI()); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/lessons', (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '20');
    res.json(getLessons(limit));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── SOURCES ───────────────────────────────────────────────────────────────────
app.get('/api/sources', (req, res) => {
  try { res.json(getSourceStatuses()); } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── SCRAPE NOW ────────────────────────────────────────────────────────────────
// User-triggered scrape so the dashboard's "Scrape Now" button doesn't punt
// to the terminal. Spawns scrape.js and returns immediately; the UI polls
// /api/scrape/status to detect completion and refreshes when state flips back.
function runScrape(sources) {
  if (scrapeState.state === 'running') return false;
  scrapeState.state = 'running';
  scrapeState.started_at = now();
  scrapeState.finished_at = null;
  scrapeState.sources = sources && sources.length ? sources : ['(default)'];
  scrapeState.exit_code = null;
  scrapeState.stderr_tail = '';
  scrapeState.log_tail = '';

  const args = [path.join(__dirname, 'scrape.js')];
  if (sources && sources.length === 1) {
    args.push('--source', sources[0]);
  } else if (sources && sources.length > 1) {
    args.push('--all');
  }
  // No sources → default daily list (DAILY_SOURCES) per scrape.js main().

  const child = spawn(process.execPath, args, {
    cwd: path.join(__dirname, '..'),
    env: process.env,
    windowsHide: true,
  });

  const TAIL = 4000;
  child.stdout.on('data', (d) => {
    scrapeState.log_tail = (scrapeState.log_tail + d.toString()).slice(-TAIL);
  });
  child.stderr.on('data', (d) => {
    scrapeState.stderr_tail = (scrapeState.stderr_tail + d.toString()).slice(-TAIL);
  });
  child.on('exit', (code) => {
    scrapeState.state = 'idle';
    scrapeState.finished_at = now();
    scrapeState.exit_code = code;
  });
  child.on('error', (err) => {
    scrapeState.state = 'idle';
    scrapeState.finished_at = now();
    scrapeState.exit_code = -1;
    scrapeState.stderr_tail = (scrapeState.stderr_tail + '\n' + err.message).slice(-TAIL);
  });

  return true;
}

app.post('/api/scrape', (req, res) => {
  try {
    const { sources } = req.body || {};
    const ok = runScrape(Array.isArray(sources) ? sources : null);
    if (!ok) return res.status(409).json({ error: 'Scrape already running', state: scrapeState });
    res.json({ ok: true, state: scrapeState });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/scrape/status', (req, res) => {
  res.json(scrapeState);
});

// ── STATS ─────────────────────────────────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  try {
    const db = getDb();
    // P0.2: hide expired dismissals before counting (idempotent).
    const { resurrectExpiredDismissals } = require('./db');
    resurrectExpiredDismissals();

    // Count via SQL where possible, but fit_score-based tiers must be derived
    // since stored score_tier may be stale.
    const total     = db.prepare('SELECT COUNT(*) as c FROM opportunities WHERE dismissed=0').get().c;
    const snipers   = db.prepare('SELECT COUNT(*) as c FROM opportunities WHERE dismissed=0 AND fit_score >= 80').get().c;
    const evaluates = db.prepare('SELECT COUNT(*) as c FROM opportunities WHERE dismissed=0 AND fit_score >= 60 AND fit_score < 80').get().c;
    const pipeline  = db.prepare("SELECT COUNT(*) as c FROM pipeline WHERE status NOT IN ('awarded','rejected','withdrawn','no_response')").get().c;

    // closing-soon computed from close_date so it stays fresh between scrapes.
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + config.CLOSING_SOON_DAYS);
    const closing = db.prepare(`
      SELECT COUNT(*) as c FROM opportunities
      WHERE dismissed=0 AND is_rolling=0
        AND close_date IS NOT NULL
        AND close_date <= ?
        AND close_date >= date('now')
    `).get(cutoff.toISOString().slice(0, 10)).c;
    res.json({ total, snipers, evaluates, pipeline, closing });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = config.PORT;
if (require.main === module || process.env.START_SERVER) {
  app.listen(PORT, () => console.log(`\n[server] Dashboard running at http://localhost:${PORT}\n`));
}

module.exports = app;
