# Chess.com historical pre-learning cross-platform replication — preregistration

Status: `FROZEN_BEFORE_OUTCOMES`

## Purpose

Test whether the already-defined Lichess board-level R** / repeated-non-resolution mechanism transfers to a separate historical Chess.com corpus that the owner states predates learning from the current research.

This is **not** part of the Lichess pre-field freeze, post-freeze lane, quarantine gap, or L6 intervention experiment. It is a separate historical pre-learning corpus and an external platform/context replication.

## Frozen source identity

- source file: `chess_com_games_2026-09-06.pgn`
- SHA-256: `ae40fa2bd655a49b32aabd146f960ac6e2cf771452cf05a6ee4bc22b7ca646ca`
- focal account in PGN: `ereztal-shir`
- total games: 50
- source dates: 2026-02-21 through 2026-09-05
- time controls: 21 × 180, 27 × 300, 2 × 600
- selected replication frame: the 48 games at 180 or 300 seconds; the two 600-second games are excluded before any outcome is read.
- the PGN contains no per-move `%clk` or `%emt` annotations.

## Necessary eligibility deviation

The original Lichess research frame requires an observed clock and think time for a decision. This Chess.com export does not contain them. Therefore the exact Lichess eligibility predicate cannot be reproduced.

This run is frozen as `BOARD_ONLY_CROSS_PLATFORM_REPLICATION__CLOCK_NOT_OBSERVED`:

- preserve exclusion of forced positions;
- preserve exclusion of opening-book positions using the same frozen book-key set;
- do **not** synthesize or impute clocks / think time;
- do not make any time-allocation claim from this corpus.

A surviving result may support cross-platform transfer of the **board-level mechanism** only. It is not an exact validation of the original clock-conditioned R** frame.

## Frozen construct and outcome

No search or threshold fitting is permitted on Chess.com.

### R** trigger

Exactly as already defined on Lichess:

`material_balance in [0,3) AND own_overloaded_piece_count >= 1`

where an own non-king piece is `overloaded / under-defended` iff:

`enemy_attackers > 0 AND enemy_attackers > own_defenders`.

### Provenance states

Unchanged:

- `OPPONENT_CREATED`
- `SELF_CREATED_PREVIOUS`
- `PERSISTENT`
- `MIXED / UNKNOWN`

### Post-move action signature

`CURRENT_MOVE_UNRESOLVED` means a liability already present before the current move remains under-defended after that move, tracking the moved liability to its destination. It is descriptive and is never a pre-move trigger.

### Primary outcome

`hung_material`, using the same research semantics:

1. the played move exceeds the canonical win-probability-loss error threshold;
2. the engine-best reply is a capture;
3. static exchange evaluation of that reply wins at least one pawn-equivalent.

## Frozen engine regime

- Stockfish 17.1 native
- depth 12
- MultiPV 3 before the focal move
- MultiPV 1 after the focal move for best reply
- Threads 1
- Hash 16
- fresh engine game/hash context per analysed position

## Questions — fixed before outcomes

Primary Q1: **Does the frozen R** region carry a positive within-game hung-material contrast on the Chess.com historical pre-learning corpus?**

Primary Q2: **Within Chess.com R** opportunities, is hung-material risk higher for `PERSISTENT + CURRENT_MOVE_UNRESOLVED` than for `PERSISTENT + RESOLVED_CURRENT_MOVE`?**

Secondary, reported without promotion:

- compare `PERSISTENT + UNRESOLVED` with `NON-PERSISTENT + UNRESOLVED`;
- report the same quantities separately for 180 and 300 second games.

Inference:

- game is the resampling unit;
- 5,000 game-level bootstrap replicates;
- fixed seed `20260906`.

## Failure / stop rules

A null, reversed, or sparse result is retained as the result. After reading outcomes, do **not** rescue the hypothesis by:

- changing the material interval;
- changing attacker/defender semantics;
- changing error threshold;
- changing target class;
- dropping a time control;
- selecting openings/colors/phases;
- adding Chess.com-specific thresholds.

If the key persistent-resolved cell is too sparse for a useful contrast, the verdict is `INSUFFICIENT_CROSS_PLATFORM_SUPPORT`, not a new search.

## Claim boundary

Even if the result survives, this corpus cannot independently establish the original same-rating **personal residual**, because Chess.com ratings and pool are not interchangeable with the Lichess population reference. It can establish or fail to establish transfer of the already-frozen **board-level repeated-non-resolution pattern** across platform/history.

Forbidden from this run:

- time-management claims;
- attention / awareness / tunnel-vision claims;
- calculation-depth claims;
- intervention effectiveness;
- treating Chess.com rating as directly equivalent to Lichess rating.
