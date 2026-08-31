# What already exists, and what it would cost to use it

**Question this file answers:** before designing anything, is there a validated instrument,
paradigm, analysis method or implementation that already measures what we want to measure — or
that measures something close enough that adapting it is cheaper and safer than inventing?

**The rule this file is written under, twice, because it is the one most often broken:**

> An open-source implementation is **not** evidence that a measure is validated.
> A validated measure in a different context is **not** automatically valid after adaptation.

Every row therefore carries two separate columns for those two things, and a third — *adaptation
validity risk* — that says what specifically breaks when the measure is moved into chess.

Evidence tiers are the ones in [`EVIDENCE_MANIFEST.json`](EVIDENCE_MANIFEST.json): **A** standards
and systematic reviews, **B** validated paradigms, **C** individual studies, **D** reference
implementations tied to published methods, **E** mature implementations without direct validation
evidence, **F** blogs and product claims. **D–F can justify an implementation choice and cannot
establish construct validity.**

---

## Search order, and why it was that order

Standards → published paradigms → GitHub. Not the reverse. Searching implementations first finds
the thing that is easiest to install rather than the thing that measures the construct, and the
whole failure mode this program exists to avoid is a proxy chosen for availability. Twelve silos
were searched: signal detection theory; discrimination learning and stimulus control; prospective
memory and spontaneous retrieval; transfer of learning; educational and psychological assessment
validation; single-case experimental design; psychophysics; expertise research; chess cognition;
representative and ecological task design; measurement reactivity; item-response and psychometric
calibration.

---

## The audit table

