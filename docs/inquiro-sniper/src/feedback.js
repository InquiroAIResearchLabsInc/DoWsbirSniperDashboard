// ─── FEEDBACK LOOP: OUTCOMES, CALIBRATION, LESSONS, ROI ──────────────────────
// Section 10A of the spec
const { getDb, uid, now, safeJson } = require('./db');
const { WEIGHTS } = require('./scorer');
const config = require('./config');

// ── OUTCOME CAPTURE ───────────────────────────────────────────────────────────
function recordOutcome(data) {
  const db = getDb();
  const id = uid();
  const ts = now();

  // Compute score accuracy
  let scoreAccuracy = null;
  if (data.terminal_status === 'awarded') scoreAccuracy = data.original_score;
  else if (data.terminal_status === 'rejected') scoreAccuracy = 100 - data.original_score;

  db.prepare(`
    INSERT INTO outcomes (
      id, opportunity_id, pipeline_id,
      original_score, original_tier, original_tech_alignment,
      original_domain_alignment, original_submission_type,
      original_timeline, original_funding_efficiency, ai_score,
      source, agency, sub_agency, program, phase, topic_number,
      title, keywords_matched, funding_amount,
      terminal_status, outcome_date,
      rejection_reason, what_worked, what_failed,
      would_submit_again, actual_effort_hours,
      score_accuracy, created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, data.opportunity_id, data.pipeline_id,
    data.original_score, data.original_tier, data.original_tech_alignment,
    data.original_domain_alignment, data.original_submission_type,
    data.original_timeline, data.original_funding_efficiency, data.ai_score,
    data.source, data.agency, data.sub_agency, data.program, data.phase,
    data.topic_number, data.title, JSON.stringify(data.keywords_matched || []),
    data.funding_amount,
    data.terminal_status, data.outcome_date || ts.slice(0, 10),
    data.rejection_reason, data.what_worked, data.what_failed,
    data.would_submit_again ? 1 : 0, data.actual_effort_hours,
    scoreAccuracy, ts
  );

  // Auto-generate lesson
  generateLesson(id, data);

  // Check if calibration threshold reached
  const terminalCount = db.prepare(
    "SELECT COUNT(*) as c FROM outcomes WHERE terminal_status IN ('awarded','rejected')"
  ).get().c;

  if (terminalCount % config.CALIBRATION_THRESHOLD === 0) {
    console.log(`  [feedback] ${terminalCount} terminal outcomes — running calibration...`);
    runCalibrationReport();
  }

  return id;
}

// ── LESSON GENERATION ────────────────────────────────────────────────────────
function generateLesson(outcomeId, data) {
  const db = getDb();
  let lesson = '';
  const tags = [data.source, data.agency, data.program, data.phase].filter(Boolean);

  if (data.terminal_status === 'awarded') {
    lesson = `${data.title} — WON. ${data.what_worked || 'No notes'}. Effort: ${data.actual_effort_hours || '?'}h. Score was ${data.original_score} (${data.original_tier}).`;
    tags.push('win');
  } else if (data.terminal_status === 'rejected') {
    lesson = `${data.title} — LOST. ${data.what_failed || 'No notes'}. ${data.rejection_reason ? 'Reason: ' + data.rejection_reason + '.' : ''} Would submit again: ${data.would_submit_again ? 'Yes' : 'No'}. Score was ${data.original_score} (${data.original_tier}).`;
    tags.push('loss');
  } else if (data.terminal_status === 'withdrawn') {
    lesson = `${data.title} — WITHDRAWN before submission. Reason: ${data.rejection_reason || 'Not specified'}. Hours spent: ${data.actual_effort_hours || 0}h.`;
    tags.push('withdrawn');
  } else {
    lesson = `${data.title} — NO RESPONSE received. Score was ${data.original_score} (${data.original_tier}).`;
    tags.push('no_response');
  }

  db.prepare(`
    INSERT INTO lessons (id, outcome_id, opportunity_id, title, outcome, lesson, tags, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uid(), outcomeId, data.opportunity_id, data.title, data.terminal_status, lesson, JSON.stringify(tags), now());
}

// ── CALIBRATION ENGINE ───────────────────────────────────────────────────────
function runCalibrationReport() {
  const db = getDb();
  const outcomes = db.prepare(
    "SELECT * FROM outcomes WHERE terminal_status IN ('awarded', 'rejected') ORDER BY created_at DESC LIMIT 50"
  ).all();

  if (outcomes.length < 5) return null;

  const wins = outcomes.filter(o => o.terminal_status === 'awarded');
  const losses = outcomes.filter(o => o.terminal_status === 'rejected');

  // Dimension analysis
  const dims = ['original_tech_alignment', 'original_domain_alignment', 'original_submission_type', 'original_timeline', 'original_funding_efficiency'];
  const dimNames = ['tech_alignment', 'domain_alignment', 'submission_type', 'timeline', 'funding_efficiency'];
  const dimAnalysis = {};

  for (let i = 0; i < dims.length; i++) {
    const field = dims[i];
    const name = dimNames[i];
    const winAvg = avg(wins.map(o => o[field]));
    const lossAvg = avg(losses.map(o => o[field]));
    const diff = winAvg - lossAvg;
    dimAnalysis[name] = { winAvg: Math.round(winAvg), lossAvg: Math.round(lossAvg), diff: Math.round(diff), predictive: Math.abs(diff) > 10 };
  }

  // Keyword analysis
  const winKeywords = wins.flatMap(o => safeJson(o.keywords_matched, []));
  const lossKeywords = losses.flatMap(o => safeJson(o.keywords_matched, []));
  const winKwFreq = freq(winKeywords);
  const lossKwFreq = freq(lossKeywords);
  const topWinKw = topN(winKwFreq, 5);
  const topLossKw = topN(lossKwFreq, 5);

  // Overall accuracy
  const accuracies = outcomes.map(o => o.score_accuracy).filter(a => a !== null);
  const overallAccuracy = Math.round(avg(accuracies));
  const winRate = Math.round((wins.length / outcomes.length) * 100);

  const report = {
    generated_at: now(),
    outcomes_count: outcomes.length,
    wins: wins.length,
    losses: losses.length,
    win_rate: winRate,
    overall_accuracy: overallAccuracy,
    dimension_analysis: dimAnalysis,
    top_win_keywords: topWinKw,
    top_loss_keywords: topLossKw,
    recommendations: generateRecommendations(dimAnalysis, topWinKw, topLossKw),
  };

  // Save report
  db.prepare('INSERT OR REPLACE INTO digests (id, digest_date, content, generated_at) VALUES (?, ?, ?, ?)').run(
    uid(), `calibration-${now().slice(0, 10)}`, JSON.stringify({ type: 'calibration', ...report }), report.generated_at
  );

  return report;
}

function generateRecommendations(dimAnalysis, topWinKw, topLossKw) {
  const recs = [];
  for (const [name, data] of Object.entries(dimAnalysis)) {
    if (!data.predictive && Math.abs(data.diff) < 5) {
      recs.push({ type: 'weight', dimension: name, suggestion: `${name} shows low predictive power (win avg: ${data.winAvg}, loss avg: ${data.lossAvg}). Consider reducing weight.` });
    } else if (data.diff > 20) {
      recs.push({ type: 'weight', dimension: name, suggestion: `${name} is a strong predictor (wins +${data.diff} vs losses). Weight is well-calibrated.` });
    }
  }
  if (topWinKw.length > 0) recs.push({ type: 'keywords', suggestion: `Top keywords in WINS: ${topWinKw.join(', ')}. Consider promoting these to higher tiers.` });
  if (topLossKw.length > 0) recs.push({ type: 'keywords', suggestion: `Top keywords in LOSSES: ${topLossKw.join(', ')}. These may be inflating scores without predicting wins.` });
  return recs;
}

// ── ROI ANALYTICS ─────────────────────────────────────────────────────────────
function computeROI() {
  const db = getDb();
  const outcomes = db.prepare("SELECT * FROM outcomes WHERE terminal_status != 'withdrawn'").all();
  const wins = outcomes.filter(o => o.terminal_status === 'awarded');
  const losses = outcomes.filter(o => o.terminal_status === 'rejected' || o.terminal_status === 'no_response');

  const totalHours = sum(outcomes.map(o => o.actual_effort_hours || 0));
  const winHours = sum(wins.map(o => o.actual_effort_hours || 0));
  const lossHours = sum(losses.map(o => o.actual_effort_hours || 0));
  const totalFunding = sum(wins.map(o => o.funding_amount || 0));
  const dollarPerHour = winHours > 0 ? Math.round(totalFunding / winHours) : null;

  // By source
  const sources = [...new Set(outcomes.map(o => o.source))];
  const sourceROI = sources.map(src => {
    const srcWins = wins.filter(o => o.source === src);
    const srcAll = outcomes.filter(o => o.source === src);
    const srcHours = sum(srcAll.map(o => o.actual_effort_hours || 0));
    const srcFunding = sum(srcWins.map(o => o.funding_amount || 0));
    return { source: src, wins: srcWins.length, total: srcAll.length, hours: srcHours, funding: srcFunding, roi: srcHours > 0 ? Math.round(srcFunding / srcHours) : 0 };
  }).sort((a, b) => b.roi - a.roi);

  return {
    submitted: outcomes.length,
    won: wins.length,
    win_rate: outcomes.length > 0 ? Math.round((wins.length / outcomes.length) * 100) : 0,
    total_hours: Math.round(totalHours),
    avg_hours_per_win: wins.length > 0 ? Math.round(winHours / wins.length) : null,
    avg_hours_per_loss: losses.length > 0 ? Math.round(lossHours / losses.length) : null,
    total_funding_won: totalFunding,
    dollars_per_hour: dollarPerHour,
    best_source: sourceROI[0] || null,
    worst_source: sourceROI[sourceROI.length - 1] || null,
    by_source: sourceROI,
  };
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function avg(arr) { return arr.length ? arr.reduce((a, b) => a + (b || 0), 0) / arr.length : 0; }
function sum(arr) { return arr.reduce((a, b) => a + (b || 0), 0); }
function freq(arr) { const m = {}; for (const x of arr) m[x] = (m[x] || 0) + 1; return m; }
function topN(freqMap, n) { return Object.entries(freqMap).sort((a, b) => b[1] - a[1]).slice(0, n).map(e => e[0]); }

function getLessons(limit = 20) {
  return getDb().prepare('SELECT * FROM lessons ORDER BY created_at DESC LIMIT ?').all(limit);
}

function getOutcomes() {
  return getDb().prepare('SELECT * FROM outcomes ORDER BY created_at DESC').all();
}

// CLI support
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--calibrate')) {
    const report = runCalibrationReport();
    console.log(JSON.stringify(report, null, 2));
  }
}

module.exports = { recordOutcome, runCalibrationReport, computeROI, getLessons, getOutcomes };
