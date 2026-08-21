# What this product measures, and what it does not

This document obeys R1 as strictly as the screens do: no claim here is wider than the
measurement that produced it. Every number below is either measured and cited, or marked
UNVERIFIED.

## What this must not be read as

**This product has never been run against a real player's record.** Every number in this
document comes from synthetic data or from the test suite. Nothing here supports a statement
about anyone's chess.

Specifically, it must not be read as:

- **A claim that the product improves anyone's play.** No such measurement exists. The strongest
  statement the current build supports is about _calibration gap on recorded decisions_ — the
  distance between a player's stated confidence and the engine's verdict — and nothing wider.
- **A claim that a detected pattern is a fact about the player.** Every claim starts, and mostly
  stays, at grade `hypothesis`. A hypothesis is formed from decisions already recorded, and more
  of that same data cannot confirm it. Only a forward drill can.
- **A claim that the thresholds are correct for real players.** They were tuned against
  synthetic noise and a synthetic planted pattern. Real decision records may be differently
  shaped, and the shuffled-label control should be re-run once real data exists.
- **A rating claim.** Lichess rating trajectory is reported as context only. Rating moves for
  many reasons and n will be small.

## Primary measure: calibration gap

The distance between stated confidence and realised accuracy, bucketed by position class.

It is the one number worth optimising, for two reasons. It is a property of the player's
decision _policy_ rather than their opening knowledge — a second-order quantity, which is where
improvement actually lives. And both halves come from outside the product's own opinion:
confidence is the player's, accuracy is the engine's. The product grades neither.

    confidence 1..5, mapped to 0..1        (the player's)
    accuracy   = share of decisions costing <= 30 centipawns   (the engine's)
    gap        = mean confidence - accuracy rate

Positive gap is overconfidence, negative is underconfidence. A decision costing 30 cp or less is
counted accurate because that is inside evaluation noise at the depths this product searches;
calling it a mistake would be the product inventing a finding.

## Secondary

Centipawn loss and its trend, per phase and per clock bucket. Phase is a **heuristic**, not a
fact about the position, and the rule is fixed and stated (`shared/phase.ts`): endgame when
non-pawn material is at most 13 points, opening within the first 20 ply, middlegame otherwise.

## External, and not self-graded

Lichess rating trajectory, already available through the existing `recentGames` endpoint.
Reported as context. **Not attributed to the product.**

## The detector, and the control that set its thresholds

The single most likely failure of this product is a pattern detector that finds structure in
noise and reports it fluently. The shuffled-label control exists to catch exactly that, and it
did catch it.

The control permutes the _labels_ — clock, phase, time taken — across decisions while leaving
confidence and accuracy attached to their original decision. This destroys any real relationship
between context and calibration while preserving every marginal distribution. A detector that
still reports patterns on that data is a noise generator.

Measured, 150 shuffles per point, three seeds per record size:

| thresholds (minBucketN / minGapDifference) | n=40     | n=80     | n=120    | n=200    | n=300    |
| ------------------------------------------ | -------- | -------- | -------- | -------- | -------- |
| 12 / 0.25 — first draft                    | 53.3%    | 50.9%    | 23.6%    | 9.6%     | 0.9%     |
| 20 / 0.35                                  | 28.9%    | 14.9%    | 4.2%     | 0.4%     | 0.0%     |
| **30 / 0.45 — shipped**                    | **0.0%** | **0.2%** | **0.2%** | **0.2%** | **0.0%** |
| 40 / 0.45                                  | 0.0%     | 0.0%     | 0.0%     | 0.0%     | 0.0%     |

A planted, unambiguous pattern is detected at every setting in the table, so the stricter
thresholds cost time-to-first-claim, not sensitivity to a real effect.

GATE-SHUFFLE fails the build above a 2% worst-case rate. Measured worst case at the shipped
thresholds, across n = 40…300: **0.7%**.

The bucket list is fixed and short (`BUCKETINGS` in `shared/detector.ts`). A detector free to
invent its own splits will find one that separates any dataset, which is what finding structure
in noise means.

## Cold start — the curve, not a single number

Section 6 asks for this to be reported rather than buried, so: **at the shipped thresholds a
strong, unambiguous pattern is first reported at roughly 60–90 recorded decisions.** The first
draft would have spoken at roughly 30, and would have been wrong about half the time at that
size.

| thresholds              | first claim on a planted pattern | worst shuffled false-positive rate |
| ----------------------- | -------------------------------- | ---------------------------------- |
| 12 / 0.25               | ~30 decisions                    | 74.7%                              |
| 20 / 0.35               | ~50 decisions                    | 17.3%                              |
| **30 / 0.45 — shipped** | **~70 decisions**                | **0.7%**                           |
| 40 / 0.45               | ~90 decisions                    | 0.0%                               |

A bucket also needs 30 decisions _inside_ it and 30 _outside_, so a player whose decisions all
fall in one phase or one time band will wait considerably longer than the headline number.

**What this means in practice, stated plainly: a casual player recording a handful of decisions
per session will go weeks before this product says anything about them at all.** That is the
correct behaviour, not a defect, and it is the price of the false-positive rate in the table
above. The alternative is a product that talks sooner and is frequently wrong.

## Never

No success metric is computed by the component whose success is being measured. A drill cannot
grade the claim that generated it: `evaluateClaim` accepts a `ProspectiveDrillResult` and
nothing else, and the drill's prediction is fixed before any position is shown.

## What is currently UNVERIFIED

- **Every threshold, against real data.** Synthetic only. Re-run the shuffled-label control on a
  real record before trusting any claim the detector makes.
- **The engine's runtime behaviour in the deployed environment.** The fix is confirmed present
  in the deployed bundle and the `.wasm` is served correctly (`application/wasm`, 7,295,411
  bytes, HTTP 200), and the engine was driven successfully against a byte-identical local build
  — but the sandbox used for development cannot drive a browser against the deployed origin, so
  the deployed engine has not been observed producing an evaluation.
- **The record layer against a real database.** All record tests run against an in-memory store.
  `DATABASE_URL` has never been set in any environment this build has run in, so
  `DrizzleRecordStore` has never executed a statement against MySQL.
- **Cold start with a real player.** The numbers above assume a planted effect far stronger and
  cleaner than a real one is likely to be. Expect the real cold start to be longer.
