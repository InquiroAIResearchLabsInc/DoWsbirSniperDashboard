# RNA — Receipts-Native Architecture

> Authoritative reference. Self-contained. No external skill references.
> Location: `~/Desktop/inquiro-standards/RNA.md`

---

## DEFINITION

Receipts-native architecture makes cryptographic receipts the **primary** data structure.

```
Every operation returns (result, receipt)
receipt = dual_hash(SHA256:BLAKE3) + Merkle lineage + typed schema
```

**The compliance test:** Can you reconstruct complete system state from `receipts.jsonl` alone? If no — it is receipts-augmented, not receipts-native. Not the same thing.

---

## THE THREE LAWS

```
LAW_1 = "No receipt → not real"
LAW_2 = "No test → not shipped"
LAW_3 = "No gate → not alive"
```

| Law | Violation | Consequence |
|---|---|---|
| LAW_1 | Operation without receipt | StopRule raised, system halts |
| LAW_2 | Code without tests | Pre-commit hook blocks |
| LAW_3 | Release without gate | Production push forbidden |

---

## THE SIX PRINCIPLES

| # | Principle | Test | Violation |
|---|---|---|---|
| 1 | Native Provenance | Receipt is PRIMARY output, not a log | `logger.info()` instead of `emit_receipt()` |
| 2 | Cryptographic Lineage | Trace any receipt to genesis block | Missing `parent_hash` |
| 3 | Verifiable Causality | Audit WITHOUT source code | Decisions missing `input_hashes` |
| 4 | Query-as-Proof | Proofs derived at query time, never stored | Pre-computed alerts |
| 5 | Thermodynamic Governance | \|ΔS\| < 0.01 per cycle | Metrics-based health checks |
| 6 | Receipts-Gated Progress | No receipt → StopRule | Manual override of gate |

Pass all 6 → receipts-native. Fail any → receipts-augmented. State the difference clearly to every external reviewer.

---

## WHY COMPRESSION = FRAUD DETECTION

This is the scientific foundation of the moat. Understand it.

Legitimate operations exhibit **high entropy** — each transaction is contextually unique (different patient, diagnosis, timing, amount). High entropy resists compression.

Discrepancies exhibit **low entropy** — coordination reuses templates (same codes, same amounts, same intervals even with randomization). Low entropy compresses heavily.

**The test:** compress a population of receipts. Fraud clusters compress at 2.6–2.7x over zstd. Legitimate operations resist compression. Entropy is the detector. This is why Comprimere (upstream payload compression) and the entropy-based fraud detection are the same moat expressed at two layers.

```
legitimate operations → high entropy → poor compression ratio → not flagged
coordinated fraud     → low entropy  → high compression ratio → flagged
```

---

## THE 8 CANONICAL RECEIPT TYPES

| Type | Purpose | Required Fields |
|---|---|---|
| `ingest` | External data entry point | `payload_hash`, `source_type`, `redactions`, `tenant_id` |
| `anchor` | Merkle batching + lineage | `merkle_root`, `batch_size`, `hash_algos`, `proof_path` |
| `routing` | Query routing decision | `query_complexity`, `chosen_index_level`, `k`, `budget`, `reason` |
| `bias` | Fairness check | `groups`, `disparity`, `thresholds.max_disparity`, `mitigation_action` |
| `decision_health` | Strength/coverage/efficiency | `strength`, `coverage`, `efficiency`, `thresholds`, `policy_diffs` |
| `impact` | Pre/post comparison | `pre_metrics`, `post_metrics`, `cost`, `VIH_decision` |
| `anomaly` | Deviation event (all stoprules) | `metric`, `baseline`, `delta`, `classification`, `action` |
| `compaction` | Ledger summarization | `input_span`, `output_span`, `counts`, `sums`, `hash_continuity` |

NEVER create new receipt types without human approval. These 8 are the canonical set.

---

## CORE FUNCTIONS (COPY VERBATIM INTO EVERY PROJECT)

```python
import hashlib, json
from datetime import datetime

try:
    import blake3; HAS_BLAKE3 = True
except ImportError:
    HAS_BLAKE3 = False

def dual_hash(data: bytes | str) -> str:
    if isinstance(data, str): data = data.encode()
    sha = hashlib.sha256(data).hexdigest()
    b3 = blake3.blake3(data).hexdigest() if HAS_BLAKE3 else sha
    return f"{sha}:{b3}"

def emit_receipt(receipt_type: str, data: dict) -> dict:
    r = {
        "receipt_type": receipt_type,
        "ts": datetime.utcnow().isoformat() + "Z",
        "tenant_id": data.get("tenant_id", "default"),
        "payload_hash": dual_hash(json.dumps(data, sort_keys=True)),
        **data
    }
    print(json.dumps(r), flush=True)
    return r

class StopRule(Exception):
    pass

def merkle(items: list) -> str:
    if not items: return dual_hash(b"empty")
    h = [dual_hash(json.dumps(i, sort_keys=True)) for i in items]
    while len(h) > 1:
        if len(h) % 2: h.append(h[-1])
        h = [dual_hash(h[i]+h[i+1]) for i in range(0, len(h), 2)]
    return h[0]
```

