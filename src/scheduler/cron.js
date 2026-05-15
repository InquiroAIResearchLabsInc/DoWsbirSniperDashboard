const cron = require('node-cron');
const { emitReceipt } = require('../core/receipt');
const sbir = require('../ingest/sbir_api');
const { computeDiffs } = require('../diff/engine');
const aggregator = require('../learning/component_aggregator');
const { resetSandboxTenant } = require('../learning/individual');

function schedule() {
  cron.schedule('0 5 * * *', async () => {
    try {
      const opps = await sbir.scrape();
      computeDiffs('sbir_gov', opps);
      emitReceipt('cron_run', { tenant_id: 'admin', job: 'sbir_daily', count: opps.length });
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
      emitReceipt('cron_run', { tenant_id: 'admin', job: 'sandbox_reset_hourly', reseeded: out.reseeded });
    } catch (e) {
      emitReceipt('cron_error', { tenant_id: 'admin', job: 'sandbox_reset_hourly', error: e.message });
    }
  }, { timezone: 'UTC' });

  emitReceipt('scheduler_started', { tenant_id: 'admin', jobs: ['sbir_daily@05:00 UTC', 'component_aggregator_nightly@07:30 UTC', 'sandbox_reset_hourly@:00'] });
}

module.exports = { schedule };
