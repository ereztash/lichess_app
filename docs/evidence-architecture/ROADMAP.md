# Roadmap

**Ranked by consequential uncertainty removed per unit cost.** Not a backlog: every item states what
question it removes, what it blocks, what would falsify it, and when to stop.

**The ordering is not by importance.** Items 1–4 need no humans, no new corpus and no product
change, and three of them can be run in an afternoon. Everything below the line is blocked on one of
them.

---

## R1 — Re-screen the anchors and every class under `C11`

| | |
| --- | --- |
| **DEPENDENCY** | none. Data on disk, `branching_audit.py` exists |
| **QUESTION REMOVED** | how many of the seventeen rule classes have a noise cell that survives contact with the rule as its own sentence states it? |
| **WHY IT MATTERS** | `separation` is the quantity `G5` reads, and it is a specificity statistic **only** for classes that pass this. **Two of seventeen are already known to fail.** The ceiling and floor anchors have never been checked, and every published comparison is against them |
| **COST** | hours. No engine for the prescription sizes; ~500 searches per class if `b_valid` is re-derived |
| **WITHOUT HUMANS?** | **yes** |
| **WHAT IT BLOCKS** | every claim in `RULE_CLASS_SEARCH.md`, both anchors, and any future screen |
| **FALSIFIER** | a class whose stated-rule T− prescription size is near 1 and whose separation is nonetheless a valid specificity statistic |
| **STOP CONDITION** | all seventeen graded. **Do not continue into candidate 18** |

## R2 — Measure the `chose-past-it` base rate

| | |
| --- | --- |
| **DEPENDENCY** | none. A query over the existing record |
| **QUESTION REMOVED** | how often is the engine's move already on the player's board when they play something else? |
| **WHY IT MATTERS** | it is **the only production observation supporting M1 over M0**, the only one separating "generated it and rejected it" from "never generated it", and `shared/reveal.ts` says its rate **has never been measured**. If it fires on 3 decisions in 100, M1's only support is a rare event |
| **COST** | one query. No new field, no arm, no participant |
| **WITHOUT HUMANS?** | **yes** — it reads decisions already made |
| **WHAT IT BLOCKS** | `MODEL_COMPARISON`'s verdict; every process-mining question; the value of `candidate_moves_considered` |
| **FALSIFIER** | a rate low enough that the branch is not a usable observation |
| **STOP CONDITION** | the rate is reported with its denominator. **Do not build a score on the array** |

## R3 — Screen `RC-11`, method-shaped, under `C11`

| | |
| --- | --- |
| **DEPENDENCY** | R1 |
| **QUESTION REMOVED** | is the degenerate noise cell a property of **outcome-shaped** rules specifically, or of the paradigm? |
| **WHY IT MATTERS** | this is the **only remaining route to a valid final-move contrast**. `RC-11` is method-shaped (`B` is a property of the move), does not branch, and has a T− prescription size of **.175**. If it survives, `C/D` reaches **.98 from move alone on both cells**. If it does not, the paradigm has a domain limit rather than a rule-choice problem |
| **COST** | one screen, ~1,000 searches. Corpus and code exist |
| **WITHOUT HUMANS?** | **yes** |
| **WHAT IT BLOCKS** | Gate B, Study D, every learning execution, and whether Execution 2 is even the right shape |
| **FALSIFIER** | `RC-11`'s stated-rule T− prescription size also near 1 |
| **STOP CONDITION** | **if it fails, stop and narrow the product claim.** Do not search for candidate 18; two selection strategies and eight families have already failed |

## R4 — Re-score `RC-21` on the functional scope, and grade `RC-13` on the matched predicate

