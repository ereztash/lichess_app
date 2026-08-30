# Result — the engine we ship does not agree with the engine we measured

**Verdict: `STOP-B1`.** Preregistered in
[`ENGINE_PARITY_PREREG.md`](ENGINE_PARITY_PREREG.md), committed at `4be38ce` before the first
comparison was run. The outcome rule fired on its own terms; nothing here was decided after seeing
the numbers.

---

## The one number the rule turns on

| | |
| --- | ---: |
| **Δ**, the largest shift in any measurable bucket's accuracy rate | **13.6 pp** |
| T1, display resolution | 1.0 pp |
| T2, verdict resolution — the smallest separability bar on this corpus | **13.0 pp** |

**Δ > T2.** The rule says: mark every affected row as measured on an instrument that is not
shipped, do not re-tune anything, and stop the plan there.

It clears T2 by 0.6 of a point, and that is exactly why the threshold was written down first. T2 is
the **smallest** of the six players' bars, on the stated ground that a threshold holding for the
average player is one that fails for a real one. Against the mean bar (16.1) this would have
passed. The number was fixed before the run and it is not being revisited now.

The bucket: **`9f3e649e…` / `phase-opening`, n = 66, 69.7% → 83.3%.** Thirteen of its 66 decisions
changed verdict, eleven of them from inaccurate to accurate, on centipawn-loss differences between
−8 and −123. Ordinary near-threshold decisions, not artefacts.

## What was run

One pass of the product's own `runImportDiagnostic`, over the same corpus, driving
`stockfish-18-lite-single` — the build the product ships — over UCI on stdio.

| | baseline | shipped-engine run |
| --- | --- | --- |
| engine | `stockfish-ubuntu-x86-64-avx2` (native, full) | `stockfish-18-lite-single` (WASM) |
| depth | 12 | 12 |
| options | `Threads 1`, `Hash 16`, no hash clearing | identical |
| corpus | 48 games, 6 real players | identical |
| decisions | 1,587 | 1,587 |
| wall clock | — | 94 s |

**The join is exact: 1,587 to 1,587, zero rows on either side alone.** Every eligibility field —
`book`, `forced`, `phase`, `secondsTaken`, `clockMsRemaining`, `speed` — is identical on every row.
The two runs disagree about chess and about nothing else.

`standing` differs on 72 rows, and that is a consequence rather than a confound: standing is read
off the evaluation, so a different engine puts a different number of positions in each standing
bucket. Those buckets therefore move in **both** rate and population.

## The disagreement, at the decision level

| | |
| --- | ---: |
| decisions compared | 1,587 |
| **`accurate` verdict flipped** | **216 (13.61%)** |
| — inaccurate → accurate | 143 |
| — accurate → inaccurate | 73 |
| identical centipawn loss | 251 (15.8%) |
| shipped engine saw a *smaller* loss | 804 |
| shipped engine saw a *larger* loss | 532 |

**It is directional, not noisy.** Overall accuracy reads **67.0% on the native engine and 71.5% on
the shipped one — 4.5 points of systematic inflation.**

The mechanism is not mysterious. A weaker engine's best move is weaker, so the gap between the
player's move and the engine's best is smaller, so the player looks better. **The engine the
product ships flatters the player, everywhere, by about four and a half points.**

**It is not a mate-score artefact.** Nineteen decisions (1.2%) carry a centipawn-loss difference of
1,000 or more — mate scores converting differently — and they account for 8 of the 216 flips. The
other 208 are ordinary positions with ordinary differences: median |Δcp| is 14, p90 is 66.

## The disagreement, at the level a reader sees

Thirty-eight measurable buckets across six players:

| | |
| --- | ---: |
| within T1 (≤ 1.0 pp) — the screen would show the same number | **1** |
| between T1 and T2 | 36 |
| over T2 (> 13.0 pp) | 1 |

**One bucket out of thirty-eight is stable to the product's own display resolution.**

The five largest shifts:

| shift | player | bucket |
| ---: | --- | --- |
| 13.6 pp | `9f3e649e…` | phase-opening |
| 12.1 pp | `8b033ad9…` | phase-opening |
| 10.3 pp | `d4c64542…` | standing-losing |
| 10.1 pp | `d4c64542…` | standing-winning |
| 9.4 pp | `fcf1b502…` | standing-losing |

**And one bucket changed whether it can be read at all.** `fcf1b502…` / `standing-winning` had
n = 31 and was measurable on the native engine; on the shipped engine it has n = 25 and falls below
the floor. A bucket the product would have spoken about becomes one it refuses to speak about,
because of which engine was in the room.

## A second finding, from checking the baseline rather than trusting it

`research/harness/harness_report.json` reports `forced` counts of 20 / 22 / 24 / 28 / 14 / 31.
Its own evidence file contains 1 / 0 / 1 / 1 / 2 / 10 forced decisions. `onlyLegalMove` is pure
chess.js and cannot vary with the engine, so this was checked rather than explained away.

The reported figure is exactly `forced + book` on all six players. It is the **superseded
derivation** — `decisions.length - chosen.length`, which silently became "excluded for any reason"
the moment book joined forced as an exclusion, and which PR4 replaced with a direct count. The
report file predates that fix.

**It does not touch this comparison.** `eligible` reproduces exactly as `scored − forced − book` on
all six players, and every non-standing bucket has identical n in both runs, so the same decisions
entered the same buckets. But the file in the repository carries a stale number, and a record that
is checked is worth more than one that is trusted.

