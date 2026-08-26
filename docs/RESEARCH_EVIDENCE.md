# Research evidence

External evidence gathered for measurement-validity decisions, reviewed 26 Aug 2026. Each row is
claim / population / method / result / limitation / source. Research is a **lens**: the code and
its runtime tests establish what the product does; this establishes whether that behaviour
measures the construct the product names.

## The question this was gathered to answer

The transfer test counted a position as a success when the recalled text was non-empty, the player
ticked "I applied it", and engine `cp_loss ≤ 30`. A reviewer typed **`banana`** and got 3/3 with a
verdict of `observed: true`. The question was whether that is a bug with a threshold fix, or a
measure with no scoring key.

**It is the second.** Of the three criteria, two are not measurements — a non-empty string and a
tick — and the third measures move quality rather than rule use.

## 1. How the retrieval-practice literature actually scores free recall

| | |
| --- | --- |
| **Claim** | Free recall is scored against a **predefined rubric of idea units by human raters**, gist-based rather than verbatim, with inter-rater reliability computed and reported. |
| **Population** | 120 (Exp. 1) and 180 (Exp. 2) undergraduates. |
| **Method** | Prose passages "divided into 30 idea units for scoring purposes"; subjects recalled "without concern for exact wording" — gist, explicitly. 1 point per correctly recalled idea unit. |
| **Result** | Two raters on the first 40 tests, Pearson **r = .95**, after which one rater sufficed. Exp. 2: at 5 minutes repeated study beat repeated testing (83% / 78% / 71%); **at one week the order fully reversed** (61% / 56% / 40%). |
| **Limitation** | Prose passages, not self-authored rules; single lab. |
| **Source** | Roediger & Karpicke (2006), *Psychological Science* 17(3), 249–255 |

**What this settles.** The canonical method has three parts the product has none of: a
decomposition of the target into scoreable units, gist-level matching, and a reported reliability
coefficient. "Non-empty string" is not a lenient version of that method — it is the absence of one.

**The product gets the decomposition for free.** A learning rule already has five authored slots:
trigger, mechanism class, action rule, predicted outcome, refutation condition.

## 2. `applied == true` is not evidence, and this is the strongest finding in the review

| | |
| --- | --- |
| **Claim** | Self-rated use of a learned rule does not track whether transfer occurred. |
| **Method** | Adults solving homomorphic Missionaries-and-Cannibals / Jealous Husbands problems, rating how much they used the training solution **after being told the two were related**. |
| **Result** | Ratings **did not correlate** with transfer performance — in a case where transfer demonstrably occurred. Wrong in both directions. |
| **Limitation** | 1974, small-sample problem-solving lab work. Read via Barnett & Ceci's report of it (footnote 9), not the primary text. |
| **Source** | Reed, Ernst & Banerji (1974), *Cognitive Psychology* 6, 436–450 |

| | |
| --- | --- |
| **Claim** | Off-line self-report converges weakly with measured metacognitive behaviour. |
| **Method** | 24,396 articles screened (1982–2018); meta-analysis of 37. |
| **Result** | Pooled **r = 0.22, 95% CI [0.14, 0.31]**, k = 23, I² = 58.8%. "Self-reports analysed for this review cannot adequately measure the nuances of metacognitive behaviour." |
| **Limitation** | Heterogeneous instruments and behavioural criteria. |
| **Source** | Craig, Hale, Grainger & Stewart (2020), *Metacognition and Learning* 15(2), 155–213 |

There is a gradient worth knowing: **general, single-item** self-report lands at r ≈ 0–0.3;
task-specific multi-item instruments derived from an observational coding scheme reach r ≈ 0.42–0.63
(Schellings et al., 2013). A **single binary tick** is the weakest form on that scale. And "did I
apply a mental rule" is the **covert** category self-report handles worst.

**Consequence: `applied_rule` must not gate success.** Kept as telemetry, never as a criterion.

## 3. `cp_loss ≤ 30` does not evidence rule use either

A player can find the best move for reasons unrelated to their rule. Showing the rule is doing work
needs **discrimination**: positions that do *not* instantiate the trigger, interleaved. If accuracy
is equally good on both, the rule explains nothing.

The cautionary case is in the product's own domain. Sala & Gobet (2017, *Current Directions in
Psychological Science* 26(6), 515–520) report that across chess, music and working-memory training,
effects measured against **passive** controls (0.25 SD for music, k = 64) collapsed against
**active** controls (0.03 SD [−0.07, 0.12], k = 54). Chess had exactly one active-control study:
**0.10 SD**. The methodological lesson transfers even though the topic does not — the app has no
control condition of any kind.

## 4. Showing the rule before asking for it: an architectural defect with a standards name

| | |
| --- | --- |
| **Claim** | Immediate performance is not a measure of learning, and re-exposure when retrieval strength is already high produces minimal learning. |
| **Result** | "Current performance is not a reliable index of learning, which can only be measured by recall after a delay." And: "the higher the current level of retrieval strength… the smaller the gain in storage strength." |
| **Source** | Bjork & Bjork (2023), *In Their Own Words*, APA Division 2 |

