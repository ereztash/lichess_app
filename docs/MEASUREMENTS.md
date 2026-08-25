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

    confidence 1..7, mapped to .05 .20 .35 .50 .65 .80 .95   (the player's)
    accuracy   = share of decisions costing <= 2.76 points of
                 the player's winning chances                  (the engine's)
    gap        = mean confidence - accuracy rate

Positive gap is overconfidence, negative is underconfidence.

**Both halves of that changed, and the reasons are measured rather than stylistic.**

The scale ran 1..5 onto 0..1 and now runs 1..7 inset at .05/.95. A perfectly calibrated player —
one who knows their own probability of being accurate exactly, and whose only constraint is
having to answer on these levels — is read by the old scale at up to 1.50 points of gap and by
this one at 0.35, and the spread between two such players facing different difficulty streams
fell from 2.98 points to 0.60. The coarseness was the defect, not the endpoints: pulling the ends
in while staying at five levels made it *worse*. No level asserts 0 or 1, which is what makes a
logarithmic score computable at all — one stated certainty that turned out wrong made it infinite,
and infinite permanently.

Accuracy was `cp_loss <= 30`. Thirty centipawns is not one event: it costs 2.76 points of winning
chances at a level position and 0.28 at +10.00, so "accurate" meant something different depending
on how the game stood, and calibration against an event that is not one event is undefined. The
threshold is now that same 30 cp expressed as what it costs, anchored at the evaluation where the
cost peaks, so that no decision the old rule called accurate is called inaccurate by this one.

See `shared/confidence.ts`, `shared/win-probability.ts`, and the section
"The instrument, as specified" below.

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
| **accuracy rate** (canonical) | share of decisions with `winProbabilityLoss(eval, cpLoss) <= ACCURATE_WIN_PROBABILITY_LOSS` (2.76 points of winning chances, derived from the old 30 cp) | `shared/detector.ts`, `shared/win-probability.ts` |
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
- **The record layer against the database it will actually meet in production.** It is exercised
  against MariaDB 10.11 locally and MySQL 8 in CI, which is two engines and neither of them a
  Vercel-hosted managed MySQL. Connection pooling, TLS, and a cold serverless invocation reaching
  a remote host are all unmeasured; what is measured is that the SQL and the schema are right.
- **Any drill run by a real player.** The loop is tested over HTTP in both directions with
  synthetic decisions, and driven through a browser as far as the first drill position, but no
  drill has been completed by a person.
- **Layer C against live Lichess.** Its tests stub `fetch`. It has never made a real request to
  the masters database, and its rate-limit behaviour under repeated use is unmeasured. It IS now
  mounted (`external.pointer`), so the deployed API can reach it -- but it stays off by default,
  and what an enabled call actually returns from lichess.org remains unmeasured.
- **Cold start with a real player**, by either path. The numbers above and the pre-registered
  numbers below both assume a planted effect far stronger and cleaner than a real one is likely to
  be. Expect both to be longer in practice.
- **Whether a bucket an import names is the bucket the live loop would have found.** The bridge
  narrows the search on the strength of accuracy over played games. Accuracy and calibration are
  different quantities, and nothing here has checked that a player whose accuracy is worst in one
  bucket is also worst calibrated there. If they routinely are not, the bridge shortens the wait
  and points at the wrong place, and the refutation condition on every registration is what would
  eventually say so -- on a real record, which does not exist yet.
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

- **The record layer executes against MySQL.** MariaDB 10.11.14, schema built from
  `drizzle/migrations/`, `DrizzleRecordStore` writing and reading real rows: five assertions,
  all passing. Hebrew survives the round trip, a repeated `decision_id` is refused by the primary
  key rather than by a JavaScript check, and a pre-registered hypothesis round-trips including its
  per-mille rates. Before this the class had never executed a single statement.

  **It also found a defect, which is the point of running it.** Neither `listAtoms` nor
  `listDecisionIds` had an `ORDER BY`, and both are documented as returning rows "in the SAME
  ORDER". The in-memory store keeps that promise for free because a Map iterates in insertion
  order; MySQL promises nothing without an ORDER BY. `scoreDecisions` pairs the two listings by
  index, so a mismatch labels one decision's statistics with another decision's id.

  **It runs in CI too**, against a MySQL 8 service container, with the schema loaded from the
  generated SQL. The whole suite is 569 tests with a database and 564 without: the difference is
  the five that used to skip on every automated run. Two engines rather than one also says the
  store is not quietly depending on either.

  **And the first test I wrote for it did not catch that.** It compared the two listings to each
  other, and its positive control came back green: InnoDB happens to return rows in primary-key
  order, so both listings agreed anyway. The test now asserts INSERTION order against rows whose
  ids deliberately sort the other way, which is the property `prereg`'s prefix slice actually
  depends on. Both controls red, baseline green.

- **The repository can build its own schema.** There was `drizzle/schema.ts`, one hand-written
  migration for the verified-learning tables, and nothing that created the base tables --
  decisions, reveals, feedback, claims, drills. A deployment with `DATABASE_URL` set had no way to
  create what the record layer writes into, which is a large part of why nothing had ever run
  against MySQL. `npm run db:generate` now writes SQL from the schema, and all 11 tables are in
  `drizzle/migrations/`.

- **Layer C is reachable.** `server/layerC.ts` had existed for most of this project's life with no
  router importing it: nothing deployed could call it at any price, while the document you are
  reading described it as a layer of the product. Its own unit tests passed the whole time, which
  is exactly what a module's tests can be worth. It is mounted at `external.pointer` and tested
  over real HTTP, and its control -- deleting the router block -- turns all four tests red.

  Mounting it does NOT turn it on. `LAYER_C_ENABLED` is still unset everywhere, and a call
  returns `{ kind: "disabled" }` with a reason. What changed is that "off" is now distinguishable
  from "never built", which is the same distinction R2 is about.


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

## A neutral audit, and the one finding that did not close

The scores in this repository are all self-defined: gates I wrote, thresholds I chose, controls I
designed to fail. That is the right way to hold a claim, but it cannot tell you whether the thing
is any good by a standard nobody here set. So the built bundle was handed to an external tool with
its own opinions -- Lighthouse 13.4.1, whose accessibility category is axe-core 4 -- and run
against the same artifact Vercel serves.

Measured on the built bundle at `127.0.0.1:4174`, before and after the fixes, on both form factors
Lighthouse ships. Nothing here is asserted by a test; every cell is a run.

| category | mobile before | mobile after | desktop before | desktop after |
| --- | --- | --- | --- | --- |
| Performance | 82 | 84 | 100 | 100 |
| Accessibility | **85** | **100** | **81** | **96** |
| Best Practices | 100 | 100 | 100 | 100 |
| SEO | **91** | **100** | **91** | **100** |

The Performance column moved by 2 on mobile and that is not a result -- it is run-to-run variance
on a shared machine, on metrics (LCP, total blocking time) that are timing-sensitive. Nothing in
this work touched the bundle's size or its critical path. It is in the table because leaving it
out would have made the table look like it was only carrying wins.

Five findings, four closed:

- **The board was a grid with no rows** (`aria-required-children`, weight 10, plus
  `aria-required-parent` on all 64 squares -- one defect reported from both sides). `role="grid"`
  requires rows between it and its cells, and a screen reader in grid mode navigates by row, so
  there was nothing to navigate. Fixed with a `role="row"` per rank at `display: contents`, which
  generates no boxes and leaves the eight-column layout byte-for-byte as it was.
- **A placeholder that was not a colour** (`color-contrast`, weight 7). `.commitment-move.unset`
  was `opacity: 0.5`, which composites ink into surface and lands wherever the two average to:
  #e7e3d8 over #1b2124 gives #81827e, 4.21:1, under the 4.5:1 WCAG 1.4.3 asks. Replaced with
  `--muted`, a declared colour at 6.60:1. The contrast was never carrying "not chosen yet" -- the
  italic and the dashed border already do -- it was only making the text harder to read.
- **Names that did not contain their labels** (`label-content-name-mismatch`, 6 nodes). The
  confidence buttons read "1 ניחוש" but were named with an em dash between the two, and square a1
  showed "1a" while being named "a1". Both break WCAG 2.5.3 for anyone driving the UI by voice:
  they say what they see and are not understood. Fixed by removing the dash and by emitting the
  file label before the rank label -- both are absolutely positioned, so the order costs nothing
  visually.
- **`/robots.txt` was the app** (`robots-txt`, weight 1). There was no such file, and
  `vercel.json` rewrites every unmatched path to `index.html`, so the URL answered 200 with the
  SPA's markup and a crawler parsed three lines of HTML as three malformed directives. A file that
  parses as nothing is worse than none: an absent file already means "no rules". Now a real file,
  with no `Sitemap:` line, because there is no sitemap and pointing at a 404 would be the same
  defect one line further down.

**One finding did not close: `target-size` (weight 7).** It is the whole gap between 96 and 100 on
desktop, and it is written up in `client/src/index.css` above `.commitment-submit` and asserted by
`tests/client/accessibility-audit.test.ts` so that a reader who deletes the sticky to clear the
audit meets the measurements first. Two of them collide:

- Without the sticky, the submit sat at y=1302 on a 390x844 phone -- below the fold, invisible to
  a player who had just chosen a move. That is a contract in `ux-contract.test.ts`, measured on a
  shipped build. Removing it during this work measured y=1750.
- Capping the card and scrolling its fields cleared axe, and measured the submit at y=921 in an
  844 viewport, because on a phone the card starts below the board. It trades a covered control
  for an invisible one.

