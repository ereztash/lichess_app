# EXP-R2 execution plan — the decision, the claims, the alternatives, and the architecture

> **SUPERSEDED IN PART BY [`EXP_R2_AMENDMENT_1.md`](./EXP_R2_AMENDMENT_1.md) (2026-09-12).** The open
> decision in §5 below has been taken: the owner chose the pre-recruitment amendment route, and a
> prior question was found underneath it. Two of the four families cannot identify the construct
> under the frozen manipulation at all, so recruitment, stimulus authoring at scale and the language
> rollout are paused. Read the amendment and
> [`EXP_R2_IDENTIFIABILITY_PILOT.md`](./EXP_R2_IDENTIFIABILITY_PILOT.md) before acting on anything
> here. Sections 1 to 4 and 6 stand unchanged.

**Status: EXECUTION ARCHITECTURE FOR A FROZEN DESIGN.** This plan implements
[`EXP_R2_RESOURCE_FIELD_PREREG.md`](./EXP_R2_RESOURCE_FIELD_PREREG.md). It does not amend it.
Where the frozen text left something open, this plan says what was decided, where the decision
lives in code, and under whose authority. Where the frozen text is wrong, this plan says so and
still implements it as written, with the disagreement recorded in
[`TCRF_CONSTRUCT_AUDIT.md`](./TCRF_CONSTRUCT_AUDIT.md).

---

## 1. The decision this experiment is allowed to support

> Whether TCRF has enough construct validity and behavioural relevance to justify **EXP-R3**, where
> marginal contribution, synergy and resource hierarchy would begin to be tested.

That is the whole permitted output. EXP-R2 is **not** permission to:

- ship any product feature, surface or wording;
- compute a resource score, a mastery label or a combined index;
- change the Record front door, claim grades, learning-rule logic or the decision loop;
- describe a player's representation to that player;
- say anything about culture.

§13 of the preregistration ends with *"No EXP-R2 outcome directly unlocks production UI."*
`research/tcrf/stop-conditions.ts` enforces it by construction: `verdict()` returns one of four
values and none of them means build something.

### What a successful EXP-R2 actually buys

A pass unlocks a **question**, not a capability: whether a telos-conditioned characteristic function
can be estimated at all. [`TCRF_EXP_R3_PRECONDITIONS.md`](./TCRF_EXP_R3_PRECONDITIONS.md) lists what
R2 must establish first, and two of those preconditions are not on R2's path at all — meaning a
clean R2 pass still leaves R3 blocked. That is worth knowing before the money is spent.

---

## 2. The claims under test, separated

The preregistration bundles these under H1–H6. They are separated here because they fail
independently and a reader of the results needs to know which one died.

| # | claim | tested by | can fail without killing the others? |
| --- | --- | --- | --- |
| **C-I** | **Topology is psychologically represented at all.** Players' reports name relational structure, not only carriers | codebook level distribution; base rate of `RELATION`/`COALITION_MOTIF`/`CONSTRAINT` | no — if reports are object-only, C-II has nothing to move |
| **C-II** | **Changing topology changes representation.** | **H1** | **no. This is the construct-validity gate.** `STOP-R2-H1` |
| **C-III** | **Representation relates to action.** | H2, descriptively | yes, but C-IV then cannot pass |
| **C-IV** | **Representation adds information beyond the objective position.** | **H2**, held out, over B0 | yes → `RESEARCH_ONLY` |
| **C-V** | **The effect generalises across rating bands.** | H3 | yes. §2 says failure does not overturn H1/H2 |
| **C-VI** | **The measurement transfers across language contexts.** | H4 | yes → `CONDITIONAL_RESEARCH` |
| **C-VII** | **The probe does not itself alter later behaviour.** | **H6** | failure does not invalidate H1; it reclassifies probes as interventions forever |

**C-I is separated deliberately and is not one of the preregistration's six.** H1 compares a rate
between arms and a rate of zero in both arms is a pass-shaped null. The level distribution has to be
reported before H1 is interpreted, or *"topology changed nothing"* and *"nobody talks about
relations at all"* look identical.

**C-IV is the load-bearing one for the product question.** C-II alone gets a descriptive finding.

---

## 3. Alternative explanations, and the control that distinguishes each

Every row names something other than TCRF that could produce the H1 or H2 result, and the specific
thing that separates it. Where the separator is a covariate rather than a design feature, the
covariate is recorded per stimulus pair by `scripts/build_tcrf_stimuli.ts`.

