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

## Two things were called "accuracy"; one of them is canonical

Both existed, both were defensible, and both were on screen under the word **דיוק**.

| | definition | where |
| --- | --- | --- |
| **accuracy rate** (canonical) | share of decisions with `cpLoss <= ACCURATE_CP_LOSS` (30) | `shared/detector.ts` |
| accuracy score | Lichess-style exponential 0-100 per move, averaged | `shared/eval-analysis.ts` |

The **rate** is canonical for anything feeding a bucket, a claim, or a calibration gap. It is a
proportion, so it is comparable with a stated confidence on the same 0..1 scale -- which is the
entire calibration measurement, and the exponential score cannot do it.

The **score** survives only inside GameReview, as a per-game display number, and is labelled
"ציון דיוק" rather than "דיוק" so the two are not read as the same quantity. It is rendered
through `Score` in Value.tsx, which cannot be called without its n.

Nothing outside GameReview may use the exponential score. It never enters a bucket.

## Layer C

**Not mounted.** `server/layerC.ts` is imported by no router, so no request can reach it and
`LAYER_C_ENABLED` changes nothing at runtime. Everything below describes the module as written and
unit-tested, not as something the deployed API can do.

Off by default (`LAYER_C_ENABLED`). It consults the Lichess masters database for at most three of
a claim's positions and returns counts, sources, and one question with a fixed shape.

It generates **no prose**. Section 7 forbids an LLM narrating engine output, and this is the
surface where that failure would be least visible and most damaging. Everything it returns is a
count, a source with its n or depth, or a fixed question that states in its own text that it is
not evidence.

A source it could not consult is **omitted**, never reported as zero: "no master games here" and
"we could not ask" are different facts.

## The drill's weakest link, stated

A drill is meant to be a FORWARD test, and positions are drawn from plies in the player's own
loaded games where no decision was recorded. That excludes positions whose engine verdict they
have already seen, which is the part that matters most -- but it cannot rule out familiarity.
They played the game. They may remember the position, or the game's outcome, and that memory is
not measurable from here.

This weakens a drill's result in one direction only: it makes a REPLICATION less trustworthy than
a refutation. A player who recalls a position is more likely to do well on it, which pushes the
measured gap DOWN, toward refuting an overconfidence claim. A replication that survives despite
that pull is the stronger of the two verdicts.

A position bank drawn from games the player has never seen would remove this. There isn't one.

## What is currently UNVERIFIED

- **Every threshold, against real data.** Synthetic only. Re-run the shuffled-label control on a
  real record before trusting any claim the detector makes.
- **This branch's own screens at a deployed origin.** The engine itself is no longer in question
  — see "What stopped being unverified" below — but that run predates everything here. The import
  scan, its progress bar and stop button, and the diagnostic table have never been rendered
  anywhere but a test environment and a headless Chromium measuring CSS boxes.
- **The record layer against a real database.** All record tests run against an in-memory store.
  `DATABASE_URL` has never been set in any environment this build has run in, so
  `DrizzleRecordStore` has never executed a statement against MySQL.
- **Any drill run by a real player.** The loop is tested over HTTP in both directions with
  synthetic decisions, and driven through a browser as far as the first drill position, but no
  drill has been completed by a person.
- **Layer C against live Lichess.** Its tests stub `fetch`. It has never made a real request to
  the masters database, and its rate-limit behaviour under repeated use is unmeasured. It is also
  not mounted: no router imports it, so nothing in the deployed API can reach it at all.
- **Cold start with a real player.** The numbers above assume a planted effect far stronger and
  cleaner than a real one is likely to be. Expect the real cold start to be longer.
- **The import diagnostic against a real Lichess account.** Every part of the path is tested with
  synthetic games and a stub engine -- PGN clock extraction, colour matching, batch scoring,
  bucketing, the screen. No real username has been searched, no real PGN scored, and the
  end-to-end wall clock on a real 20-game import has not been observed. What the tests cover is
  the logic; what nobody has watched is the run.
- **What the accuracy rate over an import actually counts.** Nearly every one of the player's
  moves, including book and any recapture that has a legal alternative. Positions offering
  exactly one legal move are now excluded and counted, but that is a small correction (see
  below) and the bulk of the inflation remains: `phase-opening` is `ply <= 20`, mostly book, so
  it stays closer to measuring recall than decisions. Separating a real choice from a
  practically-forced one needs an opening book or a second engine line per position, and the
  cost of the second is the entry below. **This is a known defect in a number currently on
  screen, not a missing feature.**
- **What a second engine line costs.** The reveal now asks for two lines from one search
  (MultiPV 2) so it can say what the engine's choice is actually worth. The two lines share a
  search tree, so the cost is somewhere between 1x and 2x a single-line search and probably
  nearer the bottom; nothing here has measured it. The design does not depend on the number --
  it is asked for on the reveal, where one position is searched, and refused in the import path,
  where 971 are, and that holds under the 2x upper bound.
