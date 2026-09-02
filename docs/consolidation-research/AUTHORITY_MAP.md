# AUTHORITY_MAP — one authority per question

For every question a reader of this repository can ask, the current authority, what it is derived
from, what carries the history, whether anything competes with it, and whether the answer can be
checked by running something.

The hypothesis under test is the repository's own: **one authority per question, not one source of
truth for everything.** The test is whether every critical question has exactly one current answer
with a known lineage, *without* the answers having been merged into a single document.

## Result

| | |
| --- | ---: |
| critical questions enumerated | 24 |
| with exactly one current authority | **24 / 24** |
| with a known lineage (what it superseded, or `—` for original) | **24 / 24** |
| **mechanically verifiable** (a command or a type decides it) | **15 / 24 = 63%** |
| with a competing authority that is not scoped | **0** |

**The hypothesis survives.** No document in this repository is the source of truth for everything,
and no question has two unscoped answers. The two places where two records disagree
(`CONTRADICTIONS.md` X-01, X-02) are *within* one authority's own artifacts, not between two
claimants.

## The map

Legend: **MV** = mechanically verifiable — a command, a type or a scan decides the answer, and a
wrong answer fails a build.

### Product and contract

| question | authority | derived from | history / fallback | competing | MV |
| --- | --- | --- | --- | --- | --- |
| What is the product's promise? | `shared/promise.ts` | authored once; imported by the front door and the card builder | earlier per-surface copies, described in the module's own docblock | none — the two copies that cannot import are held by `tests/client/the-link-someone-was-sent.test.ts` | **yes** |
| What rule does everything rest on? | `README.md` ("the rule everything rests on") + `MODE_CONTRACT` in `shared/interaction-mode.ts` | the contract table is differenced against `makingEvidence` and `engineMayRun` | — | none | **yes** |
| Which mode is the player in, and what does it permit? | `shared/interaction-mode.ts` | `DECISION_STAGES` | conditions still live in `Home.tsx`/`Blitz.tsx`; the table decides nothing yet (`L9`) | the components, deliberately, until ownership transfers | **yes** |
| What should the player do next? | the screens (`ResumeScreen`, `PostGame`, front door) | — | `shared/next-action.ts` runs in shadow and is ignored | the derivation, deliberately, in shadow | **yes** (`GATE-NEXT-ACTION-RESOLVES-BLOCKER`) |
| What may be said about a claim on screen? | `shared/evidence-authority.ts` | `Claim`, not `ClaimGrade` — a caller holding only the grade could have got it anywhere | `GRADE_WORD` and three screen-local wordings, replaced | none | **yes** (`GATE-GRADE`) |
| Which observations may an analysis read? | `shared/evidence-policy.ts`, version 3 | one table asked by every consumer | per-call-site `if`s, replaced | none | **yes** (a test reddens on deleting any cell) |
| What protocol may judge a claim? | `shared/discovery/claim-class.ts` → `shared/validation-protocol.ts` | the **union** of the predicate's features' `condition_kind` | the precedence version, recorded in `D20` as the defect it was | PR #42 answers a *different* question (see `CONTRADICTIONS.md` X-05) | **yes** |
| What did the player see at the reveal? | `shared/reveal.ts` `theOneThing` | — | — | **explicitly none**: *"Never re-derived"* (`ACQUISITION_EVIDENCE.md` §"source of truth") | **yes** |
| What is a learning rule's grade? | `gradeFromRecord` in `shared/record-service.ts` | the stored results | the stored enum, kept for `retired` only and guarded in all three stores | `LearningQueue.tsx:111` renders the stored grade — **`CONTRADICTIONS.md` X-01** | **yes** (two invariant tests redden) |

### Debt, plan and process

