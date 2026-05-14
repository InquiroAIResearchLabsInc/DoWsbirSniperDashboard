#!/usr/bin/env bash
set -eo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail() { echo "FAIL: $1"; exit 1; }

[ -f spec.md ]                                    || fail "no spec.md"
[ -f docs/PHASE_0_CONTEXT_LOADED.md ]             || fail "no PHASE_0_CONTEXT_LOADED.md"
[ -f package.json ]                               || fail "no package.json"
[ -f src/core/hash.js ]                           || fail "no core/hash.js"
[ -f src/core/receipt.js ]                        || fail "no core/receipt.js"
[ -f src/core/tenant.js ]                         || fail "no core/tenant.js"
[ -f src/core/stoprule.js ]                       || fail "no core/stoprule.js"
[ -f src/db/index.js ]                            || fail "no db/index.js"
[ -f src/auth/demo_token.js ]                     || fail "no auth/demo_token.js"
[ -f src/api/server.js ]                          || fail "no api/server.js"
[ -f tests/test_t2h_gate.js ]                     || fail "no test_t2h_gate.js"

node --test tests/test_t2h_gate.js > /tmp/dsip_t2h.log 2>&1 || { cat /tmp/dsip_t2h.log; fail "t2h test failed"; }

echo "PASS: T+2h"
