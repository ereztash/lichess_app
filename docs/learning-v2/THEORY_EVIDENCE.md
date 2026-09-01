# Verification ledger

**Every load-bearing citation was checked against the publisher record, a DOI index or an official
help page in this pass.** Anything not checked is marked `UNVERIFIED` and may not carry a claim.

The rule this file exists to enforce: **an effect size measured in another domain is not a
prediction about chess.** Each row below states what the source licenses *here*, which is almost
always narrower than what it measured.

## Source hierarchy used

1. systematic review / meta-analysis · 2. preregistered or strong controlled study ·
3. field/longitudinal · 4. official product documentation · 5. open-source implementation ·
6. repeated user-feedback signal · 7. individual anecdote

---

## Verified

| # | source | what it actually found | tier | what it licenses **here** |
| --- | --- | --- | --- | --- |
| V1 | **Pan & Rickard (2018)**, *Psychological Bulletin* 144(7) 710–756 | 192 transfer effect sizes, 122 experiments, 67 articles, N=10,382. Transfer vs non-testing reexposure **d = 0.40 [0.31, 0.50]**. Moderators: **response congruency**, elaborated retrieval, initial test performance | 1 | that retrieval *can* transfer, and that the format of the practised response is a named moderator. **Not** a predicted effect size for chess |
| V2 | **Brunmair & Richter (2019)**, *Psychological Bulletin* | 59 studies, 238 effect sizes, 158 samples. Interleaved over blocked **g = 0.42**; title finding is *"similarity matters"* — largest where categories are confusable, not uniform across materials | 1 | that a contrast set is the right shape *if* the difficulty is discrimination. **Not** that interleaving helps here |
| V3 | **Wisniewski, Zierer & Hattie (2020)**, *Frontiers in Psychology* 10:3087 | 435 studies, k=994, N>61,000. Feedback overall **d = 0.48**, with substantial heterogeneity; impact substantially moderated by **information content**; larger for cognitive/motor than motivational/behavioural outcomes | 1 | that feedback is **not one treatment** and that its content, not its delivery, carries the moderation. Directly relevant to H1/H2 |
| V4 | **Soderstrom & Bjork (2015)**, *Persp. Psych. Science* 10(2) 176–199 | Learning vs performance; certain manipulations have **opposite** effects on the two. Performance during training is an unreliable index of learning | 1 | the prohibition on using immediate performance, accuracy or completion as the target. This is the methodological spine of the whole programme |
| V5 | ***Contemporary Educational Psychology* 79 (2024)**, "Effects of self-explaining feedback on learning from problem-solving errors" | 2×2 between-subjects (feedback standard/redesigned × self-explanation yes/no). Self-explanation supported **error correction and near transfer**; scaffolding raised explanation quality; **redesigning the feedback layout did not affect learning**; far transfer not improved | 2 | the single most direct evidence on presentation-vs-activity. One study, one task — it does not settle chess, and its far-transfer null is as important as its near-transfer positive |
| V6 | ***Eur. Rev. Social Psychology* 36(1) (2024)**, `10.1080/10463283.2024.2334563` | **642 independent tests**; .27 ≤ d ≤ .66. Larger with a **contingent if–then format**, high motivation, and **rehearsed** plans | 1 | that the if–then *form* and its *rehearsal* are separable and both matter. Measures whether a plan is enacted — **not whether enacting it was correct** |
| V7 | **Southwick, Harwell, Wright, Olsen & Ogles (2026)**, *Psychological Science*, `10.1177/09567976261452568` | N=44,213 Chess.com players, time-stamped. **>90% of time on games**; deliberate-practice-aligned activity associated with **3.61×** learning efficiency | 3 | a hypothesis about where time goes. **Observational cohort — 3.61 is not a coefficient** and enters no arithmetic |
| V8 | **Einstein & McDaniel**, multiprocess framework; *Focal/nonfocal cue effects* (PMC2864946) | Retrieval is **spontaneous** for focal cues — where the ongoing task already processes the cue's features — and requires **strategic monitoring** for nonfocal cues. Focal remembering was high *without* monitoring, and monitoring added nothing | 1–2 | **the precondition for the target construct.** "Uncued transfer" = spontaneous retrieval, which the framework says requires a focal cue. See [`BARRIER_MODEL.md`](BARRIER_MODEL.md) |
| V9 | **Expertise reversal** (Kalyuga/Sweller line; meta-analysis `S0959475225000660`) | Guidance that helps novices **degrades** performance for higher-knowledge learners; redundant guidance adds load. Fading is the prescribed response | 1 | that "more guidance" and "less guidance" are both wrong as general rules, and that any fading schedule must be keyed to prior knowledge the product does not currently estimate |
| V10 | **WWC Single-Case Design Standards v5** | Multiple-baseline: **5+ data points in each of 6+ phases** for *without reservations*; **3 demonstrations of effect** plus at least one demonstration of non-effect → Moderate Evidence | 1 (standard) | the design shape available at n = 8–30. Its phase requirements are a **cost**, quantified in [`EXPERIMENT.md`](EXPERIMENT.md) |
| V11 | **FSRS / Anki** (official FAQ + technical description) | Optimises **retrievability and stability** to schedule reviews. Its authors state explicitly that it **does not and cannot assess card content quality** — that data is not even collected | 4–5 | that a best-in-class scheduler has **no opinion on whether the rehearsed content is true.** The clearest external support for a content-validity gate |
| V12 | **Khan Academy Mastery** (official help centre) | Mastery levels from % correct on exercises; external validation by **correlation with MAP Growth** | 4 | that the industry's most-cited mastery system validates against a *same-format cued* assessment. No uncued transfer test |
| V13 | **Chessable MoveTrainer** (official support + blog) | SM-2-derived scheduler with ease tweaks; the reviewed object is a **move in a position**, and the response is **playing the move** | 4 | that the leading chess-learning product is already **response-congruent**, and is fully **cued** (the position is presented). See H4 and [`INTERVENTION_COMPARISON.md`](INTERVENTION_COMPARISON.md) |

