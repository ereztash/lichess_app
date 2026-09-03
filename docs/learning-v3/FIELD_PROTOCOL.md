# Field protocol

```text
NOT ADMISSIBLE
```

**Blocker:** the same one, one step earlier. `INTERVENTION_EXPERIMENT.md` is `NOT ADMISSIBLE` because
`BARRIER_DECISION.md` returned `INSUFFICIENT_OPPORTUNITIES`, and a recruitable protocol for a study
that cannot estimate its own endpoint would be a document that reads as though people should be
asked for their time.

**Phase 11's own condition:** *"If and only if pre-human gates survive, produce a recruitable
protocol."* The gates did survive. The step between them and recruitment did not.

---

## What this cycle can state about recruitment, and what it cannot

**Can:** the eligibility arithmetic, because it is a property of the corpus rather than of a
participant.

| | `RC-05` | `RC-02` | `RC-06` |
| --- | --- | --- | --- |
| trigger-positive base rate, per sampled position | **0.206%** | 12.2% | 1.16% |
| unaided human rule-consistent rate on `T+` | **.575** | .769 | .721 |
| headroom | 42.5% | 23.1% | 27.9% |
| share of declines costing ≥ 0.10 expected score | **5.4%** | not measured | not measured |
| C11 | MEASURABLE | MEASURABLE | SATURATED |
| p90 permitted-action regret | **0.0000** | 0.5127 | 1.0000 |

The last row of that table is why `RC-02` is not simply the answer: its permitted set is not safe.
Nine in ten of `RC-05`'s permitted moves cost nothing; `RC-02`'s ninetieth percentile costs half a
game.

**Cannot:** inclusion criteria, sample size, phase lengths, or stop thresholds. Every one would be a
number chosen for a study that has no measurable endpoint, and `THEORY_EVIDENCE.md` V10 fixes the
design shape at *5+ data points in each of 6+ phases* for a multiple-baseline — a requirement that
cannot be met at one qualifying opportunity per several thousand games.

---

## The parts that are settled whenever a protocol does become admissible

These do not depend on which class survives, so they are recorded now rather than re-derived later.

**Blinding.** The target hypothesis is not exposed during baseline or natural retest.
`shared/interaction-mode.ts` already carries `producingEvidence` per mode with prior evidence and
engine output both false in `DECIDE`; what is missing is one row, `packetVisible`, false wherever
`producingEvidence` is true.

**Reactivity is measured, not assumed away.** Asking *"is there a safe promotion here?"* before the
move is itself a cue. `learning-v2/EXPERIMENT.md`'s DETECT-FIRST / MOVE-FIRST counterbalance is the
estimator, and the difference between orders is the reactivity estimate rather than a nuisance.

**Negative opportunities are mandatory.** Not a robustness check. Without them, a Bayes-optimal
classifier handed the true generative model separates learning from response bias at **0.500** when
the noise cell is saturated — re-derived in this cycle and matching the published figure on all 122
values.

**Result classes**, unchanged from the mission:

```text
TRANSFER_SUPPORTED   TRANSFER_NOT_SUPPORTED   CRITERION_SHIFT
RECOGNITION_BLOCKED  ACTION_SELECTION_BLOCKED
MEASUREMENT_INVALID  INSUFFICIENT_OPPORTUNITIES
```

**This cycle's own result is the last of those**, reached without recruiting anybody — which is what
the pre-human gates are for.
