# Replication verdict — Player B

```
METHOD_REPLICATED_ON_PLAYER_B
```

The frozen pipeline ran end to end on a player it had never seen, with no methodological
adaptation of any kind, and returned an honest bounded answer:

```
lichess/vibesgalore  ->  NO_STABLE_STRUCTURE
```

That is one of the four outcomes the contract declares, and it is not a failure of the run. The
thing being tested was never "does a personal residual show up in someone else". It was whether an
instrument built on one person can be handed a second person without changing itself, and still
know what it did and did not find.

---

## 1. What ran

Every stage, in the frozen order, on the frozen rules:

```
FETCH (480 ids, canonical _ids endpoint) -> ELIGIBILITY (358 admissible; 111 Time forfeit,
11 under-20-plies) -> CORPUS FREEZE -> SELF-HASHED PREREG -> ENGINE SCORING (358 games,
Stockfish 17.1 d12 MultiPV 3) -> FEATURES -> SPLITS (6,977 / 2,275 / 2,173 decisions across
215 / 71 / 72 games) -> POPULATION RESOLUTION (median 1626 -> band 1450-1850 ->
population_2026-06) -> DISCOVERY -> VALIDATION -> POPULATION-BASELINE RESIDUAL SEARCH ON BOTH
FROZEN TARGETS -> CLASSIFICATION -> REPORT
```

`verify_run.py`: 0 problems, pre-registration self-hash intact, tree clean at freeze, run's
pipeline hash equal to the working tree's. Nothing was retried, retuned or re-run for a better
answer.

**The population-correction stage was exercised.** This matters and is easy to misread from the
class alone: the run did not stop before the correction. Both design-v1.8 residual targets were
searched under the same-rating population model (holdout AUC 0.765 and 0.766, the same model the
erez281 run used), and no candidate passed the frozen bar. The class was decided earlier, at the
broad stage, because nothing passed there either.

## 2. What was found, and what the bar said about it

Three candidates were frozen on DERIVE and judged once on VALIDATE. All three sit in the same
construct family the erez281 study named — an own piece with more attackers than defenders — and
one of them, `n_good_captures<1 AND own_overloaded_piece_count>=1`, is *verbatim* one of erez281's
three frozen candidates. All three carry a positive raw within-game elevation on VALIDATE. None
survives the residual, which is the part that has to exceed generic difficulty, time, context and
available free material:

| frozen on DERIVE | DERIVE within-game | VALIDATE within-game | VALIDATE residual z | bar |
| --- | --- | --- | --- | --- |
| `opp_last_spent_s:[1:5[ AND own_hanging_piece_count>=1` | +10.1 pp (z 6.80) | +5.6 pp (z 2.34) | 1.00 | 3.5 |
| `own_attacked_piece_count>=3 AND own_hanging_piece_count>=1` | +13.7 pp (z 8.15) | +6.5 pp (z 1.80) | −0.02 | 3.5 |
| `n_good_captures<1 AND own_overloaded_piece_count>=1` | +7.1 pp (z 6.01) | +4.9 pp (z 2.15) | 1.81 | 3.5 |

Stability is low too: 7–13% of bootstrap winners share Jaccard ≥ 0.60 with the frozen region, against
57% for erez281's R\*. A region that DERIVE finds and VALIDATE does not keep is what the derive /
freeze / judge discipline exists to catch, and here it caught three.

## 3. What this corpus could and could not have detected

Declared before the result, in `PLAYER_B_READINESS.md`, and now stated with the realised numbers.
Scaling the erez281 statistics by √n onto Player B's frames:

| stage | erez281 | scale | an erez-sized effect would give | bar | Player B observed |
| --- | --- | --- | --- | --- | --- |
| broad (all speeds) | z 8.56 on 10,626 | √(2275/10626) = 0.463 | **z 3.96** | 3.5 | 1.81 |
| personal residual (blitz) | z 4.52 on 9,589 | √(2196/9589) = 0.479 | **z 2.16** | 3.5 | 2.29 |

Read honestly, in both directions:

- **The broad stage was powered**, if barely. A recurring structure the size of erez281's would have
  cleared the bar on this corpus (3.96 > 3.5); the minimum detectable effect here is about 0.88× the
  size of his. Player B's best was 1.81. So Player B does not carry a structure of that size in this
  window. A structure half that size would have been invisible, and nothing here rules one out.
- **The residual stage was not powered.** A personal residual the size of R\*\* would have produced
  z ≈ 2.16 on this blitz frame, under the 3.5 bar; the minimum detectable residual is about 1.6×
  R\*\*. Player B's best was 2.29, which is *approximately what an R\*\*-sized residual would have
  looked like here*. Nothing at all can be concluded from that stage on this corpus — not that a
  residual exists, and not that it does not.

