# Master product debt

**One register. Everything else that looks like a tracker is history, a plan, or a gap table for
one feature — and each is named below with what it is actually for.**

This exists because "what is still open?" had four possible answers in this repository, and no two
of them agreed. That is the debt this file closes first, and it is recorded as a row like any other.

## How to read a row

Each debt carries the four fields the plan requires, plus one it does not.

| field | values |
| --- | --- |
| **type** | correctness · evidence · representation · UX · research · ops |
| **state** | open · blocked · refuted · fixed |
| **severity** | P0 · P1 · P2 |
| **gate** | the named check that proves the debt is actually closed |
| **basis** | **verified** (read in the tree, with a citation) · **asserted** (believed, not yet checked) |

**`basis` is the field the plan did not ask for, and it is the one that makes the rest usable.** A
register that cannot distinguish "I read this line" from "someone told me" degrades into the four
trackers it replaces within a month. Every row below is marked, and the asserted ones are asserted
*because nobody has checked them yet* — not because they are doubted.

**A gate is a check, not an intention.** "Store the engine version" is not a gate. "A stored
observation whose engine version is absent fails to load, and a fixture proves it" is.

---

## What this supersedes, and what it does not

| document | what it actually is | still authoritative for |
| --- | --- | --- |
| `PRODUCTION_READINESS_LEDGER.md` | a per-cycle **history** of defects found and closed | the narrative of how each closed defect was closed |
| `ACTION_PLAN.md` | one review's findings and the plan built from them | the argument for that plan's ordering |
| `docs/blitz/AUDIT.md` | a **gap table** for one feature at one commit | what blitz looked like before it was built |
| `docs/blitz/ADR-00*.md` | decisions, with their arguments | why each decision went the way it did |
| `docs/discovery-v2/M0_AUDIT.md` | four measured verdicts on the instrument | the numbers behind rows R-11 … R-14 |
| `docs/decisions/` | the discovery-v2 confidence ledger | the reversal condition on each node |

**None of them is a list of what is open.** This file is. Where a row below comes from one of them,
it cites it — and where a row was *only* cited rather than checked, `basis` says `asserted` and the
row is worth less than it looks. All three rows that carried that mark have since been read against
the tree; two of them turned out to describe defects that were already repaired.

> `PRODUCTION_READINESS_LEDGER.md` opens with a "Source of truth" table naming branch
> `claude/mati-user-experience-components-d7549y` and PR #24. Both are long merged. That staleness
> is row **R-01**, and it is the reason this file does not carry a branch header of its own.

---

## P0 — a claim or a record can be lost or made wrong

### R-02 · A blitz game is analysed before it is saved, so a closed tab loses it

| | |
| --- | --- |
| type | correctness | 
| state | **fixed** |
| severity | **P0** |
| basis | **verified** — was `client/src/pages/Blitz.tsx:166` running `analyseFinishedGame` with the save's effect depending on `analysis`; now two effects, the pending write first |

The order was play → analyse every position with Stockfish → *then* persist. A player who closed the
tab during analysis lost the whole game: it was never written. Nothing about the game was
recoverable, including the think times, which cannot be reconstructed from anything else.

`shared/blitz-post-game.ts` is emphatic that the engine must run *after* the game, and it is right —
but "the record is complete before the first evaluation exists" was true of the **in-memory** state,
not of anything durable.

**Gate:** a test that finishes a game, begins analysis, simulates the tab closing, reloads, and
finds the game present with its decisions and its think times intact — and which fails if the save
is moved back after the analysis.

**Closed by** a two-phase write. `toPendingRecord` assembles the record the moment the game ends and
`attachBlitzAnalysis` fills the verdict in afterwards, against a `WHERE analysis_state = 'pending'`
that makes the second write a no-op if it has already happened.

`tests/client/the-tab-closed-during-the-analysis.test.tsx` is the gate, and it was run against the
old ordering to check it: with the write behind the analysis and the analyser's search never
returning, **all four assertions go red**. There is no way to make them pass except by writing the
game before the engine starts.

**What the fix had to add to stay honest.** A null `cpLoss` used to mean one thing — the evaluator
could not answer. Writing early would have made it mean two, which is the failure this repository is
built around, so the game now carries `analysis_state`. Rows written before today get
`legacy-unknown` and are never backfilled to a real state: see the hand-written note at the top of
`drizzle/migrations/0013_watery_infant_terrible.sql` for why `pending` and `complete` are both lies
about a game nobody observed.

### R-19 · A think time was a fraction of a millisecond, so no blitz game was ever stored

| | |
| --- | --- |
| type | correctness |
| state | **fixed** |
| severity | **P0** |
| basis | **verified in a real browser** — localStorage held no blitz record after a completed game on `main`, while the screen said *"המשחק עצמו נשמר"* |

`performance.now()` returns a **double**. `thinkMs` was the difference between two of its readings,
so an ordinary move produced `4183.199999999997`, and the stored record's schema requires an
integer. Every write was rejected. The blitz route had never persisted a single game in a browser,
on any build, since the route existed.

**R-02 is the row this one embarrasses.** R-02 says the game is now written before the engine runs,
and it is — the ordering is correct and its gate is real. But the write it protects was failing for
an unrelated reason the whole time, so "the record survives a closed tab" was true of an ordering
and false of the product.

**Why three layers of green tests could not see it.** Each was green for a different reason, and
they are worth naming separately because the same three exist for every other measurement here:

| layer | why it passed |
| --- | --- |
| the shared suites | hand-built fixtures, integers by hand |
| the jsdom suites | every one of them mocks `performance.now()` to whole milliseconds |
| the browser audit | asserted a **card**, which the screen drew from its own in-memory copy |

The single property separating every fixture from reality was the single property the schema
checked. This is the argument for LAW 3 in one defect: the screen was reading its own state instead
of the record, so it could report a save that had not happened.

**Closed by** `shared/measured-duration.ts` — the only place two clock readings become a stored
duration. It rounds at the **source** rather than at the store, so the value the game state holds is
the value that is written; and it rounds rather than floors, because flooring biases every
observation down by half a millisecond, which is a measurement error rather than a type error.