| # | alternative explanation | control that distinguishes it | where it lives |
| --- | --- | --- | --- |
| **E-1** | gross engine value changed, and players report whatever the value turns on | §4.3 tolerance under **two** engine configurations, plus **C4** entering the pair delta as a covariate | `validate-stimulus.ts` `VALUE_DELTA_EXCEEDED`; `controls.ts` C4 |
| **E-2** | the value comparison could not discriminate, so an unmatched pair passed | `VALUE_MATCH_UNRESOLVED` — the derived band where the tolerance still separates positions | `validate-stimulus.ts`; audit A-4 |
| **E-3** | a one-move tactic was accidentally introduced in one arm | forcing-gap asymmetry between MultiPV 1 and 2, per arm, plus §4.5's two blind chess reviewers | `engine-match.ts` `best_gap_*`; `FORCING_ASYMMETRY` |
| **E-4** | a forced mate appeared in one arm only | `MATE_IN_ONE_ARM_ONLY`, checked separately because a mate score has no honest win probability | `validate-stimulus.ts` |
| **E-5** | lexical priming: the question named the structure | **C5** — the forbidden lexicon, checked by test in all three languages; no examples, no menu, no piece names | `probe-wording.ts` `forbiddenLexiconHits` |
| **E-6** | coders inferred the condition from the answer or from the metadata | **C8** — structural blindness. The payload is constructed from a whitelist, not filtered; `GATE-TCRF-BLIND` proves the check can fail | `coder-export.ts`; `scripts/tcrf-scan.ts` |
| **E-7** | coders inferred the condition by grouping the batch by template | template id, family and trial index are all withheld; a salted per-batch token replaces them | `CODER_FORBIDDEN_FIELDS`; audit A-2 of the blindness argument |
| **E-8** | rating explains both representation and action | `z_rating` is a covariate in every model, continuous, never banded | `analysis/plan.ts` |
| **E-9** | the time budget explains the effect | `time_regime` is **randomised within participant** and interacted in H1 and H5 | `analysis/plan.ts` H1, H5 |
| **E-10** | it is one template, or one family, memorised | **C5 template holdout** and **C7 family holdout**; H1's pass rule requires the sign in all four family runs | `controls.ts`; `plan.ts` `FAMILY_HOLDOUTS` |
| **E-11** | one translation carries more relation-signalling wording | **C6**, plus leave-one-language-out transfer in H4 | `plan.ts` H4; `controls.ts` C6 |
| **E-12** | repeated probing trained the participant | **H6**, randomised probe assignment, tested at `t+1` | `plan.ts` H6; `trial_index` exists for this and nothing else |
| **E-13** | the structural detector does not represent what humans use | **C3 object-only baseline**, and the level distribution from C-I. If object features match B1, the relational claim is withdrawn | `controls.ts` C3 |
| **E-14** | "topology present" is partly "the position nobody edited" | `base_arm` recorded per pair; `BASE_ARM_SKEW` before recruitment; C1 moves `is_base_arm` with the shuffled label | audit A-3 |
| **E-15** | the arms differ in how much there is to say | legal-move delta recorded per pair, entered under C4 | audit A-7 |
| **E-16** | the model found structure in clustered noise | participant and template random intercepts in every model; participant-cluster bootstrap CIs; **C1** label permutation within template | `plan.ts` `CLUSTERS`; `controls.ts` C1 |
| **E-17** | the participant saw something before committing | protocol state machine throws on every forbidden ordering; `preCommitLeaks` names the payload keys | `protocol.ts`; **C9** |

---

## 4. Architecture decision: how the board is represented

Three options were evaluated against the same requirement — express every preregistered R2 stimulus
and produce §4.4's non-target graph edit count.

| | **A. direct feature functions** | **B. typed relation set (chosen)** | **C. hypergraph** |
| --- | --- | --- | --- |
| implementation cost | lowest per detector | one shared canonical form, six detectors | node/edge/hyperedge model, incidence structures, a query layer |
| reproducibility | each detector defines its own output shape | one comparable form, sorted, deduplicated | same, at higher cost |
| detector reuse | none; each is standalone | `ray()` shared by three detectors, so they cannot disagree about what a line is | same |
| expresses R2's four families | yes | yes | yes, plus families R2 does not have |
| **produces §4.4's edit count** | **no.** A diff would need bespoke comparison logic per detector | **yes.** Set difference over canonical strings | yes, at the cost of defining hyperedge identity |
| risk of premature abstraction | none | low | **high** |

**Chosen: B, a flat set of canonical strings.** The single derived quantity R2 needs is a DIFF
between two positions, and a diff needs one comparable form. `w:battery:d1>d2>d8` is that form. There
are no node objects, no adjacency index and no query language, because nothing in R2 queries the
graph — it only asks whether a named relation is in one set and not the other.

**A is rejected** on the one requirement that matters: §4.4 retains the variant with the smallest
non-target graph edit count, and without a canonical form there is no count to minimise.

**C is rejected** because R2 has no consumer for higher-order expressiveness. The specification
mentions hypergraphs (§3) and cooperative games over coalitions (§6), and both are R3 objects.
Family 4's manipulation is expressible as one named motif detector emitting an ordered element list,
which is what `detectBatteries` does. Building a general hypergraph engine now would be building the
R3 substrate before R2 has established that R3 is worth running — and if R2 stops, the engine is
pure waste. Note also that the audit's A-13 says family 4 currently rests on **one** structure class;
a hypergraph would not fix that, because the missing thing is detectors, not expressiveness.

