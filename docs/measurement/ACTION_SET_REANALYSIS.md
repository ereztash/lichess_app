# The same seventeen rule classes, scored as a decision instead of as agreement with one move

**Answer: the published ordering survives. The instrument that produced it does not fully, and the
rule class the last round called the program's thesis turns out to have a broken trigger.**

Three findings, in order of how much they change what to do next:

1. **The decision model agrees with the top-1 screen.** Across seventeen rule classes,
   Spearman ρ = **+0.821**, *p* = 0.00005 between `separation_b_valid` and the separation in
   necessity; ρ = **+0.733**, *p* = 0.0008 against its chance-corrected form. **The published
   ranking is not an artefact of measuring argmax agreement**, which is what this run was built to
   test.
2. **`RC-21 push-the-unstoppable-passer` does not measure the rule of the square.** Its trigger
   fires on positions where the opponent still has, at the median, **13 points of pieces** with
   which to stop the pawn. On the **12.8%** of its items where the rule of the square actually
   applies — the opponent down to king and pawns — `b_valid` is **.562**, not .180, and following
   the rule costs **exactly nothing**.
3. **`RC-06`'s prescription is not safe to teach as stated.** It permits a median **29.7%** of the
   legal moves, and only **28.6%** of those permitted moves are within 100 cp of best. On
   **84.7%** of its positive items, some move that "answers the mate threat" loses ≥100 cp.
   `b_valid` cannot see this, because it only ever looks at the best member of `B`.

---

## What was measured, and what was deliberately left alone

For every item, one partition of the legal moves and three quantities from it:

```
V*     = max(V_B, V_notB)     the position's worth
V_B                           the worth of obeying
V_notB                        the worth of disobeying

efficacy     regret_B  = V* - V_B          does obeying cost anything?
necessity    advantage = V_B - V_notB      does disobeying cost anything?
robustness   V* - V(a) over every a in B   is the whole permitted set safe?
```

Efficacy and necessity are **one signed quantity read from two ends**, not two tests passed:
`V* = max(V_B, V_notB)` means exactly one of them is ever non-trivial on a given item. Robustness
is the column that is genuinely new.

**Necessity is reported against a per-item chance control.** `B` is small and its complement is
large, so a size-matched *random* prescription drawn on the same position already scores a strongly
negative advantage — between **−0.07 and −0.42** in expected score depending on the class. Every
advantage below is therefore also reported minus its own random draw, paired item by item. The
control does its job: prescription size predicts the raw chance baseline (ρ = +0.568, *p* = 0.017)
and does **not** predict the corrected advantage (ρ = +0.121, *p* = 0.642).

**Nothing about the protocol changed.** Same corpus file, same seed, same sampler, same 250 items
per cell, same per-candidate in-check exclusion — and `b_valid` recomputed here by the published
method, so every comparison is between instruments rather than between studies.

## Provenance, and the subtraction this document does not support

The corpus reproduces the published run **exactly**: 60,834 games seen, 60,000 used, 180,000
positions, 12,119 in check, 580,852 records, and identical trigger counts on all seventeen classes.
The sampler draws the same **8,307** items. **48,155 searches, 0 engine failures.**

**The engine is not the published engine.** The published screen ran Stockfish 17.1; this run ran
**Stockfish 16**, because 17.1 could not be obtained here. So `b_valid` was recomputed inside this
run and every comparison below is **within-run**. No number here may be subtracted from a number in
[`RULE_CLASS_SEARCH.md`](RULE_CLASS_SEARCH.md).

It is worth recording how little that mattered: on the same items, Stockfish 16 reproduces 17.1's
`b_valid` to within a few thousandths — `RC-06` **.968 / .204** here against **.968 / .200**
published, `RC-01` .788 / .184 against .784 / .184, `RC-03` .964 / .668 against .956 / .680. **The
published screen is not engine-dependent**, which is a thing nobody had checked.

---

## The table

Expected score (`xs`) is the primary scale throughout; centipawns are kept for continuity and never
averaged. `safe in B` is the share of *permitted moves* within 100 cp of best — the repo's existing
convention for "a real error", not a new threshold.

