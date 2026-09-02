# HARDENING BASELINE — frozen

> ### THESE NUMBERS EVALUATE THE RECONSTRUCTION STUDY, NOT THE APPLICATION.
> `SCORING_METHOD_V2.md` §7 lists what is knowingly outside them.

**This file is immutable except by dated amendment.** It records the repository state that the
hardening mission starts from, so any later movement can be attributed to a change in the
repository rather than a change in the instrument.

| | |
| --- | --- |
| base branch | `main` |
| base SHA | **`6f5577ff5fd785e9d67415bf9a3ed5868b7aaf18`** — the merge of PR #63 |
| study state | Study v2, merged unchanged; `docs/consolidation-research/` at 24 files |
| hardening branch | `pre-consolidation/coherence-hardening` |
| recorded | 2026-09-02 |

Study v1's `97.78 / 96.35 / STRONG_REPO_NATIVE_OS` and Study v2's `90.73 / 96.74 / PARTIAL` are
both historical evidence. Neither is to be recomputed against a later tree and overwritten.

---

## 1. The frozen benchmark

```
STUDY v2 SCORE = 90.73 / 100     threshold > 95    NOT MET
WES            = 96.74           threshold > 95.5  MET
WES90          = 100.00 %
verdict        = PARTIAL_REPO_NATIVE_OS
```

### Component values, as produced by the merged programs

| dimension | value | max | the input that produced it |
| --- | ---: | ---: | --- |
| `D1a` governance coverage | **10.000** | 10 | 169 / 169 governing files classified |
| `D1b` implementation evidence | **2.335** | 6 | **26 / 204** files the governance corpus names are `QUOTED` |
| `D1c` support evidence | **3.979** | 4 | 2,928 / 2,954 tests executed; 19 / 19 migrations applied in CI |
| `D2` classification quality | **19.833** | 20 | separation 1.000 · κ 1.000 · falsification 0.9444 · admissibility 1.000 |
| `D3` contradiction resolution | **15.000** | 15 | 26 / 26 classified, 0 unresolved, 0 critical |
| `D4` authority resolution | **10.417** | 15 | **25 / 36** questions with one current authority |
| `D5` falsifiability | **14.167** | 15 | 17 / 18 laws — `RNL-17` carries no counterexample search |
| `D6` operational grounding | **15.000** | 15 | 16 / 16 repo-wide laws with ≥2 executed enforcements |
| **total** | **90.731** | 100 | |

`WES`: 83 published conclusions, `Σw = 144`, `Σ(w × strength) = 139.30`, distribution
`{0.90: 32, 1.00: 51}`. All five ceilings computed and none applies.

---

## 2. Secondary metrics — the ones this mission is actually trying to move

These matter more than the aggregate, and each is reported again in `FINAL_REPORT.md`.

| metric | baseline | where it comes from |
| --- | ---: | --- |
| **research reconciliation coverage** | **0 relations checked** | no scanner reaches `research/**` or the research registers under `docs/**`; `register-scan.ts` names six product/governance files and zero research ones (`G-04`) |
| **authority resolution rate** | **25 / 36 = 69.4 %** | `AUTHORITY_MAP_V2_ATTACK.md`, after two rounds; a **lower bound** — a third attack can only lower it |
| **authority-less critical questions** | **6** | rollback, observability, retention, supported runtimes, who may deploy, dependency upgrades — all operational |
| **mechanically verifiable authority rate** | **0 / 36** | no scanner derives any question's authority from the tree; `AUTHORITY_MAP.md` is hand-maintained prose |
| **implementation evidence coverage** | **26 / 204 = 12.7 %** | `d1b_population.py`, derived; population is 204 of 310 implementation files, the ones governance names |
| **L6 coverage** | **0 of 264 test files** | `npm run levels`: L1 81 · L2 84 · L3 77 · L4 5 · L5 17 · **L6 0** |
| **available-derivation-but-declared gap count** | **4 read sites** | `LearningQueue.tsx` lines **15, 42, 111, 120** — all consume stored `rule.grade` / `next_due_at` while `gradeFromRecord` exists (`G-01`, as corrected by Study v2) |
| **`DECLARED_UNVERIFIED` state** | **5 of 41** | `DERIVATION_AUDIT.md`; four of the five are a number a person must supply |
| **blocking-check falsification coverage** | **2 / 10 blocking CI steps** | see §3 |
| **manual reconciliation steps** | **≥ 12** | every research register's external claims, both `STRONGEST_PERMITTED_CLAIM` pairs, `PREREGISTRATION_FREEZE.json`, `FINAL_HOLDOUT_SEALED.json`, `selftest.json`, `AUTHORITY_MAP.md` — each currently reconciled only by a person reading two files |

