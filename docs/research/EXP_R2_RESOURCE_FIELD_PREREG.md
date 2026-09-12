# Preregistration — EXP-R2: does chess topology change the player's perceived resource field?

**Status: FROZEN RESEARCH DESIGN.** Written before any EXP-R2 participant dataset exists, before any
EXP-R2 outcome is inspected, and before any TCRF detector is promoted to product code. External
literature and prior repository measurements are background evidence, not EXP-R2 results.

Companion construct specification:
`docs/research/TELOS_CONDITIONED_RESOURCE_FIELD_SPEC.md`.

---

## 0. Decision this experiment is meant to support

The decision is **not** which new coaching feature to build.

The blocked decision is:

> Is `Telos-Conditioned Resource Field` a psychologically and behaviourally real construct worth
> formalising further, or is it only an elegant redescription of board features the product already
> has?

EXP-R2 tests the minimum claim needed to continue:

1. a controlled change in **relation / coalition topology**, while material and gross position value
   are held approximately fixed, changes what players report as decision-relevant;
2. that representation change is related to the action selected;
3. the relationship is not an artefact of one language, one rating band, one coder, or a prompt that
   names the construct for the participant.

If these fail, do not build a resource hierarchy.

---

## 1. Epistemic ceiling

This study may establish:

- **Observation:** what participants did and reported;
- **Construct:** whether relation/coalition topology is represented in a reproducible way;
- **Prediction:** whether representation adds held-out information about action;
- **Narrow causal claim:** because topology variant and time regime are randomised, whether those
  manipulations change current-trial behaviour/report.

It may **not** establish:

- that one resource is globally more valuable than another;
- a Shapley/Myerson score;
- that an observed representation is optimal;
- that a particular coaching intervention improves chess;
- that one culture is more holistic/analytic than another;
- a product-facing diagnosis or mastery label.

---

## 2. Primary hypotheses

### H1 — structural sensitivity

When the target functional relation/coalition is present rather than disrupted, participants are
more likely to represent that target structure in a post-commit, pre-reveal open response.

Primary DV: `target_structure_mentioned ∈ {0,1}` under the frozen codebook.

This is the construct-validity gate. If H1 fails, TCRF does not advance.

### H2 — representation is action-relevant

A representation that names the target structure adds held-out information about whether the chosen
move belongs to the pre-registered target-affordance set, beyond template, topology condition, rating
and time regime.

This is not a mediation claim. The experiment does not assume that the free-text report caused the
move; the move was already committed.

### H3 — expertise gradient

Higher Lichess blitz rating predicts stronger sensitivity to relation/coalition topology and a larger
share of relation/coalition/affordance-level responses relative to object-only responses.

This is theoretically motivated by chess-expertise literature but is **not required** for H1/H2 to
pass. Failure means the expertise story is unsupported, not that topology is unreal.

### H4 — cross-language/context robustness

The sign of H1 and the direction of the H2 association remain stable across the pre-specified
language contexts. Lexical frequencies and mean representation levels are **not** compared as cultural
traits.

A sign reversal or non-transfer across language contexts blocks any universal ontology claim.

### H5 — time-budget interaction, secondary

Randomised tight versus roomy decision budgets may change which representation level is used and how
strongly topology affects action. No direction is pre-claimed. This tests whether the resource field
is stable or reconfigured under cognitive-resource pressure.

### H6 — probe reactivity, measurement-integrity hypothesis

A post-commit probe cannot change the move already made, but repeated probing may change later
behaviour. Randomised probe exposure on trial `t` is tested against think time and action on trial
`t+1`.

If a reproducible carry-over effect exists, resource probes are classified as an **intervention**, not
passive telemetry, in all later product work.

---

## 3. Participants

### 3.1 Target

**240 participants total.**

- Discovery/codebook cohort: **60** participants.
- Confirmatory cohort: **180** participants.

The confirmatory target is 60 participants in each interface language:

- Hebrew;
- English;
- Spanish.

These are **measurement-language strata, not three cultures**. Country of residence, country/region
where the participant learned most of their chess, primary training mode, age band and years of chess
experience are recorded as context descriptors. No nationality-essentialist inference is permitted.