| | rule class | family | `b_valid` T+ | sep `b_valid` | regret T+ | regret T− | adv/chance T+ | sep adv/chance | safe in B | verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RC-00 | mate-in-one | immediate mate threats | 1.000 | +0.812 | +0.000 | +0.294 | +0.335 | +0.344 | .482 | ANCHOR |
| RC-01 | loose-piece | elementary tactical safety relations | .788 | +0.604 | +0.029 | +0.235 | +0.649 | +0.564 | .795 | ANCHOR |
| RC-02 | recapture | recapture decisions | .648 | +0.380 | +0.081 | +0.229 | +0.445 | +0.309 | .644 | fails A5_beats_incumbent |
| RC-03 | capture-the-checker | responding to check / escaping check | .964 | +0.296 | +0.000 | +0.039 | +0.388 | +0.150 | .851 | fails A5_beats_incumbent |
| RC-04 | save-the-attacked-piece | forced defensive responses | .704 | +0.396 | +0.042 | +0.143 | +0.224 | +0.198 | .311 | fails A5_beats_incumbent |
| RC-05 | safe-promotion | promotion-race decisions | .520 | +0.416 | +0.038 | +0.129 | +0.118 | +0.064 | .856 | fails A5_beats_incumbent |
| RC-06 | answer-the-mate-threat | threat recognition | .968 | +0.764 | +0.000 | +0.120 | +0.464 | +0.391 | .286 | fails A5_beats_incumbent |
| RC-07 | answer-the-queen-threat | severity ladder: defensive threat answering | .820 | +0.404 | +0.019 | +0.077 | +0.457 | +0.373 | .439 | fails A5_beats_incumbent |
| RC-08 | answer-the-rook-threat | severity ladder: defensive threat answering | .700 | +0.340 | +0.039 | +0.055 | +0.298 | +0.219 | .396 | fails A5_beats_incumbent |
| RC-09 | answer-the-minor-threat | severity ladder: defensive threat answering | .652 | +0.216 | +0.037 | +0.047 | +0.302 | +0.233 | .456 | fails A5_beats_incumbent |
| RC-11 | move-the-threatened-minor | prescription-shape control | .600 | +0.448 | +0.063 | +0.156 | +0.260 | +0.172 | .342 | fails A5_beats_incumbent |
| RC-12 | stop-the-promotion | severity ladder: defensive threat answering | .464 | +0.032 | +0.039 | +0.067 | +0.198 | +0.114 | .399 | fails A5_beats_incumbent |
| RC-13 | underpromote-to-knight | noise-cell-first: committal acts | .000 | +0.000 | +0.064 | +0.222 | +0.074 | +0.116 | .308 | fails A5_beats_incumbent |
| RC-14 | capture-the-mating-piece | noise-cell-first: committal acts | .667 | +0.143 | +0.061 | +0.115 | +0.444 | +0.057 | .719 | fails A5_beats_incumbent |
| RC-18 | move-the-piece-that-must-move | noise-cell-first: committal acts | .612 | +0.452 | +0.058 | +0.130 | +0.327 | +0.231 | .341 | fails A5_beats_incumbent |
| RC-20 | defend-the-piece-in-place | noise-cell-first: committal acts | .224 | -0.104 | +0.121 | +0.092 | +0.137 | +0.052 | .260 | fails A3_efficacious, A5_beats_incumbent |
| RC-21 | push-the-unstoppable-passer | noise-cell-first: committal acts | .180 | +0.096 | +0.131 | +0.170 | +0.042 | +0.017 | .411 | fails A5_beats_incumbent |

---

## Why every verdict reads `fails A5`, and why that is not a finding about chess

`A5` asks whether a candidate out-separates the refuted incumbent, `RC-01`. Under this instrument
**the ceiling does not out-separate the floor**: `RC-00 mate-in-one` scores **+0.344** where
`RC-01 loose-piece` scores **+0.564**, so the sharpest rule class chess allows sits *fourth* and the
rule class already shown to be uninterpretable sits *first*. The anchor interval inverts, so
`position_between_anchors` is a ratio over a meaningless interval and is **not reported in the table
above**.

