# Preregistration — does the engine we ship agree with the engine we measured?

Written and committed **before the first comparison was run.** B1 of `docs/ACTION_PLAN.md`.

---

## 1. The question

Every number this repository quotes about real games came from `scripts/run_import_harness.ts`.
`research/harness/harness_report.json` records what produced them:

| | |
| --- | --- |
| engine | `stockfish-ubuntu-x86-64-avx2` — a **native**, full-strength Stockfish |
| options | `Threads 1`, `Hash 16`, `clearHashBetweenPositions: false` |
| import depth | 12 |
| decisions | 1,587, over 48 games and six real players |
| evidence | `research/harness/decision_evidence.jsonl`, sha256 `bcfb82cc…8ce857`, verified intact |

The product ships **`stockfish-18-lite-single.wasm`** — a different build, with a smaller NNUE net,
single-threaded, compiled to WebAssembly.

**Nobody has checked whether the two agree.** That is the entire question. It is not a suspicion
that the numbers are wrong; it is that the record does not currently say which instrument produced
them.

### One correction to `docs/ACTION_PLAN.md`, made before the run

The plan said the product searches at depth 14. It does not. `analyzePositions` defaults to
`options.depth ?? 12`, and the import path takes that default — depth 14 is `StockfishClient.analyze`'s
default, used by other call sites. The recorded run also used 12.

This is good news for the design: **build is the only variable.** Same corpus, same code path, same
depth, same options.

## 2. What will be run

One pass of the product's own `runImportDiagnostic` over the same six players and the same 48 games,
driving `stockfish-18-lite-single` over UCI on stdio, with `Threads 1`, `Hash 16`, and
`clearHashBetweenPositions: false`.

**The hash setting matches the baseline rather than the product**, deliberately. The product clears
the hash on every search now, and that change was measured when it was made — the harness recorded
`largestBucketShiftPp: 7.0` and `clearedCostRatio: 1.41`. Folding it in here would confound two
known effects and let either one be blamed for the result. This run isolates the build.

## 3. The comparison

At the decision level, and at the level the product actually shows a reader:

1. **Verdict flips.** The fraction of the 1,587 decisions whose `accurate` differs between the two
   engines. Descriptive: it has no threshold, because a flip in a bucket nobody can read costs
   nothing and a flip in a small bucket costs a lot.
2. **Bucket accuracy rates.** Every measurable bucket, for every player: the baseline rate against
   the shipped-engine rate. This is the surface the thresholds below apply to, because it is what
   the screen renders and what every conclusion rests on.

## 4. The thresholds, derived rather than chosen

### T1 — display resolution: **1.0 percentage point**

The product renders a bucket's accuracy as a rounded percentage. A rate that moves by at most one
point changes at most one displayed digit. Below T1, a reader looking at the two runs side by side
would see the same screen.

### T2 — verdict resolution: **13.0 percentage points**

`worstBucketVerdict` tests the lowest bucket against the runner-up at two standard errors, and that
bar is the smallest difference the product will call a difference. Computed on the recorded
baseline, over the six real players:

| player | lowest bucket | runner-up | gap | bar |
| --- | --- | --- | ---: | ---: |
| `743bb0e0…` | phase-opening, n=61 | standing-level, n=39 | 2.7 | **19.5** |
| `8b033ad9…` | phase-opening, n=58 | standing-winning, n=103 | 7.9 | **16.2** |
| `fcf1b502…` | phase-middlegame, n=149 | standing-level, n=95 | 1.1 | **13.0** |
| `d4c64542…` | phase-opening, n=53 | standing-winning, n=74 | 1.0 | **17.7** |
| `9f3e649e…` | phase-opening, n=66 | fast-under-45s, n=143 | 7.9 | **13.3** |
| `4ceee8ee…` | standing-winning, n=90 | standing-level, n=55 | 1.2 | **17.1** |

**T2 is the smallest of those six: 13.0.** The smallest, not the mean, because a threshold that
holds for the average player is a threshold that fails for a real one.

Both thresholds come from the product and from data that already existed. Neither was picked to
make an outcome likely.

## 5. The outcome rule, fixed in advance

Let **Δ** be the largest absolute change in any measurable bucket's accuracy rate, over all six
players.

| | verdict |
| --- | --- |
| Δ ≤ T1 (1.0 pp) | **PARITY.** The record stands as measured. A line is added to `docs/MEASUREMENTS.md` saying the shipped engine was checked and agrees. |
| T1 < Δ ≤ T2 (13.0 pp) | **NUMBERS ARE INSTRUMENT-SPECIFIC.** Every harness-derived row in `docs/MEASUREMENTS.md` is labelled with the engine that produced it, and the shipped-engine figure is published beside it. The **conclusions** stand, because no gap this corpus can resolve could flip. |
| Δ > T2 (13.0 pp) | **STOP-B1.** Mark every affected row as measured on an instrument that is not shipped. **Do not re-tune anything.** The plan stops there until it is decided what the record is worth. |

## 6. What is forbidden

- **No threshold moves because of this result.** Not the accuracy rule, not the bucket cuts, not
  the separability bar. If the engines disagree, that is a fact about the record, not a licence to
  re-derive the product.
- **No re-running for a better answer.** One pass. If it fails for a technical reason the failure is
  reported and the run repeated; a completed pass is the result whatever it says.
- **No dropping decisions.** A position where the shipped engine cannot produce a line is reported as
  such and counted, never silently excluded.
- **No swapping the comparison** to depth, options, or a different build to find agreement.

## 7. What this cannot answer

It compares two engines on one corpus of 48 games from six players, at one depth. It says nothing
about a different depth, about the multi-threaded build, or about players unlike these six. It also
cannot tell whether either engine is *right* — only whether they say the same thing.
