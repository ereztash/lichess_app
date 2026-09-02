# PRE-CONSOLIDATION HARDENING — FINAL REPORT

> ### THE SCORES HERE EVALUATE THE RECONSTRUCTION STUDY, NOT THE APPLICATION.

**Base:** `main` at `6f5577ff5fd785e9d67415bf9a3ed5868b7aaf18` (the merge of PR #63)
**Branch:** `pre-consolidation/coherence-hardening`

---

## 1. Baseline

Frozen in [`BASELINE.md`](BASELINE.md) before the first line of hardening code, alongside the
falsifier in [`HYPOTHESIS.md`](HYPOTHESIS.md).

```
Study v2 score  90.73 / 100   threshold > 95    NOT MET
WES             96.74         threshold > 95.5  MET
WES90           100.00 %
verdict         PARTIAL_REPO_NATIVE_OS
```

`D1a 10.000 · D1b 2.335 · D1c 3.979 · D2 19.833 · D3 15.000 · D4 10.417 · D5 14.167 · D6 15.000`

| secondary metric | baseline |
| --- | ---: |
| research reconciliation coverage | 0 relations checked |
| authority resolution rate | 25 / 36 |
| authority-less critical questions | 6 |
| mechanically verifiable authority | 0 / 36 |
| implementation evidence coverage | 26 / 204 |
| `L6` coverage | 0 of 264 files |
| available-derivation-but-declared gaps | 4 read sites |
| blocking-check falsification coverage | 2 of 10 |
| manual reconciliation steps | ≥ 12 |

## 2. Changes, one section per target

Full records in [`TARGET_1`](TARGET_1_RESEARCH_RECONCILIATION.md) … [`TARGET_5`](TARGET_5_FALSIFICATION.md).

**T1 · Research reconciliation.** 44 sha256 sites across 30 artefacts inventoried and classified
into 4 relation kinds by reverse-resolving every claimed hash against every tracked file. Four
predicates in `scripts/research-scan.ts`; `GATE-RESEARCH-RECONCILED`.

**T2 · Authority closure.** All 11 unresolved questions classified before anything was written.
`scripts/authority-scan.ts` holds 36 questions against the tree with three predicates;
`GATE-AUTHORITY-RESOLVED`. Five capability gaps recorded as **checked absences** rather than as six
new markdown files.

**T3 · `L6` runtime truth.** `shared/build-identity.ts` + a build-time generator; seven `L6`
assertions in `tests/deployment/`; `.github/workflows/deployed.yml` runs them on every
`deployment_status` with the control first.

**T4 · Derived-state read paths.** `learningRules()` folds each rule from its results. All four
`LearningQueue.tsx` read sites fixed at one service boundary; none of the four changed.

**T5 · Blocking-check falsification.** 12 blocking steps classified by what can honestly falsify
them; two new controls (`check:control`, `bundle:budget:control`) now blocking in CI with inverted
exits; `GATE-FALSIFICATION-INVENTORY` derives the inventory from the workflow.

## 3. Defects discovered during implementation, all preserved

| where | defect |
| --- | --- |
| `research-scan.ts` | `<doc>` compiled to `[^.]+`, which cannot match `DATA_PROTOCOL.md`; five live freeze records reported as unclassified while another predicate was checking them |
| `research-scan.ts` | a `sed` left two NUL bytes in the source; `tsc` accepted it and `grep` called the file binary |
| `authority-scan.ts` | `require()` in an ESM module. `tsx -e` tolerated it; the gate runner did not |
| `authority-scan.ts` | `Q28` was first written as `ONE_CURRENT_AUTHORITY` over two files. That answers a question about *permission* with a description of *capacity* — v1's exact mistake — and it was demoted to `PARTIAL_AUTHORITY` |
| `falsification-scan.ts` | first-substring matching classified *"Typecheck positive control"* as the typecheck, so the inventory reported a control as having a control of its own |
| `README.md` | the gate table fell behind twice, and `the-table-that-fell-behind` caught it both times — the drift it exists for, on the change that created it |
| `tests/deployment/origin.ts` | **found by the first automatic run.** `redirect: "follow"` turned a preview's `302` to an SSO login into `200 text/html`, and the suite reported *"serving a build that predates the build identity"* — confident, specific and false. A test that misnames the cause of its own failure is worse than one that fails vaguely |
| `.github/workflows/deployed.yml` | it ran automatically against protected previews, which cannot be checked without a bypass token. Restricted to production |

## 4. Controls and falsification

| control | required | observed |
| --- | --- | --- |
| `npm run gates:controls` | 31 red | **31 gates: 0 pass, 31 fail** |
| `npm run check:control` | non-zero | **exit 2**, `TS2322` |
| `npm run bundle:budget:control` | non-zero | **exit 1**, ceiling **and** eager-engine |
| `deployed-origin.control` | 3 red | **3 failed (3)** |
| the T4 disagreement fixture | red on the old read path | **1 failed \| 2 passed**, green after |
| `tests/deployment` vs a protected preview | names the redirect, not the build | **302 to vercel.com**, *"NOT a statement about the build"* |
| supersession guard, tested by hand | red when the successor stops covering | **red**, naming `DATA_PROTOCOL.md` |

## 5. Authority, before → after

| | before | after |
| --- | ---: | ---: |
| questions enumerated | 36 | **36** |
| one current authority | 25 | **30** |
| no authority at all | 6 | **5** |
| mechanically verified | 0 / 36 | **36 / 36** |

**The denominator did not move, and the registry *is* the denominator.** Of the +5: `Q25`, `Q30`,
`Q31`, `Q35` are this mission's; **`Q32` was repaired during Study v2** and is disclosed rather than
absorbed. Excluding it gives **29 / 36**.

## 6. `L6`, before → after

**0 → 1 file, 7 assertions.** Exactly what is now licensed at `L6`, against a **named build**:

served SPA routes on a cold request · entry asset MIME types · the CSP **as served**, including
`worker-src` and `wasm-unsafe-eval` · that `/api/health` answers JSON rather than the SPA fallback ·
that the served document is this application's shell.

**Not licensed:** anything about product behaviour. Nothing plays a game, commits a decision or
reads a record, and no write is ever made.

## 7. Research reconciliation, before → after

**0 → 44 sites classified; 17 checked on every run.**

`HASH_OF_TREE_FILE` 16 · `GENERATED_VALUE` 1 · `EXTERNAL_ARTEFACT` 24 (named, not silently skipped)
· `INTERNAL_DIGEST` 4.

`X-02` resolved by **supersession** (the successor already existed and nothing pointed at it);
`X-16` by **regeneration**. Same detection class, different causes, different repairs — Study v2's
distinction, kept.

## 8. Derived-state gaps, before → after

**4 → 0.** `LearningQueue.tsx` lines 15, 42, 111, 120 all fixed at `learningRules()`. `retired` is
preserved, because no fold produces it. `DERIVATION_AUDIT.md`'s five `DECLARED_UNVERIFIED` items are
unchanged: four are a number a person must supply.

## 9. Blocking checks, before → after

**2 of 10 → 12 of 12 classified, 3 with a runnable mechanism.**

`SYNTHETIC_CONTROL_APPROPRIATE` 3 · `TOOL_SELF_TEST` 5 · `NO_HONEST_SYNTHETIC_CONTROL` 2 ·
`EXTERNAL_CONDITION` 1 · `HISTORICAL_DEFECT_FIXTURE` 1.

The two that keep `NO_HONEST_SYNTHETIC_CONTROL` are `npm audit` and `npm test`, both named with what
is done instead. **`npm test` still has no systematic control** — `G-10`, unchanged.

## 10. Scientific invariance

```
results/verdict.json           IDENTICAL on re-derivation
results/verdict_repaired.json  IDENTICAL on re-derivation
```

No preregistration, seal, population, protocol, threshold or estimate modified. Every Study v2
artefact untouched. Two research files changed:

- `PREREGISTRATION_FREEZE.json` — **+4 lines, 0 values changed**;
- `selftest.json` — **regenerated**; `passed`, `plants`, `plants_off_target` moved, and `nulls`,
  `null_leaks`, `seed`, `max_z`, `games_per_record`, `records_per_world` did not.

## 11. Benchmark rerun

The frozen programs, unchanged:

```
STUDY v2 SCORE = 90.73 / 100     threshold > 95: NOT MET
```

**Identical to the baseline, and that is the mission's most useful finding.** Six of the eight
sub-dimensions read *study artefacts*, not repository state, and `D1a`/`D1b` are pinned to the
baseline commit. **No amount of repository improvement moves this number.**

Attempting to re-measure at `HEAD` makes the script **refuse**:

```
d1b_population: governance population is 207, not the 169 PROCESS_CORPUS.md classified
```

because `docs/**` and `scripts/**` now include the study's own 31 files. Re-measuring would score
the study for not classifying its own output; redefining the population is a **denominator
definition change**, which is forbidden.

**Under the strongest defensible reading** — formulas and population *definitions* frozen, the two
facts that *can* be re-measured under them re-measured:

| reading | `D1c` | `D4` | total |
| --- | ---: | ---: | ---: |
| **A** literal, every input frozen | 3.979 | 10.417 | **90.73** |
| **B** facts re-measured, definitions frozen | 3.973 | 12.500 | **92.81** |
| **B′** as B, excluding the `Q32` reclassification | 3.973 | 12.083 | **92.39** |

**All three are below 95. The threshold was not moved and no formula was touched.**

## 12. `WES`

**96.74**, unchanged: its conclusion set is Study v2's.

> **`WES` is not `P(correct)`.** It is the weight-averaged evidence strength of the conclusions the
> study chose to publish. It cannot fall when a conclusion is omitted, and it rose three times
> during Study v2 while that score fell twice.

## 13. Adversarial findings, including the unresolved

Full pass in [`ADVERSARIAL_PASS.md`](ADVERSARIAL_PASS.md). **Three landed:**

1. **the benchmark cannot see this work** — §11, not repaired, because repairing the instrument
   inside this pass destroys the comparison;
2. **`D1a`'s population rule now includes the study's own output** — the script refuses, which is
   correct and is the sharpest evidence for (1);
3. **`Q35`'s authority is prose.** WCAG 2.2 AA is a commitment no command holds the product to. The
   file says so; the attack still stands. The honest repair is an audit, outside this mission.

**Seven did not land**, each measured: nothing shrank, no question vanished, the supersession is not
a whitelist (tested by breaking it), deriving on read is provably a repair and not a semantic change,
no control fires incidentally, no history was rewritten, and 96 manual reconciliation steps were
replaced by checks that add no command a contributor must remember.

## 14. Remaining material gaps

**Outside this mission, unchanged:** no field validation; nothing shows the product changes anyone's
chess; `Home.tsx` is one 108 kB component; nothing is signed and `main` is unprotected;
`npm test` has no systematic control (`G-10`).

**Named by this mission and left open:** five capability gaps — rollback, observability, retention,
who may deploy, dependency upgrades — each with a written trigger and a check that reddens if it
silently closes. **CI runs Node 22 and Vercel serves Node 24.x**, found while writing
`SUPPORTED_RUNTIMES.md` rather than by a check.

## 15. Structural consolidation decision

| condition | met |
| --- | --- |
| 1 · no critical research reconciliation gap remains | **yes** — 44 sites classified, 17 checked, both known drifts repaired |
| 2 · authority ambiguities materially decrease | **yes** — 25→30 resolved, 0→36 mechanically verified |
| 3 · `L6` non-zero for meaningful product claims | **partly** — non-zero and standing, but the claims are about delivery, not product behaviour |
| 4 · no stale derived-state authority without justification | **yes** — 4→0; `retired` justified |
| 5 · blocking verification has honest falsification evidence | **yes** — 12/12 classified, 2 absences named |
| 6 · scientific provenance intact | **yes** — §10 |
| 7 · full verification green | **yes** — §16 |
| 8 · no P0/P1 coherence defect caused by the hardening | **yes** — none found |

# STRUCTURAL CONSOLIDATION LICENSED

**Scoped, and the scope is the point.** Conditions 1, 2, 4, 5, 6, 7 and 8 are met outright and
condition 3 is met narrowly. Consolidation is licensed **for the surfaces this pass made
mechanically reconcilable** — the research corpus, the authority map, the derived-state read paths,
and the blocking checks — because for each of those a scanner now reddens when two parts of the
repository tell different stories.

**It is not licensed for the operational surface.** Five critical questions still have no authority
because the capability behind them does not exist, and consolidating structure over an unowned
operational surface would move files whose owner is nobody.

**And the benchmark cannot be the licence.** It reads the study, not the repository, so a
consolidation decision taken on the strength of a number above 95 would be taken on evidence about
the wrong subject. The eight conditions are the licence; the score is not.

## 16. Verification, exact

```
npm run check                  exit 0
npm run build                  exit 0
npm test                       2931 passed | 33 skipped (2964)   exit 0
npm run gates                  31 gates: 31 pass, 0 fail, 0 not-measured
npm run gates:controls         31 gates: 0 pass, 31 fail -- all controls went red
npm run levels                 L1 81 · L2 85 · L3 77 · L4 5 · L5 17 · L6 1
npm run bundle:budget          within budget
npm run falsification          12 blocking steps, all classified
npm run check:control          exit 2   (required non-zero)
npm run bundle:budget:control  exit 1   (required non-zero)
deployed-origin control        3 failed (3)   (required)
tests/deployment vs production 5 passed | 2 failed -- production predates the identity
selfcheck.py                   11 predicates: 11 pass
scoring_selftest.py            7 of 7 controls hold
score_v2.py                    90.73 / 100
wes_v2.py                      96.74, WES90 100.00 %
B3 verdicts                    both IDENTICAL on re-derivation
```

**No skipped environment is reported as a pass.** The 33 skips are the database suite (26, no
`DATABASE_URL`, which CI sets) and the `L6` suite (7, no `DEPLOYED_ORIGIN`, which `deployed.yml`
sets).

---

# COHERENCE HARDENING IMPROVED BUT BELOW BAR

`90.73 → 90.73` literally, `→ 92.81` under the strongest defensible re-measurement. Below 95 either
way. The threshold was not moved, no formula was touched, and the secondary metrics — which the
mission said matter more than the aggregate — moved substantially.
