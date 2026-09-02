# PROCESS_CORPUS — the repository read as a body of operational knowledge

Machine-readable form: [`PROCESS_CORPUS.json`](PROCESS_CORPUS.json). This file is **rendered from it**;
if the two ever disagree, the JSON is authoritative. (That rule is copied from
`docs/evidence-architecture/STRONGEST_PERMITTED_CLAIM.md`, which states it about its own JSON.)

Each case is one real decision, failure, fix or research transition that this repository actually
made. Fields that the sources do not answer are `UNKNOWN` and are never filled in by inference.

## 1. What is in the corpus

**48 cases**, across **12 domains**.

| domain | cases |
| --- | ---: |
| `deployment` | 2 |
| `design` | 1 |
| `governance` | 5 |
| `product-engineering` | 6 |
| `product-measurement` | 5 |
| `product-ux` | 6 |
| `research-b2` | 4 |
| `research-b3` | 3 |
| `research-discovery` | 9 |
| `research-evidence-architecture` | 1 |
| `research-learning` | 2 |
| `testing` | 4 |

### Field completeness, counted rather than asserted

| field | cases carrying it | share |
| --- | ---: | ---: |
| `falsifier` | 42 / 48 | 88% |
| `negative_control` | 22 / 48 | 46% |
| `positive_control` | 38 / 48 | 79% |
| `freeze_point` | 38 / 48 | 79% |
| `promotion_rule` | 44 / 48 | 92% |
| `reversal_condition` | 28 / 48 | 58% |
| `failure_discovered` | 47 / 48 | 98% |
| `lesson` | 48 / 48 | 100% |
| `was_generalized` | 44 / 48 | 92% |

### `derived_or_declared`, the field that decides the derivation audit

| value | cases |
| --- | ---: |
| `DERIVED` | 36 |
| `DECLARED_AND_VERIFIED` | 10 |
| `option` | 1 |
| `DECLARED_UNVERIFIED` | 1 |

## 2. Corpus coverage of the authored repository

The repository has **980 tracked files**. They fall into four buckets, assigned by a script
(`bucket` in the classification, path-based and reproducible):

| bucket | files | treated how |
| --- | ---: | --- |
| `authored-sot` | 479 | authored source-of-truth: docs, decision records, protocols, scripts, shared contracts, server/client modules, research code |
| `authored-support` | 336 | tests, control fixtures, migrations — read where a case turns on them |
| `generated` | 126 | generated numeric results, manifests, figures, tables. Read via their generating code, manifest, schema and authoritative summary, per the mission's own allowance |
| `excluded` | 39 | assets, licence text, lockfile |

**The governing subset** — every file that can state, enforce or record a rule — is **169 files**:
all of `docs/**`, `README.md`, `VERCEL_DEPLOYMENT.md`, `tests/LEVELS.md`, every `research/**/*.md`,
`.github/workflows/**`, `scripts/**`, `.claude/agents/**`.

**All 169 are classified below: 169/169 = 100.0%.**

| path | kind | question it answers | status |
| --- | --- | --- | --- |
| `.claude/agents/fable-scientific-reviewer.md` | agent-definition | who reviews a B3 scientific gate, and under what independence rules | `CURRENT` |
| `.claude/agents/opus-research-engineer.md` | agent-definition | who implements a frozen B3 plan | `CURRENT` |
| `.github/workflows/verify-build.yml` | gate-definition | what must be true of a commit before it may merge | `CURRENT-AUTHORITY` |
| `README.md` | product-contract | what the product is and what rule everything rests on | `CURRENT-AUTHORITY` |
| `VERCEL_DEPLOYMENT.md` | deployment-contract | how the deployment is configured and how each variable fails | `CURRENT-AUTHORITY` |
| `docs/ACQUISITION_EVIDENCE.md` | protocol | what the acquisition trial may record | `CURRENT-AUTHORITY` |
| `docs/ACTION_PLAN.md` | plan-history | one review's findings and the plan built from them | `HISTORICAL` |
| `docs/COMPETITIVE_BENCHMARK.md` | external-survey | what competitors solve, as a thing to be unlike | `CURRENT` |
| `docs/DESIGN_SYSTEM.md` | reference | what every token means and what it may paint | `CURRENT-AUTHORITY` |
| `docs/FINDINGS.md` | history | what reading and building this turned up | `HISTORICAL` |
| `docs/FRONTEND_EXCELLENCE_AUDIT.md` | audit | what the built app measures, at a named base SHA | `HISTORICAL-MEASUREMENT` |
| `docs/INERTIAL_UX_LAWS.md` | law-set | twelve interaction laws and the gates that hold eight of them | `CURRENT-AUTHORITY` |
| `docs/INTERACTION_GEOMETRY.md` | audit | what the screen is arranged around in each state | `HISTORICAL-MEASUREMENT` |
| `docs/MASTER_PRODUCT_DEBT.md` | register | what is still open | `CURRENT-AUTHORITY` |
| `docs/MEASUREMENTS.md` | register | every measurement, with its canonical record and its history sections | `CURRENT-AUTHORITY` |
| `docs/PRODUCTION_READINESS_LEDGER.md` | history | per-cycle narrative of defects found and closed | `HISTORICAL` |
| `docs/RESEARCH_EVIDENCE.md` | external-evidence | whether the behaviour measures the construct the product names | `CURRENT` |
| `docs/STATIC_DEPLOYMENT.md` | deployment-contract | what a deployment with no server does | `CURRENT-AUTHORITY` |
| `docs/VALUE_CLARITY.md` | constitution | can a cold player understand the product | `CURRENT-AUTHORITY` |
| `docs/VALUE_CLARITY_FIELD_PROTOCOL.md` | protocol | the three trial arms, frozen before the first participant | `CURRENT-AUTHORITY` |
| `docs/VERIFIED_LEARNING.md` | product-contract | the learning record's lifecycle and what it does not claim | `CURRENT` |
| `docs/VISUAL_ARCHITECTURE_AUDIT.md` | audit | does the interface make the current task perceptually obvious | `HISTORICAL-MEASUREMENT` |
| `docs/blitz/ADR-001-blitz-measurement.md` | decision-record | blitz measurement semantics, decided before the code | `CURRENT-AUTHORITY` |
| `docs/blitz/ADR-002-discovery-strata.md` | decision-record | which regime discovery reads | `CURRENT-AUTHORITY` |
| `docs/blitz/ADR-003-a-rule-the-product-breaks.md` | decision-record | a grade names the protocol that produced it | `CLOSED-BY-OWNER` |
| `docs/blitz/ADR-004-where-a-blitz-decision-lives.md` | decision-record | why a blitz decision is not a commitment-loop atom | `CURRENT-AUTHORITY` |
| `docs/blitz/AUDIT.md` | audit | what blitz looked like before it was built | `HISTORICAL` |
| `docs/decisions/D00-research-oracle-before-product-code.md` | decision-record | one node of the confidence ledger | `CURRENT-AUTHORITY` |
| `docs/decisions/D01-point-in-time-feature-contract.md` | decision-record | one node of the confidence ledger | `CURRENT-AUTHORITY` |
| `docs/decisions/D02-the-unit-of-inference.md` | decision-record | one node of the confidence ledger | `CURRENT-AUTHORITY` |
| `docs/decisions/D03-what-a-search-may-read.md` | decision-record | one node of the confidence ledger | `CURRENT-AUTHORITY` |
| `docs/decisions/D04-candidate-search.md` | decision-record | one node of the confidence ledger | `CURRENT-AUTHORITY` |
| `docs/decisions/D05-blitz-time.md` | decision-record | one node of the confidence ledger | `CURRENT-AUTHORITY` |
| `docs/decisions/D08-attribution.md` | decision-record | one node of the confidence ledger | `CURRENT-AUTHORITY` |
| `docs/decisions/D09-frozen-hypothesis-manifest.md` | decision-record | one node of the confidence ledger | `CURRENT-AUTHORITY` |
| `docs/decisions/D20-protocol-matching.md` | decision-record | one node of the confidence ledger | `CURRENT-AUTHORITY` |
| `docs/decisions/D21-feedback-exposure.md` | decision-record | one node of the confidence ledger | `CURRENT-AUTHORITY` |
| `docs/decisions/D22-next-action-ownership.md` | decision-record | one node of the confidence ledger | `CURRENT-AUTHORITY` |
| `docs/decisions/D23-insight-to-action.md` | decision-record | one node of the confidence ledger | `CURRENT-AUTHORITY` |
| `docs/decisions/D24-learning-architecture.md` | decision-record | one node of the confidence ledger | `CURRENT-AUTHORITY` |
| `docs/decisions/D25-evidence-architecture.md` | decision-record | one node of the confidence ledger | `CURRENT-AUTHORITY` |
| `docs/decisions/README.md` | registry | the confidence ledger: nodes, modes, evidence levels, triggers | `CURRENT-AUTHORITY` |
| `docs/design-council/00-REPO-NATIVE-CONSTITUTION.md` | constitution | what the repository says before any external designer is read | `CURRENT-AUTHORITY` |
| `docs/design-council/01-BASELINE.md` | baseline | what the built product looked like at b9a228c | `FROZEN-BASELINE` |
| `docs/design-council/02-PERCEPTUAL-CONTRACT.md` | contract | five qualities the product must have and five it must not | `CURRENT-AUTHORITY` |
| `docs/design-council/03-ART-DIRECTION-CONTRACT.md` | contract | what governs index.css and the component grammar | `CURRENT-AUTHORITY` |
| `docs/design-council/04-ADVERSARIAL-REVIEW.md` | adversarial-register | four independent passes and every finding, acted on or not | `CURRENT-AUTHORITY` |
| `docs/design-council/05-FINAL-REPORT.md` | report | what the pass measured, changed and was attacked with | `CURRENT` |
| `docs/design-council/SOURCES.md` | external-survey | six repositories read, with the SHA read and what was rejected | `CURRENT` |
| `docs/discovery-v2/M0_AUDIT.md` | gate-result | four measured verdicts on the instrument | `CURRENT-AUTHORITY` |
| `docs/evidence-architecture/ACTION_MODEL_DECISION.md` | gate-result | Gate A -> ACTION-SIGNATURE-FAILED | `CURRENT-AUTHORITY` |
| `docs/evidence-architecture/ANCHOR_REBUILD.md` | result | the anchor pair rebuilt with chance as the floor | `CURRENT-AUTHORITY` |
| `docs/evidence-architecture/C11_SCREEN.md` | gate-result | C11 on all seventeen classes | `CURRENT-AUTHORITY` |
| `docs/evidence-architecture/COGNITIVE_EVIDENCE_MATRIX.md` | matrix | observation x construct, each cell with a falsifier | `CURRENT` |
| `docs/evidence-architecture/CURRENT_STATE.md` | state-reconstruction | what is VERIFIED/RESEARCH-ONLY/REFUTED/UNRESOLVED | `HISTORICAL-SNAPSHOT` |
| `docs/evidence-architecture/FALSIFICATION_REGISTER.md` | falsification-register | every load-bearing claim, in the required six-field form | `CURRENT-AUTHORITY` |
| `docs/evidence-architecture/GOLD_STANDARD_PROCESS_PROTOCOL.md` | protocol | deliberately not designed, and what would be frozen | `NOT-DESIGNED` |
| `docs/evidence-architecture/HUMAN_BASELINE_ORACLE.md` | decision | Maia -> DEFER, with the reason | `CURRENT` |
| `docs/evidence-architecture/IDENTIFIABILITY_SIMULATION.md` | result | seven synthetic learners scored by a Bayes-optimal classifier | `CURRENT-AUTHORITY` |
| `docs/evidence-architecture/INCREMENTAL_EVIDENCE_VALUE.md` | result | what each observation is worth | `CURRENT-AUTHORITY` |
| `docs/evidence-architecture/INFERENCE_CHAIN.md` | frozen-model | the eleven-stage chain with the status of every arrow | `FROZEN` |
| `docs/evidence-architecture/ITEM_VALIDATION.md` | gate-result | Gate B -> ITEM-PARADIGM-FAILED | `CURRENT-AUTHORITY` |
| `docs/evidence-architecture/KNOWLEDGE_REPRESENTATIONS.md` | taxonomy | four representations kept apart | `CURRENT` |
| `docs/evidence-architecture/MODEL_COMPARISON.md` | result | M0 against M1; complexity is not evidence | `CURRENT` |
| `docs/evidence-architecture/MULTILINGUAL_EVIDENCE.md` | survey | five languages and the null result that matters most | `CURRENT` |
| `docs/evidence-architecture/MULTI_STRATEGY_REGISTER.md` | register | what else produces each critical observation | `CURRENT` |
| `docs/evidence-architecture/OPEN_SOURCE_MAP.md` | survey | licences first; nothing is blocked by tooling | `CURRENT` |
| `docs/evidence-architecture/PROCESS_EVIDENCE.md` | gate-status | why Execution 2 is not unlocked | `CURRENT-AUTHORITY` |
| `docs/evidence-architecture/PROCESS_MINING_DECISION.md` | decision | DEFER, and the one query worth running instead | `CURRENT` |
| `docs/evidence-architecture/README.md` | index | Execution 1 and its verdict | `CURRENT-AUTHORITY` |
| `docs/evidence-architecture/RECONCILIATION.md` | cross-branch-audit | which risks the branches had already corrected | `HISTORICAL` |
| `docs/evidence-architecture/ROADMAP.md` | plan | ranked by consequential uncertainty removed per unit cost | `CURRENT` |
| `docs/evidence-architecture/STRONGEST_PERMITTED_CLAIM.json` | claim-ceiling | what may and may not be said, v2.2.0 -- authoritative over the prose | `CURRENT-AUTHORITY` |
| `docs/evidence-architecture/STRONGEST_PERMITTED_CLAIM.md` | claim-ceiling | what may and may not be said (prose) | `CURRENT` |
| `docs/learning-v2/BARRIER_MODEL.md` | model | product gaps separated from measurement blockers | `CURRENT` |
| `docs/learning-v2/COMPETITOR_MECHANISM_AUDIT.md` | survey | competitor mechanisms at tier 4-6, with THIN rows labelled | `CURRENT` |
| `docs/learning-v2/CRITERION_CHANNEL.md` | result | the criterion is not a player parameter | `CURRENT-AUTHORITY` |
| `docs/learning-v2/EXPERIMENT.md` | protocol | Study D, specified and not admissible | `SPECIFIED-BLOCKED` |
| `docs/learning-v2/FALSIFICATION_REGISTER.md` | falsification-register | twenty-three failure hypotheses, including two that refute earlier ones | `CURRENT-AUTHORITY` |
| `docs/learning-v2/INTERVENTION_COMPARISON.md` | comparison | instructional candidates, retained but not a licence to build | `CURRENT` |
| `docs/learning-v2/KNOWLEDGE_MAP.md` | map | nine fields with mechanism, boundary, falsifier, source quality | `CURRENT` |
| `docs/learning-v2/PRE_HUMAN_GATES.md` | gate-definition | the two gates required before human data | `CURRENT-AUTHORITY` |
| `docs/learning-v2/THEORY_EVIDENCE.md` | external-evidence | every citation checked against the publisher record | `CURRENT-AUTHORITY` |
| `docs/learning-v2/VOICE_OF_CUSTOMER.md` | survey | tier-6 signal, used only for hypothesis generation | `CURRENT` |
| `docs/learning/EXPERIMENT.md` | protocol | one study, one factor, with the null outcome declared first | `SUPERSEDED-BY-D24` |
| `docs/learning/FALSIFICATION_REGISTER.md` | falsification-register | attempts to break the staged-intervention claim | `HISTORICAL` |
| `docs/learning/PRIOR_ART.md` | external-evidence | mechanisms with their moderators and a local prediction | `HISTORICAL` |
| `docs/learning/README.md` | index | the learning research pass | `SUPERSEDED-BY-learning-v2` |
| `docs/measurement/ACTION_SET_MODEL.json` | machine-readable-result | gates A1-A5, the value-scale counterparts | `FROZEN` |
| `docs/measurement/ACTION_SET_REANALYSIS.md` | result | the same classes scored as a decision rather than top-1 | `CURRENT` |
| `docs/measurement/ANALYSIS_PLAN.md` | protocol | score validation before learning validation | `CURRENT` |
| `docs/measurement/CONSTRUCT_DECISION.md` | decision | SURVIVES/NARROW/REPLACE/REJECT -> NARROW | `SUPERSEDED-BY-D25` |
| `docs/measurement/ECOLOGICAL_EXTRAPOLATION_GAP.md` | ladder | the L0-L5 task-to-game ladder | `CURRENT-AUTHORITY` |
| `docs/measurement/EVIDENCE_MANIFEST.json` | manifest | every source with its tier and where it was used | `FROZEN` |
| `docs/measurement/EXISTING_MEASURE_AUDIT.md` | survey | twelve silos searched before anything was designed | `CURRENT` |
| `docs/measurement/FALSIFICATION_REGISTER.md` | falsification-register | ten attempts to break the construct | `CURRENT` |
| `docs/measurement/GO_NO_GO.md` | decision | eight questions and their answers | `SUPERSEDED-IN-PART` |
| `docs/measurement/INTERPRETATION_USE_ARGUMENT.md` | frozen-claim | the claim, frozen before evidence, as a Kane chain | `FROZEN` |
| `docs/measurement/ITEM_BANK_PROTOCOL.md` | protocol | what a bank would have to satisfy | `SPECIFIED-NOT-BUILT` |
| `docs/measurement/README.md` | index | the behavioural-transfer measurement decision | `AMENDED-BY-D25` |
| `docs/measurement/RULE_CLASS_SCREEN.json` | machine-readable-result | the rule-class gates and their outcome | `FROZEN` |
| `docs/measurement/RULE_CLASS_SEARCH.md` | result | is there a rule class where knowledge->action is identifiable | `AMENDED-BY-D25` |
| `docs/measurement/STRONGEST_PERMITTED_CLAIM.json` | claim-ceiling | what may and may not be said, v1.3.0 | `SUPERSEDED-IN-PART-BY-2.2.0` |
| `docs/research/ACCOUNT_BRIDGE_FULL_PREREG.md` | preregistration | the whole account, and the prediction the 1,240 makes | `FROZEN` |
| `docs/research/ACCOUNT_BRIDGE_FULL_RESULTS.md` | result | the prediction failed; two of three refuters fired | `CURRENT-AUTHORITY` |
| `docs/research/ACCOUNT_BRIDGE_PREREG.md` | preregistration | can the bridge register a hypothesis on a real account | `FROZEN` |
| `docs/research/ACCOUNT_BRIDGE_RESULTS.md` | result | not-separable at 48 games; registered at 1,240 | `SUPERSEDED-IN-SCOPE` |
| `docs/research/BLITZ_COMPUTATION_PREREG.md` | preregistration | is there a computable value-of-computation construct | `FROZEN` |
| `docs/research/BLITZ_COMPUTATION_RESULTS.md` | result | STOP-D at Gate 1; H1 and H2 were not run | `CURRENT-AUTHORITY` |
| `docs/research/ENGINE_PARITY_PREREG.md` | preregistration | does the shipped engine agree with the measured one | `FROZEN` |
| `docs/research/ENGINE_PARITY_RESULTS.md` | result | STOP-B1; harness-shipped is the canonical record now | `CURRENT-AUTHORITY` |
| `docs/research/TIME_REPRESENTATION_PREREG.md` | preregistration | is a raw second the wrong unit for a blitz decision | `FROZEN` |
| `docs/research/TIME_REPRESENTATION_RESULTS.md` | result | the answer, plus both overturned earlier publications | `CURRENT-AUTHORITY` |
| `research/b2/as-published-75/README.md` | preserved-history | the superseded 75-game result, unmodified | `PRESERVED-HISTORY` |
| `research/b3_population_expertise/DATA_PROTOCOL.md` | research-specification | one of the frozen B3 documents, or its report/ledger | `FROZEN-OR-CURRENT` |
| `research/b3_population_expertise/FAILURES.md` | research-specification | one of the frozen B3 documents, or its report/ledger | `FROZEN-OR-CURRENT` |
| `research/b3_population_expertise/FEATURE_SCHEMA.md` | research-specification | one of the frozen B3 documents, or its report/ledger | `FROZEN-OR-CURRENT` |
| `research/b3_population_expertise/MODEL_CARD.md` | research-specification | one of the frozen B3 documents, or its report/ledger | `FROZEN-OR-CURRENT` |
| `research/b3_population_expertise/MODEL_LEDGER.md` | research-specification | one of the frozen B3 documents, or its report/ledger | `FROZEN-OR-CURRENT` |
| `research/b3_population_expertise/MODEL_SPEC.md` | research-specification | one of the frozen B3 documents, or its report/ledger | `FROZEN-OR-CURRENT` |
| `research/b3_population_expertise/PREREGISTRATION.md` | research-specification | one of the frozen B3 documents, or its report/ledger | `FROZEN-OR-CURRENT` |
| `research/b3_population_expertise/README.md` | research-specification | one of the frozen B3 documents, or its report/ledger | `FROZEN-OR-CURRENT` |
| `research/b3_population_expertise/REPORT.md` | research-specification | one of the frozen B3 documents, or its report/ledger | `FROZEN-OR-CURRENT` |
| `research/b3_population_expertise/REPRODUCIBILITY.md` | research-specification | one of the frozen B3 documents, or its report/ledger | `FROZEN-OR-CURRENT` |
| `research/b3_population_expertise/VERDICT_RULES.md` | research-specification | one of the frozen B3 documents, or its report/ledger | `FROZEN-OR-CURRENT` |
| `research/b3_population_expertise/results/POST_FREEZE_AMENDMENTS.md` | provenance-record | a freeze, seal, amendment or sample-size record | `FROZEN` |
| `research/b3_population_expertise/results/SAMPLE_SIZE_FREEZE.md` | provenance-record | a freeze, seal, amendment or sample-size record | `FROZEN` |
| `research/b3_population_expertise/reviews/FABLE_GATE_1_PREREG_REVIEW.md` | adversarial-review | an independent gate review or its packet | `FROZEN` |
| `research/b3_population_expertise/reviews/FABLE_GATE_2_PREHOLDOUT_REVIEW.md` | adversarial-review | an independent gate review or its packet | `FROZEN` |
| `research/b3_population_expertise/reviews/FABLE_GATE_3_RESULT_ADVERSARY.md` | adversarial-review | an independent gate review or its packet | `FROZEN` |
| `research/b3_population_expertise/reviews/FABLE_GATE_4_CLAIM_AUDIT.md` | adversarial-review | an independent gate review or its packet | `FROZEN` |
| `research/b3_population_expertise/reviews/GATE_1_PACKET.md` | adversarial-review | an independent gate review or its packet | `FROZEN` |
| `research/b3_population_expertise/reviews/GATE_2_PACKET.md` | adversarial-review | an independent gate review or its packet | `FROZEN` |
| `research/b3_population_expertise/reviews/GATE_3_PACKET.md` | adversarial-review | an independent gate review or its packet | `FROZEN` |
| `research/blitz/README.md` | research-index | what the code under this directory answers | `CURRENT` |
| `research/discovery-oracle/README.md` | research-index | what the code under this directory answers | `CURRENT` |
| `research/evidence-architecture/README.md` | research-index | what the code under this directory answers | `CURRENT` |
| `research/measurement/README.md` | research-index | what the code under this directory answers | `CURRENT` |
| `scripts/build_account_corpus.ts` | script | an executable gate, scanner, builder or runner | `CURRENT-AUTHORITY` |
| `scripts/build_anchor_set.ts` | script | an executable gate, scanner, builder or runner | `CURRENT-AUTHORITY` |
| `scripts/build_blitz_research_dataset.ts` | script | an executable gate, scanner, builder or runner | `CURRENT-AUTHORITY` |
| `scripts/build_import_corpus.ts` | script | an executable gate, scanner, builder or runner | `CURRENT-AUTHORITY` |
| `scripts/build_opening_book.ts` | script | an executable gate, scanner, builder or runner | `CURRENT-AUTHORITY` |
| `scripts/build_phase_difficulty_reference.ts` | script | an executable gate, scanner, builder or runner | `CURRENT-AUTHORITY` |
| `scripts/build_population_baseline.ts` | script | an executable gate, scanner, builder or runner | `CURRENT-AUTHORITY` |
| `scripts/build_real_shape_fixture.ts` | script | an executable gate, scanner, builder or runner | `CURRENT-AUTHORITY` |
| `scripts/build_sensitivity_reference.ts` | script | an executable gate, scanner, builder or runner | `CURRENT-AUTHORITY` |
| `scripts/build_share_card.ts` | script | an executable gate, scanner, builder or runner | `CURRENT-AUTHORITY` |
| `scripts/check_bundle_budget.ts` | script | an executable gate, scanner, builder or runner | `CURRENT-AUTHORITY` |
| `scripts/dev-db.sh` | script | an executable gate, scanner, builder or runner | `CURRENT-AUTHORITY` |
| `scripts/gate-scan.ts` | script | an executable gate, scanner, builder or runner | `CURRENT-AUTHORITY` |
| `scripts/inertia-scan.ts` | script | an executable gate, scanner, builder or runner | `CURRENT-AUTHORITY` |
| `scripts/notice_coverage.ts` | script | an executable gate, scanner, builder or runner | `CURRENT-AUTHORITY` |
| `scripts/read_vocabulary.ts` | script | an executable gate, scanner, builder or runner | `CURRENT-AUTHORITY` |
| `scripts/register-scan.ts` | script | an executable gate, scanner, builder or runner | `CURRENT-AUTHORITY` |
| `scripts/run_account_prereg.ts` | script | an executable gate, scanner, builder or runner | `CURRENT-AUTHORITY` |
| `scripts/run_budgeted_search.ts` | script | an executable gate, scanner, builder or runner | `CURRENT-AUTHORITY` |
| `scripts/run_deep_reference_saturation.ts` | script | an executable gate, scanner, builder or runner | `CURRENT-AUTHORITY` |
| `scripts/run_discovery_oracle.ts` | script | an executable gate, scanner, builder or runner | `CURRENT-AUTHORITY` |
| `scripts/run_engine_parity.ts` | script | an executable gate, scanner, builder or runner | `CURRENT-AUTHORITY` |
| `scripts/run_gates.ts` | script | an executable gate, scanner, builder or runner | `CURRENT-AUTHORITY` |
| `scripts/run_import_harness.ts` | script | an executable gate, scanner, builder or runner | `CURRENT-AUTHORITY` |
| `scripts/said-once-scan.ts` | script | an executable gate, scanner, builder or runner | `CURRENT-AUTHORITY` |
| `scripts/sf-wasm.mjs` | script | an executable gate, scanner, builder or runner | `CURRENT-AUTHORITY` |
| `scripts/sf-wasm.sh` | script | an executable gate, scanner, builder or runner | `CURRENT-AUTHORITY` |
| `scripts/test-level-scan.ts` | script | an executable gate, scanner, builder or runner | `CURRENT-AUTHORITY` |
| `scripts/two-hands-scan.ts` | script | an executable gate, scanner, builder or runner | `CURRENT-AUTHORITY` |
| `scripts/uci-engine.ts` | script | an executable gate, scanner, builder or runner | `CURRENT-AUTHORITY` |
| `tests/LEVELS.md` | protocol | how much reality a test runs against, and which rung a claim needs | `CURRENT-AUTHORITY` |