| | |
| --- | --- |
| **Claim** | Testing beats restudy at g = 0.50 — **but with no feedback and initial retrieval ≤50%, the effect is zero.** |
| **Method** | 159 effect sizes, random-effects meta-analysis. |
| **Result** | Overall **g = 0.50 [0.42, 0.58]**. No feedback g = 0.39 vs feedback g = 0.73. **Retrieval ≤50% with no feedback: g = 0.03 [−0.21, 0.27], p = .79.** Retention ≥1 day g = 0.69 vs <1 day g = 0.41. |
| **Limitation** | High heterogeneity; the ≤50% cell is k = 17. |
| **Source** | Rowland (2014), *Psychological Bulletin* 140(6), 1432–1463 |

The defect has a formal name. The What Works Clearinghouse single-case standards:

> **Not overaligned.** "Overalignment occurs when an outcome measure contains content or materials
> provided to the cases in one condition but not another."

> **Face validity.** "A measure described as a test of reading comprehension that only assesses
> reading fluency does not demonstrate face validity."

In Messick's (1995) terms this is **construct-irrelevant variance** — score variance owed to
something other than the construct.

**Addressed in `f5f6fe6` and `c507a15`:** the rule is no longer shown beside the test button, and
both observations are frozen before the reveal. **Not yet addressed:** feedback after the recall
attempt, which Rowland's moderator makes load-bearing rather than optional.

## 5. Preregistration, optional stopping, and how many positions a verdict needs

| | |
| --- | --- |
| **Claim** | Undisclosed flexibility — including deciding when to stop collecting — inflates false positives far past nominal. |
| **Method** | Monte Carlo over four researcher degrees of freedom. |
| **Result** | All four combined: significance at the 5% level **60.7%** of the time. |
| **Limitation** | Group-design simulation. The ~22% figure for optional stopping alone is from secondary sources; the 60.7% is from the abstract. |
| **Source** | Simmons, Nelson & Simonsohn (2011), *Psychological Science* 22(11), 1359–1366 |

"Abandon and restart" is optional stopping plus condition-dropping, undisclosed by construction if
the abandoned run leaves no trace. **Addressed in `c507a15`** — one transfer in flight per rule,
resumed rather than replaced.

**Standards that were read directly:**

- **WWC Handbook v5.0** — ≥6 data points in the initial baseline phase; interassessor agreement on
  **≥20% of data points**, meeting **≥.80 percentage agreement or ≥.60 Cohen's κ**, collected in
  each phase.
- **SCRIBE 2016** (Tate et al., *Neuropsychological Rehabilitation* 27(1), 1–15) — item 5: state
  whether phases were determined a priori or data-driven; item 6: describe any procedural changes
  during the investigation; item 20: report **the sequence actually completed**.

**Three positions is below every standard cited here.** Either the trial count rises or the word
"transferred" goes.

## What is genuinely unavailable

- **Automated same-motif retrieval exists and is validated on this app's own domain** — Bizjak &
  Guid (2021), BM25 over static and dynamic position features, ground truth 400 expert-curated
  pairs, tested on 46,370 lichess-derived puzzles. But **top-1 accuracy is 0.481** (top-5 0.736,
  top-10 0.814), and static features alone are 0.252. So it may *propose* trigger-matched
  positions; it may not assert that a position instantiates a trigger.
- **For positional or strategic triggers there is no validated automated similarity method at all.**
  A genuine gap, not a gap in this review.
- Automated free-recall scoring reaches human-comparable reliability (van Genugten & Schacter 2024,
  r = .67–.89 against human raters) **only where a human-defined rubric and a human-scored
  validation set exist.** Both papers kept the human rubric; the model applied it.

## The bottom line this changed in the code

Three of the five areas say one thing in different vocabularies — Roediger & Karpicke call it
idea-unit scoring with reported reliability, the WWC calls it face validity and overalignment,
Bjork & Bjork call it the difference between performance and learning. **`banana` scoring 3/3 is
not an edge case to patch. It is the predicted output of a measure with no scoring key, no delay
discipline, and no control condition.**

None of the five areas concludes the construct is unmeasurable. What they say is that each fix
requires a rubric and a reported agreement number **first**. Until those exist the defensible
position is: keep running the test, keep collecting the data, and **do not render a verdict the
evidence cannot carry.**

## Verification flags

- **Could not access:** CENT 2015 (BMJ h1738, h1793) and SPENT 2019 (BMJ m122) checklist item text
  — BMJ returned 403 through the proxy. Structure confirmed via EQUATOR; item-level content
  unverified, so recommendations here rest on WWC and SCRIBE, which were read directly.
- **Secondary-source only:** Chase & Simon's 2-second chunk boundary; Glanzer & Cunitz (1966);
  the ~22% optional-stopping figure; Messick's definitions; the WWC "≥3 demonstrations" criterion.
- **Weak evidence, flagged where used:** Kleiman et al. (2025) is a conference abstract, n = 28.
- **Do not over-extend:** Sala & Gobet concerns chess instruction → external cognitive outcomes,
  not within-chess tactical transfer. It is cited for its methodological lesson about active
  controls, nothing else.
