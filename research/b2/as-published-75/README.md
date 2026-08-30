# The 75-game run, kept exactly as it was published

This directory is not a backup. It is the evidence for a result this repository stated in public,
and it stays here unmodified so that the corrected result can be read *against* it rather than
instead of it.

**What was wrong with it.** The corpus was built by a script that read rated-ness out of the PGN's
free-text `Event` header — `if "rated" not in event: drop("unrated")`. A Lichess arena game's Event
is `Hourly SuperBlitz Arena`, which contains no such substring, so **42 rated blitz games were
dropped and counted as unrated**. They are rated: every one carries `WhiteRatingDiff`, which Lichess
writes only for a rated game. The study ran on 75 games when 117 qualified under §3's own rule, and
`TIME_REPRESENTATION_RESULTS.md` went as far as calling the exclusion a success.

See **Amendment 3** in `docs/research/TIME_REPRESENTATION_PREREG.md`.

| file | what it is |
| --- | --- |
| `corpus_manifest.json` | the 75-game corpus, its halves and its exclusion counts |
| `harness_report.json` | the scoring run over it — 1,787 decisions, Stockfish 18 Lite WASM, depth 12 |
| `analysis.json` | the analysis, after Amendment 2's three fixes and before Amendment 3 |

The decision-level evidence (`decision_evidence.jsonl`) is not committed here for the same reason it
is not committed anywhere: it is derived from a private account's games, and `.gitignore` excludes
both it and `corpus.json`. Its sha256 is recorded in `harness_report.json`.
