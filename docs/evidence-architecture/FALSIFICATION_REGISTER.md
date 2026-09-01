# Falsification register — Execution 1

Every load-bearing claim this execution makes, in the required form. **A claim not in this form is
not a claim this execution makes.**

Entries are numbered `E1-nn`. Where an entry refutes or amends an earlier one, the earlier one is
named. **Nothing earlier is edited or deleted**; the register records how beliefs changed.

---

## E1-01 — RC-06's separation is not a difference between two measurements of the same behaviour

**CLAIM.** `separation = b_valid|T+ − b_valid|T−` on `RC-06` is computed under two different
definitions of `B`, and under any single fixed definition the quantity is not +0.768.

**OBSERVATION.** `_threat_satisfies` returns *"the opponent has no mate in one"* on T+ and *"the
opponent has no check at all"* on T−. Measured, corpus scan reproducing the published manifest
exactly: T− prescription size **.104** under the shipped predicate against **.995** under the rule as
its own `prescription` string states it; **93.2%** of T− items have every legal move satisfying the
stated rule. Stockfish 17.1, 200,000 nodes, 250 items per cell, 0 failures: `b_valid|T−` = **1.000**
(250/250) under the fixed predicate; separation **−0.048** against +0.760 under the shipped one.

**COMPETING EXPLANATION.** (a) The harness is wrong. (b) The sample is unrepresentative. (c) The
symmetric predicate is not the right reading of the rule.

**Answered.** (a) The `branching` column reproduces the published .968/.200/+0.768 within its own
intervals on an independent draw — that is the positive control. (b) The engine-free bound needs no
sampling argument: if every legal move satisfies `B`, any policy satisfies it, and that holds on
93.2% of items. (c) The symmetric predicate is the class's own `prescription` field, not a
reinterpretation.

**FALSIFIER.** A fixed response predicate, defensible from the rule's own statement, under which
`b_valid|T−` is materially below 1 while `b_valid|T+` stays near .968. **`rule_classes.py` argues no
such predicate exists at this rule shape, and #49's H23 gives the structural reason.**

**EVIDENCE LEVEL.** `E1` — domain semantics, measured on the shipped engine and the published corpus.

**REVERSAL CONDITION.** Exhibit the predicate the falsifier describes; or show the corpus scan does
not reproduce the published manifest.

## E1-02 — Two of seventeen response predicates branch, and the shipped detector finds one

**CLAIM.** `RC-12 stop-the-promotion` branches on the trigger exactly as `RC-06` does, and
`criterion_channel.py`'s detector cannot see it.

**OBSERVATION.** The detector is `"_trigger(" in inspect.getsource(rule.satisfies)`.
`_promotion_stop_satisfies` inlines `_their_safe_promotions(board) > 0` instead of calling the
trigger, and its own docstring says *"Branches on the trigger, for the reason `_threat_satisfies`
branches."* Priced: T− prescription size **.184** shipped against **.9995** as stated, **99.6%** of
items with every legal move satisfying the stated rule.

**COMPETING EXPLANATION.** The inlined condition is not the trigger. **Refuted by inspection:**
`_promotion_stop_trigger`'s positive branch is the identical expression.

**FALSIFIER.** A reading of `_promotion_stop_satisfies` on which its two branches ask the same
question.

**EVIDENCE LEVEL.** `E1`.

**REVERSAL CONDITION.** As above. **Amends #49's H22**, which states `_threat_satisfies` is the only
brancher of the twelve; `RC-12` was among the twelve.

## E1-03 — `C11` would have caught both, before any search

**CLAIM.** A guard on the *negative* cell, symmetric to the `prescription_size` guard that already
protects the positive cell, catches this defect class with no engine.

**OBSERVATION.** `branching_audit.py` computes it for two classes in under two minutes from data
already on disk.

**COMPETING EXPLANATION.** A near-1 noise cell might be a fact about the rule rather than about the
predicate. **That is not a competing explanation — it is the same finding**: either way the class has
no noise cell and its published separation is not a specificity statistic.

**FALSIFIER.** A rule class with a stated-rule T− prescription size near 1 whose separation is
nonetheless a valid specificity statistic.

