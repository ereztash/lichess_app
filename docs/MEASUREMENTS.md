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
