# Analysis plan

**What this plan is for:** Phase 7 — *score* validation, not learning validation. The first study is
not "does Decision Lab teach?" It is **"does this measurement produce an interpretable estimate of
the target conditional discrimination?"** Phase 8 is specified here too, and is explicitly blocked
behind Phase 7.

**The rule that governs every number below:** no threshold is invented. Every acceptance criterion
must have one of (1) direct literature justification, (2) simulation-based operating
characteristics, or (3) explicit decision-theoretic justification. **Where none exists, the
uncertainty is reported rather than resolved with a round number.** Sections that would need a cut
point and do not have one are marked **[NO JUSTIFIED THRESHOLD]** and that is the finding.

---

## Part 1 — Score validation

### 1.1 Primary quantities

Per participant, per measurement block, from the preregistered T label and the recorded act, and
from nothing else:

| quantity | source |
| --- | --- |
| hits, misses, false alarms, correct rejections | `sdt.py::from_trials` / `sdt.ts::tabulate` |
| hit rate, false-alarm rate | with Wilson intervals (Brown, Cai & DasGupta 2001) |
| *d′*, criterion *c*, β | Stanislaw & Todorov (1999) |
| *A′*, *B″_D* | same; reported **beside** *d′*, never instead of it |

**The loglinear correction (Hautus 1995) is applied to every table**, not only to extreme ones,
because a correction whose application depends on the data biases the estimate by an amount that
varies with the true rate.