**Gate:** `tests/shared/a-clock-that-does-not-tick-in-whole-milliseconds.test.ts`, whose property
cases draw fractional readings rather than assuming whole ones. Reverting `durationMs` turns four of
its eight cases and all four R-02 cases red.

### R-03 · No engine version is stored, and the engine is already known to change verdicts

| | |
| --- | --- |
| type | evidence |
| state | **fixed** |
| severity | **P0** |
| basis | **verified** — was `resultSchema` (`shared/decision-atom.ts`) storing `engine_eval_cp`, `engine_best_move`, `engine_depth`, `engine_source`, `cp_loss`, with a grep for `engine_version` / `engine_build` over `shared server drizzle` returning nothing |

`engine_source` names *which family* answered (`local_sf18` / `lichess_cloud`). It does not name the
build, and nothing records the requested search limit against the depth actually reached, the
evaluation after the move, or when the analysis ran.

**This is not hypothetical.** `docs/ACTION_PLAN.md` §B1 measured what an engine change does to this
product's own numbers: **13.61% of decisions flipped verdict** (216 of 1,587) between the engine
that produced the published numbers and the engine that ships, and only **1 of 38** buckets was
stable to display resolution. A record that cannot say which engine scored it cannot be pooled
across a version bump — and nothing currently stops that pooling.

**Gate:** an observation with no engine build fails to load into any analysis, named as
`unreadable` rather than dropped; and a fixture from before the field existed loads with its
calibration marked unreadable while the rest of the game stays readable.

**Closed for blitz, open for the untimed loop — and the split is the honest statement, because the
two paths store their observations in different tables.**

*Blitz, done:* `blitz_games` carries `analysis_engine`, `analysis_engine_build`, `analysis_depth`
and `analysed_at`, taken from the content hash of the wasm rather than from `package.json` (the
range is `^18.0.8`, so the binary can change without any version string a build could embed changing
with it: `client/src/lib/engine-identity.ts`).
`tests/client/the-tab-closed-during-the-analysis.test.tsx` asserts the screen actually supplies them;
the wire schema refuses a `complete` game that cannot name what scored it; and
`shared/blitz-strata.ts` refuses to pool two builds or two depths, with an unrecorded instrument
excluded as `instrument-unrecorded` rather than dropped.

*The untimed loop, done:* `resultSchema` gained `engine_build`, `decision_reveals` gained the
column, and `Home.tsx` supplies it from the same content hash. `engine_build` is part of the verdict
for the replay check, so a second reveal from a different binary is a `CONFLICT` rather than a
replay. `StratumKey` in `shared/evidence-policy.ts` gained the build as a third axis, so two
recorded builds are two populations; and `scoreDecisions` — *"the one place a missing confidence is
handled"* — refuses a verdict that names no engine and counts it as `withoutInstrument`.

**Gate:** `tests/shared/a-verdict-that-cannot-name-its-engine.test.ts`, checked by breaking it three
ways: remove the scorer's refusal and 2 assertions go red; drop the build from the stratum key and 2
do; sort strata by row count instead of by scoreable rows and 1 does.

### What this costs, because it is not small and it is not a bug

**Every decision revealed before today becomes unreadable for calibration**, which on an existing
record is all of them. That is the intended price. `shared/evidence-policy.ts` made the same trade
when it was written — *"a source does not become eligible because excluding it leaves too little
data"* — and the same sentence applies to an instrument nobody wrote down.

Three things bound it. The cost is **temporary**: every decision taken from here on carries its
build, so the record refills. It is **partial**: only the calibration is refused. The decisions
remain readable as history — `forDescriptiveHistory` is unchanged, and the record page still shows
the player everything they did. And it is **named, not silent**: the count reaches the screen as
`withoutInstrument` with its own sentence on the loop ribbon, so a player whose claim went quiet
reads why rather than reading "0 נמדדו" and concluding they have not played.

### R-04 · A blitz game records nothing about its opponent

| | |
| --- | --- |
| type | evidence |
| state | **fixed** |
| severity | **P0** |
| basis | **verified** — was `drizzle/schema.ts` `blitzGames` carrying `playedAs`, `initialMs`, `incrementMs`, `outcome`, timestamps, protocol, timing, sampling and no opponent column |

Every blitz claim is therefore a claim about *playing one colour against whatever the build used at
that moment*, stated as a claim about the player. If the opponent engine's depth changes between
builds, the population changes and nothing records that it did.

**Gate:** the opponent's type, engine, build and search policy are stored per game, and a reading
that spans two different opponent policies reports them as separate strata rather than pooling them
— the wall `shared/evidence-policy.ts` already draws for protocol and reveal timing.

**Closed in two steps, and both clauses are done.**

*Recording:* `blitz_games` carries `opponent_kind`, `opponent_engine`, `opponent_engine_build` and
`opponent_depth`, written on the **pending** record rather than the scored one — deliberately,
because the opponent is a fact about the game, known when it ends, while the analysis is a fact
about a later search. Attaching it to the scored write would have made it conditional on an engine
finishing, so every game abandoned mid-analysis would carry no opponent — and those are exactly the
rows most likely to be abandoned.

*The wall:* `shared/blitz-strata.ts` is the only way to read blitz decisions for a calibration
reading, and it returns **strata**, never a set. Two opponent policies are two strata; there is no
function on the module that flattens them, for the reason `evidence-policy.ts` gives about its own
shape — refusing to provide the operation is stronger than documenting that it is wrong.

**Gate:** `tests/shared/two-opponents-are-not-one-population.test.ts`, and it was checked by
breaking the wall three ways rather than by trusting it. Drop the opponent from the stratum key and
1 assertion goes red; drop the analyser and 3 do; let an unscored game count as readable and 2 do.
It also asserts the other direction — colour, outcome and time control are **not** conditions of the
measurement, and a wall that split on them would give every stratum n=1 and a detector that can
never say anything.