Nothing pinned to a viewport can avoid covering what sits at that viewport's edge, and this form
is taller than the viewport at every size measured. The finding is also wide-layout only: the same
build passes `target-size` with zero nodes at 412x823, which is why mobile reads 100 and desktop
96. What keeps it from being a trap is that the button moves against the content as the page
scrolls, so a chip it covers at one scroll position is clear at another. The real fix is a shorter
form, or a layout where the panel owns its own scrollport with the board beside it rather than
above it. Both are larger than an audit fix, and neither is done.

**What this audit does not say.** It is an automated pass, and automated accessibility checking
catches a minority of what a person using assistive technology would hit. 42 of the 66
accessibility audits came back `notApplicable` -- no video, no iframes, no data tables -- so the
category score is computed over a small surface. 100 on mobile means "nothing axe knows how to
detect", not "usable". Nobody has driven this board with a screen reader, and until somebody has,
that remains unmeasured.

## The bridge from an import to the live loop, and what measuring it refuted

The two halves of this product did not touch. The import scores hundreds of real moves and can say
where accuracy falls off; the live loop measures a calibration gap and needs roughly 65 decisions
before it may speak. The import's reading was a terminal screen that led nowhere, and the live loop
started from zero every time with six buckets to search and no idea which one mattered.

A hypothesis registered from an import is the connection. It is worth exactly one thing: the
detector may search ONE bucket instead of six.

### The proposal was wrong, and the sweep is what said so

The design was argued from multiple comparisons: six chances to clear a threshold should need a
higher bar than one, so naming a bucket in advance should buy a lower **gap**. Measured against
shuffled labels, worst case over all six possible pre-named buckets:

| thresholds | one pre-named bucket | six-bucket scan |
| --- | --- | --- |
| n=30, gap 0.45 | 0.7% | 0.7% |
| n=30, gap 0.40 | 2.7% | 2.7% |
| n=30, gap 0.35 | 3.3% | 3.3% |
| n=30, gap 0.30 | 8.7% | 9.3% |

The two columns are the same. The six bucketings are **not** six independent tests: the three
phase buckets partition the same decisions and the two clock buckets overlap heavily, so there was
never much multiplicity to correct for. Pre-registration buys nothing on the gap axis.

### What it does buy, holding the gap fixed at 0.45

| minBucketN | one pre-named bucket | six-bucket scan |
| --- | --- | --- |
| 30 | 0.7% | 0.7% |
| 25 | 1.3% | 2.0% |
| **20 — shipped** | **1.3%** | **2.7%** |
| 15 | 5.3% | 6.0% |

At n=20 the six-bucket scan is **over** the 2% ceiling and the pre-named bucket is under it. So the
restriction is not a formality attached to a threshold someone wanted anyway — it is the only
reason that row is allowed to exist. Both halves are asserted in `tests/shared/prereg.test.ts`,
including the half that says the wide scan fails there.

Measured cold start on a planted pattern, 20 seeds: **median first claim moves from 65 decisions to
45**, detected in 20 of 20 under both.

### The constraints, each of which is load-bearing

- **It never predicts a direction.** The import has no confidence data — nobody was asked during a
  game already played — so it cannot know whether the player is over- or under-confident anywhere.
  It names WHERE to look. The refutation condition says so in as many words, and a test asserts the
  text contains "not what will be found there" and contains no directional claim.
- **`decisions_before` comes from the store, never from the caller.** A caller that could choose
  the boundary could choose zero, and the hypothesis would be tested on the decisions that
  suggested it. The service reads the count itself; the field is not validated on the way in, it is
  discarded.
- **Only the six shared buckets can be registered.** The import's three standing buckets read the
  engine's verdict on the position the player faced, which the live record structurally cannot have
  — R3 forbids the engine speaking before a decision is recorded.
- **A bucket that is merely the lowest of six is not registrable.** The bar is the existing
  two-standard-error separation test. Registering a coin flip would be worse than having no bridge,
  because it would carry the authority of a pre-registration.
- **Exactly one search runs at any record size.** The narrowing applies only while the record is too
  small for the ordinary scan; past `MIN_BUCKET_N * 2` revealed decisions the six-bucket scan runs
  over the whole record and the hypothesis stops filtering anything. Running the narrowed search and
  then falling back to the wide one would be two chances to clear, and the 1.3% and 0.7% above are
  each for one search. It also means a hypothesis cannot suppress a finding forever.

Five positive controls, each red: lowering the pre-registered gap, making `detect` ignore the
bucket restriction, letting the caller set the boundary, never handing back to the wide scan, and
making import-only buckets registrable.

### What this does not fix

The imported accuracy rate still counts opening book and every recapture with a legal alternative,
so the bucket an import names is named on a partly inflated number. That defect is unchanged and is
recorded above. And nothing has checked that the bucket where a player's accuracy is worst is the
bucket where their calibration is worst — those are different quantities, and the bridge assumes a
relationship between them that no measurement here supports. Every registration states the condition
that would refute it, which is the mechanism by which a real record would eventually say so.

## The funnel, measured by driving the built app

The three fixes below came from running the shipped bundle in a browser and counting, not from
reading the source. What was measured, on the build at the time:

- **6 interactions from a cold open to a recorded decision** on a 390x844 phone: two board taps,
  one read chip, one unknown chip, one confidence, one submit. No account, no sign-in, and the
  screen says so. Nothing about the activation path needed fixing.
- **The loop strip opened on "another 60 revealed decisions"** and the import that cuts that floor
  to 40 sat in the tool rail with nothing anywhere connecting the two.
- **The page is 2104px on a phone**, 2.5x the viewport.
- **The deployment is behind Vercel SSO** (`ssoProtection: enabled, all_except_custom_domains`),
  so the first stage of any funnel is closed to everyone outside the Vercel team. Unchanged: that
  is the owner's decision, not a defect.

### One proposed fix was refuted by the repository

The first reveal after a player's first-ever decision leads with the heading "what cannot be
inferred from this". That reads as a disclaimer at the moment of first success, and the proposal
was to reorder it.

`tests/client/reveal-order.test.tsx` already forbids exactly that, and says why: section 4.2's
ordering is load-bearing, and **the spec names inverting it as the single most likely thing to do
quietly while making the screen look better.** Six assertions pin the order. The observation may
still be right; the remedy is prohibited, for a reason written down before it was proposed. Not
built.

### What was built

- **The wait names the shortcut.** The strip now says an import *can* shorten the wait, *if* one of
  its buckets separates from the next. Stated as a condition because most imports will not produce
  one, and the offer disappears once a hypothesis is registered -- repeating it would ask the
  player to solve a problem they already solved.
- **The scan states its cost and its payoff before the button.** Both facts existed and both
  arrived too late to inform the decision: the duration rendered only inside the progress block,
  after the wait had started, and what a scan buys was never on that screen at all. The duration is
  quoted from the one measurement here (971 positions, 43 seconds, one laptop) rather than
  extrapolated per game, and it says the phone is unmeasured instead of inventing a multiplier.
  Both floors come from the constants, so the sentence cannot drift from the detector.

### A defect the bridge introduced, found by re-reading it

`currentClaim` was taught to narrow the search -- one bucket, floor 20x2, counted from the import
onward -- and the strip that reports the distance was not. It went on subtracting the whole record
from 30x2, so it would have announced a 60-decision wait while the detector ran a 40-decision one
over a different set of decisions. Two surfaces disagreeing about the same record.

`ClaimView` now carries `preregScored`, and the arithmetic moved next to the thresholds it uses
(`remainingBeforeClaim`). Both halves change together: taking the narrowed floor while still
counting the whole record would understate the wait, and the opposite would overstate it.

### A second contrast defect, in the same class as the audit's

`.import-progress-note` was `rgba(var(--ink-rgb), 0.6)` -- the same "an alpha is not a colour"
pattern the audit fixed on `.commitment-move.unset`. Measured: **light theme #717670 over #f7f3e9,
4.19:1**, under the 4.5:1 WCAG 1.4.3 asks. Dark passes at 5.41:1, which is why the Lighthouse run
never reported it -- that audit ran in dark. An automated pass in one theme is not a pass.

Nine positive controls, each confirmed red: the import unnamed in the wait; the offer turned into a
promise; the offer repeated after registration; the alpha restored on the import notes; the old
whole-record floor restored; an unreadable record reporting zero instead of unknown; the cost note
moved below its button; the failure case dropped from the payoff; and the floors hardcoded instead
of read from the constants.

## The cold start's real cost, and the number that turned out not to matter

The last audit named "roughly 360 interactions before the first claim" as the highest-return thing
to reduce: 60 decisions at six taps each. Both halves were then measured in a browser, and the
conclusion did not survive.

**Six taps cost 326 ms.** Two board taps, a read chip, an unknown chip, a confidence, a submit —
timed on a 1440x950 build. Across a whole 40-decision cold start that is about thirteen seconds of
mechanical tapping. Cutting it by a third would save four seconds spread over weeks.

**The engine is not the bottleneck either.** Six consecutive decisions, submit to reveal:

| decision | submit → reveal |
| --- | --- |
| 1 | 1951 ms |
| 2 | 502 ms |
| 3 | 320 ms |
| 4 | 301 ms |
| 5 | 277 ms |
| 6 | 214 ms |