**Accuracy is not a primary quantity and is not reported alone, ever.** In the corpus audit,
accuracy on T+ rose monotonically .751 → .820 across rating bands while *d′* did not — accuracy
would have shown a clean result and hidden [F5](FALSIFICATION_REGISTER.md#f5) entirely.

**Response time is a secondary variable.** It is recorded, reported, and may not carry a claim.

### 1.2 Item effects and matched-pair effects — the analysis that decides everything

Run **before** any person-level claim, because [F2](FALSIFICATION_REGISTER.md#f2) is the live
threat:

1. Standardised mean differences between T+ and T− on every covariate in the item schema.
2. A mixed-effects logistic model of the act, with random intercepts for **participant** and for
   **item**, and the trigger state as the fixed effect of interest.
3. **The variance decomposition, and it is the number that matters:** if between-item variance
   exceeds between-person variance, the instrument is discriminating items, not people.
4. Within matched pairs (Frame C, if it is ever built), the paired contrast.

**[NO JUSTIFIED THRESHOLD]** for what item/person variance ratio is acceptable. The WWC
baseline-equivalence convention (0.25 / 0.05 SMD) belongs to a different design; importing it would
be exactly the invented cut point this plan forbids. **Reported, with the direction and the
mechanism named.**

### 1.3 Stability

Test–retest and parallel-form, at least two administrations separated enough for practice not to
dominate. **This is entangled with [F7](FALSIFICATION_REGISTER.md#f7):** a second administration is
both a reliability estimate and a reactivity exposure, and the design cannot separate them without
the measurement-only arm below.

**[NO JUSTIFIED THRESHOLD]** for adequate reliability. There is no literature on the retest
behaviour of *d′* in this task. **The proper substitute is simulation:** given the observed
per-person trial count and rate, simulate the sampling distribution of *d′* and report the width of
its interval. That is criterion (2), and it is available today.

### 1.4 Relation to chess expertise

Rating is the only external skill measure available. The prediction is **directional only** —
Sheridan & Reingold support "experts detect relevant configurations faster and earlier" and support
nothing quantitative.

**Two-sided, and this is not symmetric hedging:** *d′* must rise with rating (or the instrument does
not measure a skill), **and must not track rating as tightly as a general chess measure would** (or
it is a chess test with extra steps). Report both, alongside the criterion *c* by band, because the
corpus audit found the criterion gradient cleaner than the sensitivity one.

### 1.5 Reference-task convergence — F6

The 2AFC reference task runs **alongside** the natural choose-a-move task and never replaces it.
Under the equal-variance model **d′₂AFC ≈ √2 · d′ʸⁿ**, and the conversion is applied before any
comparison. The four-cell reading, fixed in advance:

| 2AFC | natural | reading |
| --- | --- | --- |
| ↑ | ↑ | strongest available evidence |
| ↑ | → | **knowledge is available and is not controlling action.** The single most informative outcome this program can produce |
| → | ↑ | investigate response strategy, contamination, or measurement failure. Not celebrated |
| → | → | no effect |

### 1.6 Divergence from irrelevant variables

*d′* should not be predicted by: trial order, item position in the block, time of day, session
length, or target square colour. Each is computed; each is a way for the instrument to be measuring
the session rather than the player.

### 1.7 Measurement reactivity — F7

A **measurement-only arm**: identical blocks, identical spacing, **no intervention and no feedback**.
Any *d′* change there is the instrument's.

**Every learning estimate is reported net of it.** If reactivity is non-zero, the instrument is also
an intervention, and that sentence goes in the abstract rather than the limitations.

**[NO JUSTIFIED THRESHOLD]** for "acceptable" reactivity. The question-behaviour meta-analytic
SMD ≈ 0.09 is about single questions on self-report; a T+/T− block is dozens of exposures to the
taught contrast. **Borrowing that number would be using an estimate from the wrong design because it
is the estimate that exists.**

### 1.8 Negative controls, run on every dataset

The eight in `research/measurement/negative-controls.ts`, executed in `npm test`. Each must fail its
false claim **for its own reason**:

| control | must produce |
| --- | --- |
| label shuffle | *d′* collapses to the permutation floor |
| outcome leak | stripping every oracle field leaves the table **identical**, not close |
| always-capture | H and F both at ceiling, *d′* = 0, *c* strongly negative |
| never-capture | H and F both at floor, *d′* = 0, *c* strongly positive |
| random | *d′* → 0 with a criterion that honestly reflects its capture rate |
| oracle | *d′* at a finite ceiling — proves the scoring is wired up |
| **item-difficulty confound** | a large *d′* from an agent with **zero** ability — and the shuffle control does **not** catch it |
| **measurement-only improvement** | pre/post reports an effect where the truth is zero; between-arm does not |

---

## Part 2 — Learning validation (Phase 8), **blocked**

Blocked behind Part 1. Written now so that it cannot be designed after the data arrive.

### 2.1 The five claims, kept apart

```
discrimination exists
  ≠ discrimination changed
    ≠ the intervention caused the change
      ≠ the change generalized
        ≠ the change appeared in natural blitz
```

Five separate evidence claims. Reporting them as one number is the failure this document exists to
prevent.

### 2.2 Design

**Not `post > pre`.** [F8](FALSIFICATION_REGISTER.md#f8) shows by simulation that a pre/post contrast
reports **+0.2 *d′*** or more on data where the intervention effect is zero by construction.

**Candidate: staggered multiple baseline across independently measurable rule classes**, verified
against **WWC Single-Case Design Standards v5**:

| WWC requirement | how it is met |
| --- | --- |
| systematic manipulation of the independent variable | the experimenter decides when each rule class's intervention starts |
| repeated measurement | blocks throughout, both phases |
| **≥ 3 demonstrations of effect at 3 different points in time** | ≥ 3 rule classes, staggered starts |
| inter-assessor agreement | **automatic here** — B is computed from the move and the frozen T; there is no human rater to disagree. Recorded as a place the standard is met trivially rather than well |
| visual analysis: level, trend, variability, overlap, immediacy, consistency | all six reported per case |
| baseline stability | **an open empirical question**: nobody knows whether rule-specific *d′* has a stable baseline in chess. This is a prerequisite study, not an assumption |
| randomisation where possible | randomise the order in which rule classes enter intervention |

**A precondition that is easy to skip:** multiple baseline requires the rule classes to be
**independently measurable** — teaching one must not move another. That is itself a measurement
question and must be answered before the design is valid.

### 2.3 Analysis

Effect sizes from **`SingleCaseES`** (Pustejovsky et al. 2024) and **`scan`** (Wilbert & Lueke).
Candidates: NAP, Tau-U, baseline-corrected Tau, LRR, between-case SMD, and randomisation tests where
the design supports them.

**No proprietary "transfer score" is to be written.** If none of the published indices fits a *d′*
outcome, the honest output is a statement that no validated index fits — not a new one.

**[NO JUSTIFIED THRESHOLD]** for which index suits an SDT-derived outcome. Non-overlap indices were
developed for count and rate outcomes; *d′* is neither. **Resolvable by simulation** — generate data
under known effects and compare index behaviour — and that simulation has not been run.

---

## Every threshold in this program, and its status

| number | where | status |
| --- | --- | --- |
| loglinear correction, +0.5 / +1 | SDT | **literature** — Hautus (1995) |
| Wilson interval, z = 1.96 | all rates | **literature** — Brown, Cai & DasGupta (2001) |
| √2 conversion, 2AFC ↔ yes/no | F6 | **literature** — equal-variance SDT |
| ≥ 3 demonstrations at 3 time points | Phase 8 | **literature** — WWC SCD v5 |
| 100 cp = "blunder" | F3/F4 reporting | **convention, and labelled as one.** Used as a *descriptive* cut for reporting the cp-loss distribution, never as an acceptance criterion. The full distribution (median, Q1, Q3) is reported beside it |
| 200,000 engine nodes | F4 | **a budget, not a threshold.** Recorded on every record; OT-4 notes the direction of its influence is unknown |
| exchangeability cut for SMD | F2 | **[NO JUSTIFIED THRESHOLD]** — reported, not judged |
| reliability floor | 1.3 | **[NO JUSTIFIED THRESHOLD]** — simulation prescribed instead |
| acceptable reactivity | 1.7 | **[NO JUSTIFIED THRESHOLD]** — the borrowable number is from the wrong design |
| item/person variance ratio | 1.2 | **[NO JUSTIFIED THRESHOLD]** |
| SCED index choice for a *d′* outcome | 2.3 | **[NO JUSTIFIED THRESHOLD]** — simulation prescribed, not run |

`0.7` and `0.8` appear nowhere as acceptance criteria. The one `0.7` in this program is Lichess's
own win-chance gap in `generator.py`, quoted as a fact about their corpus.
