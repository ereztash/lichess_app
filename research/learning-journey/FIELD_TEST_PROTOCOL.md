# Field test protocol — can a cold user reconstruct the journey?

Minimal on purpose. This resolves one uncertainty and stops; it is not a research programme and it
builds no tooling.

## The claim under test

> A cold user, after one session on the built product, can state what the system is currently trying
> to learn about them, what they should do next, and what the next step will and will not tell them.

`OUTCOME`, resolution authority `FIELD`, required reality `R6`. Repository evidence cannot touch it:
everything in `IMPLEMENTATION_REPORT.md` is `R1`–`R3`.

## Why this one and not another

The R&D run named the open discriminator and the peers agreed on it from different directions: the
default architecture is a **legibility bet**, and nobody has checked whether legibility is the
binding constraint. Three mechanisms produce the owner's mentor's sentence equally well:

- **M1 legibility** — the journey exists and is not perceptible;
- **M2 payoff** — it is perceptible and too far away to be worth it;
- **M3 contract** — the user wants a product that prescribes, which the evidence forbids.

This test separates M1 from M2. It does not resolve M3, which is OWNER's.

It also discharges a standing gap: three cold users have used this product, two of them could not
complete the core move, that was repaired, and **no cold user has seen the repaired build**.

## Participants

Three to five people who play chess and have never opened this product. A person is cold once, so
nobody who has seen any earlier build is eligible, and nobody is run twice.

## Session

One sitting, no facilitation beyond the tasks. The facilitator does not explain the product, does
not answer "what does this mean", and records the question rather than answering it.

1. Open the product on a phone. Reach a position and record one decision through to the reveal.
2. Return to the front screen.
3. Answer the questions below, out loud, without scrolling back.

## Questions, and what each discriminates

Ordered so that a later question cannot teach the answer to an earlier one.

| # | question | discriminates |
| --- | --- | --- |
| 1 | What do you think this product is trying to do for you? | value comprehension; M3 if they describe a coach |
| 2 | What is it trying to learn about you right now? | whether `ACCUMULATING` reads as a state or as a wait |
| 3 | What would you do next, and why? | next-action clarity |
| 4 | There is a number on that last screen. What is it counting? | **the construct test.** A number whose construct cannot be restated is a bare number |
| 5 | What has this product learned about you so far? | whether "nothing yet" is heard as an answer or as a failure |
| 6 | What has it **not** proven? | whether `notEstablished` is read at all |
| 7 | If you closed this now, what would you expect to happen next time? | M1 vs M2: a clear expectation plus no intention to return is **M2** |
| 8 | *(only if they wrote a goal)* Is the app measuring how close you are to that? | **the denominator test.** "Yes" falsifies the safeguard regardless of what the code computes |

## Observable success criteria, declared before anyone is run

Task success, scored from the recording rather than from impression:

- **T1** the decision is committed and revealed without help. *(This is the one that failed twice.)*
- **T2** on Q4, the participant names the construct — decisions the search counts — rather than
  "how far along I am" or "my score".
- **T3** on Q6, the participant names at least one thing the product has not established.
- **T4** on Q8, the participant says the app is **not** measuring distance to their goal.

## Decision rule, fixed before the run

| result | reading |
| --- | --- |
| T1 fails for anyone | stop. Everything downstream is about a product they cannot use |
| T2 or T3 fails for most | **M1 confirmed.** Legibility is binding and the slice did not achieve it. The architecture stands; the rendering does not |
| T2 and T3 pass and Q7 shows no intention to return | **M2.** Legibility is not binding, time-to-value is, and the next work is the first session rather than the ledger |
| T4 fails for anyone | the goal is functioning as a denominator in perception. Remove the goal note, and treat `GATE-GOAL-NOT-A-DENOMINATOR` as necessary but not sufficient |
| all pass | the slice did what it claimed. The next uncertainty is whether it changes behaviour, which is a different and much more expensive study |

**A weak result is a result.** It is not a licence to add explanation until the answers improve: an
interface that needs a paragraph to be understood has failed the test the paragraph would hide.

## What this cannot establish

That the product helps anyone play better. That is `CAUSALITY`, it is `FIELD`, and the mechanism
research states it is unreachable by the discovery pipeline under any result.
