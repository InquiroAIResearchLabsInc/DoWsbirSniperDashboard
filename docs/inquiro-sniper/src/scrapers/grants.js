// ─── GRANTS.GOV API SCRAPER ───────────────────────────────────────────────────
// Source 3: All federal grants
const axios = require('axios');
const config = require('../config');

const SEARCH_URL = 'https://api.grants.gov/v1/api/search2';
const DETAIL_URL = (id) => `https://api.grants.gov/v1/api/fetchOpp?oppId=${id}`;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function dateStr(d) {
  return `${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')}/${d.getFullYear()}`;
}

function daysRemaining(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / 86400000);
}

function parseFunding(synopsisText = '') {
  const m = synopsisText.match(/\$([0-9,]+(?:\.[0-9]+)?)\s*(M|K|million|thousand)?/i);
  if (!m) return { min: null, max: null };
  let val = parseFloat(m[1].replace(/,/g, ''));
  const unit = (m[2] || '').toLowerCase();
  if (unit === 'm' || unit === 'million') val *= 1e6;
  if (unit === 'k' || unit === 'thousand') val *= 1e3;
  return { min: val * 0.5, max: val };
}

function normalizeGrant(g, detailText = '') {
  const desc = detailText || g.synopsis || g.description || '';
  const funding = parseFunding(desc);
  const closeDate = g.closeDate || null;
  const days = daysRemaining(closeDate);

  return {
    id: `grants_gov:${g.id || g.number}`,
    source: 'grants_gov',
    source_url: `https://grants.gov/search-grants?applId=${g.id}`,
    title: g.title || 'Untitled',
    description: desc,
    agency: g.agency || g.agencyName || '',
    sub_agency: '',
    program: g.fundingInstrumentTypes || g.opportunityCategory || 'Grant',
    phase: '',
    naics_codes: [],
    keywords: [],
    posted_date: g.openDate || null,
    open_date: g.openDate || null,
    close_date: closeDate,
    is_rolling: !closeDate,
    days_remaining: days,
    funding_min: funding.min,
    funding_max: funding.max,
    currency: 'USD',
  };
}

async function searchKeyword(keyword) {
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);

  try {
    const res = await axios.post(SEARCH_URL, {
      keyword,
      oppStatuses: 'posted',
      sortBy: 'openDate',
      rows: config.GRANTS_PAGE_SIZE,
      oppStartDateFrom: dateStr(yesterday),
      oppStartDateTo: dateStr(tomorrow),
    }, { timeout: 15000, headers: { 'Content-Type': 'application/json' } });

    return res.data?.oppHits || res.data?.opportunities || [];
  } catch (err) {
    console.error(`  [grants] Error searching "${keyword}":`, err.message);
    return [];
  }
}

async function scrape() {
  const allGrants = new Map();

  for (const kw of config.GRANTS_KEYWORDS) {
    console.log(`  [grants] Searching "${kw}"...`);
    const grants = await searchKeyword(kw);
    for (const g of grants) {
      const key = g.id || g.number;
      if (key) allGrants.set(key, g);
    }
    await sleep(config.RATE_LIMIT_DEFAULT_MS);
  }

  console.log(`  [grants] ${allGrants.size} unique grants — fetching details...`);
  const opportunities = [];

  for (const [id, grant] of allGrants) {
    let detailText = '';
    try {
      await sleep(config.RATE_LIMIT_DEFAULT_MS);
      const res = await axios.get(DETAIL_URL(id), { timeout: 10000 });
      detailText = res.data?.synopsis || res.data?.description || '';
    } catch { /* use summary */ }
    opportunities.push(normalizeGrant(grant, detailText));
  }

  console.log(`  [grants] Done: ${opportunities.length} opportunities`);
  return opportunities;
}

module.exports = { scrape };
