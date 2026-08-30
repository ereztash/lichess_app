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
| [D09](D09-frozen-hypothesis-manifest.md) | what does freezing a hypothesis mean? | `PORT_AFTER_EQUIVALENCE` | decided |
| [D20](D20-protocol-matching.md) | what protocol may judge this claim? | `PORT_AFTER_EQUIVALENCE` | **mechanism decided, choice open** |

### Not yet opened, and the trigger for each

| node | opens when |
| --- | --- |
| D04 candidate search (`pysubgroup`) | M0 passes — Q3 is decided |
| D06 stability selection | a candidate search exists to be resampled |
| D07 redundancy / MDL | family collapse leaves measurable redundancy |
| D10 online error control | the product needs to emit more than one claim per player |
| D12 sequential stopping | fixed-N power is the binding constraint, and null worlds clear it |
| D17 semantic chess features | the statistical mechanism is proven |
| D18 sequence mining | the static model is validated **and** its residuals show temporal dependence |

Each of these is `DEFER`, and none of them may be started to make an earlier one look better.
