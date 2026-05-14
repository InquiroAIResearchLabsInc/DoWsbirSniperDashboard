const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsip-kanon-'));
process.env.DB_PATH = path.join(tmp, 'k.db');
process.env.RECEIPTS_PATH = path.join(tmp, 'k.jsonl');
process.env.MERKLE_ROOT_PATH = path.join(tmp, 'k.merkle');
process.env.KANON_MIN_TENANTS = '5';

const { kanonGate, stripIdentifying, IDENTIFYING_FIELDS } = require('../src/learning/anonymizer');

function makeRow(tenant_id, idx) {
  return {
    id: `o${idx}`, tenant_id, opportunity_id: `opp_${idx}`, title: `T${idx}`, company_name: 'Acme', uei: 'U1',
    rejection_reason: 'reason', what_worked: 'w', what_failed: 'f', notes: 'n',
    component: 'army', terminal_status: idx % 2 ? 'awarded' : 'rejected',
    original_tech_alignment: 80, original_domain_alignment: 75, original_submission_type: 70,
    original_timeline: 60, original_funding_efficiency: 50, original_score: 75,
  };
}

test('stripIdentifying removes identifying + *_id fields', () => {
  const stripped = stripIdentifying(makeRow('t1', 1));
  for (const f of IDENTIFYING_FIELDS) assert.equal(stripped[f], undefined, `field ${f} should be stripped`);
  assert.equal(stripped.opportunity_id, undefined);
  assert.equal(stripped.pipeline_id, undefined);
  assert.equal(stripped.component, 'army');
  assert.equal(stripped.original_tech_alignment, 80);
});

test('kanonGate blocks below threshold', () => {
  for (let n = 0; n < 5; n++) {
    const rows = [];
    for (let i = 0; i < n; i++) rows.push(makeRow(`t${i}`, i));
    const r = kanonGate({ rows, component: 'army', dimension: 'tech_alignment' });
    assert.equal(r.ok, false, `expected block at n=${n}`);
    assert.equal(r.n, n);
  }
});

test('kanonGate passes at and above threshold', () => {
  for (let n = 5; n <= 10; n++) {
    const rows = [];
    for (let i = 0; i < n; i++) rows.push(makeRow(`t${i}`, i));
    const r = kanonGate({ rows, component: 'army', dimension: 'tech_alignment' });
    assert.equal(r.ok, true, `expected pass at n=${n}`);
    assert.equal(r.n, n);
  }
});

test('kanonGate counts distinct tenants only', () => {
  const rows = [];
  for (let i = 0; i < 10; i++) rows.push(makeRow('only_one_tenant', i));
  const r = kanonGate({ rows, component: 'army', dimension: 'tech_alignment' });
  assert.equal(r.ok, false);
  assert.equal(r.n, 1);
});

test('fuzz: 100 random inputs all respect threshold', () => {
  for (let trial = 0; trial < 100; trial++) {
    const distinct = Math.floor(Math.random() * 10);
    const rows = [];
    const tenantPool = Array.from({ length: distinct }, (_, i) => `tenant_${trial}_${i}`);
    const rowCount = Math.floor(Math.random() * 30) + 1;
    for (let i = 0; i < rowCount; i++) {
      const t = tenantPool[Math.floor(Math.random() * Math.max(1, tenantPool.length))] || `unique_${trial}_${i}`;
      rows.push(makeRow(t, i));
    }
    const r = kanonGate({ rows, component: 'fuzz', dimension: 'd' });
    const expected = (new Set(rows.map(x => x.tenant_id))).size >= 5;
    assert.equal(r.ok, expected, `trial ${trial}: rows=${rowCount}, distinct=${r.n}, expected=${expected}, got=${r.ok}`);
  }
});