- **Anything on a phone.** No measurement in this document was taken on a handset. The import is
  the case where that matters most, because it is the only screen that asks the user to wait, and
  its cost scales with a device speed nobody here has measured.

### What stopped being unverified

- **The engine runs at a deployed origin.** The oldest open finding in this project, and it was
  closed on main while this branch was in flight rather than by anything here. The in-app
  self-check answered on its first real run — Chrome 151 on Windows, ten checks, ten passes:
  WebAssembly instantiates, a Worker is constructible, both engine files arrive intact over HTTPS
  from the deployment, and Stockfish greets, reports ready and returns `bestmove e2e4` at depth 8.
  Scope, as that commit states it: the origin was a PINNED PREVIEW serving a bundle from before
  the read options landed. Every file those ten checks exercise was byte-identical at that commit,
  so the finding holds — but the argument is about those files, and it does not extend to the
  screens this branch adds.

- **Fonts are served from the deployment.** The build ships nine `@font-face` files under
  `dist/public/fonts/`, and all nine `src` URLs resolve to files that exist. Counted in the built
  output: zero references to `googleapis` or `gstatic`, zero external `<link>` elements, zero
  external `@import` rules. The only host the built JavaScript can call is `lichess.org`
  (`json-schema.org` and `react.dev` appear only inside library error strings).
- **User-reachable strings are in the app's language.** 117 Hebrew strings against three
  deliberate Latin masthead labels (`DECISION LAB`, `COMMIT · THEN REVEAL`, `STOCKFISH 18`). The
  store's English invariant messages -- `append-only: …` -- no longer reach any screen
  unmediated; ten call sites rendered them raw before this pass.

Both of those were checked against the built output rather than the source, which is the only
place the question can actually be settled.

## Engine-scored games (phase 1 of the merge)

The evaluation half of chess-mind-patterns could only read `[%eval]` comments Lichess had already
written into a PGN. These are the same measurements produced by the local engine instead, on a
PGN carrying **no annotations at all**.

Position list from `gamePositions`, each scored by Stockfish 18 at depth 12 in a browser, then
converted to White's perspective:

```
1. e4 e5 2. Nf3 Nc6 3. Bc4 Nd4 4. Nxe5 Qg5 5. Nxf7 Qxg2

[37, 41, 35, 37, 46, 15, 96, 14, -39, -407, -406]
```

Fed to the ported `analyzeEval`:

| ply | move | eval | CPL | classification |
| --- | ---- | ---- | --- | -------------- |
| 1   | e4    |   41 |   0 | best           |
| 3   | Nf3   |   37 |   0 | best           |
| 5   | Bc4   |   15 |  31 | good           |
| 7   | Nxe5  |   14 |  82 | inaccuracy     |
| 9   | Nxf7  | -407 | 368 | **blunder**    |

accuracy 45%, avg CPL 96, 1 blunder, 1 inaccuracy, `hasEvals: true`.

The game is the Blackburne Shilling trap, and the analysis names the right move: 5.Nxf7 is the
losing one, and 4.Nxe5 is the inaccuracy that walks into it. That is a chess-correct result, not
merely a plausible-looking number.

### Excluding positions that offered no choice

A position with exactly one legal move is scored accurate by every rule in this codebase --
cpLoss on a move with no alternative is whatever the engine's own line was -- and counting it
credits the player for something they did not do. Those are now excluded from every bucket and
reported separately, because netting them off silently lowers each n and a smaller n with no
explanation reads as "not enough games yet".

**Cost, measured.** The probe is a chess.js load plus move generation, no search. Over 500
positions taken from played-out games: 0.148 ms each, so about 72 ms across the ~486 player
moves of a 971-position import. Against the 43.4 s that import spends in the engine that is
**0.17% of the run**.

**Impact, measured -- and smaller than it was estimated to be.** The working estimate before
measuring was "roughly 5% of moves". In the same 500-position sample only **2 were forced, 0.4%**.
That sample was generated by random legal play, which is NOT representative: real games produce
far more checks and recaptures, so 0.4% is a floor rather than the figure. What can be said is
that the earlier 5% had nothing behind it and the one sample available does not support it.

So this is a correct exclusion of a small thing. It is not a fix for the inflated rate, and the
screen says so in the same sentence that reports it.

### The import reads two things the live record cannot

**Where the player stood.** `evalScores[ply - 1]` is the engine's verdict on the position the
player FACED, and it is already in the array the import is handed -- no extra search. The live
record has no equivalent and cannot: R3 forbids the engine speaking before a decision is
recorded, so at the moment a live decision is made there is no such number. The boundary is one
pawn in either direction, which is the unit the game is denominated in rather than a threshold
invented here; inside it the position is not clearly anyone's.

These are import-only buckets in `IMPORT_BUCKETINGS`, deliberately separate from the six shared
`BUCKETINGS` and deliberately unable to produce a claim. They ask a different question: the six
ask *when* the player decides badly, these ask *what the board looked like* when they did.
"Accurate when level, inaccurate when winning" is a finding about a decision policy that nothing
in the six could surface.