**What B costs, stated:** one edge per slider ray rather than per square, so `line_access` is coarse;
a shared canonical string means a detector version bump changes every stored diff, which is why
`detector_versions` travels with every pair and `traceDrift` reports per detector.

---

## 5. The open decision this plan cannot make

**A-2 in the construct audit is the finding that governs whether EXP-R2 is worth running.** Measured
over eight candidate pairs: support/defence manipulations matched on value, line activation missed
narrowly on the shipped engine only, and constraint/overload and higher-order-coalition
manipulations produced winning-chance shifts of 0.32 and 0.42 with identical material — because in
those families the structure being removed **is** the advantage.

Three routes exist. **The choice is the owner's, not this plan's.**

1. **Run as frozen.** Accept that the primary set will be dominated by support/defence, and accept
   that `STOP-R2-C` is the most likely outcome. Cost: the surviving family is the one a
   non-relational account predicts equally well, so a pass is weak evidence for TCRF.
2. **Author harder.** Spend chess-expert time finding constraint and coalition positions where the
   structure is decision-relevant and value-neutral. They may exist — the pilot is eight pairs by a
   non-expert. Cost: unknown, and the pilot yield suggests it is high.
3. **Amend §4.3 before recruitment**, for example weighting the high-budget reading over the shipped
   one (audit A-6), or defining the tolerance per family. Cost: this is an amendment to a frozen
   preregistration and must be committed, dated and justified **before** any confirmatory data
   exist, in the idiom `TIME_REPRESENTATION_PREREG.md` §9–11 already uses in this repository.

**What is not a route:** discovering after the results that the tolerance was too tight.

### Authoring yield, measured

Two of eight first-attempt candidates cleared every structural and value invariant. At that yield,
the §4.1 target of 32 templates implies roughly **120 candidate pairs authored**, and the §12 floor
of 24 implies roughly **90**. Those are the numbers the recruitment budget should be built on, and
they are a lower bound: the pilot author was not a chess expert and §4.5 requires two blind
reviewers on top.

---

## 6. Where everything lives

```text
research/tcrf/
  relations.ts          six versioned detectors, canonical form, field diff
  stimulus.ts           the matched-pair schema; hand-authored vs derived split
  validate-stimulus.ts  every §4.2/§4.3/§4.4 predicate, pure, recomputed not trusted
  engine-match.ts       the two §4.3 configurations; process-bound, kept out of the gate
  trial.ts              the EXP-R2 research record and its cross-field rules
  protocol.ts           §7.1's ordering as a machine that throws on the wrong order
  probe-wording.ts      §7.3's three questions in three languages, with provenance
  codebook.ts           §8's levels, the polarity rule, the freeze record
  coder-export.ts       §8's blindness, built from a whitelist
  analysis/plan.ts      §10's six models, holdout construction, eligibility
  analysis/controls.ts  §11's controls plus C8 and C9, as data transforms
  stop-conditions.ts    §12's codes under both naming schemes; §13's verdict matrix
  trace.ts              §15's provenance record and its drift report
  stimuli/              CANDIDATES.json (hand-authored) and PRIMARY_V1.json (derived)

scripts/
  build_tcrf_stimuli.ts the curator workflow, base position to validated record
  tcrf-scan.ts          the two predicates a repository gate can honestly assert

tests/research/tcrf/    94 tests: positive and negative fixtures per detector,
                        mutation tests, ordering refusals, blindness, controls
tests/fixtures/tcrf/    the positive controls: a manifest claiming the primary set for
                        pairs its own positions contradict, and a procedurally
                        blinded exporter
```

### Product isolation

Nothing under `research/tcrf/` is imported by `client/src`. `vite build` does not reach it, so the
bundle budget is unaffected. `INTERFACE_LANGUAGES` in `shared/interface-language.ts` is untouched:
research carries its own `RESEARCH_LANGUAGES` because adding Spanish to the product union for a
research purpose is exactly what §18 forbids. `DecisionAtom` is untouched: adding a research field
would oblige the product's screen, event and report to carry it, which is what `GATE-ISO` asserts.

### Gates

| gate | asserts | positive control |
| --- | --- | --- |
| `GATE-TCRF-STIMULUS` | no pair claims the primary set while its own positions contradict the claim; no derived field disagrees with its position, in any set | a manifest with material edited, side to move flipped, a topology that never changed, a value delta an order of magnitude past tolerance, an engine that never ran, a missing commit, and a stale diff |
| `GATE-TCRF-BLIND` | the coder payload carries none of the fields §8 blinds coders to, and none the whitelist does not declare | a procedurally blinded exporter that removes the five obvious fields and leaks the arm through `is_base_arm`, the difficulty through `budget_ms` and the template identity |

`GATE-TCRF-STIMULUS` deliberately does **not** redden on `STOP-R2-STIMULUS`. Fewer than 24
admissible templates is a research state decided before recruitment, not a defect in the tree. The
count is printed beside the verdict instead, in the idiom `scripts/verify_scope.ts` uses.
