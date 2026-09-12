# The telos chain

The current promise, not an aspirational one. The claim boundary stands: Decision Lab does not
establish chess improvement, rating improvement or intervention efficacy, and its own published
refusal list says *"לא ימליץ מה ללמוד, הוא מודד, לא מאמן."*

| Edge | State | Evidence |
|---|---|---|
| USER TELOS → PRODUCT PROMISE | **implemented** | The front door promises to separate what a move cost from what happened on the way to choosing it. `GoalNote` keeps the player's own telos and says explicitly that no number here measures distance to it |
| PRODUCT PROMISE → PRODUCT MECHANISM | **implemented** | Commit before verdict. The mechanism is the promise |
| PRODUCT MECHANISM → MEASUREMENT ACTION | **implemented** | Move, submit, sampled confidence, coupled reads, sampled probe |
| MEASUREMENT ACTION → EVIDENCE | **implemented and supported** | Rows carry purpose, confidence, scale, grid version, engine identity; `scoreDecisions` excludes rather than defaults |
| EVIDENCE → INTERPRETATION, per decision | **implemented and supported** | The reveal. Cost, alternative, inference limits, a question. Every time |
| EVIDENCE → INTERPRETATION, across decisions | **field-dependent and research-dependent** | Needs 60 scored. Never reached in any walk. The product states the floor and states that the result would be a hypothesis |
| INTERPRETATION → USER ACTION | **absent in the reachable build** | The reveal ends in a question addressed to the player and stored nowhere. The product deliberately does not recommend what to learn |
| USER ACTION → LEARNING | **absent** | `EXPERIMENTAL_LEARNING_ENABLED` off; the composer's strings are not in the bundle |
| LEARNING → TRANSFER | **absent** | same flag |
| TRANSFER → OUTCOME | **absent, and refused by claim boundary** | `D25` reached `CONSTRUCT-UNDERIDENTIFIED`; outcome resolves to FIELD and is out of reach under any result the discovery pipeline can produce |

## Where the chain breaks

It breaks in **two different places, and conflating them is the main analytical hazard.**

**Break 1, at `INTERPRETATION → USER ACTION`.** This is the flag boundary. Everything downstream is
built, tested and turned off by a decision the repository recorded and defended. A player who
completes everything reachable ends holding an interpretation and no next act the product will name.

**Break 2, earlier, at `EVIDENCE → INTERPRETATION across decisions`.** The cross-decision reading
needs 60 scored decisions and no walk has produced more than 1. This break is **not** the flag: it
is reachable in principle and nothing but accumulation stands in the way.

**The per-decision branch does not break at all.** `EVIDENCE → INTERPRETATION` is closed, immediate
and differentiated on every single decision, and that is why the value-debt map shows zero debt on
the core loop.

So the honest statement of where `User Goal → ... → User Value` currently stops:

```text
User goal
  -> promise         OK
  -> mechanism       OK
  -> measurement     OK
  -> evidence        OK
  -> interpretation  OK per decision, NOT REACHED across decisions
  -> user action     ABSENT (flag)
  -> learning        ABSENT (flag)
  -> transfer        ABSENT (flag)
  -> outcome         REFUSED (claim boundary, D25)
```

Value returns to the player's telos **once per decision and not once per journey.** The product
pays continuously in small, honest, differentiated amounts, and has no reachable terminal payoff at
all.
