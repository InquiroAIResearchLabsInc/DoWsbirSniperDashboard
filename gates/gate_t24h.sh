#!/usr/bin/env bash
set -eo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail() { echo "FAIL: $1"; exit 1; }

bash gates/gate_t2h.sh > /tmp/dsip_t2h_replay.log 2>&1 || { cat /tmp/dsip_t2h_replay.log; fail "t2h prerequisite"; }

node --test tests/test_t2h_gate.js tests/test_t24h_gate.js tests/test_t48h_gate.js tests/test_why_panel.js tests/test_art_match.js tests/test_anonymizer_kanon.js > /tmp/dsip_t24h.log 2>&1 || { cat /tmp/dsip_t24h.log; fail "tests failed"; }

node scripts/calibrate.js --quiet > /tmp/dsip_calibrate.log 2>&1 || { cat /tmp/dsip_calibrate.log; fail "calibration failed"; }
grep -q '"topic_pass":\s*8' /tmp/dsip_calibrate.log || { cat /tmp/dsip_calibrate.log; fail "topic calibration not 8/8"; }
grep -q '"art_pass":\s*4'   /tmp/dsip_calibrate.log || { cat /tmp/dsip_calibrate.log; fail "ART calibration not 4/4"; }

grep -RnE 'emit_receipt|emitReceipt' src > /dev/null || fail "no emit_receipt anywhere in src"

grep -RnE 'dual_hash\b|dualHash\b' src > /dev/null || fail "no dual_hash anywhere in src"

grep -RnE 'sha256\(' src | grep -v 'dualHash\|hash.js' && fail "naked sha256 outside hash.js"

grep -RnE 'catch[^{]*\{\s*\}\s*$' src && fail "silent empty catch detected"

UNSUB=$(grep -Rln "<PLACEHOLDER_" public 2>/dev/null || true)
if [ -n "$UNSUB" ]; then echo "WARN: unsubstituted <PLACEHOLDER_*> tokens in public/: $UNSUB"; fi

[ -f data/dsip-sentinel.db ] || fail "db not migrated"

echo "PASS: T+24h"
