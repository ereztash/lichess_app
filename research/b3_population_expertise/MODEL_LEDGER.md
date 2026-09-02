# B3 -- model use ledger

Research provenance: which model did which piece of thinking, with what authority, and what came
out. Appended to as the run proceeds.

**Routing note, recorded because it is a deviation.** The mission plan asks for project-local
model-pinned subagents at `.claude/agents/`. Those files exist and carry the specified
configuration, but this session's agent runtime resolves agent types from a fixed list and does not
pick up project-local definitions mid-session. The four scientific gates are therefore dispatched
as `general-purpose` subagents with an **explicit `model: fable` override** and the
`fable-scientific-reviewer` system instructions supplied verbatim in the prompt. The model routing
the plan requires is preserved; the packaging differs. Reviewer independence is preserved too: the
reviewer runs in a separate context, is told not to optimise for a positive result, and cannot see
this session's reasoning.

| # | Timestamp (UTC) | Phase | Model requested | Purpose | Authority | Result | Artifact |
|---|---|---|---|---|---|---|---|
| 1 | 2026-09-01 20:22 | Repository audit | Opus 5 (main session) | read B2, the shared measurement layer, the engine harness, the opening book | read/write repo | dependency map established; B2 found to be a single-account study, which is B3's motivation | -- |
| 2 | 2026-09-01 20:28 | Environment | Opus 5 | install the scientific stack, obtain a deterministic engine, verify streaming access to the Lichess dumps | read/write | Stockfish 17.1 avx2 (sha256 recorded), determinism measured, 50 MB compressed to 157k games in 5s | `REPRODUCIBILITY.md` section 2 |
| 3 | 2026-09-01 20:35 | B2 reproduction | Opus 5 | rebuild B2's corpus from the public API and re-run the five-pass harness on the restored WASM engine | read/write | **exact**: `evidenceSha256` identical, `analysis.json` byte-identical, all four controls reproduce | `REPRODUCIBILITY.md` section 1, `b2_repro/` |
| 4 | 2026-09-01 20:40 | Draft preregistration | Opus 5 | hypotheses, alternatives, sample, features, VoC, outcomes, models, controls, verdict rules | write | five documents, frozen on Gate 1 PASS | `PREREGISTRATION.md` and the four beside it |
| 5 | 2026-09-01 20:46 | **Preregistration adversary** | **Fable 5.1** | attack the design before it becomes expensive | read-only, one review artifact, no code edits | see review | `reviews/FABLE_GATE_1_PREREG_REVIEW.md` |
| 6 | 2026-09-01 20:50 | Implementation | Opus 5 | ingest, sampling, engine driver, features, VoC, quality, models, controls, matching, verdict engine, figures | read/write | 5 defects found and recorded before any scientific quantity existed | `src/`, `FAILURES.md` |
| 7 | 2026-09-01 21:02 | Cost pilot (supply) | Opus 5 | games in window, candidate sides per band, decisions per side, throughput | read/write | 3,012,764 games in the DEVELOPMENT window; 115,405 distinct players; 31.7 eligible decisions per side | `results/pilot_development.json` |
| 8 | 2026-09-01 21:29 | Gate 1 verdict | Fable 5.1 | -- | -- | `PASS_WITH_REQUIRED_CHANGES`, thirteen required changes | `reviews/FABLE_GATE_1_PREREG_REVIEW.md` |
| 9 | 2026-09-01 21:35 | Apply R1-R13 | Opus 5 | repair the design before anything is scored | read/write | all thirteen applied; three of them (R5, R1a, R6) would have manufactured the headline result rather than merely weakening it | five documents, `src/`, `tests/` |
| 10 | 2026-09-01 21:45 | Cost pilot, secondary | Opus 5 | supply for `300+0` | read/write | same window, 3,012,764 games, 33.7 decisions per side | `results/pilot_secondary_300_0.json` |
| 11 | 2026-09-01 21:47 | Freeze N | Opus 5 | set acceptance rates and final N from the pilot alone | write | ~84,000 decisions and ~2,650 players per period; all nine bands adequately powered with ~2x margin | `results/SAMPLE_SIZE_FREEZE.md`, `src/rates_primary.json`, `src/rates_secondary.json` |
| 12 | 2026-09-01 21:50 | **Gate 1 re-review** | **Fable 5.1** | verify the thirteen; hunt for defects the repairs introduced | read-only, one appended section | `PASS_WITH_REQUIRED_CHANGES`: twelve of thirteen genuinely applied, nine new transcription defects (N1-N9), three of them on quantities the verdict reads | `reviews/FABLE_GATE_1_PREREG_REVIEW.md` §"GATE 1 RE-REVIEW" |
| 13 | 2026-09-01 22:00 | Apply N1-N9 | Opus 5 | repair the transcription | read/write | applied; N1 (uncentred slopes) was the R1a mechanism reintroduced at band and player level | `src/`, `tests/`, four documents |
| 14 | 2026-09-01 22:05 | DEVELOPMENT scoring | Opus 5 | ingest and engine-score the development period | read/write | running; 3,012,764 games streamed, 2,541 sampled sides, ~27 decisions/s | `data/development/` |
| 15 | 2026-09-01 22:07 | **Gate 1 third re-read** | **Fable 5.1** | verify N1-N9 and hunt for defects those repairs introduced | read-only, one appended section | `PASS_WITH_REQUIRED_CHANGES`: seven of nine applied; five new defects (M1-M5), of which M4 is the only one that is not a transcription error -- the hashed condition-6 estimator returned exactly zero on six of six simulated runs with the design's own planted gradient | `reviews/FABLE_GATE_1_PREREG_REVIEW.md` §"GATE 1 THIRD RE-READ" |
| 16 | 2026-09-01 22:20 | Apply M1-M5 and finish N1-N9 | Opus 5 | seven text edits, then the analysis-side code | read/write | applied; condition 6 now reads the raw inverse-variance-weighted per-player estimates, and shrinkage is kept for the figure | `src/`, `tests/`, three documents |
| 17 | 2026-09-01 22:26 | **FREEZE** | Opus 5 | hash the five documents | write | frozen; sha256 of each recorded with the git commit and the state of the experiment at that moment | `results/PREREGISTRATION_FREEZE.json` |
| 26 | 2026-09-02 02:08 | **Seal written** | Opus 5 | record what the seal rests on, and the expectation, before opening | write | `sealed: true`; the expected verdict (`GENERAL_REGULARITY_ONLY`) recorded before a byte of 2026-06 was read | `results/FINAL_HOLDOUT_SEALED.json` |
| 27 | 2026-09-02 02:52 | FINAL holdout scored | Opus 5 | ingest + engine, once | read/write | 81,624 decisions, 2,331 players, 2,447 games, 9/9 bands powered | `data/final/manifest.json` |
| 28 | 2026-09-02 03:40 | Secondary time control scored | Opus 5 | `300+0`, same month, frozen pipeline | read/write | 46,647 decisions, 1,336 players, 6/9 bands powered | `data/secondary/manifest.json` |
| 29 | 2026-09-02 04:05 | FINAL analysis | Opus 5 | run the frozen pipeline once | read/write | `beta` = +0.01342 [+0.01243, +0.01431], replicating both open periods; Metric B null by five readings | `results/analysis_final.json` |
| 30 | 2026-09-02 04:10 | **Mechanical verdict** | Opus 5 | apply `VERDICT_RULES.md` as written, before any narrative | read/write | **`INVALID_EXPERIMENT`**, on one control: C3's Metric A null excluded zero on FINAL only | `results/verdict.json` |
| 31 | 2026-09-02 04:20 | **Gate 3, result adversary** | **Fable 5.1** | rule on the C3 failure; attack `beta`; attack the null | read-only, one review artifact | see review | `reviews/FABLE_GATE_3_RESULT_ADVERSARY.md` |

