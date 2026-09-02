# BASELINE — repository state at the start of the consolidation process-mining study

**Recorded:** 2026-09-02, before any file in this study was written.

This file is a snapshot. Nothing in it may be revised. Corrections may only be appended under
`## Amendments`, each with its own date and reason. If a fact below turns out to be wrong, the
wrong fact stays and the amendment says so.

---

## 1. Git

| item | value |
|---|---|
| working branch | `claude/repo-native-os-extraction-o1psvb` |
| working branch SHA | `8c8b331a4336905bcc4f73e59764e32f42a2356b` |
| `origin/main` SHA | `8c8b331a4336905bcc4f73e59764e32f42a2356b` |
| relationship | **identical** — 0 ahead, 0 behind |
| working tree | clean (`git status --porcelain` empty) |
| tracked files | 980 |
| head commit subject | `Merge pull request #61 from ereztash/claude/chess-expertise-decision-experiment-y0zipl` |

Note recorded at the time: the container's `origin/main` ref was stale at `0b2f07c` (PR #34) until
an explicit `git fetch`. After the fetch, `origin/main` and the working branch are the same commit.
The 207-commit gap first observed was an artifact of the stale ref, not of the repository. This is
itself the first observed instance of the pattern this study is about: **a declared state (the local
ref) diverging from the derivable state (the remote), where re-deriving was cheap and reading the
declaration was wrong.**

## 2. Branches and their relationship to `main` (at `8c8b331`)

| branch | head | ahead of main | behind main | last commit (UTC±) |
|---|---|---:|---:|---|
| `main` | `8c8b331` | 0 | 0 | 2026-09-02T08:27:12+03:00 |
| `art-direction-experiment` | `0358ce9` | **6** | 36 | 2026-09-01T20:33:31+03:00 |
| `claude/mati-user-experience-components-d7549y` | `b3c37e4` | **12** | 192 | 2026-08-30T07:40:23Z |
| `experiment/n-of-1-timing-policy` | `d1cdc02` | **1** | 36 | 2026-09-01T21:41:17+03:00 |
| `feature/visual-analysis-dashboard` | `af2438a` | **11** | 328 | 2026-08-21T16:56:33+03:00 |
| `claude/api-test-games-lychees-f1o4p9` | `8d4569b` | 0 | 30 | 2026-09-02T02:39:22Z |
| `claude/blitz-computation-validation-3utluc` | `ef74a24` | 0 | 157 | 2026-08-30T19:21:12Z |
| `claude/chess-expertise-decision-experiment-y0zipl` | `43a7e9c` | 0 | 21 | 2026-09-02T05:22:09Z |
| `claude/closed-loop-learning-architecture-3ryvgf` | `673b8f2` | 0 | 84 | 2026-09-01T09:07:29Z |
| `claude/decision-lab-discovery-v2-h16xbi` | `b9a228c` | 0 | 36 | 2026-09-01T20:09:31+03:00 |
| `claude/decision-lab-frontend-excellence-3swci7` | `f947ed5` | 0 | 41 | 2026-09-01T16:51:44Z |
| `claude/decision-lab-visual-identity-s1t3ng` | `e7f3a3a` | 0 | 20 | 2026-09-01T23:17:35Z |
| `claude/lichess-learning-ux-research-stngcc` | `ff6e8a3` | 0 | 50 | 2026-09-01T12:54:44Z |
| `claude/lichess-visual-audit-etxppr` | `9e7d9af` | 0 | 42 | 2026-09-01T15:49:44Z |
| `claude/litches-app-monetization-8rufzz` | `aa29f36` | 0 | 323 | 2026-08-22T17:51:44Z |
| `claude/measurement-falsification-research-k90sbd` | `a9360d5` | 0 | 91 | 2026-08-31T21:33:10Z |
| `claude/new-user-flow-review-ubfz04` | `b4edac4` | 0 | 204 | 2026-08-29T22:01:21Z |

Twelve of the sixteen non-main branches are fully merged (0 ahead). Four carry unique commits.

## 3. Open pull requests

**None.** `list_pull_requests(state=open)` returned an empty list. PRs #34, #54, #56, #57, #59, #60,
#61, #62 are merged; all are reachable from `main`.

## 4. The N-of-1 experiment branch, recorded separately

