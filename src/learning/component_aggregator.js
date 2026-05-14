const { getDb, uid, now, safeJson } = require('../db');
const { emitReceipt } = require('../core/receipt');
const { kanonGate, stripIdentifying } = require('./anonymizer');

const DIMENSIONS = ['tech_alignment', 'domain_alignment', 'submission_type', 'timeline', 'funding_efficiency'];

function run() {
  const db = getDb();
  const components = db.prepare("SELECT DISTINCT component FROM outcomes WHERE component IS NOT NULL").all().map(r => r.component);
  const patternsWritten = [];
  for (const component of components) {
    const rows = db.prepare("SELECT * FROM outcomes WHERE component = ? AND terminal_status IN ('awarded','rejected')").all(component);
    if (rows.length === 0) continue;
    for (const dim of DIMENSIONS) {
      const gate = kanonGate({ rows, component, dimension: dim });
      if (!gate.ok) continue;
      const wins = rows.filter(r => r.terminal_status === 'awarded').map(stripIdentifying);
      const losses = rows.filter(r => r.terminal_status === 'rejected').map(stripIdentifying);
      const win_avg = wins.length ? wins.reduce((s, r) => s + (r[`original_${dim}`] || 0), 0) / wins.length : 0;
      const loss_avg = losses.length ? losses.reduce((s, r) => s + (r[`original_${dim}`] || 0), 0) / losses.length : 0;
      const pattern_value = { win_avg: Math.round(win_avg), loss_avg: Math.round(loss_avg), diff: Math.round(win_avg - loss_avg) };
      const id = uid();
      db.prepare('INSERT INTO component_patterns (id, component, dimension, pattern_value, supporting_n, computed_at, kanon_min) VALUES (?,?,?,?,?,?,?)')
        .run(id, component, dim, JSON.stringify(pattern_value), gate.n, now(), gate.min);
      emitReceipt('component_pattern_emitted', {
        tenant_id: 'admin',
        component, dimension: dim, supporting_n: gate.n, pattern_value,
      });
      patternsWritten.push({ id, component, dimension: dim });
    }
  }
  emitReceipt('component_aggregator_run', { tenant_id: 'admin', patterns_written: patternsWritten.length });
  return { patterns_written: patternsWritten.length, components_seen: components.length };
}

function listPatterns({ component, dimension } = {}) {
  const db = getDb();
  let q = 'SELECT * FROM component_patterns WHERE 1=1';
  const args = [];
  if (component) { q += ' AND component = ?'; args.push(component); }
  if (dimension) { q += ' AND dimension = ?'; args.push(dimension); }
  q += ' ORDER BY computed_at DESC';
  return db.prepare(q).all(...args).map(r => ({ ...r, pattern_value: safeJson(r.pattern_value, {}) }));
}

module.exports = { run, listPatterns };
