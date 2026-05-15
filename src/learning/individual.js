const fs = require('fs');
const path = require('path');
const { getDb, uid, now, safeJson } = require('../db');
const { emitReceipt } = require('../core/receipt');
const config = require('../core/config');

const CALIBRATION_THRESHOLD = config.CALIBRATION_THRESHOLD || 5;

function avg(arr) { return arr.length ? arr.reduce((a, b) => a + (b || 0), 0) / arr.length : 0; }
function sum(arr) { return arr.reduce((a, b) => a + (b || 0), 0); }
function freq(arr) { const m = {}; for (const x of arr) m[x] = (m[x] || 0) + 1; return m; }
function topN(map, n) { return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, n).map(e => e[0]); }

function recordOutcome(data) {
  const db = getDb();
  const id = uid();
  const ts = now();

  let score_accuracy = null;
  if (data.terminal_status === 'awarded') score_accuracy = data.original_score;
  else if (data.terminal_status === 'rejected') score_accuracy = data.original_score == null ? null : 100 - data.original_score;

  db.prepare(`INSERT INTO outcomes (
    id, tenant_id, opportunity_id, pipeline_id, component,
    original_score, original_tier, original_tech_alignment, original_domain_alignment,
    original_submission_type, original_timeline, original_funding_efficiency,
    source, agency, sub_agency, program, phase, topic_number, title, keywords_matched,
    funding_amount, terminal_status, outcome_date,
    rejection_reason, what_worked, what_failed,
    would_submit_again, actual_effort_hours, score_accuracy, created_at
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, data.tenant_id, data.opportunity_id, data.pipeline_id, data.component || null,
      data.original_score, data.original_tier, data.original_tech_alignment, data.original_domain_alignment,
      data.original_submission_type, data.original_timeline, data.original_funding_efficiency,
      data.source, data.agency, data.sub_agency, data.program, data.phase, data.topic_number,
      data.title, JSON.stringify(data.keywords_matched || []),
      data.funding_amount, data.terminal_status, data.outcome_date || ts.slice(0, 10),
      data.rejection_reason, data.what_worked, data.what_failed,
      data.would_submit_again ? 1 : 0, data.actual_effort_hours, score_accuracy, ts);

  emitReceipt('outcome_recorded', {
    tenant_id: data.tenant_id,
    opportunity_id: data.opportunity_id,
    terminal_status: data.terminal_status,
    original_score: data.original_score,
    score_accuracy,
  });

  generateLesson(id, data);

  // Auto-run calibration once enough terminal outcomes exist for this tenant.
  const terminalCount = db.prepare(
    "SELECT COUNT(*) c FROM outcomes WHERE tenant_id = ? AND terminal_status IN ('awarded','rejected')"
  ).get(data.tenant_id).c;
  if (terminalCount >= CALIBRATION_THRESHOLD && terminalCount % CALIBRATION_THRESHOLD === 0) {
    try {
      runCalibration({ tenant_id: data.tenant_id });
    } catch (e) {
      emitReceipt('calibration_error', { tenant_id: data.tenant_id, error: e.message });
    }
  }

  return id;
}

function generateLesson(outcome_id, data) {
  const db = getDb();
  const tags = [data.source, data.agency, data.program, data.phase, data.component].filter(Boolean);
  const scoreNote = data.original_score == null
    ? ''
    : ` Score was ${Math.round(data.original_score)} (${data.original_tier || '—'}).`;
  let lesson = '';
  if (data.terminal_status === 'awarded') {
    lesson = `${data.title} — WON. ${data.what_worked || 'No notes recorded.'} Effort: ${data.actual_effort_hours != null ? data.actual_effort_hours + 'h' : '?'}.${scoreNote}`;
    tags.push('win');
  } else if (data.terminal_status === 'rejected') {
    lesson = `${data.title} — LOST. ${data.what_failed || 'No notes recorded.'}${data.rejection_reason ? ' Reason: ' + data.rejection_reason : ''} Would submit again: ${data.would_submit_again ? 'Yes' : 'No'}.${scoreNote}`;
    tags.push('loss');
  } else if (data.terminal_status === 'withdrawn') {
    lesson = `${data.title} — WITHDRAWN before submission.${data.rejection_reason ? ' Reason: ' + data.rejection_reason : ''} Hours spent: ${data.actual_effort_hours || 0}h.`;
    tags.push('withdrawn');
  } else {
    lesson = `${data.title} — NO RESPONSE received.${scoreNote}`;
    tags.push('no_response');
  }
  db.prepare('INSERT INTO lessons (id, tenant_id, outcome_id, opportunity_id, title, outcome, lesson, tags, created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(uid(), data.tenant_id, outcome_id, data.opportunity_id, data.title, data.terminal_status, lesson, JSON.stringify(tags), now());
}

function generateRecommendations(analysis, topWinKw, topLossKw) {
  const recs = [];
  for (const [name, d] of Object.entries(analysis)) {
    if (!d.predictive && Math.abs(d.diff) < 5) {
      recs.push({ type: 'weight', dimension: name, suggestion: `${name} shows low predictive power (wins ${d.win_avg} vs losses ${d.loss_avg}). Consider reducing its weight.` });
    } else if (d.diff > 20) {
      recs.push({ type: 'weight', dimension: name, suggestion: `${name} is a strong predictor (wins +${d.diff} over losses). Weight is well-calibrated.` });
    }
  }
  if (topWinKw.length) recs.push({ type: 'keywords', suggestion: `Keywords most common in WINS: ${topWinKw.join(', ')}. Consider promoting these to a higher tier.` });
  if (topLossKw.length) recs.push({ type: 'keywords', suggestion: `Keywords most common in LOSSES: ${topLossKw.join(', ')}. These may inflate scores without predicting wins.` });
  return recs;
}

function runCalibration({ tenant_id }) {
  const db = getDb();
  const outcomes = db.prepare("SELECT * FROM outcomes WHERE tenant_id = ? AND terminal_status IN ('awarded','rejected') ORDER BY created_at DESC LIMIT 50").all(tenant_id);
  if (outcomes.length < CALIBRATION_THRESHOLD) {
    emitReceipt('calibration_skipped', { tenant_id, reason: 'insufficient_outcomes', count: outcomes.length });
    return null;
  }
  const wins = outcomes.filter(o => o.terminal_status === 'awarded');
  const losses = outcomes.filter(o => o.terminal_status === 'rejected');
  const dims = ['tech_alignment', 'domain_alignment', 'submission_type', 'timeline', 'funding_efficiency'];
  const analysis = {};
  for (const d of dims) {
    const winAvg = avg(wins.map(o => o[`original_${d}`]));
    const lossAvg = avg(losses.map(o => o[`original_${d}`]));
    const diff = winAvg - lossAvg;
    analysis[d] = { win_avg: Math.round(winAvg), loss_avg: Math.round(lossAvg), diff: Math.round(diff), predictive: Math.abs(diff) > 10 };
  }
  const winKw = wins.flatMap(o => safeJson(o.keywords_matched, []));
  const lossKw = losses.flatMap(o => safeJson(o.keywords_matched, []));
  const topWinKw = topN(freq(winKw), 5);
  const topLossKw = topN(freq(lossKw), 5);
  const accuracies = outcomes.map(o => o.score_accuracy).filter(a => a != null);

  const report = {
    tenant_id,
    generated_at: now(),
    outcomes_count: outcomes.length,
    wins: wins.length,
    losses: losses.length,
    win_rate: Math.round((wins.length / outcomes.length) * 100),
    overall_accuracy: accuracies.length ? Math.round(avg(accuracies)) : null,
    dimension_analysis: analysis,
    top_win_keywords: topWinKw,
    top_loss_keywords: topLossKw,
    recommendations: generateRecommendations(analysis, topWinKw, topLossKw),
  };
  emitReceipt('calibration_report_computed', { tenant_id, outcomes_count: outcomes.length, wins: wins.length, win_rate: report.win_rate });
  return report;
}

function computeROI({ tenant_id }) {
  const db = getDb();
  const outcomes = db.prepare("SELECT * FROM outcomes WHERE tenant_id = ? AND terminal_status != 'withdrawn'").all(tenant_id);
  const wins = outcomes.filter(o => o.terminal_status === 'awarded');
  const losses = outcomes.filter(o => o.terminal_status === 'rejected' || o.terminal_status === 'no_response');

  const totalHours = sum(outcomes.map(o => o.actual_effort_hours || 0));
  const winHours = sum(wins.map(o => o.actual_effort_hours || 0));
  const lossHours = sum(losses.map(o => o.actual_effort_hours || 0));
  const totalFunding = sum(wins.map(o => o.funding_amount || 0));

  const components = [...new Set(outcomes.map(o => o.component).filter(Boolean))];
  const byComponent = components.map(c => {
    const cAll = outcomes.filter(o => o.component === c);
    const cWins = cAll.filter(o => o.terminal_status === 'awarded');
    const cHours = sum(cAll.map(o => o.actual_effort_hours || 0));
    const cFunding = sum(cWins.map(o => o.funding_amount || 0));
    return { component: c, submitted: cAll.length, won: cWins.length, hours: Math.round(cHours), funding_won: cFunding, dollars_per_hour: cHours > 0 ? Math.round(cFunding / cHours) : 0 };
  }).sort((a, b) => b.dollars_per_hour - a.dollars_per_hour);

  return {
    tenant_id,
    submitted: outcomes.length,
    won: wins.length,
    win_rate: outcomes.length ? Math.round((wins.length / outcomes.length) * 100) : 0,
    total_hours: Math.round(totalHours),
    avg_hours_per_win: wins.length ? Math.round(winHours / wins.length) : null,
    avg_hours_per_loss: losses.length ? Math.round(lossHours / losses.length) : null,
    total_funding_won: totalFunding,
    dollars_per_hour: winHours > 0 ? Math.round(totalFunding / winHours) : null,
    best_component: byComponent[0] || null,
    by_component: byComponent,
  };
}

function getLessons({ tenant_id, limit = 30 }) {
  return getDb().prepare('SELECT * FROM lessons WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?').all(tenant_id, limit);
}

const SANDBOX_TENANT = 'sandbox';
const SANDBOX_TABLES = ['pipeline', 'outcomes', 'lessons', 'sponsor_pipeline', 'weight_history', 'art_matches', 'sba_eligibility', 'phase_ii_techs', 'scores'];

// Pre-seed the sandbox tenant with a realistic pipeline + outcome history so a
// reviewer hitting /demo immediately sees a populated Pipeline and a working
// Learnings view (lessons, ROI, calibration) — no setup, no friction.
function loadSandboxActivity() {
  const file = path.join(config.ROOT, 'seed', 'sandbox_demo_activity.json');
  if (!fs.existsSync(file)) return { pipeline: 0, outcomes: 0 };
  const items = JSON.parse(fs.readFileSync(file, 'utf8')).items || [];
  const db = getDb();
  // Idempotent: clear any prior sandbox activity so re-running seed (e.g. a
  // redeploy on a persistent disk) never duplicates the demo history.
  for (const t of ['pipeline', 'outcomes', 'lessons']) {
    db.prepare(`DELETE FROM ${t} WHERE tenant_id = ?`).run(SANDBOX_TENANT);
  }
  const insPipe = db.prepare('INSERT INTO pipeline (id, tenant_id, opportunity_id, title, source, status, deadline, funding_amount, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
  let pipelineRows = 0;
  let outcomeRows = 0;
  for (const it of items) {
    const pid = uid();
    const status = it.outcome ? it.outcome.terminal_status : (it.status || 'watching');
    const created = it.created_at || now();
    insPipe.run(pid, SANDBOX_TENANT, it.opportunity_id, it.title, it.source || 'sbir_gov',
      status, it.deadline || null, it.funding_amount || null, it.notes || null, created, now());
    pipelineRows++;
    if (it.outcome) {
      recordOutcome({
        tenant_id: SANDBOX_TENANT,
        pipeline_id: pid,
        opportunity_id: it.opportunity_id,
        component: it.component,
        original_score: it.original_score,
        original_tier: it.original_tier,
        original_tech_alignment: it.original_tech_alignment,
        original_domain_alignment: it.original_domain_alignment,
        original_submission_type: it.original_submission_type,
        original_timeline: it.original_timeline,
        original_funding_efficiency: it.original_funding_efficiency,
        source: it.source || 'sbir_gov',
        agency: it.agency,
        sub_agency: it.sub_agency,
        program: it.program,
        phase: it.phase,
        topic_number: it.topic_number,
        title: it.title,
        keywords_matched: it.keywords_matched || [],
        funding_amount: it.outcome.funding_amount != null ? it.outcome.funding_amount : it.funding_amount,
        terminal_status: it.outcome.terminal_status,
        outcome_date: it.outcome.outcome_date,
        rejection_reason: it.outcome.rejection_reason,
        what_worked: it.outcome.what_worked,
        what_failed: it.outcome.what_failed,
        would_submit_again: it.outcome.would_submit_again,
        actual_effort_hours: it.outcome.actual_effort_hours,
      });
      outcomeRows++;
    }
  }
  emitReceipt('sandbox_activity_seeded', { tenant_id: SANDBOX_TENANT, pipeline_rows: pipelineRows, outcome_rows: outcomeRows });
  return { pipeline: pipelineRows, outcomes: outcomeRows };
}

function resetSandboxTenant() {
  const db = getDb();
  const before = {};
  for (const t of SANDBOX_TABLES) {
    try {
      const c = db.prepare(`SELECT COUNT(*) c FROM ${t} WHERE tenant_id = ?`).get(SANDBOX_TENANT);
      before[t] = c ? c.c : 0;
      db.prepare(`DELETE FROM ${t} WHERE tenant_id = ?`).run(SANDBOX_TENANT);
    } catch (e) {
      before[t] = `error:${e.message}`;
    }
  }
  let reseed = 0;
  try {
    const seed = require('../../scripts/seed_load');
    if (typeof seed.loadSandbox === 'function') reseed = seed.loadSandbox();
    else if (typeof seed.load === 'function') { seed.load(); reseed = 1; }
  } catch (e) {
    emitReceipt('sandbox_reset_error', { tenant_id: 'admin', error: e.message });
  }
  emitReceipt('sandbox_reset', { tenant_id: SANDBOX_TENANT, cleared: before, reseeded: reseed, ts: now() });
  return { tenant_id: SANDBOX_TENANT, cleared: before, reseeded: reseed };
}

module.exports = {
  recordOutcome, runCalibration, generateLesson, computeROI, getLessons,
  loadSandboxActivity, resetSandboxTenant, SANDBOX_TENANT,
};