### 3.2 Chess inclusion

- Lichess account supplied by participant;
- non-provisional blitz rating;
- at least 50 rated standard blitz games;
- age 18+;
- no titled-player exclusion;
- no lower/upper rating cutoff beyond what recruitment yields. Rating is analysed continuously.

Recruitment should aim for broad rating coverage within each language. If one language stratum has a
materially narrower rating range, the imbalance is reported and H4 is interpreted conditionally.

### 3.3 Floor

If the confirmatory cohort has fewer than **120 participants total** or fewer than **35** in any
language stratum, H4 is `NOT ESTABLISHED`. H1/H2 may still be tested pooled if the total floor is met.
Below 120 confirmatory participants → **STOP-R2-SAMPLE**; no confirmatory verdict.

---

## 4. Stimulus architecture

### 4.1 Matched topology pairs

Build **32 base templates**, eight in each pre-specified family:

1. **support / defence connectivity**;
2. **line activation** — file, rank or diagonal access;
3. **constraint / overload** — pin, restriction, overloaded defender or dependency;
4. **higher-order coalition** — battery, multi-piece net or another connected motif requiring >2
   elements.

Each template has two legal variants:

- `TOPOLOGY_PRESENT` — the target relation/coalition exists;
- `TOPOLOGY_DISRUPTED` — the target relation/coalition is broken while the carriers remain.

A participant never sees both variants of the same template.

### 4.2 What is held fixed

Every pair must preserve:

- material inventory;
- side to move;
- game phase;
- check / no-check status;
- castling-right state where relevant;
- no forced mate appearing in one variant only.

The edit must be local and recorded as a graph diff.

### 4.3 Gross-value matching is a nuisance control, not the construct

A topology pair enters the **primary STRUCTURE-ONLY set** only when the two variants differ by no
more than the repository's existing `ACCURATE_WIN_PROBABILITY_LOSS` in winning-chance value under
both:

1. the shipped engine configuration;
2. a second, higher-budget Stockfish configuration.

This does not make either engine ground truth. It prevents H1 from being a disguised comparison of
`clearly better position` versus `clearly worse position`.

Pairs that fail value matching may be retained in a separately labelled exploratory `VALUE-SHIFT`
set and can never carry the primary H1 verdict.

### 4.4 Collateral topology

The complete deterministic relation-graph diff is recorded for every candidate pair. Candidate
variants are generated before participant data. For each template, among candidates satisfying §4.2
and §4.3, retain the variant with the **smallest non-target graph edit count**. The target relation
must change. This selection uses no participant outcome.

If no admissible variant exists for a template, the template is dropped and the shortfall reported.
Fewer than **24 valid primary templates** → **STOP-R2-STIMULUS**.

### 4.5 Independent stimulus review

Two chess reviewers, blind to the behavioural hypotheses and language conditions, independently
verify:

- target topology present/disrupted as labelled;
- no unrelated one-move tactic introduced by the edit;
- pre-registered target-affordance set for each variant;
- the natural-language template description does not reveal the manipulation.

Disagreement is resolved before recruitment. Review notes are stored with stimulus provenance.

---

## 5. Discovery cohort — allowed to create the codebook, forbidden to test the hypotheses

The first 60 participants are **discovery only**.

Their data may be used to:

1. develop a language-neutral response codebook;
2. run cognitive interviews on Hebrew, English and Spanish wording;
3. estimate per-template decision-time distributions used to set the confirmatory time regimes;
4. identify responses that do not fit the candidate representation levels.

Discovery data may **not** be used to estimate H1–H6 or select the most favourable stimulus family.

Before the first confirmatory participant is opened, freeze and commit:

- `RESOURCE_RESPONSE_CODEBOOK_V1`;
- all valid primary stimulus pairs;
- target-affordance labels;
- confirmatory time limits;
- analysis script / model formulas.

After that freeze, the confirmatory set is read once.

---

## 6. Language and culture handling

The prompts are conceptually adapted, not word-for-word translated.

For each language:

1. native/bilingual forward translation;
2. independent back-translation for discrepancy detection;
3. discovery-cohort cognitive interviews asking what the question meant to the participant;
4. source-language coding by a bilingual coder;
5. mapping to the language-neutral representation codebook.

