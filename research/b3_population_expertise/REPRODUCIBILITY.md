# B3 -- reproducibility record

---

## 1. B2 reproduction gate

The mission rule: B3 does not proceed until the currently documented B2 result reproduces, and a
failure is reported rather than rationalised.

**Result: B2 reproduces exactly.** Not "within tolerance" -- byte-identical.

| What | Recorded in `research/b2/` | Reproduced |
|---|---|---|
| corpus | 117 games, 3 excluded for too few clock readings | identical: same 117 game ids, same derivation/held-out halves, same recency ranks, same base clocks |
| time controls | `180+0`: 84, `300+0`: 25, `300+3`: 8 | identical |
| events | rated blitz 75, SuperBlitz Arena 34, Blitz Arena 7, Daily Blitz Arena 1 | identical |
| date range | `2026.05.28 22:13:33 .. 2026.08.29 20:07:36` | identical |
| engine | `Stockfish 18 Lite WASM`, `Threads 1`, `Hash 16`, hash cleared, depth 12 | identical |
| decisions scored | 3,067 | 3,067 |
| forced / book / eligible | 11 / 336 / 2,720 | 11 / 336 / 2,720 |
| **`evidenceSha256`** | `2b15ea0388d08073462e9071bebb8a39f1e1483c0e35c49e718d620d44044d17` | **identical** |
| `analysis.json` | -- | **byte-identical after `json.dumps(sort_keys=True)`** |
| preregistered verdict | `OBSERVATION`, Lichess encoding buckets, 13.03pp vs raw 0.00pp, null 8.16pp | identical |
| amended verdict | `OBSERVATION`, 11.76pp vs raw 0.00pp, null 5.61pp | identical |
| `repeats` / `repeatsPerDecision` / `orderIndependent` | true / true / true | true / true / true |
| `orderIndependentWithWarmHash` | false | false |
| `largestBucketShiftPp` | 1.488833746898266 | 1.488833746898266 |

The only field that moved is `clearedCostRatio` (1.4060 -> 1.4050), which is wall-clock timing on a
different machine and which `run_import_harness.ts` already documents as a ratio to read rather
than a benchmark.

**B2's four controls also reproduce**, on the reproduced evidence:

| Control | Preregistered corpus | Amended corpus |
|---|---|---|
| `--control shuffle-outcome` | `STOP-B2-B` | `STOP-B2-B` |
| `--control shuffle-time` | `STOP-B2-C` | `STOP-B2-B` |
| `--control constant-outcome` | `STOP-B2-A` | `STOP-B2-A` |
| `--control plant-signal` | `OBSERVATION` | `OBSERVATION` |

The destructive controls remove the observation; the positive control recovers it. That is what
makes B2's negative results readable, and it is the same discipline B3's C5/C6/C7 apply.

### How to reproduce the reproduction

```
npm install                                            # brings in stockfish@18.0.8 (the WASM build)
python3 - <<'EOF'                                      # newest 120 blitz games up to B2's window
import requests, re
r = requests.get("https://lichess.org/api/games/user/erez281",
                 params={"until": 1788046200000, "max": 125, "clocks": "true", "perfType": "blitz"},
                 headers={"Accept": "application/x-chess-pgn", "User-Agent": "b3-research"})
chunks = [c for c in re.split(r"\n\n(?=\[Event )", r.text.strip()) if c.strip()]
open("/tmp/erez281_b2.pgn", "w").write("\n\n".join(chunks[:120]) + "\n")
EOF
python3 research/b2/build_corpus.py /tmp/erez281_b2.pgn erez281
npx tsx scripts/run_import_harness.ts \
    --engine research/b3_population_expertise/tools/sf-wasm.sh \
    --data   research/b3_population_expertise/b2_repro
```

Two things about that recipe are worth stating, because both were reproducibility gaps found while
running it:

