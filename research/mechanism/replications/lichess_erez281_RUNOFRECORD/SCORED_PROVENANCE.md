# Provenance of `scored/` in this run

The engine stage of this run was **not** re-executed. `scored/part0*.jsonl` are the committed frozen
engine lines, `research/mechanism/data/scored_erez281_sf171_d12_mpv3.jsonl.zst` (Stockfish 17.1,
depth 12, MultiPV 3, Threads 1, Hash 16, hash cleared per position), re-stamped with this run's
`focal_color` and `corpus` label and partitioned across four worker files by the same modulo rule
`stage_score` uses.

Why: re-running the engine would produce the same lines at ~1.2 hours of compute, and the frozen
artifact is the one every committed erez281 number was computed from. Using it makes this run an
exact re-derivation of the published result rather than a second, differently-seeded one.

Everything downstream of the engine -- features, splits, population resolution, both discovery
passes, invariance, stability, the TEST read, the population comparison, classification and the
report -- WAS executed by this run, on the repository state named in `manifest.json`.

`raw/` and `admissible/` are a live re-fetch of the frozen 2,209 game ids through
`POST /api/games/export/_ids`, which reproduced the frozen window exactly: 2,209 admissible,
2,161 scorable, 48 excluded as `non-standard-variant` (47 `fromPosition`, 1 `atomic`).
