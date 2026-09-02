# Results — the whole account, and the prediction that failed

Preregistration: `docs/research/ACCOUNT_BRIDGE_FULL_PREREG.md`, frozen at commit `73dabbc`.
Report: `research/harness-account-full/prereg_report.json`.

Rungs as before: **[obs]** what the data show, **[constr]** what a variable is claimed to measure,
**[pred]** out-of-sample predictive power.

---

## 0. The answer

**`not-separable`, and the prediction failed.** [obs]

|               | predicted (frozen) |            observed |
| ------------- | -----------------: | ------------------: |
| bar           |          0.8579 pp |       **0.8632 pp** |
| separation    |          1.1583 pp |       **0.6218 pp** |
| margin        |     **+0.3004 pp** |      **−0.2413 pp** |
| outcome       |       `registered` | **`not-separable`** |
| lowest bucket | `phase-middlegame` |  `phase-middlegame` |

**The arithmetic was right and the assumption was wrong**, and the two halves came apart cleanly
enough to say which was which. The bar was predicted from 1/sqrt(n) alone and landed within
**0.0053 pp** of the truth. The separation was predicted on the assumption that the rates hold, and
it **nearly halved.**

Of the three refuters §3 declared in advance, **two fired**:

- ✅ **Outcome is not `registered`.**
- ❌ Lowest bucket changes identity — it did not. `phase-middlegame` has been last at 48, at 1,240
  and at 2,209.
- ✅ **Margin far from +0.30** — it landed at −0.24, a swing of 0.54 pp, and on the wrong side of
  zero.

## 1. What moved, and it was not the bucket the bridge names

`phase-middlegame` barely moved across a 78% increase in sample. **The runner-up came down to
meet it.** [obs]

| bucket                       |            1,240 |            2,209 |         move |
| ---------------------------- | ---------------: | ---------------: | -----------: |
| `phase-middlegame` (lowest)  | 60.24%, n=19,577 | 60.35%, n=34,905 | **+0.10 pp** |
| `standing-level` (runner-up) | 61.40%, n=11,537 | 60.97%, n=20,217 | **−0.43 pp** |

That is the whole mechanism. The registration at 1,240 did not rest on this player's middlegame
being distinctly weak — that number is as stable as anything in this study. It rested on
`standing-level` sitting far enough above it, and **969 older games pulled `standing-level` down.**

## 2. This is not a failed replication, because it was never a replication

Repeating §2 of the preregistration, because it is the sentence most likely to be dropped when this
result is quoted: **the 2,209 window contains the 1,240 window.** The 1,240 are its most recent
1,240, so roughly 56% of these decisions are the same decisions, scored by the same engine at the
same depth.

So this does not say the 1,240 reading was _wrong_. It says the registration was **a property of
that account's recent record and not of its whole record** — and that the difference between those
two things is larger than the bar the bridge applies. [obs]

## 3. The corpus is exhausted, and that turns "not yet" into "cannot"

`resolutionFactor` on this reading is **1.93**, so a gap this size would need roughly **4,256
admissible games.** This account has **2,209**, and there is no fourth window: §6 forbids one and
there is nothing left to expand into.

**This account cannot register this hypothesis.** [obs] Not "has not yet" — the required corpus does
not exist, and every game that does exist is already in this reading.

## 4. The full reading

| bucket             |      n | accurate |      SE |
| ------------------ | -----: | -------: | ------: |
| `phase-endgame`    |  2,590 |   80.42% |    0.78 |
| `clock-under-1m`   |  3,752 |   69.38% |    0.75 |
| `phase-opening`    | 15,386 |   64.26% |    0.39 |
| `standing-winning` | 18,542 |   63.78% |    0.35 |
| `standing-losing`  | 14,122 |   62.89% |    0.41 |
| `fast-under-45s`   | 45,883 |   62.71% |    0.23 |
| `standing-level`   | 20,217 |   60.97% |    0.34 |
| `phase-middlegame` | 34,905 |   60.35% |    0.26 |
| `slow-over-2m`     |  **4** |        — | too few |

59,419 decisions scored, 52,881 eligible. Runs B and C matched run A field for field, per decision,
at 120,965 positions per pass, 90.8 minutes each. [obs]

**`slow-over-2m` holds four decisions in this player's entire rated history.** [obs] Every game the
account has ever played that an import would accept, and the bucket has four. It is not waiting for
more games; there are no more games. A product that shows it as a bucket awaiting data is telling
this player something that cannot come true.

**`phase-endgame` survives a third time:** 81.6% at n=87, 81.06% at n=1,251, **80.42% at n=2,590.**
A point and a half across a 30-fold increase in sample.

## 5. The think-time gradient, at the largest sample this account can produce