Steady-state median 301 ms. Over 40 decisions that is roughly twelve seconds of engine wait in
total. **The whole 1.65-second difference is the first decision**, and it is the worker booting:
7 MB of wasm fetched and instantiated plus the UCI handshake, previously done lazily inside the
first `analyze` call — which is to say, after the player's first ever commit.

So the cost of the cold start is neither the taps nor the engine. It is 40 decisions' worth of
concentrated thinking, and that is the product rather than a defect. **The 360 was the wrong number
to optimise, and naming it was a mistake made by counting interactions without timing them.**

### What the measurement did support

Warming the worker when a move is put on the board, so the boot overlaps the read and the
confidence instead of following the commit. Measured on one build, four runs each, first decision:

| thinking window after the move is chosen | first submit → reveal |
| --- | --- |
| none | 939, 920, 1098, 923 ms — median ~931 |
| two seconds | 518, 522, 562, 549 ms — median ~536 |

The 395 ms between those two rows is the warm's window effect and is a controlled comparison: same
build, same script, only the pause differs. Against the 1951 ms measured before the change the
total gain is roughly 1.0–1.4 s, but **that comparison spans a rebuild and is not a controlled
A/B** — it is quoted as an order of magnitude, not as a result.

**R3 is untouched, and the distinction is the entire point.** `start()` posts exactly one message,
`uci`. `go` — the command that begins a search — is posted only from `search()`, which the warm
path never calls. No position is sent, so there is nothing the worker could have searched, and no
evaluation exists that could reach a screen or a record before the decision is written.
`tests/client/engine-warm.test.ts` asserts all three on the messages that actually cross to the
worker, because "warm the engine early" is precisely the shape of change that erodes R3 and a
comment would not hold it. Three controls, each confirmed red: a `go` added to the boot path, a
`position` added to it, and the boot made non-idempotent.

### What was refused

Pre-filling the two read chips from the previous decision would have cut six taps to four.
`emptyDraft` forbids it in as many words: *"Nothing preselected, deliberately. A default read is
the machine stating one on the player's behalf and then measuring them against it."*

The detector never reads `known` or `unknown`, so no claim could have moved — the argument for
doing it anyway was available. It was refused on the stronger ground: Layer A is the only thing in
this product that is ever true, and carrying a read forward makes the record say the player stated
something at a ply where they only failed to change it. Two taps are not worth that, and the taps
were measured at 326 ms for all six.

## The two heuristics this product scored zero on

A UX review against Nielsen's ten usability heuristics found eight in reasonable shape and two at
zero. Both are the kind a product omits when it is built by someone who already knows how it works:
an exit is only obviously necessary to a person who wanted one, and an explanation is only
obviously missing to a person who did not have it.

### 3 — user control and freedom

`DrillRunner` rendered its only exit at `stage === "done"`. A drill is a fixed set of positions, so
starting one — by accident, or on a phone about to run out of battery — committed the player to
finishing every position or abandoning the tab. It was the one control in this product a player
could not leave.

The exit now renders during `briefing` and `running`, and carries two sentences because leaving is
worthless if the player is guessing what it costs:

- **It does not grade the claim.** `ProspectiveDrillResult` has `predicted` and `observed` and no
  third state. Seven positions of twenty is not the bounded set R5 registered in advance, and
  inventing an "abandoned" verdict would let a partial drill move a grade.
- **The decisions already recorded are kept.** They were taken under the same commit-before-reveal
  protocol as any other and the record is append-only. A player who believes leaving erases their
  work will sit through a drill they wanted to leave.

Zero and non-zero say different sentences: telling someone their 0 decisions are safe is noise.

**What was NOT built, and why.** Undo on a committed decision. The record is append-only and that
is the foundation, but the real objection is sharper: the reveal follows the commit by about 300 ms
(measured), so any correction window opens *after* the engine has spoken. A player who could
disown a decision at that point would be disowning the ones that turned out badly, and the
calibration gap — the product's only claim — would be computed over a set the player curated after
seeing the answer. The forced-move exclusion is safe because the position decides it; a self-declared
mis-tap is not. Not built, and the reason is recorded here rather than left as an absence.

### 10 — help and documentation

There was none. "Calibration gap" was defined in exactly one place, `RecordDashboard`, reached only
once there is a record worth looking at — the explanation arrived after the thing it explains.

`WhatThisIs` is reachable from the header at any time. Not a tour, not a dismissable coach-mark, no
"got it" that records progress: it renders identically every time it opens, because a help screen
that changes with how far along you are is managing the reader rather than informing them. It
explains what is measured, why the engine stays silent, and why the wait is what it is — quoting
both floors from the constants so the page cannot drift from the detector.

Two sections a help page normally omits:

- **What this will never say** — no score, no rating, no streak, no recommendation, no self-grading.
  Each line is a refusal enforced somewhere in the code, published to the person it protects.
- **What is still unverified** — that nobody has completed the loop, that the thresholds were tested
  against synthetic records, and that the imported accuracy rate is inflated by book moves and
  recaptures. That last is a known defect in a number currently on screen, and the page that
  introduces the product is the right place to say so.

Five positive controls, each confirmed red: the exit restricted to `done` again; the note claiming
decisions are deleted; the zero and non-zero sentences collapsed into one; the help floors
hardcoded instead of read from the constants; and the "nobody has completed the loop" admission
removed.

### Checked and found already present

`:focus-visible` was listed as unexamined in the review and turned out to be implemented, including
a distinct treatment for `.board-square`. The gap was in the review, not the product.

## Two reports about attention, and what measuring them found

Both were about weight rather than content, and neither was fixed by removing anything. The board
still shows thirty-two pieces; the panel still offers all eighteen reads, in the player's own
words, at the full tap floor.

### "The black pieces are filled and the white ones hollow"

Reported as taking longer to notice, and as possibly costing attention. It does: a hollow rook and
a solid rook are two shapes to learn for one piece. The Unicode chess block pairs an outlined glyph
with a filled one, and the shipped table used the pairing as the font intended it — it was a
property of the font, not a decision anyone made here. No physical set and no major board does it
that way.

Both colours now use the filled glyph. Measured, all eight (piece, square, theme) cells, from the
declared tokens:

| | white on light | white on dark | black on light | black on dark |
|---|---|---|---|---|
| light theme | **1.37** | 6.71 | 11.36 | **2.32** |
| dark theme | **1.86** | 7.03 | 8.18 | **2.16** |

The two bold columns are effectively invisible as fills, and always were — on a matching square the
eye traces the outline ring, in the old hollow rendering as much as this one. Going solid changes
none of those eight numbers. What it removes is an asymmetry where the hollow shape was the one
sitting on its worst-contrast square.

**A defect this measurement found, unrelated to the report.** The black piece on a dark square is
the weakest cell on the board and had *both* channels weak at once: fill 2.32 with a ring at 2.04
(light theme), fill 2.16 with a ring at 2.17 (dark). Nothing had ever measured it. The two ring
alphas are now set from the measurement — `--piece-dark-shadow` 0.3 → 0.5 and 0.18 → 0.45, putting
the ring at 3.07 and 3.05 — and the rule is asserted as *fill **or** ring above 3:1, per cell*,
because demanding a strong ring where the fill already measures 6.71 would draw a halo round a
piece nobody was struggling to see.

**The side-effect, stated plainly.** With a shared silhouette, colour is the only visual channel
separating the sides. That is a lightness difference (15.55:1 between the fills), not a hue one, so
it survives colour blindness and greyscale — which is why chess sets have always been allowed to do
it. It does not survive a screen reader, but that was already true: a square's `aria-label` is its
coordinate and never named the piece.

### "The side you mark the decision on is too flooded with information"

Measured on the built panel in Chromium at 1440×950 — it is a 330px column:

| | before | after |
|---|---|---|
| distinct font sizes | **10** | **5** |
| `opacity` values dimming text | **9** | **0** |
| elements carrying a border or fill | 28 | 25 |
| read chips / rows they wrap into | 18 / 9 | 18 / 8 |
| panel height (desktop / phone) | 1021px / 947px | 976px / 935px |
| text nodes / words | 39 / 154 | 39 / 154 |

Nothing was hidden and nothing was reworded — the last row is the point. Ten font sizes across
330px (8.96, 9, 10, 10.24, 11, 11.68, 12.16, 14.72, 16, 16.32) is not a hierarchy; it is ten things
each claiming to be slightly more important than the last, and the eye ranks none of them. Nine
opacities is the same disease in colour: nine greys nobody chose. The replacements are five sizes,
each with a job, and three declared colours — `--ink` is what the player reads, `--muted` is
context, `--warn` is a problem.

**The chips.** The border was the worst of both things: at `rgba(var(--ink-rgb), 0.28)` it measured
1.78:1 against the panel in the light theme and 2.24:1 in the dark — already *under* the 3:1 WCAG
1.4.11 asks of a control boundary, while still being numerous enough to read as a wall. It bought
no conformance and cost all the clutter. Raising it to 0.50 would have conformed by drawing
eighteen stronger boxes. A declared ground carries the chip instead, and what conforms is the thing
1.4.11 actually asks of a toggle — that its two states separate: `--blue` against `--chip` measures
5.21:1 light and 5.02:1 dark.

**What was NOT done.** Half the options behind a "more" control, and shorter labels. Both trade a
real cost — what a player can say about a position, and what the record then holds — for a visual
one. Weight was the only thing free to change, and a test asserts the chips are neither sliced nor
gated.

