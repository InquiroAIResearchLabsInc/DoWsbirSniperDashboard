const cron = require('node-cron');
const { emitReceipt } = require('../core/receipt');
const sbir = require('../ingest/sbir_api');
const { computeDiffs } = require('../diff/engine');
const aggregator = require('../learning/component_aggregator');
const { resetSandboxTenant } = require('../learning/individual');
const { getDb } = require('../db');
const { scoreTopic, persist } = require('../scoring/engine_topic');

function scoreUnscoredForAllTenants() {
  const db = getDb();
  const tenants = db.prepare('SELECT tenant_id FROM tenants').all().map(r => r.tenant_id);
  if (!tenants.includes('default')) tenants.push('default');
  if (!tenants.includes('sandbox')) tenants.push('sandbox');
  const opps = db.prepare('SELECT * FROM opportunities').all().map(o => ({ ...o, is_rolling: o.is_rolling === 1 }));
  let scored = 0;
  for (const tenant_id of tenants) {
    const existing = new Set(
      db.prepare('SELECT opportunity_id FROM scores WHERE tenant_id = ?').all(tenant_id).map(r => r.opportunity_id)
    );
    for (const opp of opps) {
      if (existing.has(opp.id)) continue;
      try { persist(scoreTopic(opp, tenant_id)); scored++; } catch (_) {}
    }
  }
  return { tenants: tenants.length, scored };
}

function schedule() {
  cron.schedule('0 5 * * *', async () => {
    try {
      const opps = await sbir.scrape();
      computeDiffs('sbir_gov', opps);
      const s = scoreUnscoredForAllTenants();
      emitReceipt('cron_run', { tenant_id: 'admin', job: 'sbir_daily', count: opps.length, scoring: s });
    } catch (e) {
      emitReceipt('cron_error', { tenant_id: 'admin', job: 'sbir_daily', error: e.message });
    }
  }, { timezone: 'UTC' });

  cron.schedule('30 7 * * *', () => {
    try {
      const out = aggregator.run();
      emitReceipt('cron_run', { tenant_id: 'admin', job: 'component_aggregator_nightly', ...out });
    } catch (e) {
      emitReceipt('cron_error', { tenant_id: 'admin', job: 'component_aggregator_nightly', error: e.message });
    }
  }, { timezone: 'UTC' });

  cron.schedule('0 * * * *', () => {
    try {
      const out = resetSandboxTenant();
      const s = scoreUnscoredForAllTenants();
      emitReceipt('cron_run', { tenant_id: 'admin', job: 'sandbox_reset_hourly', reseeded: out.reseeded, scoring: s });
    } catch (e) {
      emitReceipt('cron_error', { tenant_id: 'admin', job: 'sandbox_reset_hourly', error: e.message });
    }
  }, { timezone: 'UTC' });

  emitReceipt('scheduler_started', { tenant_id: 'admin', jobs: ['sbir_daily@05:00 UTC', 'component_aggregator_nightly@07:30 UTC', 'sandbox_reset_hourly@:00'] });
}

module.exports = { schedule };
