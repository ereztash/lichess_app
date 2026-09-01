# Multilingual evidence

**The honest headline first: no non-English source is load-bearing for D25.** Execution 1's verdict
turns on measurements made in this repository against its own corpus. Nothing below changes it, and
recording otherwise would be padding a decision with citations that did not contribute to it.

What the searches *did* produce is a set of sources that become load-bearing **if and only if** a
later execution is unlocked — and one null result that is worth as much as any of them.

**Quality tiers**, following the repository's existing convention: `T1` primary peer-reviewed source
read directly; `T2` primary source located, abstract/landing page read, full text not obtained in
this run; `T3` secondary or encyclopaedic summary; `T4` unverified.

---

## Russian — `ориентировочная основа действия`

**ORIGINAL TITLE:** Теория планомерно-поэтапного формирования умственных действий и понятий
П. Я. Гальперина · **LANGUAGE:** Russian · **QUALITY: `T3`** (Большая российская энциклопедия;
primary: Гальперин П. Я., «Опыт изучения формирования умственных действий», *Вестник Московского
университета. Серия 14. Психология*, 2017 №4, 3–20 — `T2`).

**METHOD:** theoretical framework with an associated instructional programme.
**SAMPLE:** not a single study; a research tradition.
**RESULT:** three **types of orienting basis of action** (ООД), classified by completeness
(полная / неполная), generality (частная / общая) and how it was acquired (given ready-made vs formed
independently), with a six-stage formation scale beginning with motivational basis and the *schema of
the orienting basis*.

**WHAT IT SUPPORTS:** that *orientation* is a nameable, manipulable object of instruction, and that
its **completeness** is the variable — which is a sharper claim than "orientation matters", and maps
onto [`MODEL_COMPARISON.md`](MODEL_COMPARISON.md)'s observation 5 (a generic cue supplies part of an
incomplete orienting basis).

**WHAT IT DOES NOT SUPPORT:** any measurement. ООД is defined by what the instruction provides, not
by what the learner is observed to do, so it does not supply an observable that separates M0 from M1.

> **THE NULL RESULT, RECORDED BECAUSE IT IS EVIDENCE.** The search for Гальперин's framework applied
> to chess returned, verbatim: *«конкретно о применении этой теории к обучению шахматам информация не
> найдена»* — no information found on applying this theory to chess instruction. **The vocabulary
> that maps most elegantly onto this product has no located chess application.** Under the
> programme's own rule — *do not import a theory merely because its vocabulary maps elegantly onto
> the product* — this is the single most relevant multilingual finding of the run.

## French — `didactique professionnelle`

**ORIGINAL TITLE:** *Du couple conceptuel « situation/schème » (Gérard Vergnaud) à celui de
« structure conceptuelle de la situation / modèle opératif du sujet » (Pierre Pastré)*, *Bulletin de
psychologie*, 2022/4 · **LANGUAGE:** French · **QUALITY: `T2`** (with *La Didactique
professionnelle : origines, fondements, perspectives*, *Travail et Apprentissages* 2008/1, `T2`).

**METHOD:** conceptual analysis over a corpus of workplace-activity studies.
**SAMPLE:** professional-training settings — industrial process control, agriculture, driving.
**RESULT:** a *schème* is *«organisation invariante de l'activité pour une classe de situations
donnée»* and is intelligible **only as a couple with the situation**. Pastré replaces the pair with
*structure conceptuelle de la situation* / *modèle opératif du sujet*, the first being the organising
concepts of the situation, the second the subject's operative model of it.

**WHAT IT SUPPORTS:** the exact separation
[`KNOWLEDGE_REPRESENTATIONS.md`](KNOWLEDGE_REPRESENTATIONS.md) makes between the domain-side object
(the rule class, its trigger and its permitted set) and the person-side object (`DecisionScheme`).
Pastré's move is the same move, made for the same reason, in a field that had already tried
conflating them.

**WHAT IT DOES NOT SUPPORT:** that the person-side model is *observable* from outcomes. In
didactique professionnelle the *modèle opératif* is reconstructed from **autoconfrontation** — the
subject commenting on video of their own activity — which is a laboratory instrument and is
Execution 2 material.

## Japanese — 将棋 思考過程

**ORIGINAL TITLE:** 将棋棋士の直観の脳科学的研究（将棋プロジェクト）, RIKEN Brain Science Institute;
and プロ棋戦における感想戦の存在意義 · **LANGUAGE:** Japanese · **QUALITY: `T2`/`T3`**.

**METHOD:** verbal protocol analysis (発話プロトコル) across skill levels; fMRI; a four-month training
study on simplified 5×5 shogi.
**SAMPLE:** professional 棋士, amateurs, and novices trained over four months.
**RESULT:** three findings, and the first is the one that matters here — **professionals read
narrowly and deeply over a small number of moves, while intermediate players read broadly**, with
rough evaluation preceding formal analysis. Second, board configurations from real games are recalled
as meaningful chunks while random arrangements are not. Third, novices trained for four months
developed the same intuitive circuitry as professionals.

**WHAT IT SUPPORTS:** that **candidate generation is a real point of expertise difference and moves
in the counter-intuitive direction** — experts generate *fewer* candidates. This bears directly on
[`COGNITIVE_EVIDENCE_MATRIX.md`](COGNITIVE_EVIDENCE_MATRIX.md)'s `CANDIDATE GENERATION` column and on
how `candidate_moves_considered` should be read: **a longer list is not a better process**, so any
future score over that array must not be monotone in its length.