Machine translation may be stored as a convenience copy but is not the authoritative coding source.

The experiment does not treat Hebrew, English or Spanish as cultural essence. Cross-cultural
psychology is used here to test **measurement portability** and to prevent one lexical ontology from
being mistaken for cognition itself.

---

## 7. Trial protocol

Each confirmatory participant receives **16 of the 32 templates** under a balanced incomplete-block
design. Template assignment, topology variant and trial order are randomised with a stored seed.

### 7.1 Current decision

1. Position appears with the assigned decision budget.
2. Decision timer starts.
3. Participant commits one legal move.
4. Timer freezes **at commit**.
5. No engine evaluation, best move or opponent reply has been shown.

This inherits the repository's existing ordering rule: measurement after commit cannot be added to
think time.

### 7.2 Time regime

For each template, discovery data set two confirmatory budgets:

- `TIGHT` = discovery median completion time;
- `ROOMY` = discovery 90th percentile completion time.

Both are capped at 45 s and floored at 3 s. The same limits apply to both variants of a matched
pair. Time regime is randomised within participant.

A timeout is an outcome, not silently discarded. It is excluded from move-specific H2 but included
in timeout rates and H5.

### 7.3 Post-commit resource/telos probe

On **50% of trials**, selected randomly before the session and recorded, ask before reveal:

1. `What in this position mattered most to your decision?` — free text;
2. `What mattered next, if anything?` — optional free text;
3. `What were you trying to make happen?` — free text.

Equivalent adapted wording is frozen for Hebrew and Spanish after discovery.

No examples, piece categories, strategic labels or multiple-choice resources are shown.

On the other 50%, no resource/telos question appears. This arm exists to measure sequential
reactivity and preserve behaviour-only observations.

### 7.4 Reveal

Only after all assigned post-commit questions are completed or skipped may engine/result information
appear. Any trial in which reveal occurred early is marked contaminated and excluded from H1/H2,
with count reported.

---

## 8. Response codebook and reliability gate

The discovery-built codebook must at minimum allow multi-label coding of these **representation
levels**, without forcing a chess-content taxonomy:

- `OBJECT_CARRIER`;
- `RELATION`;
- `COALITION_MOTIF`;
- `AFFORDANCE`;
- `CONSTRAINT`;
- `TELOS`.

It also contains template-specific `target_structure_mentioned` and `target_telos_linked` rules,
written before confirmatory data are opened.

Confirmatory responses are coded independently by two coders blind to:

- topology condition;
- engine evaluation;
- move quality;
- rating;
- later result.

**Reliability gate:** Krippendorff's α must be ≥ 0.80 for the primary binary
`target_structure_mentioned` in the pooled confirmatory set and ≥ 0.70 within each language stratum.
If pooled α < 0.80 → **STOP-R2-CODE**. If only a language stratum fails 0.70, H4 is not established
for that stratum and the discrepancy is investigated without changing the confirmatory codebook.

Adjudication may create a final coded dataset but does not erase the pre-adjudication reliability
figures.

---

## 9. Outcomes

### Primary

- `target_structure_mentioned` on probed trials;
- `target_affordance_selected` for committed moves, as frozen by stimulus review.

### Secondary

- representation levels present in the response;
- whether the first-mentioned unit is object / relation / coalition / affordance / constraint / telos;
- `target_telos_linked`;
- decision time;
- timeout;
- move identity;
- response length and instrumentation latency;
- next-trial behaviour after probe versus no-probe exposure.

No engine `accuracy` measure is a primary DV in EXP-R2.

---

## 10. Analysis

### 10.1 H1 — topology → representation

Primary model: mixed-effects logistic regression

```text
target_structure_mentioned ~
  topology_present + time_regime + z_rating +
  topology_present:z_rating + topology_present:time_regime +
  (1 | participant) + (1 | template)
```

Primary coefficient: `topology_present`.

H1 passes when:

1. pooled coefficient is positive and its 95% participant-cluster bootstrap CI excludes 0;
2. leave-one-template-family-out analyses retain the same sign in all four runs;
3. the sign is unchanged when engine pair-difference and collateral graph-edit count are added as
   nuisance covariates.

