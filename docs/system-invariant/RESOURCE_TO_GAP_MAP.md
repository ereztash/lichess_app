# Which repository asset closes which uncertainty

Mission section 26. The purpose is to stop future work rebuilding capabilities that already exist,
and to make it visible when an asset is being asked for something it cannot give.

`Evidence level` uses the repository's own ladder. A cell that says a level is a claim about what
the asset supports, not about what somebody hopes it supports.

---

## 1. The map

| Gap | Existing asset | Reused as | New work required | Evidence after this mission |
|---|---|---|---|---|
| System construct | `research/learning-v3/p3_system_invariant.py`, `side_piece_metrics` | the definition of `OwnExposure`, called rather than ported | none: `features.py` imports it | construct located, contamination-checked, board-derived, tested against hand fixtures |
| Construct did not drift | the same file | bytecode identity test | one test file | `test_features.py` asserts the running function was defined in P3's file |
| P3 result is real | `SYSTEM_INVARIANT_P3_RESULT.md` + committed corpus | reproduction target | rerun only | **`P3_REPRODUCED`**: 4,139 moves, 711 positions, M0 `0.5000` / M1 `0.5779` / M2 `0.6577`, all three intervals identical, 0 engine searches |
| Which system column matters | `PRESSURE_EXPOSURE_RESULT.md` | isolates `OwnExposure` from the 24-column block, and rejects its offensive mirror | none | exposure `+5.76 pp` in the narrow population; pressure `-0.84 pp`, CI `[-1.85, +0.20]` |
| Human cue | `HUMAN_CUE_N1_RESULT.md` (P4) | the intervention candidate and its exact Hebrew wording | replication, and a sham arm | `P4-N1-PASS`, N=1, TARGET 6/8 to 8/8; **CONTROL also 3/4 to 4/4**, which no existing asset can separate from a general attention effect |
| Natural population | `research/b3_population_expertise/src/ingest.py` | sampler, exclusions, one-side-per-game rule, per-player caps | a disjoint month | 45,296 decisions, 1,338 players, 9 bands, 2026-07-01 |
| Natural outcome definition | B3 `FEATURE_SCHEMA.md` section 9 | `quality_loss`, unchanged | none | reused verbatim; centipawns never a reported unit |
| Natural rows themselves | **none** | -- | ingest **and** scoring | B3's rows are gitignored and were never committed; regeneration was unavoidable |
| Position-difficulty controls | B3 schema sections 3-4 | `wp1`, `edge`, `gap12`, `n_near`, `ambiguity_entropy` | none | bought from the same pre-move search as the candidate list |
| Dependence-aware inference | B3's cluster-bootstrap discipline | player cluster for Test A, position cluster for Test B | none | resampling unit is never the decision |
| Scope discovery | `docs/decisions/D04-candidate-search.md` | search on derivation, freeze, judge on unseen; fixed vocabulary; no outcome-derived selector | new target and new vocabulary | scope map, section 3 of `NATURAL_GENERALIZATION.md` |
| Engine-value reuse | `research/learning-v3/cache.py` | content-addressed identity including the root set | none | `key_for` imported; new policy and node budget, so no collision and nothing recomputed |
| Compute preservation | `COMPUTE_VALUE_EXTRACTION.md` | the standing rule and its argument | a corpus in the same idiom | every value bought is preserved and findable |
| Personal baseline | `research/harness-account-full/corpus_manifest.json` | pre-exposure window | matched design, frozen | 2,209 admissible games fetched 18.6 h before the earliest possible exposure |
| Non-stationarity warning | `ACCOUNT_BRIDGE_FULL_RESULTS.md` | the reason not to use the whole account naively | none | its own failed prediction: margin `+0.3004 pp` predicted, `-0.2413 pp` observed |
| Exposure identifiability | git commit metadata on `ed7e72b` and `51aba0d` | brackets the exposure to 19 min 42 s | a recorded exposure for the next participant | bracketed, **not recorded**; see `PRE_EXPOSURE_BASELINE.md` section 1 |
| Freeze-before-analysis | `docs/learning-v3/FREEZE.json`, `verify_freeze.py`, `GATE-RESEARCH-RECONCILED` | the whole idiom | generalise the verifier, register one relation | freeze held; the verifier now takes a path instead of being copied |
| Learning lifecycle | `BEHAVIORAL_PACKET_SPEC.md` | the action-set representation to widen, not replace | conditional on the gate | see `NATURAL_GENERALIZATION.md` section 7 |
| Natural retest | `NATURAL_RETEST_SPEC.md` | architecture for the opportunity matcher | conditional on the gate | design only; nothing built unless licensed |
| Delivery | `D22-next-action-ownership.md` | derive, shadow, inspect disagreements, own | conditional on the gate | not reached in this mission |

---

## 2. What an asset was asked for and could not give

Recorded because a map that only lists successes is a sales document.

| Asset | Asked for | Answer |
|---|---|---|
| `research/learning-v3/corpus/` | natural played moves with quality labels | **cannot.** All 37,226 move evaluations are restricted to rule-class permitted sets on trigger-positive positions, across 8,399 positions whose modal candidate count is 2. `quality_loss` needs a post-move search of the position a human reached, and none was ever bought |
| B3 `data/**` | its 81,624 scored decisions | **cannot.** Gitignored at `research/b3_population_expertise/data/**/*.jsonl.zst`; only manifests are committed. Regenerable in principle from the recorded prefix and seed, at the cost of the download plus the whole scoring run |
| P4 | evidence that the cue caused the improvement | **cannot.** CONTROL items moved by the same amount as TARGET items. A sham arm is the smallest design that separates them |
| `schema.ts` | permission to record an exposure event | **cannot.** It states capacity, not permission. `Q28` is deliberately unresolved (`PARTIAL_AUTHORITY`), so mission section 15 binds this to the least persistent representation |

---

## 3. Operational debt this mission touched, classified

Mission section 25. Classified rather than fixed, because a scientific mission that turns into repo
cleanup has stopped being a scientific mission.

| Debt | Classification | Why |
|---|---|---|
| `Q28` -- what the product may record about a person | **TRIGGERED BY THIS MISSION** | only if an exposure event is persisted. It is not persisted here; the N-of-1 timestamp lives in a research artifact |
| B3 row data not committed | **BLOCKS THIS MISSION**, and was worked around | forced a fresh ingest and a fresh scoring run. Recorded so the next mission knows the cost before planning around B3 |
| A shared freeze verifier | **BLOCKS THIS MISSION** | a second copy would drift. Generalised in a commit of its own, before the freeze |
| Rollback, runtime observability, retention, deploy permissions, dependency upgrade policy | **DOES NOT BLOCK** | this mission added research scripts and documents and changed no product code path. None of these is in the way |
| The transfer-grading defect (`good move` conflated with `used the rule`) | **TRIGGERED BY THIS MISSION**, design recorded | `PRE_EXPOSURE_BASELINE.md` section 3.3 keeps policy consistency, move quality and opportunity rate as three separate outcomes. No product change is licensed until the gate says so |