---

## 3. Blocking CI steps, and which can demonstrate failure

`.github/workflows/verify-build.yml`, job `verify`. Every step is blocking — the job has no
`continue-on-error`.

| # | step | can it demonstrate its own failure today? |
| --: | --- | --- |
| 1 | `npm ci --no-audit --no-fund` | **no** |
| 2 | `npm audit --omit=dev --audit-level=high` | **no** — and Study v2 judged a synthetic vulnerability a dishonest control |
| 3 | `npx playwright install --with-deps chromium \|\| npx playwright install chromium` | **no** |
| 4 | `npm run check` (tsc) | **no** |
| 5 | build the database schema from `drizzle/migrations/*.sql` | **no** |
| 6 | `npm run build` | **no** |
| 7 | `npm test` | **no systematic control** — `G-10`; the repository has recorded ≥5 cases of a test passing *because of* a defect |
| 8 | `npm run gates` | **yes** — `npm run gates:controls`, 28/28 red |
| 9 | `npm run gates:controls` | **yes** — it *is* the control; its contract is that every fixture goes red |
| 10 | `npm run bundle:budget` | **no** — `G-02`, and a fixture with a deliberately oversized entry graph is buildable |

**2 of 10.** Study v2's `G-02` counted the same fact from the other side: five blocking checks
lack a proven-red control, four of them fixture-able and one (`npm audit`) where a synthetic
control would be dishonest.

---

## 4. The two verified reconciliation failures this mission must make detectable

Preserved exactly as Study v2 classified them. **They share a detection class, not a cause.**

| | `X-02` | `X-16` |
| --- | --- | --- |
| artefact | `research/b3_population_expertise/results/PREREGISTRATION_FREEZE.json` | `research/discovery-oracle/results/selftest.json` |
| the claim | `amended_sha256` says `DATA_PROTOCOL.md` is `cf263394…` | plant `one-game-only` at `delta 0.45`, `passes: false`, `passed: false` |
| the reality | the file hashes to `6560f3d7…` | `oracle/worlds.py` declares `0.22`; a fresh run gives `realised 0.2714`, `passes: true` |
| cause | a **hand-written provenance record** that stopped matching its subject | a **stale machine output** committed beside the code that no longer produces it |
| repair | not the same repair — an amendment vs a regeneration | |

Making these detectable is `TARGET 1`. **Neither is to be "fixed" before the relationship model
exists**, because a fix without a detector is a fix that cannot recur-proof anything.

---

## 5. What is load-bearing and must not move

B2 historical results · the full-account result and its failed prediction · B3 `verdict.json` ·
B3 `verdict_repaired.json` · every preregistration freeze · holdout seals · amendment records ·
failed hypotheses · all four falsification registers · reviewer artefacts · the 28 positive-control
fixtures · reversal conditions · `FIELD-REQUIRED` · `OWNER-REQUIRED` · `MEASUREMENT-BLOCKED` ·
the `experiment/n-of-1-timing-policy` branch and its preregistration.

If two artefacts look duplicative, they are **before** and **after** until lineage proves
otherwise.
