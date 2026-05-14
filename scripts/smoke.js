#!/usr/bin/env node
const url = process.env.TEST_URL || `http://localhost:${process.env.PORT || 3000}`;

async function hit(p, opts = {}) {
  const r = await fetch(url + p, opts);
  if (!r.ok) throw new Error(`${p} -> ${r.status} ${r.statusText}`);
  return r.json();
}

(async () => {
  console.log(`Smoke target: ${url}`);
  const health = await hit('/health'); console.log('health', health.status);
  const me = await hit('/api/whoami'); console.log('whoami', me);
  const stats = await hit('/api/admin/stats'); console.log('stats', stats);
  const verify = await hit('/api/receipts/verify'); console.log('verify_chain', verify);
  if (!verify.ok) { console.error('chain broken'); process.exit(1); }
  console.log('SMOKE OK');
})().catch(e => { console.error(e.message); process.exit(1); });
