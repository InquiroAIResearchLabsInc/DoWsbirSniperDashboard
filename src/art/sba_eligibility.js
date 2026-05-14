const { getDb, uid, now } = require('../db');
const { emitReceipt } = require('../core/receipt');
const { dualHash, stableStringify } = require('../core/hash');

const SBA_CRITERIA = [
  { key: 'prior_phase_ii', source: 'P.L. 119-83 §3', label: 'At least one prior Phase II award' },
  { key: 'private_match_secured', source: 'P.L. 119-83 §3', label: '100% matching from new private capital or qualifying non-SBIR government sources' },
  { key: 'commercial_viability', source: 'P.L. 119-83 §3', label: 'Demonstrated commercial viability' },
  { key: 'pom_commitment_secured', source: 'DoW additional criterion', label: 'POM inclusion commitment from senior DoW acquisition official' },
  { key: 'dow_match_secured', source: 'DoW additional criterion', label: 'At least 20% matching from new DoW sources' },
];

function compute({ tenant_id, profile, phase_ii_count = 0 }) {
  const evidence = [];
  const missing = [];

  for (const c of SBA_CRITERIA) {
    let ok = false;
    let value = null;
    if (c.key === 'prior_phase_ii') {
      const n = Math.max(phase_ii_count, profile && profile.phase_ii_count_self ? profile.phase_ii_count_self : 0);
      ok = n >= 1; value = n;
    } else {
      value = profile ? !!profile[c.key] : false;
      ok = !!value;
    }
    if (ok) evidence.push({ criterion: c.key, source: c.source, label: c.label, value });
    else missing.push({ criterion: c.key, source: c.source, label: c.label });
  }

  const eligible = missing.length === 0;
  const payload = { tenant_id, eligible, missing, evidence };
  const payload_hash = dualHash(stableStringify(payload));

  const db = getDb();
  const id = uid();
  db.prepare('INSERT INTO sba_eligibility (id, tenant_id, computed_at, eligible, missing_criteria, evidence, receipt_hash) VALUES (?,?,?,?,?,?,?)')
    .run(id, tenant_id, now(), eligible ? 1 : 0, JSON.stringify(missing), JSON.stringify(evidence), payload_hash);

  const r = emitReceipt('sba_eligibility_flag_emitted', {
    tenant_id,
    eligible,
    missing_criteria_count: missing.length,
    evidence_count: evidence.length,
    payload_hash,
  });

  return { id, eligible, missing, evidence, payload_hash, receipt_hash: r.receipt_hash };
}

module.exports = { compute, SBA_CRITERIA };