---

## P1 — the record cannot be trusted to mean what it says

### R-01 · Four documents track "what is open" and none of them is the register

| | |
| --- | --- |
| type | ops |
| state | **fixed** |
| severity | P1 |
| basis | **verified** — see the supersedes table above |

**Gate:** `GATE-REGISTER-RECONCILED`, and it is not the gate this row first described.

The gate written here originally was *"a check that fails when a document other than this one
introduces a status column, or when this file's row count drops without a row moving to `fixed` or
`refuted`"*. It was never built, and it would have been the wrong check. Both halves guard against
**deletion** — a second tracker appearing, a row vanishing — and neither of the two ways this
register actually failed was a deletion:

- a P0 was found, fixed, written up in the laws, and **never given a row at all** (R-19). Row count
  did not drop; the row was never added, so nothing could notice its absence;
- three separate rows drifted from the tree they describe while sitting perfectly still — a gate
  name with no gate behind it, a ceiling quoted from the day it was measured, a trigger filed as
  unfired after it had fired.

So the gate that exists checks the opposite direction: not that rows stay, but that **what a row
says is still true of the tree**. Every claim it scans is one a register makes about something
outside itself — a path, a constant, a gate id, another register's table — because those are the
claims that rot without anybody touching them. `scripts/register-scan.ts` holds the predicates and
runs them over `tests/fixtures/registers`, which is the four documents reduced to the drifts they
actually had.

### R-05 · The local record is shallow-merged into the current shape and never migrated

| | |
| --- | --- |
| type | correctness |
| state | **fixed** |
| severity | P1 |
| basis | **verified** — was `client/src/lib/local-record-store.ts:206`, `{ ...empty(), ...(JSON.parse(raw) as Partial<Persisted>) }` inside a `try` whose `catch` returned `empty()` |

`decision-lab.record.v1` grows by having new keys filled in from `empty()`. That silently converts
four different situations into one:

```
no record  ≠  an old record  ≠  a corrupt record  ≠  a record that cannot be interpreted
```

A stored confidence with no scale is the sharpest case: it must not be guessed at. The rest of that
game is still perfectly readable; only the calibration is not.

**Gate:** a fixture of every historical schema loads and yields **exactly the meaning it had when it
was written**, and a field that cannot be interpreted is marked `unreadable` rather than defaulted —
with the game around it still readable.

**Closed by** `LOCAL_RECORD_VERSION`, fifteen typed per-key reads, and a `localRecordHealth()` that
distinguishes the four states the shallow merge collapsed into one.

**The sharpest case turned out not to be the confidence scale.** It was this: a blob that would not
parse read as empty, and *then the next write overwrote it*. One damaged byte plus one ordinary
commit destroyed everything the player had — the only place in this product where a record could be
destroyed rather than merely mis-read. A damaged record now keeps its bytes: the session downgrades
to memory (the same downgrade a full quota already triggers, reached by another route), so the
product stays usable, `localRecordDurability()` reports `session-only`, and a later build still has
something to repair.

**A fourth state nobody had named:** a record written by a *newer* build. No damage at all — load a
cached older bundle and the shallow merge keeps what it recognises, drops what it does not, and
saves the smaller record back over the larger one. It is refused for exactly that reason.

**Per-key, not per-blob.** A `claims` key holding a string costs the claims and nothing else, and
the key is named in `unreadableKeys`. Losing the whole record because one key is damaged is the same
failure as reading a damaged record as an empty one, one layer along.

**Gate:** `tests/client/four-things-that-are-not-an-empty-record.test.ts`. Restore the shallow merge
and **12 of its 13 assertions go red**; the one that survives is the empty-browser case, which is
the only one the old code got right.

### R-06 · A blitz game and its decisions are written without a transaction

| | |
| --- | --- |
| type | correctness |
| state | **fixed** (for blitz; `saveClaim` and `saveDrillResult` still carry it — see below) |
| severity | P1 |
| basis | **verified** — was `server/record.ts:551–557`, whose own comment read *"There is no transaction here — the same absence `saveClaim` and `saveDrillResult` live with"* |

The game row was inserted, then the decisions. The code deliberately ordered it so that a partial
failure left a game with no decisions rather than orphans — which is the better of two bad
outcomes, not a good one: a game with no decisions is indistinguishable from a game whose decisions
were all filtered out, and every field on the row is present and plausible.

**Gate:** failure injected between the two writes leaves **nothing** persisted, proven by a test
that fails if the writes are un-wrapped.

**Closed by** `db.transaction` around both inserts, with
`tests/server/a-game-and-its-decisions-are-one-write.test.ts` as the gate. The failure is *injected,
not mocked*: two decisions claiming the same ply violate the composite primary key, so the second
insert fails inside the real driver at exactly the point the tear used to happen. It is skipped
without a `DATABASE_URL` and runs in CI against MySQL 8 — a test that silently passes when it did
not run is the failure this repository is built around, so the skip is loud.

**What is still open, narrowed:** `saveClaim` and `saveDrillResult` are still un-wrapped. They are
single-row writes, so there is no tear between two statements to inject — the row goes in or it
does not. Left as its own question rather than folded into this one.

### R-07 · `purpose` is a claim by the client that the server cannot check

| | |
| --- | --- |
| type | evidence |
| state | **fixed** — `drill` first, `transfer` one wave later |
| severity | P1 |
| basis | **verified** — was `shared/decision-atom.ts:213`: *"This is a claim by the client … and a reading that treats it as verified is reading more than the field carries"* |

Everything else on the atom is re-derived server-side — the phase from the FEN, the legal-move count
from the position — *precisely so a wrong label cannot bias what the record is divided by*.
`purpose` is the exception, and it is the field that decides whether a decision enters discovery at
all (`shared/evidence-policy.ts`).

**Gate:** a decision claiming `drill` carries a `drill_id` the server can resolve to a drill that
actually contains it; an unresolvable claim is refused at the boundary.

