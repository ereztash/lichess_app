# CONTRADICTIONS

Every apparent conflict found while reading the repository as a process corpus, with the class it
falls into and the direct evidence that put it there. No contradiction is resolved by deleting
history; where the repository has already reconciled one, this file records **how**, because the
reconciliation is itself part of the operating system.

## Classes

| class | means |
| --- | --- |
| `REAL_CONTRADICTION` | two live things assert incompatible facts, and neither is scoped away |
| `DIFFERENT_SCOPE` | both are true; they answer different questions, and the scope is stated somewhere |
| `HISTORICAL_SUPERSESSION` | one replaced the other, the replacement is explicit, and the earlier one is kept on purpose |
| `NOMINAL_ONLY` | the same words, different referents, or a dated snapshot read as a current claim |
| `UNRESOLVED` | cannot be classified from the evidence available |

## Summary

| class | count | any P0? |
| --- | ---: | --- |
| `REAL_CONTRADICTION` | 3 | **no** — all three are P1 or lower; two are named in the repository's own registers and the third (`X-16`) was found by execution in this study |
| `DIFFERENT_SCOPE` | 6 | — |
| `HISTORICAL_SUPERSESSION` | 4 | — |
| `NOMINAL_ONLY` | 3 | — |
| **total** | **16** | |
| `UNRESOLVED` | 0 | — |

**No `UNRESOLVED` entries, and no critical (`P0`) `REAL_CONTRADICTION`.**

`X-16` was added after the register was first drafted, and it is the only entry found by running the
repository rather than reading it. It is kept last rather than renumbered, so the order records how
the register was built.

---

## X-01 · `LearningQueue` renders the stored grade while the service derives it

**Class: `REAL_CONTRADICTION`. Severity: P1 (bounded).**

`shared/record-service.ts` derives a learning rule's grade from the results before deciding
anything (Cycle 39), and `beginLearningTransfer` refuses on a refuted rule. `LearningQueue.tsx:111`
renders `rule.grade` — the stored enum — and `:42` computes its due state from the stored
`next_due_at`.

**Evidence.** Read directly: `client/src/components/LearningQueue.tsx` lines 15, 42, 111, 114–126.

**Why it is real and not scoped.** Both are live. A row can say `השערה` about a rule the record has
refuted until something touches it.

**Why it is not critical.** `docs/PRODUCTION_READINESS_LEDGER.md` Cycle 39 states it plainly under
*"Still open and stated plainly"*, and bounds the damage: `beginLearningTransfer` refuses with a
reason and repairs the record on the way, so the cost is a wasted click rather than a wrong
measurement. The repository knows about it and has sized it.

**What it means for the operating system.** It is the standing counterexample to `L1 derive, don't
declare` — and it is a *read-path* counterexample, which is exactly the shape `L12 a surface must
read the record, not its private copy` names. The two laws agree; the code has not caught up on one
surface.

---

## X-02 · `PREREGISTRATION_FREEZE.json`'s amended hash set does not match `DATA_PROTOCOL.md`

**Class: `REAL_CONTRADICTION`. Severity: P1 (provenance, not result).**

Three records disagree about the identity of one frozen document.

| record | `DATA_PROTOCOL.md` sha256 |
| --- | --- |
| `results/PREREGISTRATION_FREEZE.json` → `sha256` (freeze, commit `8141c5b`) | `cf263394…` |
| `results/PREREGISTRATION_FREEZE.json` → `amended_sha256` (commit `e70a0de`) | `cf263394…` |
| `results/FINAL_HOLDOUT_SEALED.json` → `document_sha256` (commit `da15833`) | `6560f3d7…` |
| the file on `8c8b331`, hashed in this study | `6560f3d7…` |

**Evidence, verified against git in this study and recorded in `BASELINE.md` §7a:**
`DATA_PROTOCOL.md` @ `8141c5b` → `cf2633949929171a`; @ `e70a0de` → `cf2633949929171a`;
@ `da15833` → `6560f3d7000de83c` (+5 −2 lines). The change landed **in the seal commit itself**.

**Why it is real.** `PREREGISTRATION_FREEZE.json`'s `amended_sha256` block is presented as the
current identity of the five frozen documents and it is stale for one of them. A reader checking
the freeze record against the tree gets a mismatch.

