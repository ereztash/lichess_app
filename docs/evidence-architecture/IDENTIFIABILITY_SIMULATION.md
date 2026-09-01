# Identifiability simulation

# Result: `CONSTRUCT-UNDERIDENTIFIED` under the valid response predicate

**The gate is not classification accuracy above some number.** It is whether the distinctions
required for the intended downstream decision are separable enough to change what the system would
do next. Four such distinctions were declared in advance. **Under the only response definition that
is valid, one of them is at chance and stays there under every observation the protocol could add.**

Arithmetic: [`identifiability_simulation.py`](../../research/evidence-architecture/identifiability_simulation.py).

---

## How this is built, and the two things that make it an honest test

**The classifier is a Bayes-optimal likelihood-ratio test handed the true generative model of both
hypotheses.** No real analysis can beat it. Every number below is therefore an **upper bound**: a
pair the oracle cannot separate is one no estimator, no sample size within reason and no better model
can separate either. A pair the oracle *can* separate is not thereby solved — a real analyst still
has to estimate what the oracle was given.

**Every pair is rate-matched on the primary observation before it is tested.** Two learner types that
produce *different amounts* of rule-consistent action are separable by counting, which is not the
question. Each learner's `p_act` is solved so that its expected P(B | T+, untimed) equals **.716** —
the pooled trigger-positive rate the repository measured on historical players. **Pairs therefore
differ in mechanism at equal primary behaviour.**

> A first version of this file did not rate-match and reported ≥0.93 separation nearly everywhere.
> That was a fact about the parameters chosen, not about the protocol. It is recorded rather than
> deleted because the failure is instructive: **a simulation that does not equalise the thing the
> mechanisms are supposed to be confounded on will always say the architecture works.**

**Item chance rates are measured, not invented.** 2,000 items per cell from the reproduced corpus
scan, under both response predicates: T+ .302 either way; T− **.104** branching, **.995** as the rule
is written.

**Time carries a between-participant offset** of SD 8 s, added to every one of a participant's
decisions and widened into the oracle's likelihood — the correct representation of *"you do not know
this person's baseline speed."* Without it a 12-second mechanism difference was detected at 1.000,
which is a statement about people being identical.

**One free parameter, calibrated not chosen.** P(B | not applying) = min(1, β × per-item chance
rate). At β = 2, the model reproduces the observed trigger-negative rate under the shipped predicate
(2 × .104 = .21 against a measured .192–.200).

## The required set of distinctions, declared before the simulation

**No arbitrary global threshold.** What is declared instead is the set of distinctions the
architecture must eventually make, and for each: what would separate it, what would count against
separability, and what uncertainty must be reported alongside it.

| pair | what theoretically separates them | what would count **against** separability | uncertainty to report |
| --- | --- | --- | --- |
| **A/B** recognises T + weak action selection **vs** no recognition, baseline produces B | the candidate set: was the answering move ever on the board? plus explicit detection in a laboratory arm | placement not tracking consideration; a baseline policy whose B-rate matches the recognising one at every item difficulty | the interval on the separation, **and** that the candidate array is one-sided — absence is uninformative |
| **C/D** correct conditional discrimination **vs** response bias / perform-B-everywhere | the trigger-negative cell, scored by the **same** response predicate | a T− chance rate near 1; a T− cell scoring a different act; T− composition differing by strength band | the T− chance rate itself, per item, **never a pooled constant** |
| **E/F** untimed competence **vs** time-pressure execution failure | the same items presented under both a timed and an untimed condition | time differences driven by legal-move count or interface rather than pressure; a protocol change between conditions | between-participant baseline speed, which is larger than most mechanism effects |
| **G/H** immediate availability **vs** delayed retrieval failure | the same items at delay 0 and delay > 0, uncued | improvement over the interval from ordinary play; item re-exposure | what the player did between sessions, which is unobserved |
| **cue** weak state a cue repairs **vs** one it does not | a **generic**, contentless cue arm | the cue signalling that the item is unusual rather than supplying orientation | the cue's effect on items where nothing is wrong |
| **L7** the construct applies **vs** an alternative strategy producing the same move | latency, and only latency | a mechanism difference smaller than between-person speed variance | that this is a ceiling, not an estimate |

**The gate, restated:** a construct is `UNDERIDENTIFIED` if material latent states remain
observationally equivalent under the proposed protocol. It is **not** *classification accuracy > X*.
The question is whether the evidence would change what the system does next.