**Closed by** `drill_id` on the atom, immediately after `purpose` in `ATOM_FIELDS` because it is
what turns that label into a claim somebody can check. `commitDecision` verifies three things, and
the third is the one that matters: that an id was sent, that it names a drill this record holds, and
**that the drill contains this position**. The first two alone would let any drill id launder any
decision — a player could answer forty free-play positions carrying one stale drill id and have
every one of them excluded from discovery.

**Why `drill` and not the other five.** It is the label that moves a decision *across* the wall
`shared/evidence-policy.ts` draws. Discovery refuses a drill decision outright, because a drill
selects positions *because of* a weakness and names what is being tested before collecting the
evidence. Mislabel a drill decision `play` and the attempt to fix a weakness manufactures the next
one; mislabel a free-play decision `drill` and it is silently dropped from the population it belongs
to. One field, both directions.

**A failed binding refuses rather than downgrades.** Storing it as `play` would put the drill's
output into discovery — the exact harm. Storing it as `drill` unbound would keep the trust the check
exists to remove.

It also gives `EVIDENCE_POLICY` something it has been asking for: that table already files a drill
decision as `scoped(to: "matching-test")`, and until now nothing could say which test was the
matching one.

**Gate:** `tests/shared/a-label-with-nothing-behind-it.test.ts`. Remove the position check and the
assertion written for it goes red on its own.

### `transfer`, and why the reason it waited was wrong

The first pass called this the smaller hole, because *"a transfer's observations are written through
`recordTransferObservation`, which knows which transfer it is inside"*. That call does resolve the
transfer and does check the position — and it is a **second** call, made after the decision has
already been committed, which nothing obliges a client to make. The decision itself was stored
carrying the label with no binding, and it is the **decision** that `EVIDENCE_POLICY` reads.

The harm is the drill's, in both directions. Discovery refuses a `transfer` decision outright —
*"taken while deliberately applying a rule; that is the intervention working"* — so a free-play
decision mislabelled `transfer` is dropped from the population it belongs to, and a transfer check
mislabelled `play` walks the intervention into the evidence meant to test it.

**Closed by** `transfer_id`, beside `drill_id` in `ATOM_FIELDS` because it is the same fact about
the other label. `commitDecision` checks the same three things, and the third is again the one that
matters: that an id was sent, that it names a transfer this record holds, and that **that transfer
named this position in advance**. The first two alone would let one open transfer launder every
decision a player takes while it is open.

It also answers what `scoped(to: "matching-transfer")` has been asking, in the words the drill row
used: `EVIDENCE_POLICY` already files a transfer decision as readable against its own transfer's
verdict and no other claim's, and until now nothing on the row could say which transfer was the
matching one. `NAMED_IN_ADVANCE` in that file — *"a transfer is graded on the positions it named in
advance"* — was a comment until this check existed.

**Matched by position, not by string,** and the two rules had to agree: `recordLearningTransferObservation`
finds its slot with `samePosition`, which ignores the move counters. A boundary comparing raw FENs
would let a decision pass one check and fail the other, and the run would stall between two rules
that each think they are right.

**And the pair is unrepresentable rather than merely refused.** The boundary refuses a decision
carrying both ids — one decision is inside one test — but the screen also cannot build one:
`namedTest` in `client/src/lib/decision-session.ts` derives both from the one `purpose`, so a
transfer check taken while a drill is open never constructs the drill's id.

**Gate:** `tests/shared/a-label-with-nothing-behind-it.test.ts` — send `purpose=transfer`, a
`transfer_id` that resolves, and a position that transfer never registered; the server refuses and
stores nothing. Removing the binding turns six of the eight transfer cases red.

### R-08 · Attribution: a validated claim can name the wrong subgroup

| | |
| --- | --- |
| type | research |
| state | **measured and deferred** — the test exists and is gated; it is not wired in, and the trigger is written down |
| severity | P1 |
| basis | **verified by measurement** — `docs/discovery-v2/M0_AUDIT.md` §Q4 (11,600 records) and `q5_attribution.py` (3,600 more) |

On a world where the true effect lives in a region no bucket can express (`fast AND endgame`), the
shipped chain **validates a claim naming the wrong subgroup on 11% of records**. The judge cannot
catch it: it tests the bucket that was frozen, and that bucket really does separate — it merely
overlaps the truth.

Error control against "nothing is there" is intact (0 false validated claims in 8,000 null
records). **Attribution is not**, and no amount of tightening the false-positive rate touches it.

**Gate:** an attribution test that distinguishes the named region from a bucket that overlaps it,
run on the planted worlds, with a stated ceiling on the wrong-subgroup rate.

**Built:** `shared/discovery/attribution.ts` — homogeneity within the claimed bucket. Split it by
each of the other bucketings and ask whether the gap inside is homogeneous; if some division carries
the whole thing, the claim is not attributable to the name it was frozen under. It **withholds and
names**, and does not rename: renaming would choose a region after seeing the outcome, on the data
the claim is being judged against, which is the post-hoc move R5 exists to forbid.

**Measured:** `research/discovery-oracle/q5_attribution.py`, 3,600 records over nine planted worlds,
with the choice rule declared before the run. `ATTRIBUTION_K = 2.5` — worst false veto 5.6%, mean
caught 9.2%.

### The finding is not the threshold

**At the record size the product actually sees this is a wash**: 7% of misattributions caught for 6%
of true claims withheld, on a chain Q4 already measured as silent more than half the time. Holding
the derivation half at 20 games and growing only the validation half shows why:

| validation games | false veto (k=3.0) | caught (k=3.0) |
| --- | --- | --- |
| 20 | 0.0472 | **0.0000** |
| 60 | 0.0130 | **0.2283** |
| 140 | 0.0150 | **0.4729** |

**The test is not weak. The record is small.** Same bottleneck Q4 found one level up: a bucket is a
fraction of the record and each split halves it again.

