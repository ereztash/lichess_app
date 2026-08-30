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
it cites it.

> `PRODUCTION_READINESS_LEDGER.md` opens with a "Source of truth" table naming branch
> `claude/mati-user-experience-components-d7549y` and PR #24. Both are long merged. That staleness
> is row **R-01**, and it is the reason this file does not carry a branch header of its own.

---

## P0 — a claim or a record can be lost or made wrong

### R-02 · A blitz game is analysed before it is saved, so a closed tab loses it

| | |
| --- | --- |
| type | correctness | 
| state | **open** |
| severity | **P0** |
| basis | **verified** — `client/src/pages/Blitz.tsx:166` runs `analyseFinishedGame`, `:216` calls `saveGame.mutateAsync`, and the save's effect depends on `analysis` |

The order is play → analyse every position with Stockfish → *then* persist. A player who closes the
tab during analysis loses the whole game: it was never written. Nothing about the game is
recoverable, including the think times, which cannot be reconstructed from anything else.

`shared/blitz-post-game.ts` is emphatic that the engine must run *after* the game, and it is right —
but "the record is complete before the first evaluation exists" is true of the **in-memory** state,
not of anything durable.

**Gate:** a test that finishes a game, begins analysis, simulates the tab closing, reloads, and
finds the game present with its decisions and its think times intact — and which fails if the save
is moved back after the analysis.

### R-03 · No engine version is stored, and the engine is already known to change verdicts

| | |
| --- | --- |
| type | evidence |
| state | **open** |
| severity | **P0** |
| basis | **verified** — `resultSchema` (`shared/decision-atom.ts`) stores `engine_eval_cp`, `engine_best_move`, `engine_depth`, `engine_source`, `cp_loss`; a grep for `engine_version` / `engine_build` over `shared server drizzle` returns nothing |

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

### R-04 · A blitz game records nothing about its opponent

| | |
| --- | --- |
| type | evidence |
| state | **open** |
| severity | **P0** |
| basis | **verified** — `drizzle/schema.ts` `blitzGames` carries `playedAs`, `initialMs`, `incrementMs`, `outcome`, timestamps, protocol, timing, sampling; there is no opponent column |

Every blitz claim is therefore a claim about *playing one colour against whatever the build used at
that moment*, stated as a claim about the player. If the opponent engine's depth changes between
builds, the population changes and nothing records that it did.

**Gate:** the opponent's type, engine, build and search policy are stored per game, and a reading
that spans two different opponent policies reports them as separate strata rather than pooling them
— the wall `shared/evidence-policy.ts` already draws for protocol and reveal timing.

---

## P1 — the record cannot be trusted to mean what it says

### R-01 · Four documents track "what is open" and none of them is the register

| | |
| --- | --- |
| type | ops |
| state | **open → closing with this file** |
| severity | P1 |
| basis | **verified** — see the supersedes table above |

**Gate:** a check that fails when a document other than this one introduces a status column
(`open` / `blocked` / `P0`), or when this file's row count drops without a row moving to `fixed` or
`refuted`.

### R-05 · The local record is shallow-merged into the current shape and never migrated

| | |
| --- | --- |
| type | correctness |
| state | **open** |
| severity | P1 |
| basis | **verified** — `client/src/lib/local-record-store.ts:206` is `{ ...empty(), ...(JSON.parse(raw) as Partial<Persisted>) }`; `:654` says a row "is never migrated" |

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

### R-06 · A blitz game and its decisions are written without a transaction

| | |
| --- | --- |
| type | correctness |
| state | **open** |
| severity | P1 |
| basis | **verified** — `server/record.ts:551–557`, whose own comment reads *"There is no transaction here — the same absence `saveClaim` and `saveDrillResult` live with"* |

The game row is inserted, then the decisions. The code deliberately orders it so that a partial
failure leaves a game with no decisions rather than orphans — which is the better of two bad
outcomes, not a good one. The same absence exists in `saveClaim` and `saveDrillResult`.

**Gate:** failure injected between the two writes leaves **nothing** persisted, proven by a test
that fails if the writes are un-wrapped.

### R-07 · `purpose` is a claim by the client that the server cannot check

| | |
| --- | --- |
| type | evidence |
| state | **open** |
| severity | P1 |
| basis | **verified** — `shared/decision-atom.ts:213`: *"This is a claim by the client … and a reading that treats it as verified is reading more than the field carries"* |