---

## DOMAIN-SPECIFIC SLOs

### QED (Telemetry Compression)
| Metric | Threshold |
|---|---|
| Compression ratio | ≥ 20.0 |
| Anomaly detection | ratio < 5.0 triggers flag |
| PLANCK_ENTROPY | ≥ 0.001 bits |

### ProofPack (Discrepancy Detection)
| Metric | Threshold |
|---|---|
| Discrepancy detection ratio | > 0.40 |
| Multi-dimensional violations | 2+ required |
| False positive rate | < 5% |

### SpaceProof (Autonomy)
| Metric | Threshold |
|---|---|
| Compression ratio | ≥ 10x |
| Receipt recall | ≥ 0.999 |
| Max receipt size | < 100KB |

### AI Flight Recorder (Decision Quality)
| Metric | Threshold |
|---|---|
| Effectiveness score | ≥ 0.85–0.95 (domain-configured) |
| Multi-dim operation latency | < 250ms for 1000 ops |

---

## MANDATORY DOMAIN COMPOSITIONS

These module combinations are required — not optional:

| Domain | Required Modules | Critical Scenario |
|---|---|---|
| Telemetry (QED) | core + ledger + detect + anchor + entropy + multidimensional | THERMODYNAMIC |
| Discrepancy (ProofPack) | core + ledger + detect + anchor + loop + quantum + multidimensional + mcp_server | STRESS |
| Space (SpaceProof) | core + ledger + anchor + sovereignty + multidimensional | SINGULARITY |
| Autonomous (AI Flight Recorder) | core + ledger + topology + governance + multidimensional | FEEDBACK_LOOP |

---

## MCP PROTOCOL (REQUIRED — EVERY RNA SYSTEM)

```json
{
  "mcpServers": {
    "[system_name]": {
      "command": "python",
      "args": ["-m", "[system_name].mcp_server"],
      "tools": ["query_receipts", "verify_chain", "get_topology"]
    }
  }
}
```

| Tool | Signature | Returns |
|---|---|---|
| `query_receipts` | `(filters: dict)` | Matching receipt list |
| `verify_chain` | `(start: str, end: str)` | `bool` — chain intact |
| `get_topology` | `(pattern_id: str)` | `open\|hybrid\|closed` |

No RNA system ships without an MCP server. This is what enables Claude-native audit.

---

## THE FOUR GLYPHS

All glyphs are signed, timestamped, Merkle-addressable:

```
INTENT_GLYPH    → goal + constraints + risk_bounds + ownership + signature + merkle_anchor
EVIDENCE_GLYPH  → retrieval_state + sbsd_params + entanglement_score + signature
DECISION_GLYPH  → brief + decision_health + dialectical_record + attached_receipts
ANCHOR_GLYPH    → config + code_hashes + dataset_hashes + receipts_jsonl + slo_deltas
```

---

## COMPETITIVE FRAME

| Competitor | Their question | RNA's question |
|---|---|---|
| EQTY Lab | "Did this model run on this hardware?" | "What did this system decide and why?" |
| Nethermind | zk proof-of-compute | Court-admissible decision provenance |
| Polyhedra | zkML inference proofs | FRE 901(b)(9) decision chains |
| Lagrange Labs | Verifiable compute | Verifiable governance |

**Verification ≠ provenance.** Competitors prove the compute happened. RNA proves what the autonomous system decided, why, and what the consequences were — reconstructable from ledger alone, admissible under FRE 901(b)(9). Different moats entirely.

---

## VERIFIED REPOSITORIES

| Repo | Status | Domain |
|---|---|---|
| `northstaraokeystone/proofpack` | RNA-compliant | Discrepancy detection |
| `northstaraokeystone/qed` | RNA-compliant | Telemetry compression |
| `northstaraokeystone/space-proof` | RNA-compliant | Space autonomy |
| `northstaraokeystone/ai-flight-recorder` | RNA-compliant, v2.1 | Defense/drone governance |

---

## RULES OF ENGAGEMENT FOR CLAUDE CODE

1. MUST read this file before implementing any operation touching the ledger
2. NEVER create new receipt types without human approval — 8 canonical types exist
3. NEVER modify existing receipts — append a correction_receipt instead
4. MUST verify `tenant_id` on every receipt or the commit is blocked
5. MUST expose MCP server — no RNA system ships without it
6. Compliance test: after implementation, verify state can be reconstructed from `receipts.jsonl` alone
7. Append implementation insights as NOTES below — never modify above

---

## NOTES (append-only)

_No notes yet._

---

**Version:** 3.1 | **Last updated:** 2026-04-21
*The receipt is the territory.*
