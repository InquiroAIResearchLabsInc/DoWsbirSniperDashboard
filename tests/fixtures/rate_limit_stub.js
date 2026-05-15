// rate_limit_stub: minimal HTTP 429 simulator. Used by Group 9 edge tests
// to verify backoff + ingest_receipt(status='rate_limited') behavior without
// hitting the network.
const http = require('http');

function start({ port = 0, fails_before_success = Infinity, retry_after_seconds = null } = {}) {
  let hits = 0;
  const server = http.createServer((req, res) => {
    hits++;
    if (hits <= fails_before_success) {
      const headers = { 'Content-Type': 'application/json' };
      if (retry_after_seconds != null) headers['Retry-After'] = String(retry_after_seconds);
      res.writeHead(429, headers);
      res.end(JSON.stringify({ error: 'rate_limited' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ solicitations: [], results: [] }));
  });
  return new Promise((resolve, reject) => {
    server.listen(port, () => {
      const addr = server.address();
      resolve({
        url: `http://127.0.0.1:${addr.port}`,
        port: addr.port,
        hits: () => hits,
        close: () => new Promise(r => server.close(r)),
      });
    });
    server.on('error', reject);
  });
}

module.exports = { start };