## What follows, and what does not

Per §5 and §6 of the preregistration:

- **Every harness-derived figure in `docs/MEASUREMENTS.md` is now labelled** with the engine that
  produced it, and with the divergence measured here.
- **B2 (time representation), B3 (MultiPV cost) and B4 (prospective effectiveness) are blocked.**
  All three were already gated on B1 in the plan, for the stated reason that choosing a
  representation from numbers a different engine produced is choosing on noise of unknown size.
  That reason is now a measurement.
- **No threshold moves.** Not the accuracy rule, not the bucket cuts, not the separability bar.
  The engines disagreeing is a fact about the record, not a licence to re-derive the product.
- **The product is not changed by this.** Nothing here says the shipped engine is wrong for the
  product — it says the *record* was not measured on it.

## What this does not say

- **Not that either engine is right.** Only that they differ. The native build is stronger and its
  evaluations are the better reference, but "better reference" is a claim about chess, and what the
  product needs is the number a *player's browser* will produce.
- **Not that the product's conclusions are wrong.** No verdict actually flipped on this corpus:
  the bars are 13.0–19.5 and the gaps 1.0–7.9 on both engines, so `worstBucketVerdict` stays silent
  either way. What is established is that the *margin* is thinner than the record implied.
- **Nothing about a different depth, the multi-threaded build, or players unlike these six.**
- **Nothing about the browser.** This ran the shipped build under Node. The wall clock, the memory
  and the behaviour of that same wasm inside a real browser tab are still unmeasured.

## The decision, and what was done about it

**The record was re-measured on the shipped engine.** That was the owner's call between the two
options §5 left open, and it is the more expensive one.

`research/harness-shipped/` is the canonical record now: `Stockfish 18 Lite WASM`, depth 12, hash
cleared before every position — the product's own configuration — over the same 48 games and six
players. 1,587 decisions, sha256 `d70998ba…`, verified. It repeats, it repeats per decision, and in
that configuration it is **order-independent**.

### The change, decomposed rather than lumped

Three of the four cells of a 2×2 exist, so "the record changed" can be split into its causes:

| | verdict flips | → accurate | → inaccurate | overall accuracy |
| --- | ---: | ---: | ---: | ---: |
| **engine** (hash held constant) | 13.61% | 143 | 73 | 67.0% → 71.5% |
| **hash clearing** (engine held constant) | 11.22% | 90 | 88 | 71.5% → 71.6% |
| **total** | **14.74%** | 153 | 81 | 67.0% → **71.6%** |

**They are different in kind, and only the decomposition shows it.** Clearing the hash moves 11% of
individual verdicts and the aggregate by a tenth of a point: symmetric, unbiased, noise. Changing
the engine moves 13.6% and the aggregate by 4.4 points, all one way: bias. Reported as one number,
"14.74% of decisions changed", the two would have been indistinguishable.

### What the re-measurement did and did not move

| | |
| --- | --- |
| largest bucket shift, old record → new | **12.5 pp** (`d4c64542…` / standing-losing, 61.1% → 73.6%) |
| buckets that stopped being readable | 1 (`fcf1b502…` / standing-winning, n 31 → 24) |
| separability bars | 13.0–19.5 → **12.3–17.8**, against gaps 1.0–7.9 → **0.6–6.3** |
| weakest-bucket verdict fires | **on none of the six**, on either engine |
| book exclusion | **124 / 7.8% on both** — a check that passed |
| order effect on the warm pair | 7.0 pp native → **6.9 pp shipped** |
| cost of clearing the hash | 1.41× native → **1.42× shipped** |

The book figure is the one worth pausing on. Book is a claim about the *position*, so a different
engine must not move it — and it did not, to the decision. A number that stayed identical across a
change this large is evidence the two runs are comparable at all.

### Three things this run corrected on its own

- **The harness published the wrong run.** Its canonical pass left the transposition table warm and
  its manifest recorded `clearHashBetweenPositions: false` as a fact about the product. Neither had
  been true since the order-dependence fix shipped. It had gone on publishing the old behaviour as
  the reading — the same class of defect it exists to find, turned on itself.
- **Provenance was the filename, not the engine.** `binary.split("/").pop()` is fine while the
  binary is the engine and worthless when it is a wrapper: this run went into its own artifact as
  `sf-wasm.sh`. The harness now takes the engine's `id name` from the handshake it already
  performs. That artifact predates the fix; the engine was verified separately as
  `Stockfish 18 Lite WASM`.
- **The README carried a figure nothing supported.** It quoted **14.3 pp** for the order effect.
  The native run over this corpus reports **7.0** (per player: 5.95, 6.90, 3.51, 7.00, 6.06, 3.90)
  and the earlier five-player corpus reported 11.81. 14.3 matched neither.

### Still unmeasured

**The browser.** This drove the shipped build under Node. The wall clock, the memory and the
behaviour of that same wasm inside a real tab remain unobserved — and the clearing cost measured
here, 1.42×, is a ratio on this machine and not a prediction about a phone.

## Reproducing it

```bash
npx tsx scripts/run_engine_parity.ts --engine <a uci binary>
```

Artifacts (all gitignored, all with recorded hashes):

| file | |
| --- | --- |
| `research/harness/decision_evidence.jsonl` | baseline, sha256 `bcfb82cc…8ce857` |
| `research/harness/decision_evidence_shipped.jsonl` | this run, sha256 `b8159913…` |
| `research/harness/parity_report.json` | per-player readings and provenance |
