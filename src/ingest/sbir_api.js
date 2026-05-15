const axios = require('axios');
const config = require('../core/config');
const { emitReceipt } = require('../core/receipt');
const { normalizeTopic, normalizeSolicitation } = require('./normalize');

const DOW_AGENCIES = ['DOD'];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function parseRetryAfterMs(h = {}) {
  const ra = h['retry-after'] || h['Retry-After'];
  if (ra == null) return null;
  const i = parseInt(ra, 10);
  if (!Number.isNaN(i)) return Math.max(i * 1000, 1000);
  const d = Date.parse(ra);
  if (!Number.isNaN(d)) return Math.max(d - Date.now(), 1000);
  return null;
}

async function fetchPage(agency, offset = 0) {
  let attempt = 0;
  let backoff = 3000;
  while (attempt <= config.SBIR_429_MAX_RETRIES) {
    try {
      const res = await axios.get(config.SBIR_API_BASE, {
        params: { agency, open: 1, rows: config.SBIR_PAGE_SIZE, start: offset },
        timeout: 20000,
        headers: { Accept: 'application/json', 'User-Agent': 'DSIPSentinel/0.2 (DoW SBIR topic discovery)' },
        validateStatus: s => s < 500,
      });
      if (res.status === 429) {
        attempt++;
        const wait = parseRetryAfterMs(res.headers) || backoff;
        await sleep(wait);
        backoff = Math.min(Math.round(backoff * 1.8), 120000);
        continue;
      }
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      return res.data;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response && err.response.status === 429) {
        attempt++;
        const wait = parseRetryAfterMs(err.response.headers) || backoff;
        await sleep(wait);
        backoff = Math.min(Math.round(backoff * 1.8), 120000);
        continue;
      }
      throw err;
    }
  }
  throw new Error('Exceeded SBIR retry budget');
}

async function scrapeAgency(agency) {
  const opps = [];
  let offset = 0;
  let hasMore = true;
  await sleep(config.SBIR_INITIAL_DELAY_MS);
  while (hasMore) {
    let data;
    try { data = await fetchPage(agency, offset); }
    catch (err) {
      emitReceipt('ingest_error', { tenant_id: 'admin', source: 'sbir_gov', agency, offset, error: err.message });
      break;
    }
    const items = Array.isArray(data) ? data : (data.solicitations || data.results || []);
    if (!items.length) break;
    for (const sol of items) {
      const topics = sol.solicitation_topics || sol.topics || [];
      if (topics.length > 0) for (const t of topics) opps.push(normalizeTopic(t, sol, agency));
      else opps.push(normalizeSolicitation(sol, agency));
    }
    if (items.length < config.SBIR_PAGE_SIZE) hasMore = false;
    else { offset += config.SBIR_PAGE_SIZE; await sleep(config.SBIR_RATE_LIMIT_MS); }
  }
  return opps;
}

async function scrape() {
  const all = [];
  for (const agency of DOW_AGENCIES) {
    const opps = await scrapeAgency(agency);
    all.push(...opps);
    await sleep(config.SBIR_AGENCY_GAP_MS);
  }
  const seen = new Set();
  const deduped = all.filter(o => seen.has(o.id) ? false : seen.add(o.id));
  // Sentinel is the 12-component DoW lens — Navy runs a separate annual BAA
  // (spec.md §16.2) and is excluded from the topic feed.
  const dow12 = deduped.filter(o => o.component !== 'navy');
  emitReceipt('ingest', {
    tenant_id: 'admin', source: 'sbir_gov',
    count: dow12.length, navy_excluded: deduped.length - dow12.length,
  });
  return dow12;
}

module.exports = { scrape, scrapeAgency, fetchPage };
