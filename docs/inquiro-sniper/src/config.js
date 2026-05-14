// --- INQUIRO SNIPER CONFIG ---
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

function trimQuotedEnv(raw) {
  if (raw == null || raw === '') return '';
  let s = String(raw).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1).trim();
  return s;
}
const samLookbackDays = parseInt(process.env.SAM_POSTED_LOOKBACK_DAYS || '90', 10);
module.exports = {
  SAM_API_KEY: trimQuotedEnv(process.env.SAM_API_KEY),
  SAM_POSTED_LOOKBACK_DAYS: Number.isFinite(samLookbackDays) ? Math.min(364, Math.max(1, samLookbackDays)) : 90,
  DB_PATH: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'sniper.db'),
  PORT: parseInt(process.env.PORT || '3000', 10),
  RATE_LIMIT_DEFAULT_MS: 1100,
  SBIR_RATE_LIMIT_MS: parseInt(process.env.SBIR_RATE_LIMIT_MS || '4500', 10) || 4500,
  SBIR_INITIAL_DELAY_MS: parseInt(process.env.SBIR_INITIAL_DELAY_MS || '2500', 10) || 2500,
  SBIR_AGENCY_GAP_MS: parseInt(process.env.SBIR_AGENCY_GAP_MS || '6000', 10) || 6000,
  SBIR_429_MAX_RETRIES: parseInt(process.env.SBIR_429_MAX_RETRIES || '8', 10) || 8,
  RATE_LIMIT_SAM_MS: 110,
  SBIR_PAGE_SIZE: 50,
  SAM_PAGE_SIZE: 100,
  GRANTS_PAGE_SIZE: 25,
  CLOSING_SOON_DAYS: 14,
  DEADLINE_WARNING_DAYS: 7,
  DISMISS_EXPIRY_DAYS: 90,
  DIFF_WINDOW_DEFAULT_DAYS: 7,
  SBIR_AGENCIES: ['DOD', 'NASA', 'DHS', 'DOE'],
  SAM_NAICS_CODES: ['541715', '541511', '541519', '541512', '541330', '518210'],
  SAM_KEYWORDS: ['autonomous systems','data fusion','zero trust','AI governance','decision provenance','cryptographic','audit trail'],
  GRANTS_KEYWORDS: ['autonomous systems governance','AI verification','cryptographic audit','zero trust','data fusion','decision accountability','trustworthy AI','cybersecurity research'],
  CALIBRATION_THRESHOLD: 5,
  CURRENCY_RATES: { USD: 1, GBP: 1.27, EUR: 1.10 },
};