No p-value alone carries the verdict.

### 10.2 H2 — representation → action beyond condition

Two nested held-out models predict `target_affordance_selected`:

`B0`: template + topology condition + time regime + rating.

`B1`: B0 + coded representation features, including `target_structure_mentioned` and representation
levels.

Generalisation is evaluated with participant-held-out and template-held-out folds. H2 passes only if
B1 improves held-out log loss over B0 in both holdout schemes and the participant-cluster bootstrap
95% CI of the improvement excludes 0.

No minimum AUC gain is invented here. EXP-R2 is a construct test. Product usefulness is a later gate.

### 10.3 H3 — expertise

Primary term: `topology_present × z_rating` in H1 plus a separate mixed model for relation/coalition/
affordance-level response probability. Direction is pre-registered as positive.

Failure does not overturn H1/H2.

### 10.4 H4 — cross-language/context

Report H1/H2 separately in Hebrew, English and Spanish, then run leave-one-language-out transfer:
train the language-neutral coded model on two language strata and test on the third.

H4 requires:

- no sign reversal of H1 in any adequately sampled language;
- H2 held-out log-loss improvement non-negative in all three;
- pooled result not driven by a single language.

No mean comparison of `holism`, `analytic cognition`, `resource sophistication` or culture rank is
permitted.

### 10.5 H5 — time regime

Report `topology × time_regime` for representation and action plus timeout rates. This is secondary
and two-sided. A stable interaction motivates a dedicated time-allocation experiment; it cannot by
itself be called optimal metareasoning.

### 10.6 H6 — sequential probe reactivity

For every trial `t+1`, compare prior trial `t` probe exposure versus no probe on:

- log decision time;
- timeout probability;
- target-affordance selection.

Models include participant and template random intercepts. A stable carry-over effect whose 95% CI
excludes 0 is reported as `MEASUREMENT_REACTIVITY_PRESENT`. It does not invalidate H1 for the already
committed move, but it forbids treating repeated probes as passive telemetry in later product work.

---

## 11. Negative and adversarial controls

| control | required expectation |
| --- | --- |
| **C1 label permutation** | shuffle topology labels within template; H1 disappears |
| **C2 coder blindness audit** | coders cannot recover condition from metadata supplied to them because condition metadata is absent |
| **C3 gross-value nuisance** | adding engine pair-difference cannot erase the topology coefficient by revealing it was only value difference |
| **C4 collateral topology** | effect survives adjustment for non-target graph-edit count |
| **C5 lexical leakage** | prompts contain no target relation/motif words and no examples |
| **C6 reveal ordering** | contaminated early-reveal trials are mechanically detectable and excluded before analysis |
| **C7 family holdout** | H1 sign survives leaving each of the four motif families out |

A failed control is a result, not a request to tune the experiment.

---

## 12. Falsification / stop conditions

| code | condition | consequence |
| --- | --- | --- |
| `STOP-R2-SAMPLE` | confirmatory n < 120 | no verdict |
| `STOP-R2-STIMULUS` | <24 admissible matched templates | rebuild stimuli before recruitment; do not run |
| `STOP-R2-CODE` | primary response coding unreliable | TCRF subjective layer not established |
| `STOP-R2-A` | H1 fails | stop TCRF relation/coalition program |
| `STOP-R2-B` | H1 passes, H2 fails | representation may be real but is not decision-relevant; research only |
| `STOP-R2-C` | result depends on one motif family | no general resource-field claim |
| `STOP-R2-D` | apparent effect is explained by gross value/material/collateral edits | manipulation invalid |
| `STOP-R2-E` | language strata show unexplained sign reversal | no universal ontology claim |
| `STOP-R2-F` | only explicitly named/forced representations produce the effect | measurement created the construct |
| `STOP-R2-G` | probe carry-over exists | probes are interventions; future passive-telemetry claims forbidden |

No threshold is changed after a stop condition fires.

---

## 13. Verdict matrix

- **H1 FAIL** → `STOP`.
- **H1 PASS, H2 FAIL** → `RESEARCH ONLY`.
- **H1 + H2 PASS, H4 not established** → `CONDITIONAL RESEARCH`: proceed to R3 only within supported
  contexts; no universal ontology.
