# C11, run on all seventeen classes including both anchors

# Result: **ten of seventeen** noise cells carry no information about the rule — and one of them is the incumbent floor that defines gate `G5`

This is `R1` from [`ROADMAP.md`](ROADMAP.md), and the one next action
[`D25`](../decisions/D25-evidence-architecture.md) named. No engine, no participants, no new
corpus: every quantity below is a pure function of positions the published scan already wrote.

Arithmetic: [`c11_screen.py`](../../research/evidence-architecture/c11_screen.py) ·
[`c11_join_published.py`](../../research/evidence-architecture/c11_join_published.py) ·
results in [`results/`](../../research/evidence-architecture/results/).
2,000 items per cell, seed `20260831`, 6m43s.

---

## What C11 asks

`prescription_size` already guards the **positive** cell against a vacuous prescription scoring
well: a rule satisfied by most legal moves scores high on `C4` for no good reason, and the guard
catches it. **Nothing guarded the negative cell.** So:

> On the trigger-negative cell, under the response predicate **as that class's own `prescription`
> sentence states it**, what share of legal moves satisfies the rule?

**Two ways for the answer to make `separation` meaningless, and they pull in opposite directions.**
Finding the second is what made this run worth doing — the audit that preceded it saw only the first.

| grade | means | consequence |
| --- | --- | --- |
| **`SATURATED`** | mean prescription size on T− **≥ .95** | almost everything satisfies the rule when the trigger is absent, so `b_valid \| T−` is near 1 whatever anyone plays, and separation **collapses** |
| **`VACANT`** | **no** legal move satisfies the rule on **≥ 95%** of T− items | the rule names an act that does not exist there, so `b_valid \| T−` is **0 by construction**, separation is just `b_valid \| T+`, and the class is **flattered** |
| **`MEASURABLE`** | neither | the rule prescribes something on T− and it can be wrong |

**The published screen has neither, and that is the problem.** On ten classes the shipped predicate
silently **substitutes a different antecedent** on the negative cell, producing a non-degenerate
number that is not the rule's:

- `_designated_threat` returns a **pawn** where the sentence says *your queen* / *your rook* /
  *a knight or bishop* (`RC-07`, `RC-08`, `RC-09`, `RC-11`, `RC-18`, `RC-20`);
- `_loose_designated` returns the dearest **defended** piece where the sentence says
  *capturable and **undefended*** (`RC-01`);
- `_capture_the_threat_satisfies` hunts the **checking** piece where the sentence says the
  **mating** piece (`RC-14`);
- `_threat_satisfies` asks for *no check at all* where the sentence says *the mate is stopped*
  (`RC-06`);
- `_promotion_stop_satisfies` answers a **piece** threat where the sentence says a **promotion**
  (`RC-12`).

---

## The screen

Ordered by the **published** separation, so the ranking the programme reasoned from can be read
against the grade of the cell each number came from.