**Seven contrast failures this found, all pre-existing.** axe-core 4 at 1350×940 with the panel
open, light theme: the kicker at 4.47, the character counter at 3.63, the blocked-summary at 3.79,
and the required mark and field hint at 4.24 and 4.37 — those last two because a legend at
`opacity: 0.86` dimmed children that were already dimmed once. All seven were live before this work
and none had ever been seen, because every earlier axe run in this repo was **dark-theme only**,
where the same nine alphas happen to land above the line. Re-measured after: zero violations, both
themes.

**A design decision reversed by a test.** The type scale was scoped to `.commitment-screen` first,
which reads better and is wrong: `PreregisterBridge` renders `.commitment-error` outside that panel,
where a scoped token resolves to nothing and the paragraph would have lost its size silently — the
`--edge: var(--edge)` failure in a new shape. `theme-tokens.test.ts` caught it. The scale is a
`:root` token, and the reason is asserted rather than left in a comment.

Twenty-two positive controls, each confirmed red.

## A constant rendered nine times as though it were data

The first real reading this app has produced came from its owner scanning 20 of his own Lichess
games: **554 decisions, 9 buckets, 3 excluded as forced.** No bucket separated from the next by
more than its own sampling error, so the screen correctly declined to name a weakest one. That part
worked. What the reading exposed was the table around it.

`ImportDiagnostic` rendered `פער כיול — לא נמדד` inside **every** `li`, and
`.import-diagnostic .bucket-absent` gave it `grid-column: 1 / -1`. So the "column" was not a column:
each bucket occupied two visual rows, and the second one carried the identical five words as the
eight above it. The CSS comment directly above the rule said *"Three columns on every row"* — a
comment describing a layout the rule below it collapsed.

Measured by rendering the panel against the nine buckets of that actual reading:

```
                          before   after
full-width "absent" rows       9       0
text nodes                    66      60
words                        227     195
most-repeated string     9x "פער כיול — לא נמדד"   (gone)
```

**Nothing was hidden.** The fact is still stated — once, above the table, and with the scope made
explicit rather than left to be inferred from nine sightings: *"פער כיול — לא נמדד באף שורה, גם
באלה שיש בהן דיוק."* The per-row version was protecting something real, that a reader must not
conclude the rows carrying an accuracy also carry a gap, and saying "in every row" in as many words
protects it more directly than repetition does.

**Why this is not the record dashboard's problem too.** Both render `.bucket-list` and the
correspondence is deliberate, so the list markup is untouched. The dashboard's third column holds a
per-bucket signed gap — real data that differs per row. Only the import's third column is invariant,
and an invariant is not a column.

**What is still repeated, and why it was left.** `דיוק` renders 8 times, once per measurable row,
because a grid with no header row has nowhere else to name the column; removing the label would
leave bare percentages. Fixing it properly means converting to a real `<table>`, which would break
the deliberate correspondence with `RecordDashboard` unless both move together. Recorded rather than
half-done.

Four positive controls, each confirmed red: the note deleted entirely; `באף שורה` removed; the
clause naming the rows that do carry an accuracy removed; and the constant re-added into the rows.

## The reading now outlives the overlay that produced it

The scan cost 971 positions and 43 seconds on the one machine it was measured on, and its result
lived in `useState` inside `ImportGames`. Closing the overlay discarded it, and the only way back
was to pay again. The most expensive artefact this app produces was the one it did not keep.

`saveImportDiagnostic` / `getImportDiagnostic` mirror the pre-registration pattern exactly: the
interface, the local store, the Drizzle store, the memory store, and one additive migration
(`0001_damp_magneto.sql`, CREATE TABLE only, no ALTER). Append-only, newest displayed, so which
rates were on screen when a hypothesis was registered stays recoverable after the next scan.

**What is stored is not the diagnostic.** A diagnostic alone is a set of rates with no origin. At
the moment of the scan the origin is on screen; reopened a week later the same rates with no date
attached stop being a measurement and become a standing claim about the person. So the stored
object carries the account, the game count, and `scanned_at` -- stamped by the service and NOT by
the caller, for the same reason `registerHypothesis` refuses the caller's `decisions_before`.

**A partial scan is shown and not kept (R2).** `aborted` means the player stopped it, and the
diagnostic then covers only what got scored. Honest to render right now, dishonest to persist:
reopened later it would be indistinguishable from a complete reading of the same games. The panel
says so on screen rather than letting the missing rail entry be the only clue.

**Not promoted.** Same `rail-button`, same rail, below the scan. The reading is a set of accuracy
rates, and accuracy is what this product argues is not the thing worth measuring -- a front-page
placement would have the app contradict its own empty calibration column. What was broken was that
a 43-second scan could not be reopened at all. The entry renders only once something is behind it.

### Two regressions this caused, both caught by existing tests

**The tRPC coupling.** The first version called `useSaveImportReading()` inside `ImportGames`, and
`import-cost.test.tsx` -- which mounts that component with no providers, deliberately -- went red on
six assertions about text with no connection to storage. The dependency is now injected as
`keepReading`, for the same reason `analyze` is a prop and the panel takes `bridge` as a slot.

**The mobile rail's hand-maintained column count.** `ux-contract.test.ts` asserts one column per
tool so none is orphaned onto its own row, and the CSS carried `repeat(5, 1fr)` under a comment
reading *"there are five tools"*. The saved-reading entry renders conditionally, so the rail now
holds five OR six and no fixed number is right for both. `repeat(auto-fit, minmax(0, 1fr))` plus
`grid-auto-flow: column` puts however many exist on one row. Measured in Chromium at 390x844:

```
                       buttons   rows   tap box    h-overflow
no reading kept              5      1    74x87px        false
reading kept                 6      1    62x87px        false
```

Both stay above the 44px floor WCAG 2.5.8 asks for.

Driven end-to-end on the built asset with a seeded reading: the rail entry appears, the panel
reopens with `erez281 - 20 games - scanned 24 August 16:00`, nine rows, zero per-row repeated
constant, and no "not kept" warning on a reading that was kept.

Six positive controls, each confirmed red: save made a no-op; append replaced by overwrite; the
service made to honour a caller-supplied `scanned_at`; the provenance line removed; the not-kept
warning removed; and `ImportGames` reaching the record hook directly again. Two more for the rail:
back to a fixed column count, and `grid-auto-flow` removed.

## Counting which of its four sentences the product actually produces

`chose-past-it` is the only sentence here no other chess tool can write. Every engine knows the
best move; none knows it was already on your board, because none makes you commit first. It fires
on decision one and needs no aggregation. **None of which matters if it fires three times in a
hundred, and that number has never been measured.**

`OneThingKind` labels the four branches and `oneThingMix` counts them over the record. It calls
`theOneThing` rather than restating its conditions -- a copy would drift the first time a threshold
moved, and then the measurement OF the product would disagree with the product, silently, in
whichever direction flattered the thing edited last.

`reveal.ts` moved from `client/src/lib/` to `shared/`. It had **no imports at all**, so the move
was mechanical; it is there so `recordReading` can assemble the mix server-side too. The mix is
assembled in `record-service` and not inside `readRecord`, because it needs fields `ScoredDecision`
deliberately does not carry -- the moves that were on the board, the chosen move, the engine's move
and the loss. That separation is the reason the two types exist.

**The ceiling is reported beside the count.** `eligible` counts decisions above the engine noise
and at or over the material line -- the only ones where "did you see it?" applies at all. Without
it the first row reads as "how often I see it and choose past it", and it is not that: the record
holds moves physically put on the board, so a player who calculated four moves and touched one
leaves a list of length one. **The count is a floor, never an estimate.**

It cannot be taken from the 554 already scanned. An imported PGN carries no record of what was on
the board before the move, so `candidate_moves_considered` is empty for every imported decision and
this branch can never fire for one. Asserted.

**A control that went green, and what it found.** The anti-drift assertion compares the counter
against `theOneThing` over a fixture set. Swapping the counter for a hand-copied branch set with
the material line moved 20cp **passed** -- every fixture sat 40cp clear of that line, so both
classified them identically. The fixtures now sit ON the thresholds (100, 101, 110, 119, 30, 31)
and the control goes red. The test was real; its data could not see the defect it was written for.

### A defect in the product's most reliable output

`theOneThing` returns null on two disjoint bands and the panel printed one sentence for both:

```
cpLoss <= 30, confidence >= 3      -> inside the noise. The sentence was right.
31 <= cpLoss <= 99, ANY confidence -> NOT inside the noise, and nothing was measured
                                      about confidence -- silent at 5/5 as much as 3/5.
```

The sentence was *"בחרת בתוך רעש ההערכה והביטחון שלך תאם"*. On the whole 31-99 band that states a
basis the file's own constants contradict, and section 4.5 was broken at the same time: two
different situations rendering as one sentence. The band was untested -- every fixture in
`reveal.test.ts` and `reveal-order.test.tsx` sits at 4 or 20 centipawns.

`silenceBasis` splits them. The second sentence names the loss and both thresholds it sits between,
so the refusal now carries its own basis. **The refusal is this product's most reliable output and
it was over-claiming about itself**, which is worse than any of the four sentences over-claiming.

Found by an external review pass reading the code, not by a test. Four positive controls, each red:
the counter's denominator taking unrevealed decisions; silence dropped from the denominator; the
eligibility ceiling computed without the material line; the branch priority inverted. Plus two for
the silence split: the single sentence restored, and the basis computed from the wrong threshold.

## The differentiator was collecting its input silently