**So it is `DEFER`, not `done`** — implemented, gated, measured, and deliberately not called from
any claim path, because at 20 validation games it would make an already-silent product quieter for
almost nothing. The trigger that turns it on is a fact about a record rather than a judgement, so it
can be evaluated automatically: **60 validation games.** Full reasoning and three other reversal
conditions in `docs/decisions/D08-attribution.md`.

**Gate:** `tests/discovery/a-bucket-that-only-contains-the-answer.test.ts`, which asserts the
direction of the trade rather than the value of `k` — the value belongs to the measurement.

**A defect it turned up on the way,** unrelated to attribution and now fixed:
`gapDifferenceStandardError`'s guard against a degenerate bucket was **dead code**. Sixty doubles
each exactly 0.8 average to 0.7999999999999993, so a perfectly uniform sample has a variance of
6.1e-31 rather than 0, and the `<= 0` test never fired — while that function's own comment records
the case firing on up to 13% of records against a 2% ceiling. `summarise` now answers "did this
sample vary at all" structurally. Gate: `tests/shared/a-bucket-that-never-varied.test.ts`.

### R-09 · The engine scan fails on the deployed preview

| | |
| --- | --- |
| type | correctness |
| state | **open**, no longer blocked — two defects found and fixed; the reporter's own case unconfirmed |
| severity | P1 |
| basis | **verified by running the built bundle in a browser**, not by inspection |

Reported live. The games import correctly; the failure is in `scan()`
(`client/src/components/ImportGames.tsx:173`), the Stockfish stage.

What is established: both source APIs are healthy and send `access-control-allow-origin: *`; the CSP
in `vercel.json` lists both origins; the engine is the single-threaded build so no
`SharedArrayBuffer`/COEP requirement applies. And because `readableFailure` passes Hebrew through
verbatim while **both** of the engine's own failure messages are Hebrew, the error that surfaced
must be a non-Hebrew one — which narrows it to `"Analysis superseded"` or
`"Stockfish worker unavailable"`. They need opposite fixes.

**Gate:** the scan either completes or reports a cause a reader can act on; no path reaches the
generic fallback with an English error behind it.

### It stopped being blocked, because the console line was reproducible here

This session has Chromium. `npm run build` output was served on localhost **with the response
headers read out of `vercel.json`**, so the CSP, COOP and MIME types are the deployment's own, and
the scan was driven over 12 real Lichess games.

**It completed, in ~40 s.** So the engine, the worker, the wasm, the CSP, the MIME types and the
import are all sound on this build. That is a negative result and it is the useful kind: it removes
the whole class the diagnosis would otherwise have started from.

### Two defects the run did find

**1. The engine's 15-second budget was a download budget.** Measured on the built asset in that same
browser: once the bytes are local the engine answers `uciok` in **282 ms** — 37 ms to fetch the
7,295,411-byte wasm, 5 ms to compile. So the bound was never about the engine thinking. It was about
5.6 MB gzipped arriving, which inside 15 s needs **3.0 Mbit/s sustained**; at 1 Mbit/s that payload
takes 45 s and at 500 kbit/s it takes 90 s. Raised to 60 s, with the arithmetic written beside the
constant.

**2. A client that failed once was dead for the life of the page — and this is the real one.**
`start()` memoised `readyPromise` and nothing cleared it on failure, while `Home.tsx` keeps **one**
client in a ref for the whole page. So the first readiness failure became that client's permanent
answer: every later search awaited the same rejected promise and failed instantly, with no worker
built and no request sent. The message said *"check your network connection and try again"* and
trying again was the one thing that could not help. `fail()` now drops the promise and terminates
the worker it gave up on.

**Gate:** `tests/client/an-engine-that-gave-up-once.test.ts`. Restore the cached rejection and 2
assertions go red; restore the 15-second bound and 1 does.

### What is still not established, said plainly

**Which error the reporter actually hit.** Their screen showed the *fallback*, and `readableFailure`
passes Hebrew through verbatim — so whatever threw had a non-Hebrew or empty message, which neither
engine failure has. The two fixes above are real defects on the path, but nothing here proves either
one is theirs.

So the diagnostic gap is closed instead of guessed at: the scan's failure now renders the raw text
behind a closed `<details>`, the way the commit path already does. A player who hits it again can
say *which* stop it was without being asked to open a console — which was the thing this row was
blocked on, and was always the wrong thing to ask.

---

### R-17 · A stored blitz confidence carries no scale and no grid version

| | |
| --- | --- |
| type | correctness |
| state | **fixed** |
| severity | **P1** |
| basis | **verified** — was `drizzle/schema.ts` `blitz_decisions.confidence` as a bare `int` with no
scale column beside it, while `decisions` had carried both since R-10 |

`decisions` carries `confidence_scale` and `confidence_grid_version`. `blitz_decisions` carried
neither and stored a bare `confidence: 6`. Six of what, on which grid, was answerable only from
whichever build happened to be reading — which is a property of the reader, not of the row.

**Worse here than in `decisions`, which is why this is P1 and not P2.** The blitz row is the only
place a confidence is recorded during a timed game, and the whole reason the blitz route exists is
to measure calibration under time pressure. `shared/confidence.ts` names two open questions that
would move the seven probabilities while leaving the count at seven; on that day every stored blitz
level would silently assert a different number, with the count still matching and the word under the
button unchanged.

**Found sideways, and that is the argument for building the projection first.** Nothing had ever
read these rows, so nothing had been forced to answer "what does this integer mean". `BlitzReading`
had to.

**Gate:** `tests/shared/a-blitz-confidence-with-no-scale.test.ts` — a stored row with no scale is
read on the scale the blitz route has always shipped AND reports that it was dated rather than read;
a fresh row that omits the scale is refused at the wire boundary; a row from a newer build is
reported unreadable rather than re-read on today's grid.

**Closed by** two nullable columns, never backfilled, plus `blitzConfidenceOf` — the one reader
allowed to date an old row, and required to say that it did, so a denominator can report how much of
itself rests on an inference about age.

---

### R-18 · Two of the six buckets are structurally dead on a blitz record

