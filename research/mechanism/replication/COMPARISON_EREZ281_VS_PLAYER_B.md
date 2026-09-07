# Method-level comparison

Not a search for the same pattern in two people. If a personal residual is genuinely
personal it should not recur, so recurrence is not the success criterion. What is compared
is what the frozen pipeline could DECIDE for each player.

| Dimension | lichess/erez281 | lichess/vibesgalore |
| --- | --- | --- |
| admissible games | 2161 | 358 |
| eligible decisions | 52881 | 11425 |
| DERIVE / VALIDATE / TEST decisions | 31851 / 10626 / 10404 | 6977 / 2275 / 2173 |
| stable structure found? | yes | no |
| region | `material_balance>=-2 AND own_overloaded_piece_count>=1` | — |
| VALIDATE within-game | +11.5 pp | — |
| VALIDATE residual z | 8.56 | — |
| survives holdout (TEST)? | yes | not opened |
| TEST rate in / out | 24.1% / 13.6% | — |
| TEST shuffled-label p | 0.0 | — |
| explained by population? | +11.0 pp | not reached |
| focal percentile among peers | 62th | — |
| population-baseline search run? | yes, on cls_hung_material and cls_tactical | yes, on cls_hung_material and cls_tactical |
| residual candidates passing the judge | 4 | 0 |
| best residual z seen (bar 3.5) | 4.52 | 2.29 |
| best broad residual z seen (bar 3.5) | 8.56 | 1.81 |
| residual remains? | yes | no |
| class decided at | the residual stage | the broad stage: no region passed the VALIDATE judge |
| residual region | `material_balance: [0:3[ AND own_overloaded_piece_count>=1` | — |
| residual target | cls_hung_material | — |
| residual VALIDATE z | 4.52 | — |
| **final class** | `PERSONAL_RESIDUAL_CANDIDATE` | `NO_STABLE_STRUCTURE` |

## What a difference in this table does and does not mean

A different final class between two players is the pipeline working, not failing: the
four classes exist precisely so that a player without a supported personal residual gets
an honest answer instead of a manufactured one. A difference in corpus size is a
difference in POWER, and a null on a small corpus is a statement about what this record
can support, never about the player.