- **H1 + H2 + H4 PASS** → `UNLOCK EXP-R3`: validate the contribution function and partial resource
  hierarchy.

**No EXP-R2 outcome directly unlocks production UI.**

---

## 14. What EXP-R3 is allowed to ask if R2 passes

Only after R2 may the project test:

1. whether a telos-conditioned characteristic function `ν_τ(C|S)` can be estimated without invalid
   piece-deletion counterfactuals;
2. whether graph-restricted marginal values / Shapley interaction explain resource synergy;
3. whether the resulting hierarchy is a stable **partial order** rather than a forced total score;
4. whether subjective hierarchy divergence predicts action quality;
5. whether an intervention matched to the diagnosed failure outperforms a mismatched intervention.

R2 does not answer any of these.

---

## 15. Reproducibility contract

Every run records:

- git commit;
- stimulus-set version and all FEN pairs;
- full structural graph and pair diff;
- engine builds/configurations used only for nuisance matching;
- participant anonymous id, interface language, context descriptors and rating snapshot;
- randomisation seed and trial assignment;
- topology condition, time regime, probe assignment;
- decision time, move, timeout;
- raw source-language response;
- coder ids, independent codes, adjudicated code;
- early-reveal / execution contamination flags;
- analysis-script commit and exact holdout assignments.

Raw identifying account data must not be committed to the public repository.

---

## 16. Prior evidence that motivated — but does not decide — the experiment

### Chess expertise

- Attack/defence semantics contribute to expert chess representation more than proximity alone:
  https://pubmed.ncbi.nlm.nih.gov/12219888/
- Experts detect relevant information earlier and use larger meaningful configurations:
  https://pmc.ncbi.nlm.nih.gov/articles/PMC4142462/
- Expert object/relation recognition differs qualitatively from novice processing:
  https://pubmed.ncbi.nlm.nih.gov/21998070/

### Decision and action theory

- Affordance competition treats behaviour as competition among currently available actions rather
  than serial `perceive world → complete plan → act` processing:
  https://pubmed.ncbi.nlm.nih.gov/17428779/
- Resource-rational analysis treats limited computation as part of the problem rather than noise:
  https://pubmed.ncbi.nlm.nih.gov/30714890/
- In >12M online chess games, think time tracks the estimated value of additional computation and
  the relationship is stronger for stronger players:
  https://pubmed.ncbi.nlm.nih.gov/41137861/
- Ecological rationality evaluates a strategy by fit to environmental structure, not complexity in
  isolation:
  https://pubmed.ncbi.nlm.nih.gov/34310848/

### Game/network theory

- Shapley Interaction Index formalises higher-order synergy beyond additive individual values:
  https://link.springer.com/article/10.1007/s10994-026-07062-6
- Myerson-style graph-restricted games model coalitions whose feasibility depends on network
  connectivity:
  https://link.springer.com/article/10.1007/s10957-018-1348-8
- Network motifs / hypermotifs motivate separating local structure from emergent higher-order
  function:
  https://www.nature.com/articles/nrg2102
  https://www.nature.com/articles/s41540-026-00701-7

### Cross-cultural measurement

- Cognitive science's WEIRD sampling limits generalisation and requires culture to be considered in
  methods, not appended after the result:
  https://pubmed.ncbi.nlm.nih.gov/36510095/
- Socioecological relational mobility predicts analytic/holistic attention across multiple countries,
  including Israel, Nigeria, Morocco, Spain, the U.S. and Japan; this motivates avoiding a fixed
  object-centric measurement assumption, not assigning a cognitive style to a nationality:
  https://pubmed.ncbi.nlm.nih.gov/30614727/
- Valid cross-cultural assessment requires conceptual work, adaptation, pretesting and construct
  validation, not translation alone:
  https://pubmed.ncbi.nlm.nih.gov/18924560/

---

## 17. Frozen one-sentence test

> **If a player's decision representation is genuinely organised by a telos-conditioned relational
> resource field, then changing a decision-relevant relation while preserving the carriers and gross
> position value should systematically change the representation and action; if it does not, the
> resource-field construct has not earned a place in the product.**