The cause is a property of the utility scale, and it is exact rather than statistical:

> **The mean `V*` on `RC-00`'s positive cell is 1.000.**

Every mate-in-one position is, in win-probability terms, an already-won game. Finding the mate
therefore buys almost nothing a decision model can see — `RC-00`'s raw advantage is **+0.120**,
against `RC-06`'s **+0.354** — because the best non-checking move usually keeps the game won too.
In centipawns the same cell reads **+99,255**, which is the mate constant rather than a quantity.
**Neither scale can price mate-in-one**: one saturates, the other is a placeholder.

This is the cost of the move to win probability, and it was not anticipated when the move was
proposed. It is not fatal, and the reason is visible in the same column: `RC-06`'s positive cell has
mean `V*` = **0.336**. Its trigger fires when the player is *losing* — the opponent threatens
mate — so there is room for a decision to matter. **A rule class is measurable on this scale only
where its trigger fires in positions that are not already decided**, and that is a criterion the
published screen has no way to express.

The inversion is **not** an artefact of the chance control: on raw advantage the order is
`RC-01` +0.453, `RC-06` +0.446, `RC-00` +0.400 — inverted either way.

So: **"nothing is eligible" is what the gate mechanically returns, and it must not be read as a
statement about chess.** It is the instrument reporting that a chance-corrected separation anchored
on mate-in-one is not a usable ranking statistic.

## `RC-21`, and the correction it forces

Round 3 put `RC-21` forward as the program's thesis in one number:

> *"The rule of the square is named, exactly defined and genuinely true chess knowledge — and
> pushing the unstoppable passer is the engine's best move only 16.4% of the time, because a player
> with an unstoppable passer is usually winning several ways at once."*

**The explanation is right, and it applies to one item in eight.** The rule of the square answers
exactly one question — *can the lone enemy king catch this pawn?* — and the helper implementing it
says so in its own docstring. `_passer_trigger` never checks that the king is alone. It fires
whenever there is one passed pawn whose promotion square the enemy **king** cannot reach in time,
however many pieces that enemy still has to stop the pawn with. A rook two files away stops the
pawn; the rule of the square has nothing to say about it.

Partitioning the positive cell by what the opponent has left
(`research/measurement/trigger_scope.py`):

| `RC-21` T+ | n | share | `b_valid` | regret of obeying | mean `V*` |
| --- | --- | --- | --- | --- | --- |
| **opponent has king and pawns only** — the rule's actual scope | 32 | **12.8%** | **.562** | **0.000** | **0.953** |
| opponent still has pieces | 218 | 87.2% | .124 | 0.150 | 0.540 |

Read across the bottom row: those players are **not** winning several ways at once — mean `V*` is
0.540, a coin flip — and pushing the pawn there costs **15% of a game**. Read across the top row:
where the rule applies, the player *is* winning (0.953), obeying is **free**, and the engine plays
the pawn more often than not.

**So `RC-21` is not an example of a true `T` with no correct `B`. It is an example of a `T` that is
not true.** The nine criteria ask whether `T` can be determined before behaviour, and whether `T`
contains `B`. **Nothing in them, and nothing in either screen, asks whether the predicate detects
the condition it is named after** — and both screens took the trigger as given and measured what
followed.

That gap is worth more than the reanalysis it was found by.

### All seventeen triggers, against the conditions they are named after

`RC-21` was found by accident, so every class got the same question: **does the trigger fire on the
condition the rule class is named after?** Each scope predicate is read off that class's own name
and docstring — never invented to improve a score — and is a pure function of the position, so the
whole audit is recomputed from adjudications already on disk with no engine and no new sampling
(`research/measurement/trigger_scope.py`).

**The question is now a criterion.** `C10` is declared on every rule class in
`rule_classes.py` — `scope_claim` says what the class asserts, `c10_grade` says whether its trigger
tests that, and `scope_predicate` is the code that measures the distance. `RuleClass.__post_init__`
**refuses at import** any class that concedes a gap without handing over that predicate: a grade of
`asserted-and-unchecked` with nothing beside it would be the same comment nobody verified that let
`RC-21` through. This file no longer decides anything about a rule class — it reads what the class
declares and reports the consequence. Every number below is unchanged by that move.

