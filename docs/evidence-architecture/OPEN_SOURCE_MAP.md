# Open-source audit

**Licence first, because this repository is GPL-3.0** (`LICENSE`) and already conveys GPL-3.0
software correctly — `THIRD_PARTY_NOTICES.md` serves Stockfish 18.0.8's licence text and names its
corresponding source, checked by `scripts/run_gates.ts` on every `npm run verify`. Nothing below may
be imported before its licence consequence is written down here.

**`ADOPT` / `REFERENCE` / `DEFER` / `REJECT`** follow `docs/decisions/README.md`'s
`implementation_mode` vocabulary. `REFERENCE` means the `PSEUDOCODE_ORACLE` mode: it runs outside the
product.

---

## Chess and human modelling

| project | licence | maintained | actual construct | reusable mechanism | what it does **not** solve | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| [Maia](https://github.com/CSSLab/maia-chess) | **GPL-3.0** | yes | P(human move \| position), one net per Elo bucket 1100–1900 | a human-policy null instead of a uniform one | says nothing about cognition or correctness | `REFERENCE` |
| [Maia-2](https://github.com/CSSLab/maia2) | **MIT** | yes, NeurIPS 2024 | the same, unified across skill via `active_elo`/`opponent_elo` | as above, one model, `pip install maia2` | as above | `REFERENCE` |
| [Maia-3](https://github.com/CSSLab/maia3) | **AGPL-3.0** | yes | as above, UCI `SelfElo`/`OppoElo`, weights on HF | as above | **AGPL §13 would relicense this product** | `DEFER` |
| [Lichess puzzle DB + themes](https://database.lichess.org/) | CC0 (data) | yes | curated tactical items with theme tags | a large labelled corpus | **`hangingPiece` is computed from the solution move** — `c3_grade: defined-by-a-chosen-action`, so `B` sits inside `T`. Already forbidden in `STRONGEST_PERMITTED_CLAIM.json` | `REFERENCE`, never as a trigger |
| [Stockfish](https://github.com/official-stockfish/Stockfish) | GPL-3.0 | yes | value of a position/move | the value oracle the whole screen runs on | not a model of a person; **its WDL scale saturates on already-won positions** (§2.5) | **`ADOPT`, already shipped** |
| Listudy / chessli / better_tactics | AGPL-3.0 / MIT / MIT | varies | scheduling of chess *exercises* | proof that retrieval-by-playing-a-move is the field's default | none of them validate the *content*, and none measure uncued transfer | `REFERENCE` |

## Learner modelling

| project | licence | maintained | actual construct | reusable mechanism | what it does **not** solve | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| [EduStudio](https://github.com/HFUT-LEC/EduStudio) | MIT | yes (FCS 2025) | unified CD + KT library, PyTorch | model zoo and a standard data protocol | assumes a **valid Q-matrix**; supplies none | `DEFER` |
| [EduCDM](https://github.com/bigdata-ustc/EduCDM) | Apache-2.0 | yes | IRT/MIRT/DINA/FuzzyCDF/NCDM | reference implementations of the classical CDMs | same — and identifiability is a property of the Q-matrix, not of the fitter | `DEFER` |
| [pyKT](https://github.com/pykt-team/pykt-toolkit) | Apache-2.0 | yes | deep knowledge tracing benchmarks | standardised KT evaluation | KT predicts the **next response**, not which capability controlled it | `DEFER` |
| [pyBKT](https://github.com/CAHLR/pyBKT) | MIT | yes | Bayesian Knowledge Tracing + extensions | a small, well-tested BKT | BKT is **one latent skill per stream**: it cannot express the M0/M1 question at all | `DEFER` |
| CAT / CCAT | various | varies | adaptive item selection | information-maximising selection | selection assumes the measurement model is already valid | `DEFER` |

**The reason all five are `DEFER` and not `ADOPT` is one sentence, and it is the finding of this
whole execution:** every one of these libraries estimates a learner state **given** an item–attribute
mapping. Q-matrix identifiability is a property of that mapping — Gu & Xu (2019, *Psychometrika*)
show the condition "only depends on the Q-matrix structure and is easy to verify", and Zhang, DeCarlo
& Ying (2013) show that when it fails, attribute profiles collapse into **equivalence classes with
identical likelihoods**. **Decision Lab currently has one candidate item type and it is not valid.**
A Q-matrix with one column cannot separate the twelve constructs of
[`COGNITIVE_EVIDENCE_MATRIX.md`](COGNITIVE_EVIDENCE_MATRIX.md). Installing a fitter would produce
numbers immediately and mean nothing.

## Experimental systems

| project | licence | actual construct | reusable mechanism | not solved | verdict |
| --- | --- | --- | --- | --- | --- |
| [jsPsych](https://www.jspsych.org/) | MIT | browser experiment runner | trial structure, randomisation, timing, counterbalancing — exactly what Study D needs | nothing about the construct | `ADOPT` **when a human study is unlocked** |
| PsychoPy | GPL-3.0 | lab experiment runner | precise timing | heavier than a browser task needs | `REFERENCE` |
| PEBL | GPL-2.0 | psychological test battery | standard paradigms | none are chess | `REJECT` for this use |

## Process evidence

| project | licence | actual construct | reusable mechanism | not solved | verdict |
| --- | --- | --- | --- | --- | --- |
| [LINCE PLUS](https://observesport.github.io/lince-plus/) | free/open, Java | **systematic observational methodology** — coding schemes, multi-observer, data-quality statistics, exports to THEME/GSEQ/SAS | the reliability machinery: it computes inter-observer agreement as part of the workflow rather than afterwards | video coding of behaviour is not chess move choice; a coding scheme still has to be constructed and validated | `REFERENCE` — **if** Execution 2 is ever unlocked |
| [PM4Py](https://pm4py.fit.fraunhofer.de/) | GPL-3.0 | process mining over event logs | discovery and conformance checking on ordered event sequences | needs a genuine event log; **`candidate_moves_considered` is an ordered event sequence** and is the only candidate | nothing establishes that touch order is deliberation order | `DEFER` |
| [mousetrap](https://github.com/PascalKieslich/mousetrap) | GPL-3.0 | mouse-trajectory analysis of decision conflict | curvature/deviation measures as a conflict proxy | a chess board is a click target, not a two-alternative response space; the paradigm does not port | `REJECT` for this use |
| [WebGazer](https://webgazer.cs.brown.edu/) | Modified BSD | webcam eye tracking in a browser | gaze without lab hardware | accuracy is far below what the chess-expertise literature's fixation measures require | `DEFER` |

## Causal and single-case

| project | licence | actual construct | reusable mechanism | not solved | verdict |
| --- | --- | --- | --- | --- | --- |
| [SingleCaseES](https://cran.r-project.org/package=SingleCaseES) | **GPL-3.0** | single-case effect sizes, non-overlap and parametric, with SEs and CIs where the sampling distribution is known | exactly the estimator family a multiple-baseline design over 8–30 players needs | an effect size on an invalid outcome is an invalid effect size | `REFERENCE`, and the right tool when Execution 5 arrives |
| `scan` (R) | GPL-3.0 | single-case data analysis and plotting | same family | same | `REFERENCE` |
| MRT / SMART tooling | various | micro-randomised and sequential trials | designs that fit participant scarcity | **`Do not treat item count as participant count`** — the repository's own rule, and the trap these designs make easy | `DEFER` |

## Scheduling

| project | licence | actual construct | not solved | verdict |
| --- | --- | --- | --- | --- |
| [FSRS](https://github.com/open-spaced-repetition/fsrs4anki) | MIT | **when to retrieve** — stability, difficulty and retrievability, fitted per card from review history | **what to teach**, **whether it is true**, **whether it transfers.** Difficulty is inferred from the learner's own performance, so the content is never independently evaluated; it has no short-term memory model either | `DEFER` |
| Anki | AGPL-3.0 | the same, as a product | same | `REFERENCE` |

**The shipped 1/3/7/21 schedule is not to be optimised**, and FSRS is the clearest statement of why:
a scheduler is content-blind by design. Replacing 1/3/7/21 with a fitted curve would improve the
timing of the rehearsal of an **E0 sentence**.

## Future sequential policy

| project | licence | verdict |
| --- | --- | --- |
| pomdp-py | MIT | `DEFER` — a POMDP needs an observation model, and this execution establishes there is not one |
| MABWiser, contextual-bandit libraries | Apache-2.0 | `DEFER` — a bandit needs a reward, and engagement is forbidden as one |

---

## The one-line reading of the whole table

**Nothing here is blocked by tooling.** Every construct the programme needs has a maintained,
appropriately licensed open-source implementation, and two of them (`jsPsych`, `SingleCaseES`) are
the right tools already. **Every one of them takes the validity of the measurement as its input**,
and that is the thing this execution could not supply.
