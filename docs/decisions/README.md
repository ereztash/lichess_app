# The confidence ledger

One file per decision node in the Discovery V2 chain. Each records what was decided, what was
rejected, what evidence existed **outside this repository** before anything was written here, and —
without exception — **what would reverse it**.

## The rule

> There is no `status: solved` without a reversal condition.

A decision with no stated way to be wrong is not a decision, it is a preference that has stopped
being examined. Every file below ends with one.

## How a node may be implemented

A node's `implementation_mode` is one of these, and never anything else:

| mode | means |
| --- | --- |
| `REUSE` | the external implementation runs, as a dependency |
| `WRAP` | the external implementation runs, behind an interface of ours |
| `PORT_AFTER_EQUIVALENCE` | reimplemented here, **after** being differenced against the original |
| `PSEUDOCODE_ORACLE` | the external implementation runs outside the product, as a reference only |
| `DEFER` | not now, and the trigger that would start it is written down |
| `REJECT` | measured and refused, with the measurement |

There is no `BUILD_BECAUSE_IT_SEEMS_RIGHT`.

## Levels of evidence

What a piece of work is allowed to become, given what is known about it:

| level | what exists | what is permitted |
| --- | --- | --- |
| E0 | an idea | nothing may be built |
| E1 | an external implementation exists | a research prototype |
| E2 | a reference implementation reproduced locally | shadow running |
| E3 | passes the null and planted harness | a candidate for porting |
| E4 | the port is equivalent to the reference | production shadow |
| E5 | real prospective validation | user-visible |
| E6 | a measured behavioural effect | it may be said that the product helps |

## The nodes

| node | question | mode | state |
| --- | --- | --- | --- |
| [D00](D00-research-oracle-before-product-code.md) | where does discovery research run? | `PSEUDOCODE_ORACLE` | decided |
| [D01](D01-point-in-time-feature-contract.md) | how do we know a feature was available? | `PORT_AFTER_EQUIVALENCE` | decided |
| [D02](D02-the-unit-of-inference.md) | is a decision an observation? | `REJECT` (clustered judge) | decided, one number open |
| [D03](D03-what-a-search-may-read.md) | which features may a search read? | `PORT_AFTER_EQUIVALENCE` | decided |
| [D08](D08-attribution.md) | can anything tell the named region from a bucket that overlaps it? | `DEFER` | built and measured; not wired in. Reversal condition 2 fired, was measured against D04 and is closed — the veto's ceiling, not its threshold, is what a search changes |
| [D05](D05-blitz-time.md) | are the time buckets readable on the route built to measure time pressure? | `DEFER` | one candidate declared and **rejected** twice by its own rule — readability fixed outright, recovery a fifth of the bar where the shipped bucket reaches zero |
| [D09](D09-frozen-hypothesis-manifest.md) | what does freezing a hypothesis mean? | `PORT_AFTER_EQUIVALENCE` | decided |
| [D20](D20-protocol-matching.md) | what protocol may judge this claim? | `PORT_AFTER_EQUIVALENCE` | closed — the product choice was taken by the owner in [#42](https://github.com/ereztash/lichess_app/pull/42), merged |
| [D21](D21-feedback-exposure.md) | is a decision taken after feedback the same measurement as one taken before? | `DEFER` on the contract | open — two findings fixed, the third written down with three options and a trigger |
| [D04](D04-candidate-search.md) | can a search find a region the six buckets cannot express? | `PSEUDOCODE_ORACLE` | measured, not rejected — 0% → 33.5% correct attribution at 0.0010 false-claim; depth is an open trade |

### D04, whose trigger fired and which has now been measured

D04 sat in the table below for a while with "opens **now** — M0 has passed" written in its trigger
column, which is a contradiction in terms: a node in that table is one whose trigger has *not* been
met, and reading it in that column is how a met trigger goes unnoticed for a wave.

Its brief was the **attribution** failure Q4 measured — a true effect in `fast AND endgame` reported
as `fast` — and not the false-positive rate, which M0 measured at 0 validated false claims in 8,000
null records. The rejection rule was written down before the run: rejected unless it improves
correct attribution **without** raising the false-claim rate past 0.02.

**Both halves are met.** On `interaction-only` the search recovers `phase==endgame AND seconds<45`
exactly — the planted region, median Jaccard 1.000, on games it never saw — taking correct
attribution from **0% to 33.5%**, at a false-claim rate of **0.0010** on 4,000 null records against
the 0.02 ceiling. The shuffled-label control is 0.0006, which is what makes the rest readable.

What it costs is in the node: **depth is an unresolved trade** (depth 2 buys the interaction world
and loses power on the clean ones, and nothing measured says which a real record resembles), and two
inexpressible worlds stay at zero because the vocabulary has no selector for them.

### Not yet opened, and the trigger for each

Every row here has a trigger that is **not** currently met. A row whose trigger has fired does not
belong in this table — it belongs in the node table above, in whatever state it is really in.

| node | opens when |
| --- | --- |
| D06 stability selection | ~~a candidate search exists to be resampled~~ — **fired by D04**, and deliberately not opened: see below |
| D07 redundancy / MDL | family collapse leaves measurable redundancy |
| D10 online error control | the product needs to emit more than one claim per player |
| D12 sequential stopping | fixed-N power is the binding constraint, and null worlds clear it |
| D17 semantic chess features | the statistical mechanism is proven |
| D18 sequence mining | the static model is validated **and** its residuals show temporal dependence |

Each of these is `DEFER`, and none of them may be started to make an earlier one look better.

**D06's trigger has fired and D06 stays shut**, which is a decision rather than an oversight. D04
produced a candidate search, so one now exists to be resampled — and resampling a method whose
DEPTH is still an open trade would be measuring the stability of something nobody has chosen. D06
opens when D04's depth is settled, and that is its new trigger.
