const cron = require('node-cron');
const { emitReceipt } = require('../core/receipt');
const sbir = require('../ingest/sbir_api');
const { computeDiffs } = require('../diff/engine');
const { upsertOpportunities } = require('../ingest/persist');
const aggregator = require('../learning/component_aggregator');
const { resetSandboxTenant } = require('../learning/individual');
const { getDb } = require('../db');
const { scoreTopic, persist } = require('../scoring/engine_topic');

const JOBS = [
  { name: 'sbir_daily', expression: '0 5 * * *' },
  { name: 'component_aggregator_nightly', expression: '30 7 * * *' },
  { name: 'sandbox_reset_hourly', expression: '0 * * * *' },
];

function nextFireUtc(expression) {
  // Minimal cron next-fire for 5-field expressions used in JOBS.
  // Supports literals only; matches the JOBS table above.
  const [mStr, hStr] = expression.split(' ');
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), 0, 0));
  for (let i = 0; i < 60 * 24 * 8; i++) {
    d.setUTCMinutes(d.getUTCMinutes() + 1);
    const matchM = mStr === '*' || Number(mStr) === d.getUTCMinutes();
    const matchH = hStr === '*' || Number(hStr) === d.getUTCHours();
    if (matchM && matchH) return d.toISOString();
  }
  return null;
}

function scoreUnscoredForAllTenants() {
  const db = getDb();
  const tenants = db.prepare('SELECT tenant_id FROM tenants').all().map(r => r.tenant_id);
  if (!tenants.includes('default')) tenants.push('default');
  if (!tenants.includes('sandbox')) tenants.push('sandbox');
  const opps = db.prepare('SELECT * FROM opportunities').all().map(o => ({ ...o, is_rolling: o.is_rolling === 1 }));
  let scored = 0;
  let failed = 0;
  for (const tenant_id of tenants) {
    const existing = new Set(
      db.prepare('SELECT opportunity_id FROM scores WHERE tenant_id = ?').all(tenant_id).map(r => r.opportunity_id)
    );
    for (const opp of opps) {
      if (existing.has(opp.id)) continue;
      try {
        persist(scoreTopic(opp, tenant_id));
        scored++;
      } catch (e) {
        failed++;
      }
    }
  }
  if (failed > 0) emitReceipt('score_backfill_partial', { tenant_id: 'admin', scored, failed });
  return { tenants: tenants.length, scored, failed };
}

function schedule() {
  const tasks = [];
  tasks.push(cron.schedule('0 5 * * *', async () => {
    try {
      const opps = await sbir.scrape();
      const persisted = upsertOpportunities(opps, 'admin');
      computeDiffs('sbir_gov', opps);
      const s = scoreUnscoredForAllTenants();
      emitReceipt('cron_run', { tenant_id: 'admin', job: 'sbir_daily', count: opps.length, persisted, scoring: s });
    } catch (e) {
      emitReceipt('cron_error', { tenant_id: 'admin', job: 'sbir_daily', error: e.message });
    }
  }, { timezone: 'UTC' }));

  tasks.push(cron.schedule('30 7 * * *', () => {
    try {
      const out = aggregator.run();
      emitReceipt('cron_run', { tenant_id: 'admin', job: 'component_aggregator_nightly', ...out });
    } catch (e) {
      emitReceipt('cron_error', { tenant_id: 'admin', job: 'component_aggregator_nightly', error: e.message });
    }
  }, { timezone: 'UTC' }));

  tasks.push(cron.schedule('0 * * * *', () => {
    try {
      const out = resetSandboxTenant();
      const s = scoreUnscoredForAllTenants();
      emitReceipt('cron_run', { tenant_id: 'admin', job: 'sandbox_reset_hourly', reseeded: out.reseeded, scoring: s });
    } catch (e) {
      emitReceipt('cron_error', { tenant_id: 'admin', job: 'sandbox_reset_hourly', error: e.message });
    }
  }, { timezone: 'UTC' }));

  const jobs_registered = JOBS.map(j => j.name);
  const next_runs = JOBS.map(j => ({ name: j.name, expression: j.expression, next_fire_utc: nextFireUtc(j.expression) }));
  emitReceipt('scheduler_started', { tenant_id: 'admin', jobs_registered, next_runs });
  return { tasks, stop() { for (const t of tasks) { try { t.stop(); } catch (_) {} } } };
}

module.exports = { schedule };
