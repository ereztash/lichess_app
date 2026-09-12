# The player path — the process that survived falsification

This is **not** a second state machine. `research/learning-journey/PRODUCT_STATE_MACHINE.md`
describes the lifecycle of a *learning object* (a claim, a rule) and is unchanged. This describes the
path of a *person*, and the two are deliberately at different levels: a state belongs to an object,
never to the player.

## The one-sentence form

> State a belief before the engine speaks. That produces a kind of evidence a played game cannot
> contain. Everything else the product does is downstream of that exchange, and none of it is
> promised.

Every clause is checkable. None of it predicts a result.

## Why this and not a goal

A process that begins at a goal begins at rating, because that is what a chess player's stated
aspiration is. A process that begins at an **exchange** begins at something the product actually
controls and can honour on the first decision. The exchange is also the true competitive boundary:
Chess.com analysis, Lichess analysis, puzzles and Aimchess all operate on games already played, and
a played game carries no confidence stated before the engine spoke.

## The path

```text
  P0  ARRIVAL
      offered: an exchange, stated as evidence type. Not a promise of a finding.
      forbidden: any statement about what will be found, any rating frame.
        │
        │  the player records one decision
        ▼
  P1  FIRST PAYOFF                                       ← n = 1, no claim attached
      the distance between the belief stated before the engine spoke and the board,
      labelled by which kind of evidence produced it (process / engine).
      This is already shipped. It does not wait for anything.
        │
        │  decisions accumulate
        ▼
  P2  THE INSTRUMENT'S WAIT                              ← unit: revealed decisions
      named as the instrument's need, with its own denominator, never as the
      player's progress and never beside a goal.
        │
        ├── an import happens here for players with history ───────────┐
        │                                                              │
        ▼                                                              ▼
  P3  THE INSTRUMENT ANSWERS                              IMPORT: move accuracy only.
      three terminal states, all legitimate:              An import cannot produce a
        (i)   not enough decisions   → silence + distance  calibration gap, and that
        (ii)  enough, nothing separated → an answer        is the reason P1 exists.
              about the instrument, not the person
        (iii) something separated → a claim, with scope
        │
        │  only from (iii)
        ▼
  P4  THE LEARNING OBJECT'S LIFECYCLE
      claim → rule → guided practice → prompted recall → unprompted play.
      Three constructs, never merged. Already shipped and gated.
        │
        ▼
  P5  OUTCOME
      never asserted. FIELD authority, R6. No surface claims it.
```

## The load-bearing property: P4 is optional

**The path must work when P3 lands permanently on (ii).** That is the mission's §9 and the telos's
success condition, and it is the single test most candidate processes fail.

It works because the value is delivered at **P1**, not at P4:

| state | what the player has | does it depend on a pattern? |
| --- | --- | --- |
| after one decision | the belief-versus-board distance, labelled by evidence kind | no |
| after sixty, nothing separated | the above, sixty times, plus an honest instrument answer | no |
| after sixty, something separated | the above, plus a claim with its scope | yes |

A player who never reaches P4 has lost nothing they were promised, because nothing about P4 was
promised. That is the whole reason the arrival frame is an exchange.

## What each stage may say, and may not

| stage | may say | may not say |
| --- | --- | --- |
| P0 | what kind of evidence this produces, and that a played game cannot contain it | that a pattern will be found; anything rating-shaped |
| P1 | the distance, its basis, which evidence kind produced it | that the distance is improving |
| P2 | how many decisions the instrument needs, and how many are counted | the wait as the player's progress; the wait beside a goal |
| P3 (ii) | "enough decisions, and none of the six types this instrument checks separated. That is about it, not about you." | "you have no pattern" |
| P3 (iii) | the claim and its scope | that acting on it will improve anything |
| P4 | which construct each result belongs to | prompted performance called transfer |
| P5 | nothing | everything |

## Where the mentor signal lands, honoured and bounded

`you built feedback, you have not built a KPI` is preserved verbatim as a raw signal and is **not**
resolved to one meaning. It carries at least three live readings:

- (a) a missing user contract stating what the product is trying to do for this person;
- (b) a missing visible unit of progress;
- (c) an unacceptable cost to first payoff.

This lane answers **(a)** at P0 and **(c)** by naming the payoff that already exists at P1. It
refuses **(b)** as stated, because the only unit that would satisfy it in the mentor's own framing
is rating, and no denominator exists. That refusal is a claim-boundary decision, not a disagreement
about the product's direction.

## Reversal conditions

The path changes if any of these turn out otherwise:

- P1's payoff is not in fact legible to a cold user as distinct from engine analysis → P0's exchange
  frame is selling something the screen does not deliver, and the front-half build was too small.
- Cold users' unprompted account of what the product is for does not mention stating a belief before
  the engine → the exchange is not what arrives, whatever the copy says.
- The core move still does not complete after the repair → nothing above P1 matters yet.

All three are `FIELD` at R6 and none is asserted here. They are the protocol in
`FIELD_TEST_PROTOCOL.md`.
