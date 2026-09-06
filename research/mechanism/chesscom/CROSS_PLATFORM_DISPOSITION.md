# Chess.com historical pre-learning replication — disposition

Status: `PARTIAL_CROSS_PLATFORM_REPLICATION`

Source protocol: `CROSS_PLATFORM_PREREG.md`  
Raw result: `CROSS_PLATFORM_RESULT.json`  
Workflow run: `33992527252` — success

No threshold, target, time-control subset, provenance definition, or board predicate was changed after the outcome was read.

## BLUF

The **broad frozen R** board region transfers to the separate historical Chess.com corpus in the predicted direction. The narrower **persistent → unresolved again** localization is also directionally consistent, but this corpus has only six persistent+resolved comparison opportunities, so it does **not** independently validate that narrower mechanism.

Therefore:

- cross-platform evidence for the under-defended / level-or-slightly-ahead risk region: **SUPPORTED WITH ELIGIBILITY CAVEAT**;
- cross-platform evidence specifically for repeated non-resolution of a persistent liability: **INSUFFICIENT CROSS_PLATFORM SUPPORT — DIRECTIONALLY CONSISTENT, TOO SPARSE**;
- time-allocation, cognitive-cause, intervention, and same-rating personal-residual claims: **NOT TESTED**.

## Frozen corpus actually executed

- 50 historical Chess.com games supplied by the owner;
- focal account: `ereztal-shir`;
- 48 predeclared blitz games admitted: 21 × 180 seconds, 27 × 300 seconds;
- 2 × 600-second games excluded before outcome;
- 1,040 board-eligible focal decisions after the predeclared not-forced / not-book filter;
- 142 frozen R** opportunities;
- 2,070 Stockfish positions scored;
- zero parse errors.

The source contains no per-move clocks. This is consequently a board-only external replication, not an exact reproduction of the Lichess decision-eligibility frame.

## Q1 — Does frozen R** transfer?

**Yes, in the preregistered direction.**

Across the Chess.com corpus, the within-game hung-material contrast for the unchanged R** predicate was:

- estimate: **+9.43 percentage points**;
- SE: 2.89 pp;
- z = **3.27**;
- 142 R** decisions vs 898 outside-region board-eligible decisions;
- 39 games contributed paired inside/outside information.

This is independent of the Lichess game corpus and was not used to discover or tune R**.

### Predeclared time-control strata

They are reported, not selected:

- 180-second games: +3.79 pp, z=0.75, 49 R** opportunities;
- 300-second games: +12.37 pp, z=3.73, 93 R** opportunities.

The 180-second stratum is not discarded or used to retune the claim. The overall predeclared frame remains the deciding reading.

## Q2 — Does `PERSISTENT + UNRESOLVED AGAIN` transfer?

The direction matches the Lichess localization, but the comparison is too sparse to count as an independent validation.

Within frozen R** opportunities:

- `PERSISTENT + UNRESOLVED`: n=24, hung-material rate **33.33%**;
- `PERSISTENT + RESOLVED`: n=6, hung-material rate **16.67%**;
- point difference: **+16.67 pp**;
- game-bootstrap 95% interval: **[-20.0 pp, +47.6 pp]**;
- bootstrap share above zero: 85.3%.

The preregistration explicitly said that a sparse persistent-resolved comparison must return `INSUFFICIENT_CROSS_PLATFORM_SUPPORT` rather than trigger a rescue search. Six comparison events are too few to claim replication of the narrower interaction.

A secondary frozen comparison is also directionally consistent but inconclusive:

- persistent+unresolved: 33.33% (n=24);
- non-persistent+unresolved: 19.64% (n=56);
- difference: +13.69 pp;
- 95% bootstrap interval crosses zero.

## What this changes

Before this run, R** and the repeated-non-resolution localization were both learned from the Lichess ecosystem.

After this run, we have evidence that the **pre-move board region itself is not confined to Lichess**: the same unchanged predicate identifies elevated hung-material risk in an earlier Chess.com corpus.

That materially weakens explanations based only on a Lichess-specific interface, rating pool, or one historical Lichess window.

It does **not** establish that the exact magnitude is platform-invariant, nor that Chess.com and Lichess ratings represent the same skill level.

## What this does not change

The following remain forbidden:

- claiming the Chess.com result revalidates the +6.14 pp same-rating Lichess population residual;
- claiming persistent non-resolution is independently cross-platform validated;
- inferring attention, tunnel vision, awareness, calculation depth, or motivation;
- making any time-management claim from this PGN;
- claiming the frozen intervention works.

The Lichess `PRE_FIELD_STATE_FROZEN` comparator and L6 field protocol are unchanged.

## Decision

`STOP_CROSS_PLATFORM_RESCUE_SEARCH`

Do not search this 50-game Chess.com corpus for a better threshold or a different mechanism. The broad board-region transfer has answered Q1. Q2 remains underpowered because the necessary resolved-persistent control cell is small. More information for Q2 must come from a larger independently declared historical corpus or future field data, not post-hoc slicing of this one.
