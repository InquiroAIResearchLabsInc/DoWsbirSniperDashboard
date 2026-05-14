#!/usr/bin/env bash
set -eo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PORT=${SMOKE_PORT:-3399}
PORT=$PORT node src/api/server.js &
PID=$!
trap "kill $PID 2>/dev/null || true" EXIT

# wait for boot up to 10s
for i in $(seq 1 20); do
  if curl -sf "http://localhost:$PORT/health" > /dev/null; then break; fi
  sleep 0.5
done

curl -sf "http://localhost:$PORT/health"           || { echo "health failed"; exit 1; }
echo
curl -sf "http://localhost:$PORT/api/whoami"       || { echo "whoami failed"; exit 1; }
echo
curl -sf "http://localhost:$PORT/api/admin/stats"  || { echo "admin/stats failed"; exit 1; }
echo
curl -sf "http://localhost:$PORT/api/receipts/verify" || { echo "verify failed"; exit 1; }
echo

kill $PID 2>/dev/null || true
wait $PID 2>/dev/null || true
echo "smoke ok"