The second row is the one that would be easy to overclaim, so it is worth stating flatly: Player B's
`NO_STABLE_STRUCTURE` is a statement about a recurring structure at erez281's effect size in a
358-game window. It is not a statement that this player has no personal residual. The pipeline was
never asked that question here, because the broad stage answered first.

## 4. Method-level comparison

`COMPARISON_EREZ281_VS_PLAYER_B.md`. The dimensions compared are what the pipeline could DECIDE,
not whether the same pattern came back. If a personal residual is genuinely personal it should not
come back, so recurrence would be the wrong thing to score.

| | erez281 | vibesgalore |
| --- | --- | --- |
| stable structure found? | yes | no |
| survives holdout? | yes (TEST, shuffled-label p 0.000) | TEST never opened |
| explained by population? | yes, mostly — 62nd percentile among peers | not reached |
| residual remains? | yes, narrow | no candidate passed |
| population search run? | yes, both targets | yes, both targets |
| final class | `PERSONAL_RESIDUAL_CANDIDATE` | `NO_STABLE_STRUCTURE` |

Two players, two different bounded answers, one unchanged instrument.

## 5. What changed epistemically

**Before Player B**, the evidence was: a pipeline that produces a bounded, population-corrected
finding on the one person it was built on, and that reproduces that finding bit-for-bit when the
person is made a parameter. Everything about generality was an argument from construction — the
rules were frozen and hashed, the classes were reachable in fixtures, the controls went red. None of
it was evidence about a second human record.

**After Player B**, one thing is evidence rather than argument: *the instrument does not need the
person it was built on.* Given a player chosen by a rule that never looked at any result, it
fetched, froze, scored, split, searched, judged, corrected against a same-rating population, and
returned a bounded negative — without a threshold moving, a feature changing, or a re-run for a
better answer. The negative is the load-bearing part. A pipeline that only ever returns findings is
indistinguishable from a pipeline that manufactures them, and this one returned nothing on the first
independent player it was handed.

**Still not evidence, after Player B:**

- that R\*\* generalises, or that it does not. One player, and the stage that would speak to it was
  underpowered here;
- that the four-way separation works, in full. Player B exercised `NO_STABLE_STRUCTURE`;
  `LEVEL_TYPICAL_ONLY` and `INSUFFICIENT_EVIDENCE` have been shown reachable only in fixtures, and
  `PERSONAL_RESIDUAL_CANDIDATE` only on erez281, the player the method was built on;
- anything about the distribution of outcomes across players. n = 2, and one of them is the
  development case;
- anything causal, anything about an intervention, anything about a person. The claim ladder stops
  at SPECIFICITY by construction, on every run, whatever it finds.

The single sentence this licenses, and no more:

> The same frozen mechanism-discovery methodology, handed a second independent player, ran end to
> end without adaptation and returned a bounded negative.

## 6. Governance

Player B was TEST data from the moment `REPLICATION_PREREG_PLAYER_B.json` was hashed
(`14b8fc42606103b6…`), before a single position was scored. Nothing in the pipeline was changed
because of their result, and nothing in this document proposes a change because of it. The run
stands as a replication.

The two defects fixed during this round were both found and repaired **before** Player B's
pre-registration was written — `repo_dirty` counting a run's own outputs, and the selection screen
using current rating as a proxy for the window median. The candidate rejected by the second of
those, `livio68`, was rejected at eligibility with nothing scored, so no analytic choice was taken
from anyone's result.

## 7. Next move

**Player C**, under this same frozen protocol, with one operational change that is not a
methodological one: a `LICHESS_API_TOKEN`. The platform paginates a public game list at 40 pages, so
480 games is the ceiling without one, and the power table above is what that ceiling costs. A token
lifts both limits at once — it exercises the username-only ingestion contract this run could not,
and it allows a corpus large enough for the residual stage to mean something.

Two things are worth deciding before Player C rather than after:

1. whether the population registry should hold more than one band. It currently holds 1450–1850, so
   only a blitz median of 1626–1674 is admissible, which is why two candidates had to be screened to
   find one. That is a research decision about what "a same-rating player" means, not a
   configuration change, and it belongs to a person;
2. whether a player whose broad stage fails should still have their residual stage reported. It
   already runs; the class simply does not read it. Player B is the first case where that
   distinction had consequences, and this document is the argument for reporting it either way.

Neither is a change to make on the strength of one negative.
