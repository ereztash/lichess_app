# D26 — which population is the product's user-facing denominator?

# `DEFER`, with the destination named

**Mode:** `DEFER`. **Evidence level:** `E5` not reached. **Humans measured: 0.**

The owner has decided the destination and deliberately not the date.

## What was decided

1. **The long-term primary product evidence path is prospective decision evidence, `decisions`.**
2. **A blitz game is a context in which decisions occur.** `blitzGames` may be a source and a
   reading; it must not ultimately compete with `decisions` as a co-equal user-facing meaning of
   progress.
3. **The consolidation is not to be implemented before the FIELD run** pre-registered in
   [`research/player-path/FIELD_RUN_CURRENT.md`](../../research/player-path/FIELD_RUN_CURRENT.md).
4. `EXPERIMENTAL_LEARNING_ENABLED` **stays off** for that run.
5. [PR #105](https://github.com/ereztash/lichess_app/pull/105) is **frozen as the stimulus under
   test**.

## Why the decision and the implementation are separated here

`research/player-path/PRODUCT_STATE_WALK.md` found the structure this decision is about, and named
it `C-1`: the record page renders `0 מתוך 60 החלטות שהחיפוש הזה סופר` and, from the same visit,
`עוד 30 משחקים לפחות יאפשרו בדיקה ראשונה`. Two populations, two floors, two denominators, one
screen, and nothing on it saying they are two. A finished blitz game leaves `"decisions":[]` and
writes only `blitzGames`; the lanes do not feed each other.

The walk could establish that the structure exists. It could not establish that a reader is
confused by it. Those are different claims with different authorities, and repairing the second one
on the strength of the first is how a product gets tuned to its own audit rather than to its users.

**So the repair waits on the observation, and the observation is made against the unrepaired
build.** `C-1` is left visible on purpose. If it is not what stops anybody, consolidating first
would have spent the one cold-eyes run this build gets on a change nobody needed.

## What would reverse it

**Reverses decision 1 and 2:** FIELD evidence that the blitz reading is the one participants
understand, act on and return for, while the `decisions` counter is the one that reads as a wall.
That would make `decisions` the wrong denominator to lead with regardless of which population is
epistemically stronger, and the conflict would go back to the owner rather than being resolved by
either side's convenience.

**Reverses decision 3, the deferral:** a FIELD run whose primary bottleneck comes back
`CLAIM_BOUNDARY` with participant-level evidence of denominator confusion. Then the consolidation is
the next move and is no longer premature.

**Does not reverse anything:** the walk finding it again, an argument from architecture, or a
participant agreeing that two numbers are confusing after being shown that there are two. The last
of those is why the session script forbids pointing at it.
