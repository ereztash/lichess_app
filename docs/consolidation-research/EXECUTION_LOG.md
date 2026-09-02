# EXECUTION_LOG

Every command run against the repository in this study, and what each one established. Nothing here
modified a tracked file: the only writes were `node_modules/`, `dist/`, and pip packages, all
gitignored or outside the tree.

This log exists because `SCORING_METHOD.md` gives `DIRECT_EXECUTABLE_EVIDENCE` a strength of 1.00
against `DIRECT_AUTHORED_EVIDENCE`'s 0.90, and a confidence figure that leans on executed evidence
has to say which evidence was executed.

| # | command | result | what it establishes | conclusions upgraded to 1.00 |
| --: | --- | --- | --- | --- |
| 1 | `git rev-parse` / `git log` / `git rev-list` / `sha256sum` over the frozen artefacts | baseline recorded | `BASELINE.md` §1–§7; the `DATA_PROTOCOL.md` hash lineage | `X-02`, `X-12`, `X-15`, `L6` |
| 2 | `mcp github list_pull_requests` / `list_branches` / `actions_list` | 0 open PRs; 17 branches; last 15 CI runs `success` | `BASELINE.md` §2, §3, §6 | — |
| 3 | `mcp vercel list_deployments` | production `dpl_HG2KZ…` at `8c8b331`, `READY` | `BASELINE.md` §5 — production == `main` == working branch | — |
| 4 | `npm ci` | 355 packages | prerequisite | — |
| 5 | **`npm run gates`** | **28 gates: 28 pass, 0 fail, 0 not-measured** | every named gate runs and is green on the real tree | `L2`, `L4`, `L5`, `L8`, `L13`, `L18`, `K2`, `K3`, `K4` |
| 6 | **`npm run gates:controls`** | **28 gates: 0 pass, 28 fail — "All implemented controls went red"** | every gate has been shown to fail, for its own reason, against a deliberately broken fixture | `L4` (the core claim), `G-02` |
| 7 | **`npm run levels`** | L1 81 · L2 84 · L3 77 · L4 5 · L5 17 · **L6 0**; 264 files; **22 of 264 = 8.3%** meet something real; **0 rows claim more than their proof ran against** | the level is derived and the derivation is live; `tests/LEVELS.md`'s own counts are a dated snapshot | `L1`, `L14`, `G-07`, `X-14`, `C41` |
| 8 | `npm run check` | clean | typecheck passes on `8c8b331` | — |
| 9 | `npm run build` | built in 8.63 s; entry `index-BzTZaqLi.js` 687.04 kB / 214.45 kB gzip | the build the layout tests measure exists | — |
| 10 | **`npm test`** | **2,928 passed · 26 skipped · 262 files passed · 2 skipped · 243 s** | the suite is green at baseline; the 26 skips are the database suite with no `DATABASE_URL`, exactly the condition CI removes | `L12` |
| 11 | **`npx vitest run tests/discovery/one-byte-is-a-different-hypothesis.test.ts tests/discovery/a-claim-nothing-can-test.test.ts`** | 55 passed | `freeze()` **throws** on a too-deep conjunction and on a substituted predicate; thirteen one-change manifest variants produce thirteen distinct ids | `L7`, `L6` |
| 12 | `pip install numpy scipy pandas statsmodels pytest` | numpy 2.4.6 · scipy 1.17.1 · statsmodels 0.15.0 | prerequisite | — |
| 13 | **`python3 research/discovery-oracle/selftest.py`** | **PASSED** — ten null worlds with every bucket's `z` inside tolerance; nine plants with nominal vs realised effect printed. **It also overwrote `results/selftest.json`, which was restored immediately** (`BASELINE.md` Amendment 1) | the judge exists, runs, and validates its own null worlds *before* grading anything — **and the overwrite's diff exposed `CONTRADICTIONS.md` X-16** | `L3`, `X-16` |
| 14 | `python3 -m pytest research/b3_population_expertise/tests/ -q` (the three modules needing no `chess` package) | **34 passed, 5 skipped, 2 failed** | the two failures are `FileNotFoundError: /opt/b3/stockfish-17.1-avx2` — the determinism test **fails loudly on a missing engine rather than skipping** | `L18` |
| 15 | **`python3 src/evaluate.py --analysis results/analysis_final.json`** | **`INVALID_EXPERIMENT`, level `null`**, reason *"C3 failed: shuffled rating reproduced metric_a_time_vs_rating"* | reproduces `results/verdict.json` exactly | `L10`, `L15` |
| 16 | **`python3 src/evaluate.py --analysis results/analysis_repaired.json`** | **`GENERAL_REGULARITY_ONLY`, level 3**, β = 0.01342 [0.01243, 0.01431], the same seven failed H2 conditions | reproduces `results/verdict_repaired.json` exactly | `L10`, `L15`, `L16` narrowing (Attack 11) |
| 17 | scan of all 47 `PRODUCTION_READINESS_LEDGER.md` cycle sections for a positive-control mention | cycles 1–33: **7/29**; cycles 34–47: **14/14** | the control discipline was **learned at a datable point** and then held — the strongest single argument against "this is documentation style" | `ADVERSARIAL_REVIEW` Attack 1 |
| 18 | classification of all 169 governing files | **169/169 = 100%** | `SCORING_METHOD.md` D1 | — |
| 19 | `git log` authorship and session analysis | 328 commits over 12 days; 262 by Claude, 66 by the owner; 13 distinct session ids | `ADVERSARIAL_REVIEW` Attack 1's premise, stated against the model rather than for it | — |

## An unintended write, and what it produced

Command 13 wrote to a tracked file. `selftest.py` persists its own output to
`research/discovery-oracle/results/selftest.json`, and running it overwrote the committed version.
It was restored with `git checkout --` before anything else was done, and `git status --porcelain`
now shows only the untracked study directory. The incident is recorded as Amendment 1 in
`BASELINE.md` rather than edited out of it.

The diff it produced is the evidence for `CONTRADICTIONS.md` **X-16**: the committed artefact
records the plant `one-game-only` at `delta 0.45, passes: false`, while `oracle/worlds.py` at this
commit declares `0.22` and a re-run passes. `git log` shows both files were last written in the same
commit. The finding is stated from that diff and from `git show` of the committed version — never
from the overwritten file.

## Three results worth reading twice

**The two B3 verdicts both reproduce, in a fresh session, by a reader who did not write them.** That
is the single strongest piece of evidence in this study. It means the repository's largest scientific
claim is not a narrative about numbers — it is a program applied to numbers, and the program can be
re-run by somebody with no access to the reasoning that produced it. It also means the *preserved
failure* (`INVALID_EXPERIMENT`) is not an anecdote in a document: it is a live, reproducible artefact
sitting beside the result that superseded it.

**A generated research artefact does not reproduce from the code beside it.** X-16 is small — nothing
cites the disputed row — and it is the second verified instance of the same shape as X-02, in a
different programme, found by a different method. Two independent instances is what turns
"point `register-scan` at `research/`" from a tidy idea into the highest-ranked gap in the study.

**The B3 engine-determinism test fails rather than skips.** `/opt/b3/stockfish-17.1-avx2` is not
present in this container, and the test raises `FileNotFoundError` instead of reporting green on a
check that did not run. That is `L18` demonstrating itself, unprompted, in a research directory
written by a different pass from the one that wrote the CI workflow with the same rule in its
comments.