Three independent expert reviews -- product marketing, product strategy, value-proposition design
-- were run against this codebase, and all three arrived at the same finding from different
directions: **`candidate_moves_considered` is the only reason this product can ever say "the
engine's move was already on your board", and nothing on screen told the player it was being
recorded.** `CommitmentScreen` received the array as a prop (line 95, building `live`) and rendered
it nowhere.

The strategy review pushed it further: during `stage === "deciding"` a dragged move is marked, not
played, and the player is shown nothing of the resulting position. So there is no reason to put a
second move on the board **except to change which move you intend to play** -- meaning the array
records *abandonment*, not comparison, and its expected length is 1. If that is right, the fire
rate of the product's one unique finding is near zero **by construction of the interface**, not by
anything about the players.

The panel now discloses what it holds. Disclosure, not instruction, and the distinction is the
whole design:

- **No count.** A number beside a list is a score, and a score invites raising it.
- **No target, no progress, no praise.** Asserted by tests against imperatives and celebration.
- **The wording is byte-identical at one move and at four.** If it warmed up as the list grew, the
  panel would be grading board behaviour, which is the inducement this refuses. Asserted.
- **It renders from the FIRST move, not the second.** Appearing at two would make two a threshold,
  and a threshold that appears on reaching it is a reward.
- **It states the asymmetry in the direction the array actually runs**: a move here WAS in front of
  the player; a move absent may still have been considered and never touched. So the record can
  show a move was there, never that it was not.

**Why the mix had to ship visible in the same change, and not after.** Making the input visible can
induce performative candidate-adding -- players dragging moves they did not consider. That would
turn the array into an artifact of the interface, the same contamination that got pre-filled read
chips refused. It also contaminates the denominator of `oneThingMix`, which is the instrument built
to measure the fire rate. Shipping the affordance without the reading visible would have removed
the ability to detect a contamination this change itself introduced.

Driven on the built asset, 1440x1500:

```
after 1 move   list: [e2e4]           note rendered
after 2 moves  list: [e2e4, g1f3]     note byte-identical to the 1-move version
```

**A CSS defect caught before it shipped.** The first version of these rules used `--fs-label` and
`--fs-body`, which do not exist -- the panel's scale is `--panel-title/data/body/label/fine`. Three
`font-size` declarations would have silently resolved to nothing: the `--edge: var(--edge)` failure
in a third shape, found by grepping for the token definitions rather than by trusting the names.

**A control that never ran, and looked green.** The control removing the one-way clause from the
asymmetry note reported all tests passing. The perl pattern spanned a JSX line break and matched
nothing, so no mutation was applied -- a no-op reported as a survived assertion. Re-run against the
actual line, it goes red. **A control that cannot be shown to have changed the file is not a
control**, and diffing the mutated file against the original is the cheap way to prove it did.

Eight positive controls, each confirmed red: the disclosure removed; appearing only at two moves; a
count added; wording that warms as the list grows; the one-way clause dropped; the mix dropped from
the dashboard; the ceiling removed from the mix; shares reported below the floor.

**Not built, and named rather than assumed away.** The strategy review also proposed a sixth
`declaredTension` firing when exactly one move was put down at confidence >= 4. Refused: a question
that appears *because* you recorded one candidate is a nudge to record more, whatever its wording,
and it would contaminate the measurement in the same direction as a count.

## The touch order was being thrown away at write time

Found by an external review pass in chess-expertise research, reading the code.

`handleBoardMove` (Home.tsx) appends each distinct move in the order it was put on the board, and
the chosen move is in there at its own position -- choosing is touching. The write then did:

```ts
candidate_moves_considered: [...new Set([draft.chosenMove!, ...draft.candidatesConsidered])]
```

`Set` keeps the FIRST occurrence, so prepending the chosen move forced it to index 0 and discarded
where it actually fell. The comment above it -- *"the chosen move is always among the candidates
considered"* -- names a guarantee the array already satisfied, and bought it at the cost of order.

**What that erased.** Whether the engine's move was touched FIRST and then abandoned, or touched
LAST and rejected. Those are opposite events. One is *"you had it and talked yourself out of it"*;
the other is *"you weighed it and decided against it"* -- and the two bodies of literature on move
choice prescribe opposite remedies for them. The product asserts the second reading in as many
words (`chose-past-it`: *"what decided between them is what to look at, not the seeing"*) and could
not tell which one it was looking at.

`keepTouchOrder` appends instead of prepending. It costs the player nothing: no new field, no new
interaction, same array type, same cap.

**The regression the naive fix introduces, and the reason this is not one expression.** Appending
puts the chosen move last when it is absent from the list, so a player who touched nine distinct
moves would have it sliced off by the cap -- leaving an atom whose `decision` is not among its own
`candidate_moves_considered`, which is incoherent and would silently break the one branch that
reads the field. The first eight are kept in touch order, and if the chosen move fell outside that
window it takes the last slot: the record then says "this was touched, late" rather than losing it.

Three positive controls, each confirmed red **and confirmed to have actually mutated the file**:
prepending restored; the truncation guard removed; the cap removed. The file-diff check is there
because a control earlier in this branch reported green without ever running -- its pattern spanned
a JSX line break and changed nothing.

## The detector's threshold makes it worse with more data

Reported by an external review pass in chess coaching, which ran the shipped `detect()` against
simulated records. **Reproduced independently here with a different simulation**, 300 records per
cell, planting a real effect in the `fast-under-45s` bucket:

```
scenario                              n=120    n=300    n=600   n=1200   n=2400
A  no real effect (null)               0.0%     0.0%     0.0%     0.0%     0.0%
B  coach-scale: 13pt acc, +0.5 conf   26.7%    10.0%     3.7%     0.7%     0.0%
C  large: sits exactly on the line    52.7%    50.7%    50.7%    48.3%    48.3%
```

**Row B is the finding: the detector's power FALLS monotonically as the record grows.**

The mechanism. `MIN_GAP_DIFFERENCE = 0.45` is a fixed effect-size floor applied to a point
estimate, with no dependence on `n`. As decisions accumulate the estimate converges onto its true
value (0.25 in scenario B) and stops randomly exceeding 0.45. Early on, sampling noise sometimes
pushes it over. **So the only times it fires on a sub-threshold real effect are the times it is
wrong.** Row C is the same defect from the other side: an effect sitting on the line is a permanent
coin flip that no amount of play resolves, because nothing accumulates -- it is a point against a
line, not a test.

**Row A is the part that works.** The false-positive control is clean at every size, and
GATE-SHUFFLE genuinely validated it. What the gate never tested is a *sub-threshold real* effect,
which is the region every actual human occupies.

**The correct pattern is already in this repository, one file away.** `worstBucketVerdict` in
`shared/import-diagnostic.ts` computes `2 * sqrt(var_a + var_b)` and compares separation against
it -- an n-dependent separability test whose threshold shrinks as the sample grows, which is how a
test behaves. The import screen is statistically sound. The detector, which is what the product
leads on, is not, and does not use it.

**This re-reads the one real result the product has.** The 554-decision import that separated
nothing was not bad luck or a small sample. Under a fixed floor of 0.45 on a scale where one full
point of stated confidence is 0.25, that is what the detector returns for a human being.

**FIXED.** The fixed floor is gone; see *"Separability, and the multiplier the shuffled-label
control chose"* below for what replaced it and what it cost.

## A forced mate is not a centipawn quantity, and the live reveal read it as one

Found while sizing the detector fix above, because everything the detector reads is derived from
`accurate`, which at the time was `cp_loss <= 30`. (It is now a win-probability cost; the defect
below is unchanged by that, because a mate distance read as centipawns is wrong on either scale.)

`parseAnyInfo` stores a `score mate N` line as `scoreCp = N * 10000`. That is an ordering, not a
magnitude — it makes *mate in nine* score higher than *mate in eight* — and `cpLossFromSearches`
consumed it as centipawns. Driven through the shipped functions, not a copy of them:

```
delivering mate in 9, play the BEST move   cp_loss= 10000  ->  inaccurate
delivering mate in 2, play the BEST move   cp_loss= 10000  ->  inaccurate
mate in 9 available, throw it away (+11)   cp_loss= 88899  ->  inaccurate
quiet position, blunder INTO being mated   cp_loss= 50040  ->  inaccurate
being mated in 4, ACCELERATE to mate 1     cp_loss=     0  ->  ACCURATE
ordinary: best +0.40, chosen -0.60         cp_loss=   100  ->  inaccurate
```

**Both errors are directional and they point the same way.** Row 1 and row 2 land on moves that
force mate — typically stated at high confidence — and mark them wrong. Row 5 lands on a hopeless
position, typically stated at low confidence, and marks it right. Both widen the measured gap
between stated confidence and realised accuracy, and both concentrate in the endgame, which the
detector has a phase bucket for.

**GATE-SHUFFLE could not have caught it.** `shuffleLabels` permutes the bucket labels while
leaving `accurate` attached to its decision, so a phase-correlated corruption survives in the
observed statistic and is destroyed in the null — the gate would have certified this as signal.

### The two paths disagreed about the same move

The import scan clamps mate to a fixed `MATE_SCORE = 10000`; the live reveal multiplied the mate
distance by 10000. Same engine output, same move, opposite verdicts:

```
White to move, can force mate in 9, plays the fastest mate
  UCI before (White to move): score mate 9      after (Black to move): score mate -8
  live path    cp_loss = 10000  -> inaccurate
  import path  cp_loss =     0  -> ACCURATE
```