| item | value |
|---|---|
| branch | `experiment/n-of-1-timing-policy` |
| head SHA | `d1cdc02215ba6c56eb70b81fe4c907fe962793cf` |
| unique commit | `research: preregister N-of-1 timing intervention pilot` |
| unique file | `research/b3/N_OF_1_TIMING_PREREG.md` (185 lines) — **exists on no other ref** |
| sha256 (prefix) | `1f3a08c25e963702` |
| declared status | `FROZEN BEFORE THE FIRST PROSPECTIVE GAME` |
| participant | account `Erez281`, single subject |
| design | prospective N-of-1 randomised crossover pilot, 60 eligible games, pair-randomised |
| seed | `20260901` |
| assignment sequence | frozen in the document, published in full as a table and as a string |
| adherence gate | `P(secondsTaken >= 8 | T) <= 0.70 * P(secondsTaken >= 8 | C)`; failure ⇒ `MANIPULATION FAILED` |
| no-peeking rule | present; no early stopping for apparent benefit |
| prospective data | **none yet recorded in the repository** |
| path collision note | this file lives under `research/b3/`, while the merged expertise study lives under `research/b3_population_expertise/`. Two different studies both called "B3". Recorded here as an observation; classified later. |

## 5. Production deployment

| item | value |
|---|---|
| provider | Vercel, team `ereztashs-projects` (`team_Rxdouw4OcW2gGj7RlSuc5KSW`), plan hobby |
| project | `lichess_app` (`prj_NXmsE45Qk36n8zaxcVYcMmvUeK4t`), linked to `ereztash/lichess_app` |
| current production deployment | `dpl_HG2KZdMhLs92HDvVmkSCJbKsc9eU`, state `READY` |
| production commit SHA | `8c8b331a4336905bcc4f73e59764e32f42a2356b` |
| relationship to `main` | **identical** |
| build | `npm run build`, output `dist/public`, framework vite |
| function | `api/[...path].ts`, `maxDuration` 30 |

Production, `main`, and the working branch are all the same commit at baseline.

## 6. CI

| item | value |
|---|---|
| workflow | `.github/workflows/verify-build.yml`, name `Verify` |
| triggers | `push` on `main`; `pull_request` (all branches); `workflow_dispatch` |
| run on `8c8b331` | `completed / success` |
| total recorded runs | 382 |
| last 15 runs | all `success` |
| steps | install (`npm ci`), `npm audit --omit=dev --audit-level=high`, playwright chromium, typecheck, apply every `drizzle/migrations/*.sql` to a live MySQL 8 service, build, test (with `DATABASE_URL` set), `npm run gates`, `npm run gates:controls`, `npm run bundle:budget` |
| local verify chain | `npm run verify` = check → build → test → gates → gates:controls → bundle:budget |
| last recorded local verify totals (commit `09c28d7`) | 2,903 tests across 259 files; 28 gates green; 28 positive controls red; initial download 757.6 kB against a 761 kB ceiling |

## 7. Frozen scientific artifacts — identity at baseline

sha256, first 16 hex characters, of the file **as it stands on `8c8b331`**.

| path | sha256[0:16] |
|---|---|
| `research/b3_population_expertise/PREREGISTRATION.md` | `039c93756ee57a9b` |
| `research/b3_population_expertise/DATA_PROTOCOL.md` | `6560f3d7000de83c` |
| `research/b3_population_expertise/FEATURE_SCHEMA.md` | `9a5c11022aff9111` |
| `research/b3_population_expertise/MODEL_SPEC.md` | `a92cb57275987db5` |
| `research/b3_population_expertise/VERDICT_RULES.md` | `75dc019dd56dcf20` |
| `research/b3_population_expertise/results/PREREGISTRATION_FREEZE.json` | `e2ed8942764cecbc` |
| `research/b3_population_expertise/results/FINAL_HOLDOUT_SEALED.json` | `ba27896d6bd5855a` |
| `research/b3_population_expertise/results/verdict.json` | `2173e434b0cf312f` |
| `research/b3_population_expertise/results/verdict_repaired.json` | `92ec966c21a954be` |
| `docs/research/ACCOUNT_BRIDGE_PREREG.md` | `4e7b7b831f1dbb1f` |
| `docs/research/ACCOUNT_BRIDGE_FULL_PREREG.md` | `ff616231be8fab99` |
| `docs/research/BLITZ_COMPUTATION_PREREG.md` | `772a64d989c3d9c6` |
| `docs/research/ENGINE_PARITY_PREREG.md` | `a6d90a146b9579de` |
| `docs/research/TIME_REPRESENTATION_PREREG.md` | `65f32fa2959f361f` |
| `docs/evidence-architecture/STRONGEST_PERMITTED_CLAIM.json` | `33ef67500bea475a` |
| `docs/measurement/STRONGEST_PERMITTED_CLAIM.json` | `085c7f03117efe33` |
| `docs/measurement/EVIDENCE_MANIFEST.json` | `81a21c9cfc330228` |
| `research/b3/N_OF_1_TIMING_PREREG.md` (on `experiment/n-of-1-timing-policy` only) | `1f3a08c25e963702` |