| | rule class | role | published sep | `presc\|T−` shipped | `presc\|T−` as stated | share of T− with **no** satisfying move | **C11** |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RC-00 | mate-in-one | *ceiling* | **+0.832** | .058 | — | .000 | `MEASURABLE` |
| RC-06 | answer-the-mate-threat | candidate | **+0.768** | .105 | **.994** | .000 | **`SATURATED`** |
| RC-01 | loose-piece | ***floor*** | **+0.600** | .031 | **.000** | **1.000** | **`VACANT`** |
| RC-18 | move-the-piece-that-must-move | candidate | +0.468 | .045 | .000 | 1.000 | **`VACANT`** |
| RC-11 | move-the-threatened-minor | candidate | +0.452 | .044 | .000 | 1.000 | **`VACANT`** |
| RC-05 | safe-promotion | candidate | +0.444 | .050 | — | .000 | `MEASURABLE` |
| RC-04 | save-the-attacked-piece | candidate | +0.412 | .178 | — | .000 | `MEASURABLE` |
| RC-02 | recapture | candidate | +0.400 | .035 | — | .000 | `MEASURABLE` |
| RC-07 | answer-the-queen-threat | candidate | +0.368 | .191 | .000 | 1.000 | **`VACANT`** |
| RC-08 | answer-the-rook-threat | candidate | +0.332 | .185 | .000 | 1.000 | **`VACANT`** |
| RC-03 | capture-the-checker | candidate | +0.276 | .381 | — | .000 | `MEASURABLE` |
| RC-09 | answer-the-minor-threat | candidate | +0.196 | .187 | .000 | 1.000 | **`VACANT`** |
| RC-14 | capture-the-mating-piece | candidate | +0.142 | .039 | .000 | 1.000 | **`VACANT`** |
| RC-21 | push-the-unstoppable-passer | candidate | +0.068 | .050 | — | .000 | `MEASURABLE` |
| RC-12 | stop-the-promotion | candidate | +0.040 | .184 | **.999** | .000 | **`SATURATED`** |
| RC-13 | underpromote-to-knight | candidate | +0.026 | .052 | .948 | .000 | `MEASURABLE` |
| RC-20 | defend-the-piece-in-place | candidate | −0.096 | .158 | .000 | 1.000 | **`VACANT`** |

**`MEASURABLE` 7 · `VACANT` 8 · `SATURATED` 2.**

*A `—` means the shipped predicate already is the sentence, so there is one reading and the grade
is on it.*

---

## The four things this settles

### 1. The gate's own floor is `VACANT`

`G5` asks whether a candidate **out-separates the refuted incumbent**, and the threshold is
`RC-01 loose-piece` at **+0.600**. `RC-01`'s as-stated noise cell is empty on **100%** of its T−
items: when there is no capturable-and-undefended piece, no legal move can *"take it"*. Its
published `b_valid | T−` of .184 is produced by scoring a **different act** — capturing the dearest
**defended** piece.

> **Every candidate in the register was measured against a threshold set by a class whose own
> separation is not a specificity statistic.**

That is the answer to the question `R1` was asked: `RULE_CLASS_SEARCH.md` describes **its
predicates**, not chess, at exactly the place where it does the most work.

### 2. Four of the top five published separations are ungraded cells

`RC-06` `SATURATED`; `RC-01`, `RC-18`, `RC-11` all `VACANT`. Only the **ceiling anchor** `RC-00`
survives C11 in the top five, and it survives because its sentence's second clause — *"a check
that is not mate is the error"* — explicitly makes the noise trial a **check**, so `gives check`
*is* the rule on both cells.

**The ordering is not random with respect to the grade, and the direction is the damaging one:**
the substitutions cluster at the top. That is not a coincidence — a substituted antecedent on T−
tends to be *harder* than the real one (leave the opponent checkless; rescue a hanging pawn), which
depresses `b_valid | T−` and inflates separation.

### 3. `RC-11` is `VACANT`, so [`D25`](../decisions/D25-evidence-architecture.md)'s recommended next candidate was wrong

D25 named `RC-11 move-the-threatened-minor` as the most promising route to a valid final-move
contrast, on the grounds that it is *"method-shaped, does not branch, T− prescription size .175"*.

**That .175 is the shipped number**, produced by `_designated_threat` returning a **pawn** where
`RC-11`'s sentence says *a knight or bishop of yours*. **As stated, `RC-11` prescribes nothing at
all on its negative cell.** The recommendation is withdrawn.

**And the generalisation behind it is refuted.** #49's H23 predicted that *method-shaped rules
should not have the problem*, because `B` is a property of the move rather than of a threat's
survival. `RC-11` and `RC-18` are both method-shaped — *"move it"* — and both are `VACANT`.
**Prescription shape is not what decides it.**

### 4. What actually decides it, and it is a property of the trigger