One constant now, in `shared/reveal.ts`, read by both — `shared/` cannot import from `client/`,
which is why it lives beside `ENGINE_NOISE_CP` rather than beside the parser. `comparableCp` is
the only thing allowed to turn a line into a number, and `cpLossFromSearches` takes `EngineLine`s
rather than numbers so a caller cannot hand it the wrong field again.

**The clamp is disclosed, not hidden.** A mate reveal now carries a limit sentence naming the
ceiling and the discarded quantity (the distance to mate), and the cost renders as
`0 ס״פ מול תקרת מט` rather than a bare `0 ס״פ` — because on a mating move zero means *nothing was
better than this*, and unclamped zero means *this move changed nothing*, and those are opposite
readings of identical glyphs (4.5).

### `mate 0` was worth nothing at all

`Math.sign(0)` is `0`, so the import path's clamp scored a position where the side to move is
**already checkmated** as dead level — in the direction that flatters whoever just got mated.
Now `mate > 0 ? +MATE_SCORE : -MATE_SCORE`.

### The engine saying nothing, read as the engine saying zero

A terminal position has no legal reply, so no `info` line carries a principal variation, so
`analyze` **resolves** with `emptyLine` — `scoreCp: 0` — rather than rejecting. A search that
times out resolves the same way. Driven end to end through the real `analyzePositions`, a game
where White is +5.00 throughout and delivers mate:

```
White-relative evals per position: [ 500, 500, 500, 500, 500, 0 ]
the MATING move (ply 5, White): before=500 after=0
  cp_loss = 500  ->  inaccurate
```

**The best move of the game, scored as a 500-centipawn blunder, on the winner.**

Live, this is now answered from the rules rather than from the engine: `after.isCheckmate()` →
loss 0 (nothing outscores mate), `after.isGameOver()` → the position really is 0.00, so the
ordinary comparison holds. It also saves one search per game-ending decision. A search that comes
back empty for any *other* reason now throws into the existing engine-failure screen rather than
producing a reveal built on zeroes that is indistinguishable from one built on an evaluation.

**23 assertions, 12 positive controls, each confirmed red and each diffed against the original to
prove the mutation reached the file.**

### NOT FIXED HERE: the same defect on the import path

`analyzePositions` still returns `0` for a position the engine did not evaluate, so the mating
move of every imported game that ended in mate is still scored as a blunder — the measurement
above was taken against the shipped import path and still reproduces. Fixing it means
`evalScores` becomes `(number | null)[]`, which is the input type of `shared/eval-analysis.ts`,
`shared/import-diagnostic.ts`, `GameReview` and the game-review screen in `Home.tsx`. That is a
different change in four modules, and the reason it is recorded rather than bundled is the one
already established above: one planned fix beats two conflicting ones in the same path.

Size on the one real reading: 20 games, 554 decisions. Every game that ended in checkmate
contributes exactly one such decision, so the affected share is at most 20/554 = 3.6% and lands
only on the player's best move of that game.

## Separability, and the multiplier the shuffled-label control chose

The fix for the section above. `MIN_GAP_DIFFERENCE` is gone; a bucket is now reported when its
calibration gap sits further from the rest of the record than the **sampling error of the
difference**, by a multiplier the control set.

### What the test is built on, and why not the obvious thing

`gap` is `meanConfidence − accuracyRate`. The obvious standard error adds the two marginal
variances — and that assumes confidence and accuracy are independent *within* a bucket, which is
the exact opposite of this product's premise: an overconfident player is one whose confidence and
accuracy move apart there.

So the test is built on **one quantity per decision**, `confidence − (accurate ? 1 : 0)`. Its mean
over a bucket is identically `gap`, so the sampling variance of `gap` is `variance(that) / n`,
exactly, with no independence assumption anywhere. The two samples (inside a bucket, outside it)
are disjoint by construction, so their variances add.

This is the same shape as `worstBucketVerdict` in `shared/import-diagnostic.ts`, computed on the
right quantity for this measure. **The import screen has always been statistically sound. The
detector the product leads on was not, and did not use it.**

### The harness decided the number, and it is not the easy one

GATE-SHUFFLE takes **one record** and permutes its labels hundreds of times — the spec's
requirement, *"the player's decisions with clock and phase randomly permuted."* That is a harder
null than drawing a fresh record per run, because a single record can be systematically unlucky
and the gate reports the **worst** cell.

Calibrated the easy way, k = 3.25 looked clear at 1.1%. On the gate's own harness it touches
2.0% — the ceiling exactly, passing only on a strict inequality. Ten independent base records per
size, 300 shuffles each, worst cell of the ten:

```
k       n=120   n=300   n=600  n=1200
3.25     2.0%    1.7%    2.0%    1.0%    <- at the ceiling
3.50     1.7%    0.7%    0.7%    0.7%
3.75     1.0%    0.3%    0.3%    0.3%    <- shipped
4.00     0.3%    0.0%    0.3%    0.0%
```

**`SEPARABILITY_K = 3.75`** — the smallest multiplier measured that leaves half the ceiling as
margin. A gate that passes at exactly its limit is one unlucky draw from red and teaches people to
re-run it. The shipped gate now reports **0.7% worst case**.

`noiseRecord` was extended from `[40 … 300]` to `[40 … 1200]` in the same change. A fixed floor is
*hardest* to clear on noise at large n, so the gate had been testing the region where the old rule
looked best and never the region where it went silent on real effects.

### Head to head, on identical records

2000 fresh records per cell. True gap difference in brackets; one whole point of stated confidence
is 0.25, so a coaching-scale finding — 13 accuracy points plus half a point of confidence — is
0.255, barely half the floor it had to clear.

```
scenario                        rule           n=120   n=300   n=600  n=1200  n=2400
null            (true 0.000)    fixed 0.45      0.0%    0.0%    0.0%    0.0%    0.0%
null            (true 0.000)    k=3.75 SE       0.4%    0.1%    0.1%    0.1%    0.0%

coach scale     (true 0.255)    fixed 0.45      0.9%    0.2%    0.0%    0.0%    0.0%
coach scale     (true 0.255)    k=3.75 SE       4.6%   42.9%   91.0%   99.9%  100.0%

on the old line (true 0.450)    fixed 0.45     15.3%   49.4%   49.7%   49.9%   50.3%
on the old line (true 0.450)    k=3.75 SE      22.9%   99.6%  100.0%  100.0%  100.0%

strong          (true 0.675)    fixed 0.45     24.4%   93.6%   99.0%   99.9%  100.0%
strong          (true 0.675)    k=3.75 SE      30.4%  100.0%  100.0%  100.0%  100.0%
```

Row 3 is the defect: **power falling to zero as the record grows.** Row 5 is the same defect from
the other side — an effect sitting exactly on the floor was a permanent coin flip that no amount of
play resolved, because a point estimate against a line never accumulates. Both now converge.

### Pre-registration now buys the bar as well as n, reversing a recorded finding

`shared/detector.ts` used to state, from measurement: *"Pre-registration buys n, not gap."* That
was correct about the detector it was measured on, and correct for a reason nobody wrote down — **a
fixed effect-size floor does no multiplicity work at all**, so removing five of the six chances to
clear could not lower it. A separability multiplier *is* the multiplicity control, so the same
experiment comes out the other way. Gate harness, one pre-named bucket at `minBucketN` 20:

```
k       n=120   n=300   n=600  n=1200  n=2400
2.50     3.3%    3.0%    2.3%    2.3%    2.7%   <- over the 2% ceiling
2.75     1.7%    2.3%    1.3%    1.3%    1.3%   <- over it at n=300
3.00     1.0%    1.0%    1.0%    0.7%    0.7%   <- shipped
```

**3.00 named in advance against 3.75 for the scan.** The margin is smaller than "six tests instead
of one" suggests, for the reason the old comment gave and which still holds: the six bucketings are
not independent — three phase buckets partition the same decisions and the clock buckets overlap.
The earlier finding is left in the file rather than deleted.

## The same defect in the drill, where it cost a grade

Found while removing the constant, because `evaluateRefutation` was the other thing reading it.

**The stored refutation condition and the test it was graded by did not agree.** The text written
down before the drill runs says *"if the gap … is not larger than in the rest of your decisions —
refuted."* The code required larger **by 0.45**. That is the exact failure `evaluateRefutation`'s
own doc comment says it exists to prevent: *"A drill that writes down one condition and tests
another has not pre-registered anything, which is the whole of R5."*

Against a baseline of 200 decisions, 2000 runs per cell:

```
claim TRUE, confirmed        n=5     n=8    n=12    n=20    n=40    n=80
  fixed 0.45               22.1%   14.8%    9.3%    4.5%    1.0%    0.1%
  separable k=3.00          7.6%   10.8%   13.0%   23.1%   46.9%   78.1%

claim FALSE, confirmed       n=5     n=8    n=12    n=20    n=40    n=80
  fixed 0.45                2.1%    0.4%    0.1%    0.0%    0.0%    0.0%
  separable k=3.00          2.1%    1.6%    0.8%    0.4%    0.3%    0.7%
```

**Said plainly, because the first row does not read the way the change wants it to:** at five
positions the fixed bar really is more sensitive, at the same false-confirmation rate. The two
cross at about twelve, and past that the old rule collapses — at eighty positions it confirms a
true claim one time in a thousand. *A longer drill made the product less likely to believe a claim
that was true.*

`evaluateRefutation` also took `baselineGap: number`, which forced it to treat the rest of the
record as exactly known. It is an estimate from a finite sample; it now takes the whole summary and
the baseline's error enters the comparison.

### NOT FIXED: a drill of 5–8 positions cannot decide anything

