# ADR-003 — INV-10 is written down, and the product's drill loop contradicts it

**Status:** **open.** The contradiction is established; the resolution is not this ADR's to make.
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

## Why this ADR does not decide it

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

## What was done instead

Nothing in the product changed. `protocolFor` exists, is tested, and returns `timed-holdout` for
all three environment buckets — so the moment anything routes a claim through it, the
contradiction surfaces as a value rather than as a discrepancy nobody looks for.

## The three ways this can go, so the decision is a choice and not a discovery

1. **Enforce INV-10 as written.** `beginDrill` refuses environment buckets through the `reason`
   channel it already has. Honest, and it costs the product its prospective test on the buckets
   that matter most, for as long as no timed holdout has filled.
2. **Narrow INV-10 to `clock-under-1m`.** Accept the first position for the two think-time
   buckets. Cheap, keeps the loop working — and it is an amendment to a ratified invariant, so it
   needs to be written as one, not absorbed.
3. **Grade by protocol.** A position drill may raise a claim about a think-time bucket only to a
   grade that names the protocol it was tested under, with a timed holdout required for the
   grade above it. This is the only option that does not throw one position away, and it is the
   most work: it touches grading, which is terminal.

None of the three is preferable on the evidence in this repository. That is the finding.