**Why it is not a scientific defect.** The later record — the seal, which is the one an audit reads
before the holdout is opened — carries the correct hash, and `FINAL_HOLDOUT_SEALED.json` was itself
written under an independent adversary's PASS. `results/POST_FREEZE_AMENDMENTS.md` exists precisely
to carry post-freeze changes and is *the first thing Gate 2 is asked to audit*. The mechanism
worked; one of the two records was not re-stamped.

**What it means for the operating system.** It is the standing counterexample to `L7 freeze refuses
rather than silently repairs`, and it is a *second-authority* failure rather than a freeze failure:
two records answer "what is the identity of this frozen document?" and only one was updated. That
is `L5` (one authority per question) violated inside a mechanism built to enforce `L6`.

---

## X-03 · Two `STRONGEST_PERMITTED_CLAIM` files

**Class: `DIFFERENT_SCOPE`.**

`docs/measurement/STRONGEST_PERMITTED_CLAIM.json` is `1.3.0`;
`docs/evidence-architecture/STRONGEST_PERMITTED_CLAIM.json` is `2.2.0`.

**Evidence.** 2.2.0's own field:
`"supersedes": "docs/measurement/STRONGEST_PERMITTED_CLAIM.json 1.3.0 (PR #51), for the claims it
contradicts only"`.

The scope is *in the artifact*, machine-readable, and names the PR. 1.3.0's non-contradicted claims
(the detection statement, the recording statement, the SDT arithmetic) are still current. This is
the repository's own answer to "one authority per question": the *question* is per-claim, not
per-file.

---

## X-04 · `STRONGEST_PERMITTED_CLAIM.md` and `.json`

**Class: `DIFFERENT_SCOPE`, resolved in the prose itself.**

**Evidence.** `docs/evidence-architecture/STRONGEST_PERMITTED_CLAIM.md` line 5:
*"Where the two differ, the JSON is authoritative."*

A precedence rule stated at the point of ambiguity. This is the pattern the mission's own
`PROCESS_CORPUS.md` copies.

---

## X-05 · `D20` sends `UNKNOWN` to `no-verdict`; PR #42 grades an unclassified bucket by the old rule

**Class: `DIFFERENT_SCOPE`, reconciled in `D20` by a table.**

**Evidence.** `docs/decisions/D20-protocol-matching.md`, section *"Where this node and #42 disagree
about `UNKNOWN`, and why both are right"*:

| | question | wrong answer |
| --- | --- | --- |
| #42 | may this **stored claim** ever be closed? | refusing forever — the claim never settles |
| D20 | may this **candidate** be frozen at all? | freezing it — it promises a verdict nothing can give |

`freeze` refuses an unclassifiable hypothesis *before it becomes a claim*, so the failure mode #42
found by test does not exist upstream of the freeze. The table exists, in the repository's own
words, *"so that a reader who meets both modules does not conclude one of them is a bug."*

---

## X-06 · The research arm believed cluster-robust errors while the shipped detector used decision-level

**Class: `DIFFERENT_SCOPE`, resolved by measurement in `D02`.**

**Evidence.** `research/blitz/bootstrap.py`'s `cluster_bootstrap` docstring argues for clustering;
`shared/detector.ts` counts decisions. `D02` names this as *"that contradiction is what D02 exists
to resolve"* and resolves it against the standing repair: the clustered estimator is **worse
calibrated in 82 of 84 cells** at this record size. The detector does not change; the measurement is
added and reads nothing.

---

## X-07 · `GATE-EXPOSURE-CONTEXT` is named in the laws and does not exist

**Class: `DIFFERENT_SCOPE`, enforced as a named exemption.**

**Evidence.** `scripts/register-scan.ts` `DECLARED_ABSENT = "GATE-EXPOSURE-CONTEXT"`, with two
checks around it: the exemption survives only while `INERTIAL_UX_LAWS.md` still contains the words
*"deliberately absent"*, and the scan reddens if the gate ever **is** registered and the exemption
is not dropped. Verified red in this study's positive-control run.

---

## X-08 · `D06`'s trigger fired and `D06` stays shut

**Class: `DIFFERENT_SCOPE`.**

