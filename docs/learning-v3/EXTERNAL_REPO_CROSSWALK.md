# External ↔ repository mechanism crosswalk

**Order:** written after `FROZEN_EXTERNAL_SYNTHESIS.md` was committed (`73f4d8e`) and after
`BASELINE.md`. `scripts/learning-v3/verify_freeze.py` asserts that the commit introducing this file
is a descendant of the freeze commit; if it is not, the freeze did not hold and this document is
void.

**What this is not.** Not a summary of ten documents. Each row names a *mechanism* — something that
could be true or false about how behaviour changes — and asks four questions of the pair: where they
agree, where they contradict, what neither side has, and on whose authority the repository's half
rests.

**The rule that governs disagreements.** Where the external prior and the repository disagree, the
repository is not automatically right. It has measured more, but on a narrower question, and its
strongest documents are explicit that they measure the *instrument* rather than the *learner*. Where
they agree, the agreement is worth something only because the prior was frozen first: neither side
was written to match the other.

---

## 0. The headline, before the table

The repository reached E2's core claim independently, from a different literature, and states it
more sharply than the external synthesis does:

> **`docs/learning-v2/KNOWLEDGE_MAP.md`**, §D, on focal cues:
> *"an authored trigger must name something the player already looks at while choosing a move"* …
> *"`mechanism_class` labels are nonfocal by construction"*.

and

> **`docs/learning-v2/THEORY_EVIDENCE.md`**, V15, on the whole chess-detection literature:
> *"Every one measures whether the player SAW it. None measures whether the seeing governed the
> move."*

