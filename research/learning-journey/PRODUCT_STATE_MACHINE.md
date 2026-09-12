# The product state machine

Implementation-grade. Every state below is a fact the repository can compute from data it already
records. **Every visible reading names its construct and its denominator**, and no two constructs
share a number.

## What a state belongs to

A state belongs to a **learning object**, never to the player.

| object | cardinality | source |
| --- | --- | --- |
| claim | one shown, `othersWithheld` counted | the six-bucket detector |
| rule | **plural and concurrent** | authored by the player after a reveal |

The player-scoped scalar (`loopPosition`) is retained and is **not** a progress meter: it answers
"what should I do now", which is singular by nature. It is a pointer, not a position on a track.

## The stages

```text
                     ┌──────────────────────────────────────────────┐
                     │  the record accumulates (no object yet)      │
                     └───────────────────┬──────────────────────────┘
                                         │ floor met
                     ┌───────────────────▼──────────────────────────┐
   NOTHING_SEPARATED ◄──── detector found no bucket over the bar ────┤ detector runs
                     └───────────────────┬──────────────────────────┘
                                         │ a bucket separated
                                   ┌─────▼─────┐
                                   │ CANDIDATE │  a claim exists
                                   └─────┬─────┘
                                         │ the player answers `would_choose_again`
                                 ┌───────▼────────┐
                                 │ CONTEXT_CHECKED│  the diagnosis is judged, not assumed
                                 └───────┬────────┘
                                         │ a rule is authored
                        ┌────────────────▼─────────────────┐
                        │ PRACTISED  (drill, prompted)     │
                        └────────────────┬─────────────────┘
                                         │ a delayed retrieval test is sat
                        ┌────────────────▼─────────────────┐
                        │ PROMPTED_CHECK  (maximum transfer)│
                        └────────────────┬─────────────────┘
                                         │ ordinary play continues
                        ┌────────────────▼─────────────────┐
                        │ WATCHED_IN_PLAY (typical transfer)│
                        └────────────────┬─────────────────┘
                        REFUTED ◄────────┴────────► RETIRED
```

`OUTCOME` **is not a state.** External rating is an observed series with no edge into this machine.

## The table the UI renders from

| stage | the question it answers | construct | denominator | floor | authority |
| --- | --- | --- | --- | --- | --- |
| `ACCUMULATING` | what are we trying to learn about me? | revealed decisions | `scored / MIN_BUCKET_N*2` | — | REPO |
| `NOTHING_SEPARATED` | did the instrument find anything? | **the instrument's result**, not the player's quality | `scored` | 60 | REPO |
| `CANDIDATE` | what did it find? | separation of one bucket | `n inside` / `n outside` | 30 each | REPO |
| `CONTEXT_CHECKED` | do I agree it was an error? | the player's own judgement | 1 decision judged | 1 | OWNER (the player) |
| `PRACTISED` | can I do it when the position is handed to me? | drill positions | `completed / total` | — | REPO |
| `PROMPTED_CHECK` | can I do it when reminded, later? | **maximum transfer** | `passed / asked` | 2 of 3 | REPO |
| `WATCHED_IN_PLAY` | do I do it when nobody reminds me? | **typical transfer** | decisions in scope since the rule / before it | 30 each side | REPO |
| `REFUTED` | did my own refutation condition fire? | the condition the player wrote | as written | — | REPO |
| `RETIRED` | did I close this? | an act | — | — | OWNER |

## The three separations that must never collapse

1. **PRACTISED ≠ PROMPTED_CHECK ≠ WATCHED_IN_PLAY.** Guided practice, cued retrieval and unprompted
   play are three different constructs. The transfer literature's *typical vs maximum* split is the
   name for the last two: maximum is what the player **can** do when prompted, typical is what they
   **do** when not. The product previously called the prompted test "transfer".
2. **The instrument's silence ≠ the player's flatness.** `NOTHING_SEPARATED` is a statement about
   the six-bucket detector, which returns `not-separable` on the owner's own 2,209-game record while
   a validated research pipeline finds a permutation-surviving residual on that same record. The
   sentence must be scoped to the instrument.
3. **A goal ≠ a denominator.** The goal is stored and rendered as framing copy. It may not be
   rendered adjacent to any count, and a gate enforces the adjacency rather than trusting the
   intention.

## What cannot be measured, and the honest transitional state for it

| wanted | why it cannot be measured | what is shown instead |
| --- | --- | --- |
| did the app improve my rating | `OUTCOME` is FIELD and causality is unreachable by this pipeline under any result | the rating series, unattributed, on its own axis, never beside a stage count |
| is this pattern personal to me | `SPECIFICITY` needs a same-rating population baseline the product does not ship, and the instrument-vs-population confound (Q2) is open | the claim's scope and its `n` inside and outside, and nothing about other players |
| did my rule cause the change | `CAUSALITY` is FIELD | both denominators, before and after, with the non-attribution stated in the reading |

## The procedural prescription the product is allowed to make

Not "do this and you will improve". This:

> Here is what this product will do with you next, and what it will then be able to say.

Every stage therefore renders its own **next act** and its own **what this will then tell you**.
That is a contract about the product's behaviour, resolvable by OWNER, requiring no INTERVENTION
claim, and it is the only part of the mentor's managed-effort signal that the evidence licenses.