Three grades, and the distinction between the first two carries the result:

| `c10_grade` | what it means | classes |
| --- | --- | --- |
| **`asserted-and-unchecked`** | the code skips a precondition **its own docstring asserts** | `RC-13`, `RC-21` |
| **`declared-and-separately-tested`** | the class narrows deliberately and says so | `RC-04`, `RC-07`, `RC-08`, `RC-09`, `RC-11`, `RC-18`, `RC-20` |
| **`tested-by-the-trigger`** | the trigger tests what the name claims | `RC-00`, `RC-01`, `RC-02`, `RC-03`, `RC-05`, `RC-06`, `RC-12`, `RC-14` |

| | `c10_grade` | in scope | `b_valid` in | `b_valid` out | gap | regret in | regret out |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **RC-21** push-the-unstoppable-passer | `asserted-and-unchecked` | 12.8% | **.562** | .124 | **+.439** | **0.000** | 0.150 |
| **RC-13** underpromote-to-knight | `asserted-and-unchecked` | 70.1% | .000 | .000 | **+.000** | 0.080 | 0.025 |
| RC-11 move-the-threatened-minor | `declared…tested` | 81.6% | .657 | .348 | +.309 | 0.053 | 0.106 |
| RC-07 answer-the-queen-threat | `declared…tested` | 76.8% | .865 | .672 | +.192 | 0.016 | 0.028 |
| RC-04 save-the-attacked-piece | `declared…tested` | 86.4% | .722 | .588 | +.134 | 0.034 | 0.094 |
| RC-09 answer-the-minor-threat | `declared…tested` | 84.8% | .670 | .553 | +.117 | 0.034 | 0.049 |
| RC-08 answer-the-rook-threat | `declared…tested` | 71.2% | .713 | .667 | +.047 | 0.031 | 0.057 |
| RC-20 defend-the-piece-in-place | `declared…tested` | 79.6% | .221 | .235 | −.014 | 0.122 | 0.118 |
| RC-18 move-the-piece-that-must-move | `declared…tested` | 90.4% | .606 | .667 | −.060 | 0.060 | 0.039 |
| *RC-05* safe-promotion | `tested-by-the-trigger` | 48.8% | .607 | .438 | +.169 | 0.004 | 0.071 |
| *RC-12* stop-the-promotion | `tested-by-the-trigger` | 13.2% | .455 | .465 | −.011 | 0.022 | 0.041 |

*`RC-05` and `RC-12` are faithful and are split anyway, as the moderator and the null control for
the material predicate. The other six faithful classes have no natural predicate and are not split:
manufacturing a partition for a trigger that claims nothing it skips would manufacture a defect.*

**A grade is not a score, and `RC-13` is why the two columns are separate.** Its docstring names
*"the knight does something a queen cannot"*; its trigger tests only that the knight promotion
checks, and a queen promotion very often checks from the same square. The skip is real. **It
explains nothing**: `b_valid` is **.000 on both sides** — 0 of 47 in scope — so the class fails just
as completely inside its own scope as outside it, and underpromoting is *more* expensive there
(regret 0.080 against 0.025). An unchecked claim can be harmless. `RC-21`'s is not; `RC-13`'s is.

**The declared narrowing has a cost, and it is not a law.** `_designated_threat` returns the most
valuable piece of ours the opponent can win, and each position is assigned to exactly one tier by
that value — deliberate, and on the record in its docstring. But where a *second* piece hangs, the
prescribed act rescues one and leaves a loss the rule is silent about. Five of the seven score
better where only one thing hangs, by about ten points of `b_valid` on average; two do not, and
those two have the smallest out-of-scope cells in the table (24 and 51 items). So it is a real cost
with two nulls sitting on it, reported as such.

