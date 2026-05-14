# MONTE_CARLO — Simulation Validation Standard

> Authoritative reference. Self-contained.
> Location: `~/Desktop/inquiro-standards/MONTE_CARLO.md`

---

## THE PARADIGM

**Unit tests:** Does this function return correct values?
**Monte Carlo:** Does this system reach stable equilibrium under extreme conditions?

These test different things. Both are required. Passing unit tests with failing Monte Carlo means you have a system of correct functions that compose into an unstable system. That system will fail in production.

```
Microscopic correctness (unit tests) + Macroscopic correctness (Monte Carlo) = production-ready
Microscopic correctness alone = production risk
```

---

## THE 8 MANDATORY SCENARIOS

**ALL must pass before T+48h gate. Partial pass = gate failure.**

| # | Name | Cycles | Pass Criteria | Kill Condition |
|---|---|---|---|---|
| 1 | BASELINE | 1000 | 99.9% completion, 0 violations | Any violation |
| 2 | STRESS | 500 | ≥ 95% accuracy at 5x volume, < 5.5GB RAM | Accuracy drops or OOM |
| 3 | TOPOLOGY | 100 | ≥ 98% classification accuracy | Wrong topology |
| 4 | CASCADE | 100 | Exact variant count, all backtests pass | Wrong count or backtest fail |
| 5 | COMPRESSION | 200 | Meta-pattern beats both parent patterns by ≥ 5% | Fails to outperform |
| 6 | SINGULARITY | 2000* | Population converges, entropy negative | Fails to converge |
| 7 | THERMODYNAMIC | 1000 | \|Δentropy\| < 0.01 every single cycle | Any cycle violates |
| 8 | FEEDBACK_LOOP | 500 | Correction rate decreases ≥ 50% | Learning not detected |

*Early termination on convergence (was 10,000 cycles — reduced via convergence detection)

---

## FEEDBACK_LOOP — NON-NEGOTIABLE

Scenario 8 is the learning proof. It is the only scenario that can block a ship even when all other 7 pass.

```
stress_vectors: [inject_human_corrections(rate=0.05)]

success_criteria:
  correction_rate_decrease    >= 0.50   # 50% fewer corrections needed over the run
  model_improvement_detected  == True
  training_examples_produced  >= 25
  reason_codes_captured       == True
```

If FEEDBACK_LOOP fails: **learning is broken. Build does not ship.** No exceptions. No overrides.

The system must improve from corrections. If it doesn't, the governance guarantee is false.

---

## CONSTRAINT VALIDATORS (RUN EVERY CYCLE — ALL 8 SCENARIOS)

| Validator | Trigger Condition | Action |
|---|---|---|
| `ConservationValidator` | \|entropy_in − (entropy_out + work)\| ≥ 0.01 | **HALT immediately** |
| `BoundaryValidator` | Open pattern does not meet V_esc | Emit violation |
| `PopulationValidator` | Pattern count exceeds max_sustainable | Emit violation |
| `ReceiptValidator` | Any operation without a receipt | **Emit violation** (LAW_1) |
| `LearningValidator` | Correction rate not decreasing in FEEDBACK_LOOP | Emit violation |

ConservationValidator triggering HALT is non-negotiable — entropy non-conservation means the simulation itself is compromised.

---

## STRESS VECTORS (COMPOSABLE)

```python
multiply_volume(5.0)              # 5x receipt rate — tests throughput ceiling
vary_effectiveness(0.5, 1.0)      # random pattern effectiveness — tests robustness
inject_entropy_noise(0.2)         # ±20% entropy fluctuation — tests conservation
inject_human_corrections(0.05)    # 5% decisions corrected — tests learning
simulate_policy_drift(0.1)        # 10% policy change mid-run — tests adaptability
```

Compose freely for scenario-specific stress. New stress vectors require human approval before inclusion in mandatory runs.

---

## MC-SPECIFIC RECEIPTS

| Receipt | Emitted When | Key Fields |
|---|---|---|
| `simulation_run_receipt` | Per scenario completion | `config`, `success`, `violations_count`, `cycles_run` |
| `violation_receipt` | On any constraint breach | `constraint`, `expected`, `actual`, `cycle` |
| `convergence_receipt` | On early termination | `cycle_converged_at`, `final_entropy`, `final_state` |
| `learning_receipt` | Per correction in FEEDBACK_LOOP | `correction_id`, `training_example_produced`, `reason_code` |

---

## RUNTIME EXPECTATIONS

| Scenario | Cycles | Parallel | Estimated Time |
|---|---|---|---|
| BASELINE | 1000 | Yes | 10m |
| STRESS | 500 | Yes | 8m |
| TOPOLOGY | 100 | Yes | 2m |
| CASCADE | 100 | Yes | 3m |
| COMPRESSION | 200 | Yes | 5m |
| SINGULARITY | 2000* | No (sequential) | 20m |
| THERMODYNAMIC | 1000 | Yes | 12m |
| FEEDBACK_LOOP | 500 | Yes | 8m |

**Total with 7 parallel workers:** ~35 minutes. SINGULARITY runs separately, sequentially.

---

## CLI CONTRACT

```bash
proof simulate BASELINE              # single scenario
proof simulate --all                 # all 8 — required before T+48h
proof simulate FEEDBACK_LOOP -v      # verbose learning trace
proof simulate --replay prod.json    # replay production trace for audit
```

---

## RULES OF ENGAGEMENT FOR CLAUDE CODE

1. MUST run `proof simulate --all` before T+48h gate — partial runs fail the gate
2. FEEDBACK_LOOP failure = build does not ship — no override exists
3. ConservationValidator HALT = stop everything, diagnose entropy leak, fix before resuming
4. NEVER add stress vectors to mandatory runs without human approval
5. Append discovered stress patterns as NOTES below — never modify scenarios above
6. Use `monte-carlo-runner` subagent to execute — main context stays clean
7. All 4 MC-specific receipts must be emitted — validate with `grep -c "simulation_run_receipt" receipts.jsonl`

---

## NOTES (append-only — insights from production runs)

_No notes yet. Append dated entries below._

---

**Version:** 2.0 | **Last updated:** 2026-04-21
*Correct functions compose into unstable systems. Simulation proves dynamics before deployment.*
