// --- DAILY DIGEST GENERATOR ---
const { getDb, uid, now, resurrectExpiredDismissals, computeDaysRemaining, computeScoreTier } = require('./db');
const config = require('./config');

function generateDigest() {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  resurrectExpiredDismissals();
  const since = new Date(); since.setDate(since.getDate() - 1);
  const sinceStr = since.toISOString().slice(0, 10);
  const newOppsRaw = db.prepare('SELECT * FROM opportunities WHERE first_seen >= ? AND dismissed = 0 ORDER BY fit_score DESC').all(sinceStr);
  const newOpps = newOppsRaw.map(o => ({ ...o, score_tier: computeScoreTier(o.fit_score), days_remaining: computeDaysRemaining(o.close_date, o.is_rolling === 1) }));
  const snipers = newOpps.filter(o => o.score_tier === 'SNIPER');
  const evaluates = newOpps.filter(o => o.score_tier === 'EVALUATE');
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() + config.CLOSING_SOON_DAYS);
  const warningsRaw = db.prepare('SELECT * FROM opportunities WHERE dismissed = 0 AND is_rolling = 0 AND close_date IS NOT NULL AND close_date >= date(\'now\') AND close_date <= ? ORDER BY close_date ASC').all(cutoff.toISOString().slice(0, 10));
  const warnings = warningsRaw.map(o => ({ ...o, days_remaining: computeDaysRemaining(o.close_date, false), score_tier: computeScoreTier(o.fit_score) }));
  const critical = warnings.filter(o => o.days_remaining <= config.DEADLINE_WARNING_DAYS);
  const soon = warnings;
  const pipeline = db.prepare("SELECT p.*, o.fit_score, o.score_tier FROM pipeline p LEFT JOIN opportunities o ON p.opportunity_id = o.id WHERE p.status NOT IN ('awarded','rejected','withdrawn','no_response') ORDER BY p.deadline ASC").all();
  const sources = db.prepare('SELECT * FROM source_status').all();
  const digest = { date: today, generated_at: now(), new_count: newOpps.length, sniper_count: snipers.length, evaluate_count: evaluates.length, snipers: snipers.map(formatOpp), evaluates: evaluates.map(formatOpp), critical_deadlines: critical.map(formatOpp), closing_soon: soon.map(formatOpp), pipeline: pipeline.map(formatPipeline), source_statuses: sources };
  db.prepare('INSERT OR REPLACE INTO digests (id, digest_date, content, generated_at) VALUES (?, ?, ?, ?)').run(uid(), today, JSON.stringify(digest), digest.generated_at);
  return digest;
}
function formatOpp(o) { return { id: o.id, title: o.title, source: o.source, agency: o.agency, score: o.fit_score, tier: o.score_tier, close_date: o.close_date, days_remaining: o.days_remaining, funding_min: o.funding_min, funding_max: o.funding_max, source_url: o.source_url }; }
function formatPipeline(p) { return { id: p.id, title: p.title, status: p.status, deadline: p.deadline, funding_amount: p.funding_amount, days_to_deadline: p.deadline ? Math.ceil((new Date(p.deadline) - new Date()) / 86400000) : null }; }
function getLatestDigest() {
  const db = getDb();
  const row = db.prepare('SELECT * FROM digests ORDER BY generated_at DESC LIMIT 1').get();
  if (!row) return null;
  try { return JSON.parse(row.content); } catch { return null; }
}
module.exports = { generateDigest, getLatestDigest };