| V14 | **`docs/measurement/RULE_CLASS_SEARCH.md`** (this repository, merged after the first draft of these files) | Ten candidate rule classes plus two anchors, 180,000 positions, same seed and harness. **`RC-06 answer-the-mate-threat` is ELIGIBLE**: `B_valid` .968 (T+) vs .200 (T−), separation +0.768 vs the refuted incumbent's +0.600; prescribed act = engine's best on **242/242**; following it costs a median **+1 cp** and loses ≥100 cp on **2.9%** (incumbent: 14%). *d′* orders rating bands monotonically, 1.180 → 1.666. Nine of ten candidates scored below the refuted incumbent | 2 | **that a behavioural signature of rule use exists for at least one rule class.** This is what changed the verdict of [D24](../decisions/D24-learning-architecture.md) from MEASUREMENT-BLOCKED to NARROW |
| V15 | the **C8 literature search** inside V14 | Validated, expertise-sensitive paradigms exist for check detection, mate detection and threat detection. **"Every one measures whether the player SAW it. None measures whether the seeing governed the move."** | 1–2, `UNVERIFIED` for the individual papers | the selection of [`EXPERIMENT.md`](EXPERIMENT.md). The detection→action arrow is unmeasured in the literature *and* is where this research independently placed the failure |

## Not verified in this pass — may not carry a claim

| source | why it is here | status |
| --- | --- | --- |
| Springer *Educ. Psych. Review* (2026) retrieval vs worked examples, `10.1007/s10648-026-10169-w` | named in the earlier brief; would bear on sequencing | `UNVERIFIED` |
| Springer *Educ. Psych. Review* (2025) guidance fading, `10.1007/s10648-025-10071-x` | superseded here by V9, which was verified | `UNVERIFIED` |
| AERA/APA/NCME *Standards* (2014) | already adopted at tier A in `docs/measurement/EVIDENCE_MANIFEST.json`; not re-verified here | inherited |
| Barnett & Ceci (2002); Dhami, Hertwig & Hoffrage (2004) | already adopted at tier A in the same manifest | inherited |
| Roediger & Karpicke (2006); van Genugten & Schacter (2024) | cited **inside `shared/recall-score.ts`** as the standard that file admits it does not meet | inherited, and see [`BARRIER_MODEL.md`](BARRIER_MODEL.md) |

## What no source in this table establishes

- That any of these mechanisms produces **uncued, delayed, context-appropriate transfer in chess**.
  V14 makes a *cued* discrimination measurement sound for one rule class; it does not create the
  uncued measurement, and V15 says nobody else has either.
  Every verified transfer result above is measured on cued or near-transfer criteria.
- That a mechanism which raises transfer also raises adherence. V4 predicts the opposite is possible.
- That strengthening a rule is safe. V6 measures **enactment**, V11 states its scheduler is
  **content-blind**, and neither speaks to whether the rehearsed rule is true.
