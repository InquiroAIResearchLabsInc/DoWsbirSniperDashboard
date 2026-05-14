const config = require('../core/config');
const { emitReceipt } = require('../core/receipt');

const IDENTIFYING_FIELDS = new Set([
  'tenant_id', 'company_name', 'uei', 'contact_name', 'contact_email',
  'rejection_reason', 'what_worked', 'what_failed', 'notes', 'title',
  'description', 'opportunity_id', 'pipeline_id', 'outcome_id', 'lesson_id', 'id',
  'keywords_matched', 'topic_number', 'source_url',
]);

function stripIdentifying(row) {
  const out = {};
  for (const [k, v] of Object.entries(row || {})) {
    if (IDENTIFYING_FIELDS.has(k)) continue;
    if (k.endsWith('_id')) continue;
    out[k] = v;
  }
  return out;
}

function kanonGate({ rows, component, dimension }) {
  const tenants = new Set();
  for (const r of rows) if (r && r.tenant_id) tenants.add(r.tenant_id);
  const n = tenants.size;
  const min = config.KANON_MIN_TENANTS;
  if (n < min) {
    emitReceipt('kanon_blocked', {
      tenant_id: 'admin',
      component, dimension, current_n: n, kanon_min: min,
    });
    return { ok: false, n, min };
  }
  return { ok: true, n, min };
}

function anonymizeRows(rows) {
  return rows.map(stripIdentifying);
}

module.exports = { stripIdentifying, anonymizeRows, kanonGate, IDENTIFYING_FIELDS };
