# B3 — N-of-1 timing intervention preregistration

Status: **FROZEN BEFORE THE FIRST PROSPECTIVE GAME**

Participant/account: `Erez281`

Purpose: test whether the historical B2 timing observation can be converted into a causal, actionable playing rule for the same player.

This is a prospective N-of-1 randomized crossover **pilot**, not a confirmatory causal claim.

## 1. Prior evidence being tested

B2 found that:

- the winning representation was `lichess encoding buckets` rather than raw seconds;
- the 200-game held-out spread was 8.27 percentage points, above its 4.35pp random-boundary null;
- raw-seconds held-out spread was 0.00pp;
- after holding `phase × standing` fixed, only `middlegame/winning` clearly survived (`n=629`, spread 10.32pp, null95 7.38pp).

The Lichess encoding boundaries are frozen in `research/b2/analyse.py`:

`[0.1, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 15, 20, 30, 40, 60]` seconds.

The historical result is observational. It does **not** establish that forcing faster play improves accuracy. This experiment tests that causal interpretation.

## 2. Hypothesis

Primary directional hypothesis:

> For Erez281, imposing an 8-second decision rule will increase post-hoc move accuracy specifically in eligible `middlegame/winning` decisions compared with normal play.

Formally:

`H1: Accuracy(Treatment | middlegame, winning) > Accuracy(Control | middlegame, winning)`

No causal effect size is inferred from the historical 8.27pp spread. That spread is not a treatment effect.

## 3. Game eligibility

A game consumes the next assignment in the frozen sequence iff it is:

- played on Lichess by `Erez281`;
- rated;
- standard chess;
- `180+0` (3+0) blitz;
- an ordinary rated blitz game, not an arena/tournament game;
- started after this preregistration commit.

Aborted games with no completed move by Erez do not consume an assignment. Otherwise the assignment is consumed even if the game is short, lost quickly, or contributes zero primary-outcome decisions.

## 4. Interventions

### C — Control

Play normally. Do not deliberately apply a move-time cap.

### T — Treatment: P8 rule

Beginning with Erez's **9th move**, apply this rule on every turn:

> Aim to choose and execute the move before 8.0 seconds of think time have elapsed. Do not deliberately continue searching for additional candidates after the 8-second boundary.

The player uses only the normal Lichess interface and clock. No engine, overlay, opening aid, external timer, extension, live analysis, or other external assistance may be used during a game.

A move taking >=8 seconds is recorded as treatment non-adherence; it does not cause exclusion from the intention-to-treat analysis.

The treatment is deliberately applied to all moves after move 8 because `phase` and `standing` must not be supplied by an engine during live play. The target `middlegame/winning` subset is identified only after the game by the existing offline analysis pipeline.

## 5. Frozen randomized crossover sequence

Randomization seed: `20260901`.

Randomization unit: pairs of consecutive eligible games. Each pair contains exactly one C and one T, with order randomized.

This balances treatment over time while allowing Erez to serve as his own control.

| Game | Arm | Game | Arm | Game | Arm |
|---:|:---:|---:|:---:|---:|:---:|
| 1 | C | 21 | T | 41 | T |
| 2 | T | 22 | C | 42 | C |
| 3 | T | 23 | T | 43 | C |
| 4 | C | 24 | C | 44 | T |
| 5 | C | 25 | T | 45 | C |
| 6 | T | 26 | C | 46 | T |
| 7 | C | 27 | T | 47 | C |
| 8 | T | 28 | C | 48 | T |
| 9 | T | 29 | T | 49 | T |
| 10 | C | 30 | C | 50 | C |
| 11 | C | 31 | C | 51 | C |
| 12 | T | 32 | T | 52 | T |
| 13 | C | 33 | T | 53 | T |
| 14 | T | 34 | C | 54 | C |
| 15 | C | 35 | C | 55 | C |
| 16 | T | 36 | T | 56 | T |
| 17 | T | 37 | T | 57 | C |
| 18 | C | 38 | C | 58 | T |
| 19 | T | 39 | C | 59 | C |
| 20 | C | 40 | T | 60 | T |

Equivalent sequence:

`CTTCCTCTTCCTCTCTTCTCTCTCTCTCTCCTTCCTTCCTCTCTTCCTTCCTCTCTCT`

## 6. No-peeking rule

The B3 intervention, 8-second boundary, target cell, primary outcome, and analysis rule must not be changed based on interim outcomes.

Do not run engine review of the experimental games for the purpose of modifying the rule before game 60 is complete. If games are viewed for unrelated reasons, no B3 threshold or outcome definition may be changed.

There is no early stopping for apparent benefit.

## 7. Existing offline scoring path

After the games, use the same repository path as B2 where applicable:

- `scripts/run_import_harness.ts`
- Stockfish 18 Lite WASM through `tools/sf-wasm-stdio.js`
- import depth 12
- existing forced/book/time filters
- existing `accurate`, `phase`, and `standing` definitions

No live engine information is used.

## 8. Primary outcome and estimand

Primary analysis set:

- decisions from the 60 randomized eligible games;
- pass the existing B2 forced/book/time eligibility filters;
- Erez's move number >= 9;
- post-hoc `phase == middlegame`;
- post-hoc `standing == winning`.

Primary outcome: existing binary `accurate` outcome.

Primary estimand, intention to treat:

`Delta = mean(accurate | assigned T) - mean(accurate | assigned C)`

The randomized **game-pair** is the assignment structure. Inference must preserve that structure: labels are swapped only within randomized pairs for randomization/permutation inference. Decisions must not be treated as independently randomized observations.

Primary result must report:

- eligible target decisions in T and C;
- accuracy in T and C;
- `Delta` in percentage points;
- uncertainty from pair-preserving randomization inference and/or game-cluster bootstrap;
- all protocol deviations.

## 9. Manipulation check

The causal test is only interpretable if assignment actually changes timing behavior.

For all eligible decisions from Erez move 9 onward, report:

- median `secondsTaken` by arm;
- proportion with `secondsTaken >= 8` by arm;
- full Lichess-bucket distribution by arm.

Pre-specified adherence gate:

`P(secondsTaken >= 8 | T) <= 0.70 * P(secondsTaken >= 8 | C)`

If this gate fails, the pilot is classified **MANIPULATION FAILED**. The accuracy comparison may still be reported, but it is not treated as a valid test of the P8 causal hypothesis.

## 10. Secondary outcomes

Report without promoting them to the primary result:

- centipawn-loss distribution;
- mistake/blunder rate using existing repository definitions if available;
- conversion from post-hoc winning middlegame positions to final game win;
- final game result;
- clock remaining;
- treatment/control timing distributions over chronological game number, to inspect contamination/carryover.

## 11. Pilot decision rule

This 60-game run is a feasibility/causal-direction pilot.

- If the manipulation gate passes and `Delta > 0`, preregister a larger confirmatory run using the **same P8 rule** before adding those games.
- If the manipulation gate passes and `Delta <= 0`, the current causal interpretation is weakened; do not rescue it by moving the 8-second boundary after seeing the result.
- If the manipulation gate fails, redesigning the intervention is allowed only in a new preregistration; the failed manipulation remains part of the evidence record.

No result from this pilot may be described as a universal law or as evidence that the rule generalizes to other players.
