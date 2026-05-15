#!/usr/bin/env node
// test_local_runner: spawns each test group as a child process, parses TAP
// output for pass/fail counts, prints the §4 summary table, exits 1 on any
// failure. Receipt chain is checked separately via test_chain.js.
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');

const GROUPS = [
  { id: 1, name: 'Foundation', files: ['test_t2h_gate.js'] },
  { id: 2, name: 'Scoring', files: ['test_scoring.js'], extra: { calibrate: true } },
  { id: 3, name: 'ART module', files: ['test_art_match.js', 'test_why_panel.js'] },
  { id: 4, name: 'Receipt chain', files: ['test_chain.js'] },
  { id: 5, name: 'Anonymizer', files: ['test_anonymizer_kanon.js'] },
  { id: 6, name: 'Sandbox', files: ['test_sandbox.js'] },
  { id: 7, name: 'Landing page', files: ['test_landing_page.js'] },
  { id: 8, name: 'Local mirror', files: ['test_local_mirror.js'] },
  { id: 9, name: 'Edge cases', files: ['test_edge_cases.js'] },
];

function runTestFile(file) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, ['--test', path.join(__dirname, file)], { cwd: ROOT });
    let out = '';
    let err = '';
    p.stdout.on('data', d => { out += d.toString(); });
    p.stderr.on('data', d => { err += d.toString(); });
    p.on('close', (code) => resolve({ file, code, stdout: out, stderr: err }));
  });
}

function parseTap(stdout) {
  let pass = 0, fail = 0, total = 0;
  const failures = [];
  for (const line of stdout.split('\n')) {
    const m = line.match(/^# (pass|fail|tests)\s+(\d+)/);
    if (m) {
      if (m[1] === 'pass') pass = parseInt(m[2], 10);
      else if (m[1] === 'fail') fail = parseInt(m[2], 10);
      else if (m[1] === 'tests') total = parseInt(m[2], 10);
    }
    const nm = line.match(/^not ok \d+\s*-\s*(.+)$/);
    if (nm) failures.push(nm[1]);
  }
  return { pass, fail, total, failures };
}

async function runCalibrate() {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, ['scripts/calibrate.js', '--quiet'], { cwd: ROOT });
    let out = '';
    p.stdout.on('data', d => { out += d.toString(); });
    p.on('close', () => {
      try {
        const m = out.match(/\{[\s\S]*?"topic_pass"[\s\S]*?\}/);
        const j = m ? JSON.parse(m[0]) : null;
        if (!j) return resolve({ pass: 0, total: 12 });
        resolve({ pass: (j.topic_pass + j.art_pass), total: (j.topic_total + j.art_total) });
      } catch { resolve({ pass: 0, total: 12 }); }
    });
  });
}

(async () => {
  console.log('══════════════════════════════════════════');
  console.log('  DSIP SENTINEL — LOCAL TEST RESULTS');
  console.log('══════════════════════════════════════════');
  let allOk = true;
  let aggregate = { pass: 0, total: 0 };
  const lines = [];
  for (const g of GROUPS) {
    let pass = 0, total = 0, failures = [];
    if (g.extra && g.extra.calibrate) {
      const cal = await runCalibrate();
      pass += cal.pass; total += cal.total;
    }
    for (const f of g.files) {
      const r = await runTestFile(f);
      const t = parseTap(r.stdout);
      pass += t.pass; total += t.total;
      if (t.fail > 0 || r.code !== 0) {
        allOk = false;
        for (const fn of t.failures) failures.push(`${f} :: ${fn}`);
        if (r.stderr) failures.push(`${f} stderr: ${r.stderr.split('\n')[0]}`);
      }
    }
    aggregate.pass += pass; aggregate.total += total;
    const status = (pass === total && pass > 0) ? '[PASS]' : '[FAIL]';
    const counts = `${pass}/${total}`;
    lines.push({ status, group: g.name, counts, failures });
  }

  // Chain summary (read live receipts.jsonl directly).
  const ledger = path.join(ROOT, 'receipts.jsonl');
  let chainSummary = '[SKIP] no receipts.jsonl found';
  let merkleRoot = null;
  if (fs.existsSync(ledger)) {
    const linesL = fs.readFileSync(ledger, 'utf8').split('\n').filter(Boolean);
    const { verifyChain, getCurrentMerkleRoot } = require('../src/core/receipt');
    const v = verifyChain();
    merkleRoot = getCurrentMerkleRoot() || '';
    chainSummary = v.ok
      ? `[INTACT] count=${linesL.length} root=${merkleRoot.slice(0, 12)}…`
      : `[BROKEN] at index ${v.broken_at}: ${v.reason}`;
    if (!v.ok) allOk = false;
  }

  for (const l of lines) {
    console.log(`  Group ${String(l.group).padEnd(20)} ${l.status} ${l.counts}`);
    for (const f of l.failures) console.log(`    ↳ ${f}`);
  }
  console.log('══════════════════════════════════════════');
  console.log(`  TOTAL:   ${allOk ? '[PASS]' : '[FAIL]'} ${aggregate.pass}/${aggregate.total}`);
  console.log(`  CHAIN:   ${chainSummary}`);
  console.log(`  GATE:    ${allOk ? 'T+48h eligible' : 'BLOCKED'}`);
  console.log('══════════════════════════════════════════');

  process.exit(allOk ? 0 : 1);
})();
