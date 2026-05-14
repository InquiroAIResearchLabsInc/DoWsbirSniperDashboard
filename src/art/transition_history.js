const fs = require('fs');
const path = require('path');
const config = require('../core/config');

const FIXTURE_PATH = path.join(config.ROOT, 'tests', 'fixtures', 'phase_iii_awards_sample.json');

let _cache = null;
let _cacheTs = 0;
const CACHE_TTL_MS = 24 * 3600 * 1000;

function loadFixture() {
  const now = Date.now();
  if (_cache && now - _cacheTs < CACHE_TTL_MS) return _cache;
  if (!fs.existsSync(FIXTURE_PATH)) { _cache = { sponsors: {} }; _cacheTs = now; return _cache; }
  try {
    _cache = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
    _cacheTs = now;
  } catch { _cache = { sponsors: {} }; _cacheTs = now; }
  return _cache;
}

function scoreFor(sponsor) {
  const fx = loadFixture();
  const data = fx.sponsors[sponsor.id] || { phase_iii: [] };
  const five_years_ago = Date.now() - 5 * 365 * 86400000;
  const recent = data.phase_iii.filter(a => Date.parse(a.award_date || '1970-01-01') >= five_years_ago);
  const count = recent.length;
  const total = recent.reduce((s, a) => s + (a.amount_usd || 0), 0);
  const vendorDiversity = new Set(recent.map(a => a.vendor_uei || a.vendor)).size;

  let score = 0;
  if (count > 0) {
    const countComponent = Math.min(60, count * 5);
    const dollarComponent = total >= 100_000_000 ? 30 : total >= 25_000_000 ? 20 : total >= 5_000_000 ? 10 : 5;
    const diversityComponent = Math.min(10, vendorDiversity);
    score = Math.min(100, countComponent + dollarComponent + diversityComponent);
  }
  return {
    score,
    count,
    total_usd: total,
    vendor_diversity: vendorDiversity,
    sample: recent.slice(0, 5),
  };
}

module.exports = { scoreFor };