### The mandatory set, checked explicitly

- **Decision records present and read: 14** — D00, D01, D02, D03, D04, D05, D08, D09, D20, D21, D22, D23, D24, D25.
- **`D06`, `D07`, `D10`–`D19` do not exist as files.** `docs/decisions/README.md` carries D06, D07, D10, D12, D17 and D18 as *rows in a deferred table with a trigger each*, and never as nodes. D08 and D09 exist out of numeric order because the table is ordered by state, not by id. No file with ids D11, D13–D16, D19 exists on any ref. This is a numbering gap, not a corpus gap, and it is recorded rather than smoothed over.
- **Named core governance documents**: `MASTER_PRODUCT_DEBT.md`, `PRODUCTION_READINESS_LEDGER.md`, `FINDINGS.md`, `ACTION_PLAN.md`, `INERTIAL_UX_LAWS.md`, `INTERACTION_GEOMETRY.md`, `VALUE_CLARITY.md`, `VALUE_CLARITY_FIELD_PROTOCOL.md`, `ACQUISITION_EVIDENCE.md`, `MEASUREMENTS.md`, `tests/LEVELS.md`, all seven `design-council/` files, `.github/workflows/verify-build.yml`, `scripts/run_gates.ts` — **all present, all classified above**.

## 3. The cases

### `C01-oracle-before-product` — research-discovery

| field | value |
| --- | --- |
| **problem** | A better candidate search cannot be justified by argument; there was no place to grade one. |
| **initial_assumption** | Write the search first, in TypeScript, in the product. |
| **falsifier** | the oracle stops being able to reproduce a shipped result (bridge drift) |
| **negative_control** | selftest.py null worlds; it found the generator leaking 1.1 points of calibration gap into every phase bucket of a world with no correlation |
| **positive_control** | planted worlds the harness must recover |
| **freeze_point** | no search algorithm written in either language until M0 passes |
| **derived_or_declared** | DERIVED |
| **authority_before** | argument |
| **authority_after** | research/discovery-oracle/ results, with normaliseConfidence remaining the only authority on what a confidence level asserts |
| **test_reality_level** | simulation with known ground truth |
| **promotion_rule** | E1 external implementation exists -> research prototype only; a port needs PORT_AFTER_EQUIVALENCE |
| **decision** | Build the judge outside the product first. Python under research/, TypeScript contracts only in shared/. |
| **reversal_condition** | oracle cannot reproduce a shipped result; a component reaches E4; bridge maintenance costs more than the duplication it prevents |
| **failure_discovered** | the oracle caught its own generator defect before it caught the product's |
| **lesson** | Build the judge before the contender, and let the judge be able to say no. |
| **observed_evidence** | q1_units.json 6,000 records; q4_end_to_end.json 11,600 records; parity_check worst disagreement 9.7e-17 between the TS detector and its Python reproduction |
| **external_evidence** | pysubgroup; statsmodels; scikit-mine; onlineFDR; Spotify confidence |
| **what_was_not_known** | whether any external implementation would earn a port at all |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | docs/measurement/; docs/evidence-architecture/; research/b3_population_expertise/; tests/gates positive controls |
| **was_generalized** | True |
| **confidence** | 0.95 |
| **source_paths** | `docs/decisions/D00-research-oracle-before-product-code.md`, `research/discovery-oracle/`, `docs/discovery-v2/M0_AUDIT.md` |

### `C02-point-in-time-contract` — research-discovery

| field | value |
| --- | --- |
| **problem** | A search finds a feature that did not exist at decision time, and the result looks exactly like a real finding. |
| **initial_assumption** | A label per column (PRE_DECISION \| COMMIT \| POST_GAME) is enough. |
| **falsifier** | a leaked feature reaches a validated claim anyway |
| **negative_control** | UNKNOWN |
| **positive_control** | tests/discovery/no-feature-from-the-future.test.ts -- three mutations (widen the cutoff, drop the observability filter, tighten <= to <) must change the visible answer |
| **freeze_point** | the cutoff is the commit, not the reveal |
| **derived_or_declared** | DERIVED |
| **authority_before** | review |
| **authority_after** | featureAsOf over observed_at <= commit_timestamp, latest by created_at |
| **test_reality_level** | L2 contract |
| **promotion_rule** | E2 -- contract exists and its mutations go red; no leak yet caught in production data because there is none |
| **decision** | A FeatureObservation with event_time, observed_at, created_at. Missing is null, never a default. |
| **reversal_condition** | DeepGameFeatures wired without a FeatureSpec; a leaked feature reaches a validated claim; event_time still unread at the first real study |
| **failure_discovered** | the recording existed and the enforcement did not |
| **lesson** | Identity and timing follow semantics, not labels; a default is a fabricated observation. |
| **observed_evidence** | playerRelativeThinkPercentile is legitimately available at decision time AND recomputed later, so a column label cannot see the difference; audit of every feature reaching detect() found no leak; DeepGameFeatures: 20+ whole-game measurements, no consumers, one import from the discovery path |
| **external_evidence** | Feast point-in-time join semantics |
| **what_was_not_known** | whether the three timestamps are the right three; event_time is read by nothing |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | shared/detector.ts missingness; docs/blitz/ADR-002; INERTIAL_UX_LAWS LAW 8 |
| **was_generalized** | True |
| **confidence** | 0.92 |
| **source_paths** | `docs/decisions/D01-point-in-time-feature-contract.md`, `shared/discovery/feature-contract.ts`, `shared/game-features.ts` |

