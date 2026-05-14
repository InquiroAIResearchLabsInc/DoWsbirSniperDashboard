// --- DASA WATCH SCRAPER ---
// Source 5: UK Defence & Security Accelerator -- WATCH MODE (closed until July 2026).
const axios = require('axios');
const cheerio = require('cheerio');
const { updateSourceStatus, now } = require('../db');

const WATCH_URL = 'https://www.gov.uk/guidance/apply-for-funding-from-the-defence-and-security-accelerator';
const REOPENING_KEYWORDS = [
  'open for applications', 'new competition', 'reopened',
  'ukdi competition', 'uk defence innovation competition',
];

async function scrape() {
  console.log('  [dasa] Checking DASA status (watch mode)...');
  let statusText = 'CLOSED -- transitioning to UK Defence Innovation (UKDI). Reopening ~July 2026.';
  let reopeningDetected = false;
  let trigger = null;
  let fetchError = null;

  try {
    const res = await axios.get(WATCH_URL, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; InquiroScraper/1.0)' },
    });
    const $ = cheerio.load(res.data);
    const pageText = ($('main').text() || $('body').text()).toLowerCase();

    for (const kw of REOPENING_KEYWORDS) {
      if (pageText.includes(kw)) {
        reopeningDetected = true;
        trigger = kw;
        statusText = `CHANGE DETECTED: "${kw}" found on DASA apply page. Manual review required.`;
        console.warn(`  [dasa] REOPENING SIGNAL DETECTED: "${kw}"`);
        break;
      }
    }
    if (!reopeningDetected) console.log('  [dasa] Still closed. No reopening signals detected.');
  } catch (err) {
    console.error('  [dasa] Error:', err.message);
    fetchError = err.message;
  }

  updateSourceStatus('dasa_uk', {
    last_run: now(),
    last_success: fetchError ? null : now(),
    last_count: 1,
    last_error: fetchError,
    status: reopeningDetected ? 'change_detected' : 'watch',
  });

  return [{
    id: 'dasa_uk:open-call-watch',
    source: 'dasa_uk',
    source_url: WATCH_URL,
    title: reopeningDetected
      ? `DASA UK -- change detected (${trigger})`
      : 'DASA UK Open Call (watch -- reopens ~July 2026)',
    description: `${statusText} UK MOD DASA accepts proposals from US companies. Two categories: Emerging Innovations (GBP50K-GBP100K) and Rapid Impact (GBP200K-GBP350K). Zero equity.`,
    agency: 'UK MOD',
    sub_agency: 'DASA',
    program: 'Open Call',
    phase: 'Open',
    naics_codes: [],
    keywords: [],
    posted_date: null,
    open_date: null,
    close_date: null,
    is_rolling: reopeningDetected,
    days_remaining: null,
    funding_min: 50000,
    funding_max: 350000,
    currency: 'GBP',
    is_watch_only: true,
  }];
}

module.exports = { scrape };