**EVIDENCE LEVEL.** `E1`.

**REVERSAL CONDITION.** Exhibit that class.

## E1-04 — `_lone_king_defends` is not the rule of the square's precondition

**CLAIM.** #51's scope predicate for `RC-21` tests the opponent's piece list, not the promotion race.

**OBSERVATION.** Full trigger-positive cell, 3,286 items: `_lone_king_defends` true on **10.2%**; a
sufficient functional condition true on **5.5%**; **the functional condition holds on only 53.6% of
the positions the piece list certifies.**

**COMPETING EXPLANATION.** The functional predicate is too strict, so 53.6% understates agreement.
**Conceded, and it is the direction the predicate was built to err in** — it refuses to certify what
it cannot settle. That makes 53.6% a **lower bound on agreement**, i.e. an upper bound on how good
the piece list is. It cannot be rescued by the objection.

**FALSIFIER.** A deterministic predicate that encodes *"no opposing resource other than the king can
affect whether the pawn promotes before being stopped"* and agrees with `_lone_king_defends`.

**EVIDENCE LEVEL.** `E1`.

**REVERSAL CONDITION.** Exhibit that predicate. Until then `RC-21` is `SEMANTICALLY-UNDERDEFINED`.

## E1-05 — `RC-13`'s scope predicate is not its claim

**CLAIM.** Comparing *any* checking knight promotion against *any* checking queen promotion is not
the docstring's claim, which is about one promotion square.

**OBSERVATION.** 67 items: shipped predicate true on **70.1%**, matched (same `from`, same `to`) on
**77.6%**; matched ⊇ unmatched by construction; **5 of 67 (7.5%)** are in scope under the claim and
out of scope under the predicate.

**COMPETING EXPLANATION.** The difference is immaterial. **Partly conceded:** `b_valid` is .000 on
both cells and both splits, so `RC-13`'s verdict does not move. The in-scope denominator in #51's
table does.

**FALSIFIER.** A reading of the docstring on which an unmatched comparison is the claim.

**EVIDENCE LEVEL.** `E1`.

**REVERSAL CONDITION.** As above. **Neither predicate tests "does something a queen cannot"** — a
knight promotion can fork without checking. Both test one instance of the claim.

## E1-06 — `A5` is void on the expected-score scale

**CLAIM.** A gate defined as "out-separates the refuted incumbent" is not measuring that when the
ceiling anchor fails it.

**OBSERVATION.** `RC-00 mate-in-one` scores **+0.344** chance-corrected advantage; `RC-01
loose-piece`, the refuted floor, scores **+0.564**. Mean `V*` on `RC-00`'s positive cell is exactly
**1.000**. In centipawns the same cell reads **+99,255**, the mate constant.

**COMPETING EXPLANATION.** The chance control inverted it. **Refuted in #51:** on raw advantage the
order is `RC-01` +0.453, `RC-06` +0.446, `RC-00` +0.400 — inverted either way.

**FALSIFIER.** A utility representation on which the ceiling anchor out-separates the floor.

**EVIDENCE LEVEL.** `E1`. **Found by #51; amended here** — #51 excludes the ratio and keeps the gate.

**REVERSAL CONDITION.** Such a representation. **What survives:** a rule class is measurable on a
utility scale only where its trigger fires in positions that are not already decided.

## E1-07 — `B`-membership is not rule-consistent action on `RC-06`

**CLAIM.** The permitted set is too broad and too unsafe for membership to be a behavioural outcome.

**OBSERVATION.** Median **29.7%** of legal moves permitted; **28.6%** of permitted moves within
100 cp; **84.7%** of positive items contain a permitted move losing ≥100 cp. Against the refuted
incumbent at .037 / .795 / .236.

**COMPETING EXPLANATION.** #51: *"This does not block Study D, whose outcome is scored on a specific
prescribed act rather than on set membership."* **Refuted by reading Study D**: #49's `EXPERIMENT.md`
scores *"trigger-positive rule-consistent action"* and carries *"share of legal moves satisfying B"*
as its chance rate.