**Which time class a decision came from.** "Under 45 seconds" is not one thing across time
classes: in a 3+0 game it is most of the game, in a 30+0 game it is a move played without
thinking. An import mixing blitz and rapid put both in one bucket and reported the average of two
different questions. The clock-derived buckets now read only the dominant class, and the screen
names the class and the count it left out -- narrowing silently would drop the n and read as
"not enough games yet". Phase and standing buckets still read every game, because neither means
anything different in blitz.

The dominant class rather than a split per class, for the reason the whole document keeps
returning to: `MIN_BUCKET_N` is 30 inside AND 30 outside, and every extra dimension empties the
cells.

### What a principal variation does and does not support

`D14` on the analysis panel is the depth of the ROOT. The move at PV index `i` was chosen by a
subtree search of `14 - i` plies, so an eight-move line ends on seven. The panel rendered all
eight in one typeface, which states the opposite.

The cut applied is `remainingDepth <= 0` -- the point where the line has outrun the search that
produced it, which happens routinely because search extensions and the transposition table both
return PV moves the depth counter never paid for. No quality threshold is applied below that,
because none has been measured here: the fall-off is shown per move instead of being flattened at
a cutoff nobody can justify.

**What a PV cannot say, stated because a plausible design depended on it.** An earlier plan for
this work proposed finding "the node where the evaluation moves off the root value". That cannot
be derived from one search. The principal variation is by construction the line along which the
evaluation IS the root score -- that is what makes it principal. Locating a change would require
a fresh search at every node of the line, at the per-position cost measured above.

So the reason a move is preferred is not in its own line at all. It is in the comparison against
the move that was not played, which is why the reveal now asks for two.

**The third state that was missing.** With two lines, a difference at or under `ENGINE_NOISE_CP`
(30) is reported as a preference rather than a reason: the engine broke a tie between two moves
it does not really distinguish. The panel already said differences under 30 cp say nothing here;
it had never applied that to the move it was itself recommending.

### What a full import costs, and who pays it

Scoring one position is cheap. Scoring a player's history is not, and the import path exists
precisely to score a history: the cold start needs roughly 60-90 recorded decisions before the
detector can read anything, and the fastest way to reach that is games the player already played.

Measured on a batch import, Stockfish 18 at depth 12 in a browser:

| positions | wall clock | mean per position |
| --------- | ---------- | ----------------- |
| 971       | 43.4 s     | 45 ms             |

**Provenance, stated because it changes how much weight this carries.** These figures were
measured before this session and handed to it; this session did not reproduce them. What it did
check is that they are mutually consistent -- 43.4 s over 971 positions is 44.7 ms, which rounds
to the stated 45 ms, so the total and the mean are not two independent guesses. An instrument
check was reported alongside them. Treat the numbers as an order of magnitude that has been
observed once, not as a benchmark with a variance.

Two caveats travel with them, and the second is larger than the first:

- **Browser host.** Measured in one browser on one development machine. Stockfish's WASM build is
  sensitive to the host's threading support; a browser without `SharedArrayBuffer`, or a page
  served without the COOP/COEP headers that enable it, runs the single-threaded fallback and is
  materially slower.
- **Mobile.** Not measured on a phone at all. This is an extrapolation, labelled as one: a phone
  is several times slower than a laptop at sustained WASM work and will throttle further as it
  heats. A 43-second import on a laptop is plausibly minutes on a handset, and the app has no
  measurement to say how many. Anything that promises the user a duration is promising something
  nobody has measured.

**The design consequence, which is the reason this is written down.** `analyzePositions` reported
progress after every position -- 971 callbacks. Each one is truthful and each one is cheap; the
cost is on the receiving side, because the natural caller is a React component and the natural
thing to do with a progress value is set state. That is 971 renders on the main thread, and at
45 ms per position that thread is not idle between them: it is running the search. The progress
bar would compete with the measurement it is reporting on.

So progress is throttled at the producer (`client/src/lib/progress-throttle.ts`,
PROGRESS_INTERVAL_MS = 200) rather than left to each caller to remember, with two guarantees that
make throttling safe to default on: the first report goes out immediately, so the bar starts
moving on the first position rather than 200 ms into a 43-second wait; and the last value is
always flushed, including on abort, so the bar ends on the count the run actually reached instead
of freezing three short of the end.

### The sign convention, verified rather than assumed

UCI reports `score cp` from the side to move, so a White-relative series has to flip every other
entry. Getting it backwards would not skew the numbers slightly -- it would turn every blunder
into a best move. Checked against the engine directly on one position, White a queen up:

```
Black to move:  info depth 10 ... score cp -697
White to move:  info depth 10 ... score cp  730
```

Same position, opposite signs. `toWhitePerspective` negates when the FEN says Black is to move.