Everything else on the atom is re-derived server-side — the phase from the FEN, the legal-move count
from the position — *precisely so a wrong label cannot bias what the record is divided by*.
`purpose` is the exception, and it is the field that decides whether a decision enters discovery at
all (`shared/evidence-policy.ts`).

**Gate:** a decision claiming `drill` carries a `drill_id` the server can resolve to a drill that
actually contains it; an unresolvable claim is refused at the boundary.

### R-08 · Attribution: a validated claim can name the wrong subgroup

| | |
| --- | --- |
| type | research |
| state | **open** |
| severity | P1 |
| basis | **verified by measurement** — `docs/discovery-v2/M0_AUDIT.md` §Q4, 11,600 simulated records |

On a world where the true effect lives in a region no bucket can express (`fast AND endgame`), the
shipped chain **validates a claim naming the wrong subgroup on 11% of records**. The judge cannot
catch it: it tests the bucket that was frozen, and that bucket really does separate — it merely
overlaps the truth.

Error control against "nothing is there" is intact (0 false validated claims in 8,000 null
records). **Attribution is not**, and no amount of tightening the false-positive rate touches it.

**Gate:** an attribution test that distinguishes the named region from a bucket that overlaps it,
run on the planted worlds, with a stated ceiling on the wrong-subgroup rate.

### R-09 · The engine scan fails on the deployed preview

| | |
| --- | --- |
| type | correctness |
| state | **blocked** — needs one line from a browser console |
| severity | P1 |
| basis | **verified** to the boundary of what this environment can reach |

Reported live. The games import correctly; the failure is in `scan()`
(`client/src/components/ImportGames.tsx:173`), the Stockfish stage.

What is established: both source APIs are healthy and send `access-control-allow-origin: *`; the CSP
in `vercel.json` lists both origins; the engine is the single-threaded build so no
`SharedArrayBuffer`/COEP requirement applies. And because `readableFailure` passes Hebrew through
verbatim while **both** of the engine's own failure messages are Hebrew, the error that surfaced
must be a non-Hebrew one — which narrows it to `"Analysis superseded"` or
`"Stockfish worker unavailable"`. They need opposite fixes.

**Blocked on:** the console line beginning `[failure]`, which `readableFailureText` writes.

**Gate:** the scan either completes or reports a cause a reader can act on; no path reaches the
generic fallback with an English error behind it.

---

## P2 — real, bounded, and not blocking anything

### R-10 · A confidence scale can be re-meant without the record noticing

| | |
| --- | --- |
| type | correctness |
| state | **open** |
| severity | P2 |
| basis | **verified** — `confidence_scale` **is** stored (`shared/decision-atom.ts:115`, `drizzle/schema.ts:113`) |

**Narrower than the plan states.** The level and the scale are both carried, and a row without a
scale is resolved by its age rather than defaulted. What is *not* carried is a version for the
**grid** — the map from a scale to the probabilities its levels assert. `shared/confidence.ts`
holds that map keyed only by the level count, so if the seven-level grid's values ever moved (they
were chosen by measurement and could be re-chosen), every stored `level 6, scale 7` would silently
re-mean.

**Gate:** the grid is versioned and stored beside the level; a fixture written under one grid keeps
its original probability after the grid changes.

### R-11 · The board declares `role="grid"` and does not implement it

| | |
| --- | --- |
| type | UX |
| state | **open** |
| severity | P2 (raised from the P0 the review claimed — see `ACTION_PLAN.md` §1.1) |
| basis | **asserted** — from `ACTION_PLAN.md`, not re-checked here |

**Gate:** `GATE-KEYBOARD`, which the plan already specifies.

### R-12 · `Overlay` has no focus trap and does not restore focus

| | |
| --- | --- |
| type | UX · state | open · severity | P2 · basis | **asserted** (`ACTION_PLAN.md`) |

### R-13 · `Home.tsx` is one 108 kB component

| | |
| --- | --- |
| type | ops · state | open · severity | P2 · basis | **asserted** (`ACTION_PLAN.md` §5, where a first extraction attempt is recorded as having failed) |

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
| type | UX · state | **refuted as framed** · basis | **asserted** (`ACTION_PLAN.md` §1.1) |

---

## What the gate on Step 0 requires before any Step 1 work begins

The plan's rule is that no new work starts until every existing P0/P1 is in this register. Three
rows are **asserted** rather than verified (R-11, R-12, R-13), and all three are P2 — so the P0/P1
set is fully verified and the gate is met.

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