| think time |      n |  accurate |
| ---------- | -----: | --------: |
| 0–1 s      | 15,421 | **71.3%** |
| 2–3 s      | 19,881 |     63.9% |
| 4–7 s      | 11,376 |     55.2% |
| 8–15 s     |  4,647 |     49.6% |
| 16–45 s    |  1,389 |     48.4% |
| 46 s+      |    167 | **42.5%** |

**28.8 points, monotone across all six bands**, inside the one bucket that holds 45,883 of 52,881
eligible decisions and reads a flat 62.71%. [obs] Still not causal: hard positions take longer _and_
are played worse (`TIME_REPRESENTATION_PREREG.md` §2.2).

## 6. The co-primary variant analysis, and the defect it uncovered

§4 named two co-primary analyses: **A**, all 2,209 games, and **B**, the 2,161 standard ones. The
answer is that **B was already inside A, and always had been.** [obs]

`gamePositions` replays SAN from the standard opening position. A Lichess `From Position` game
throws on its first move and `prepare` drops it. Checked across all three windows:

| window |         games dropped as unreadable | non-standard games | same set? |
| ------ | ----------------------------------: | -----------------: | --------- |
| 48     |                                   0 |                  0 | yes       |
| 1,240  |                                  20 |                 20 | **yes**   |
| 2,209  | 48 (47 `From Position`, 1 `Atomic`) |                 48 | **yes**   |

So the filter the preregistration demanded is **a no-op the product already performs**, and A and B
are the same reading. Verified rather than argued: with the fix below in place, `readSubset` removes
**0 readable games** and B's verdict is byte-identical to A's.

### The defect: evidence labelled by position, not by source

Finding this required a correction that the preregistration's own alignment guard forced into the
open. `runImportDiagnostic` returns one `inputs` entry per **readable** game, and every harness in
this repository paired that array with the caller's `games` **by index** — correct only while
nothing was dropped, and silently wrong from the first drop onward.

**This invalidates a paragraph in `ACCOUNT_BRIDGE_RESULTS.md` §6**, and the correction is recorded
there as well as here:

> The merged document reported that the 20 `From Position` games in the 1,240 window "contributed
> **463 eligible decisions (1.57%)**". **They contributed zero.** They produced no positions at all.
> The evidence file carried exactly 463 rows labelled with their ids, and those rows are
> standard-game decisions wearing a shifted label.

**What this does and does not touch.** [obs] The diagnostic, the verdict and every bridge outcome in
all three studies are computed from `inputs` and **never read a game id** — they are unaffected, and
the 1,240 registration stands as reported. What was wrong was the per-game _evidence_, and therefore
the §6 sensitivity check built on it: it compared a mislabelled slice, not the variant games. Its
**conclusion** happens to survive and is now provable rather than estimated — the registration cannot
depend on games that contributed nothing.

**The fix.** `ImportRunResult` now returns `keptGameIndexes`, so a row is labelled with the game it
actually came from. Both harnesses use it. `tests/client/import-run.test.ts` pins the mapping,
including the case where the _first_ game is the dropped one, which is where an off-by-one stops
being subtle and mislabels every row in the file. `run_import_harness.ts` now also records
`unreadableGames` per player — **whether the canonical six-player record was ever affected cannot be
read off `harness_report.json`, because that manifest never recorded how many games were dropped.**
It does now.

**The evidence file shipped with this run predates the fix**, so its `gameId` column must not be used
for per-game analysis. Nothing in this document rests on it: §0 through §5 come from the diagnostic,
and §6's table comes from replaying the corpus against `chess.js` directly.

## 7. What the three windows say together

|                    |              48 |        1,240 |           2,209 |
| ------------------ | --------------: | -----------: | --------------: |
| outcome            | `not-separable` | `registered` | `not-separable` |
| separation         |        1.375 pp |     1.158 pp |        0.622 pp |
| bar                |        6.985 pp |     1.145 pp |        0.863 pp |
| `phase-middlegame` |          60.25% |       60.24% |          60.35% |

**The separation fell at every step.** The bar fell faster between the first two and slower between
the last two, and the registration lived in the gap where the two curves crossed. [obs]

The series did what a preregistration series is for: each window made a number-bearing prediction
about the next, and the last one was refuted by the data rather than absorbed into a story about it.
**The most useful reading of the whole series is the one it ended on** — on this account, a bucket
that looked separable at 1,240 games was not separable over the record it belongs to.

## 8. What this does not establish

One account. The reading is **accuracy**, a proxy; no calibration gap was measured, because an import
cannot measure one and this account has recorded zero live decisions. Nothing here shows what the
bridge would do for another player at any size. And the failure in §0 is a failure of **one
extrapolation about one account** — `resolutionFactor` is not shown to be unreliable in general, only
to have rested on an assumption that 969 older games broke.