**FALSIFIER.** A version of Study D scoring a named act.

**EVIDENCE LEVEL.** `E1`–`E2`.

**REVERSAL CONDITION.** Such a version — which would be a different study on a different rule shape.

## E1-08 — Correct conditional discrimination and response bias are observationally equivalent

**CLAIM.** Under a saturated noise cell, `L1` and `L3` produce identical distributions over every
observation the protocol proposes, and take different interventions.

**OBSERVATION.** Bayes-optimal separation **.500** at every rung: move, both cells, +time, +timed
condition, +delayed condition, +generic cue, +candidate set. β-sensitivity .515/.500/.500/.500/.500
over β ∈ [1, 3]. Under a non-saturated noise cell the same pair reaches **.983 from move alone on
both cells**.

**COMPETING EXPLANATION.** (a) The simulation's parameters produce the result. (b) A better estimator
would separate them.

**Answered.** (a) Every pair is rate-matched to the measured .716, and the item chance rates are
measured rather than invented; the β sweep covers the plausible range. (b) The classifier **is** the
Bayes-optimal test given the true generative model — no estimator beats it.

**FALSIFIER.** An observation, collectible in the product, whose distribution differs between a
learner with `p_neg` = .05 and one with `p_neg` = .55 when P(B | T−) = 1 for both. **Note what this
requires: an observation that is not the response.**

**EVIDENCE LEVEL.** `E0` for the learner states (synthetic); `E1` for the chance rates that drive it.

**REVERSAL CONDITION.** Exhibit that observation, or a rule class whose noise cell does not saturate.

## E1-09 — Process evidence does not repair a saturated noise cell

**CLAIM.** Think-aloud, mouse traces, gaze and autoconfrontation are worth zero on the distinction
that matters while the response predicate saturates.

**OBSERVATION.** Every process observation tested — time, timed condition, delayed condition, generic
cue, candidate set — leaves `C/D` at exactly .500 under the fixed predicate.

**COMPETING EXPLANATION.** The untested observations (think-aloud, gaze) are qualitatively different
and might carry information the tested ones do not. **Partly conceded, and it is the honest limit of
this entry:** they were not simulated. **But the mechanism is not observation-specific** — the two
states differ in a *disposition to act when the trigger is absent*, and when acting-when-absent is
indistinguishable from not-acting-when-absent in the response, a process record of how the move was
reached does not recover which disposition produced it. A think-aloud in which the player *says* they
applied the rule would separate them, and is then a **verbal report**, not a process trace.

**FALSIFIER.** A simulated or real process observation that moves `C/D` off .500 under a saturated
noise cell.

**EVIDENCE LEVEL.** `E0`–`E1`.

**REVERSAL CONDITION.** Exhibit it. **This entry is what keeps Execution 2 shut**, and it is the
entry most worth attacking.

## E1-10 — M1 is not currently supported over M0

**CLAIM.** The six-stage decomposition earns nothing measurable over the two-stage one, today.

**OBSERVATION.** Five of eight candidate discriminating observations do not distinguish the models.
Of the three that do, two have no admissible instrument on any current rule class, and the third —
`chose-past-it` — is collected, one-sided, and has **never had its base rate measured**, which
`shared/reveal.ts` states in its own words.

**COMPETING EXPLANATION.** M1 is true and the instruments are missing. **Conceded — that is exactly
the claim's scope.** M1 is *not supported*, which is not *refuted*.

**FALSIFIER.** A measured `chose-past-it` base rate materially above a few percent; or a
generic-cue arm that changes behaviour.

**EVIDENCE LEVEL.** `E0`.

**REVERSAL CONDITION.** Either of the above. **Both are cheap and neither has been run.**

---

## What this register does not contain

**No entry claims a rule class cannot exist.** Seventeen were tried and none survived; that is a
statement about seventeen.

**No entry claims final move is insufficient in general.** E1-01 and E1-08 are about
**outcome-shaped rules**, where the noise cell is degenerate by construction. The method-shaped
alternative is named, is cheap, and has not been tried.

**No entry claims anything about a person.** No participant was measured by this execution.
