const { getDb, uid, now } = require('../db');
const { emitReceipt } = require('../core/receipt');

const TRACKED_FIELDS = ['title', 'description', 'agency', 'sub_agency', 'program', 'phase', 'open_date', 'close_date', 'is_rolling', 'funding_min', 'funding_max', 'currency', 'component'];
const CLOSING_SOON_DAYS = 14;
const DEADLINE_WARNING_DAYS = 7;

function todayDate() { return new Date().toISOString().slice(0, 10); }

function upsertOpportunity(db, opp) {
  db.prepare(`INSERT INTO opportunities (
      id, source, source_url, title, description, agency, sub_agency, component,
      program, phase, topic_code, naics_codes, keywords, posted_date, open_date,
      close_date, is_rolling, days_remaining, funding_min, funding_max, currency,
      first_seen, last_updated
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      source_url=excluded.source_url,
      title=excluded.title,
      description=excluded.description,
      agency=excluded.agency,
      sub_agency=excluded.sub_agency,
      component=excluded.component,
      program=excluded.program,
      phase=excluded.phase,
      topic_code=excluded.topic_code,
      naics_codes=excluded.naics_codes,
      keywords=excluded.keywords,
      posted_date=excluded.posted_date,
      open_date=excluded.open_date,
      close_date=excluded.close_date,
      is_rolling=excluded.is_rolling,
      days_remaining=excluded.days_remaining,
      funding_min=excluded.funding_min,
      funding_max=excluded.funding_max,
      currency=excluded.currency,
      last_updated=excluded.last_updated
  `).run(
    opp.id, opp.source, opp.source_url || null, opp.title || '', opp.description || null,
    opp.agency || null, opp.sub_agency || null, opp.component || null,
    opp.program || null, opp.phase || null, opp.topic_code || null,
    JSON.stringify(opp.naics_codes || []), JSON.stringify(opp.keywords || []),
    opp.posted_date || null, opp.open_date || null, opp.close_date || null,
    opp.is_rolling ? 1 : 0, opp.days_remaining == null ? null : opp.days_remaining,
    opp.funding_min == null ? null : opp.funding_min,
    opp.funding_max == null ? null : opp.funding_max,
    opp.currency || 'USD', now(), now()
  );
}

function computeDiffs(source, fresh) {
  const db = getDb();
  const today = todayDate();
  const prev = db.prepare(`SELECT id, source, title, description, agency, sub_agency, program, phase, open_date, close_date, is_rolling, funding_min, funding_max, currency, component FROM opportunities WHERE source = ?`).all(source);
  const prevMap = Object.fromEntries(prev.map(o => [o.id, o]));
  const freshIds = new Set(fresh.map(o => o.id));
  const counts = { new: 0, closed: 0, changed: 0, closing_soon: 0, warning: 0 };
  for (const opp of fresh) upsertOpportunity(db, opp);
  for (const opp of fresh) {
    if (!prevMap[opp.id]) {
      db.prepare('INSERT INTO diffs (id, diff_date, source, diff_type, opportunity_id, field_changed, old_value, new_value, created_at) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(uid(), today, source, 'new', opp.id, null, null, null, now());
      counts.new++;
    } else {
      const p = prevMap[opp.id];
      for (const f of TRACKED_FIELDS) {
        let o = p[f], n = opp[f];
        if (f === 'is_rolling') { o = o ? 1 : 0; n = n ? 1 : 0; }
        const os = String(o == null ? '' : o), ns = String(n == null ? '' : n);
        if (os !== ns && ns !== '') {
          db.prepare('INSERT INTO diffs (id, diff_date, source, diff_type, opportunity_id, field_changed, old_value, new_value, created_at) VALUES (?,?,?,?,?,?,?,?,?)')
            .run(uid(), today, source, 'changed', opp.id, f, os, ns, now());
          counts.changed++;
        }
      }
    }
    if (!opp.is_rolling && opp.days_remaining != null && opp.days_remaining >= 0) {
      if (opp.days_remaining <= CLOSING_SOON_DAYS) {
        db.prepare('INSERT INTO diffs (id, diff_date, source, diff_type, opportunity_id, field_changed, old_value, new_value, created_at) VALUES (?,?,?,?,?,?,?,?,?)')
          .run(uid(), today, source, 'closing_soon', opp.id, null, null, null, now());
        counts.closing_soon++;
      }
      if (opp.days_remaining <= DEADLINE_WARNING_DAYS) {
        db.prepare('INSERT INTO diffs (id, diff_date, source, diff_type, opportunity_id, field_changed, old_value, new_value, created_at) VALUES (?,?,?,?,?,?,?,?,?)')
          .run(uid(), today, source, 'warning', opp.id, null, null, null, now());
        counts.warning++;
      }
    }
  }
  for (const id of Object.keys(prevMap)) {
    if (!freshIds.has(id)) {
      db.prepare('INSERT INTO diffs (id, diff_date, source, diff_type, opportunity_id, field_changed, old_value, new_value, created_at) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(uid(), today, source, 'closed', id, null, null, null, now());
      counts.closed++;
    }
  }
  emitReceipt('diffs_computed', { tenant_id: 'admin', source, ...counts });
  return counts;
}

function daysToClose(close_date) {
  if (!close_date) return null;
  const t = Date.parse(close_date);
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86400000);
}

// Diff rows joined to their opportunity so the feed can render a human
// title + component/program/phase + deadline instead of the raw row id.
function listDiffs(window_days = 7) {
  const since = new Date(); since.setDate(since.getDate() - window_days);
  const rows = getDb().prepare(`
    SELECT d.*,
           o.title      AS title,
           o.component  AS component,
           o.program    AS program,
           o.phase      AS phase,
           o.close_date AS close_date,
           o.is_rolling AS is_rolling
      FROM diffs d
      LEFT JOIN opportunities o ON o.id = d.opportunity_id
     WHERE d.diff_date >= ?
     ORDER BY d.created_at DESC
     LIMIT 200
  `).all(since.toISOString().slice(0, 10));
  return rows.map(r => ({
    ...r,
    is_rolling: r.is_rolling === 1,
    days_remaining: daysToClose(r.close_date),
  }));
}

module.exports = { computeDiffs, listDiffs, upsertOpportunity, TRACKED_FIELDS };