## The seven learner types, and the intervention each would take

| | latent state | next intervention if this is the diagnosis |
| --- | --- | --- |
| **L1** | recognises T, weak action selection | action selection / if–then compilation |
| **L2** | does not recognise T; the baseline policy often produces B | trigger recognition / contrastive examples |
| **L3** | recognises T but overgeneralises into T− | boundary items, hard negatives |
| **L4** | correct untimed, fails under time pressure | representative timed practice |
| **L5** | weak state a **generic** cue repairs | orientation, worked examples with fading |
| **L6** | competent immediately, poor delayed retrieval | spacing and retrieval practice |
| **L7** | reaches the same move by calculating, not recognising | **none** — the construct does not apply |

## The result

Bayes-optimal two-hypothesis accuracy, 20 items per condition, 4,000 trials, chance = 0.500.

### Under the shipped **branching** predicate — the regime that is not valid

| observation set | A/B | **C/D** | E/F | G/H | cue | L7 |
| --- | --- | --- | --- | --- | --- | --- |
| move only | .863 | **.500** | .500 | .500 | .500 | .500 |
| move, both cells | .859 | **.983** | .500 | .500 | .500 | .500 |
| + time | .878 | .980 | .500 | .500 | .500 | .786 |
| + timed condition | .947 | .976 | **.797** | .500 | .500 | .780 |
| + delayed condition | .979 | .978 | .804 | **.795** | .500 | .783 |
| + generic cue | .990 | .983 | .807 | .793 | **.940** | .781 |
| + candidate set | **1.000** | .977 | .793 | .802 | .939 | .786 |

### Under the **fixed** predicate — the rule as its own sentence states it

| observation set | A/B | **C/D** | E/F | G/H | cue | L7 |
| --- | --- | --- | --- | --- | --- | --- |
| move only | .863 | **.500** | .500 | .500 | .500 | .500 |
| move, both cells | .859 | **.500** | .500 | .500 | .500 | .500 |
| + time | .878 | **.500** | .500 | .500 | .500 | .786 |
| + timed condition | .947 | **.500** | .797 | .500 | .500 | .780 |
| + delayed condition | .979 | **.500** | .804 | .795 | .500 | .783 |
| + generic cue | .990 | **.500** | .807 | .793 | .940 | .781 |
| + candidate set | **1.000** | **.500** | .793 | .802 | .939 | .786 |

**Pairs:** A/B = recognises + weak action **vs** no recognition + baseline produces B ·
C/D = correct conditional discrimination **vs** response bias · E/F = untimed competence **vs**
time-pressure failure · G/H = immediate availability **vs** delayed retrieval failure ·
cue = weak recognition a cue does not repair **vs** one it does · L7 = the construct applies **vs**
an alternative strategy producing the same move.

### Doubling the items — the robustness check that matters most

40 items per condition instead of 20. **Everything improves except the one column that decides the
gate.**

| observation set | A/B | **C/D** branching | **C/D fixed** | E/F | G/H | cue | L7 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| move only | .947 | .500 | **.500** | .500 | .500 | .500 | .500 |
| move, both cells | .950 | .998 | **.500** | .500 | .500 | .500 | .500 |
| + time | .950 | .999 | **.500** | .500 | .500 | .500 | .783 |
| + timed condition | .991 | .999 | **.500** | .876 | .500 | .500 | .779 |
| + delayed condition | .997 | .998 | **.500** | .885 | .879 | .500 | .790 |
| + generic cue | 1.000 | .998 | **.500** | .891 | .890 | .987 | .801 |
| + candidate set | 1.000 | .998 | **.500** | .886 | .881 | .986 | .778 |

**`C/D` under the fixed predicate is .500 at every rung at double the sample.** Underidentification
is not a power problem, and no study size fixes it. Two further readings:

- **`L7` does not improve with more items** (~.78–.80 at both sizes) while everything else does.
  Its ceiling is set by **between-participant speed variance**, which more items per participant do
  not reduce. More *participants* would not help either — the offset is a property of each person.
- **Everything that has the right condition present improves substantially** — `E/F` .797 → .886,
  `G/H` .795 → .881, `cue` .940 → .986 — which is what a well-specified distinction looks like when
  you give it more data, and is the contrast that makes `C/D`'s flat line meaningful.

---

