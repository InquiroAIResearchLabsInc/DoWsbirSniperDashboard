const { getDb, uid, now, safeJson } = require('../db');
const { emitReceipt } = require('../core/receipt');
const config = require('../core/config');

function avg(arr) { return arr.length ? arr.reduce((a, b) => a + (b || 0), 0) / arr.length : 0; }

function recordOutcome(data) {
  const db = getDb();
  const id = uid();
  const ts = now();

  let score_accuracy = null;
  if (data.terminal_status === 'awarded') score_accuracy = data.original_score;
  else if (data.terminal_status === 'rejected') score_accuracy = 100 - data.original_score;

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
  return id;
}

function generateLesson(outcome_id, data) {
  const db = getDb();
  const tags = [data.source, data.agency, data.program, data.phase, data.component].filter(Boolean);
  let lesson = '';
  if (data.terminal_status === 'awarded') {
    lesson = `${data.title} — WON. ${data.what_worked || ''}`; tags.push('win');
  } else if (data.terminal_status === 'rejected') {
    lesson = `${data.title} — LOST. ${data.what_failed || ''}`; tags.push('loss');
  } else if (data.terminal_status === 'withdrawn') {
    lesson = `${data.title} — WITHDRAWN.`; tags.push('withdrawn');
  } else {
    lesson = `${data.title} — NO RESPONSE.`; tags.push('no_response');
  }
  db.prepare('INSERT INTO lessons (id, tenant_id, outcome_id, opportunity_id, title, outcome, lesson, tags, created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(uid(), data.tenant_id, outcome_id, data.opportunity_id, data.title, data.terminal_status, lesson, JSON.stringify(tags), now());
}

function runCalibration({ tenant_id }) {
  const db = getDb();
  const outcomes = db.prepare("SELECT * FROM outcomes WHERE tenant_id = ? AND terminal_status IN ('awarded','rejected') ORDER BY created_at DESC LIMIT 50").all(tenant_id);
  if (outcomes.length < 5) {
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
  const report = {
    tenant_id,
    generated_at: now(),
    outcomes_count: outcomes.length,
    wins: wins.length,
    losses: losses.length,
    win_rate: Math.round((wins.length / outcomes.length) * 100),
    dimension_analysis: analysis,
  };
  emitReceipt('calibration_report_computed', { tenant_id, outcomes_count: outcomes.length, wins: wins.length });
  return report;
}

module.exports = { recordOutcome, runCalibration, generateLesson };
