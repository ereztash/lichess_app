# D20 — what protocol may judge this claim?

**Mode:** `PORT_AFTER_EQUIVALENCE` for the mechanism.
**Status:** **closed.** The mechanism is decided here; the product choice it enables was taken by
the owner in [#42](https://github.com/ereztash/lichess_app/pull/42) (ADR-003 option 3) while this
node was being written, and merged into `main` on 2026-08-30.
**Depends on:** `shared/discovery/claim-class.ts`, `shared/validation-protocol.ts`,
`docs/blitz/ADR-003-a-rule-the-product-breaks.md`, `docs/discovery-v2/M0_AUDIT.md` §Q3.

## CLAIM

A claim about the decision **environment** cannot be tested by a protocol that removes the
environment. "Your calibration slips under time pressure" is not tested by showing somebody a
position with no clock running: the drill removes the one condition the claim is about, and then
reports a verdict on it.

The product did this, and the grade was terminal. That is what ADR-003 recorded and what this node
was opened against; [#42](https://github.com/ereztash/lichess_app/pull/42) has since changed it on
`main`. The statement is left in the present tense of when it was true, because the rest of this
file is an argument about a defect that existed.

## ALTERNATIVES

For the **mechanism** — how the protocol is chosen:

1. **A list of bucket keys**, as `validation-protocol.ts` had. Correct for six fixed names.
2. **Derive the class from what the subgroup reads**, via a per-feature condition kind.
3. **Ask the claim's author** to declare its protocol.

For the **product choice** — what to do about the contradiction, taken verbatim from ADR-003:

- **(a)** enforce INV-10 as written: `beginDrill` refuses environment buckets;
- **(b)** narrow INV-10 to `clock-under-1m`, accepting that a 12-second drill decision genuinely
  *is* a fast decision;
- **(c)** grade by protocol: a position drill may raise an environment claim only to a grade that
  names the protocol it was tested under.

## EXTERNAL IMPLEMENTATIONS

None applicable. This is a domain rule about chess measurement, not a statistical procedure, and no
library has an opinion about whether a clock is a property of a board.

## WHAT WAS COPIED / WRAPPED / USED AS REFERENCE

Nothing, nothing, nothing.

## LOCAL EVIDENCE

ADR-003 established the contradiction by running the repository's own drill-loop test with one line
printed from it:

```
DRILLED_CLAIM: claim-fast-under-45s | protocol INV-10 requires: timed-holdout
```

Both grades that path can produce are terminal, and refutation is not revisitable. `protocolFor` has
returned `timed-holdout` for that bucket since it was written; **nothing consulted it.**

`shared/population-baseline.ts` puts `slow-over-2m` at 50.7% accuracy against 64.9% outside it, so
an environment bucket is a *common* weakest bucket — this is not a corner case. The B2 study
(`docs/research/TIME_REPRESENTATION_RESULTS.md`) puts 99.7% of a blitz player's decisions inside
`fast-under-45s`.

M0's Q4 adds one measurement neither had: on a clean planted effect the six-bucket chain **validates
a claim naming the wrong subgroup 11% of the time** when the true region is one no bucket can
express. The judge cannot catch that, because it tests the bucket that was frozen and that bucket
really does separate. **Protocol matching and region attribution are two different problems**, and
solving the first does not touch the second.

## COUNTEREVIDENCE

The case *for* the current behaviour is real and is argued in the repository by people who had
thought about it. `beginDrill` carries it: a drill decision taken in 12 seconds genuinely is a
decision inside `fast-under-45s`, `finishDrill` checks each drill decision's own think time against
the same predicate, and refusing these buckets *"would have withdrawn a capability that works."*

On that reading only `clock-under-1m` is untestable by a drill, because a clock reading is external
state a drill has none of.

Enforcing INV-10 costs the product its only prospective test on the buckets that matter most, for as
long as no timed holdout has filled — and the data needs `/blitz` games that do not exist yet.

## UNCERTAINTY

Whether deciding in 12 seconds *because the clock is running* and deciding in 12 seconds *because
nothing is at stake* are the same event. Both positions are defensible; the repository contains no
measurement that separates them, and one could be made — compare the calibration gap of drill
decisions under 45 seconds against game decisions under 45 seconds, on the same players.
**That measurement does not exist, and this node should not be closed without it.**

## DECISION

**Alternative 2 for the mechanism, and nothing for the choice.**

`shared/discovery/claim-class.ts` derives the class from what a subgroup *reads*: each feature
carries a `condition_kind`, and a predicate's class follows by a precedence in which the strictest
requirement wins — one unclassified term makes the whole claim `UNKNOWN`, a model output beside a
phase still needs the model pinned, and a board plus a clock is `POSITION_X_ENVIRONMENT` rather than
either half.

`UNKNOWN` dispatches to `no-verdict`, which is a protocol in the table rather than an absence.
Leaving it out and returning null would let a caller read "we have not classified this" as "the
default applies" — which is exactly how a clock claim came to be tested with a chessboard.

`shared/validation-protocol.ts` now derives `protocolFor` from that one table instead of keeping a
second list of keys, and **answers exactly what it answered before**; its existing test file is
unchanged and passes. A seventh bucket added without deciding how it can be validated now
classifies `UNKNOWN` and gets no verdict, rather than defaulting to the only protocol on the shelf.

**The three-way choice was not this node's to make**, and it has since been made and merged.
[#42](https://github.com/ereztash/lichess_app/pull/42) takes option 3: a forward test carries the
protocol it ran under, and a protocol the claim does not require may speak about the claim but
never close it -- in either direction, because a player who calibrates fine with no clock running
has not shown they calibrate fine under one. `requiredProtocolFor` there reads `protocolFor`, which
this node left answering exactly what it answered before, so the two compose.

### Where this node and #42 disagree about `UNKNOWN`, and why both are right

#42 grades a claim on an unclassified bucket **by the old rule**, and says why: a claim nothing may
close *"flips between `replicated` and `refuted` with every drill, forever"*. This node sends
`UNKNOWN` to `no-verdict`.

They are answering different questions, and the answers do not transfer.

| | question | wrong answer |
| --- | --- | --- |
| #42 | may this **stored claim** ever be closed? | refusing forever -- the claim never settles |
| here | may this **candidate** be frozen at all? | freezing it -- it promises a verdict nothing can give |

`freeze` refuses an unclassifiable hypothesis **before it becomes a claim**, so a hypothesis this
node turns away never acquires a grade that could flip. The failure mode #42 found by test does not
exist upstream of the freeze. Applying either answer to the other's question is what would be
wrong, and this table is here so that a reader who meets both modules does not conclude one of them
is a bug.

## REVERSAL CONDITION

- **The mechanism reverses** if a real subgroup arrives whose class cannot be derived from its
  features — a claim about the *interaction between* two decisions, say, where neither feature is
  sequential but the pair is. Then the class belongs to the predicate as a whole and alternative 3
  returns.
- **The mechanism reverses** if `UNKNOWN` starts firing on subgroups that are obviously testable.
  That would mean the registry is under-declared rather than the claims being unclassifiable, and
  the fix is the registry, not the table.
- **This node is closed by #42, which merged.** The owner picked (c), and picked it against the argument
  rather than by default — which is what the ADR asked for. What it did NOT have is the measurement
  named under UNCERTAINTY, and (c) is the option least damaged by that: it lets a timed holdout
  speak later in either direction, so if drill-speed and clock-speed turn out to be the same event
  the drill's verdict was never thrown away, and if they turn out to differ nothing was closed on
  the wrong one. That measurement is still worth making, and it is now a refinement rather than a
  precondition.
