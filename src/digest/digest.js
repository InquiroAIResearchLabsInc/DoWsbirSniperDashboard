// Daily digest — a per-tenant summary of what changed: new topics in the last
// 24h, this tenant's PRIME picks, deadlines closing soon, and the active
// pipeline. Mirrors inquiro-sniper's digest, scoped per tenant.
const { getDb, uid, now } = require('../db');
const { emitReceipt } = require('../core/receipt');

const CLOSING_SOON_DAYS = 14;
const DEADLINE_WARNING_DAYS = 7;

function daysToClose(close_date) {
  if (!close_date) return null;
  const t = Date.parse(close_date);
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86400000);
}

function fmt(o) {
  return {
    id: o.id, title: o.title, component: o.component,
    score: o.fit_score, tier: o.score_tier,
    close_date: o.close_date, days_remaining: daysToClose(o.close_date),
    source_url: o.source_url,
  };
}

function generateDigest(tenant_id) {
  const db = getDb();
  const today = now().slice(0, 10);
  const since = new Date(Date.now() - 86400000).toISOString();

  // This tenant's opportunities (scored for them), minus anything dismissed.
  const all = db.prepare(`
    SELECT o.*, s.fit_score, s.score_tier
    FROM opportunities o
    LEFT JOIN scores s ON s.opportunity_id = o.id AND s.tenant_id = ?
    WHERE o.id NOT IN (
      SELECT opportunity_id FROM dismissals
      WHERE tenant_id = ? AND (expires_at IS NULL OR expires_at > ?)
    )
  `).all(tenant_id, tenant_id, now());

  const byScore = (a, b) => (b.fit_score || 0) - (a.fit_score || 0);
  const newOpps = all.filter(o => o.first_seen && o.first_seen >= since).sort(byScore);
  const prime = all.filter(o => o.score_tier === 'PRIME').sort(byScore);
  const evaluate = all.filter(o => o.score_tier === 'EVALUATE');
  const closing = all
    .filter(o => { const d = daysToClose(o.close_date); return d != null && d >= 0 && d <= CLOSING_SOON_DAYS; })
    .sort((a, b) => daysToClose(a.close_date) - daysToClose(b.close_date));
  const critical = closing.filter(o => daysToClose(o.close_date) <= DEADLINE_WARNING_DAYS);

  const pipeline = db.prepare(`
    SELECT id, title, status, deadline FROM pipeline
    WHERE tenant_id = ? AND status NOT IN ('awarded','rejected','withdrawn','no_response')
    ORDER BY deadline ASC
  `).all(tenant_id);

  const digest = {
    tenant_id,
    date: today,
    generated_at: now(),
    total: all.length,
    new_count: newOpps.length,
    prime_count: prime.length,
    evaluate_count: evaluate.length,
    closing_count: closing.length,
    new_opps: newOpps.slice(0, 10).map(fmt),
    top_prime: prime.slice(0, 10).map(fmt),
    critical_deadlines: critical.map(fmt),
    closing_soon: closing.slice(0, 15).map(fmt),
    pipeline,
  };

  // digest_date carries the tenant so getLatestDigest can scope by tenant
  // without a schema change.
  const key = `${tenant_id}|${today}`;
  db.prepare('DELETE FROM digests WHERE digest_date = ?').run(key);
  db.prepare('INSERT INTO digests (id, digest_date, content, generated_at) VALUES (?,?,?,?)')
    .run(uid(), key, JSON.stringify(digest), digest.generated_at);
  emitReceipt('digest_generated', {
    tenant_id, new_count: digest.new_count, prime_count: digest.prime_count, closing_count: digest.closing_count,
  });
  return digest;
}

function getLatestDigest(tenant_id) {
  const row = getDb()
    .prepare("SELECT content FROM digests WHERE digest_date LIKE ? ORDER BY generated_at DESC LIMIT 1")
    .get(`${tenant_id}|%`);
  if (!row) return null;
  try { return JSON.parse(row.content); } catch (e) { return null; }
}

module.exports = { generateDigest, getLatestDigest };