### `C03-unit-of-inference-rejected` — research-discovery

| field | value |
| --- | --- |
| **problem** | The shipped standard error counts decisions as independent when moves share a game. |
| **initial_assumption** | The shipped uncertainty is too small and a game-cluster-aware judge is the fix. |
| **falsifier** | a real record measures ICC above 0.05; records reach ~50 games; the chain loses its second stage; the cluster bootstrap is measured and beats both |
| **negative_control** | null worlds, 8,000 records |
| **positive_control** | 14 worlds x 400 independent records: the spread ACROSS replications IS the sampling error, measured not estimated |
| **freeze_point** | UNKNOWN |
| **derived_or_declared** | DERIVED |
| **authority_before** | the textbook answer (cluster-robust SEs) |
| **authority_after** | the measurement; the detector does not change, and shared/discovery/clustering.ts measures the ICC without acting on it |
| **test_reality_level** | simulation with measured truth |
| **promotion_rule** | the repair never reached E1 on our data, so it was not made |
| **decision** | REJECT the clustered judge. Add the measurement, not the repair. ScoredDecision deliberately does not gain game_id. |
| **reversal_condition** | the four listed above |
| **failure_discovered** | the research arm had believed the clustered answer since the blitz study while the shipped detector used the other one -- a standing internal contradiction D02 exists to resolve |
| **lesson** | The textbook repair must beat the shipped thing on measurement, not on principle; and do not build a field for an estimator you have just refused. |
| **observed_evidence** | shipped sd(z) 1.02-1.38 across ICC 0-0.058; clustered sd(z) 1.27-1.57, worse calibrated in 82 of 84 cells; 0 validated false claims in 8,000 null records, upper 95% 0.00048 against a 0.02 ceiling |
| **external_evidence** | statsmodels cluster-robust covariance; the repository's own research/blitz/bootstrap.py cluster_bootstrap |
| **what_was_not_known** | the ICC of a real player's calibration gap -- scoreDecisions drops game_id before the detector sees it |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | docs/MASTER_PRODUCT_DEBT.md R-14 (refuted section) |
| **was_generalized** | True |
| **confidence** | 0.95 |
| **source_paths** | `docs/decisions/D02-the-unit-of-inference.md`, `research/discovery-oracle/q1_units.py`, `shared/discovery/clustering.ts` |

### `C04-what-a-search-may-read` — research-discovery

| field | value |
| --- | --- |
| **problem** | A feature can be recorded, correct and point-in-time clean and still be one a search must never read. |
| **initial_assumption** | Everything measured is searchable. |
| **falsifier** | a feature declared discovery_eligible with no argument written down |
| **negative_control** | UNKNOWN |
| **positive_control** | tests asserting searchableFeatures refuses a TARGET even when the registry declares it eligible |
| **freeze_point** | UNKNOWN |
| **derived_or_declared** | DERIVED (role beats flag) |
| **authority_before** | the six shipped bucket closures over the atom |
| **authority_after** | FeatureSpec with all fields required; searchableFeatures returns the set AND the refusals with reasons |
| **test_reality_level** | L2 contract |
| **promotion_rule** | E2 -- shape with tests; no search reads it yet |
| **decision** | Three layers: measured, discovery-eligible, validation-eligible; every flag required, never defaulted. |
| **reversal_condition** | a flag declared without argument; semantic_confidence unread at the first study; a feature legitimately eligible for one protocol and not another |
| **failure_discovered** | adding a column widened the search space by doing nothing |
| **lesson** | The role is what the feature is; the flag is a judgement somebody made. When they disagree, the role wins. |
| **observed_evidence** | cp_loss and accuracy arrive after the engine speaks; a subgroup described by its own outcome is arithmetic; measurement_protocol decides eligibility, never membership; reveal_timing was on the atom, in the database, mapped by the service and set by the UI -- and nothing enforced it |
| **external_evidence** | Feast-style feature registries -- none carries this distinction |
| **what_was_not_known** | whether semantic_confidence will ever be read |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | shared/evidence-policy.ts; D20 claim-class union |
| **was_generalized** | True |
| **confidence** | 0.9 |
| **source_paths** | `docs/decisions/D03-what-a-search-may-read.md`, `shared/discovery/feature-contract.ts`, `docs/blitz/ADR-002-discovery-strata.md` |

### `C05-candidate-search-measured` — research-discovery