**Evidence.** `docs/decisions/README.md`: *"D06's trigger has fired and D06 stays shut, which is a
decision rather than an oversight… D06 opens when D04's depth is settled, and that is its new
trigger."* A fired trigger replaced by a new, narrower trigger, with the argument attached.

---

## X-09 · `D23` → `D24` → `D25`

**Class: `HISTORICAL_SUPERSESSION`, with corrections applied in place.**

**Evidence.** `D23` carries a supersession block at the top naming two of its own numbers as wrong
(`47–81%` was the one-sitting figure; the null is `P(pass)²` = `9–65%`) and naming the recall
scorer as materially better than it described. `D24` supersedes `D23`'s choice of first experiment;
`D25` supersedes `D24`'s `NARROW` verdict and states explicitly that it *"amends rather than
erases"* — `D24`'s sequencing constraint, its `mayPrescribe` finding and its two pre-human gates all
survive. `docs/decisions/README.md`'s row for `D24` says it is superseded, and `D24` is not deleted.

---

## X-10 · `docs/measurement/`'s rule-class search vs `D25`

**Class: `HISTORICAL_SUPERSESSION`, scoped at the top of the superseded file.**

**Evidence.** `docs/measurement/README.md` opens with an `AMENDED 2026-09-01 by D25` block that
states exactly what is withdrawn (*reading the difference between the cells as a specificity
statistic*) and exactly what stands (*RC-06's positive cell… is a real fact about chess*), and adds:
*"Nothing below is deleted and no number below is wrong."*

---

## X-11 · The 75-game and 117-game B2 results

**Class: `HISTORICAL_SUPERSESSION`, with the loser preserved byte-for-byte.**

**Evidence.** `research/b2/as-published-75/README.md`: *"This directory is not a backup. It is the
evidence for a result this repository stated in public, and it stays here unmodified so that the
corrected result can be read *against* it rather than instead of it."*
`docs/research/TIME_REPRESENTATION_RESULTS.md` §7 prints both earlier analyses in full, unmodified.

---

## X-12 · `research/harness/` vs `research/harness-shipped/` as "the canonical record"

**Class: `HISTORICAL_SUPERSESSION`, and the two records agree about which is which.**

**Evidence.** `docs/research/ENGINE_PARITY_RESULTS.md`: *"`research/harness-shipped/` is the
canonical record now"*, sha256 `d70998ba…`. `docs/MEASUREMENTS.md` line 15 names the same directory
and the same hash. `research/harness-shipped/harness_report.json`'s `evidenceSha256` is
`d70998bac7eebd…` — checked in this study. Three records, one answer.

---

## X-13 · `PRODUCTION_READINESS_LEDGER.md` opens with a stale "Source of truth" table

**Class: `NOMINAL_ONLY`.**

It names branch `claude/mati-user-experience-components-d7549y` and PR #24, both long merged, and
`BASELINE_OID` / `CURRENT_OID` from that cycle.

**Evidence.** `docs/MASTER_PRODUCT_DEBT.md` quotes exactly this and files it as row `R-01`:
*"That staleness is row R-01, and it is the reason this file does not carry a branch header of its
own."* The supersedes table in the same file reclassifies the ledger as *"a per-cycle **history** of
defects found and closed"*, authoritative only for *"the narrative of how each closed defect was
closed"*. The header is a dated snapshot inside a history document, not a live claim.

---

## X-14 · `tests/LEVELS.md`'s counts do not match the scanner

**Class: `NOMINAL_ONLY` (dated measurement vs live derivation).**

`tests/LEVELS.md` records `246`/`248` test files and `16 of 248 — 6.5%` at rungs L4–L6.
`npm run levels`, run in this study on `8c8b331`, reports **264 files** and **22 of 264 — 8.3%**
(L1 81, L2 84, L3 77, L4 5, L5 17, L6 0).

**Why this is not a contradiction.** The document is the argument; the scanner is the authority, and
the document says so: *"The level is derived, not declared… A declaration is a comment: it can be
wrong the day it is written and stays wrong."* The prose numbers are the state at the time the
argument was made. **This is `L1` working**, not failing: the derived number moved and nothing had
to be edited for the repository to still be right about itself.

---

## X-15 · Two studies are both called "B3"

**Class: `NOMINAL_ONLY`, and it is a live naming hazard.**

`research/b3_population_expertise/` (on `main`) is the population-expertise study.
`research/b3/N_OF_1_TIMING_PREREG.md` (on `experiment/n-of-1-timing-policy` only) is an N-of-1
timing pilot. They share a label and share nothing else: different question, different design,
different subject, different data.

**Why `NOMINAL_ONLY` and not `REAL_CONTRADICTION`.** Neither asserts anything about the other, and
they have never been on the same ref, so no artifact currently mixes them. **Why it is recorded
anyway:** `L6 identity follows semantics, not labels` is a repo-native law, and this is the one place
in the tree where a label is doing work that semantics should. If the branch is ever merged, two
directories named `b3*` will sit side by side and every citation of "B3" becomes ambiguous. This is
a **consolidation hazard**, and it is listed in `REPO_NATIVE_OPERATING_SYSTEM.md` §K.

---


---

## X-16 · The oracle's committed self-test result does not reproduce from the code committed beside it

**Class: `REAL_CONTRADICTION`. Severity: P2. Found by execution, not by reading.**

`research/discovery-oracle/results/selftest.json` records, for the plant `one-game-only`:

```json
{ "plant": "one-game-only", "delta": 0.45, "realised": 0.2167…, "passes": false }
```

and carries a matching `plants_off_target` entry — a **recorded failure** of the self-test.

`research/discovery-oracle/oracle/worlds.py:419` at `8c8b331` declares:

```python
Plant("one-game-only", 0.22, _region_one_game, None),
```

**Verified by running it.** `python3 selftest.py` in this study printed
`plant one-game-only nominal +0.220 realised +0.2714 share 0.012` and **PASSED**, with
`plants_off_target` empty.

**Why it is real.** The committed artefact and the committed code disagree about a measured fact,
and the artefact records a failure the code does not produce. `git log` shows both files were last
written in **the same commit** (`34f5742`), so the artefact was produced under a `delta` of `0.45`
that the commit did not carry.

**Why it is P2 and not higher.** Nothing cites the disputed number. `D00` cites `selftest.py` for
its *null-world* finding (the generator leak), which reproduces. `D04` cites `one-game-only` for its
**0.0000 on-target rate**, which comes from `q7_candidate_search.json`, not from this file. No claim
in the repository rests on the row that disagrees.

**Why it matters anyway.** It is the exact class of defect that
`LOCAL_SOLUTION_GAPS.md` **G-04** exists to name: a generated artefact under `research/` making a
claim about the code beside it, with no scanner holding the two together. `register-scan.ts` would
catch this shape in `docs/`; nothing looks at `research/`. This is the second verified instance of
G-04's failure mode, after `X-02`, and the two were found in different programmes by different
methods.

**Handling note.** Running the self-test overwrote the committed file. It was restored immediately
with `git checkout --`, and the restoration is recorded as an amendment in `BASELINE.md`. The
finding above is stated from the diff that the overwrite produced, and from `git show` of the
committed version — not from the overwritten file.

## What was searched for and NOT found

Recorded because a concordance that only lists hits is not a search.

| looked for | result |
| --- | --- |
| a document called canonical while another answers the same question, unscoped | none — every pair found carries its scope (X-03, X-04, X-12, X-13) |
| a historical result surfaced as current | none — `MEASUREMENTS.md`, `TIME_REPRESENTATION_RESULTS.md` §7 and `evidence-architecture/CURRENT_STATE.md` all label their own history, the last one arguing explicitly for *not* sweeping the labels |
| an experiment whose label's semantics changed | X-15 only, and it is cross-ref rather than in-place |
| two documents assigning different evidence authority to one claim | none — `E`-levels are carried per node and no two nodes claim the same question |
| a workflow allowing repair during freeze while another refuses | X-02's near-miss; the B3 amendment channel is a *declared* channel with an adversary on it, not a silent repair |
| test-pass treated as sufficient where another process requires a positive control | none in the gate set (28/28 have controls); **the bundle budget is the one enforced check with no control**, recorded in `LOCAL_SOLUTION_GAPS.md` as `G-04` rather than here, because it is a gap and not a conflict |