1. **`until` filters on the game's END time, the PGN header records its START time.** The obvious
   cutoff, one second past the newest game's `UTCTime`, silently drops that game and shifts the
   window by one at each end.
2. **`sf-wasm.sh` did not exist in the repository.** `harness_report.json` recorded
   `engineInvokedAs: "sf-wasm.sh"` while the script lived outside version control, so the record
   named a wrapper nobody could run. It is now at
   `research/b3_population_expertise/tools/sf-wasm.sh`, and it execs the **single-threaded** lite
   build -- `stockfish-18-lite-single.js` is the one whose UCI handshake answers
   `id name Stockfish 18 Lite WASM`; `stockfish-18-lite.js` answers `... Multithreaded` and is a
   different engine.

---

## 2. B3 environment

| | |
|---|---|
| primary engine | official Stockfish 17.1 Linux `x86-64-avx2`, sha256 `7fecbc0b26454b62be5e3b237b58dc5666401b56e520aeb1b0bf8f53fa8f2ef3` |
| engine options | `Threads 1`, `Hash 32`, `MultiPV 4`, `go nodes 60000`, `ucinewgame` before every search |
| python | 3.11, virtualenv `.venv-b3` |
| packages | numpy 2.4.6, scipy 1.17.1, pandas 3.0.5, scikit-learn 1.9.0, statsmodels 0.15.0, matplotlib 3.11.1, chess 1.11.2, zstandard 0.25.0 |
| B2 engine | `stockfish@18.0.8` (npm), `bin/stockfish-18-lite-single.js`, driven by `tools/sf-wasm.sh` |
| data source | `https://database.lichess.org/standard/`, HTTP range prefix, streamed, never stored whole |

Engine determinism was **measured** before any B3 data existed (`tests/test_engine_determinism.py`):
with the hash cleared, a search repeats exactly in a fresh process, does not depend on the order
positions are sent in, and does not depend on `Hash` size. Without clearing, it does not repeat --
which is why clearing is not optional.

---

## 3. Reproducing the B3 result

Everything below is deterministic: fixed seeds, a fixed engine binary, a fixed node budget and a
prefix of the public dump identified by byte count and sha256 in each period's `manifest.json`.

```
# 1. scoring (slow; the engine is the cost)
python src/score.py --period development        # then validation, final, secondary
# 2. the frozen pipeline, once per stage
python src/run.py --stage develop
python src/run.py --stage validate
python src/run.py --stage final                 # writes results/analysis_final.json
# 3. the mechanical verdict, applied before any narrative
python src/evaluate.py --analysis results/analysis_final.json --out results/verdict.json
# 4. the post-holdout C3 repair (amendment A7), and the verdict re-run unmodified on it
python src/repair_c3.py
python src/evaluate.py --analysis results/analysis_repaired.json \
                       --out results/verdict_repaired.json
# 5. the C9 engine-budget comparison
python src/c9.py --base data/validation_60k --alt data/validation_150k --out results/c9.json
# 6. figures, tables, diagnostics, report
python src/make_report.py
python src/report_diagnostics.py
python src/write_report.py                      # refuses to write if forbidden language appears
# 7. the test suite
python -m pytest tests -q
```

Step 4 asserts that everything outside the C3 block is byte-identical before and after the repair
and refuses to write if it is not. Step 6's report generator checks the finished text against the
list of phrases the preregistration (§9), Gate 2 (amendment A5) and Gate 3 (§3.6) forbid, and
raises rather than writing a report that contains one.

**What is not reproducible from this repository alone.** The four gate reviews were produced by an
independent adversary in a fresh context, read-only, and are recorded as artifacts rather than as
code: `reviews/FABLE_GATE_{1,2,3,4}_*.md`. Three numbers quoted in `REPORT.md` come from that
adversary's own reconstruction rather than from this pipeline -- the analytic predictions of the C3
null in section 2, the drift-offset table in 6.3, and the secondary-period refits in section 9 --
and each is attributed where it appears.