E2 says X must be recognizable without being told. `KNOWLEDGE_MAP` says the same thing with a
mechanism attached (Einstein & McDaniel's focal/nonfocal distinction) and then adds the finding the
external synthesis does not contain: **the repository's own trigger vocabulary fails it by
construction.** That is the single most useful thing this crosswalk found, and it is a repository
finding, not an external one.

Against that, the repository contradicts the external prior on one point that matters more than any
agreement, and it is not a matter of emphasis. See row **X-1**.

---

## 1. Mechanism crosswalk

| # | External proposition | Repo analogue | Agreement | Contradiction | Missing mechanism | Evidence authority |
| --- | --- | --- | --- | --- | --- | --- |
| **E1-a** | The minimum behavioral unit is `WHEN X → DO Y`; a description of the past error does not define an intervention | `LearningRuleComposer` elicits trigger / mechanism class / missed signal / action / exception / prediction / refutation condition. `KNOWLEDGE_MAP` §E: *"implementation intentions … the composer already has this form"* | **Strong, and structural.** The repo built the if–then form before this prior existed, and for the same reason | none | **Rehearsal of the plan.** `KNOWLEDGE_MAP` §E marks it *"the missing moderator — the plan is never rehearsed"*. V6 measures rehearsal as separable from form; the product has the form and not the rehearsal | `THEORY_EVIDENCE` V6: 642 independent tests, .27 ≤ d ≤ .66, larger with contingent if–then and **rehearsed** plans. Tier 1, verified |
| **E1-b** | `WHEN → DO` is the *minimum*; nothing smaller works | — no repo analogue. Nothing in the tree tests a smaller unit | — | — | **The comparison itself.** No arm anywhere compares explanation-only against `WHEN → DO`. `F-E1-a` is `NOT EXECUTABLE` | none. E1-b is carried as an assumption |
| **E2-a** | X must be recognizable *before* the decision, without engine output | `KNOWLEDGE_MAP` §D focal vs nonfocal; `BARRIER_MODEL` §6 *"the learner knows the policy but does not notice when the condition is present"* | **Exact.** Independently derived from prospective-memory theory | none | — | V8 (Einstein & McDaniel, multiprocess framework). Tier 1–2, verified |
| **E2-b** | If the learner cannot spontaneously distinguish X from nearby non-X, the packet needs a boundary contrast | `INTERVENTION_COMPARISON` ranks **K focal-trigger constraint Σ=35, highest of eleven**, and **B T+/T− contrastive practice** highest on construct relevance (5) | **Strong** | none | — | `INTERVENTION_COMPARISON`, scored against ten criteria. Internal ranking, not measurement |
| **E2-c** | *(implied)* the product's existing triggers satisfy E2 | `KNOWLEDGE_MAP` §D: *"`mechanism_class` labels are nonfocal by construction"* | — | **Repo contradicts the implication.** The shipped taxonomy (`threat_scan`, `time_allocation`, …) is a set of *categories the system reasons in*, not things a player looks at while choosing a move | **A focality criterion.** Nothing in the code decides whether an authored trigger is focal. `MECHANISM_CLASSES` is a free choice from a fixed list | `KNOWLEDGE_MAP` §D against V8. **This is the strongest repo-native argument for a `GATE-CUE-PLAYER-OBSERVABLE`** |
| **E3-a** | `InformationNeededToInfer ≫ InformationNeededToAct` | `docs/INERTIAL_UX_LAWS.md` LAW 6 *"details never carry the main meaning"*; progressive disclosure is repo law; `FindingCard` is constrained to one thing, one example, one authority, one next action | **Strong** | none | — | Repo law, enforced by `GATE-DECISION-FOCUS`, `GATE-ONE-PRIMARY-ACTION`, `GATE-NO-DUPLICATE-ACTION` and the layout suite. **Executable**, not merely written |
| **E3-b** | Do not expose statistical machinery merely because it produced the recommendation | `THEORY_EVIDENCE` V5: *"redesigning the feedback layout did not affect learning"*; V3: feedback impact moderated by **information content**, not delivery | **Agreement with a warning attached.** The repo's sources say the same and add that improving the *presentation* is not where the effect lives | none | — | V3 (435 studies, k=994, N>61,000) and V5 (2×2 controlled). Tiers 1 and 2, verified |
| **E4-a** | Three layers: behavioral core / trust `WHY YOU` / evidence instrumentation | `shared/evidence-authority.ts` `AUTHORITY` table: five levels, each with `settled` and `mayPrescribe`, and `mayPrescribe` **only** at `tested` | **Convergent in spirit**, and the repo's version is finer: it separates *settled* from *prescribable*, so `refuted` is both settled and unprescribable | none | — | Shipped code with tests (`one-word-for-how-much-this-counts.test.ts`) |
| **E4-b** | `WHY YOU` is plausible but **not established as causally necessary** | No repo analogue: there is no personal-evidence sentence anywhere, and no arm that would tell | **Agreement by absence** — the repo has not assumed it either | none | **The whole `WHY YOU` comparison.** `F-E4-a/b/c` are `NOT EXECUTABLE` | none |
| **E4-c** | The evidence layer should be available by disclosure but is not presumed necessary | `mayPrescribe` at `FindingCard.tsx:135` | **Weak agreement, and the weakness is the finding.** `mayPrescribe` renders one Hebrew restraint sentence — *"this is still not a reason to change anything"* — and gates **nothing** | — | **Enforcement.** It is its only use in the tree. It does not gate the composer, the retrieval schedule, or the transfer runner. `D24` recorded this and `D25` says the finding survives | Derived here: `grep -rn mayPrescribe` returns 6 declarations in `evidence-authority.ts` and **one** consumer |
| **E5-a** | The primary outcome cannot be insight viewed / dwell time / usefulness / puzzle solved / immediate accuracy / rule recalled / button clicked | `THEORY_EVIDENCE` V4 (Soderstrom & Bjork) is called *"the methodological spine of the whole programme"*; `KNOWLEDGE_MAP` §F *"knowing vs doing … the whole mission"* | **Exact, and load-bearing on both sides** | none | — | V4, tier 1, verified. Also `forbidden_claims` in `STRONGEST_PERMITTED_CLAIM.json`, which bans *"puzzle-task improvement implies improvement in ordinary play"* |
| **E5-b** | The endpoint is `P(Action | Cue, intervention)` on a naturally occurring decision | `D24`'s CLAIM UNDER EXAMINATION, quoted verbatim in `BASELINE.md` §9, is the same sentence including the trigger-negative half | **Exact.** Two independent derivations of one construct | none | **The hook.** `BARRIER_MODEL` §11: *"ordinary Blitz currently has no rule-opportunity hook"* | `D24`. Verdict `NARROW` superseded by `D25`; the construct statement is not |
| **E5-c** | Must be checked under trigger-negative conditions; a rise in both is criterion shift | `BARRIER_MODEL` §8; `CRITERION_CHANNEL.md` in full; `KNOWLEDGE_MAP` §D conditional discrimination *"both halves must be measured"* | **Exact** | none | **Negative items in the product.** `BARRIER_MODEL` §8: *"Negative items are still absent from the product's learning loop"* — present in the research corpus, absent from the loop | `CRITERION_CHANNEL.md`, re-derived by `research/learning/criterion_channel.py`, which fails if either input moves |

---

## 2. Where the repository contradicts the external prior

### X-1 — E5's endpoint may be unmeasurable in principle here, not merely unmeasured

This is the row that matters most, and the external synthesis contains nothing like it.

`STRONGEST_PERMITTED_CLAIM.json`, `underidentified.conditional_discrimination_vs_response_bias`:

```text
classifier: Bayes-optimal likelihood ratio handed the true generative model of both hypotheses
separation, every observation set tried:            0.500
  move only / both cells / + time / + timed condition
  / + delayed condition / + generic cue / + candidate set
at double the items:                                0.500
the same pair under a NON-saturated noise cell:     0.983
```

Correct conditional discrimination and *perform-B-everywhere* response bias are **observationally
equivalent** under a saturated noise cell — to a classifier that has been handed the truth, which is
an upper bound no real analysis can exceed. E5 says to measure `P(Y|X)` and `P(Y|¬X)` and compare.
The repository's answer is that on a saturated class **the comparison carries no information at
all**, and that this is a property of the item set, not of the sample size.

E5 is not refuted. It is **conditioned**: it is a valid endpoint *only on a rule class whose
trigger-negative cell is not saturated*. That condition is now `C11`, and it eliminated 10 of 17
classes. Every falsifier in `FALSIFICATION_REGISTER.md` that names ΔP(Y|X) inherits this condition,
and `F-E5-a` in particular cannot be evaluated on a saturated class no matter how many players are
recruited.

### X-2 — the mission's own A-FAIL remedy is a forbidden claim in this tree

The Gate A specification this cycle was handed says that if the final action cannot identify
rule-consistent behaviour, *"the next object becomes process evidence, not a stronger UI"*.
`PRE_HUMAN_GATES.md` and `BARRIER_MODEL.md` both say the same, and both predate `D25`.

`D25` tested it:

> *"**Not `PROCESS-EVIDENCE-REQUIRED`.** Process evidence was tested against the failure and is
> worth exactly nothing on it."*

and `forbidden_claims` bans both *"the final move is insufficient in general"* and *"process
evidence is the next research object"*. The identifiability simulation above is why: adding time,
candidate sets, delayed conditions and generic cues to the observation moved separation from 0.500
to 0.500.

**Consequence for this cycle:** an A-FAIL verdict may not be discharged by recommending process
evidence. The repository has already run that experiment.

### X-3 — three documents still name RC-06 as the eligible class

| document | says | current authority says |
| --- | --- | --- |
| `docs/decisions/D24-learning-architecture.md` | *"left RC-06 as the only eligible class"*, verdict `NARROW` | `D25` supersedes the verdict. **`D24` does not say so** — the supersession is recorded only on `D25`'s side |
| `docs/learning-v2/PRE_HUMAN_GATES.md` | *"Exactly one remains eligible under the current screen: `RC-06`"* | `eligible_set_after_fifteen_candidates: []` |
| `docs/learning-v2/THEORY_EVIDENCE.md` V14 | *"**`RC-06 answer-the-mate-threat` is ELIGIBLE**"*, separation +0.768 | `refuted.rc06_separation_is_specificity`: the two cells score different acts; symmetric separation is **−0.048** |

This is an `RNL-05` violation — one question, four documents, one of them current. It is recorded
here and **not repaired by editing the three**, because `RNL-10` says failed history is provenance
and Phase 12 forbids rewriting old verdicts. What is missing is a *pointer*, not a rewrite. See
`AUTHORITY_MAP.md`.

---

## 3. R1–R4, re-derived rather than assumed

### R1 — Inertial UX: **HOLDS, with one law explicitly not yet in force**

| claim | derivation | verdict |
| --- | --- | --- |
| state should nearly dictate the next action | `shared/interaction-mode.ts` holds ten modes and a contract each, checked against `makingEvidence` and `engineMayRun`, the two functions the product runs on | **holds as data** |
| …and does | `client/src/lib/next-action-shadow.ts` runs the derivation beside `ResumeScreen` and **the screen ignores the answer**. LAW 3's own status line: *"derived, and deciding nothing yet"* | **shadow only.** Ownership is deliberately withheld pending disagreement rows that are not explained by a `blind` input |
| one primary action | `GATE-ONE-PRIMARY-ACTION` and `GATE-NO-DUPLICATE-ACTION`, both with positive controls under `tests/fixtures/` | **holds, enforced** |
| details never carry the main meaning | LAW 6; `GATE-DECISION-FOCUS`, `GATE-TOOLBOX-OUTSIDE-FOCUS`, `GATE-ONE-BOARD-ONE-STORY` | **holds, enforced** |
| the user understands what happened and what to do without opening instrumentation | LAW 2's own text concedes the perceptual half was **not** held: *"A state can satisfy `primaryAction === 1` and still present six"* | **partially holds.** The count is enforced; the perceptual claim is not |

**What R1 means for this cycle.** The repository already has the law the mission's Phase 9 asks for —
*"derivation before ownership"* is `INERTIAL_UX_LAWS.md` LAW 3 in the repository's own words, with a
shadow ledger already running. A behavioural packet must enter through that door, not beside it.

### R2 — the learning loop: **the chain is as described, and its last arrow is still missing**

Derived from `VERIFIED_LEARNING.md` and the code:

```text
DecisionAtom (committed before reveal)     shared/decision-atom.ts
↓ reveal                                    shared/reveal.ts
↓ ReflectionDelta                           schema in shared/learning-record.ts
↓ player-authored LearningRule              LearningRuleComposer.tsx      [flag off]
↓ retrieval at 1/3/7/21 days                RETRIEVAL_INTERVAL_DAYS       [flag off]
↓ cued transfer, 3 unseen positions, 2 of 3 LearningTransferRunner.tsx    [flag off]
↓ ordinary future game                      ← NO rule-specific ecological hook
```

Two corrections to the description handed in:

1. **The last arrow is not merely hookless; the three arrows before it do not run either.**
   `VITE_EXPERIMENTAL_LEARNING_ENABLED` is off and set nowhere in the tree. The loop is code, tests
   and documentation, and zero installed behaviour.
2. **Grading is symmetric and the read path derives.** Two distinct dates in *either* direction, and
   `shared/record-service.ts::learningRules` re-derives the grade on read rather than trusting the
   stored projection.

### R3 — measurement system vs learning system: **CONFIRMED, and the margin is larger than stated**

`BARRIER_MODEL`'s claim is that the product is stronger as a measurement / claim-control system than
as a learning system. Derived independently:

| as a measurement system | as a learning system |
| --- | --- |
| 31 gates, 31 green, every one with a positive control that must go red | one flag, off |
| 17 rule classes screened, 180,000 positions, 580,852 records, byte-reproducible corpus | 0 humans |
| an `AUTHORITY` table where `mayPrescribe` is true at exactly one level | that table gates **one** sentence of Hebrew copy |
| a published `forbidden_claims` list of 18 sentences the product may not say | no validated teaching step at all — `BARRIER_MODEL` §3's *"(no validated teaching step)"* |
| `C11`, a criterion invented mid-programme that retired 10 of 17 classes at zero engine cost | `RETRIEVAL_INTERVAL_DAYS = [1,3,7,21]`, fixed, cited to a scheduler whose own authors say it **cannot assess content quality** (V11) |

**Confirmed.** And the asymmetry is not an accident of effort: every gate above exists because
something failed, and nothing in the learning half has ever been given the chance to fail, because
it has never run for a person.

### R4 — the barrier chain: **the first unresolved barrier is #4, and it has moved since the chain was written**

The chain as `BARRIER_MODEL.md` states it, with the current status of each derived from the tree:

| # | barrier | stated status | status now |
| --- | --- | --- | --- |
| 1 | valid insight → attention / comprehension | product concern | unchanged |
| 2 | comprehension → representation | plausible, not next | unchanged |
| 3 | representation → content validity | *"real architectural gate. Missing in the product."* | unchanged, and `mayPrescribe`'s single consumer is why |
| **4** | **content validity → action-model validity** | *"the first unresolved pre-human barrier"* | **still first, and now sharper.** Not *"is the binary signature too coarse"* but *"is there any class whose noise cell carries information"* — `C11` says 7 of 17 |
| 5 | action-model validity → item exchangeability | second unresolved | **blocked behind a predicate problem, not an item problem.** `PRE_HUMAN_GATES` Gate B's own precondition fails on RC-06: `_threat_satisfies` asks *"no mate in one"* on T+ and *"no check at all"* on T−, so no matching can repair it |
| 6 | → trigger recognition | plausible, not isolable | unchanged, and `KNOWLEDGE_MAP` §D says the repo's triggers are nonfocal by construction |
| 7 | → action selection | highest-value human question | unchanged |
| 8 | → conditional discrimination | measurable in research, absent from the loop | **now known to be unidentifiable on a saturated class**, X-1 |
| 9–11 | memory, time pressure, ecological transfer | later | unchanged |

**Re-derived answer: barrier 4 is still the first unresolved one.** The mission's premise that Gate A
comes first survives its own re-examination.

---

## 4. What the crosswalk found that neither side had

1. **A cue-focality criterion.** Both sides say the cue must be player-recognizable. Neither has a
   test that decides whether a given cue is. `KNOWLEDGE_MAP` §D supplies the mechanism, `V8` supplies
   the authority, and the tree supplies the counterexample (`mechanism_class`). This is the clearest
   candidate for a new gate in Phase 14.
2. **Rehearsal, named as the missing moderator.** V6 separates the if–then *form* from its
   *rehearsal*; the product ships the form and never rehearses the plan as a plan.
3. **`mayPrescribe` as advisory copy.** The repository's mechanism for *claims may not outrun
   evidence* is one rendered sentence. Phase 9's *"claims may not outrun evidence"* has a name here
   and no teeth.
4. **The saturation condition on E5.** The external endpoint is valid only where the noise cell is
   not saturated, which is a repository result with no external counterpart.
