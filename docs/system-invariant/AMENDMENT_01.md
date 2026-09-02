# Amendment 01 -- three interpretation constraints, recorded before the gate

Status: **AMENDMENT TO A FROZEN PROTOCOL**
Recorded: 2026-09-02, while the scoring run was at 52% and **before any Test A, Test B, scope or
ecology number existed**.
Amends: `RESEARCH_QUESTION_FREEZE.md`, `FALSIFIERS.md`
Amends nothing in: `docs/learning-v3/` (P3, P4 and the pressure-exposure result are untouched)

---

## 0. What this amendment does not do

It changes **no hypothesis, no outcome definition and no threshold**. Specifically unchanged:

- the construct (`own_overloaded_piece_count`) and every property frozen in section 2;
- the outcome (`quality_loss`), its clipping, and its units;
- `PAIR_EPSILON = 0.01`, `REASONABLE_BAND = 0.05`,
  `ACCURATE_WIN_PROBABILITY_LOSS = 0.02761`;
- the opportunity definition in section 10.1;
- criteria `C1` through `C9` and every number in them;
- falsifiers `F-1`, `F-2`, `F-A1`..`F-A10`, `F-E1`..`F-E3`, `F-P3`, `F-X`.

These are constraints on **how results may be interpreted and which estimand is reported**, not on
what counts as a pass. The distinction matters because an amendment that moved a bar after the data
arrived would be the failure the freeze exists to prevent.

**Timing is the claim.** This is recorded while the engine run is unfinished and no analysis has been
executed, which `git log` can confirm against the commit that first writes any result.

---

## A. P4 is downgraded from cue-specific evidence to non-specific post-intervention evidence

### A.1 The observation that forces it

`docs/learning-v3/HUMAN_CUE_N1_RESULT.md`, unchanged and unedited:

| Item set | Baseline | Unseen test | Change |
|---|---:|---:|---:|
| TARGET | 6/8 = 75% | 8/8 = 100% | **+25 pp** |
| CONTROL | 3/4 = 75% | 4/4 = 100% | **+25 pp** |

CONTROL moved by exactly as much as TARGET. General attention, task familiarisation, practice on the
interface, or any other non-specific effect of having been intervened upon is therefore a **complete**
alternative explanation for the whole of the TARGET improvement. Nothing in the design separates it.

This was noticed during the repository audit of this mission, not derived from any natural-play
result.

### A.2 The corrected authority

P4 supports, at most:

> One participant could understand and use the task after the intervention and achieved 8/8 on
> unseen TARGET items. The experiment does not identify the OwnExposure cue as the cause of the
> improvement.

Classification for this mission:

```
P4 = HUMAN-USABILITY / NON-SPECIFIC POST-INTERVENTION EVIDENCE
```

**Not** cue-specific causal evidence.

### A.3 Phrases forbidden in every document this mission produces

- "cue efficacy demonstrated"
- "OwnExposure teaching caused improvement"
- "human learning established"
- any paraphrase asserting the cue, rather than the intervention episode, produced the change.

### A.4 The gate consequence, decided now rather than after the results

`RESEARCH_QUESTION_FREEZE.md` section 11 does **not** list P4 among `C1`..`C9`, so the frozen gate is
untouched. The mission brief's Outcome D does list "P4 provides at least N-of-1 human cue evidence",
and that clause is hereby split into two, with the split fixed before any natural-chess number is
read:

| Sub-clause | Status | Evidence |
|---|---|---|
| **D-human-usability**: a human can be given this cue, understand it, and apply it to unseen presented positions | **satisfiable by P4** | 8/8 on unseen TARGET items |
| **D-cue-efficacy**: the cue, specifically, causes the improvement | **UNRESOLVED** | requires a sham / attention-matched arm; no repository asset can supply it |

Outcome D may therefore be reached only in a form that names D-cue-efficacy as unresolved. It may
not be reached by treating P4 as having settled it.

### A.5 What is preserved

`HUMAN_CUE_N1_PREREG.md` and `HUMAN_CUE_N1_RESULT.md` are **not edited**. The `P4-N1-PASS` verdict
stands as what it was: the mechanical output of its own five preregistered conditions. This
amendment constrains what later documents may *infer* from it. History is provenance.

---

## B. The frozen consequence threshold survives the noise floor

### B.1 What was measured

On 76 decisions where the human played the engine's own best move, `quality_loss` should be 0 and is
not: mean **0.0084**, median **0.0000**, **46.1%** above zero, **7.9%** above
`ACCURATE_WIN_PROBABILITY_LOSS = 0.02761`. Parent and child positions are different searches, so the
outcome carries search noise.

### B.2 What that does not license

The 7.9% figure is **not** permission to move any of:

- the frozen meaningful-cost threshold `0.02761`;
- eligibility;
- the opportunity definition;
- any PASS/FAIL boundary.

All remain exactly as frozen. A threshold re-chosen from the data it is about to judge is not a
threshold.

### B.3 What it is used for instead

