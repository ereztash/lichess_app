# `docs/evidence-architecture/`

**Execution 1 — validate the evidence architecture.** The question was whether the repository can
support the claim that Decision Lab can identify a bottleneck in a player's real decisions, target
it, and later show the resulting skill applied in novel positions.

**The answer is `CONSTRUCT-UNDERIDENTIFIED`**
([`../decisions/D25-evidence-architecture.md`](../decisions/D25-evidence-architecture.md)).

No production behaviour was changed. No feature was built. No person was measured. Nothing was
recruited.

Read in this order:

| file | what it is |
| --- | --- |
| [`CURRENT_STATE.md`](CURRENT_STATE.md) | **start here.** What is VERIFIED / RESEARCH-ONLY / REFUTED / UNRESOLVED, reconstructed from `main` and the three open branches rather than from any description of them |
| [`RECONCILIATION.md`](RECONCILIATION.md) | the cross-PR audit. Three risks the branches had already corrected, four they had not, and the measurement that decides the execution |
| [`ACTION_MODEL_DECISION.md`](ACTION_MODEL_DECISION.md) | Gate A → **`ACTION-SIGNATURE-FAILED`**, and `C11`, the guard that would have caught it |
| [`C11_SCREEN.md`](C11_SCREEN.md) | **`C11` run on all seventeen classes including both anchors.** Ten of seventeen noise cells carry no information about the rule, and one of them is the floor that defines `G5` |
| [`ITEM_VALIDATION.md`](ITEM_VALIDATION.md) | Gate B → **`ITEM-PARADIGM-FAILED`**, for a response-definition reason rather than an item reason |
| [`IDENTIFIABILITY_SIMULATION.md`](IDENTIFIABILITY_SIMULATION.md) | seven synthetic learners, rate-matched, scored by a Bayes-optimal classifier. **The distinction that decides the next intervention sits at chance and stays there** |
| [`INCREMENTAL_EVIDENCE_VALUE.md`](INCREMENTAL_EVIDENCE_VALUE.md) | the complexity control. What each observation is worth, and the four removed on evidence |
| [`INFERENCE_CHAIN.md`](INFERENCE_CHAIN.md) | the eleven-stage chain, frozen, with the status of every arrow |
| [`MODEL_COMPARISON.md`](MODEL_COMPARISON.md) | M0 against M1. Complexity is not evidence, and M1 does not yet earn its stages |
| [`COGNITIVE_EVIDENCE_MATRIX.md`](COGNITIVE_EVIDENCE_MATRIX.md) | observation × construct, every cell with a rationale, a competing mechanism and a falsifier |
| [`MULTI_STRATEGY_REGISTER.md`](MULTI_STRATEGY_REGISTER.md) | what else produces each critical observation, and the distinguishability matrix |
| [`KNOWLEDGE_REPRESENTATIONS.md`](KNOWLEDGE_REPRESENTATIONS.md) | `PlayerRule` / `DecisionScheme` / `BehavioralTransferSpec` / `EvidenceState`, kept apart |
| [`HUMAN_BASELINE_ORACLE.md`](HUMAN_BASELINE_ORACLE.md) | Maia 1/2/3 — available, licensed, and **deferred**, with the reason |
| [`PROCESS_EVIDENCE.md`](PROCESS_EVIDENCE.md) | why Execution 2 is **not** unlocked by this failure |
| [`GOLD_STANDARD_PROCESS_PROTOCOL.md`](GOLD_STANDARD_PROCESS_PROTOCOL.md) | deliberately not designed, and what is frozen in advance if it ever is |
| [`PROCESS_MINING_DECISION.md`](PROCESS_MINING_DECISION.md) | `DEFER`, and the one query worth running instead |
| [`OPEN_SOURCE_MAP.md`](OPEN_SOURCE_MAP.md) | licences first. Nothing is blocked by tooling |
| [`MULTILINGUAL_EVIDENCE.md`](MULTILINGUAL_EVIDENCE.md) | five languages, and the null result that matters most |
| [`FALSIFICATION_REGISTER.md`](FALSIFICATION_REGISTER.md) | every load-bearing claim as CLAIM / OBSERVATION / COMPETING EXPLANATION / FALSIFIER / EVIDENCE LEVEL / REVERSAL CONDITION |
| [`ROADMAP.md`](ROADMAP.md) | ranked by consequential uncertainty removed per unit cost. Four items need no humans |
| [`STRONGEST_PERMITTED_CLAIM.md`](STRONGEST_PERMITTED_CLAIM.md) | what may and may not be said, with [its machine-readable form](STRONGEST_PERMITTED_CLAIM.json) |

Scripts and results: [`research/evidence-architecture/`](../../research/evidence-architecture/).

## The one sentence

`RC-06 answer-the-mate-threat` was the only one of fifteen rule classes to pass the screen, and it
passed on gate `G5`, which reads `separation = b_valid|T+ − b_valid|T−`. **Those two numbers are
produced by two different definitions of `B`** — on trigger-positive items, *"the opponent has no
mate in one"*; on trigger-negative items, *"the opponent has no check at all"*. Under one fixed
predicate, the rule as its own sentence states it, **separation is −0.048 rather than +0.768**,
because when no mate is threatened, not-allowing-mate-in-one is already true of **99.5%** of legal
moves.

## The three things worth carrying forward

1. **A guard is missing, and it is cheap.** `prescription_size` already stops a vacuous prescription
   scoring well on the *positive* cell. Nothing guarded the negative one. **`C11`** does, needs no
   engine, and would have caught both `RC-06` and `RC-12` before a single search was spent.
2. **The failure is specific, not general.** It is a property of **outcome-shaped** rules —
   *"if T, act so that T is gone"* — where the noise cell is degenerate by construction. A
   method-shaped rule, where `B` is a property of the move, is one screen away and has not been
   tried. **"The final move is insufficient" is a forbidden sentence.**
3. **The register's ranking does not survive its own instrument.** `C11`, run on all seventeen
   classes, grades **8 `VACANT`, 2 `SATURATED`, 7 `MEASURABLE`** — and four of the top five
   published separations are in the first two groups, including the incumbent floor. What decides a
   usable noise cell is not prescription shape but whether, with the trigger absent, **the
   prescribed act still exists and can be wrong**.
4. **Richer measurement was tested against this failure and is worth nothing.** Time, a timed
   condition, a delayed condition, a generic cue and the candidate set all leave the deciding
   distinction at exactly chance. **Process evidence is not the answer to a degenerate noise cell.**

## What this execution did not do

Did not build a Learning UX, a learner score, `mastery = X%`, a POMDP, a bandit or any
reinforcement learning. Did not recruit. Did not modify production behaviour. Did not repair a failed
hypothesis before preserving its failure — `docs/measurement/` keeps its four rounds intact and this
is a fifth.
