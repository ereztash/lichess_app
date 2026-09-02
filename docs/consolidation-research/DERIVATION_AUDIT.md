# DERIVATION_AUDIT — what is declared that could be derived

Every important piece of state in this repository, classified. The classes are the mission's:

| class | means |
| --- | --- |
| `DERIVED` | computed from the record or the tree; a wrong value cannot be written by hand |
| `DECLARED_AND_VERIFIED` | asserted, and something mechanically checks the assertion against the world |
| `DECLARED_UNVERIFIED` | asserted, and nothing checks it |
| `HISTORICAL` | a dated snapshot; not a live claim, and correct as a record of its moment |
| `UNKNOWN` | cannot be determined from the evidence |

## Result

| class | count | share |
| --- | ---: | ---: |
| `DERIVED` | 21 | 51% |
| `DECLARED_AND_VERIFIED` | 12 | 29% |
| `DECLARED_UNVERIFIED` | 5 | 12% |
| `HISTORICAL` | 3 | 7% |
| `UNKNOWN` | 0 | 0% |
| **total** | **41** | |

`DECLARED_UNVERIFIED` is 12%, and **four of the five are in the same class**: a number a person must
supply, which no amount of derivation produces.

## The audit

### `DERIVED` — 21

| state | derived by | what a wrong value would do |
| --- | --- | --- |
| a test's reality level (L1–L6) | `scripts/test-level-scan.ts`, from imports and requested environment | a claim would outrun its proof; `GATE-CLAIM-ANCHOR` reddens |
| the set of enforced gates | `declaredGates()` reading `run_gates.ts` | a law would claim enforcement that does not exist |
| whether a register cites a file that exists | `findDanglingCitations` over the tree | a reader could not open the citation |
| whether a law's named gate runs | `findPhantomGates` | as above; verified red in this study's control run |
| a learning rule's grade | `gradeFromRecord` | a refuted rule would be re-preregistered (Cycle 39) |
| the required validation protocol for a predicate | `claimClassFor` → union over `condition_kind` | a clock claim tested with a chessboard (`D20`) |
| a hypothesis's identity | `SHA256(canonicalJson(manifest))` | evidence collected against a claim it is not (`D09`) |
| a position's novelty key | `shared/position-key.ts`, the four fields that determine legal moves | a position already answered would enter a transfer test as unseen |
| a decision's phase | `commitDecision` re-derives from the entry FEN and refuses on client disagreement | a claim about the wrong third of the game |
| the interaction mode of a stage | `MODE_OF_STAGE` | the counterfactual defect (`INERTIAL_UX_LAWS` LAW 3) |
| what to do next | `deriveNextAction` from what the record is missing | *"play another game"* answering a backlog blocker |
| the reveal branch | `theOneThing`, never re-derived | two answers to "what did this player see" |
| whether the database is up | `select 1` under a 3s deadline | a working local record abandoned (Cycle 13) |
| the initial bundle graph and its weight | `scripts/check_bundle_budget.ts` over the built output | the engine pulled back into the entry graph |
| whether every conveyed component has a notice | `scripts/notice_coverage.ts` over `dist/public` | a licence obligation unmet |
| whether a list row says anything | `scripts/said-once-scan.ts` — a `.map()` child with no expression | thirteen statements of one fact |
| whether the machine's colour is pressable | `scripts/two-hands-scan.ts`, both directions, over the stylesheet | the engine's voice and the player's hand painted alike |
| whether a screen offers two acts | `data-primary-action`, a named act from a closed vocabulary | two products at one weight |
| the database schema in CI | every `drizzle/migrations/*.sql` applied in order | `Unknown column` from a suite that passes locally |
| the B3 verdict | `src/evaluate.py`, a transcription of `VERDICT_RULES.md` | a narrative choosing its own verdict |
| whether the B3 holdout may be read | `run.py require_seal()` | a study that asks its author to remember not to look |

### `DECLARED_AND_VERIFIED` — 12

