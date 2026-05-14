// --- DIFF ENGINE ---
const { getDb, insertDiff, computeDaysRemaining } = require('./db');
const config = require('./config');
const TRACKED_FIELDS = ['title','description','agency','sub_agency','program','phase','open_date','close_date','is_rolling','funding_min','funding_max','currency'];
const PREV_COLUMNS = ['id','source','title','description','agency','sub_agency','program','phase','open_date','close_date','is_rolling','funding_min','funding_max','currency'].join(', ');

function computeDiffs(source, freshOpps) {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const prevMap = {};
  db.prepare(`SELECT ${PREV_COLUMNS} FROM opportunities WHERE source = ?`).all(source).forEach(o => { prevMap[o.id] = o; });
  const freshIds = new Set(freshOpps.map(o => o.id));
  const prevIds = new Set(Object.keys(prevMap));
  const newOpps = [], closedOpps = [], changedOpps = [], closingSoon = [], deadlineWarnings = [];
  for (const opp of freshOpps) {
    if (!prevIds.has(opp.id)) {
      newOpps.push(opp);
      insertDiff({ diff_date: today, source, diff_type: 'new', opportunity_id: opp.id });
    } else {
      const prev = prevMap[opp.id];
      for (const field of TRACKED_FIELDS) {
        let oldVal = prev[field], newVal = opp[field];
        if (field === 'is_rolling') { oldVal = oldVal ? 1 : 0; newVal = newVal ? 1 : 0; }
        const oldStr = String(oldVal ?? ''), newStr = String(newVal ?? '');
        if (oldStr !== newStr && newStr !== '') {
          changedOpps.push({ id: opp.id, field, old_value: oldStr, new_value: newStr });
          insertDiff({ diff_date: today, source, diff_type: 'changed', opportunity_id: opp.id, field_changed: field, old_value: oldStr, new_value: newStr });
        }
      }
    }
    const days = (opp.days_remaining != null) ? opp.days_remaining : computeDaysRemaining(opp.close_date, !!opp.is_rolling);
    if (!opp.is_rolling && days != null && days >= 0) {
      if (days <= config.CLOSING_SOON_DAYS) { closingSoon.push(opp); insertDiff({ diff_date: today, source, diff_type: 'closing_soon', opportunity_id: opp.id }); }
      if (days <= config.DEADLINE_WARNING_DAYS) { deadlineWarnings.push(opp); insertDiff({ diff_date: today, source, diff_type: 'warning', opportunity_id: opp.id }); }
    }
  }
  for (const id of prevIds) {
    if (!freshIds.has(id) && prevMap[id]) {
      closedOpps.push(prevMap[id]);
      insertDiff({ diff_date: today, source, diff_type: 'closed', opportunity_id: id });
    }
  }
  return { date: today, source, new_opportunities: newOpps, closed_opportunities: closedOpps, changed_opportunities: changedOpps, closing_soon: closingSoon, deadline_warnings: deadlineWarnings };
}
module.exports = { computeDiffs };