### 7a. B3 self-declared identity chain, as recorded by the repository itself

`results/PREREGISTRATION_FREEZE.json` declares two hash sets and one commit correction:

- **freeze**, `2026-09-01T22:28:23Z`, commit `8141c5b`: `PREREGISTRATION` `039c9375…`,
  `DATA_PROTOCOL` `cf263394…`, `FEATURE_SCHEMA` `9a5c1102…`, `MODEL_SPEC` `537c77be…`,
  `VERDICT_RULES` `75dc019d…`.
- **amended**, `2026-09-02T00:46:57Z`, commit `e70a0de`: identical except `MODEL_SPEC` →
  `a92cb572…`. `DATA_PROTOCOL` is still listed as `cf263394…`.
- a `commit_note` correcting both commit ids, which had been recorded as their parents because the
  hash was taken in the working tree before the commit that carried it.

`results/FINAL_HOLDOUT_SEALED.json`, written `2026-09-02T02:08:13Z` at commit `da15833`, records
`DATA_PROTOCOL` as `6560f3d7…`.

**Verified against git at baseline:**

- `DATA_PROTOCOL.md` @ `8141c5b` → `cf2633949929171a`
- `DATA_PROTOCOL.md` @ `e70a0de` → `cf2633949929171a`
- `DATA_PROTOCOL.md` @ `da15833` → `6560f3d7000de83c` (+5 −2 lines)
- `DATA_PROTOCOL.md` @ `8c8b331` (now) → `6560f3d7000de83c`

So a hashed, frozen document changed in the seal commit, the seal record carries the new hash, and
`PREREGISTRATION_FREEZE.json`'s `amended_sha256` block was not updated to match. Recorded here as a
**baseline observation of fact**, not yet a classification. It is carried into
`CONTRADICTIONS.md` as candidate `C-B3-DATAPROTO`.

## 8. Gate inventory at baseline

`tests/gates/` contains 12 gate test files: `claim-anchor`, `commit`, `engine-failure`, `grade`,
`iso`, `measurement`, `prereg`, `primary-action`, `reachability`, `said-once`, `stale`, `two-hands`.
`scripts/run_gates.ts` is the registry and runner; it defines three statuses — `PASS`, `FAIL`,
`NOT-MEASURED` — and a two-mode contract in which every gate must also go red against a
deliberately-broken fixture (`--positive-controls`).

## 9. Decision-record inventory at baseline

`docs/decisions/` contains 15 decision files plus a README:
`D00 D01 D02 D03 D04 D05 D08 D09 D20 D21 D22 D23 D24 D25`.

**Absent: `D06`, `D07`, `D10`–`D19`.** No file with those ids exists on any ref. Whether the gaps
are reserved, abandoned, or renamed is not established at baseline and is carried as an open corpus
question.

## 10. Scope of the study

Read-only. No file outside `docs/consolidation-research/` is created, moved, renamed, deleted,
reformatted, split, merged, or edited by this mission. No branch is merged or deleted. No gate,
protocol, verdict, preregistration, manifest or deployment is changed.

---

## Amendments

### Amendment 1 — 2026-09-02 — a research artifact was overwritten and restored

**What happened.** While gathering executable evidence, `python3 research/discovery-oracle/selftest.py`
was run. The script writes its own output to `research/discovery-oracle/results/selftest.json`, and
the run overwrote the committed file. This was not intended: the mission forbids altering research
artifacts.

**What was done.** `git checkout -- research/discovery-oracle/results/selftest.json`, immediately.
The working tree is clean of it; `git status --porcelain` shows only the new, untracked
`docs/consolidation-research/` directory. No other tracked file was written at any point.

**Why the baseline is amended rather than edited.** Section 10 of this file says no file outside
`docs/consolidation-research/` is modified by this mission. That statement was briefly false and is
left standing, with this amendment beside it, because that is what §10 of this repository's own
`docs/measurement/README.md` does with a superseded claim: *"Nothing below is deleted and no number
below is wrong."*

**What it produced.** The overwrite's diff is the evidence for `CONTRADICTIONS.md` **X-16** — the
committed `selftest.json` records `one-game-only` at `delta 0.45, passes false` while
`oracle/worlds.py` at this commit declares `0.22`, and a re-run passes. The finding is stated from
the diff and from `git show` of the committed version, never from the overwritten file.