1. **Measurement-error characterisation.** The noise floor is reported beside the consequence rate,
   so a reader can see the floor the observed rate has to clear.
2. **Sensitivity analysis.** The consequence rate is reported at the frozen `0.02761` and, as a
   declared secondary, at a threshold set to the 95th percentile of the noise floor. The frozen one
   decides; the secondary informs.
3. **Interpretation limit**, per B.4.

### B.4 The new result class this creates

```
MEASUREMENT_LIMITED
```

If the observed consequence rate at the frozen threshold is not separable from the noise floor --
concretely, if its cluster interval overlaps the noise-floor rate -- then the correct result is
`MEASUREMENT_LIMITED`, meaning **the instrument cannot answer C9 at this node budget**. It is not a
licence to pick a threshold that would separate them. The remedy is a deeper search budget in a
future run, preregistered.

---

## C. The opportunity-density estimand must survive B3's sampling design

### C.1 The problem, stated with the numbers

B3's ingest accepts sides by band-specific hash rates, takes at most one analysed side per game, and
caps games per player. The acceptance rates span more than a factor of twelve
(`2400-2599`: 0.0153; `1800-1999`: 0.001241). The result is a sample that is nearly flat across
bands while the population is not:

| Band | decisions in this sample | candidate sides in the population (B3 FINAL, same design) |
|---|---:|---:|
| 800-999 | 3,953 | 26,527 |
| 1000-1199 | 4,948 | 64,519 |
| 1200-1399 | 5,330 | 119,519 |
| 1400-1599 | 5,473 | 184,136 |
| 1600-1799 | 4,996 | 241,781 |
| 1800-1999 | 5,302 | 235,079 |
| 2000-2199 | 4,698 | 143,564 |
| 2200-2399 | 4,505 | 55,915 |
| 2400-2599 | 6,091 | 17,370 |

A pooled prevalence over the 45,296 decisions is therefore a property of **the research sampler**,
not of natural chess. Reporting it as "the natural chess opportunity rate" would let the sampling
design manufacture the number that decides `C7`.

This constrains the ecology section only. For association and generalisation (Test A, Test B, the
falsifiers, the scope map) the design may be reused as is, because those estimate a relationship
within strata rather than a prevalence over a population.

### C.2 The estimands, defined before counting

| Id | Quantity | Denominator, stated exactly |
|---|---|---|
| **O1** | per-decision opportunity rate **within band b** | analysed decisions in band b |
| **O2** | opportunities per game **within band b** | sampled sides in band b, numerator counted over that side's **complete eligible decision sequence** |
| **O3** | **games needed to meet one opportunity**, in context C | `1 / O2(C)` |
| **O4** | pooled population rate | `sum_b w_b * O1(b)`, with `w_b` the band's share of **candidate sides in this prefix**, which is the declared target population |
| **O5** | player-weighted density | each player contributes one observation, equal weight, regardless of how many decisions they supplied |
| **O6** | decision-weighted density | the naive pooled rate over all 45,296 rows. **Reported and labelled as sampler-weighted. Never called a population rate.** |

**Declared target population for O4:** analysed-eligible sides of rated `180+0` standard games
played on 2026-07-01 UTC, within the 800-2599 rating range, inside the 520,000,000-byte prefix this
mission consumed. The weights are not borrowed from B3's month; they are counted in this prefix.

**O3 is the quantity P5 feasibility turns on** and is the one the mission brief asks the analysis to
be able to answer.

### C.3 The complete eligible sequence

`O2` must not be computed from analysis rows that survived downstream filters. Two known
subtractions between "the side's decisions" and "rows in the table":

1. B3's per-side cap of 60 decisions, applied by even ply spacing. **80 of 1,383 sides (5.8%) hit
   it** in this sample.
2. B3's eligibility exclusions: 1,383 first-move decisions with no derivable think time, 677 last
   plies, 427 forced single-legal-move positions, 2 impossible think times.

Handling, fixed here:

- `O2` is computed **exactly** on the 1,303 uncapped sides, where the scored decisions *are* the
  complete eligible sequence. No extrapolation is involved.
- The 80 capped sides are reported **separately**, with their known undercount stated, and are
  excluded from the primary `O2`. Excluding them biases `O2` **downward** with respect to long
  games, and that direction is stated rather than left for a reader to work out.
- Forced positions are counted in a per-ply denominator where one is reported, because a forced move
  is a real ply of a real game even though no policy can apply to it.

### C.4 Required reporting

Every rate carries its denominator in the same line. `O1` and `O2` are reported for all nine bands
whatever they show. `O6` may appear only with its label. No pooled number is presented without
`O4`'s weights beside it.

---

## D. Compute

Nothing already computed becomes unusable under this amendment, and **no engine search is repeated**.
The scoring run continues untouched.

One **non-engine** step is added: the ingest is re-run to record two quantities it did not save --
the per-band candidate-side counts that `O4`'s weights require, and the per-side uncapped eligible
decision counts that `O2` requires. That is a download and a parse. It buys the estimand correctness
that section C demands and costs no search.
