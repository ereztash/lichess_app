# Every remaining uncertainty, classified

The mission's stopping condition: continue until every question answerable from existing repository
resources has been answered, and the rest is explicitly `FIELD_REQUIRED` or prospectively specified.

This is that list. Nothing here is left as "more research needed".

Classes:

- **ANSWERED** -- settled from repository resources in this mission.
- **FIELD_REQUIRED** -- no computation can settle it; it needs data from people.
- **PROSPECTIVELY SPECIFIED** -- answerable by computation, but only under a new preregistration,
  because answering it inside this one would be choosing a definition after seeing results.
- **CLOSED BY GATE** -- would only have mattered had the gate opened.

---

## ANSWERED

| Question | Answer |
|---|---|
| Is `OwnExposure` engine-contaminated? | No. Board-derived, computation path audited, `RESEARCH_QUESTION_FREEZE.md` section 2.1 |
| Does P3 reproduce? | `P3_REPRODUCED`, every published number identical |
| Does the effect exist in natural chess? | Yes, `+0.1014 [+0.0908, +0.1134]` |
| Is it material? | No, `+5.45 pp` over a material model that sits at chance |
| Is it mobility? | No, `+3.99 pp` over a mobility model |
| Is it position value? | No, and inverted: removing value controls shrinks it |
| Is it between-player composition? | No, within-player `+0.0975 [+0.0864, +0.1087]` |
| Does the pipeline leak? | No, permutation gives `+0.0080 [-0.0008, +0.0162]` |
| Is it specific to this metric? | Yes, three pre-named relational controls give at most `+0.57 pp` |
| Is it broad? | 9/9 bands, 3/3 phases, 3/3 clock strata; all 29 depth-1 scope cells SUPPORTED |
| Where is it strongest? | In check, endgame, low material, few legal moves, losing, short of time |
| Is it a purely functional invariant? | **Partial.** Works across unlike geometry, `4.79 pp` weaker there |
| Does it add held-out predictive value? | On variance yes (`ΔR² +0.0131`), on absolute error no |
| How often does the situation arise? | 34.5% of decisions, about eleven a game |
| Do humans get it wrong often enough? | Yes, headroom 36.02% |
| Does getting it wrong cost anything? | **Usually not.** 24.32% against a frozen 30%. This decided the verdict |
| Is that shortfall an instrument limit? | No, separable from the 10.89% noise floor |
| Can the P4 exposure moment be established? | Bracketed to 19 min 42 s; **not recorded anywhere** |
| Is the personal baseline usable? | Yes for pre-exposure, with the recent-300 window, not the whole account |

---

## FIELD_REQUIRED

| Question | Why no computation settles it | Smallest design |
|---|---|---|
| **Does the cue, rather than the intervention episode, cause anything?** | P4's CONTROL arm moved by the same +25 pp as TARGET. Nothing in the recorded data separates them | one further participant, sham cue of matched form and length, same bank, same procedure |
| **Does learning it change an uncued ordinary-game decision?** | No post-exposure natural game exists in the repository | `PRE_EXPOSURE_BASELINE.md`, frozen: 100 eligible post-exposure opportunities or 120 days |
| **Does it replicate beyond one participant?** | N=1 | replication sized on the B3 scope map, weakest bands first, since the effect is largest there |
| **Would a player act on it under real time pressure?** | The scope map says the *position* rewards it under pressure; whether a *person* can apply it there is a different claim | within-participant contrast across clock strata in the natural retest |

---

## PROSPECTIVELY SPECIFIED

Each needs its own freeze. None is an amendment to this one.

| Question | What must be frozen first | Answerable from |
|---|---|---|
| **Does higher exposure cost more later, at the point the opponent exploits it?** | a delayed-cost outcome definition and its horizon. `C9` tested immediate `quality_loss` only | the preserved corpus cannot answer it; needs continuation searches |
| **Would a value-weighted or SEE-aware construct clear C9?** | the weighting, before it is fitted. Section 2.2 recorded the construct is unweighted before the run | preserved corpus for the ranking tests; a new consequence measure for C9 |
| **How does exposure rank moves outside the engine's top eight?** | the candidate-set definition and its width | new compute; attack A-9 is a limit of this instrument, not of the idea |
| **Does the endgame-and-check region hold?** | nothing new; it needs volume, not a new definition | more natural positions in that region; it had 175 held-out pairs against a 200 minimum |
| **Does it hold in longer time controls?** | the time control, before sampling | new ingest at `300+0` or slower; only `180+0` was measured |

---

## CLOSED BY GATE

Not open questions. They would have mattered only had `C9` passed, and each is recorded so a future
gate does not have to rediscover it.

| Item | State |
|---|---|
| `BehavioralPolicy` widening to a candidate-ranking kind | designed in the mission brief, **not built** |
| `PolicyExposure` record | **not built**, and independently constrained: `Q28` is unresolved, so mission section 15 binds it to the least persistent representation |
| Shadow opportunity matcher | **not built**; `NATURAL_RETEST_SPEC.md` and D22 supply the architecture when needed |
| Transfer-grading fix | **designed** in `PRE_EXPOSURE_BASELINE.md` section 3.3: policy consistency, move quality and opportunity rate stay three outcomes |
| Delivery surface | **not built**; P4's wording is not licensed as an intervention by anything in this mission |

---

## The one thing this mission would tell a reader who reads nothing else

The invariant is real and survives every attack written before the data existed. It stops on
ecology, and specifically on the smallest of the three ecological quantities: the mistake it
prevents is usually free. That is a fact about chess, not about the measurement, and no threshold was
moved to reach it.