**WHAT IT DOES NOT SUPPORT:** transfer to chess without argument (shogi has drops and a different
branching structure), and nothing about whether the narrow reading is *caused by* recognition or
*is* recognition — the M0/M1 question is untouched.

**感想戦** (post-game review between opponents) is a naturally occurring, culturally institutionalised
retrospective protocol. Recorded as the closest real-world analogue to autoconfrontation, and as a
reason to think a post-game protocol can be non-artificial. **Not evidence that it measures learning.**

## Spanish — `metodología observacional`

**ORIGINAL TITLE:** *LINCE PLUS software for systematic observational studies in sports and health*
(and *Innovaciones didácticas en Educación Física, observación con el software LINCE PLUS*) ·
**LANGUAGE:** Spanish/English · **QUALITY: `T2`**.

**METHOD:** software for systematic observational methodology.
**SAMPLE:** sport and physical-education settings.
**RESULT:** an integrated workflow — design of the observation system, coding, recoding,
**calculation of data quality**, and export to THEME/GSEQ/SAS — with asynchronous multi-observer
collaboration built in.

**WHAT IT SUPPORTS:** that inter-observer reliability belongs **inside** the coding workflow rather
than as a post-hoc check. If Execution 2 is ever run, this is the design constraint to copy.

**WHAT IT DOES NOT SUPPORT:** anything about chess, and nothing about whether a coding scheme for
move-choice episodes can reach acceptable agreement — which is exactly the open question a process
protocol would face.

## Chinese — 认知诊断 / Q矩阵

**ORIGINAL TITLE:** 认知诊断评估中Q矩阵理论及应用, 《心理科学进展》 2024, 32(6), 1010; and
认知诊断模型属性层级关系和Q矩阵的联合验证方法：面向实践的视角, 《心理学报》 2025 ·
**LANGUAGE:** Chinese · **QUALITY: `T2`**.

**METHOD:** review and methodological development.
**SAMPLE:** psychometric datasets.
**RESULT:** the Q-matrix is *「连接认知和测量的桥梁」* — the bridge between cognition and measurement —
and **its correctness is the key factor determining classification accuracy** (*「其正确性是影响认知诊断
分类准确性的关键因素」*). Estimation/correction methods split into parametric (model-based) and
non-parametric (statistical) families; applications include construct-validity evaluation and CAT
item selection.

**WHAT IT SUPPORTS:** the central claim of [`IDENTIFIABILITY_SIMULATION.md`](IDENTIFIABILITY_SIMULATION.md)
— that a learner model's identifiability is a property of the **item–attribute mapping**, decided
before any estimator is chosen. This literature has spent two decades on the problem Decision Lab
reached from the other direction.

**WHAT IT DOES NOT SUPPORT:** any of it for a **one-column** Q-matrix. Every method here presupposes
enough items per attribute to estimate a mapping. Decision Lab has one candidate item type, and it
did not survive.

## English — the identifiability results that bound the whole programme

| source | tier | what it establishes |
| --- | --- | --- |
| Gu & Xu, *The Sufficient and Necessary Condition for the Identifiability and Estimability of the DINA Model*, **Psychometrika** 84(2), 2019 (arXiv 1711.03174) | `T2` | the identifiability condition **depends only on the Q-matrix structure and is easy to verify**, and it *"would provide a guideline for designing statistically valid and estimable cognitive diagnosis tests"*. **The exact minimal form was not obtainable from an open copy in this run and is not quoted here.** |
| Zhang, DeCarlo & Ying, *Non-identifiability, equivalence classes, and attribute-specific classification in Q-matrix based CDMs*, arXiv 1303.0426, 2013 | `T2` | non-identifiability is *"a partition separating attribute profiles into groups of those with identical likelihoods"*; introduces **marginal identifiability** for individual attributes and a measure reporting the proportion of respondents for whom each attribute is marginally identifiable |
| Sheridan & Reingold, *Expert vs. novice differences in the detection of relevant information during a chess game: evidence from eye movements*, **Frontiers in Psychology** 5, 2014 | `T2` | experts detect relevant board regions faster; includes a **double-check detection task** across minimised boards |

**Zhang et al. is the one that names what this execution found.** Two learner states that would take
different interventions but produce **identical likelihoods** are one equivalence class.
[`IDENTIFIABILITY_SIMULATION.md`](IDENTIFIABILITY_SIMULATION.md) exhibits one: under a saturated
noise cell, *"correct conditional discrimination"* and *"performs B everywhere"* are in the same
class, and stay there under every observation the protocol could add.

---

## What was searched and returned nothing usable

Recorded so the search is not silently narrower than it claims.

- **Russian:** Гальперин / поэтапное формирование **applied to chess** — explicit null (above).
- **Russian:** рефлексивно-деятельностный подход applied to a measurable chess outcome — nothing
  located with a measured outcome.
- **Japanese:** 感想戦 as a *validated* learning instrument, as opposed to a described practice —
  nothing located.
- **French:** autoconfrontation applied to any board game — nothing located.
- **Spanish:** observational-methodology coding schemes for **decision-making in a turn-based
  strategic task** — nothing located; the corpus is continuous sport.

**No load-bearing claim in this execution rests on a translated secondary summary.** Where only a
secondary source was read, the tier says so.
