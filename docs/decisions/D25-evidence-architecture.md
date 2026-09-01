# D25 — is the evidence architecture capable of supporting the intended claim?

# `CONSTRUCT-UNDERIDENTIFIED`

**Not `DOMAIN-MODEL-FAILED`.** The domain model is fine: chess really does contain positions where a
named condition holds and a named action is correct, and the repository measures that accurately.
**Not `MOVE-ONLY-SUFFICIENT`.** The final move does not carry the required distinction.
**Not `PROCESS-EVIDENCE-REQUIRED`.** Process evidence was tested against the failure and is worth
exactly nothing on it.

The construct is underidentified because the **response predicate**, not the observation channel,
destroys the distinction the programme exists to make.

**Evidence level:** `E1` reached, `E2` attempted and not reached. **Humans measured: 0. Production
behaviour changed: none.**

**Depends on:** [`docs/evidence-architecture/`](../evidence-architecture/), all of
[`docs/measurement/`](../measurement/), and the three open branches
[#49](https://github.com/ereztash/lichess_app/pull/49),
[#50](https://github.com/ereztash/lichess_app/pull/50),
[#51](https://github.com/ereztash/lichess_app/pull/51).

**Supersedes:** [D24](D24-learning-architecture.md)'s `NARROW` verdict, which rested on `RC-06` being
eligible. **It amends rather than erases**: D24's sequencing constraint, its architecture finding
about `mayPrescribe`, and its two pre-human gates all survive, and Gate A is now answered.

---

## The ten questions

### 1. Is the domain trigger semantically coherent?

**For some classes yes, and the audit is now the load-bearing part.** `RC-06`'s trigger null-moves
and asks whether the opponent mates, which is what a mate threat is. **Two of seventeen triggers name
a condition they do not test** (`RC-13`, `RC-21`), #51 built `C10` to catch that, and **the scope
predicate it caught `RC-21` with is itself not the condition**: `_lone_king_defends` tests the
opponent's piece list, and on the full trigger-positive cell the functional condition holds on only
**53.6%** of what it certifies. `RC-21` is `SEMANTICALLY-UNDERDEFINED`.

**The recursion has to stop at a measurement, not at a sentence.**

### 2. Is the action representation valid?

**No, and this is the decision.** `separation` is the quantity `G5` reads, and on `RC-06` its two
terms are computed under different definitions of `B`. Under one fixed predicate — the rule as its own
`prescription` string states it — on Stockfish 17.1, 250 items per cell, 0 failures, positive control
reproducing the published values:

| | `b_valid` T+ | `b_valid` T− | separation |
| --- | --- | --- | --- |
| shipped, branching | .952 | .192 | **+0.760** |
| fixed, as written | .952 | **1.000** (250/250) | **−0.048** |

Engine-free and prior: **99.5%** of legal moves satisfy the rule on trigger-negative items; on
**94.1%** every legal move does.

**The prescription is not wrong — it is uninformative.** And it is **two of seventeen** classes:
`RC-12` inflates the same way, and the detector #49 built to find this reports it as clean, because
it tests for a literal `_trigger(` call and `RC-12` inlines the condition.

### 3. Is B-membership sufficient?

**No.** `RC-06` permits a median **29.7%** of legal moves, **28.6%** of them within 100 cp, with some
permitted move losing ≥100 cp on **84.7%** of positive items — the broadest and least safe of the
three reference classes. A player who answers the mate threat and loses a rook scores a hit. **And
Study D scores exactly this quantity**, which #51 believed it did not.

### 4. Are T+/T− items defensible?

**No, and it is now moot.** max |SMD| **0.573**; exact matching removes less than a third of it;
`itemDifficultyConfound` is a committed **failing** control. Matching items for a void contrast does
not produce a valid contrast.

### 5. Can M0 distinguish the required learner states?

**One of four, partially.** Rate-matched learners, Bayes-optimal classifier, 20 items per condition:
`A/B` at .863 from move alone; `C/D`, `E/F`, `G/H` all at **.500**.

### 6. Does M1 add useful identifiability beyond M0?

**Not today.** Five of eight candidate discriminating observations do not distinguish the models. Of
the three that do, two have no admissible instrument, and the third — `chose-past-it` — is collected,
one-sided, and **has never had its base rate measured**. `shared/reveal.ts` says so itself.

### 7. Is final move sufficient?

**On outcome-shaped rules, no — structurally.** For any rule of the form *"if THREAT, act so that
THREAT is gone"*, `B` is satisfied whenever the threat is absent, so the noise cell is degenerate by
construction and no final-move contrast exists.

**On method-shaped rules the question is open and has not been asked.** `RC-11
move-the-threatened-minor` defines `B` as a property of the move, does not branch, and has a
trigger-negative prescription size of **.175**. **That is the difference between .500 and .983 on the
distinction that matters**, and it is one screen away.

### 8. Which additional observations add real incremental evidence?

**Three, and none of them is a sensor:**

| | Δ on the distinction it serves |
| --- | --- |
| a trigger-negative cell scored by the **same** predicate | **+.48 on C/D** — the highest-value observation in the programme, and free |
| a **timed condition** | +.30 on E/F. Recording seconds does **not** do this |
| a **delayed condition** | +.30 on G/H |
| a **generic-cue arm** | +.44 on the cue pair, and it is the M0/M1 discriminator |
| the candidate set | **+.010 on A/B, noise on everything else** — narrow, and already collected |

**Removed on evidence, not on cost:** think-aloud, mouse traces, gaze, autoconfrontation. Each is
worth **0.000** on `C/D` while the noise cell is saturated.

### 9. Is human construct validation admissible?

**No.** Study D has no valid item bank, its primary outcome is a quantity that does not mean
rule-consistent action, and its design cannot separate the pair that decides which intervention it
would recommend. **Zero participants remains the correct cost.**

### 10. What is the strongest permitted claim?

[`STRONGEST_PERMITTED_CLAIM.md`](../evidence-architecture/STRONGEST_PERMITTED_CLAIM.md) and its JSON.
In one sentence:

> Decision Lab can identify positions where a named chess condition holds and record whether the
> player's move satisfied a named board-only property of the result — and **cannot yet show that any
> such record distinguishes a player who knows when the condition applies from one who performs the
> action regardless.**

---

## The final question, answered

> *What is the smallest set of observable evidence that allows Decision Lab to distinguish between
> "the player happened to make this move" and "a particular decision capability controlled the move",
> with enough identifiability to choose a different next intervention when the underlying bottleneck
> is different?*

**It is smaller than the programme feared, and it is not what the programme has.**

```text
position + move          on BOTH cells of a trigger
                         whose response predicate is the SAME on both
+ time
+ a timed condition
+ a delayed condition
+ a generic (contentless) cue arm
```

**Four of those six are already in the product.** The two that are not are experimental *arms*, not
instruments. And the first line does the most work: a trigger-negative cell scored by the same
predicate takes the central distinction from **.500 to .983 on move alone.**

**`position + move + time` is not enough**, and the reason is not that the move is a thin
observation. It is that on the rule shape the programme chose, the move means the same thing whether
or not the trigger is present. **Fix the rule shape and the cheapest possible evidence suffices.
Leave it and no evidence suffices, at any price.**

**Rich process evidence is not required, and this is measured rather than assumed:** every process
observation tested leaves the central distinction at exactly chance.

---

## Reversal conditions

1. **A single fixed response predicate, defensible from the rule's own statement, gives `RC-06` a
   trigger-negative rate materially below 1.** Then §2 is wrong and `RC-06` returns.
2. **`RC-11` (or any method-shaped class) survives `C11` with a non-degenerate noise cell.** Then
   `CONSTRUCT-UNDERIDENTIFIED` was a fact about outcome-shaped rules, this decision becomes `NARROW`
   on that class, and Gate B is unblocked.
3. **Every method-shaped class also saturates.** Then the limit is the paradigm rather than the rule
   choice, and **that** is `PROCESS-EVIDENCE-REQUIRED` — reached properly, from a validly measured
   final-move contrast that failed.
4. **The `chose-past-it` base rate is materially above a few percent.** Then M1 has real production
   support and the model comparison reopens.
5. **The anchors fail `C11` too.** Then every published comparison in `RULE_CLASS_SEARCH.md` is
   against a broken reference and the whole register needs re-grading, not just re-reading.
6. **An observation is exhibited that separates `p_neg` = .05 from `p_neg` = .55 when P(B | T−) = 1
   for both.** Then the underidentification claim is wrong. **Note what it must be: not the
   response.**

---

## What must not happen next

- **No candidate 16.** Fifteen candidates, eight families, three selection strategies. The question
  is whether the instrument is sound.
- **No Learning UX, learner score, `mastery = X%`, POMDP, bandit or reinforcement learning.** There is
  no observation model.
- **No recruitment.**
- **No optimisation of 1/3/7/21.** A scheduler is content-blind; FSRS would improve the timing of the
  rehearsal of an `E0` sentence.
- **No process-evidence programme.** Measured at zero against this failure.
- **No repair of `RC-06`.** Preserve the failure. `docs/measurement/` keeps its rounds; this decision
  adds a round rather than rewriting them.

## The one next action

**Re-screen every rule class, including both anchors, under `C11`** — the prescription size on the
trigger-negative cell under the response predicate as the class's own sentence states it. No engine,
no participants, no new corpus, and it is what decides whether `RULE_CLASS_SEARCH.md` describes chess
or describes its predicates.

**Then, and only if an anchor survives, screen `RC-11`.**

# `CONSTRUCT-UNDERIDENTIFIED`

**STOP.** Execution 2 does not follow from this result, and Execution 3 is not unlocked.
