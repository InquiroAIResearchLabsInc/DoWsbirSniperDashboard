// User-triggered live refresh — the "Refresh" button on the dashboard, mirrors
// inquiro-sniper's "Scrape Now". Hits the live SBIR API in-process, persists +
// diffs + scores, and exposes a polled status object so the UI can show
// progress and re-render when the run finishes.
const { emitReceipt } = require('../core/receipt');
const { getDb, now } = require('../db');
const sbir = require('./sbir_api');
const { computeDiffs } = require('../diff/engine');

const REFRESH_CAP_MS = parseInt(process.env.REFRESH_CAP_MS || '90000', 10);

const state = {
  state: 'idle',        // 'idle' | 'running'
  started_at: null,
  finished_at: null,
  fetched: 0,           // opportunities returned by the scrape
  added: 0,             // newly-seen opportunities this run
  total: 0,             // total opportunities after the run
  error: null,          // human-readable failure reason, or null
};

function getScrapeState() { return { ...state }; }

async function withCap(promise, ms, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`${label} exceeded ${ms}ms`)), ms); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// Kick off a refresh. Returns false if one is already running. The scrape runs
// detached (not awaited) so the HTTP handler returns immediately; the UI polls
// getScrapeState() for completion.
function startScrape() {
  if (state.state === 'running') return false;
  state.state = 'running';
  state.started_at = now();
  state.finished_at = null;
  state.error = null;

  (async () => {
    try {
      const opps = await withCap(sbir.scrape(), REFRESH_CAP_MS, 'SBIR scrape');
      state.fetched = Array.isArray(opps) ? opps.length : 0;
      if (!state.fetched) {
        // An empty result must NOT reach computeDiffs — it would mark every
        // existing opportunity as closed. Treat it as a failed refresh.
        throw new Error('SBIR API returned no opportunities — this host may be unable to reach api.www.sbir.gov');
      }
      const counts = computeDiffs('sbir_gov', opps);
      const { scoreUnscoredForAllTenants } = require('../scheduler/cron');
      const scoring = scoreUnscoredForAllTenants();
      state.added = counts.new || 0;
      state.total = getDb().prepare('SELECT COUNT(*) c FROM opportunities').get().c;
      emitReceipt('manual_refresh', {
        tenant_id: 'admin',
        fetched: state.fetched,
        added: state.added,
        diff_counts: counts,
        scored: scoring.scored,
      });
    } catch (e) {
      state.error = e.message;
      emitReceipt('manual_refresh_error', { tenant_id: 'admin', error: e.message });
    } finally {
      state.state = 'idle';
      state.finished_at = now();
    }
  })();
  return true;
}

module.exports = { startScrape, getScrapeState };