**`RC-06` is `tested-by-the-trigger`, and that matters most of anything here.** `_threatens_mate_after_pass`
null-moves and asks whether the opponent mates, which is what a mate threat is; items where the mate
cannot be stopped are counted rather than dropped. The only eligible rule class in the register does
not name a condition it fails to test.

## What the decision model shows that `b_valid` cannot

**Robustness is a different question, and the ceiling anchor fails it.** `RC-00`'s `B` is *gives
check*, so on a mate-in-one item the permitted set contains the mate plus every other check. Only
**48.2%** of its permitted moves are within 100 cp, and on **76.4%** of its items some permitted
move loses ≥100 cp. A rule class with `b_valid | T+` = **1.000** has a prescription that is unsafe
half the time. Those are not in tension: `b_valid` asks whether `B` *contains* the best move,
robustness asks whether `B` is safe to *pick from*, and only the second is the question a teaching
system faces.

**The same caution, larger, applies to `RC-06`** — the only class the published screen found
eligible, and the one [#49](https://github.com/ereztash/lichess_app/pull/49)'s Study D is built on.
It permits a median 29.7% of legal moves; **28.6%** of those are safe; on **84.7%** of its positive
items some permitted move loses ≥100 cp. Its *best* permitted move is the engine's own on 242 of
242 items and costs a median of one centipawn — that is unchanged and is what makes it eligible.
But *"answer the mate threat"* as a prescription a player could be taught to follow does not, on
its own, pick a safe move. **This does not block Study D**, whose outcome is scored on a specific
prescribed act rather than on set membership. It does say the rule cannot be taught as stated
without the discrimination that chooses inside `B`.

## A defect the rebuild caught in itself

The first version took `V*` from a full-width search and `V_B` from a root-restricted one at the
same node budget. A restricted search spends the whole budget on fewer root moves and goes deeper,
so it returned `V_B > V*` — a **negative regret** — on real items. `V*` is now defined as
`max(V_B, V_notB)` over the same partition, which is definitionally correct and puts both terms on
one basis. The residual disagreement with the full-width search is recorded per item as
`basis_gap_cp`; its median is **0 cp** in thirteen of seventeen classes and −2 cp at worst, so the
defect lived entirely in the tails, which is exactly where a small negative number in a table goes
unnoticed. `tests/research/measurement-action-set.test.ts` holds the sign.

## What this does not establish

**Exchangeability is untouched.** `RC-06`'s max |SMD| of 0.573 is exactly where round 3 left it.
Nothing here bears on it, and it remains the live blocker.

**Robustness is reported and not gated.** No non-arbitrary cut exists for "how much of a
prescription must be safe", and inventing one here would be the move this program does not make.

**Seventeen is still seventeen.** Both correlations are computed over rule classes somebody chose,
and round 3 retracted round 2's headline for precisely that reason. ρ = +0.82 says the two
instruments rank *these seventeen* alike. It is not a law about chess.

**One engine, one node budget.** Every number is Stockfish 16 at 200,000 nodes. The `b_valid`
agreement with 17.1 is reassuring about the published screen; it is not a depth-stability result for
the new columns, which has not been run.

## What follows

1. **`C10` is in `rule_classes.py` and enforced at import**, so the question is now asked when a
   class is written rather than recovered afterwards. What it cannot do is prove the remaining
   eight faithful: it tests the conditions the docstrings **happen to state**, and a condition
   nobody wrote down is invisible to it. `scope_claim` is a signature on a claim, not a proof of
   one — a class can still be graded `tested-by-the-trigger` by an author who did not notice what
   they were assuming.
2. **`RC-21` deserves re-measuring on a corrected trigger** — one that requires the opponent to have
   no piece able to stop the pawn — rather than the retraction its current number invites. That is
   [#50](https://github.com/ereztash/lichess_app/pull/50)'s predicate to change, not this branch's.
3. **Exchangeability for `RC-06` remains the blocker**, and the per-move regret landscape this
   instrument computes is the adjudication that Frame C — minimal functional twins — was
   [blocked on](ITEM_BANK_PROTOCOL.md): whether an edit introduced a new tactical explanation is now
   a measurable question rather than an assumed one.
