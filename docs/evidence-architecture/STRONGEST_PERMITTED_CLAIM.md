# The strongest permitted claim after Execution 1

**Machine-readable companion:**
[`STRONGEST_PERMITTED_CLAIM.json`](STRONGEST_PERMITTED_CLAIM.json). Where the two differ, the JSON
is authoritative.

---

## Permitted

> **A frozen board predicate can identify positions in which a named chess condition holds, and
> whether the player's move satisfied a named board-only property of the resulting position is
> recordable from the position and the move alone, with no engine, no result and no post-reveal
> information.**

Evidence: `E1`–`E2`. The corpus scan reproduces exactly at the pinned environment and seed;
`outcomeLeakControl` asserts an identical table after every oracle field is stripped.

> **On positions where the opponent threatens mate in one, the best move that removes that threat is
> the engine's own best move on 242 of 242 items where the rule prescribes anything, at a median cost
> of one centipawn, while not answering the threat loses ≥100 cp on 84.9% of them.**

Evidence: `E1`. This is a fact about **chess**, and it survives everything below.

> **The product records, per decision and before any reveal: the position, the committed move, the
> time taken, the player's stated read, their confidence with the scale it was stated on, every
> distinct move physically placed on the board in touch order, and a randomised probe arm asking for
> one alternative after commitment.**

Evidence: shipped and tested.

## Permitted, narrowly

> **Across fifteen board-definable rule classes in eight families, chosen by three different
> strategies, none has a trigger that determines a correct action sharply enough for
> `knowledge → action` to be identifiable from the final move — and the one that appeared to did so
> because its two cells score different behaviours.**

Evidence: `E1`. Fifteen candidates plus two anchors is not a sample of chess; it is a statement about
those fifteen and about the instrument that screened them.

> **On outcome-shaped rules — *"if T, act so that T is gone"* — the trigger-negative cell is
> degenerate by construction. Measured on `RC-06`: 99.5% of legal moves satisfy the rule when its
> trigger is absent, and on 93.2% of items every legal move does. `RC-12` inflates the same way.**

Evidence: `E1`, measured on two of seventeen classes and argued structurally for the shape.

## Not permitted

- **That `RC-06` is an eligible rule class.** It passes `G5` only under a cross-predicate difference.
- **That any measured `separation` is a specificity statistic**, for any class, until that class is
  graded under `C11`. **The anchors have not been graded.**
- **That `move ∈ B` is rule-consistent action** on `RC-06`: `B` permits a median 29.7% of legal
  moves, 28.6% of them are safe, and 84.7% of positive items contain a permitted move losing ≥100 cp.
- **That `RC-21` measures the rule of the square**, under either the shipped or the audit predicate.
- **That the SDT criterion on `RC-06` is a player parameter.** A move-blind agent scores *d′* 0.80
  and *c* +0.88 from predicate sizes alone.
- **That `A5` is a gate on the expected-score scale.** The ceiling anchor fails it.
- **That T+ and T− are exchangeable.** max |SMD| 0.573; `itemDifficultyConfound` is a committed
  failing control.
- **That correct conditional discrimination is distinguishable from response bias** under any
  observation set the protocol proposes, on a class with a saturated noise cell.
- **That process evidence would repair that.** Measured at exactly chance for every process
  observation tested.
- **That M1's six stages are supported over M0's two.**
- **That anything here is about a person.** No participant was measured by this execution.

## Forbidden sentences

Carried forward from `docs/measurement/STRONGEST_PERMITTED_CLAIM.json` and extended:

```text
this measures whether the player has learned the unprotected-piece rule
d' increased, therefore discrimination improved
the player applies the rule N% of the time
accuracy on T+ items, reported alone
post > pre implies the intervention caused the change
puzzle-task improvement implies improvement in ordinary play
the Lichess hangingPiece theme may define the trigger state
--- added by Execution 1 ---
RC-06 is the eligible rule class
RC-06's action signature is valid
separation of +0.768 shows the rule is specific to its trigger
the rule of the square applies where the opponent has no pieces
a knight promotion that checks does something a queen cannot
the final move is insufficient in general
process evidence is the next research object
```

**The last two are forbidden because they over-generalise a real result.** The failure is specific to
outcome-shaped rules, and a method-shaped final-move design has not been tried.

## Evidence level reached

| | |
| --- | --- |
| domain semantics | **`E1`** — reached, and two predicates failed at it |
| item/observation mapping | **`E2` attempted, not reached** |
| human construct validity | `E3` — **not started, and not admissible** |
| causal intervention | `E4` — blocked |
| delayed uncued transfer | `E5` — blocked; nothing in the repository measures it |
| ecological transfer | `E6` — blocked |
| replication | `E7` — blocked |

**Required for any product-visible learning claim: `E5`. Reached: `E1`.**
