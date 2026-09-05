# R** mechanism localization — repeated non-resolution of a persistent liability

Status: `POST_HOC_EXPLANATORY_LOCALIZATION`

This document deposits the result of the retrospective mechanism decomposition executed after the
frozen R** finding. It does **not** alter R**, the product, thresholds, detector semantics, or the
frozen field protocol.

## Provenance

- repository: `ereztash/lichess_app`
- branch: `research/rstarstar-mechanism-decomposition`
- execution commit: `575e85561525ea2b68e56fbf9cf3140b496af525`
- workflow: `Mechanism Provenance`, run `33981610437`
- original R** exact frame reproduced before interpretation:
  - VALIDATE blitz decisions: 9,589
  - R** decisions: 1,199
  - original population-residual within-game estimate: 0.0614415819
  - z = 4.5202284
- reconstruction integrity: rebuilt under-defended-piece counts agree 100% with the committed
  decision-table feature for both owner and population.

## Question

Where did the under-defended liability exist in the decision sequence, and does that location explain
the owner's personal R** residual?

Pre-move provenance classes:

- `OPPONENT_CREATED`: opponent's immediately preceding move created the liability.
- `SELF_CREATED_PREVIOUS`: the owner's previous move created the liability; it survived the
  opponent reply.
- `PERSISTENT`: the liability already existed before the owner's previous move and is still present
  at the current decision.
- `MIXED`: multiple current liabilities have different provenance.

Post-move action signature:

- `CURRENT_MOVE_UNRESOLVED`: the current move again leaves an already-present liability
  under-defended. This is descriptive and cannot be used as a pre-move trigger.

## Result 1 — provenance alone does not explain R**

Adding only `provenance_profile` to the same-rating population model changes cross-validated AUC
from 0.764650 to 0.764855 and reduces the owner's R** residual from 6.144 pp to 5.881 pp.

Only ~4.29% of the original residual is removed. Therefore, *where the liability came from* is not a
sufficient explanation of R**.

## Result 2 — the personal excess localizes to persistent liabilities

| provenance | owner n | owner hung-material rate | owner population-model residual | population hung-material rate |
| --- | ---: | ---: | ---: | ---: |
| OPPONENT_CREATED | 658 | 17.33% | +3.09 pp (z≈2.07) | 14.49% |
| SELF_CREATED_PREVIOUS | 126 | 15.87% | +2.20 pp (z≈0.69) | 17.73% |
| PERSISTENT | 305 | 24.92% | **+10.41 pp (z≈4.26)** | 15.93% |
| MIXED | 110 | 26.36% | +7.52 pp (z≈1.61) | 24.32% |

The `OPPONENT_CREATED` family is the majority of opportunities but not the dominant personal
residual. `SELF_CREATED_PREVIOUS` does not carry a reliable personal excess. The largest stable
localization is `PERSISTENT`.

## Result 3 — the relevant observable process is repeated non-resolution

A single post-hoc interaction was tested because Result 2 earned it:
`PERSISTENT × CURRENT_MOVE_UNRESOLVED`.

### Exact cells

| state | owner hung rate | population hung rate |
| --- | ---: | ---: |
| non-persistent, resolved by current move | 6.10% (n=443) | 5.86% (n=1,844) |
| non-persistent, unresolved by current move | 30.16% (n=451) | 25.49% (n=1,938) |
| persistent, resolved by current move | 8.96% (n=67) | 5.04% (n=278) |
| **persistent, unresolved again** | **29.41% (n=238)** | **19.68% (n=808)** |

Contrasts:

- owner persistence penalty: +6.685 pp;
- population persistence penalty: +0.013 pp (approximately zero);
- difference-in-differences for persistence: **+6.673 pp**;
- within persistent liabilities, owner unresolved-vs-resolved penalty: +20.457 pp;
- population unresolved-vs-resolved penalty: +14.642 pp;
- excess unresolved penalty for owner: **+5.814 pp**.

The population-model residual in the owner's `PERSISTENT + UNRESOLVED` cell is +14.90 pp
(z≈5.02). In `PERSISTENT + RESOLVED`, it is -5.55 pp (z≈-1.61).

## Current permitted explanation

The strongest supported behavioral explanation is:

> The personal R** excess is concentrated when an under-defended piece remains a live liability
> across more than one of the owner's own decision cycles and the next move still does not close it.

Operationally:

`PERSISTENT LIABILITY → CURRENT MOVE AGAIN FAILS TO RESOLVE → elevated hung-material risk beyond the same-rating population`

This is an observable decision-process localization, not a cognitive diagnosis.

## What this weakens

### Simple opponent-update failure

If the dominant personal problem were failure to notice a newly-created opponent threat, the
personal residual should concentrate in `OPPONENT_CREATED`. It does not.

### Simple self-created exposure

`SELF_CREATED_PREVIOUS` does not carry a reliable positive personal residual and its owner raw rate
is not above the population reference.

### Simple time-pressure / rushing account

The `PERSISTENT + UNRESOLVED` owner cell has median think time 3.2 s and median clock fraction 0.81;
the population comparison is 3.0 s and 0.77. This does not support a simple "less time / lower clock"
account. No causal time claim is made.

### Simple forcing-move priority override

Owner forcing-move rate in `PERSISTENT + UNRESOLVED` is 25.2% versus 33.2% in the population.
Checks/captures therefore do not support a simple "you chase forcing moves instead of fixing it"
account. This proxy is narrow and does not rule out broader valuation tradeoffs.

## Claim boundary

Permitted:

- persistent liability;
- repeated non-resolution;
- current move leaves an existing liability unresolved;
- excess hung-material risk relative to same-rating population;
- the historical localization numbers above.

Not permitted from these data:

- "tunnel vision";
- "you did not see it";
- attention failure;
- calculation-depth failure;
- rushing as a cognitive cause;
- motivation or valuation state;
- a claim that the frozen instruction will reduce errors.

The follow-up is post-hoc on the same VALIDATE frame and is **not an independent validation set**.
It localizes the behavioral mechanism; it does not upgrade the intervention to L6.

## Decision

`STOP_HISTORICAL_COGNITIVE_INFERENCE`

The existing historical game record can support further geometric descriptions, but it cannot
cleanly distinguish awareness, attention, valuation, or calculation as the cognitive cause of the
repeated non-resolution. The next decision-changing evidence for that layer must come from FIELD or
a controlled instrument.

The already-frozen L6 field protocol remains unchanged. This post-hoc finding must not be used to
rewrite its threshold, cue, denominator, or stopping rule after exposure.
