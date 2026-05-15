const path = require('path');
require('dotenv').config();

function int(v, fallback) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function bool(v, fallback) {
  if (v == null) return fallback;
  const s = String(v).toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes') return true;
  if (s === 'false' || s === '0' || s === 'no') return false;
  return fallback;
}

const root = path.resolve(__dirname, '..', '..');

module.exports = {
  PORT: int(process.env.PORT, 3000),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DB_PATH: process.env.DB_PATH || path.join(root, 'data', 'dsip-sentinel.db'),
  RECEIPTS_PATH: process.env.RECEIPTS_PATH || path.join(root, 'receipts.jsonl'),
  MERKLE_ROOT_PATH: process.env.MERKLE_ROOT_PATH || path.join(root, 'merkle_root.txt'),
  MERKLE_BATCH_SIZE: int(process.env.MERKLE_BATCH_SIZE, 100),
  DEMO_TOKEN_SECRET: process.env.DEMO_TOKEN_SECRET || 'dev-only-demo-token-secret-rotate-in-prod',
  DEMO_TOKEN_DEFAULT_TTL_DAYS: int(process.env.DEMO_TOKEN_DEFAULT_TTL_DAYS, 30),
  MAGIC_LINK_SECRET: process.env.MAGIC_LINK_SECRET || 'dev-only-magic-link-secret-rotate-in-prod',
  MAGIC_LINK_TTL_MINUTES: int(process.env.MAGIC_LINK_TTL_MINUTES, 15),
  SBIR_API_BASE: process.env.SBIR_API_BASE || 'https://api.www.sbir.gov/public/api/solicitations',
  SBIR_PAGE_SIZE: int(process.env.SBIR_PAGE_SIZE, 25),
  SBIR_AGENCY_GAP_MS: int(process.env.SBIR_AGENCY_GAP_MS, 1500),
  SBIR_RATE_LIMIT_MS: int(process.env.SBIR_RATE_LIMIT_MS, 500),
  SBIR_INITIAL_DELAY_MS: int(process.env.SBIR_INITIAL_DELAY_MS, 250),
  SBIR_429_MAX_RETRIES: int(process.env.SBIR_429_MAX_RETRIES, 8),
  SAM_API_KEY: process.env.SAM_API_KEY || '',
  SAM_USE_FIXTURE: bool(process.env.SAM_USE_FIXTURE, true),
  KANON_MIN_TENANTS: int(process.env.KANON_MIN_TENANTS, 5),
  DEMO_SNAPSHOT_PATH: process.env.DEMO_SNAPSHOT_PATH || path.join(root, 'data', 'demo_snapshot.db'),
  ROOT: root,
};
