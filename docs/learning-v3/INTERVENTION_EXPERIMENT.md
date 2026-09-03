# The minimal intervention experiment

```text
NOT ADMISSIBLE
```

**Blocker:** `BARRIER_DECISION.md` — `INSUFFICIENT_OPPORTUNITIES` for `RC-05 safe-promotion`, the
only rule class that passed both pre-human gates.

```text
trigger fires                                    0.206% of sampled positions
player declines                                  42.5%
declining costs >= 0.10 expected score            5.4%
------------------------------------------------------------------
a decision worth changing, per sampled position   ~4.7e-5
```

An arm comparison needs enough such decisions in each condition to separate them. At this rate, the
primary endpoint `ΔP(Y|X)` cannot be estimated at any feasible N, and the mandatory second term
`ΔP(Y|¬X)` is worse off still because the trigger-negative cell has to be sampled on the same terms.

**This is not a power calculation that came out unfavourable.** It is the frozen falsifier `F-E5-c`
firing on evidence gathered after it was written.

---

## What is not the blocker

Stated so that a later cycle does not repair the wrong thing.

* **Not the gates.** Gate A is `A-REVISION` and Gate B is `B-PASS`. The instrument works.
* **Not the packet form.** `F-E1-c` did not fire: `WHEN X → DO Y` is expressible for `RC-05` with a
  board-only cue and a move-property action, and `GATE-CUE-PLAYER-OBSERVABLE` now proves the cue
  half mechanically.
* **Not the outcome hierarchy.** Levels 0–6 stand as written; nothing reached Level 2.
* **Not recruitment cost.** Even with unlimited participants the endpoint is unmeasurable on this
  class, because the denominator is the game, not the person.

---

## The design that would have run, recorded and not executed

Kept because the next class will need it and because a design written after the data is a
description of the data.

| arm | content | what it isolates |
| --- | --- | --- |
| **Control** | past-error explanation only | the `F-E1-a` comparison: is `WHEN → DO` more than an explanation? |
| **A** | `WHEN X → DO Y` | the behavioural core |
| **B** | `WHEN X → DO Y` + one personal-evidence sentence | `F-E4-a/b/c`: is `WHY YOU` a learning mechanism or a trust layer? |
| **C** *(only if recognition is the barrier)* | `X vs X'` boundary, then `WHEN → DO` | `F-E2-a`: is the bottleneck upstream or downstream of recognition? |

**Primary endpoint** `ΔP(Y | X)` on uncued natural opportunities. **Mandatory beside it**
`ΔP(Y | ¬X)`; a rise in both is `CRITERION_SHIFT`, not success. Reported against the move-blind
floor — an agent picking uniformly among legal moves scores *d′* **0.80** on `RC-06`'s own
prescription sizes — never against zero.

**`B` requires shipping a deliberately weaker product to some players.** That is a real cost and it
is the price of the claim; `FALSIFICATION_REGISTER.md` §3 says so, and a report that skips it may not
use the word *learning*.

---

## What would make this admissible

In order. None is skippable and none needs a participant until the last.

1. **`C12` over all seventeen classes** — one search per trigger-positive item with a recorded human
   move, ~4,000 searches. It answers *what did declining cost?* for every class, which is what
   decided this one. `RC-02 recapture` first: base rate **12.2%**, sixty times `RC-05`'s, unaided
   human rate **.769**.
2. **A twin bank for whichever class survives `C12`.** Construction is engine-free; scoring is
   ~4,500 searches.
3. **The true per-game opportunity rate**, scanning every ply rather than three per game. No engine.
4. **Study D**, which needs people, and only then this file.

---

## What may not be written here

Per the mission's own rule, this file does not contain a design the evidence does not license. There
is no sample size, no allocation ratio, no stopping rule and no analysis model, because each would be
a number invented for a study whose primary endpoint has been shown to be unmeasurable on the only
class that reached this page.