| state | declared where | verified by |
| --- | --- | --- |
| the bundle ceilings | `check_bundle_budget.ts` constants | the measured build; the ratchet is the point |
| `Home.tsx`'s `useState` ceiling | `the-file-that-only-ever-grew.test.ts` | the file; and `register-scan` checks the register's citation of it |
| the ten interaction modes and their contracts | `shared/interaction-mode.ts` | differenced against `makingEvidence` and `engineMayRun` |
| `EVIDENCE_POLICY_VERSION` | `shared/evidence-policy.ts` | a test reddens on deleting any cell of the table |
| `CURRENT_PROTOCOL_VERSION` | `shared/measurement-protocol.ts` | `two-regimes-are-not-one-population.test.ts` |
| the five evidence-authority levels | `shared/evidence-authority.ts` | total mappings; `GATE-GRADE` |
| the experimental arm on a stored position | `writePosition`, required field | four call sites found by the type system; four controls |
| the six frozen bucketings | `shared/discovery/hypothesis-manifest.ts` | changing them changes the manifest hash |
| the engine identity and options | `PREREGISTRATION_FREEZE.json`, `FEATURE_SCHEMA.md` | binary sha256 recorded and re-checked |
| the N-of-1 assignment sequence | `research/b3/N_OF_1_TIMING_PREREG.md` | published in full as a table **and** as a string, so it can be checked |
| the corpus for every research run | `corpus_manifest.json` per run | source URL, byte count, prefix sha256, seed, acceptance rates |
| the deployed commit | Vercel's `githubCommitSha` | the GitHub integration; checked in `BASELINE.md` §5 |

### `DECLARED_UNVERIFIED` — 5

| state | where | why nothing checks it | class of gap |
| --- | --- | --- | --- |
| `basis: asserted` rows in the debt register | `MASTER_PRODUCT_DEBT.md` | the field exists **precisely to mark this**; all three such rows have since been checked and two were already fixed | **self-declared, and the declaration is the mechanism** |
| the FIELD-REQUIRED half of every value-clarity lens | `VALUE_CLARITY.md`, `VALUE_CLARITY_FIELD_PROTOCOL.md` | needs a person | **blocked on people** |
| the OWNER-REQUIRED rows in the frontend audit | `FRONTEND_EXCELLENCE_AUDIT.md` | a preference, and the owner outranks every agent for it | **blocked on a person's judgement** |
| whether the calibration gap moves with feedback exposure | `D21` Finding 3 | the record cannot represent exposure; the axis is deliberately not added | **blocked on a measurement, with the trigger written down** |
| `L6` deployment evidence | `tests/LEVELS.md` | no test runs against the deployed origin | **a named, dated gap** |

**None of the five is a place where a derivation was available and a declaration was chosen.**

### `HISTORICAL` — 3

| state | where | why it is correct as history |
| --- | --- | --- |
| the ledger's "Source of truth" header | `PRODUCTION_READINESS_LEDGER.md` | filed as `R-01`; the file is a per-cycle history and the header is that cycle's |
| the test counts in `tests/LEVELS.md` | 246/248 files vs the scanner's 264 | the file states that the scan is the authority |
| `main` and the three PR SHAs in `evidence-architecture/CURRENT_STATE.md` | e9cd4de + #49/#50/#51 | *"the labels are left in place rather than swept, because what each claim was checked against is a fact about the check"* |

## Ranked opportunities to replace declaration with derivation

Ranked by `Reach × FailureSeverity × EvidenceStrength × Generalizability` as defined in
`LOCAL_SOLUTION_GAPS.md`. **No implementation is proposed here.**

| # | opportunity | why it is available | rank |
| --: | --- | --- | ---: |
| 1 | `LearningQueue.tsx` renders `rule.grade` and computes due-ness from stored `next_due_at` while `gradeFromRecord` exists | the derivation already ships and is already the write-path authority | **highest** — this is `CONTRADICTIONS.md` X-01, and closing it removes the last read-path declaration in the product |
| 2 | `PREREGISTRATION_FREEZE.json`'s hash sets are hand-maintained | the hashes are computable from the tree at a named commit; the seal record already does it | high — `CONTRADICTIONS.md` X-02 |
| 3 | The bundle ceiling is a hand-edited constant with no positive control | every other gate's control is a fixture; a deliberately-oversized fixture is buildable | medium |
| 4 | Test counts and gate counts quoted in prose across nine documents | `npm run levels` and `npm run gates` both print them | low — these are dated measurements inside arguments, and deriving them would delete the argument's own record of when it was made |

Item 4 is listed **and recommended against**, because it is the one place where the audit's own
rule stops applying: a number inside a dated argument is provenance, not state.