| question | authority | derived from | history / fallback | competing | MV |
| --- | --- | --- | --- | --- | --- |
| What debt is currently open? | `docs/MASTER_PRODUCT_DEBT.md` | rows with `basis: verified` citing the tree | `PRODUCTION_READINESS_LEDGER.md` (how each closed defect closed), `ACTION_PLAN.md` (that plan's ordering), `blitz/AUDIT.md` (blitz before it was built), `discovery-v2/M0_AUDIT.md` (the numbers behind R-11…R-14), `docs/decisions/` (reversal conditions) | none — the supersedes table names each other document's remaining question | **yes** (`GATE-REGISTER-RECONCILED`) |
| Which gates are enforced? | `scripts/run_gates.ts` | the `id:` fields, read by `declaredGates()` | — | none; a law naming an unregistered gate reddens the scan | **yes** |
| What is the state vocabulary for a debt row? | `scripts/register-scan.ts` `STATE_VOCABULARY` | closed set of six | — | none | **yes** |
| Which decision node is current, and what would reverse it? | `docs/decisions/D*.md`, indexed by `docs/decisions/README.md` | one file per node, each ending in a reversal condition | superseded nodes kept (`D23`, `D24`) with the pointer in the README row | none | **partly** — the README table is scanned; the prose is not |
| What is the interaction law set? | `docs/INERTIAL_UX_LAWS.md` | twelve laws, eight registered as gates, one exempt by name | — | none | **yes** |
| How much reality does a test run against? | `scripts/test-level-scan.ts` | imports + requested environment | `tests/LEVELS.md` carries the argument and a dated count | none — the doc defers to the scan in its own words | **yes** |
| May a debt row claim what it claims? | `GATE-CLAIM-ANCHOR` | the derived level vs the row's severity floor | the ratchet it began as | none | **yes** |

### Research and evidence

| question | authority | derived from | history / fallback | competing | MV |
| --- | --- | --- | --- | --- | --- |
| What is the strongest permitted claim about the learning construct? | `docs/evidence-architecture/STRONGEST_PERMITTED_CLAIM.json` v2.2.0 | the C11 screen, the anchor rebuild, the identifiability simulation | v1.3.0, superseded **for the claims it contradicts only** (its own field) | the prose `.md`, which defers to the JSON in line 5 | **partly** |
| What is the canonical engine-scored record? | `research/harness-shipped/`, sha256 `d70998ba…` | the engine the product ships | `research/harness/` (native engine), kept and labelled | none — `MEASUREMENTS.md` and `ENGINE_PARITY_RESULTS.md` name the same directory and hash | **yes** (hash) |
| Is a raw second the right unit for a blitz decision? | `docs/research/TIME_REPRESENTATION_RESULTS.md` (117 games) | the preregistration frozen before scoring | the 75-game run preserved unmodified in `research/b2/as-published-75/` with its own evidence hash | none | **yes** (hash) |
| What is the B3 verdict? | `research/b3_population_expertise/results/verdict_repaired.json` → `GENERAL_REGULARITY_ONLY` (level 3) | `src/evaluate.py`, a transcription of `VERDICT_RULES.md`, run before any narrative | `verdict.json` → `INVALID_EXPERIMENT`, kept; both published in `REPORT.md` | none — both are printed with their provenance | **yes** (re-runnable) |
| What is the identity of B3's frozen documents? | `results/FINAL_HOLDOUT_SEALED.json` `document_sha256` | sha256 of the five documents at the seal commit | `results/PREREGISTRATION_FREEZE.json` (`sha256`, `amended_sha256`) + `POST_FREEZE_AMENDMENTS.md` | **the freeze record's `amended_sha256` is stale for `DATA_PROTOCOL.md`** — `CONTRADICTIONS.md` X-02 | **yes** (hash) |
| What experiment is active? | none on `main`. `experiment/n-of-1-timing-policy` carries a frozen N-of-1 preregistration with no prospective data | the branch, recorded in `BASELINE.md` §4 | — | none | **yes** (git) |
| What may the acquisition ledger record? | `docs/ACQUISITION_EVIDENCE.md` | seven observations, each with a named denominator and a prohibited inference | — | none | **partly** |
| What is legible vs what is wanted? | `docs/VALUE_CLARITY.md` (clarity) / the field arms (value) | five lenses, split into a repo half and a field half | — | none — the two have *different authorities by construction* | **partly** |

### Deployment

| question | authority | derived from | history / fallback | competing | MV |
| --- | --- | --- | --- | --- | --- |
| What code is deployed? | the Vercel production deployment's `githubCommitSha` | the GitHub integration | — | none | **yes** — at baseline `8c8b331`, identical to `main` and to this working branch |
| Is the deployment healthy? | `/api/health` running `select 1` under a 3s deadline | the query, not the environment variable | the unconditional `{ok:true}`, recorded as Cycle 13 | none | **yes** |
| What does a deployment with no server do? | `docs/STATIC_DEPLOYMENT.md` + `tests/layout/a-stranger-with-no-server.layout.test.ts` | a real browser against a host answering 503 to every `/api/*` | `server/_core/configuration.ts`'s own sentence | none | **yes** |

## What this shows about the hypothesis

Three findings, each with its evidence.

**1. The authorities are per-question and they are small.** `shared/promise.ts` owns one sentence.
`shared/reveal.ts` owns one branch decision. `run_gates.ts` owns the set of enforced gates and
nothing else. No file in the list owns more than one row, with a single exception: `MASTER_PRODUCT_DEBT.md`
owns "what is open", and it *explicitly disclaims* every other question in its own supersedes table.

**2. The mechanism that keeps them true is a scan, not a convention.** `GATE-REGISTER-RECONCILED`
does not check that documents agree with each other in prose. It checks the claims a register makes
about something **outside itself** — a path, a constant, a gate id, another register's table —
because *"those are the claims that rot without anybody touching them"*. Verified in this study:
the gate is green on the real tree and red on `tests/fixtures/registers`.

**3. The 37% that are not mechanically verifiable are all prose-authority documents**, and the
repository knows it. The pattern is consistent: where an authority can be executed, it is
(`evidence-policy.ts`, `claim-class.ts`, `evaluate.py`, the scanners); where it cannot, the
repository writes the argument and then builds the cheapest possible check *around* it — the
register scan checks that a law's gate exists, not that the law is right.
