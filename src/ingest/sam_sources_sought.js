const fs = require('fs');
const path = require('path');
const config = require('../core/config');
const { emitReceipt } = require('../core/receipt');

const FIXTURE_PATH = path.join(config.ROOT, 'tests', 'fixtures', 'sam_sources_sought_sample.json');

async function pull({ sponsor_id, component, window_days = 90 } = {}) {
  if (config.SAM_USE_FIXTURE || !config.SAM_API_KEY) {
    const data = fs.existsSync(FIXTURE_PATH) ? JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8')) : { notices: [] };
    let notices = data.notices || [];
    const cutoff = Date.now() - window_days * 86400 * 1000;
    notices = notices.filter(n => {
      const d = Date.parse(n.posted_date || '');
      if (Number.isNaN(d) || d < cutoff) return false;
      if (sponsor_id && n.sponsor_id !== sponsor_id) return false;
      if (component && n.component && n.component !== component) return false;
      return true;
    });
    emitReceipt('ingest', { tenant_id: 'admin', source: 'sam_sources_sought', count: notices.length, mode: 'fixture' });
    return notices;
  }
  emitReceipt('ingest_warning', { tenant_id: 'admin', source: 'sam_sources_sought', reason: 'live_mode_requested_but_not_implemented_in_v0_1', note: 'See AUDIT_REPORT §8 — Bubba\'s SAM key lacks Contract Opportunities API access. Falling back to fixture.' });
  return pull({ sponsor_id, component, window_days });
}

module.exports = { pull };