`MIN_DRILL_POSITIONS = 5`, `MAX_DRILL_POSITIONS = 8`. At that length **neither rule has usable
power** — 7.6% to 22.1% on a claim that is true. So `observed: false` conflates *"the drill refuted
this"* with *"the drill could not have confirmed it"*, and the second is far more common.

The verdict now carries `standardError` so a caller can tell them apart. Distinguishing them in the
**stored grade** needs a third state in `observed`, which is a persisted column in
`drizzle/schema.ts` and four read/write sites in `server/record.ts` — a migration, not an edit. And
making a drill long enough to decide anything is a question about how many positions a player is
asked to play, which is not a statistical decision.

**19 assertions, 12 positive controls**, each confirmed red and each diffed against the original to
prove the mutation reached the file. One survived on the first pass — the assertion that the
baseline's own error enters the comparison was a loose inequality the mutation sat comfortably
inside; it is an exact identity now.

## The type scale governed one component out of forty

`docs/MEASUREMENTS.md` already records collapsing the commitment panel from ten font sizes to
five, and `:root` carries the scale with a comment reading *"a size is a JOB, not a nudge."* A
test holds the panel to it. **Nothing held the other thirty-nine components.**

Measured across `client/src/index.css`:

```
141  size declarations that do not read a scale token
 23  distinct sizes inside the 8-18px band
 16  of those declared as rem fractions: 0.60 0.62 0.64 0.65 0.66 0.68 0.70 0.72
     0.73 0.74 0.75 0.76 0.78 0.80 0.82 0.86
```

**Sixteen steps inside four and a fifth pixels.** Two systems were running at once — px in the
older components, rem fractions in the reveal, claim, drill and learning panels — and neither knew
about the scale.

On the first screen, driven in a browser at 1440×900:

| | before | after |
| --- | --- | --- |
| distinct font sizes | **14** | **7** |
| of which fractional | 5 (9.92, 10.88, 12.16, 30.71, 57.165) | 1, and it is a chess piece |
| font families | 4 | 3 |
| smallest text | **8px**, on `כאן` — the one word that says where you are in the product | 10px |

