# ADR-003 — a grade names the protocol that produced it

**Status:** **accepted** (option 3 below), decided by the repository's owner. The contradiction this
file opened with is resolved; the argument is kept because the resolution only makes sense against
it.
**Depends on:** ADR-001 (INV-10), `shared/validation-protocol.ts`, `docs/blitz/AUDIT.md` §1.7.

## What was found, and how

PR-13 wrote INV-10 down as code: `protocolFor(bucketKey)` returns `position-drill` for the three
phase and three standing buckets, and `timed-holdout` for `fast-under-45s`, `slow-over-2m` and
`clock-under-1m`. A claim about the decision environment cannot be tested by a protocol that
removes the environment.

**It did not check whether the product already did the thing the rule forbids.** It does. Run the
repository's own drill-loop test with one line printed from it:

```
DRILLED_CLAIM: claim-fast-under-45s | protocol INV-10 requires: timed-holdout
```

`tests/server/drill-route.test.ts` seeds an overconfidence-under-time-pressure pattern, takes the
claim the detector produces, drills it over real HTTP with eight positions, and grades it
`refuted` in one direction and `replicated` in the other. **Both grades are terminal**, and
refutation is not revisitable. The path is not an oversight either: `beginDrill`
(`shared/record-service.ts`) carries a comment that considered refusing these buckets and decided
against it —

> *Refusing them here as well was the first thing tried and it was too blunt — [the drill route
> test] drills a `fast-under-45s` claim with 12-second decisions, which is a genuine test of that
> claim, and refusing it would have withdrawn a capability that works.*

So this is not a rule the product forgot. It is **two positions, both argued, both in the tree.**

*(That comment's citation is stale in one detail — the test no longer names the bucket in its
source, it arrives at it through the detector — but the behaviour it describes is exactly what the
run above reproduces.)*

## The two positions, stated fairly

**The drill is a genuine test.** `fast-under-45s` is a property of the *decision*: how long the
player took. A drill measures that directly — `finishDrill` checks each drill decision's own think
time against the same predicate — so a player who takes 12 seconds in a drill really has produced
a decision inside the bucket. Nothing is inferred and nothing is assumed. On this reading only
`clock-under-1m` is untestable by a drill, because a clock reading is external state a drill has
none of.

**The drill tests a different thing.** The same number is produced by two different processes.
In a game, deciding in 12 seconds is *caused by the clock*; in a drill it is a free choice with
nothing at stake. The claim was derived from decisions where speed was pressure, and would be
graded — terminally — on decisions where speed is preference. That is the substitution INV-10 was
written to forbid, and `fast-under-45s` is the bucket B2 showed holds **99.7% of a blitz player's
decisions**, so it is not a corner case.

## Why this was the owner's call and not the implementer's

Refusing environment buckets in `beginDrill` is a **two-line change**. Its cost is not.

It withdraws the only prospective test the product can currently run on those buckets, and
`shared/population-baseline.ts` puts `slow-over-2m` at 50.7% accuracy against 64.9% outside it —
so `slow-over-2m` is a *common weakest bucket*, which is exactly what the claim loop selects.
Enforcement would leave those claims permanently at `hypothesis` until a `TimedHoldout` has data,
and the data needs `/blitz` games that do not exist yet.

That is a **scientific** change wearing an engineering change's clothes: it alters which claims the
product can ever grade. This repository's rule is that one must not ride inside the other, and the
plan's rule is that thresholds, buckets, sampling and claim rules do not move without an
explanation, a preregistration and a test. **It is also not resolvable from the repository**: both
positions are already written there, by people who had thought about it.

## The decision: option 3, and what it does and does not change

**A forward test now carries the protocol it ran under, and a protocol the claim does not require
may speak about the claim but never close it.**

| | before | after |
| --- | --- | --- |
| a clockless drill on `fast-under-45s` | runs, grades, **terminally** | runs, grades, **does not settle** |
| the drill result | stored | stored, unchanged |
| a later timed holdout | refused — the claim is closed | decides, in either direction |
| a later drill after a holdout has spoken | overwrites it | recorded, does not overwrite |
| on screen | "עמד בבדיקה אחת לפחות" | names the drill, and names the test that would close it |

Nothing is withdrawn. The drill still runs, its result is still recorded, the player's work is not
discarded, and the grade still moves. What changed is **authority**, not existence — which is why
`tests/shared/a-rule-the-product-breaks.test.ts` did *not* go red on this resolution when it would
have on either of the others.

**The asymmetry the old rule had was the real defect.** `refuted` is terminal and `beginDrill`
refuses a refuted claim forever, so a clockless drill could do the one thing that cannot be undone
to a claim about playing under a clock. A protocol that removes the condition must not be able to
close the question in *either* direction: a player who calibrates fine with no clock running has
not shown they calibrate fine under one, and a player who slips with no clock has not shown the
clock is why.

### Two things that had to be decided while implementing it, and were not obvious

**A legacy result still decides.** Every drill reported before the protocol column existed was
graded terminally and the player was told the outcome. `evaluateClaim` is a fold over stored
results, so making legacy non-authoritative would not merely change the rule going forward — it
would silently re-grade already-decided claims on the next read, with nothing recording that it had
happened. Carrying an old verdict that is now *named* as old is better than rewriting one somebody
has already seen. `LEGACY_VALIDATION` is a separate key, never backfilled to `position-drill`, on
the same argument `measurement-protocol.ts` makes for its own.

**An unclassified bucket keeps the old rule, and the first implementation got this backwards.** It
read `protocolFor`'s null as "nothing may decide this", which sounds like the same caution
`protocolFor` exercises and is not: that function refuses to *name* a protocol, this one decides
whether a question may ever be *closed*. A bucket nothing can settle is a claim that flips between
`replicated` and `refuted` with every drill, forever. Found by a test rather than by reading —
`tests/shared/claim.test.ts` asserts a refuted claim stays refuted, and it went red on a fixture
whose claim id is not one of the six buckets. The narrowing now applies only where a protocol is
**known** to remove the condition.

### Two mutations stayed green, and both were gaps rather than approvals

**Deleting the guard against an off-protocol result overwriting an on-protocol one changed
nothing.** Every sequence under test stood at `refuted`, where the terminal branch returns first
and the guard is unreachable. It is live only when the standing grade is `replicated`. That case is
now tested.

**Retagging every result `shared/drill.ts` builds as a timed holdout left all 2,123 tests
passing.** That one string is where the whole mechanism gets its input; had it been wrong, every
clockless drill would have claimed to be a holdout and gone on settling clock claims — the exact
defect this ADR removes, reintroduced with nothing going red. Both construction sites are now
pinned, and so is the consequence.

## The three ways it could have gone

1. **Enforce INV-10 as written.** `beginDrill` refuses environment buckets. Honest, and it costs
   the product its prospective test on the buckets that matter most for as long as no timed holdout
   has filled — which needs blitz games that do not exist yet.
2. **Narrow INV-10 to `clock-under-1m`.** Cheap, keeps the loop working, and an amendment to a
   ratified invariant that would have to be written as one.
3. **Grade by protocol.** ← chosen. The only option that throws neither position away, and the most
   work, because it touches grading, which is terminal.

Option 3 is also the one continuous with how this repository already works: `evidence-policy.ts`
returns strata keyed by protocol and refuses to flatten them, and `measurement-protocol.ts` records
what the world was like while a decision was made. Evidence has carried its protocol here for some
time. This extends that to the one place it had not reached, which is where a measurement becomes a
verdict.