| | |
| --- | --- |
| **DEPENDENCY** | none |
| **QUESTION REMOVED** | what `b_valid` is where the rule of the square actually applies (180 items, not the 336 the piece list certifies) |
| **WHY IT MATTERS** | small on its own. **The reason to do it is the method**: it closes the loop on the failure mode this audit found three times — a proxy checked instead of the property |
| **COST** | 180 + 67 items. Under an hour |
| **WITHOUT HUMANS?** | **yes** |
| **WHAT IT BLOCKS** | nothing live. It corrects the register |
| **FALSIFIER** | the functional subset scoring the same as the piece-list subset, which would mean the piece list was adequate after all |
| **STOP CONDITION** | recorded. **Do not build a `RC-21` variant** |

---

**Everything below this line is blocked on R3. Do not start any of it while R3 is open.**

---

## R5 — Gate B on a surviving class

**DEPENDENCY** R3 passes · **QUESTION REMOVED** can a trigger flip while the rest of the decision
problem holds? · **WHY IT MATTERS** without it a player effect is an item effect; max |SMD| is 0.573
on `RC-06` and `itemDifficultyConfound` is a committed **failing** control · **COST** item
construction plus adjudication; the per-move regret landscape from #51 is the instrument, already
built · **WITHOUT HUMANS?** yes · **BLOCKS** Study D · **FALSIFIER** minimal pairs that cannot be
built without changing many decision-relevant properties · **STOP** if pairs cannot be built, the
final-move paradigm has reached a domain limit — **that is the answer, not a setback**.

## R6 — Maia-2 as an item-difficulty covariate

**DEPENDENCY** R5 · **QUESTION REMOVED** are matched items matched on *human* difficulty, not only on
board features? · **WHY IT MATTERS** the current chance rate is a uniform-random null · **COST** a
torch environment; MIT licence, no relicensing consequence · **WITHOUT HUMANS?** yes · **BLOCKS**
Study D's baselines · **FALSIFIER** Maia difficulty adding nothing beyond the board covariates ·
**STOP** it is a covariate. **Never a ground truth and never a model of cognition**.

## R7 — Study D, redesigned

**DEPENDENCY** R3, R5 · **QUESTION REMOVED** does detection predict rule-consistent action, and how
much does asking change it? · **WHY IT MATTERS** first human construct validation · **COST** 8–30
participants, one sitting · **WITHOUT HUMANS?** **no — this is the first item that needs people** ·
**BLOCKS** every learning execution · **FALSIFIER** item effects dominating person effects ·
**STOP** freeze the bank, the transformations, the model and the interpretations before participant
one. **The generic-cue arm is now part of the design, not an extra** — it is the only thing that
moves the `cue` distinction off chance, and it is the M0/M1 discriminator.

## R8 — Content safety for player-authored rules

**DEPENDENCY** R7 · **QUESTION REMOVED** is a `PlayerRule` safe to strengthen? · **WHY IT MATTERS**
`formLearningRule` schedules retrieval **without consulting `mayPrescribe`**, and **fourteen of
fifteen researcher-designed classes failed the screen** — a player-authored sentence has no reason to
do better · **COST** a validation pass per rule · **WITHOUT HUMANS?** partly · **BLOCKS** any
teaching step · **FALSIFIER** player-authored rules passing the same gates researcher-designed ones
failed · **STOP** `UNSAFE-TO-REHEARSE` means do not rehearse. Not "rehearse with a caveat".

---

## What is deliberately **not** on this roadmap

- **Candidate 18.** Fifteen candidates, eight families, three selection strategies. R1 and R3 ask
  whether the *instrument* is sound; a sixteenth candidate asks the same broken question again.
- **Optimising 1/3/7/21.** A scheduler is content-blind. FSRS would improve the timing of the
  rehearsal of an E0 sentence.
- **Think-aloud, mouse traces, gaze, autoconfrontation.** Removed on evidence: worth **zero** on the
  distinction that matters while the noise cell is saturated
  ([`INCREMENTAL_EVIDENCE_VALUE.md`](INCREMENTAL_EVIDENCE_VALUE.md)).
- **Any learner state, POMDP, bandit or `mastery = X%`.** No observation model exists.
- **Learning UX.** There is no validated learning object for it to present.
