#!/usr/bin/env bash
set -eo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail() { echo "FAIL: $1"; exit 1; }

bash gates/gate_t24h.sh > /tmp/dsip_t24h_replay.log 2>&1 || { cat /tmp/dsip_t24h_replay.log; fail "t24h prerequisite"; }

node scripts/verify_chain.js > /tmp/dsip_chain.log 2>&1 || { cat /tmp/dsip_chain.log; fail "receipt chain verification failed"; }
grep -q '"ok":\s*true' /tmp/dsip_chain.log || { cat /tmp/dsip_chain.log; fail "chain not ok"; }

[ -f docs/DEMO_SCRIPT.md ] || fail "no DEMO_SCRIPT.md"
[ -f docs/PILOT_PLAYBOOK.md ] || fail "no PILOT_PLAYBOOK.md"
[ -f docs/ARCHITECTURE.md ] || fail "no ARCHITECTURE.md"
[ -f scripts/local_mirror.js ] || fail "no local_mirror.js"

grep -q "demo_snapshot.db" src/core/config.js || fail "demo snapshot path not configured"

bash gates/_smoke.sh > /tmp/dsip_smoke.log 2>&1 || { cat /tmp/dsip_smoke.log; fail "smoke failed"; }

if grep -RinE '#22c55e|sniper-bg.*#052e16|sniper-border.*#166534' public/styles.css 2>/dev/null | grep -v '/\*' ; then
  fail "DEMO_STEALTH_BOMBER palette violation: green found in public/styles.css"
fi

echo "PASS: T+48h — SHIP IT"