| | |
| --- | --- |
| type | correctness · evidence |
| state | **half fixed** — the false advice is gone; the thresholds themselves are §18 and are open |
| severity | **P1** |
| basis | **verified, by measurement** — `tests/shared/a-line-nobody-crossed.test.ts` |

Measured on a realistic 3+0 record of 480 decisions — median think time 3.9 seconds, longest 9.8:

| bucket | inside | outside |
| --- | --- | --- |
| `fast-under-45s` | **480** | **0** |
| `slow-over-2m` | **0** | **480** |
| `phase-opening` | 120 | 360 |
| `phase-middlegame` | 240 | 240 |
| `phase-endgame` | 120 | 360 |
| `clock-under-1m` | 156 | 324 |

Forty-five seconds is a quarter of the entire clock in a three-minute game and two minutes is two
thirds of it. So the bucket the product's whole narrative rests on — *when you have little time, you
commit before you have checked* — **can never be read on the route built to measure time pressure**.
The other four work, which is what makes this a defect in the thresholds rather than in the idea.

**What the page did about it was worse than silence.** Both dead splits came back as
`too-few-in-bucket` with a count, so §25's new section would have told a player "thirty more
decisions" on a record where four hundred and eighty had already failed to produce one. That is the
same class of advice `no-clock-data` exists to prevent, and it is now a third reason —
`one-side-empty` — reported as a dead end that names the line nothing crossed.

**Two other defects surfaced in the same function**, both live and both older than this row:

- `readRecord` split the record with `predicate` and `!predicate`, so a decision the bucket **cannot
  read** landed in the comparison set. `bucketable` exists to stop exactly that and its own comment
  describes the failure — "we could not measure how long this took" becoming "this took more than 45
  seconds". The detector was repaired; the reading that draws the chart the player looks at was not.
- `shortBy` counted only the `inside` side, so a split whose comparison set was empty reported that
  it needed **nothing**. The screen that renders that figure did not exist when the field was
  written, which is how a number answering the wrong question survives.

**Gate:** `tests/shared/a-line-nobody-crossed.test.ts` — the saturation is asserted as exact counts
on a deterministic record; the other four buckets must stay readable on the same record, so a
degenerate fixture cannot satisfy it; a genuinely thin split must still be reported as a wait; and a
small record's empty side must NOT be called a dead end.

**Measured end to end since**, through the same harness as M0 Q4 — `research/discovery-oracle/q6_blitz_time.py`,
1,600 null records and 800 planted, blitz-only controls. On a forty-game blitz record:

| bucket | non-empty | **usable** (both sides ≥ `MIN_BUCKET_N`) | cleared |
| --- | --- | --- | --- |
| `clock-under-1m`, all three phase buckets | 1.0000 | **1.0000** | 0.0000 |
| `fast-under-45s` | 1.0000 | **0.2725** | 0.0006 |
| `slow-over-2m` | 0.5844 | **0.0037** | 0.0000 |

and a planted effect of the same strength that the middlegame recovers at **41.75% validated on
target** is recovered in the fast bucket at **0.00%**. The middlegame row is the control: it scores
0.4175 here against Q4's 0.4475 on mixed controls, so the blitz worlds are sound and the bucket is
not. The false-claim rate is unaffected — 0/1,600, upper 95% 0.0024 against the 0.02 ceiling.

**The first version of that table reported only the middle column and was misleading.** Counting a
bucket as readable when it had one decision on each side put `fast-under-45s` at 1.0000, which is
true and says nothing: `detect` needs thirty on both. The gap between 1.0000 and 0.2725 is the
finding.

**Still open, and deliberately not fixed here:** the thresholds themselves. Replacing 45 seconds with
a fraction of the clock is master-plan §18 and it cannot be done by editing a constant —
`SEPARABILITY_K = 3.75` is a measurement of *those six buckets searched together*, so a seventh or a
redefined one needs its own false-positive rate before it may be searched, and the six are frozen in
`hypothesis-manifest.ts`, so changing them changes the hash that makes a pre-registration mean
anything. Choosing among four candidate definitions by measuring all four and keeping the best is
itself a four-comparison search with no correction. `docs/decisions/D05-blitz-time.md` holds the
alternatives and the choice rule that has to be declared before the next run.

---

## P2 — real, bounded, and not blocking anything

### R-10 · A confidence scale can be re-meant without the record noticing

| | |
| --- | --- |
| type | correctness |
| state | **fixed** |
| severity | P2 |
| basis | **verified** — `confidence_scale` **was** stored and the grid was not (`shared/decision-atom.ts:115`, `drizzle/schema.ts:113`) |

**Narrower than the plan states.** The level and the scale are both carried, and a row without a
scale is resolved by its age rather than defaulted. What is *not* carried is a version for the
**grid** — the map from a scale to the probabilities its levels assert. `shared/confidence.ts`
holds that map keyed only by the level count, so if the seven-level grid's values ever moved (they
were chosen by measurement and could be re-chosen), every stored `level 6, scale 7` would silently
re-mean.

**Gate:** the grid is versioned and stored beside the level; a fixture written under one grid keeps
its original probability after the grid changes.

**Closed by** `CONFIDENCE_GRID_VERSION` and a `GRID_HISTORY` keyed by version, with
`confidence_grid_version` stored on the decision. `normaliseConfidence` reads the grid the level was
stated on, refuses a version this build does not know rather than falling back to the current one,
and treats absence as version 1 — a fact about the row's age, since only one version has shipped.

**The module said this about itself.** `shared/confidence.ts` opens with *"the scale is three things
that must never drift apart"* and closes by naming two open questions — Juslin's scale-end effect,
and whether the map should be linear in log odds rather than in probability — either of which would
move the seven numbers while leaving the count at seven. The record stored one of the three.

**Gate:** `tests/shared/a-grid-that-moved-under-a-stored-level.test.ts`, which **pins every
published grid by writing the numbers out again**. That duplication is the mechanism rather than a
smell: a test importing the values and comparing them to themselves passes whatever they become.
Move a published probability without bumping the version and 2 assertions go red; make
`normaliseConfidence` ignore the version it is handed and 1 does.

