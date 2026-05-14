# META_LOOP — Learning System Topology

> Authoritative reference. Self-contained.
> Location: `~/Desktop/inquiro-standards/META_LOOP.md`

---

## THE PHYSICS

Pulsar magnetosphere maps directly to learning system behavior:

| Field Topology | Learning State |
|---|---|
| Closed field lines | Pattern optimizes internally |
| Open field lines | Pattern graduates to autonomy |
| Separatrix | Escape velocity threshold |

This is not metaphor. The mathematical structure is identical: a system with an internal optimization loop that crosses a threshold and transitions to an autonomous state.

---

## THE CLASSIFICATION EQUATION

```python
# ONE equation. Everything follows from it.

IF  E >= V_esc[domain]  AND  A > 0.75:   topology = "open"    # GRADUATE → cascade
ELIF T > 0.70:                            topology = "hybrid"  # TRANSFER → cross-domain
ELSE:                                     topology = "closed"  # OPTIMIZE → internal loop

# WHERE:
# E = effectiveness    = (H_before - H_after) / n_receipts
# V_esc = escape velocity for this domain (see CONSTANTS)
# A = autonomy rate   = auto_approved / total_actions
# T = transfer score  = temporal_graph_similarity  ← NOT cosine (cosine loses sequence)
```

---

## CONSTANTS (HUMAN APPROVAL REQUIRED TO CHANGE)

```python
ESCAPE_VELOCITY = {
    "qed_compression":  0.90,
    "proofpack_gap":    0.85,
    "axiom_discovery":  0.88,
    "meta_transfer":    0.80
}
AUTONOMY_THRESHOLD  = 0.75
TRANSFER_THRESHOLD  = 0.70
CASCADE_MULTIPLIER  = 5
CONFIDENCE_FALLBACK = 0.85   # below this → trigger external enrichment before classifying
```

These are not configuration values. They are physics-derived thresholds. Changing them without empirical justification breaks the governance guarantee.

---

## THE 8-PHASE CYCLE (60 seconds per full cycle)

```
SENSE → ANALYZE → CLASSIFY → HARVEST → HYPOTHESIZE → GATE → ACTUATE → SELECT
```

| Phase | Input | Output | Receipt | Stoprule |
|---|---|---|---|---|
| SENSE | Subsystem receipts | Pattern candidates | `sense_receipt` | Missing patterns → halt |
| ANALYZE | Candidates | Effectiveness metrics | `analyze_receipt` | E computation fails → halt |
| CLASSIFY | Metrics + confidence | Topology + fallback trigger | `topology_receipt` | 100% assignment required |
| HARVEST | Topologies | Sorted queues | `harvest_receipt` | Queue imbalance → violation |
| HYPOTHESIZE | Queues | Action proposals | `hypothesis_receipt` | Zero proposals → halt |
| GATE | Proposals | Approved/deferred | `gate_receipt` | No approver logged → block |
| ACTUATE | Approved actions | Results | `actuate_receipt` | Action fails → violation |
| SELECT | All patterns | Survivors + superposition | `selection_receipt` | \|Δentropy\| ≥ 0.01 → HALT |

**11 total receipt types:** above 8 + `cascade_receipt` + `transfer_receipt` + `meta_loop_receipt`

Every phase MUST emit its receipt. A cycle without complete receipts did not happen (LAW_1).

---

## CONFIDENCE-GATED FALLBACK

If classification confidence < `CONFIDENCE_FALLBACK` (0.85):

```
1. DO NOT classify yet
2. Trigger external enrichment (web search, temporal graph, peer receipts)
3. Merge enriched context into pattern
4. Reclassify with full context
5. Emit topology_receipt with actual confidence value
```

A low-confidence classification that drives a cascade is worse than no classification. The fallback exists because wrong topology assignment cascades multiply the error.

---

## TOPOLOGY ACTIONS

### OPEN → Graduate + Cascade
```
for i in range(CASCADE_MULTIPLIER):
    variant = mutate(pattern, rate=0.05)
    variant = recombine(variant, find_similar_pattern(pattern))
    if backtest(variant).success_rate >= 0.75:
        deploy(variant)
        emit cascade_receipt(parent=pattern.id, child=variant.id)
```
MUST spawn variants. NEVER mark OPEN and skip cascade.

### HYBRID → Transfer
```
target_domains = find_similar_patterns(pattern, threshold=TRANSFER_THRESHOLD)
for domain in target_domains:
    emit transfer_receipt(source=pattern.domain, target=domain, similarity=T)
    inject(pattern, domain)
```

### CLOSED → Optimize
```
continue internal optimization loop
emit optimization_receipt per cycle
do NOT cascade, do NOT transfer
```

---

## INTEGRATION HOOKS (CROSS-SYSTEM)

```python
# QED
topology = META.classify(pattern)
META.handle(pattern, topology)

# ProofPack
topology = META.classify(helper)
META.handle(helper, topology)

# AXIOM
if law.compression >= 0.88:
    topology = META.classify(law)
    META.handle(law, topology)

# AI Flight Recorder
for decision in autonomous_decisions:
    topology = META.classify(decision)
    META.handle(decision, topology)
    # topology_receipt feeds back into governance chain
```

---

## SLOs

| Metric | Threshold | Breach Action |
|---|---|---|
| Classification accuracy | ≥ 95% | Emit violation |
| Topology assignment rate | 100% | Emit violation |
| Cascade spawn multiplier | 1–5x | Emit violation |
| Entropy conservation | \|Δ\| < 0.01 | HALT |
| Confidence fallback rate | < 20% | Log warning |
| Cycle completion | ≥ 99.9% | Emit violation |

---

## THE PARADIGM SHIFT

**v2.0:** Static thresholds decide topology.
**v2.1:** Confidence-gated classification with automatic fallback enrichment.

A pattern is not just open/closed/hybrid. It is open/closed/hybrid **at a measured confidence level**. A high-confidence CLOSED is different from a low-confidence CLOSED — the latter triggers enrichment before accepting the classification.

---

## RULES OF ENGAGEMENT FOR CLAUDE CODE

1. MUST read this before classifying any module's topology
2. NEVER change constants without human approval and documented empirical justification
3. MUST emit `topology_receipt` on every classification — no silent classification
4. MUST spawn CASCADE_MULTIPLIER variants on every OPEN — no partial cascade
5. If confidence < 0.85 → trigger enrichment → reclassify → only then emit receipt
6. MUST emit all 11 receipt types across a full cycle — missing any = cycle didn't happen
7. Append build insights as NOTES below — NEVER modify above

---

## NOTES (append-only — insights from builds)

_No notes yet. Append dated entries below._

---

**Version:** 2.1 | **Last updated:** 2026-04-21
*Topology determines fate. Physics decides, not engineers.*
