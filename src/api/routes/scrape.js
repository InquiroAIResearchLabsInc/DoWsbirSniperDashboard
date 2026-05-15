// On-demand scan — the dashboard scan button. Mirrors inquiro-sniper's
// "Scrape Now": POST /trigger spawns run_now.js as a child process and returns
// immediately; the child streams progress into a 4KB in-memory tail; the UI
// polls GET /status every 2s and refreshes when `running` flips back to false.
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { emitReceipt } = require('../../core/receipt');
const { requireAuth } = require('../../auth/middleware');

const router = express.Router();

const RUN_NOW = path.join(__dirname, '..', '..', 'scheduler', 'run_now.js');
const PROJECT_ROOT = path.join(__dirname, '..', '..', '..');
const TAIL_MAX = 4096; // 4KB stdout/stderr tail, Sniper-style

const scan = {
  running: false,
  job_id: null,
  started_at: null,
  last_run_at: null,
  last_result: null, // { inserted, updated, errors }
  tail: '',
};

// The child ends with `__SCAN_RESULT__ <json>` — pull the last such line.
function parseResult(tail) {
  const lines = tail.split('\n').filter(l => l.includes('__SCAN_RESULT__'));
  if (!lines.length) return null;
  try {
    return JSON.parse(lines[lines.length - 1].split('__SCAN_RESULT__')[1].trim());
  } catch (_) { return null; }
}

router.post('/trigger', requireAuth, (req, res) => {
  if (scan.running) {
    return res.status(409).json({ status: 'running', job_id: scan.job_id });
  }
  scan.running = true;
  scan.job_id = crypto.randomUUID();
  scan.started_at = new Date().toISOString();
  scan.last_result = null;
  scan.tail = '';

  const child = spawn(process.execPath, [RUN_NOW], {
    cwd: PROJECT_ROOT,
    env: process.env,
    windowsHide: true,
  });
  const append = (d) => { scan.tail = (scan.tail + d.toString()).slice(-TAIL_MAX); };
  child.stdout.on('data', append);
  child.stderr.on('data', append);
  child.on('exit', (code) => {
    scan.running = false;
    scan.last_run_at = new Date().toISOString();
    scan.last_result = parseResult(scan.tail)
      || { inserted: 0, updated: 0, errors: code === 0 ? 0 : 1 };
  });
  child.on('error', (err) => {
    scan.running = false;
    scan.last_run_at = new Date().toISOString();
    scan.tail = (scan.tail + '\nspawn error: ' + err.message).slice(-TAIL_MAX);
    scan.last_result = { inserted: 0, updated: 0, errors: 1 };
  });

  emitReceipt('scan_triggered', { tenant_id: req.tenant_id || 'admin', job_id: scan.job_id });
  res.status(202).json({ status: 'started', job_id: scan.job_id });
});

router.get('/status', requireAuth, (req, res) => {
  const body = {
    running: scan.running,
    job_id: scan.job_id,
    last_run_at: scan.last_run_at,
    last_result: scan.last_result,
  };
  // While running, expose the last 500 chars of the progress tail.
  if (scan.running) body.tail = scan.tail.slice(-500);
  res.json(body);
});

module.exports = router;