| construct | instrument / paradigm | published validation | open implementation | intended population / context | what it measures | what it does **NOT** measure | adaptation required | adaptation validity risk | verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| validity of a score interpretation | **AERA/APA/NCME *Standards* (2014)** + **Kane's argument-based validation**; operationalised by **Cook et al. (2015)** | **A.** The consensus document of three professional bodies; Kane's framework is the field's dominant account of what a validity claim is | n/a — it is a standard, not a tool | any test whose scores inform a decision | the structure an argument must have: scoring → generalisation → extrapolation → implications, each with stated assumptions | nothing empirical by itself; it does not supply a number | write the chain for *this* task and this use | none — using it is the low-risk act. The risk is in **not** using it | **USE.** [`INTERPRETATION_USE_ARGUMENT.md`](INTERPRETATION_USE_ARGUMENT.md) is this row |
| discrimination separated from response bias | **Signal detection theory**, yes/no task; **Stanislaw & Todorov (1999)** formulae, **Hautus (1995)** loglinear correction | **B.** Sixty years of use; the formulae are the reference paper for the whole field | scipy/numpy suffice; ported here to `research/measurement/sdt.{py,ts}` under `PORT_AFTER_EQUIVALENCE` | any binary detection task with signal and noise trials | *d′* (sensitivity) and *c* (criterion) as separate quantities | **anything about whether the two trial types were exchangeable.** Confounded item sets produce a large, stable, meaningless *d′* — see [F5](FALSIFICATION_REGISTER.md#f5) and `itemDifficultyConfound` | define what a noise trial is in chess; choose a correction and state it | **High, and not where it is usually looked for.** SDT is sound; the risk is that adopting it feels like solving the item problem. It does not touch it | **USE — for the arithmetic only.** Never as the answer to F2 |
| discrimination with the criterion largely removed | **2AFC / forced-choice**, same literature; *d′*₂AFC ≈ √2 · *d′*ʸⁿ under the equal-variance model | **B.** The standard psychophysical answer to criterion contamination | jsPsych/PsychoPy plugins | perception, memory, any two-interval judgement | which of two displays contains the signal | **whether the knowledge controls action when nobody asks.** A forced choice *is* a cue that the rule is relevant | present matched T+/T− board pairs, ask which contains the condition | **High as a replacement, low as a reference.** Replacing the natural task with 2AFC would substitute recognition-under-instruction for spontaneous control, which is the exact construct swap the telos forbids | **ADAPT — as a convergent reference task only**, per [F6](FALSIFICATION_REGISTER.md#f6). Never as the primary outcome |
| behaviour under a conditional rule | **Conditional discrimination / stimulus control** (matching-to-sample, contextual control) | **B.** Core experimental-analysis-of-behaviour paradigm; "if A1 then B1, if A2 then B2" is exactly the structure of a rule class | PEBL and other batteries have MTS tasks | typically non-verbal or developmental populations, arbitrary stimuli, many trials with reinforcement | whether a *specific* stimulus dimension controls responding, and it tests this by **probing with novel stimulus arrangements** | performance in a rich task with competing controlling relations | replace arbitrary stimuli with chess positions; there is no reinforcement schedule in a puzzle | **Moderate.** The paradigm's power comes from stimuli whose only relevant dimension is the trained one. Chess positions have dozens of relevant dimensions at once — which is precisely why [F3](FALSIFICATION_REGISTER.md#f3) found competing explanations | **ADAPT THE LOGIC, NOT THE TASK.** Its transfer-probe discipline (never score a probe you also trained on) is adopted in [`ITEM_BANK_PROTOCOL.md`](ITEM_BANK_PROTOCOL.md) |
| knowledge acting without a prompt | **Prospective memory**, multiprocess framework (Einstein & McDaniel 2005; McDaniel & Einstein 2000) | **C→B.** A large, replicated literature with an explicit monitoring / spontaneous-retrieval distinction | jsPsych PM paradigms exist as community plugins | lab ongoing-task paradigms, sometimes VR | whether an intention is retrieved *without* being cued, and at what cost to the ongoing task | chess-specific competence | the ongoing task becomes "play/choose a move"; the PM cue becomes the board condition | **Moderate-high.** PM's classic finding is that telling participants a cue matters *changes the process from spontaneous retrieval to monitoring*. Any measurement UI that hints the rule is being tested measures a different construct | **USE THE DISTINCTION.** It supplies the L0–L5 ladder's dividing line between cued and uncued, and the non-negotiable "the game supplies the cue, the UI does not" |
| how far a skill travels | **Barnett & Ceci (2002) far-transfer taxonomy** | **A.** The standard framework; also the standard warning that far transfer usually fails | n/a | education, cognitive training | *specifies the distance*: content (learned skill, performance change, memory demands) × context (knowledge domain, physical, temporal, functional, social, modality) | whether transfer happened | place each measurement level on the nine dimensions | none for the taxonomy itself | **USE.** It is the spine of [`ECOLOGICAL_EXTRAPOLATION_GAP.md`](ECOLOGICAL_EXTRAPOLATION_GAP.md) |
| does being measured change behaviour | **Question-behaviour / mere-measurement effect**; Rodrigues et al. (2015) meta-analysis (SMD ≈ 0.09); mere-measurement of PROs meta-analysis (RR ≈ 1.17) | **A.** Two independent meta-analyses; the effect is small but non-zero and real | n/a | health behaviours, self-report | that asking about a behaviour changes it | the size of the effect in a *skill* domain with repeated trials — the literature is about intention and self-report, not about a discrimination measured 40 times | build a measurement-only arm | **High, in an unusual direction.** The published effect is small; the risk here is *larger*, because a T+/T− block is not one question — it is dozens of exposures to the exact contrast being taught | **USE AS THE REASON FOR A DESIGN**, not as an effect size to borrow. See [F7](FALSIFICATION_REGISTER.md#f7) |
| did an intervention cause a change, with few participants | **WWC Single-Case Design standards v5**; multiple-baseline designs | **A.** The federal evidence standard for SCD: systematic manipulation of the independent variable, ≥ 3 demonstrations of effect at 3 different points in time, visual analysis on level, trend, variability, overlap, immediacy and consistency | **`SingleCaseES`** (Pustejovsky et al. 2024, D); **`scan`** (Wilbert & Lueke, D) — overlap indices, between-case SMD, randomisation tests, multiple-baseline plotting | special education, clinical behaviour analysis | whether a phase change is attributable to the manipulation rather than to time | anything about a population; SCD generalises by replication, not by sampling | phases become measurement blocks; "cases" become rule classes staggered in time | **Moderate.** SCD assumes repeated measurement of a *stable* baseline. Whether rule-specific discrimination has a stable baseline in chess is unknown and is itself a study | **ADOPT THE STANDARD, CALL THE PACKAGES.** No proprietary causal threshold. See [F8](FALSIFICATION_REGISTER.md#f8) |
| expert/novice difference in seeing what matters | **Sheridan & Reingold (2014)** relevance detection; **Reingold & Sheridan (2021)** | **C.** Eye-tracking studies with clear expert/novice contrasts; the check-detection task uses *minimised 4×4 boards with a king and two attackers* | no packaged implementation | chess players across a wide skill range | whether relevant configurations are fixated and identified rapidly | whether a player *acts* on what they detected in a full game | build chess-position stimuli that vary one relevant property | **This is the most useful row in the table for our F2 problem, and also the least directly usable.** Their control over confounds comes from *stripping the board down to 4×4 with three pieces*. That is exactly what makes their pairs exchangeable — and exactly what makes them not chess | **ADAPT THE METHOD (minimal transformation), REJECT THE STIMULI.** Named as the model for counterfactual pairs in [`ITEM_BANK_PROTOCOL.md`](ITEM_BANK_PROTOCOL.md); [F2](FALSIFICATION_REGISTER.md#f2) records why a full-board version is much harder than it looks |
| are the items representative of the world we care about | **Brunswik's representative design** (Dhami, Hertwig & Hoffrage 2004) | **A.** Psychological Bulletin review | n/a | judgement and decision-making | whether stimuli were sampled from the environment the inference is about | it prescribes sampling, not scoring | sample positions from real games rather than from a curated bank | **This row is why the whole audit used a random game corpus.** Puzzle banks are the opposite of representative by construction | **USE.** Applied directly: the F1 corpus is 60,000 unfiltered rated games |
| item difficulty and person ability on one scale | **Item response theory / Rasch**; Elo and Glicko are themselves latent-trait models | **A/B** in assessment | many (`mirt`, `TAM`) | large item banks with many responses per item | separating item difficulty from person ability | **it does not separate item difficulty from item *validity*.** A confounded item can be perfectly calibrated | fit a 1PL/2PL to T+ and T− items | **High and premature.** IRT needs many participants per item and assumes the items measure one thing. [F2](FALSIFICATION_REGISTER.md#f2) shows they may not | **DEFER.** Trigger: an item bank that survives F2 *and* ≥ 200 responses per item |
| chess position handling | **python-chess** | **E.** No validation claim; correctness is established by use and its own test suite | `niklasf/python-chess` | any | legality, attack maps, FEN/PGN | nothing psychological | none | none — it is a chess library, not a measure | **REUSE.** Every scan in `research/measurement/` |
| tactical adjudication | **Stockfish 17.1**, official build | **D.** Reference implementation; strength is measured, its *interpretation as "the correct move for a human"* is not | `official-stockfish/Stockfish` | engines | best move and evaluation at a stated budget | what a human should have learned, or why a human moved | run at a fixed node budget, record the build | **High if it becomes the definition of correct.** [F4](FALSIFICATION_REGISTER.md#f4) exists to stop that | **REUSE AS ONE ORACLE.** Separate field, never fused |
| static material outcome of a capture | **SEE (swap algorithm)**, Chess Programming Wiki | **E.** A well-specified algorithm, not a validated measure of anything psychological | reproduced in `oracles.py` (x-ray limitation documented) | engines | the material result of a swap-off on one square | anything on any other square — and, on an *undefended* target, **nothing at all**: SEE ≥ 0 in 100% of T+ items by construction | reproduce and test | **High if mistaken for "the capture is good".** Measured: SEE calls 37.1% of T− captures materially sound | **REUSE FOR WHAT IT IS.** It is a covariate and a T− filter, never the construct |
| puzzle items and themes | **`ornicar/lichess-puzzler`** + the Lichess puzzle database | **E.** A curation pipeline, not a validated instrument | generator / validator / tagger, all readable | Lichess users | positions where one move is overwhelmingly best, with human-reviewed quality and themes | *a position property.* Read from source: `hangingPiece` is computed **from the solution move** (`mainline[1]`) and from the material balance two plies later. The theme is a property of (position + solution + continuation) | none — the risk is in using it at all | **Circular by construction.** Defining T from `hangingPiece` would put B inside T. Separately, `generator.py::is_valid_attack` keeps only positions where the best move beats the second by > 0.7 win-chance — an extreme restriction of range | **REJECT as a source of T.** **USE as an independent label to disagree with**, which is what [F1](FALSIFICATION_REGISTER.md#f1) does |
| browser-based behavioural experiment runtime | **jsPsych** (de Leeuw et al. 2023) | **D.** Published in JOSS and BRM; thousands of studies. Validation is of the *runtime*, not of any construct | `jspsych/jsPsych` | web experiments | trial sequencing, randomisation, exact response capture, data export | nothing about chess or about validity | a board-rendering plugin | **Low.** This is a tool decision, not a measurement decision | **USE IF A HARNESS IS BUILT.** Do not re-implement trial ordering, seeded randomisation or export inside the product |
| millisecond-accurate stimulus timing | **PsychoPy2** (Peirce et al. 2019) | **D.** Published; sub-millisecond precision in the timing mega-study | `psychopy/psychopy` | lab psychophysics | precise onset/offset and response latency | anything, if timing is not the measurement | a desktop lab task | **Low technically; high in opportunity cost.** Response time is explicitly a *secondary* variable here | **REJECT for now.** Trigger: a hypothesis in which latency is the dependent variable |
| single-case effect sizes | **`SingleCaseES`**, **`scan`** | **D.** Both implement published indices with published sampling distributions | `jepusto/SingleCaseES`, CRAN `scan` | SCD researchers | NAP, Tau-U, baseline-corrected Tau, LRR, between-case SMD, randomisation tests | whether the design earned a causal claim — that is the standards' job | feed measurement blocks as phases | **Moderate.** Non-overlap indices on a *rate* outcome behave differently than on a count; which index fits an SDT outcome is an open question recorded in [`ANALYSIS_PLAN.md`](ANALYSIS_PLAN.md) | **CALL, DO NOT REWRITE.** Explicitly: no proprietary "transfer score" |

---

## What the audit found that changes the design

**1. There is no existing validated instrument for "rule-specific conditional behavioural
discrimination in chess."** Nothing in twelve silos measures it. The closest things are Sheridan &
Reingold's relevance-detection tasks — which achieve their control by reducing the board to
4×4 — and conditional-discrimination probes from behaviour analysis, which achieve theirs by using
stimuli with one relevant dimension. **Both buy exchangeability by removing chess.** That is the
central tension of this whole program and it is not resolved by choosing better software.

**2. The one thing that looked most like a ready-made item bank is the one thing that cannot be
used to define the construct.** `hangingPiece` is computed from the solution move. Using it to
label T would place B inside T.

**3. Two candidate components are validated, available, and should simply be called:** the SDT
arithmetic (Stanislaw & Todorov / Hautus) and the single-case analysis packages. Neither of them
touches the construct problem, and it would be easy to mistake adopting them for progress on it.

**4. The strongest available design idea is Sheridan-style minimal transformation**, and
[F2](FALSIFICATION_REGISTER.md#f2) reports what it costs on a full board.

---

## What was searched and found nothing usable

- **Psychophysics adaptive procedures** (staircases, QUEST). They estimate a threshold on a
  *continuous* stimulus dimension. "Unprotected-ness" is binary; there is no intensity to titrate.
- **Chess-specific validated test batteries.** None found. Chess research uses rating as the
  ability measure and builds bespoke tasks per study.
- **PEBL.** Its battery contains no task whose adaptation would be shorter than building the
  chess task directly.
- **Existing "chess improvement" measurement products.** Tier F throughout; accuracy, CP-loss and
  puzzle rating, i.e. the proxies the epistemic rule refuses. Cited nowhere.
