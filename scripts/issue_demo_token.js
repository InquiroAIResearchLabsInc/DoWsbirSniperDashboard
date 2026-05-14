#!/usr/bin/env node
const demo = require('../src/auth/demo_token');
const config = require('../src/core/config');

function arg(name, def) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx < 0) return def;
  return process.argv[idx + 1];
}

function ttlDaysFrom(spec, def) {
  if (!spec) return def;
  const m = String(spec).match(/^(\d+)([dD])?$/);
  if (m) return parseInt(m[1], 10);
  const n = parseInt(spec, 10);
  if (Number.isFinite(n)) return n;
  return def;
}

const tenant_id = arg('tenant');
if (!tenant_id) {
  console.error('Usage: node scripts/issue_demo_token.js --tenant <tenant_id> [--ttl 30d] [--role pilot|director|admin] [--base https://dsip-sniper.example]');
  process.exit(1);
}
const ttl_days = ttlDaysFrom(arg('ttl'), config.DEMO_TOKEN_DEFAULT_TTL_DAYS);
const role = arg('role', 'pilot');
const base = arg('base', `http://localhost:${config.PORT}`);
const out = demo.issue({ tenant_id, ttl_days, role });
const url = `${base.replace(/\/$/, '')}/api/auth/use?t=${encodeURIComponent(out.token)}`;
console.log(JSON.stringify({ ...out, url }, null, 2));