**One existing test had to become more exact, not weaker.** `confidence-scale.test.ts` asserted by
source regex that `levels` has no default, using `normaliseConfidence\([^)]*levels[^)]*=` — which
asks whether an `=` appears anywhere after the word `levels`, and so fired on the deliberate default
of the parameter added *after* it. The property it guards was untouched; the pattern now names
`levels` and nothing else.

> **These three were the register's only `asserted` rows, and checking them changed two.** They were
> transcribed from `ACTION_PLAN.md` and never read against the tree. Two of them describe defects
> that had already been repaired — `ACTION_PLAN.md` even records one of them as `DONE A2` — and the
> third is real but is not open in the sense "open" implies. This is what the `basis` field is for:
> a register that cannot tell "I read this line" from "someone told me" becomes the four trackers it
> replaced, and here it would have carried three phantom debts into the UX work.

### R-11 · The board declares `role="grid"` and does not implement it

| | |
| --- | --- |
| type | UX |
| state | **fixed** — was already fixed when this row was written |
| severity | P2 (raised from the P0 the review claimed — see `ACTION_PLAN.md` §1.1) |
| basis | **verified** — `client/src/components/ChessBoard.tsx:152` `onSquareKeyDown` |

`ChessBoard` implements the WAI-ARIA grid pattern: all four arrows, `Home`/`End` per rank and
`Ctrl`+either for the whole board, focus **clamped rather than wrapped** (*"focus that reappears on
the far file after ArrowRight on h4 is focus that has silently changed rank"*), roving `tabindex`,
and an `aria-live` announcer that says what the **player** did and never what the engine knows —
because a region that spoke an evaluation would be a fourth path around R3.

**Gate:** `GATE-KEYBOARD`, passing, with two positive controls that go red
(`GridWithNoKeys.tsx`, `ModalWithNoTrap.tsx`), plus `a-board-nobody-could-hear.test.tsx`.

### R-12 · `Overlay` has no focus trap and does not restore focus

| | |
| --- | --- |
| type | UX |
| state | **fixed** — `ACTION_PLAN.md` records it as `DONE A2`, and the code agrees |
| severity | P2 |
| basis | **verified** — `client/src/components/Overlay.tsx`, focus trap and opener restore |

Focus enters the panel, `Tab` and `Shift`+`Tab` cycle inside it, focus **already outside** is pulled
back (the listener is on `document` for exactly that case), and the opener is restored on close —
after the dialog leaves the screen, because restoring while it is still up re-captures the wrong
element. The focusable selector is a real one rather than `input, textarea, button`, which is *"not
a list of focusable things, it is a list of three of them"*.

**Gate:** `a-dialog-that-gives-focus-back.test.tsx`, 11 cases including the wrap in both directions
and the disabled-control skip.

### R-13 · `Home.tsx` is one 108 kB component

| | |
| --- | --- |
| type | ops |
| state | **open, and deliberately governed** — a ratchet, not a refactor, with the argument written down |
| severity | P2 |
| basis | **verified** — under a committed ceiling that only goes down; the ceiling is `LINE_CEILING = 2400` and `STATE_CEILING = 53`, and the register is held to those numbers by a test |

Real, and not the kind of open the word usually means. `ACTION_PLAN.md` scheduled C1 as *"a
mechanical extraction with the existing tests as the invariant — not a redesign"*, and
`the-file-that-only-ever-grew.test.ts` records that **there is no mechanical extraction**: of 2,358
lines, 20 are pure computation that can move: everything else closes over one of fifty-five pieces
of state in a single scope. Every real split is therefore a redesign — custom hooks, context, or
fifteen props per panel — across the most-tested surface in the repository, with no falsifiable
claim attached.

So the honest treatment is the one that shipped: a ceiling, in the same shape as the bundle budget.
**And unlike the bundle budget it may only go down** — there is no version of "this component needs
a fifty-sixth piece of state" that is better than putting it somewhere else, so raising the ceiling
would mean the refactor got further away.

**Gate:** `the-file-that-only-ever-grew.test.ts` — `LINE_CEILING = 2400` and `STATE_CEILING = 53`.

**The ceiling had not gone down, and the rule above says it must.** The UX work extracted five
times to stay under the line ceiling, and one of those extractions — `useNewGameSetup` — took the
component from fifty-five pieces of state to fifty-three. The ceiling stayed at fifty-five, which
quietly restored two slots of headroom that a refactor had just paid for. It is now fifty-three.

The line ceiling keeps its headroom deliberately, and the asymmetry is the point: length is a
symptom, and a ceiling with no room turns every added comment into a false alarm. State is the
cause, and the row's own argument — that there is no version of "this component needs one more
piece of state" that is better than putting it somewhere else — leaves no room to keep.

---

## Refuted — measured, found wrong, and recorded so it is not reopened

### R-14 · "The detector's uncertainty is too small, and a clustered judge is the fix"

| | |
| --- | --- |
| type | research |
| state | **refuted** |
| basis | **verified by measurement** — `docs/discovery-v2/M0_AUDIT.md` §Q1, 6,000 simulated records |

The premise is half true and the proposed fix is wrong. The shipped standard error *is* understated,
by 0–38% depending on how much of the calibration gap belongs to the game. But a cluster-robust
standard error — statsmodels, the reference implementation — is **worse calibrated in 82 of 84
cells** and fires *more* often under the null. Twenty games is not enough clusters for the sandwich
to estimate itself.

**Do not reopen** by proposing cluster-robust errors again. The live reversal conditions are in
`docs/decisions/D02-the-unit-of-inference.md`: a real record measuring an ICC above 0.05, records
reaching ~50 games, the chain losing its second stage, or the cluster **bootstrap** (untested, and
the one alternative that might beat both) being measured and winning.

### R-15 · "The detector finds structure in noise and needs restraining"

| | |
| --- | --- |
| type | research |
| state | **refuted** |
| basis | **verified by measurement** — `M0_AUDIT.md` §Q4 |

**0 validated false claims in 8,000 null records**, upper 95% CI 0.00048 against a 0.02 ceiling. The
defect is the opposite one: the chain is silent on a coaching-scale effect more than half the time
and on a weak one essentially always. Any future plan premised on the detector being too loud is
premised on a measurement that was made and came back the other way.

### R-16 · "Touch targets at 36×36 fail the 44 px standard"

| | |
| --- | --- |
| type | UX |
| state | **refuted** — as framed |
| severity | P2 |
| basis | **asserted** (`docs/ACTION_PLAN.md` §1.1) |

---

## What the gate on Step 0 requires before any Step 1 work begins

The plan's rule is that no new work starts until every existing P0/P1 is in this register. The gate
was met when this file was written: the P0/P1 set was fully verified, and the only three `asserted`
rows were P2.

**Those three have since been checked, and the check was worth running.** R-11 and R-12 were already
fixed — `ACTION_PLAN.md` records one of them as `DONE A2` — and R-13 is real but is governed by a
ratchet with a written argument rather than waiting for someone. Carrying them forward as open would
have put three phantom debts into the UX work, which is precisely what the `basis` field exists to
prevent.

Two things are worth saying plainly before Step 1:

**The order in the plan is right, and R-02 is more urgent than its position suggests.** It is the
only row where a user loses data they cannot get back. It is also a small change — move the save
above the analysis — and it does not depend on any of the provenance work.

**Steps 6–11 assume there will be something to show.** The representation work is built around
rendering one clear finding with an example and an evidence level. R-08 and R-15 say the current
engine produces a validated, correctly-attributed claim on **roughly 45% of records at best**, on a
clean coaching-scale effect, and **0%** when the truth is something its six buckets cannot say. A
redesign that assumes a pattern card will usually have a pattern in it will mostly render the empty
state. That is not an argument against the redesign — the empty state is the most common screen and
deserves the most care — but the plan should say which screen it is really designing.

---

## Where the master plan stands

The plan's own execution order has nineteen rows. This is where each one is, and the three
categories are not the same kind of "not done".

| # | work | state |
| --: | --- | --- |
| 1 | debt ledger + freeze | **done** — this file |
| 2 | confidence / engine / opponent provenance | **done** — R-03, R-04, R-10, R-17 |
| 3 | migrations | **done** — R-05 |
| 4 | DB atomicity | **done** — R-06 |
| 5 | persist before analysis | **done** — R-02 |
| 6 | `BlitzReading` | **done** — `shared/blitz-reading.ts` |
| 7 | a design language for evidence | **done** — `shared/evidence-authority.ts` |
| 8 | entry / resume redesign | **done** — `ResumeScreen`, §12/§13/§28 |
| 9 | post-game redesign | **done** — `PostGame`, §24 |
| 10 | Record redesign | **done** — §25 order, §26 asserted as an absence |
| 11 | reactivity experiment | **blocked on people** |
| 12 | sampling calibration | **blocked on 11** |
| 13 | a confidence-bearing corpus | **blocked on people** |
| 14 | Discovery V2 integration | **partly done** — blitz reads through the shared detector and
never gets its own; the thresholds are R-18 |
| 15 | freeze + prospective validation | **half** — the freeze exists (`hypothesis-manifest.ts`);
the prospective half needs new games |
| 16 | learning / action | **governed** — `mayPrescribe` is true for exactly one evidence level,
and nothing on any screen can reach it yet |
| 17 | browser / state / a11y gates | **done** — §29, plus a walk over eleven of fourteen states in real Chromium; the three it cannot reach are below |
| 18 | value field test | **blocked on people** |
| 19 | effectiveness study | **blocked on people** |

**"Blocked on people" is not a hedge and it is not the same as unfinished.** Rows 11, 13, 18 and 19
each require evidence from real players over time: whether being asked changes the game being
measured, whether a corpus large enough to test anything exists, whether somebody who used the
product can say what they learned, and whether any of it changes a later decision. No amount of code
produces any of those, and writing something that looked like them would be the manufactured
certainty this whole plan is against.

**What is buildable and still open** is one thing: R-18's second half. The time thresholds are wrong
for blitz, the fix is relative time, and it cannot be done by editing a constant — `SEPARABILITY_K`
is a measurement of *those six buckets searched together*, so a redefined bucket needs its own
false-positive rate from `research/discovery-oracle/` before it may be searched. Until that
measurement exists, the shipped behaviour is the honest one: say the split cannot divide this
record, and do not ask for decisions that cannot help.

### Three states the browser walk cannot reach, and why that is not a coverage gap to close

The walk over the built app renders each product state in Chromium and asserts that none is empty
or unstyled and that each offers one clear action. Eleven of fourteen were reached. The other three
are unreachable **by construction**, and forcing them would mean building a way in that the product
does not have:

| unreached state | why a walk cannot enter it |
| --- | --- |
| the sampled confidence prompt | it fires on `BLITZ_ASK_RATE = 0.15` of decisions, and the sampling is the instrument — a switch that forces it is a second code path that is not the one players meet |
| a review event | it needs a finished game whose engine pass found a scoreable event, which is a real analysis over real moves, not a fixture |
| a due learning test | `RETRIEVAL_INTERVAL_DAYS = [1,3,7,21]` — the earliest is tomorrow, and the delay *is* what is under test |

Each is covered by a rendered test with a constructed state, which is a weaker claim than the walk
makes and is recorded as such: a jsdom render can say a component draws, and cannot say the screen
is laid out. That distinction is exactly what the walk exists for, so it is written down rather than
rounded to "covered".

**The honest way to close these is time and use, not a test hook**, and two of the three close
themselves the first time a real player takes enough decisions.

**The prediction in the section above turned out to be right, and the product now says so.** The
representation work was warned that it would mostly render an empty state. It does — and the empty
state is now five distinguishable states with a named cause and, where one exists, a number drawn
from the gate that is actually blocking. That is what "the empty state deserves the most care" turned
into.