## What the two tables say

**1. `C/D` is the whole construct, and under the valid predicate it is at chance everywhere.**

Distinguishing *"has learned when to apply the rule"* from *"has learned to do this everywhere"* is
the decision the programme exists to make — it is the difference between "train the trigger" and
"train the boundary", and between an intervention that helped and one that increased false
application. **It requires a trigger-negative cell that carries information.** When the noise cell
saturates, that cell carries none, and **no downstream observation recovers it**: not time, not a
timed condition, not a delayed condition, not a generic cue, not the candidate set. The column is
.500 at every rung.

**This is Zhang, DeCarlo & Ying's (2013) equivalence class, exhibited.** Two attribute profiles with
identical likelihoods, and the partition is a property of the item–response mapping, not of the
estimator.

β-sensitivity confirms it is not a knife-edge — C/D under the fixed predicate, across β from 1.0 to
3.0: **.515, .500, .500, .500, .500**. Under the branching predicate over the same range: .990, .988,
.978, .971, .961.

**2. Move alone separates almost nothing.**

`move only` is at chance on five of six pairs. The one exception, A/B at .863, is the *easiest*
distinction in the set and still leaves roughly one participant in seven misdiagnosed — for a
decision that sends the programme to a different intervention.

**3. Each remaining distinction is unlocked by exactly one specific thing, and by nothing else.**

- `E/F` moves off chance **only** when a **timed condition** is added — not when time is *recorded*.
  Measuring seconds does not tell you about time pressure; imposing it does.
- `G/H` moves off chance **only** when a **delayed condition** is added.
- `cue` moves off chance **only** when a **generic-cue arm** exists.

**No amount of richer measurement substitutes for the missing condition.** These are design
questions, not instrumentation questions — which is the opposite of what a Learning-UX roadmap
would assume.

**4. The candidate set does one thing, decisively.**

The last two rows are the clean comparison: identical conditions, identical item count, one extra
observation per item. **A/B goes .990 → 1.000; every other column moves within noise.** So
`candidate_moves_considered` is not a general-purpose enrichment — it is **specifically** the
observation that separates *"recognised it and could not act"* from *"did not recognise it"*, which
is exactly what its own code comment claims and what the Shogi verbal-protocol literature predicts.

**5. `L7` caps at ≈.79 and that ceiling is structural.**

A player who reaches the same move by calculating rather than recognising is separable **only** by
latency, and only under an assumed 12-second mechanism difference. Between-participant speed
variance is what holds it at .79 — remove it and the number is 1.000, which is why it was added.
**The classifier is wrong about one time in five** on a balanced pair — and the errors run in both
directions, so it both misses players the construct does not apply to and flags players it does.

---

## The verdict, stated as the gate requires

> **A construct is `UNDERIDENTIFIED` if material latent states remain observationally equivalent
> under the proposed measurement protocol.**

`L1` (correct conditional discrimination) and `L3` (response bias) take **different interventions**,
produce **identical** distributions over every observation the protocol proposes, and are therefore
**observationally equivalent** under the only valid response predicate.

# `CONSTRUCT-UNDERIDENTIFIED`

**Three things this does *not* say.**

- **Not that the construct is unmeasurable in principle.** Under a non-saturated noise cell, C/D
  reaches .98 from **move alone on both cells** — the cheapest possible evidence. The problem is
  entirely in the response predicate, and it is fixable by choosing a different rule *shape*.
- **Not that process evidence is the answer.** Every process observation tested here — time,
  candidate set, cue response — leaves C/D at exactly chance. **Adding richer measurement to a
  saturated noise cell does nothing at all.** Execution 2 is not unlocked by this result and would
  be the wrong next step.
- **Not that the other distinctions are fine.** E/F and G/H sit at ≈.80 with the right conditions
  present, and L7 at ≈.79. Those are real ceilings and they are what a well-designed study would
  achieve, not what a badly designed one would.

## The one design change the simulation prices

**A method-shaped rule class, where `B` is a property of the move rather than of a threat's
survival.** `RC-11 move-the-threatened-minor` has a trigger-negative prescription size of **.175**,
not .995 — squarely in the regime where the left-hand table applies and **C/D reaches .98 from move
alone on both cells**.

That is a *prediction*, not a finding, and it is falsifiable: re-screen `RC-11` under `C11` and
check whether its noise cell survives contact with the rule as its own sentence states it.