> **A rule class has a usable noise cell only where, with the trigger absent, the prescribed act
> still EXISTS and can be WRONG.**

`RC-02 recapture` is the clean case and it is worth stating as the design: on a T− item the
opponent moved to a square you attack **but did not capture**, so *"take back there"* is still
defined, still available, and now wrong. **Same act, same question, different truth value.** The
trigger's two cells differ in one fact about the world, and nothing about the response changes.

Every `MEASURABLE` class has that shape. Every `VACANT` class has a trigger whose negative cell
removes **the object the prescription names**, leaving the screen no choice but to substitute one.

**This is a criterion for writing the next rule class, and it is checkable before a single search
is spent.**

---

## What this does *not* change

- **`D25`'s verdict stands: `CONSTRUCT-UNDERIDENTIFIED`.** C11 removes more of the register than
  the audit did, and removes nothing from the reasons.
- **The domain facts stand.** `RC-06`'s positive cell — the engine's best move stopping the mate on
  242/242 items at a median of one centipawn — is untouched, as is the severity ladder's
  positive-cell monotonicity.
- **`RC-13`'s grade is on the reading that asks one question on both cells** (`promote to a knight`,
  which is `MEASURABLE`). Under the *prohibition* reading its sentence also admits — *"only when"*,
  so on T− the rule says do **not** — the as-stated share is **.948**, just below the `SATURATED`
  cut. Both readings are reported; nothing here depends on which is preferred, since `RC-13`'s
  `b_valid` is .030/.004 either way.
- **No threshold was invented to reach this.** `.95` is a description of "almost all", stated in
  advance, and every class is far from it: the `SATURATED` pair are at .994 and .999, the `VACANT`
  eight at exactly .000, and no `MEASURABLE` class is above .381.

## Two errors in this file's own instrument, found and fixed before the run

Recorded because a screen that passed first time has usually not been tested.

1. **`RC-11` was given `RC-18`'s predicate.** `RC-11` uses `_tier_trigger(KNIGHT)` — the *same
   trigger as `RC-09`* — and its sentence says nothing about the attacker being cheaper; only
   `RC-18`'s does, and only `RC-18` uses `_must_move_trigger`. Testing a class against a condition
   its own sentence does not state is the exact defect C11 exists to catch.
2. **`VACANT` was first graded on a low mean prescription size**, which called five
   narrow-but-available prescriptions degenerate. **A narrow prescription is a good prescription** —
   it is what `prescription_size` rewards on the positive cell. The defect is a cell on which *no*
   legal move can satisfy the rule, and the grade now reads that quantity.

## What follows

**The register cannot be re-ranked by re-reading it.** Seven classes have an interpretable
separation and the best non-anchor among them is `RC-05 safe-promotion` at **+0.444** — below the
old floor, but the old floor is void, so the comparison has to be rebuilt rather than reread:

| `MEASURABLE` candidates | published sep |
| --- | --- |
| `RC-05` safe-promotion | **+0.444** |
| `RC-04` save-the-attacked-piece | +0.412 |
| `RC-02` recapture | +0.400 |
| `RC-03` capture-the-checker | +0.276 |
| `RC-21` push-the-unstoppable-passer | +0.068 |
| `RC-13` underpromote-to-knight | +0.026 |

**`RC-05` and `RC-02` are the two worth measuring next**, and the reason is the criterion in §4
rather than the ranking: both keep the prescribed act defined and available when the trigger goes
away. `RC-03` has the highest `b_valid | T+` of the three (.956) and the worst separation (+0.276)
because its chance rate is **.381** — in check there are few legal moves and capturing the checker
is often *the* move regardless, which the published screen already flagged as the trap.

**What must not happen:** re-running the identifiability simulation on `RC-05` before its noise cell
is measured against a *human* baseline, and re-opening Study D on any of this. `C11` grades the
*instrument*; it says nothing about whether a player's move reveals a capability.
