const { getDb } = require('../db');
const { emitReceipt } = require('../core/receipt');
const { upsertOpportunity } = require('../diff/engine');

function newRunId() {
  return `ingest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function upsertOpportunities(rows, tenant_id = 'admin', run_id = null) {
  const db = getDb();
  const id = run_id || newRunId();
  const before_count = db.prepare('SELECT COUNT(*) c FROM opportunities').get().c;

  const existing = new Set();
  if (rows.length) {
    const ids = rows.map(r => r.id);
    const chunkSize = 400;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => '?').join(',');
      const found = db.prepare(`SELECT id FROM opportunities WHERE id IN (${placeholders})`).all(...chunk);
      for (const f of found) existing.add(f.id);
    }
  }

  const counts = { inserted: 0, updated: 0, unchanged: 0 };
  for (const opp of rows) {
    const action = existing.has(opp.id) ? 'update' : 'insert';
    upsertOpportunity(db, opp);
    if (action === 'insert') counts.inserted++;
    else counts.updated++;
    emitReceipt('opportunity_upserted', {
      tenant_id,
      run_id: id,
      topic_code: opp.topic_code || null,
      component: opp.component || null,
      action,
      tenant_scope: 'global',
    });
  }

  const after_count = db.prepare('SELECT COUNT(*) c FROM opportunities').get().c;
  stoprule_ingest_invariant(id, before_count, after_count);
  return { ...counts, before_count, after_count, run_id: id };
}

// --- STOPRULE ---
function stoprule_ingest_invariant(run_id, before_count, after_count) {
  if (after_count <= before_count) {
    emitReceipt('ingest_noop', {
      tenant_id: 'admin',
      run_id,
      source: 'sbir_gov',
      before_count,
      after_count,
      reason: 'ingest succeeded but no rows changed — check scraper output',
    });
    // Soft halt — log + alert via receipt, don't crash production.
    console.error(`[STOPRULE] ingest_invariant violated: ${before_count} -> ${after_count}`);
    return false;
  }
  return true;
}

module.exports = { upsertOpportunities, stoprule_ingest_invariant };
