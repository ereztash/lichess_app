# Action–value ledger

One row per materially costly user action in the reachable build. Built by walking the built
bundle at 390x844 from fresh profiles, and by reading the code for what each cost feeds.

## What was measured, so the rows are not estimates

Two live-game walks on the frozen build, per-decision reveal, counting every tap including the
board taps that found no legal target:

| Walk | Decisions | Taps | Instrumented decisions | Probes | Counter after |
|---|---|---|---|---|---|
| A | 6 (`first` + 5 `play`) | 34 | 2 | 1 | `1 החלטות מדודות · חסרות עוד 59` |
| B | 4 (`first` + 3 `play`) | 26 | 2 | 0 | `1 החלטות מדודות · חסרות עוד 59` |

An uninstrumented decision costs 3 to 4 taps. An instrumented one costs 8. **In both walks the
discovery counter ended at 1**, because `first` is refused by discovery and only one `play`
decision drew the confidence question.

The import walk: five games, 240 positions, about 80 seconds of analysis, returning one finding
with both n's. The blitz walk: twelve moves, one confidence question, a resignation, a post-game
analysis, and a negative result.

## Reachable actions

| Action | State | User cost | Why the system asks | ΔEvidence | Immediate user value | Future option value | Natural? | Would the user do it without measurement? | Contract visible? | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| Read the front door | cold `/` | 140 words, one screen | none | none | says what the product is for | none | no | no | n/a | `NO_EVIDENCE_VALUE` |
| Type a Lichess username | front door | one field, one tap | fetches real games | high | a position from their own play in ~2 s | the retrospective finding | no | yes, people paste their games into engines constantly | yes: *"עמדה אחת ממשחק שאתם שיחקתם"* | `VALUE_ALIGNED` |
| Wait for the import analysis | import | ~80 s for five games | scores 240 positions | high | the finding, led with | none beyond it | no | yes | yes | `VALUE_ALIGNED` |
| Place a move on the board | any decision | 2 taps | the observation itself | high | it is the act of playing chess | everything downstream | **yes** | yes | n/a | `NATURAL_CAPTURE` |
| Submit the commitment | any decision | 1 tap | seals the record before the engine speaks | high | unlocks the reveal | none extra | no | no | yes: *"החלטה חלקית לא נרשמת: זה הכלל, לא תקלה"* | `VALUE_ALIGNED` |
| State a confidence | `first`, `anchor`, `drill`, `transfer` always; `play` at `ASK_RATE = 0.15` | 1 tap | the calibration gap cannot exist without a number stated before the verdict | high, and unique | **none at the reveal** | the calibration gap, at 60 scored | no | **no** | partly: the dashboard says it is sampled, never at what rate | `COVERED_EPISTEMIC_TAX` |
| Name what you read and what you cannot evaluate | coupled to the confidence draw | 2 taps | the vocabulary reading measures the **menu**, not the answer | moderate | **yes, at the next screen**: `nextQuestion` anchors the reveal's question to the player's own words, *"סימנת X. האם הקו של המנוע עונה על זה?"*, and `shared/reveal.ts` calls that text *"the one thing on screen the engine did not produce"* | none beyond it | no | no | no, the payoff is never announced in advance | `VALUE_ALIGNED` |
| Answer the counterfactual probe | `PROBE_PROBABILITY = 0.35` | 2 taps | whether the better move was in the player's hand and unplayed | high, and unique | the named alternative is scored beside the played one, **behind the `פרטי הניתוח` disclosure** | the four-way reading at `MIN_BUCKET_N = 30` probed | no | no | no | `EXPLICIT_OPTION_VALUE` on the panel, `UNCOVERED_EPISTEMIC_TAX` on the immediate step, because the payoff exists and is not shown where the cost is paid |
| Read the reveal | after every decision | ~160 words | none | none | the whole payoff: the cost, the alternative, the limits, a question | none | no | yes | n/a | `VALUE_ALIGNED` |
| Continue to the next decision | reveal | 1 tap | more observations | high | the next position, the game continues | the thresholds | **yes** | yes | yes | `NATURAL_CAPTURE` |
| Take an ordinary live decision | live game | 3 to 4 taps | the only stratum discovery admits | **counts only when the confidence drew** | the reveal, every time | the 60 | **yes** | yes | no, that 6 of 7 do not count is visible only as a separate sentence on another screen | `VALUE_ALIGNED` on the act, `COVERED_EPISTEMIC_TAX` on the share that does not count |
| Play a blitz game | `/blitz` | a whole game | the blitz strata | high, but only on finishing | the game itself | the post-game reading, then 30 games | **yes** | yes | yes, the clock stopping for the question is stated up front | `NATURAL_CAPTURE` |
| Finish the blitz game rather than abandon it | `/blitz` | completing a game | **nothing is written until it ends** | all-or-nothing | the post-game reading | the 30 | partly | yes | no, nothing says an abandoned game stores nothing | `UNCOVERED_EPISTEMIC_TAX` |
| Read the post-game negative result | after blitz | ~60 words | none | none | a true statement about what was and was not found | none | no | yes | n/a | `VALUE_ALIGNED` |
| Answer a bank position | `עמדה מהסט המשותף` | one full decision, confidence always | the only between-player reading | high | a reveal | a comparison to other players | no | no | partly | `COVERED_EPISTEMIC_TAX` |
| Write the goal note | `/` returning | a sentence | **nothing reads it** | none | the player's own words, kept | none | no | maybe | yes, and it says the opposite of a promise: *"אף מספר באפליקציה הזו לא מודד כמה התקרבתם לזה"* | `NO_EVIDENCE_VALUE`, and deliberately so |
| Return and read the resume screen | `/` | ~80 words | none | none | one blocker, one next step, `למה אנחנו אומרים את זה?` | none | no | yes | n/a | `VALUE_ALIGNED` |
| Accumulate toward 60 scored decisions | the whole journey | measured: 26 taps bought 1 of 60 | the detector's floor on both sides of a split | linear | none per unit beyond the reveal already given | the first claim, and the product says even then *"זו תהיה השערה, לא ממצא"* | no | no | the floor yes, the conversion rate no | `VALUE_UNKNOWN_REQUIRES_FIELD` |

## Unreachable actions, listed separately

| Action | Why unreachable | Verdict |
|---|---|---|
| Candidate / context check | needs the 60 | `NOT_REACHABLE` |
| Rule creation | `EXPERIMENTAL_LEARNING_ENABLED` off | `NOT_REACHABLE` |
| Drill | behind a claim | `NOT_REACHABLE` |
| Prompted retrieval / transfer | same flag | `NOT_REACHABLE` |
| Unprompted observation in play | needs a rule to observe | `NOT_REACHABLE` |
| Refutation / retirement | same flag | `NOT_REACHABLE` |

## What the distribution says before any interpretation

Sixteen reachable rows. `VALUE_ALIGNED` or `NATURAL_CAPTURE` on nine of them, including every step
of the core loop: place a move, submit, read the reveal, continue. Two `NO_EVIDENCE_VALUE`, both
deliberate. Three `COVERED_EPISTEMIC_TAX`. **Two `UNCOVERED_EPISTEMIC_TAX`**, and one
`VALUE_UNKNOWN_REQUIRES_FIELD`.

A ledger in which one verdict took almost every row would be a ledger to distrust, and
`DR_PLAN_0.md` said so in advance. This is not that ledger. The core loop pays every time, which
is the first real constraint on H1.
