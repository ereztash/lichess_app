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