The 8px case is the same defect the panel already has a test for (*"does not put the smallest text
in the product on a label that explains a number"*), one component over.

**Two steps were added, not removed.** Five ranks describe one 330px panel; a document has a page
title and a section heading above anything that panel owns, and forcing both down to
`--panel-title` flattens the page instead of ordering it. `--panel-heading: 20px` and
`--panel-display: 26px` exist for those two jobs, and the count assertion moved with them — an
eighth still needs a reason.

**Two sizes are deliberately off the scale, and both are drawings.** `.brand-mark` is the knight
glyph sized to the mark it draws; `.piece` is sized in `cqmin` so it tracks the square under it. A
type scale ranks text.

**One monospace family, not two.** `.commitment-move` rendered a UCI move in `ui-monospace` while
every other coordinate in the product rendered in DM Mono — two typefaces for one job, on one
screen, differing by whatever the operating system supplied.

The assertion that would have caught all 141 now runs over the whole stylesheet rather than over
the panel's own selectors.

## The default theme could not be changed, whatever it was set to

Every colour token in `index.css` was written for a paper-and-ink notebook, and so was every
measurement beside it. The app shipped `defaultTheme="dark"`, where the wooden board is the only
saturated object on a near-black page.

**The effect that applies the theme also wrote it to `localStorage`, on every mount.** So the
first visit persisted whatever the default happened to be that day, and from then on the stored
value was indistinguishable from a choice the player had made. Changing the default reached nobody
who had ever loaded the page — which is everyone.

Section 4.5 in storage: an unanswered question and an answered one must not look the same. The
preference is written on the toggle now and nowhere else; no entry means no choice, and no choice
means the default applies. Verified in a browser: `localStorage.theme` is `null` after a first
load, and the page opens light.

**8 positive controls, each confirmed red and each diffed against the original.**

## What the first action is, and where it used to be

The panel asks for four things — a move, a read, an unknown, a confidence — and `draftProblems`
refuses the record until all four are answered. **All four opened at once.** Driven in a browser on
the built app:

| | 1440×900 | 390×844 |
| --- | --- | --- |
| panel height | **952px**, in a 900px window | 935px |
| record button | y=847; the strip under it naming what is missing is **clipped at every standard laptop height** | needs **113px of scroll** |
| move field | — | needs **264px of scroll** |
| board begins | y=136 | y=240 |
| panel begins | y=276 | y=937 |
| whole page | 1.7 screens | **2.5 screens** |

On a phone the first 223px were a wordmark that wrapped onto two lines and a rail of five tools
nobody needs before their first decision. **A screen that shows a board and hides the question
reads as a board.**

### One question open, four headers visible

The four are an accordion: one open, the rest collapsed to a header carrying the step's name, its
required mark, and its answer once there is one.

**Not a wizard, and the difference is the point.** A player who cannot see how many questions are
left is in the same position as one scrolling a 952px panel. Every step is a button; every option
is one tap away.

**The constraint two earlier attempts were refused for still holds.** Neither a "more" control nor
a shorter list: that is what a player is able to say about a position, and what the record then
holds. What is bounded instead is the open step's **body** — with the second step open it measured
421px (ten chips wrapping into five rows), which put steps 3 and 4 at y=898 and y=958 in a 900px
window. Capping the body keeps every option and every header.

### What advances by itself, and what deliberately does not

The move step advances on its own: choosing a move is one act, it cannot be added to, and it
arrives from the board rather than from the panel.

The two read steps do **not**. Both are multi-select and their own hint says *"choose as many as
you like"*; advancing on the first tap would make one tap the normal amount — the interface shaping
the record rather than holding it, which is exactly what got a count beside the candidate moves
refused. They advance on an explicit "next", or on tapping any header.

### Order: act first, then see where you are

`LoopStrip` — recorded → pattern → drill → graded, and how many revealed decisions are still
needed — was the first child of the decision column. That is orientation about **weeks**, sitting
between the board and the decision being made **now**, and it cost 143px: exactly the amount by
which the fourth step missed the fold.

On a phone the same argument applied one level up: the tool rail (new game, load PGN, import) is
used once a session at most and sat above the board.

| after | 1440×900 | 390×844 |
| --- | --- | --- |
| panel begins | y=136 | y=706 |
| all four steps visible together | **yes** (260–775) | after one scroll |
| record button | y=788, on screen | y=791, **on screen** |
| board begins | y=136 | y=153 |
| whole page | 1.2 screens | 2.1 screens |

**A 370px board on a 390px screen cannot be smaller**: eight squares across 370px is 46px each,
against a 44px tap floor. So the board fills a phone's first screen by arithmetic, and it should —
the move is made on it. What was wrong was being left there afterwards, so choosing a move now
carries the player to the question. That scroll follows the rule the refused-commit scroll already
followed: never on load, only on something the player just did, and skipped entirely when the panel
is already on screen.

**17 assertions, 9 positive controls**, each confirmed red and each diffed against the original.
One survived the first pass and was a no-op wearing a mutation's clothes — it inserted a comment
into a component rather than changing a behaviour. The third time this repository has recorded that
failure, and the reason every control here reports its byte delta.

## The slot that was empty, and the two things the app forgot

Friction, measured on the first screen at 1440×900: **83 controls, 64 of them board squares, 14
non-board controls above the fold** — and nine of those fourteen are ways to load a game or app
chrome. Only five belong to the decision loop.

### The app already computed the answer and put it below the fold

`loopPosition()` returns, on every render, one sentence naming which of record → detect → drill →
grade is live and what stands between here and the next one, plus the basis it came from. It
rendered inside `LoopStrip`, beside the record — and once the decision panel took that column,
that is **y=1368 on a 390×844 phone**: five hundred pixels below the fold.

Meanwhile `ContextRibbon` is a reserved slot at the top of the page for telling a player something
before they ask, and its own comment described what it actually did:

> *"It renders nothing at all on an ordinary visit, which is almost every visit."*

It fired only after `RETURN_GAP_DAYS = 3`. Measured on a fresh load: **not rendered**, both
viewports.

So the sentence moved into the slot. **Relocation, not duplication** — `LoopStrip` keeps the rail,
which is a picture of four steps and means something beside the record; the ribbon takes the
sentence, which means something before anything. Both read one hook (`useLoopPosition`), because
two components deriving the same position from the same query is where `LoopStrip`'s own refusal
of *"a fourth copy of any of those"* starts.

**Routing, not ranking.** `loopPosition` is a pure function of counts: the same record gives the
same sentence every time, from numbers that are on screen elsewhere anyway. It reads nothing the
detector buckets on — no time, no phase, no clock — and the ribbon's own disclosure says so. A
layer that ranked options by predicted value would be measuring the player and then changing what
they see, which changes what is being measured.

The gap notice stays dismissible; the loop position does not. `הבנתי` used to close the whole
ribbon, which was right when the ribbon was only ever a notice.

### The ribbon cost the panel its fold, and then paid it back

| 390×844 | before | ribbon added | after trimming |
| --- | --- | --- | --- |
| the anticipation slot | not rendered | y=143 | **y=89** |
| the decision panel | y=706 | y=871 (**27px below the fold**) | **y=790** |
| ribbon height | — | 151px | 124px |
| header height | 117px | 117px | **67px** |

A slot that orients you by costing you the thing it orients you towards is not worth its space.
The sentence keeps its own row; the basis and the collapsed `למה?` share the row under it. The
disclosure stays 44px because `summary` carries `min-height: var(--tap-floor)` — that is the tap
target, and not mine to trim.

**And a regression from the previous commit, found by looking.** Making `.brand-name` nowrap so
"DECISION LAB" stopped breaking across two lines widened the brand block to 179px of a 350px
header, squeezing the actions column to 171 — four 44px tap targets plus gaps need 200 — so **the
fourth icon dropped to a second row**. The brand is chrome and yields; the tap targets do not.

### Memory, not prediction

**The account.** `StoredImportDiagnostic` holds the Lichess username of the last kept reading, and
`ImportGames` opened with `useState("")` every time. It is prefilled now, and it loses every
argument with an actual keystroke: a player who has started typing owns the field.

*One mechanism, and a positive control is why.* It was prefilled twice — a `useState` initialiser
for the synchronous case and an effect for the late one. A control that removed the initialiser
**stayed green**, because the effect covers that timing too. That is the definition of a redundant
second mechanism, and two ways to set one field is where they drift. The effect is the only one now.

**The game.** Closing the tab lost it: the record survived, a usage timestamp survived, the
position in front of you did not — so every return started at the opening position with five
buttons offering to fetch one. `session-position.ts` stores the **moves**, not the snapshots
(chess.js derives the position from the moves; storing both would be two sources of truth for one
board), replays them through the same `buildHistory` a pasted PGN goes through, and restores once.

**The draft decision is deliberately NOT restored.** The seconds-taken clock starts when a position
is presented, so a half-answered commitment resumed an hour later would carry an hour of thinking
time into the record as a measured number (R2). A drill and a learning transfer are not written
either: neither is a game to come back to.

### A test that passed for the wrong reason

The guard test for stored shapes built its bad cases by spreading the **write** shape, which
carries no `savedAt` — so all seven were rejected on a missing timestamp and **not one of them ever
reached the guard it was named after**. A control that coerced the `ply` guard away survived
because of it. Every case is one field wrong now, against a complete stored object, and a positive
case proves the valid shape really does parse.

Three source assertions also went red against the components' **own doc comments** — `LoopStrip`'s
note explaining that `position.headline` moved out matched the pattern asserting it no longer
renders it. A source test that a paragraph of prose can fail is not testing code; they strip
comments first now, as the stylesheet assertions already did.

### Found, not fixed

The ribbon's sentence and `ClaimPanel`'s `silenceReason` both say the record needs more decisions,
in different words, on the same screen. That predates this change — `LoopStrip`'s headline and the
claim panel were already adjacent — so the count of places saying it is unchanged, but moving one
to the top makes the pair more visible. Which of the two should keep the sentence is a product
call, not a refactor.

**22 assertions, 12 positive controls**, each confirmed red and each diffed against the original.
**Four survived the first pass** and each named something real: two because the ribbon was only
asserted through its source and never rendered, one because of the `savedAt` flaw above, and one
because the prefill genuinely had two mechanisms.

---

# The instrument, as specified

Everything a reader needs to say what this measures, reproduce it, or disagree with it. Written
as a specification rather than a description: each row names the choice, the value, and **what
set it** — because a constant whose provenance is "it seemed right" is not a measurement.

**Instrument version 1.** Readings taken under different versions are not comparable and nothing
pools them.

## 1. What is elicited

| | |
| --- | --- |
| Judgment | One move, plus a confidence that it is accurate |
| When | **Before any engine output exists on the client.** Enforced by GATE-COMMIT, which fails if the engine module is in the initial module graph or if a pre-commit reveal carries engine output |
| Scale | Seven ordinal levels: ניחוש · ספק · נוטה · שקול · סביר · בטוח · ודאי |
| Mapped to | `.05 .20 .35 .50 .65 .80 .95` |
| Recorded with | The scale it was stated on, so a stored level cannot be re-read on a scale the player never saw |

**Why seven, and why inset.** A perfectly calibrated agent — zero self-knowledge error, its only
constraint being these levels — is run through the scale and the gap it prints is the
instrument's zero point. Computed as an integral, not simulated:

| scale | worst reading | spread across difficulty streams |
| --- | --- | --- |
| 3 levels `.25 .50 .75` | −12.07 | 14.55 |
| 5 levels `0 .25 .50 .75 1` | −1.50 | 2.98 |
| 5 levels `.10 … .90` | −2.08 | 3.83 |
| 7 levels `0 .167 … 1` | −0.99 | 1.67 |
| **7 levels `.05 … .95`** | **−0.35** | **0.60** |
| 9 levels `.05 … .95` | −0.52 | 0.55 |

Nine levels buy nothing over seven, which is where Cox (1980) put the usable band from an
unrelated direction. Reproduce: `tests/shared/confidence-scale.test.ts`.

## 2. What counts as the outcome

| | |
| --- | --- |
| Ground truth | Stockfish 18, depth 14, MultiPV 8 |
| Cost of a move | `winProbability(eval) − winProbability(eval − cpLoss)` |
| Accurate when | That cost ≤ `ACCURATE_WIN_PROBABILITY_LOSS` = 2.76 points |
| Threshold set by | `ACCURATE_CP_LOSS` (30 cp) at the evaluation where its cost peaks — so no decision the centipawn rule called accurate is called inaccurate by this one |
| Logistic constant | `k = 0.00368208`, Lichess's published fit **on 2300-rated games**. GM estimates are roughly twice as steep; any product inheriting it for another population misstates what moves cost, including this one |

**The oracle charges nothing for its own best move.** Centipawn loss is read out of a single
MultiPV root search, so the comparison is `best − chosen` within one tree, one window, one
iteration. Measured against Stockfish 18 on 110 real positions, feeding it the engine's own best
move: root-minus-child scored 7.3% of them "inaccurate", a second root search restricted with
`searchmoves` scored 12.7%, and one MultiPV search scores 0 on 110 of 110.

## 3. Which positions

| | |
| --- | --- |
| Comparable reading | The **anchor set**: 60 positions, fixed, answered by everyone in one order |
| Corpus | Lichess open database (CC0), games with `[%eval]`, terminating normally, base time ≥ 180 s |
| Position filter | Past `OPENING_MAX_PLY`; not the final ply; `\|eval\| ≤ 300 cp` (Regan's exclusion) |
| Sampling | Fixed stride through the eligible stream, at most one position per source game |
| Generator | `scripts/build_anchor_set.ts` — the bank is regenerable, not hand-written |
| Free-play reading | Also reported, and **comparable to nobody**: the player met their own positions |

Sampled rather than curated because overconfidence is substantial on **selected** items and near
zero on **representative** ones (Gigerenzer, Hoffrage & Kleinbölting 1991; Juslin 1994) — a bank
chosen for instructive positions manufactures the finding it exists to measure.

## 4. What is reported

`BRIER = RELIABILITY − RESOLUTION + UNCERTAINTY` (Murphy 1973), exactly — the scale is discrete,
so grouping is by level and there is no binning parameter to choose. This is the problem CORP
(Dimitriadis, Gneiting & Jordan, *PNAS* 2021) exists to solve for continuous forecasts, and it
does not arise here.

| term | belongs to |
| --- | --- |
| `UNCERTAINTY` = `o(1−o)` | **the positions**, entirely |
| `RESOLUTION` | the player's discrimination |
| `RELIABILITY` | the player's calibration error — the only term that is a statement about them |

Also reported: Brier, Brier skill score against the base rate, and a logarithmic score, which is
finite only because no level asserts certainty.

**Nothing is reported below `MIN_BUCKET_N` per level.** Reliability is biased upward in small
samples — at one decision per level it is at its maximum by construction — so the figures stay
arithmetically correct and are marked unreadable rather than shown.

## 5. What protects the finding

| control | what it does | where |
| --- | --- | --- |
| GATE-SHUFFLE | Permutes clock, phase and time-taken hundreds of times over one record; the worst cell must stay under a 2% false-positive ceiling. **This sets `SEPARABILITY_K = 3.75`** | `scripts/run_gates.ts` |
| Pre-registration | A bucket named in advance buys `n = 20` and `k = 3.25`, both measured on the same harness, not asserted | `shared/prereg.ts` |
| Positive controls | Every gate must go RED under a deliberate defect, and every new assertion is shown red by a mutation diffed against the original | `npm run gates:controls` |
| GATE-NO-FAKE, GATE-DENOM | No placeholder evaluation and no denominatorless percentage on any render-path file | `scripts/run_gates.ts` |

## 6. What this instrument cannot do

Stated here because a specification that lists only its strengths is advertising.

- **No reference class exists.** No published distribution of stated-confidence-minus-realised-
  accuracy for chess exists at any sample size. A gap of −14 points cannot be called large,
  small, typical or unusual, because there is nothing to call it relative to.
- **Trait status is unproven.** Test–retest reliability has never been measured. Cross-task
  correlations for ordinary calibration measures run .08–.39; the one instrument with
  demonstrated trait reliability reaches r ≈ .53–.77 by making performance uninformative. Until
  this clears something like r ≈ .5 across sessions, it measures the session, not the person.
- **Nothing external has checked it.** No independent replication, no published protocol, no
  second implementation.
- **The time buckets are confounded and known to be.** On 380,310 real Lichess moves the blunder
  rate rises monotonically with think time (1.55% → 7.92%) — reverse causation through position
  difficulty. Any bucket-level claim needs a population baseline for that bucket, which does not
  exist yet.
- **The elicitation is a move plus a level.** A stronger design elicits an interval on the cost
  itself; this one does not.