| field | value |
| --- | --- |
| **problem** | The six fixed buckets cannot express fast AND endgame, and the chain names the wrong subgroup 11% of the time on such worlds. |
| **initial_assumption** | An uncorrected search over hundreds of conjunctions will blow through the 0.02 false-claim ceiling. |
| **falsifier** | false-claim rate above 0.02 on a real corpus; a depth that cannot be chosen without seeing the outcome; a port disagreeing with pysubgroup; the Jaccard >= 0.60 line doing the work |
| **negative_control** | shuffled-label control 0.0006 on 1,800 planted records |
| **positive_control** | planted regions the search must recover exactly |
| **freeze_point** | the search runs on the derivation half only; its top candidate is frozen and judged on games it never saw |
| **derived_or_declared** | DERIVED |
| **authority_before** | the six buckets |
| **authority_after** | still the six buckets -- the search is E3, a candidate for porting and nothing more |
| **test_reality_level** | simulation with planted ground truth |
| **promotion_rule** | the rejection rule was written down before the run: rejected unless correct attribution improves WITHOUT raising the false-claim rate past 0.02 |
| **decision** | Measured, not rejected. Nothing is ported. D06 stays shut although its trigger fired. |
| **reversal_condition** | the four falsifiers above |
| **failure_discovered** | the first version searched `accurate`, whose winning region was a restatement of the target |
| **lesson** | Declare the rejection rule before the run, and state the expectation you expect to lose. |
| **observed_evidence** | false-claim rate 0.0010 (95% CI 0.0004-0.0026) at depth 2 on 4,000 null records; interaction-only on-target 0% -> 33.5%, median Jaccard 1.000; depth 2 loses the clean plants: clean-fast 0.1725 -> 0.0650 |
| **external_evidence** | pysubgroup, pinned in environment.lock and imported by nothing in the product |
| **what_was_not_known** | which depth a real record resembles |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | D05 choice rule; D08 ATTRIBUTION_K rule; docs/research/*_PREREG.md; research/b3_population_expertise/VERDICT_RULES.md |
| **was_generalized** | True |
| **confidence** | 0.95 |
| **source_paths** | `docs/decisions/D04-candidate-search.md`, `research/discovery-oracle/q7_candidate_search.py` |

### `C06-blitz-time-rejected-twice` — research-discovery

| field | value |
| --- | --- |
| **problem** | fast-under-45s and slow-over-2m are absolute-second cuts on a 3-minute clock; the bucket the product's narrative rests on is unreadable on the route built to measure it. |
| **initial_assumption** | Move the thresholds. |
| **falsifier** | the declared two-condition rule; then the repaired three-condition rule |
| **negative_control** | blitz null records: 0 false claims in 1,600, upper 95% 0.0024 |
| **positive_control** | clean-middlegame drawn four times across four runs at 0.4475 / 0.4175 / 0.4175 / 0.4225 -- the control is stable, so the world is fine and the bucket is not |
| **freeze_point** | the choice rule, the candidate and the cuts were committed at 1774b66 before the harness produced a number |
| **derived_or_declared** | DECLARED_AND_VERIFIED (cuts derived from a constant the product already uses: half and double a 1/30 even share) |
| **authority_before** | the six absolute-second buckets |
| **authority_after** | unchanged; the shipped behaviour reports one-side-empty instead of asking for thirty more decisions |
| **test_reality_level** | simulation |
| **promotion_rule** | a passing candidate earns the right to be PROPOSED for hypothesis-manifest.ts, which is its own hash change |
| **decision** | DEFER on the choice; ship the honest refusal. Alternative 3 REJECTED twice. |
| **reversal_condition** | a declared choice rule then one run; a real blitz record; D04's conjunctions; the record reaching a size where 27% usable stops mattering |
| **failure_discovered** | condition 2 of the first rule was a question NEITHER arm could answer -- the plant filled 97% of the record, so nothing could contrast against it. The FAIL was scored anyway because the rule is not edited after the fact, and the harness was repaired instead. |
| **lesson** | A failed test can be a failure of the test. Score it as declared, then repair the instrument in a new preregistration -- do not re-score the old run. |
| **observed_evidence** | fast-under-45s usable on 0.2725 of blitz records; slow-over-2m on 0.0037; candidate fast-relative usable 0.9956, slow-relative 1.0000; clean-fast validated-on-target 0.0000 vs middlegame control 0.4175; second run: relative-fast validated-on-target 0.0475 against a declared bar of 0.2112 |
| **external_evidence** | — |
| **what_was_not_known** | whether a real blitz record resembles the simulated one -- the synthetic 3+0 record produces fast-under-45s at 480/0 |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | research/b3_population_expertise/results/POST_FREEZE_AMENDMENTS.md; docs/research/TIME_REPRESENTATION_RESULTS.md section 7 |
| **was_generalized** | True |
| **confidence** | 0.95 |
| **source_paths** | `docs/decisions/D05-blitz-time.md`, `research/discovery-oracle/q6_blitz_time.py`, `research/discovery-oracle/q8_relative_time.py`, `research/discovery-oracle/q9_answerable_plant.py` |

### `C07-attribution-veto` — research-discovery

| field | value |
| --- | --- |
| **problem** | A validated claim can name a bucket that merely contains the true region, and every step behaves correctly while the player is told the wrong thing. |
| **initial_assumption** | Renaming the claim to the narrower region the split found is the fix. |
| **falsifier** | a record reaches 60 validation games; a real record shows false veto above the 10% ceiling; the chain shows claims without the prospective step; a search is ported |
| **negative_control** | clean plants where the region IS the bucket -- a veto there is wrong: 16 of 239 true claims withheld, 6.69% |
| **positive_control** | interaction-only and proxy-correlated, where every validated claim names something too wide |
| **freeze_point** | the choice rule (smallest k whose worst false-veto rate stays inside 10%) declared before the run |
| **derived_or_declared** | DERIVED |
| **authority_before** | separability alone |
| **authority_after** | attribution is implemented, gated and measured, and called from nothing |
| **test_reality_level** | simulation |
| **promotion_rule** | E3 permits the test to exist; wiring it in needs the 60-game trigger |
| **decision** | DEFER. Withhold and name, never rename. ATTRIBUTION_K = 2.5 and it was NOT re-chosen after the size sweep that would have flattered 3.0. |
| **reversal_condition** | five, one of which has fired and been closed |
| **failure_discovered** | reversal condition 2 was written as a prediction and the prediction was wrong: the misattribution does not stop happening when the vocabulary gains conjunctions, because the search is a separate pipeline. The condition's own text conflated 'expressible' with 'the chain stops naming the wrong one'. |
| **lesson** | A reversal condition is itself a claim and can be refuted; record what actually happened rather than what the condition predicted. |
| **observed_evidence** | ATTRIBUTION_K sweep: k=2.5 gives worst false veto 0.0556 for 0.0917 caught; growing only the validation half: 20 games catches 0.0000, 60 games 0.2283, 140 games 0.4729; with a search available, 57% of wrong claims now have a right name somewhere; 34% do not |
| **external_evidence** | subgroup-discovery libraries solve the search half and none solves refusing to trust an already-chosen region |
| **what_was_not_known** | the false-veto rate on a real record |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | docs/decisions/README.md trigger table discipline; D25 reversal conditions marked FIRED with outcomes |
| **was_generalized** | True |
| **confidence** | 0.95 |
| **source_paths** | `docs/decisions/D08-attribution.md`, `research/discovery-oracle/q5_attribution.py`, `research/discovery-oracle/q10_veto_after_search.py` |

### `C08-frozen-hypothesis-identity` — research-discovery

| field | value |
| --- | --- |
| **problem** | Evidence accumulates against an id. Two different hypotheses sharing one id collect evidence for a claim they are not, silently, while every statistical test still passes. |
| **initial_assumption** | A name is enough (claim-fast-under-45s). |
| **falsifier** | two hypotheses found sharing an id; a legitimate re-derivation producing new ids for an unchanged statement |
| **negative_control** | UNKNOWN |
| **positive_control** | twelve one-change variants -- a threshold moved by 1e-5, < to <=, direction flipped, formula version bumped, derivation games, stopping rule, error budget, minimum effect, protocol, parent, target, generator -- all thirteen ids must be distinct |
| **freeze_point** | freeze() itself |
| **derived_or_declared** | DERIVED (identity = SHA256 of the canonical serialisation) |
| **authority_before** | a human-readable name |
| **authority_after** | hypothesis_id = SHA256(canonicalJson(manifest)) |
| **test_reality_level** | L1/L2, differenced against node:crypto over published vectors at every length 0-200 and 2,000 seeded random strings including surrogate pairs |
| **promotion_rule** | PORT_AFTER_EQUIVALENCE -- the hand-written SHA-256 is differenced against the platform's |
| **decision** | Content-addressed identity. freeze REFUSES rather than repairs. The protocol is RE-DERIVED, never believed. |
| **reversal_condition** | id collision; re-derivation churn; shared/ stops being isomorphic |
| **failure_discovered** | the first version took validation_protocol on trust, so a caller could freeze an ENVIRONMENT predicate declaring matched-unseen-positions -- INV-10 violated in writing at the moment of commitment. Caught by a review bot on the PR that introduced it. |
| **lesson** | Identity follows semantics, not the label; and a freeze that repairs is a freeze of something nobody wrote. |
| **observed_evidence** | a name stops working the moment a subgroup carries a number; canonicalJson refuses undefined, non-finite numbers and -0 because each collides under JSON.stringify |
| **external_evidence** | MLflow / W&B run manifests with content-addressed ids |
| **what_was_not_known** | whether effect_estimate_derivation belongs inside the hash |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | research/b3_population_expertise/results/PREREGISTRATION_FREEZE.json; research/b3_population_expertise/src/run.py require_seal(); docs/measurement board_predicate_sha256 |
| **was_generalized** | True |
| **confidence** | 0.97 |
| **source_paths** | `docs/decisions/D09-frozen-hypothesis-manifest.md`, `shared/discovery/hypothesis-manifest.ts`, `shared/discovery/sha256.ts`, `tests/discovery/one-byte-is-a-different-hypothesis.test.ts` |

### `C09-protocol-matching-union` — research-discovery

| field | value |
| --- | --- |
| **problem** | A claim about the decision environment was being tested by a protocol that removes the environment, and both grades were terminal. |
| **initial_assumption** | A list of bucket keys is the right mechanism; a class chosen by precedence is safe. |
| **falsifier** | a real subgroup whose class cannot be derived from its features; UNKNOWN firing on obviously testable subgroups |
| **negative_control** | UNKNOWN |
| **positive_control** | the repository's own drill-loop test, run with one line printed from it |
| **freeze_point** | UNKNOWN |
| **derived_or_declared** | DERIVED (requirements are the UNION over the predicate's features) |
| **authority_before** | a hand-kept list of bucket keys |
| **authority_after** | one table; validation-protocol.ts derives protocolFor from it and answers exactly what it answered before |
| **test_reality_level** | L2, with the existing test file unchanged and passing |
| **promotion_rule** | UNKNOWN dispatches to no-verdict, which is a protocol in the table rather than an absence |
| **decision** | Derive the class from what the subgroup READS. The product choice was the owner's and was taken in PR #42. |
| **reversal_condition** | three, one of which closed the node |
| **failure_discovered** | the first version picked ONE class by precedence. The prose described a conjunction and the code implemented a priority, so `phase AND humanMoveProbability` dispatched to a model-locked holdout that never matches a position. Caught by a review bot on the PR that introduced it. |
| **lesson** | When prose says conjunction and code says precedence, the code is what runs. Re-derive from the parts rather than ranking them. |
| **observed_evidence** | protocolFor returned timed-holdout for that bucket since it was written and nothing consulted it; slow-over-2m at 50.7% accuracy against 64.9% outside it -- an environment bucket is a COMMON weakest bucket; B2 puts 99.7% of a blitz player's decisions inside fast-under-45s |
| **external_evidence** | none applicable -- no library has an opinion about whether a clock is a property of a board |
| **what_was_not_known** | whether deciding in 12 seconds because the clock is running and because nothing is at stake are the same event -- the measurement that would separate them does not exist |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | D09 freeze re-deriving the protocol; commitDecision re-deriving phase from the FEN |
| **was_generalized** | True |
| **confidence** | 0.95 |
| **source_paths** | `docs/decisions/D20-protocol-matching.md`, `shared/discovery/claim-class.ts`, `shared/validation-protocol.ts`, `docs/blitz/ADR-003-a-rule-the-product-breaks.md` |

### `C10-feedback-exposure-deferred` — product-measurement

| field | value |
| --- | --- |
| **problem** | Decision #1 and decision #200 are one population and nothing in the atom could tell them apart. |
| **initial_assumption** | LAW 12 states the risk; a schema for it can be chosen now. |
| **falsifier** | a measurement showing the gap differs between early and late decisions within a player at n >= MIN_BUCKET_N per half |
| **negative_control** | UNKNOWN |
| **positive_control** | tests/shared/two-regimes-are-not-one-population.test.ts -- two decisions differing only in protocol version must not pool, and an unversioned row is its own regime rather than version 1 |
| **freeze_point** | UNKNOWN |
| **derived_or_declared** | option 3 (a count of prior reveals) is the only one of the three re-derivable for historical rows |
| **authority_before** | StratumKey without protocolVersion |
| **authority_after** | StratumKey WITH protocolVersion; CURRENT_PROTOCOL_VERSION = 2 |
| **test_reality_level** | L2 |
| **promotion_rule** | no exposure field is added; GATE-EXPOSURE-CONTEXT stays unregistered until there is something for it to hold |
| **decision** | Findings 1 and 2 closed in one commit; Finding 3 DEFER with its trigger written down. Discovery must not widen in the meantime. |
| **reversal_condition** | a within-player early/late measurement; or evidence the decision focus did not change stated confidence |
| **failure_discovered** | a version that moves while nothing stratifies on it is WORSE than a version that never moves -- it reads as though the change were recorded as a separable population when the rows still pool |
| **lesson** | Do not add an axis for a threat that may be flat; and the axis and the bump belong in one commit. |
| **observed_evidence** | protocol_version was stamped on every row and read by nothing -- StratumKey carried protocol, revealTiming and engineBuild and not the version; blitz-strata.ts had it right and was never generalised; no atom field orders decisions or counts prior exposure |
| **external_evidence** | — |
| **what_was_not_known** | whether the calibration gap moves with exposure at all, and whether reveal exposure and claim exposure differ |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | shared/next-action.ts's refusal to change what a player sees based on their own measurements |
| **was_generalized** | True |
| **confidence** | 0.93 |
| **source_paths** | `docs/decisions/D21-feedback-exposure.md`, `shared/evidence-policy.ts`, `shared/measurement-protocol.ts`, `shared/blitz-strata.ts` |

### `C11-next-action-shadow` — product-ux

| field | value |
| --- | --- |
| **problem** | A derivation claims to know what a player should do next; the plan said watch it disagree with the screens for a while first, and the wait could not finish. |
| **initial_assumption** | Wait for players. Ownership is blocked on shadow rows that will accumulate. |
| **falsifier** | a screen and the derivation disagreeing on a state in a walk over the built app; a person disagreeing with a proposal a test called correct |
| **negative_control** | UNKNOWN |
| **positive_control** | GATE-NEXT-ACTION-RESOLVES-BLOCKER's control is the mapping this product actually shipped -- nothing-scored answered with 'play another game' |
| **freeze_point** | no screen handed over |
| **derived_or_declared** | DERIVED from what the record is missing, never from a prediction about the player |
| **authority_before** | three screens each computing their own next step |
| **authority_after** | still the screens; the derivation runs in shadow on one surface |
| **test_reality_level** | L2 for the mapping's totality/ontoness/reachability; L5 walk for the disagreement |
| **promotion_rule** | derivation -> shadow -> ownership per state |
| **decision** | State the correspondence once and test it; keep the live shadow only where it is free (+16.1 kB raw on two hot routes otherwise). |
| **reversal_condition** | four, including 'the blind spots close' |
| **failure_discovered** | the shadow's ledger deduplicated per NAME, so whichever screen rendered first wrote its row and every other surface was silently absent -- a ledger that would have looked like agreement with two thirds of the product missing |
| **lesson** | A shadow with fabricated inputs measures its own description of a screen, not the screen. Fix the instrument before reading it. |
| **observed_evidence** | analysisRunning was hard-coded false under a comment saying the front door does not subscribe -- it does, three lines above; offered was the constant "play", a word in no vocabulary; the comparison was one line of hand-written disjunction, invisible to every other screen |
| **external_evidence** | — |
| **what_was_not_known** | whether a person would have wanted the proposal |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | shared/interaction-mode.ts, same sequencing, same 'it decides nothing yet' |
| **was_generalized** | True |
| **confidence** | 0.94 |
| **source_paths** | `docs/decisions/D22-next-action-ownership.md`, `shared/next-action.ts`, `client/src/lib/next-action-shadow.ts`, `shared/interaction-mode.ts` |

### `C12-learning-first-experiment` — research-learning

| field | value |
| --- | --- |
| **problem** | The product measures a player and does not teach one; the gap is structural, and 'how do we present an insight better' asks in the wrong place. |
| **initial_assumption** | Improving presentation is the lever. |
| **falsifier** | the study returns no separation; the harm series rises with the headline series |
| **negative_control** | the outcome that says the current design is fine -- no separation once base rate is in the model -- declared before the run and the outcome the design estimates best |
| **positive_control** | UNKNOWN |
| **freeze_point** | the study specification |
| **derived_or_declared** | DECLARED_UNVERIFIED at the time |
| **authority_before** | the brief's framing (show the current loop is inferior) |
| **authority_after** | a symmetric design |
| **test_reality_level** | arithmetic over code and published effects; no person measured |
| **promotion_rule** | E1 permits a research prototype and nothing more; nothing ships on a positive result |
| **decision** | Isolate the single testable component; fold the instrument fix into the outcome definition rather than preceding it. |
| **reversal_condition** | five |
| **failure_discovered** | the 47-81% figure was the ONE-SITTING probability; replicated needs two passing days, so the null is P(pass)^2 = 9-65%. And the recall scorer was materially better than D23 described. |
| **lesson** | A study can be well designed and about the wrong question; correcting a critic's own arithmetic is part of superseding it. |
| **observed_evidence** | TRANSFER_POSITION_COUNT = 3, TRANSFER_MINIMUM_SUCCESSES = 2 -- replicated arrives 9-65% of the time whether or not anything was learned; a graded success is recall floor AND move accuracy; applied_rule is collected and excluded from the grade; the prescribed act loses >=100 cp on 15.0% of items where the rule says to act |
| **external_evidence** | Contemporary Educational Psychology 79 (2024) 2x2: layout did not move learning, self-explanation did; Pan & Rickard 2018 transfer d=0.40 moderated by response congruency; Southwick et al. 2026 N=44,213, 3.61x, longitudinal cohort -- enters no arithmetic |
| **what_was_not_known** | the base rates that decide whether the transfer bar clears chance |
| **supersedes** | — |
| **superseded_by** | C13-learning-architecture-narrow |
| **generalized_to** | D24's explicit two-error correction block |
| **was_generalized** | True |
| **confidence** | 0.9 |
| **source_paths** | `docs/decisions/D23-insight-to-action.md`, `docs/learning/EXPERIMENT.md`, `docs/learning/FALSIFICATION_REGISTER.md` |

### `C13-learning-architecture-narrow` — research-learning

| field | value |
| --- | --- |
| **problem** | Can the insight -> uncued-transfer layer be evaluated at all? |
| **initial_assumption** | MEASUREMENT-BLOCKED; then, after RC-06, a severity-protected defensive rule class explains which classes are usable. |
| **falsifier** | Gate A changes or removes the eligible set; Gate B cannot produce an exchangeable contrast |
| **negative_control** | the trigger-negative cell -- and Gate B's precondition FAILS on RC-06 because _threat_satisfies recomputes the trigger, so the contrast would measure the predicate |
| **positive_control** | the gradient control C6 plants |
| **freeze_point** | no participant recruited |
| **derived_or_declared** | DERIVED |
| **authority_before** | D23's choice of first experiment |
| **authority_after** | two pre-human gates; Study D blocked behind both |
| **test_reality_level** | offline scoring against an engine; humans measured 0 |
| **promotion_rule** | no recruitment until Gate A and Gate B pass |
| **decision** | NARROW. Withdraw the 'severity-protected' wording; RC-06 is an observed survivor, not an explained family. |
| **reversal_condition** | seven |
| **failure_discovered** | no design rule extracted so far predicts which rule class will be usable; and the SDT criterion is not a player parameter |
| **lesson** | Reconcile a decision to the LATER evidence rather than preserving the story that produced the earlier draft -- and say which sentence is withdrawn. |
| **observed_evidence** | RC-06: B_valid\|T+ .968, B_valid\|T- .200, separation +.768, 242/242, base rate ~1.24%; PR #50 expanded to 15 classes across 8 families and 3 selection strategies and reversed the round-2 correlation; a move-blind agent scores d' 0.80 and c +0.88 on RC-06 from predicate sizes alone; move-blind c predicts observed c at r=+0.72 |
| **external_evidence** | Sheridan/Reingold minimal functional pairs; no validated chess paradigm establishes that seeing governed the move without the cue becoming part of the task |
| **what_was_not_known** | action-model validity, exchangeability, cueing, product-content mismatch |
| **supersedes** | C12-learning-first-experiment |
| **superseded_by** | C14-construct-underidentified |
| **generalized_to** | D25's amends-rather-than-erases block |
| **was_generalized** | True |
| **confidence** | 0.93 |
| **source_paths** | `docs/decisions/D24-learning-architecture.md`, `docs/learning-v2/`, `research/learning/criterion_channel.py` |

### `C14-construct-underidentified` — research-evidence-architecture

| field | value |
| --- | --- |
| **problem** | RC-06's separation of +0.768 is computed from two terms under two different definitions of B. |
| **initial_assumption** | The observation channel is the bottleneck; richer process evidence would fix it. |
| **falsifier** | six reversal conditions, two of which have FIRED and are recorded with their outcomes |
| **negative_control** | the trigger-negative cell scored by the SAME predicate: +.48 on C/D, the highest-value observation in the programme, and free |
| **positive_control** | seven synthetic learners, rate-matched, scored by a Bayes-optimal classifier |
| **freeze_point** | the eleven-stage inference chain, frozen, with the status of every arrow |
| **derived_or_declared** | DERIVED (C11 is enforced at import: RuleClass.__post_init__ refuses a class conceding a scope gap in a comment) |
| **authority_before** | docs/measurement/STRONGEST_PERMITTED_CLAIM.json 1.3.0 |
| **authority_after** | docs/evidence-architecture/STRONGEST_PERMITTED_CLAIM.json 2.2.0, superseding 1.3.0 FOR THE CLAIMS IT CONTRADICTS ONLY |
| **test_reality_level** | offline engine scoring, 250 items per cell, 0 failures, positive control reproducing published values |
| **promotion_rule** | E1 reached, E2 attempted and not reached; humans measured 0; production behaviour changed none |
| **decision** | CONSTRUCT-UNDERIDENTIFIED. Not DOMAIN-MODEL-FAILED, not MOVE-ONLY-SUFFICIENT, not PROCESS-EVIDENCE-REQUIRED. |
| **reversal_condition** | six, explicitly including one that says what an observation would have to be: 'not the response' |
| **failure_discovered** | the detector #49 built to find this reports RC-12 as clean, because it tests for a literal _trigger( call and RC-12 inlines the condition. And RC-11, the recommended escape, is VACANT -- the prediction that method-shaped rules escape is refuted. |
| **lesson** | Richer measurement is not the answer to a degenerate response predicate; measure that before buying a sensor. And preserve the failure -- no repair of RC-06. |
| **observed_evidence** | under one fixed predicate separation is -0.048, not +0.768; 99.5% of legal moves satisfy the rule on T- items; on 93.2% every legal move does; C11 on all 17 classes: 8 VACANT, 2 SATURATED, 7 MEASURABLE -- four of the top five published separations are in the first two groups, including the incumbent floor RC-01 |
| **external_evidence** | Maia 1/2/3 -- available, licensed, deferred with the reason |
| **what_was_not_known** | the chose-past-it base rate |
| **supersedes** | C13-learning-architecture-narrow |
| **superseded_by** | — |
| **generalized_to** | — |
| **was_generalized** | False |
| **confidence** | 0.95 |
| **source_paths** | `docs/decisions/D25-evidence-architecture.md`, `docs/evidence-architecture/C11_SCREEN.md`, `docs/evidence-architecture/ACTION_MODEL_DECISION.md`, `research/evidence-architecture/c11_screen.py` |

### `C15-b2-time-representation` — research-b2

| field | value |
| --- | --- |
| **problem** | Is a raw second the wrong unit for a blitz decision? |
| **initial_assumption** | The 75-game corpus was the corpus. |
| **falsifier** | the preregistered outcome rule |
| **negative_control** | random-boundary null; negative controls behaved |
| **positive_control** | UNKNOWN |
| **freeze_point** | every threshold, candidate, measure, control and outcome rule committed before any corpus was scored |
| **derived_or_declared** | DERIVED |
| **authority_before** | the 75-game analysis, published twice |
| **authority_after** | the 117-game analysis; both earlier results printed in full, unmodified, and the 75-game run preserved in research/b2/as-published-75/ with the sha256 of its decision evidence |
| **test_reality_level** | real games, real engine (Stockfish 18 Lite WASM, depth 12, the build the product ships) |
| **promotion_rule** | nothing in the product changes as a result of this document, and section 7 said so before the answer was known |
| **decision** | Publish the correction; keep both. |
| **reversal_condition** | recorded in the preregistration |
| **failure_discovered** | the study was published twice on a corpus missing a third of its games, and the corrected corpus OVERTURNED its central conclusion |
| **lesson** | Failed history is provenance. A superseded result is kept byte-identical beside the one that replaced it, with its own hash. |
| **observed_evidence** | 117 games, 3,067 decisions scored; held-out spread 8.27pp for lichess encoding buckets against a 4.35pp random-boundary null; raw seconds 0.00pp; most of the effect collapses within phase x standing; only middlegame/winning clearly survives (n=629, 10.32pp against null95 7.38pp) |
| **external_evidence** | — |
| **what_was_not_known** | whether the observation is causal |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | research/b3_population_expertise keeping analysis_final.json beside analysis_repaired.json; docs/measurement keeping four rounds |
| **was_generalized** | True |
| **confidence** | 0.95 |
| **source_paths** | `docs/research/TIME_REPRESENTATION_PREREG.md`, `docs/research/TIME_REPRESENTATION_RESULTS.md`, `research/b2/`, `research/b2/as-published-75/` |

### `C16-engine-parity-stop` — research-b2

| field | value |
| --- | --- |
| **problem** | Every prior number came from a native engine the product does not ship. |
| **initial_assumption** | The two engines agree closely enough. |
| **falsifier** | the preregistered outcome rule: Delta > T2 fires STOP-B1 |
| **negative_control** | UNKNOWN |
| **positive_control** | UNKNOWN |
| **freeze_point** | committed at 4be38ce before the first comparison; evidence file sha256 bcfb82cc...8ce857 recorded in the prereg and verified intact |
| **derived_or_declared** | DERIVED |
| **authority_before** | research/harness/ (native engine) |
| **authority_after** | research/harness-shipped/, sha256 d70998ba..., is the canonical record now |
| **test_reality_level** | the engine the product actually ships |
| **promotion_rule** | STOP-B1: mark every affected row as measured on an instrument that is not shipped, do not re-tune anything, stop the plan there |
| **decision** | The defect was closed by RE-MEASURING, not by relabelling. |
| **reversal_condition** | in the prereg |
| **failure_discovered** | T2 = 13.0pp was the SMALLEST of six players' bars; against the mean bar (16.1) this would have passed. The number was fixed before the run and was not revisited. |
| **lesson** | The level of reality in the instrument must match the level of reality in the claim; and a threshold chosen for the average case fails for a real one. |
| **observed_evidence** | 13.61% of decisions flip verdict; the shipped engine flatters the player by 4.4 points systematically; overall accuracy 71.6% shipped vs 67.0% native; the deciding bucket: phase-opening n=66, 69.7% -> 83.3% |
| **external_evidence** | — |
| **what_was_not_known** | — |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | tests/LEVELS.md rungs; docs/MEASUREMENTS.md history section kept on purpose |
| **was_generalized** | True |
| **confidence** | 0.96 |
| **source_paths** | `docs/research/ENGINE_PARITY_PREREG.md`, `docs/research/ENGINE_PARITY_RESULTS.md`, `research/harness/`, `research/harness-shipped/` |

### `C17-blitz-computation-stop-d` — research-b2

| field | value |
| --- | --- |
| **problem** | Is there a computable construct for the value of further calculation in blitz? |
| **initial_assumption** | A deep reference exists at an affordable node budget. |
| **falsifier** | STOP-D, declared in the prereg committed at 901c463 |
| **negative_control** | UNKNOWN |
| **positive_control** | UNKNOWN |
| **freeze_point** | prereg committed before any dataset was built or any search run |
| **derived_or_declared** | DERIVED |
| **authority_before** | the planned H1/H2 |
| **authority_after** | RESEARCH ONLY; H1 and H2 were not run |
| **test_reality_level** | real engine at real budgets |
| **promotion_rule** | everything established is at rung Observation; nothing reaches Prediction or Causal, and that is the finding |
| **decision** | Stop at Gate 1. |
| **reversal_condition** | in the prereg |
| **failure_discovered** | the ground truth every downstream metric is defined against does not exist at any affordable budget |
| **lesson** | The hypotheses are not refuted; they were not testable with this instrument, and saying which is the whole value of the run. |
| **observed_evidence** | no node budget between 25,000 and 1,600,000 produces a deep reference stable to the preregistered tolerance; the instability is concentrated in exactly the positions a coaching product cares about; choosing between two defensible references changes the outcome variable itself |
| **external_evidence** | — |
| **what_was_not_known** | — |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | D25's not-DOMAIN-MODEL-FAILED / not-MOVE-ONLY-SUFFICIENT distinctions; docs/research/BLITZ 'rung' table |
| **was_generalized** | True |
| **confidence** | 0.95 |
| **source_paths** | `docs/research/BLITZ_COMPUTATION_PREREG.md`, `docs/research/BLITZ_COMPUTATION_RESULTS.md`, `scripts/run_deep_reference_saturation.ts` |

### `C18-account-bridge-prediction-failed` — research-b2

| field | value |
| --- | --- |
| **problem** | Can the import-to-live-loop bridge register a hypothesis on a real account? |
| **initial_assumption** | At 2,209 games the separation holds at 1.1583 and the outcome is `registered`. |
| **falsifier** | three refuters declared in advance; two fired |
| **negative_control** | run B in a second process and run C with the games reversed matched run A field for field, per decision |
| **positive_control** | UNKNOWN |
| **freeze_point** | each expansion gets its own registration and its own number written down first; the 1,240 run was the ONE expansion section 8 permitted, and the 2,209 window needed a new registration |
| **derived_or_declared** | DERIVED |
| **authority_before** | the 1,240 result |
| **authority_after** | the full-account result; both kept |
| **test_reality_level** | a real account's real games |
| **promotion_rule** | a registration permits exactly one expansion to a size its own reading computes |
| **decision** | Report the refutation. |
| **reversal_condition** | in the preregs |
| **failure_discovered** | the arithmetic was right and the assumption was wrong, and they came apart cleanly enough to say which was which. Finding out why exposed a mislabelled record. |
| **lesson** | Write the prediction down before the run so a confirmation cannot later be presented as a prediction that was not made, and a disagreement cannot be quietly absorbed. |
| **observed_evidence** | 48 games: not-separable, separation 1.37 against a bar of 6.98; 1,240 games: registered, prediction held to 0.0133pp; 2,209 games: bar predicted 0.8579 observed 0.8632; separation predicted 1.1583 observed 0.6218; margin +0.3004 predicted, -0.2413 observed |
| **external_evidence** | — |
| **what_was_not_known** | whether the bucket rates hold over 969 games played EARLIER |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | research/b3_population_expertise/results/FINAL_HOLDOUT_SEALED.json expectation_recorded_before_opening |
| **was_generalized** | True |
| **confidence** | 0.96 |
| **source_paths** | `docs/research/ACCOUNT_BRIDGE_PREREG.md`, `docs/research/ACCOUNT_BRIDGE_RESULTS.md`, `docs/research/ACCOUNT_BRIDGE_FULL_PREREG.md`, `docs/research/ACCOUNT_BRIDGE_FULL_RESULTS.md`, `shared/prereg.ts` |

### `C19-b3-four-gates` — research-b3

| field | value |
| --- | --- |
| **problem** | Across a population of ordinary blitz players, does expertise show up as better management of the difficulty/time/value-of-computation relation? |
| **initial_assumption** | The design as first drafted was sound. |
| **falsifier** | VERDICT_RULES.md as a program, run before any narrative exists, with an absolute effect-size floor fixed before any estimate did |
| **negative_control** | eighteen controls with pass conditions; five 'failed' on VALIDATION and the controls were wrong, not the result (F9); C3 carried a deterministic term from the freeze (F10) |
| **positive_control** | the B2 reproduction gate -- evidenceSha256 identical, analysis.json byte-identical, all four controls reproduce |
| **freeze_point** | five documents hashed at 8141c5b; amendments at e70a0de; the FINAL holdout sealed at da15833 with the expected verdict recorded BEFORE a byte of 2026-06 was read |
| **derived_or_declared** | DERIVED -- src/run.py refuses to read data/final/ until FINAL_HOLDOUT_SEALED.json exists |
| **authority_before** | B2, one account |
| **authority_after** | REPORT.md, at GENERAL_REGULARITY_ONLY level 3, with both verdicts kept |
| **test_reality_level** | public Lichess dumps, deterministic Stockfish 17.1 avx2 with its binary sha256 recorded |
| **promotion_rule** | the verdict is a mechanical function of numbers fixed in advance; the report has a forbidden-phrase check that refuses to write |
| **decision** | Publish at the level the rules assign, with every Gate 4 weakening applied. |
| **reversal_condition** | recorded per hypothesis in the preregistration |
| **failure_discovered** | twelve recorded failures (F1-F12), several of which would not have failed loudly -- F1's tokenizer would have shifted every ply index silently; F2 excluded 10.7% of sides non-randomly; F8 deleted a control along with stale duplicates beside it |
| **lesson** | Build the adversary into the schedule at fixed gates, apply its required changes before scoring, and re-review the repairs -- because repairs introduce defects. |
| **observed_evidence** | Gate 1 PASS_WITH_REQUIRED_CHANGES x3 -- 13 changes, then 9 (N1-N9), then 5 (M1-M5); M4: the condition-6 estimator returned exactly zero on six of six simulated runs with the design's own planted gradient; beta = +0.01342 [+0.01243,+0.01431], reproduced out of sample in both later periods; Metric B null by five readings; mechanical verdict INVALID_EXPERIMENT on one control (C3), repaired to GENERAL_REGULARITY_ONLY |
| **external_evidence** | Frisch-Waugh-Lovell; DerSimonian-Laird; player-level block bootstrap |
| **what_was_not_known** | whether the C3 null was the estimator or the result |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | — |
| **was_generalized** | False |
| **confidence** | 0.96 |
| **source_paths** | `research/b3_population_expertise/`, `research/b3_population_expertise/reviews/`, `research/b3_population_expertise/MODEL_LEDGER.md`, `research/b3_population_expertise/results/PREREGISTRATION_FREEZE.json`, `research/b3_population_expertise/results/FINAL_HOLDOUT_SEALED.json` |

### `C20-b3-gate4-claim-audit` — research-b3

| field | value |
| --- | --- |
| **problem** | The report's front matter printed VERDICT_RULES.md section 3.1's definition of EXPERTISE_ADAPTATION_SUPPORTED as the meaning of GENERAL_REGULARITY_ONLY. |
| **initial_assumption** | The report as generated was accurate. |
| **falsifier** | an independent adversary auditing every claim against the evidence in the repository |
| **negative_control** | UNKNOWN |
| **positive_control** | the forbidden-phrase list, which now includes the section 3.1 sentence, and a generator that refuses to write |
| **freeze_point** | the report audited at commit 9349c00 by sha256 |
| **derived_or_declared** | DERIVED -- the forbidden list is enforced by the generator |
| **authority_before** | the generated report |
| **authority_after** | the audited report |
| **test_reality_level** | text against artifacts |
| **promotion_rule** | the adversary may weaken and may not strengthen |
| **decision** | Apply all fifteen. |
| **reversal_condition** | UNKNOWN |
| **failure_discovered** | the H2 proposition the study did NOT support was printed as the meaning of its own verdict; and the A2 paragraph derived a single-factor statement as a square root rather than the amendment's exchange rate |
| **lesson** | Audit the claims, not just the numbers. A correct verdict can carry a sentence asserting the thing the verdict denies. |
| **observed_evidence** | 24 findings, 15 required, every one a weakening or a qualification; no verdict, level, threshold or estimate changed |
| **external_evidence** | — |
| **what_was_not_known** | — |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | docs/evidence-architecture/STRONGEST_PERMITTED_CLAIM.md; docs/measurement/STRONGEST_PERMITTED_CLAIM.json |
| **was_generalized** | True |
| **confidence** | 0.95 |
| **source_paths** | `research/b3_population_expertise/reviews/FABLE_GATE_4_CLAIM_AUDIT.md`, `research/b3_population_expertise/REPORT.md`, `research/b3_population_expertise/src/write_report.py` |

### `C21-n-of-1-timing-prereg` — research-b3

| field | value |
| --- | --- |
| **problem** | Can B2's historical timing observation be converted into a causal, actionable playing rule for the same player? |
| **initial_assumption** | The 8.27pp historical spread is a treatment effect. |
| **falsifier** | the pilot decision rule: if the manipulation gate passes and Delta <= 0, the causal interpretation is weakened and the 8-second boundary may NOT be moved after seeing the result |
| **negative_control** | the control arm, pair-randomised so the player is their own control |
| **positive_control** | the manipulation check -- P(secondsTaken>=8 \| T) <= 0.70 * P(...\|C); failure classifies the pilot MANIPULATION FAILED |
| **freeze_point** | FROZEN BEFORE THE FIRST PROSPECTIVE GAME; the 60-game assignment sequence is published in full, seed 20260901 |
| **derived_or_declared** | DECLARED_AND_VERIFIED (the sequence is published so it can be checked) |
| **authority_before** | the B2 observational result |
| **authority_after** | not yet -- no data |
| **test_reality_level** | prospective, a real person playing real rated games |
| **promotion_rule** | explicitly a pilot; no result may be described as a universal law or as evidence it generalises |
| **decision** | Preregister and freeze; the branch carries only the preregistration. |
| **reversal_condition** | the pilot decision rule, three branches, all written down |
| **failure_discovered** | UNKNOWN -- nothing has run |
| **lesson** | The highest rung of reality this repository has ever aimed at is written down and frozen before it is reached; and a failed manipulation remains part of the evidence record. |
| **observed_evidence** | none yet -- no prospective game is recorded in the repository |
| **external_evidence** | — |
| **what_was_not_known** | everything the pilot exists to find out |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | — |
| **was_generalized** | False |
| **confidence** | 0.9 |
| **source_paths** | `research/b3/N_OF_1_TIMING_PREREG.md (branch experiment/n-of-1-timing-policy only)` |

### `C22-master-debt-register` — governance

| field | value |
| --- | --- |
| **problem** | 'What is still open?' had four possible answers in this repository and no two of them agreed. |
| **initial_assumption** | The gate is a check that fails when a second tracker appears or when a row vanishes. |
| **falsifier** | the scan going red on the real tree |
| **negative_control** | UNKNOWN |
| **positive_control** | tests/fixtures/registers -- the four documents reduced to the drifts they actually had; every predicate runs over both roots |
| **freeze_point** | the state vocabulary is CLOSED (open, blocked, refuted, fixed, half fixed, measured and deferred) |
| **derived_or_declared** | DERIVED -- declaredGates() reads run_gates.ts, the one authority on what is enforced |
| **authority_before** | four documents |
| **authority_after** | one register for 'what is open'; each of the other four keeps a named, different question |
| **test_reality_level** | L2 over the real tree, run on every npm run verify |
| **promotion_rule** | basis: verified (read in the tree with a citation) vs asserted (believed, not yet checked) |
| **decision** | One register, and a gate that checks that what a row SAYS is still true of the tree. |
| **reversal_condition** | UNKNOWN |
| **failure_discovered** | the gate the row FIRST described guarded against deletion, and neither of the two ways the register actually failed was a deletion |
| **lesson** | One authority per question, not one source of truth for everything -- and a register rots while sitting still, so the check has to be about the world, not about the register. |
| **observed_evidence** | a P0 was found, fixed, written up in the laws, and never given a row at all; INERTIAL_UX_LAWS named GATE-NO-DUPLICATE-ACTION as a Gate; no such gate was registered; R-13 cited 55 useState under a ceiling an extraction had already taken to 53; decisions/README filed D04 under 'not yet opened' with its trigger reading 'now' |
| **external_evidence** | — |
| **what_was_not_known** | — |
| **supersedes** | PRODUCTION_READINESS_LEDGER as a status list; ACTION_PLAN as a status list; docs/blitz/AUDIT.md as a status list; docs/decisions/ as a status list |
| **superseded_by** | — |
| **generalized_to** | shared/evidence-policy.ts one table one authority; shared/evidence-authority.ts one vocabulary; shared/promise.ts one promise; shared/reveal.ts theOneThing never re-derived |
| **was_generalized** | True |
| **confidence** | 0.97 |
| **source_paths** | `docs/MASTER_PRODUCT_DEBT.md`, `scripts/register-scan.ts`, `tests/fixtures/registers/` |

### `C23-gate-positive-controls` — testing

| field | value |
| --- | --- |
| **problem** | A check that has never failed has not been shown to be a check. |
| **initial_assumption** | A green gate is evidence. |
| **falsifier** | a control that does not go red exits non-zero |
| **negative_control** | the real tree -- the gate must be green on it |
| **positive_control** | the deliberately-broken fixture -- the SAME predicate over DIFFERENT input; a control with its own weaker predicate proves nothing |
| **freeze_point** | the gate id is the identity; register-scan checks that every gate a law names exists |
| **derived_or_declared** | DERIVED |
| **authority_before** | tests |
| **authority_after** | gates, which assert that no screen has BECOME wrong rather than that one is right today |
| **test_reality_level** | L1-L5 depending on the gate; several delegate to Vitest for the transform pipeline |
| **promotion_rule** | a gate is registered only with a control that reddens |
| **decision** | Two modes, both in CI, both blocking. |
| **reversal_condition** | UNKNOWN |
| **failure_discovered** | the first two inertial gates shipped as ONE gate over ONE file, so a single control red for either defect would have left one gate passing its control for the other defect's reason. A control red for the wrong reason proves nothing. |
| **lesson** | A gate that has not demonstrated failure is not a gate -- and it must fail for its own reason. |
| **observed_evidence** | 28 gates PASS on the real tree and 28 controls FAIL on the fixtures, verified by running both in this session; NOT-MEASURED is a third status, distinct from PASS and never silently counted as success; runVitestFile treats a name filter that matches nothing as a HARNESS ERROR |
| **external_evidence** | mutation testing, in spirit -- not named in the repository |
| **what_was_not_known** | — |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | research/b3_population_expertise 18 controls; research/discovery-oracle shuffled-label controls; scripts/notice_coverage.ts written as a pure predicate so the control can be fed a described tree |
| **was_generalized** | True |
| **confidence** | 1.0 |
| **source_paths** | `scripts/run_gates.ts`, `tests/fixtures/`, `.github/workflows/verify-build.yml` |

### `C24-test-level-ladder` — testing

| field | value |
| --- | --- |
| **problem** | 246 test files, and one wave shipped five defects every one of them was green through. Not one of the five was a wrong test. |
| **initial_assumption** | More tests, or higher-level tests, is the fix. |
| **falsifier** | GATE-CLAIM-ANCHOR: a debt row may not claim more reality than its proof ever ran against |
| **negative_control** | UNKNOWN |
| **positive_control** | the gate's control fixture; and each of the four P0 rows fails for its OWN reason -- nulling the opponent reddens only R-04, blanking the engine build only R-03 |
| **freeze_point** | the P0->L4, P1->L2 floor |
| **derived_or_declared** | DERIVED -- the scan reads what a file imports and what environment it asks for; an @level override REQUIRES a reason and the scan refuses one without it |
| **authority_before** | a comment declaring a level |
| **authority_after** | the scanner |
| **test_reality_level** | the scan is itself L1 over the tree |
| **promotion_rule** | a severity implies a floor; the count started at 7 and is 0 |
| **decision** | Derive the level; ratchet the anchor count down to zero, then make it a bar. |
| **reversal_condition** | UNKNOWN |
| **failure_discovered** | the derivation MISSED all eleven browser tests on its first run, because tests/layout/browser.ts owns the launch and no test file names playwright. Written down rather than quietly fixed. And two rows were scored as no-evidence because the resolver could only read *.test.ts filenames -- a measurement that cannot see a working check reports a gap that is not there. |
| **lesson** | The level of reality in the test must match the level of reality in the claim -- and a derivation that cannot see the repository's own idiom reports a comfortable number instead of a true one. |
| **observed_evidence** | L1 81, L2 84, L3 77, L4 5, L5 17, L6 0 -- 22 of 264 (8.3%) run against something the product actually meets, re-derived by running the scan in this session; defect 5 needed no higher rung at all: it needed L3 to ask about the whole button instead of its textContent |
| **external_evidence** | the test pyramid, implicitly rejected as a prescription |
| **what_was_not_known** | nothing L6 could be read against -- L6 is zero |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | docs/MASTER_PRODUCT_DEBT rung column; the CI workflow's real MySQL and real Chromium; docs/measurement/ECOLOGICAL_EXTRAPOLATION_GAP.md L0-L5 |
| **was_generalized** | True |
| **confidence** | 0.98 |
| **source_paths** | `tests/LEVELS.md`, `scripts/test-level-scan.ts`, `tests/layout/what-the-record-holds-after-a-game.layout.test.ts` |

### `C25-bundle-budget-ratchet` — testing

| field | value |
| --- | --- |
| **problem** | Vite has warned 'some chunks are larger than 500 kB' on every build for a long time, which is what a warning nobody can fail becomes. |
| **initial_assumption** | A warning is enough. |
| **falsifier** | the build exceeding the ceiling |
| **negative_control** | UNKNOWN |
| **positive_control** | UNKNOWN -- the budget has no deliberately-oversized fixture |
| **freeze_point** | the ceiling is a ratchet, not a target |
| **derived_or_declared** | DECLARED_AND_VERIFIED -- the ceiling is a written constant, checked against a measured build |
| **authority_before** | a warning |
| **authority_after** | a failing step in CI |
| **test_reality_level** | L5-adjacent: it measures the build's actual output |
| **promotion_rule** | growth past the line is a decision somebody makes on purpose, in a diff |
| **decision** | Ratchet with headroom just above the current build. |
| **reversal_condition** | UNKNOWN |
| **failure_discovered** | R-13's useState ceiling had quietly handed back headroom a refactor had paid for -- the same ratchet shape, unreconciled, caught by register-scan |
| **lesson** | A budget with generous headroom is a budget that never fires; and a ratchet must be re-tightened when the thing it measures improves. |
| **observed_evidence** | the engine is 7.3 MB of WebAssembly; GATE-COMMIT proves it is absent from the initial graph; the ceilings sit just above what the build currently produces |
| **external_evidence** | — |
| **what_was_not_known** | — |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | tests/client/the-file-that-only-ever-grew.test.ts; GATE-CLAIM-ANCHOR, which began as a ratchet and became a bar |
| **was_generalized** | True |
| **confidence** | 0.9 |
| **source_paths** | `scripts/check_bundle_budget.ts`, `.github/workflows/verify-build.yml` |

### `C26-ci-real-dependencies` — deployment

| field | value |
| --- | --- |
| **problem** | A suite that passes because it did not run is the exact failure this repository is about. |
| **initial_assumption** | Skipping a test when its dependency is absent is acceptable. |
| **falsifier** | the job going red |
| **negative_control** | MySQL 8 in CI against MariaDB 10.11 locally -- the two together say the store depends on neither |
| **positive_control** | tests/layout/browser.ts THROWS when no Chromium is present rather than skipping |
| **freeze_point** | npm ci, not npm install -- CI must test the tree the lock file names |
| **derived_or_declared** | DERIVED -- the schema is built from the generated migration SQL, every migration in order, not from a hand-written file |
| **authority_before** | green local runs |
| **authority_after** | a job with a real database, a real browser, and the built assets |
| **test_reality_level** | L4/L5 in CI; L6 still zero |
| **promotion_rule** | the build step runs BEFORE the tests, because the CSP test cannot measure a build that does not exist |
| **decision** | Real dependencies, loud failures, and an apt half that is allowed to fail while the browser is installed either way. |
| **reversal_condition** | UNKNOWN |
| **failure_discovered** | a 403 from Microsoft's package mirror took `verify` down before a single test ran, on a diff touching no CI, no browser and no system package |
| **lesson** | Refuse rather than skip; and isolate the parts of a check that are not about this repository. |
| **observed_evidence** | drizzle-store.test.ts skipped when DATABASE_URL was unset, which was every run anywhere -- DrizzleRecordStore had never executed a statement; jsdom reports every box as 0x0, which is how a bucket label shipped collapsed to one glyph per line and a signed gap shipped with its minus on the wrong side |
| **external_evidence** | — |
| **what_was_not_known** | — |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | GATE runner's NOT-MEASURED status; run.py require_seal() |
| **was_generalized** | True |
| **confidence** | 0.97 |
| **source_paths** | `.github/workflows/verify-build.yml`, `tests/layout/browser.ts`, `tests/server/drizzle-store.test.ts` |

### `C27-record-vs-private-copy` — product-engineering

| field | value |
| --- | --- |
| **problem** | performance.now() returns a double, thinkMs was the difference of two readings, and the stored schema requires an integer. No blitz game had ever been persisted in a browser, on any build, since the route existed. |
| **initial_assumption** | R-02's ordering fix meant the record survived a closed tab. |
| **falsifier** | reading every stored thinkMs back out of localStorage after a game played by a real clock |
| **negative_control** | UNKNOWN |
| **positive_control** | restoring the unrounded subtraction turns all four cases red, because nothing is stored at all; and eight property cases drawing FRACTIONAL readings at the level below |
| **freeze_point** | rounding at the SOURCE, so the value the game state holds is the value that is written |
| **derived_or_declared** | DERIVED |
| **authority_before** | the screen's in-memory copy |
| **authority_after** | the record |
| **test_reality_level** | L5 -- a real browser and a real clock |
| **promotion_rule** | P0 implies an L4 floor |
| **decision** | One module where two clock readings become a stored duration; round rather than floor, because flooring biases every observation down by half a millisecond. |
| **reversal_condition** | UNKNOWN |
| **failure_discovered** | R-02 says the game is written before the engine runs, and it is -- but the write it protects was failing for an unrelated reason the whole time, so 'the record survives a closed tab' was true of an ORDERING and false of the product |
| **lesson** | A screen must read the record, not trust its private copy; and a correct fix can sit on top of a broken foundation and look verified. |
| **observed_evidence** | localStorage held no blitz record after a completed game on main, while the screen said the game itself was saved; three green layers, each for a different reason: hand-built integer fixtures; jsdom mocking performance.now() to whole ms; a browser audit asserting a CARD the screen drew from its own in-memory copy |
| **external_evidence** | — |
| **what_was_not_known** | — |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | LAW 3; the four P0 rows sharing one L5 file that reads the record rather than the screen |
| **was_generalized** | True |
| **confidence** | 0.98 |
| **source_paths** | `docs/MASTER_PRODUCT_DEBT.md R-19`, `docs/INERTIAL_UX_LAWS.md LAW 3`, `shared/measured-duration.ts`, `tests/layout/what-the-record-holds-after-a-game.layout.test.ts` |

### `C28-availability-was-never-measured` — product-engineering

| field | value |
| --- | --- |
| **problem** | isAvailable() returned true in 4ms against a closed port, because drizzle(url) builds a pool and a pool does not connect. |
| **initial_assumption** | Boolean(await getDb()) tests whether the database is up. |
| **falsifier** | point DATABASE_URL at a closed port |
| **negative_control** | absent is not down -- 200 when no database is configured, 503 for a configured one that cannot be reached |
| **positive_control** | getTimerCount as the observable; the deadline driven by a promise that never settles |
| **freeze_point** | UNKNOWN |
| **derived_or_declared** | DERIVED -- select 1 under a 3s deadline replaces a declaration |
| **authority_before** | an environment variable being set |
| **authority_after** | a query that runs |
| **test_reality_level** | L4, then verified on the deployed preview |
| **promotion_rule** | verified on the deployed preview, not inferred from a green build |
| **decision** | Measure the thing the name claims; and make the fallback directional. |
| **reversal_condition** | UNKNOWN |
| **failure_discovered** | TWO controls survived their first form, both the same shape -- an assertion satisfied by the fixture rather than the code. The bound was timed against a dead address that refuses in 25ms, so a ten-minute deadline passed. And cycle 13's own fix introduced cycle 15's defect: once isAvailable could flip mid-session, a flaky network could silently move a player from the server record to a smaller local one. |
| **lesson** | A check named for a property must measure that property; and a repair introduces a new failure surface that must be looked for in its own diff. |
| **observed_evidence** | reproduced before a line was written; record.storageAvailable believed it, so the client abandoned a working browser-local record and every commit failed; /api/health answered {ok:true} unconditionally -- what it measured was that a line of code ran |
| **external_evidence** | — |
| **what_was_not_known** | — |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | GATE-NO-FAKE; GATE-MEASURE; the CI job's refusal to skip |
| **was_generalized** | True |
| **confidence** | 0.96 |
| **source_paths** | `docs/PRODUCTION_READINESS_LEDGER.md Cycle 13`, `docs/PRODUCTION_READINESS_LEDGER.md Cycle 14`, `docs/PRODUCTION_READINESS_LEDGER.md Cycle 15` |

### `C29-derived-grade-vs-stored-grade` — product-engineering

| field | value |
| --- | --- |
| **problem** | A learning rule's grade was stored and served from storage, so a lost write let the product preregister a new transfer on a rule the record had already refuted. |
| **initial_assumption** | The fold repairs the write path, so reads are fine. |
| **falsifier** | the invariant tests, which went red once the grade was derived and a hand-set grade was rebuilt |
| **negative_control** | writing a retired rule back AS retired stays allowed, so refusing does not fail every completion on a rule archived mid-run |
| **positive_control** | four -- removing the store guard reddens the retirement claim; reading the stored grade in beginLearningTransfer reddens BOTH invariant tests; writing unconditionally reddens the no-extra-write claim |
| **freeze_point** | retirement is an act of the player's and is never re-derived |
| **derived_or_declared** | DERIVED, with exactly one declared exception (retired), guarded in the STORE rather than the service because a service check is another read-then-write and loses the same race |
| **authority_before** | the stored grade |
| **authority_after** | gradeFromRecord, derived before anything is decided; idempotent, and it writes only when the fold actually repairs something |
| **test_reality_level** | L4 across all three stores |
| **promotion_rule** | UNKNOWN |
| **decision** | Derive the grade; keep the one un-derivable act declared and guarded at the lowest layer. |
| **reversal_condition** | UNKNOWN |
| **failure_discovered** | TWO FIXTURES WERE CONSTRUCTING STATES THE PRODUCT CANNOT PRODUCE. Once the grade is derived, a hand-set one is rebuilt, so the tests went red correctly. That was the fifth and sixth time in one PR a test needed changing, and each time the principle survived and only its expression did not. Still open and stated plainly: the queue's DISPLAY still prints the stored grade. |
| **lesson** | Derive, don't declare -- and where a state genuinely cannot be derived, say so, guard it at the layer that owns the race, and never re-derive it. |
| **observed_evidence** | beginLearningTransfer read `hypothesis` and preregistered a new transfer while the record held two failing results on two days; the throw that should have stopped it was bypassed because it was handed the stale rule |
| **external_evidence** | — |
| **what_was_not_known** | — |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | scripts/test-level-scan.ts; scripts/register-scan.ts; shared/discovery/claim-class.ts; D09 freeze re-deriving the protocol |
| **was_generalized** | True |
| **confidence** | 0.96 |
| **source_paths** | `docs/PRODUCTION_READINESS_LEDGER.md Cycle 31`, `docs/PRODUCTION_READINESS_LEDGER.md Cycle 39`, `shared/record-service.ts` |

### `C30-experimental-arm-lost-on-reload` — product-engineering

| field | value |
| --- | --- |
| **problem** | writePosition stored the moves, ply, source, orientation, opponent and game id, and not the experimental arm. A reload put the player in the useState default. |
| **initial_assumption** | revealTiming is a preference. |
| **falsifier** | the round-trip test |
| **negative_control** | UNKNOWN |
| **positive_control** | four -- not requiring the arm in parse reddens both refusals; not writing it reddens the round trip; dropping either half of the board wiring reddens the arm's wiring test |
| **freeze_point** | a position that cannot say which arm it was in is no longer restored; the game is forgotten rather than continued in the wrong condition |
| **derived_or_declared** | DECLARED_AND_VERIFIED -- the arm travels with the handoff explicitly rather than falling to the board's default |
| **authority_before** | React component state |
| **authority_after** | the stored position, or nothing |
| **test_reality_level** | L2/L3 |
| **promotion_rule** | UNKNOWN |
| **decision** | Make the field required. The type system found every writer -- four call sites in one compile. |
| **reversal_condition** | UNKNOWN |
| **failure_discovered** | A CONTROL CAME BACK GREEN, AND THAT WAS THE FINDING. Deleting setRevealTiming(saved.revealTiming) from the restore broke nothing: the arm was stored and parsed and quietly not applied, and every test still passed. |
| **lesson** | A passing positive control is a finding about the test, not a comfort about the code; and forgetting a board is better than continuing it in the wrong condition. |
| **observed_evidence** | one game whose first fifteen decisions say end-of-game and whose rest say per-decision, every row internally consistent, nothing saying the condition changed |
| **external_evidence** | — |
| **what_was_not_known** | — |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | Cycle 42's 'a positive control came back green again, and again it was the finding'; the gate runner's two-mode contract |
| **was_generalized** | True |
| **confidence** | 0.97 |
| **source_paths** | `docs/PRODUCTION_READINESS_LEDGER.md Cycle 40`, `shared/reveal-timing.ts` |

### `C31-cross-user-leak-and-the-cache-that-outlived-it` — product-engineering

| field | value |
| --- | --- |
| **problem** | A second signed-in account could read and write the owner's record. |
| **initial_assumption** | protectedProcedure is enough. |
| **falsifier** | the reproduction |
| **negative_control** | UNKNOWN |
| **positive_control** | tests/server/record-isolation.test.ts -- 4 assertions, 4 positive controls red |
| **freeze_point** | UNKNOWN |
| **derived_or_declared** | DERIVED (ownerProcedure) |
| **authority_before** | somebody is signed in |
| **authority_after** | the owner is signed in |
| **test_reality_level** | L4 over real HTTP |
| **promotion_rule** | UNKNOWN |
| **decision** | ownerProcedure on the record router; the residual stated plainly -- the product is not multi-user and this does not make it one. |
| **reversal_condition** | UNKNOWN |
| **failure_discovered** | the SERVER fix said nothing about the browser: every record.* response sits in the react-query cache keyed by procedure and input, never by who was signed in, and react-query serves stale cache while revalidating. A signs in, reads, signs out; B signs in and sees A's record with NO request to the server involved. Cleared on IDENTITY CHANGE, not on the logout mutation, because a session can expire. |
| **lesson** | A fix at one boundary is evidence about that boundary only; find the same defect one layer out before calling it closed. |
| **observed_evidence** | HTTP 200 carrying the owner's private text to an account that never wrote it; record.count returned 2; no record table carries a user_id, so no query could have scoped even if one had tried |
| **external_evidence** | — |
| **what_was_not_known** | — |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | Cycle 5's 'this is R3 one layer out'; Cycle 17's 'the same defect in the neighbouring cell, twice over'; Cycle 37's sweep, run because the last two were found by accident |
| **was_generalized** | True |
| **confidence** | 0.95 |
| **source_paths** | `docs/PRODUCTION_READINESS_LEDGER.md Cycle 1`, `docs/PRODUCTION_READINESS_LEDGER.md Cycle 8`, `server/_core/owner.ts` |

### `C32-inertial-laws-and-their-gates` — product-ux

| field | value |
| --- | --- |
| **problem** | The visual architecture was the code architecture, so a player had to know the repository map to get anywhere. |
| **initial_assumption** | These are new opinions being imported. |
| **falsifier** | a walk through the built app in Chromium |
| **negative_control** | UNKNOWN |
| **positive_control** | each gate's control is the defect the product actually shipped -- a front door offering two products, a reveal offering one act twice, a mapping answering nothing-scored with 'play another game' |
| **freeze_point** | LAW 0 (the scheduling rule): we do not change what the player does and what we measure at the same time |
| **derived_or_declared** | DERIVED -- shared/primary-action.ts makes a control DECLARE its act, so the question is how many different things a state asks the player to choose between, not how many loud buttons it has |
| **authority_before** | CSS weight |
| **authority_after** | data-primary-action, a named act from a closed vocabulary |
| **test_reality_level** | L1 scanners over source, plus an L5 walk that found both live defects |
| **promotion_rule** | a gate rather than a test, because the rule is violated by ADDING something, anywhere, at any time |
| **decision** | Twelve laws, eight registered as gates, one deliberately absent with its reason. |
| **reversal_condition** | per law |
| **failure_discovered** | a gate that reads a colour goes red when a palette changes and stays green when a second loud button arrives in a different one -- the signal had to become semantic before the gate could exist |
| **lesson** | A test asserts a screen is right today; a gate asserts no screen has become wrong. And a law already applied once locally is not a new opinion -- it is an unfinished generalisation. |
| **observed_evidence** | three of the twelve laws were already implemented for ONE case each, correctly, with the reasoning written out, and never generalised; the reveal offered CONTINUATION_CTA twice, under render conditions character-for-character identical; the returning front door offered two products at one weight |
| **external_evidence** | — |
| **what_was_not_known** | whether absolute quantity of interface matters -- FIELD-REQUIRED |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | scripts/said-once-scan.ts; scripts/two-hands-scan.ts; GATE-REGISTER-RECONCILED checking that every gate a law names exists |
| **was_generalized** | True |
| **confidence** | 0.97 |
| **source_paths** | `docs/INERTIAL_UX_LAWS.md`, `scripts/inertia-scan.ts`, `shared/primary-action.ts` |

### `C33-design-council-repo-first` — design

| field | value |
| --- | --- |
| **problem** | A visual language proposed for Decision Lab before Decision Lab has been read is a visual language proposed for something else. |
| **initial_assumption** | The brief's thesis, and its claim that the evidence boundary is the product's deepest VISUAL identity. |
| **falsifier** | four falsification attempts against the thesis, each checked against the tree rather than the brief |
| **negative_control** | the blind critique -- ten rendered screenshots and nothing else; not the contract, not the constitution, not the stylesheet |
| **positive_control** | GATE-TWO-HANDS runs in BOTH directions and its control reddens twice, because a one-directional check can be satisfied by deleting the colour |
| **freeze_point** | BASE_SHA b9a228c, measured in Chromium before anything changed |
| **derived_or_declared** | DERIVED -- every row is a repository finding in a fixed six-field shape whose last line is what it does NOT establish |
| **authority_before** | designer taste |
| **authority_after** | a twelve-level authority order with taste last and named as taste wherever it decided anything |
| **test_reality_level** | L5 -- element rects read in Chromium on the production build at four viewports |
| **promotion_rule** | art direction may make the structure visible; it may not claim the visibility worked |
| **decision** | Read the repository first, then the external sources, and record what each source's advice was rejected for. |
| **reversal_condition** | the owner outranks every agent for identity preference; a player outranks everyone including the owner for questions about use |
| **failure_discovered** | the direction that was FROZEN is not the direction that was proposed: four pre-implementation blockers, including that the signature was FALSE at the machine's largest object and that the proposed falsification was one-directional. And the pass screenshotted a direction defect (the writing surface at the end of an RTL reading line) and did not see it -- caught by the owner. |
| **lesson** | Reconstruct the product's own contracts before importing a framework, and let the external sources be adversaries and gap-detectors rather than templates. |
| **observed_evidence** | the thesis is enforced three independent ways -- engineMayRun false in all three producingEvidence modes, a type making a commitment event carrying an evaluation unbuildable, and a dynamic import keeping the engine out of the initial graph; an ablation test: strip candidatesConsidered and confidence and every `process` branch stops firing while every `engine` branch is unchanged; one hue carried NINE jobs, two of which are the two sides of the distinction the product exists to make |
| **external_evidence** | six external repositories, each resolved by git ls-remote, cloned shallow outside the project, read and discarded, with the SHA that was actually read recorded |
| **what_was_not_known** | whether making the structure perceptible changes what a player understands -- FIELD-REQUIRED |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | this mission's own instruction to reconstruct before comparing |
| **was_generalized** | True |
| **confidence** | 0.95 |
| **source_paths** | `docs/design-council/00-REPO-NATIVE-CONSTITUTION.md`, `docs/design-council/SOURCES.md`, `docs/design-council/04-ADVERSARIAL-REVIEW.md` |

### `C34-value-clarity-lenses` — product-ux

| field | value |
| --- | --- |
| **problem** | Can a cold chess player understand what this does, why it differs, how their actions produce the difference, what they received, and why another decision helps? |
| **initial_assumption** | Copy that reads well is the finish line. |
| **falsifier** | per-lens pass criteria, split into a repo half and a field half with numeric bars (Arm A >= 8/10) |
| **negative_control** | Arm B asks what the player got that was not already in the game and an engine analysis, with no options and no branch named |
| **positive_control** | semantic-continuity test across share metadata -> front door -> first-decision explanation |
| **freeze_point** | the constitution is frozen before the trial |
| **derived_or_declared** | DERIVED for the repo half; DECLARED_UNVERIFIED for the field half, and labelled |
| **authority_before** | whoever wrote the copy last |
| **authority_after** | shared/promise.ts, imported by the front door and the card builder; the two static copies held by a test |
| **test_reality_level** | L3 for ordering and vocabulary; the field half is unrun |
| **promotion_rule** | a lens is finished when every remaining uncertainty is FIELD REQUIRED, a VALUE QUESTION, a LATER CAPABILITY, or REJECTED -- never when the copy reads well |
| **decision** | Separate product clarity from product value and give them different authorities. |
| **reversal_condition** | per lens |
| **failure_discovered** | the share card and the front door disagreed for the length of one edit, so a player arriving through the card would have been promised one product and handed another -- and a trial cannot measure a drift it is itself producing |
| **lesson** | A product that is fully understood and still unwanted is a valid result, and copy may never be tuned to avoid it. |
| **observed_evidence** | five lenses, each with a failure condition, an allowed intervention, a forbidden list, repo-solvable evidence and field-required evidence |
| **external_evidence** | — |
| **what_was_not_known** | everything under FIELD REQUIRED |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | docs/ACQUISITION_EVIDENCE.md's rule that an event records what happened and never the conclusion; the design constitution's inheritance of the same constraints |
| **was_generalized** | True |
| **confidence** | 0.94 |
| **source_paths** | `docs/VALUE_CLARITY.md`, `docs/VALUE_CLARITY_FIELD_PROTOCOL.md` |

### `C35-acquisition-ledger` — product-measurement

| field | value |
| --- | --- |
| **problem** | Eight possible trial outcomes must be distinguishable; collapse any two observations and two outcomes become the same row. |
| **initial_assumption** | A field like user_understood_value records the thing we care about. |
| **falsifier** | UNKNOWN |
| **negative_control** | probe is present on unprobed decisions too, so the arm has a denominator |
| **positive_control** | UNKNOWN |
| **freeze_point** | the ledger reuses existing stores; nothing new was installed |
| **derived_or_declared** | DERIVED -- the reveal branch's source of truth is shared/reveal.ts theOneThing and is NEVER re-derived |
| **authority_before** | each surface's own idea of what happened |
| **authority_after** | one ledger, one source per fact |
| **test_reality_level** | L2/L3 |
| **promotion_rule** | an event records what happened; it never records the conclusion we hope to draw from it |
| **decision** | Record observations, not conclusions; forbid unique_value_delivered, user_understood, insight_found as fields. |
| **reversal_condition** | UNKNOWN |
| **failure_discovered** | readUsage was reused by the interface, so it is on the wrong side of the wall -- session boundaries had to come from the trial ledger instead |
| **lesson** | The analysis done in advance and stored where nobody can check it is not a shorter way of writing down an observation. |
| **observed_evidence** | seven observations, each with a named legitimate denominator and a prohibited inference; silence is a VALUE, not an absence -- omitting it would select the denominator on the outcome |
| **external_evidence** | — |
| **what_was_not_known** | — |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | docs/measurement/'s refusal to report accuracy alone; the design constitution's forbidding of success colour on a Reveal |
| **was_generalized** | True |
| **confidence** | 0.93 |
| **source_paths** | `docs/ACQUISITION_EVIDENCE.md`, `client/src/lib/acquisition-evidence.ts`, `shared/reveal.ts` |

### `C36-evidence-authority-vocabulary` — product-ux

| field | value |
| --- | --- |
| **problem** | Something true of one decision and something that survived a prospective test were rendered in the same typeface, at the same weight, inside the same card. |
| **initial_assumption** | This is a styling problem. |
| **falsifier** | UNKNOWN |
| **negative_control** | UNKNOWN |
| **positive_control** | GATE-GRADE's control renders a claim without its grade |
| **freeze_point** | five levels, and the count is the argument -- four would collapse 'this happened once' and 'this keeps happening' |
| **derived_or_declared** | DERIVED -- authorityOfClaim takes a Claim and not a ClaimGrade, because a caller holding only the grade could have got it from anywhere |
| **authority_before** | three local wordings |
| **authority_after** | one vocabulary; the mappings are TOTAL, so a screen wanting to say something without an authority has nothing to render |
| **test_reality_level** | L2/L3 |
| **promotion_rule** | mayPrescribe is true only for `tested` -- evidence that could have come back negative |
| **decision** | AUTHORITY_ORDER is named for lifecycle, not rank. `refuted` is the strongest evidence the product produces and points the other way. |
| **reversal_condition** | UNKNOWN |
| **failure_discovered** | a surface named VERIFIED was shipping ON BY DEFAULT over an underidentified construct -- the stronger claim shipping while the weaker one was written down. It is opt-in and graded H now. |
| **lesson** | Evidence authority may never exceed evidence level, and a UI that sorted by confidence would bury the one result that closes a question. |
| **observed_evidence** | three vocabularies for one question a player asks on every screen; GRADE_WORD said one thing, RecordDashboard another, the reveal a third |
| **external_evidence** | — |
| **what_was_not_known** | which visual weight is right for each grade |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | D25's visual authority ceiling; docs/evidence-architecture/STRONGEST_PERMITTED_CLAIM; GATE-EXTERNAL: promotion from a pointer is a compile error |
| **was_generalized** | True |
| **confidence** | 0.96 |
| **source_paths** | `shared/evidence-authority.ts`, `docs/design-council/00-REPO-NATIVE-CONSTITUTION.md section 8` |

### `C37-evidence-policy-one-table` — product-measurement

| field | value |
| --- | --- |
| **problem** | currentClaim called listAtoms() and handed every scoreable row to the detector, so evidence generated while trying to CHANGE the player was reused as evidence describing how the player behaves. |
| **initial_assumption** | A per-consumer condition at each call site is enough. |
| **falsifier** | deleting any single cell of the table must make a positive control fail |
| **negative_control** | the policy is deliberately conservative: on a record written before the context existed the claim search goes quiet |
| **positive_control** | a test asserting that deleting any single cell of the table reddens |
| **freeze_point** | EVIDENCE_POLICY_VERSION, carried by anything whose meaning depends on it |
| **derived_or_declared** | DERIVED -- one table, asked by the consumers |
| **authority_before** | an if at each call site, enforced by whoever remembers it |
| **authority_after** | one table, one authority, one version |
| **test_reality_level** | L2 |
| **promotion_rule** | a source does not become eligible because excluding it leaves too little data; promotion is a version bump with the argument beside it |
| **decision** | One module, not a condition per call site. |
| **reversal_condition** | a later experiment justifying a promotion |
| **failure_discovered** | the existing table asked a question about a ROW (may this consumer read this decision?) and could never have caught an incompatibility between SETS of rows |
| **lesson** | A rule enforced by whoever remembers it is not enforced; and the shape of the question decides the shape of the mechanism. |
| **observed_evidence** | there was no filter at all; reveal_timing was recorded everywhere and enforced nowhere -- STOP-C failing on the shipped product before any blitz evidence existed; protocol and reveal timing describe an incompatibility BETWEEN rows, so the axis cannot be a seventh column |
| **external_evidence** | — |
| **what_was_not_known** | — |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | shared/blitz-strata.ts; D21's StratumKey; D03's three layers |
| **was_generalized** | True |
| **confidence** | 0.95 |
| **source_paths** | `shared/evidence-policy.ts`, `docs/blitz/ADR-002-discovery-strata.md` |

### `C38-two-things-called-accuracy` — product-measurement

| field | value |
| --- | --- |
| **problem** | Two different quantities carried one name. |
| **initial_assumption** | One name, one measurement. |
| **falsifier** | UNKNOWN |
| **negative_control** | UNKNOWN |
| **positive_control** | UNKNOWN |
| **freeze_point** | the canonical record is named with its sha256 |
| **derived_or_declared** | DECLARED_AND_VERIFIED |
| **authority_before** | two quantities under one name |
| **authority_after** | one canonical, one named as history |
| **test_reality_level** | measured |
| **promotion_rule** | a re-measurement replaces a figure; the old figure stays in a section labelled history |
| **decision** | Name the canonical one and keep the other, labelled. |
| **reversal_condition** | UNKNOWN |
| **failure_discovered** | the same defect class as engine parity -- an instrument that is right about what it looks at, read as evidence about something else |
| **lesson** | One authority per question, and the loser stays readable rather than being deleted. |
| **observed_evidence** | MEASUREMENTS.md keeps a history section, marked as history and kept on purpose, whose figures were produced by a native Stockfish |
| **external_evidence** | — |
| **what_was_not_known** | — |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | research/b2/as-published-75/; docs/measurement's four rounds; docs/research/TIME_REPRESENTATION_RESULTS section 7 |
| **was_generalized** | True |
| **confidence** | 0.85 |
| **source_paths** | `docs/MEASUREMENTS.md`, `docs/MEASUREMENTS.md 'Two things were called accuracy; one of them is canonical'` |

### `C39-adr001-invariants-before-code` — product-measurement

| field | value |
| --- | --- |
| **problem** | A think_ms that quietly includes the time somebody spent answering a questionnaire cannot be corrected downstream -- the contamination is in the observation. |
| **initial_assumption** | Decide the semantics after the code exists. |
| **falsifier** | the invariants, numbered and testable |
| **negative_control** | UNKNOWN |
| **positive_control** | a test asserting the engine call count is zero |
| **freeze_point** | the ADR is written before the code exists |
| **derived_or_declared** | DERIVED |
| **authority_before** | whatever the code did |
| **authority_after** | numbered invariants INV-1..INV-10 |
| **test_reality_level** | L2/L3 |
| **promotion_rule** | a threshold can be corrected later; a contaminated observation cannot |
| **decision** | Decide the semantics before the code; refuse the tempting fix (forcing a blitz decision through commitDecision) because the instrument must not change the variable it measures. |
| **reversal_condition** | per ADR |
| **failure_discovered** | PR-13 wrote INV-10 down as code and did not check whether the product already did the thing the rule forbids. It did. |
| **lesson** | Writing a rule down is not checking it; a new rule must be run against the existing tree the day it lands. |
| **observed_evidence** | decision_ms is frozen by the same event that puts the move in the record; after that event no code path may write to it; zero analysis-engine calls before game_over, and a test asserts the call count is zero |
| **external_evidence** | — |
| **what_was_not_known** | — |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | GATE-REGISTER-RECONCILED; the register-scan phantom-gate predicate; D20's derivation from features |
| **was_generalized** | True |
| **confidence** | 0.94 |
| **source_paths** | `docs/blitz/ADR-001-blitz-measurement.md`, `docs/blitz/ADR-004-where-a-blitz-decision-lives.md` |

### `C40-decisions-trigger-table` — governance

| field | value |
| --- | --- |
| **problem** | A met trigger filed among unmet ones is how a met trigger goes unnoticed for a wave. |
| **initial_assumption** | The 'not yet opened' table can hold a row whose trigger column reads 'now'. |
| **falsifier** | register-scan over the real tree |
| **negative_control** | UNKNOWN |
| **positive_control** | tests/fixtures/registers holds the drift as the register actually carried it |
| **freeze_point** | implementation_mode is a closed set with no BUILD_BECAUSE_IT_SEEMS_RIGHT; the state vocabulary is closed |
| **derived_or_declared** | DERIVED for the gate id check; DECLARED for the state cells, with a closed vocabulary |
| **authority_before** | prose |
| **authority_after** | a table whose membership rule is enforceable: a row whose trigger has fired does not belong in it |
| **test_reality_level** | L2 over the tree |
| **promotion_rule** | there is no status: solved without a reversal condition |
| **decision** | One file per decision node; every one ends with what would reverse it. |
| **reversal_condition** | per node |
| **failure_discovered** | D06's trigger FIRED and D06 stays shut -- which is a decision rather than an oversight, and it needed a NEW trigger written down (D04's depth trade being settled) |
| **lesson** | A decision with no stated way to be wrong is a preference that has stopped being examined; and a fired trigger that leads nowhere still has to be re-triggered explicitly. |
| **observed_evidence** | D04 sat in that table with 'opens now -- M0 has passed' written in its trigger column, which is a contradiction in terms |
| **external_evidence** | — |
| **what_was_not_known** | — |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | D08 reversal condition 2 struck through and replaced; D25 reversal conditions 2 and 5 marked FIRED with outcomes |
| **was_generalized** | True |
| **confidence** | 0.96 |
| **source_paths** | `docs/decisions/README.md`, `scripts/register-scan.ts` |

### `C41-l6-is-zero` — deployment

| field | value |
| --- | --- |
| **problem** | The deployed origin is the one rung nothing in the suite runs against. |
| **initial_assumption** | A green build plus L5 is enough for a deployment claim. |
| **falsifier** | GATE-CLAIM-ANCHOR would redden if a row claimed L6 |
| **negative_control** | UNKNOWN |
| **positive_control** | tests/layout/content-security-policy.layout.test.ts serves dist/public under the EXACT policy vercel.json sends and throws rather than skipping -- the closest standing substitute |
| **freeze_point** | UNKNOWN |
| **derived_or_declared** | DERIVED -- the scan says zero and the debt rows are held to it |
| **authority_before** | a claim about the deployment |
| **authority_after** | no row currently claims more than its proof ran against |
| **test_reality_level** | L6 absent |
| **promotion_rule** | P0 -> L4 floor, P1 -> L2 floor; L6 is not required by any floor |
| **decision** | State the gap rather than close it with a hook. |
| **reversal_condition** | UNKNOWN |
| **failure_discovered** | R-09's strongest evidence -- the engine running on the actual deployment -- remains a thing that was done once and does not re-run. The gap is named and unclosed. |
| **lesson** | The one place the repository knowingly falls short of its own ladder is written down rather than rounded to 'covered'. |
| **observed_evidence** | L6 = 0 of 264 test files, re-derived by running the scan in this session; the deployment run that found the CSP/worker defect was a throwaway script and does not re-run; cycle 34's headers were confirmed ON the deployment rather than inferred |
| **external_evidence** | — |
| **what_was_not_known** | whatever the edge does to a response |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | — |
| **was_generalized** | False |
| **confidence** | 0.97 |
| **source_paths** | `tests/LEVELS.md`, `docs/MASTER_PRODUCT_DEBT.md R-09`, `docs/PRODUCTION_READINESS_LEDGER.md Cycle 19 addendum`, `docs/PRODUCTION_READINESS_LEDGER.md Cycle 34` |

### `C42-blocked-on-people` — governance

| field | value |
| --- | --- |
| **problem** | Four of nineteen plan rows require evidence from real players over time. |
| **initial_assumption** | Unfinished and blocked are the same state. |
| **falsifier** | UNKNOWN |
| **negative_control** | UNKNOWN |
| **positive_control** | UNKNOWN |
| **freeze_point** | the field protocol is written and frozen before anyone is recruited |
| **derived_or_declared** | DECLARED_AND_VERIFIED |
| **authority_before** | a single 'not done' column |
| **authority_after** | three distinct categories of not-done |
| **test_reality_level** | n/a |
| **promotion_rule** | writing something that looked like those rows would be the manufactured certainty the plan is against |
| **decision** | Name the blocker as people, not as effort. |
| **reversal_condition** | a trial running |
| **failure_discovered** | three P2 rows carried basis: asserted; checking them found two already fixed. Carrying them forward would have put three phantom debts into the UX work. |
| **lesson** | Distinguish blocked-on-evidence from unfinished, and distinguish read-in-the-tree from believed. |
| **observed_evidence** | rows 11, 13, 18, 19 each require a person; no amount of code produces any of them |
| **external_evidence** | — |
| **what_was_not_known** | everything those four rows would answer |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | FIELD-REQUIRED across VALUE_CLARITY, the design constitution and the audits; MEASUREMENT-BLOCKED in D24; 'blocked on people' as a state in the plan table |
| **was_generalized** | True |
| **confidence** | 0.94 |
| **source_paths** | `docs/MASTER_PRODUCT_DEBT.md 'Where the master plan stands'`, `docs/VALUE_CLARITY_FIELD_PROTOCOL.md` |

### `C43-said-once` — product-ux

| field | value |
| --- | --- |
| **problem** | A post-game disclosure rendered thirteen statements of one fact, with nothing on screen to choose between the six items a reader had opened it to choose between. |
| **initial_assumption** | Repetition is a copy preference. |
| **falsifier** | the predicate: a JSX element inside a .map() callback whose children are text ONLY -- no expression at all -- carrying at least MIN_SENTENCE characters |
| **negative_control** | a row that interpolates one of its own values is four different true statements on four buckets, and the scanner must not flag it |
| **positive_control** | client/src/components/ARepeatingList.tsx in the control fixture |
| **freeze_point** | UNKNOWN |
| **derived_or_declared** | DERIVED -- no expression means no per-row datum means every row renders identically |
| **authority_before** | review |
| **authority_after** | GATE-SAID-ONCE |
| **test_reality_level** | L1 over source |
| **promotion_rule** | UNKNOWN |
| **decision** | Turn the observation into a structural predicate rather than a style rule. |
| **reversal_condition** | UNKNOWN |
| **failure_discovered** | a defect visible in a screenshot survived 2,700 tests because no test asked the question a reader asks |
| **lesson** | When a human finds a defect a suite missed, the repair is a predicate that would have found it, not a fix to the one instance. |
| **observed_evidence** | the same shape then found on three more screens: WhatIsUnclear, LearningQueue, ProfilePanel; found by a person looking at a screenshot, not by 2,700 green tests |
| **external_evidence** | — |
| **what_was_not_known** | — |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | GATE-ENGINE-FAILURE-DISTINCT (nine causes, nine sentences); GATE-NO-DUPLICATE-ACTION |
| **was_generalized** | True |
| **confidence** | 0.95 |
| **source_paths** | `scripts/said-once-scan.ts`, `docs/design-council/00-REPO-NATIVE-CONSTITUTION.md section 2` |

### `C44-external-pointer-cannot-promote` — testing

| field | value |
| --- | --- |
| **problem** | An external reference can be used to raise a claim's grade. |
| **initial_assumption** | A citation is evidence about this product. |
| **falsifier** | the control compiles a permissive promotion path and the gate must go red |
| **negative_control** | UNKNOWN |
| **positive_control** | a permissive promotion path that compiles -- exactly what R4 forbids |
| **freeze_point** | UNKNOWN |
| **derived_or_declared** | DERIVED -- enforced by the type system |
| **authority_before** | a citation |
| **authority_after** | local evidence only, with external work called rather than reinvented and tiered where it is used |
| **test_reality_level** | L1 type-level |
| **promotion_rule** | no external effect size is transplanted into chess as a product coefficient |
| **decision** | Make the forbidden promotion unrepresentable. |
| **reversal_condition** | UNKNOWN |
| **failure_discovered** | an inherited claim ('29 of 29') was NOT PRESENT IN THE REPOSITORY AT ANY COMMIT -- three searches run and recorded -- so it had to be reproduced from the described design rather than from an artifact |
| **lesson** | Evidence authority may never exceed evidence level, and an inherited number with no artifact behind it is not a number. |
| **observed_evidence** | GATE-EXTERNAL: promotion from a pointer is a COMPILE ERROR; 7 permissive paths rejected, verified by running the control in this session; the evidence manifest carries a tier (A/B/C) per source and where it was used |
| **external_evidence** | AERA/APA/NCME Standards; Kane; Stanislaw & Todorov; Hautus |
| **what_was_not_known** | — |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | D24's source standard; docs/learning/PRIOR_ART.md; docs/design-council/SOURCES.md recording what was rejected |
| **was_generalized** | True |
| **confidence** | 0.96 |
| **source_paths** | `scripts/run_gates.ts GATE-EXTERNAL`, `docs/measurement/EVIDENCE_MANIFEST.json` |

### `C45-interaction-mode-table` — product-ux

| field | value |
| --- | --- |
| **problem** | Ten modes, spread as conditions across a 2,400-line component; DECIDE, ANSWER_INSTRUMENT and REVEAL all happen at the same URL. |
| **initial_assumption** | A surface is a place in the repository, so the routes are the model. |
| **falsifier** | the table is checked against makingEvidence and engineMayRun -- the two functions the product actually runs on |
| **negative_control** | UNKNOWN |
| **positive_control** | GATE-DECISION-FOCUS's control renders a claim panel beside the commitment |
| **freeze_point** | the table is data, not conditions |
| **derived_or_declared** | DECLARED_AND_VERIFIED -- a table that agreed with nothing would be decoration, so it is differenced against the enforcing functions |
| **authority_before** | conditions inside components |
| **authority_after** | still the components; the table decides nothing yet |
| **test_reality_level** | L2 |
| **promotion_rule** | derivation, then shadow, then ownership |
| **decision** | Write the table, difference it against what runs, hand nothing over. |
| **reversal_condition** | same shape as D22's |
| **failure_discovered** | UNKNOWN |
| **lesson** | A declared table earns its keep only by being differenced against the thing that actually enforces the rule. |
| **observed_evidence** | MODE_OF_STAGE puts `committed` in DECIDE, and DECIDE permits neither prior evidence nor engine output -- the table would have caught the counterfactual defect on its own |
| **external_evidence** | — |
| **what_was_not_known** | — |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | shared/next-action.ts; D22 |
| **was_generalized** | True |
| **confidence** | 0.93 |
| **source_paths** | `shared/interaction-mode.ts`, `tests/shared/ten-modes-and-what-each-permits.test.ts` |

### `C46-merge-of-two-repositories` — product-engineering

| field | value |
| --- | --- |
| **problem** | Two repositories held the same components and had already drifted apart. |
| **initial_assumption** | Merge everything. |
| **falsifier** | UNKNOWN |
| **negative_control** | UNKNOWN |
| **positive_control** | UNKNOWN |
| **freeze_point** | UNKNOWN |
| **derived_or_declared** | DECLARED_AND_VERIFIED |
| **authority_before** | two trees |
| **authority_after** | one tree, with the port decisions listed |
| **test_reality_level** | L1-L3 |
| **promotion_rule** | record what was left behind, not only what was taken |
| **decision** | Port selectively and write down the refusals. |
| **reversal_condition** | UNKNOWN |
| **failure_discovered** | the app opened on a fabricated +0.42 evaluation rendered identically to a real one; a timed-out analysis left the previous position's evaluation on screen; catch{break} truncated an invalid PV into a short valid-looking one |
| **lesson** | This is the origin of GATE-NO-FAKE and GATE-STALE: the earliest consolidation in this repository produced its first two gates. |
| **observed_evidence** | what was ported and what was deliberately left behind are recorded separately; the gates caught defects along the way; the engine had never run -- not once, in the project's history |
| **external_evidence** | — |
| **what_was_not_known** | — |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | GATE-NO-FAKE; GATE-STALE; GATE-DENOM |
| **was_generalized** | True |
| **confidence** | 0.9 |
| **source_paths** | `docs/FINDINGS.md 'Merging the two repositories'`, `docs/FINDINGS.md 'The duplication had already drifted'` |

### `C47-preserve-the-failure` — governance

| field | value |
| --- | --- |
| **problem** | A repaired failure is a failure that will be reintroduced. |
| **initial_assumption** | Fix the broken rule class and move on. |
| **falsifier** | UNKNOWN |
| **negative_control** | UNKNOWN |
| **positive_control** | UNKNOWN |
| **freeze_point** | the superseded artifact keeps its own hash |
| **derived_or_declared** | DECLARED_AND_VERIFIED |
| **authority_before** | the superseded result |
| **authority_after** | the superseding result, with an explicit relationship and a scope |
| **test_reality_level** | n/a |
| **promotion_rule** | supersession is explicit, scoped, and never a deletion |
| **decision** | No repair of RC-06. Add a round rather than rewriting the rounds. |
| **reversal_condition** | UNKNOWN |
| **failure_discovered** | a study that only records what worked is not reproducible |
| **lesson** | Failed history is provenance, not clutter -- and a supersession that erases is a supersession nobody can audit. |
| **observed_evidence** | docs/measurement keeps its four rounds and D25 adds a fifth; NOTHING BELOW IS DELETED AND NO NUMBER BELOW IS WRONG -- what is withdrawn is one reading of a difference; B3 records twelve failures with the reason each mattered; the 75-game B2 run is preserved unmodified including its evidence sha256 |
| **external_evidence** | — |
| **what_was_not_known** | — |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | docs/MASTER_PRODUCT_DEBT's Refuted section; docs/MEASUREMENTS history sections; D23 kept with its errors corrected in place by D24; docs/design-council/04-ADVERSARIAL-REVIEW recording findings that were NOT acted on |
| **was_generalized** | True |
| **confidence** | 0.97 |
| **source_paths** | `docs/decisions/D25-evidence-architecture.md 'What must not happen next'`, `docs/measurement/README.md amendment block`, `research/b3_population_expertise/FAILURES.md`, `research/b2/as-published-75/` |

### `C48-adversary-inside-the-schedule` — governance

| field | value |
| --- | --- |
| **problem** | An author reviewing their own work optimises for a positive result. |
| **initial_assumption** | A careful author is enough. |
| **falsifier** | the reviewer runs in a separate context, is told not to optimise for a positive result, and cannot see the author's reasoning |
| **negative_control** | the blind pass -- no contract, no constitution, no stylesheet |
| **positive_control** | the re-review, which hunts for defects the repairs introduced and found nine (N1-N9), then five more (M1-M5) |
| **freeze_point** | the gate is at a fixed point in the schedule, before the expensive step |
| **derived_or_declared** | DECLARED_AND_VERIFIED -- the ledger records the routing deviation (project-local agent files not picked up; general-purpose subagents with an explicit model override and the reviewer instructions supplied verbatim) |
| **authority_before** | the author |
| **authority_after** | the review artifact, with every required change applied and recorded |
| **test_reality_level** | text and code against artifacts |
| **promotion_rule** | the adversary may weaken or narrow; it may not upgrade |
| **decision** | Put the adversary in the schedule at fixed gates, and re-review the repairs. |
| **reversal_condition** | UNKNOWN |
| **failure_discovered** | repairs introduce defects: twelve of thirteen Gate 1 changes were genuinely applied and NINE new transcription defects arrived with them, three on quantities the verdict reads. The third re-read found five more, one of which (M4) was a real estimator failure rather than transcription. |
| **lesson** | Build the adversary in before the work is expensive, and review the repairs as a separate pass -- a repair is a change like any other. |
| **observed_evidence** | B3: four gates, four dispatches, plus the re-reads Gate 1's own PASS loop required; FABLE_GATE_UNAVAILABLE was never recorded; design: four passes with different jobs, including a BLIND one that saw ten screenshots and nothing else; the ledger's sweeps run because the last two findings were found by accident |
| **external_evidence** | — |
| **what_was_not_known** | — |
| **supersedes** | — |
| **superseded_by** | — |
| **generalized_to** | docs/design-council/04; the ledger's adversarial sweeps; this mission's own required ADVERSARIAL_REVIEW.md |
| **was_generalized** | True |
| **confidence** | 0.96 |
| **source_paths** | `research/b3_population_expertise/reviews/`, `docs/design-council/04-ADVERSARIAL-REVIEW.md`, `.claude/agents/fable-scientific-reviewer.md`, `docs/PRODUCTION_READINESS_LEDGER.md Cycle 41` |

