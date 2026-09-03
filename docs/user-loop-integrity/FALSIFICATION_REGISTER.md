# What would reverse each of this mission's claims, and what is still open

Two halves. The first is every claim this mission makes, with the observation that would take it
back. The second is every question it could not answer, with what would resolve it.

---

## A. Claims, and their reversal conditions

| # | claim | evidence level | what reverses it |
| --- | --- | --- | --- |
| C1 | At `c1d7293`, a board press after the commit played a move for whichever side was to move, in both loops and at four viewports | `L5` — driven in Chromium against the production build, engine not intercepted | a walk at that SHA in which the position does not change; the walk scripts are in `evidence/` |
| C2 | On the primary customer journey the continuation handed the player **the opponent's turn**, and a decision taken there was written to the record | `L5`, reproduced in a clean worktree of the untouched baseline | a front-door walk at `c1d7293` in which the side to move after the continuation is the player's own |
| C3 | The continuation deleted plies of a loaded game the player had rewound into (18 → 11) | `L5` | the same walk showing the ply count unchanged at that SHA |
| C4 | The reveal rendered unchanged over a board that had been navigated four plies away | `L5` | a diff between the two reveal texts at that SHA |
| C5 | The fixes hold each of those four properties in the built app | `L5` — `tests/layout/the-hand-that-may-move-the-board.layout.test.ts`, six cases | any of its six cases going red, or a path around it that the file does not drive |
| C6 | Controls on the primary loop are **not** perceptually inert | `L5`, computed styles before/after each press | a control on that loop with no self-delta and no screen advance |
| C7 | The geometry defect of `INTERACTION_GEOMETRY.md` does not recur | `L5`, four viewports | a rendered square below `--tap-floor` at any width |
| C8 | A piece of the side not to move cannot be selected, and the player's own hand still can | `L5` | either half of that case going red |
| C9 | The counterfactual probe refuses an alternative illegal in the position it asked about | `L2` — a pure function and its map; the browser walk that found it is in the adversarial record | `boardAuthorityFor` granting `name-alternative` off the question's position |

**What C1–C4 do not establish:** that these were the *only* ways the loop could break. They are what
five attacks found. `evidence/` records what was driven; nothing claims coverage.

**One claim was withdrawn during this mission and the withdrawal is kept.** C2 first read *"the
journey dead-ended, with the toolbox hidden"*. The walk that produced it probed White's pieces only.
Re-probed on both colours, the loop continues — on the opponent's hand, and into the record. The
weaker, wrong claim is recorded here rather than deleted because it is the shape of error this
repository is built to catch: an instrument that could only see one side, reporting the absence it
was blind to.

---

## B. Open, with the trigger that would close each

### `OWNER-REQUIRED` — **CLOSED 2026-09-03 by owner decision**

All three are settled. `O-2` and `O-3` were consequences of `O-1` and are recorded as derived
rather than as separate decisions.

**`O-1` Should the reveal route to the next position, or should the player pass through the record?**
**DECIDED: A, the direct route.** After a reveal whose game holds no further position -- which is
every front-door arrival, because the handoff carries exactly one -- the player is routed straight
to the anchor set's next unanswered position, in one press.

*The owner's reason, in the owner's terms:* the first trial measures whether the reveal created
enough value for the player to take another decision. The route it replaced was reveal → record →
find *"העמדה הבאה"* → land → decide, and that put navigation friction inside the measurement.
Friction is not part of the value proposition, so it is removed from the instrument rather than
measured as part of it.

*What the previous route was, kept because a decision without its alternative is not a decision:*
`RevealNoContinuation` said the loaded game had no further position and offered `return-record`.
That was correct at the time and for its own reason -- the only continuation then available was the
fork, which played the committed move into a game with no opponent. `O-1` does not reverse that
finding; it supplies a way on that is not the fork.

*The set-complete case is unchanged.* A player who has answered all sixty bank positions is still
routed to the record, because for them there genuinely is nowhere else.

**Reversal condition.** A measured continuation rate on the direct route that is indistinguishable
from the two-press rate would say the friction was not the confound the decision assumes it was.
That comparison needs both arms and therefore a field trial; it is not a repo question. A second
reversal is cheaper and internal: any walk in which the one press leaves the player somewhere they
cannot legally move, which would mean the route re-introduced what it was built to remove.

**Held by** `tests/layout/the-loop-a-stranger-can-close.layout.test.ts` and the rewritten
continuation case in `tests/layout/the-hand-that-may-move-the-board.layout.test.ts`.

**`O-2` `next_decision_started` on the front-door path. DERIVED FROM `O-1`, AND TIGHTENED.**
The owner's rule: removing the navigation confound does not lower the continuation bar. The event
is recorded only when, after a prior reveal, the player is shown a legal position in which it is
THEIR turn, and places a legal move in it. Not on a route change, a press of the way-on control, a
render of a position, entry to a screen, or the selection of a game.

`continuationStarted` now takes four clauses rather than three; `positionWasActionable` is the new
one and it used to be carried only by the board's own guard, which was absent on the front door at
`c1d7293`. `GATE-CONTINUATION-IS-A-MOVE` reads the source for the three ways this decays -- a
caller that stops consulting the predicate, a clause hard-coded at the call site, a second writer
elsewhere in `client/src` -- and each was deliberately introduced into the real tree and went red.

**Reversal condition.** A ledger carrying `next_decision_started` on a visit where no move was
placed after a reveal.

**`O-3` `ASK_AFTER_REVEALS = 2` and the front door. DERIVED FROM `O-1`. THRESHOLD UNCHANGED.**
The value question is still put after the second reveal. Before `O-1` a front-door stranger never
had a second reveal available, so the threshold was unreachable on that path; the decision was to
fix the route rather than move the instrument. Walked end to end on the built app: reveal #1 → one
press → bank position → move → decision #2 → reveal #2 → the question. The question is confirmed
absent on the first reveal, which is the moment continuation is being measured.

**Reversal condition.** A front-door walk reaching a second reveal without the question, or the
question appearing on the first.

### `FIELD-REQUIRED`

**`F-1` Is the reveal's payoff perceptible where it is put?**
Measured, not judged: at 1440x900 and 1920x1080 the finding block begins at y=444 in a viewport of
900/1080 — above the fold. At 390x844 the reveal begins at **y=899 in an 844px viewport** and the
finding at **y=1144**, so a handset shows the board and nothing else after a commit. (The first
version of this row said 893 and **1120**. 893 was the baseline figure and 1120 was neither: the
baseline evidence says 1138 and the repaired tree measures 1144. An adversarial pass caught it.
Both figures are re-measured on the tree they describe.) The order of the
four blocks is declared non-negotiable in `RevealPanel`'s own header and **was not touched**;
nothing measured here licenses moving it. **Trigger:** the acquisition trial, whose funnel already
separates `reveal_presented` from what a person did next.

**`F-2` Can a newcomer tell `F1` from `F2` on the built screen?**
`ONE_THING_EVIDENCE` / `EVIDENCE_LABEL` renders the distinction as one line
(*"המשפט הזה יצא מהשוואה למנוע בלבד — לזה גם ניתוח משחק רגיל היה מגיע"*). Whether a reader receives
it is an interpretation question this mission cannot answer from a DOM.
**Trigger:** the value-reconstruction question already in the product.

**`F-3` Is the first payoff worth continuing for?**
Untouched by this mission. Mechanical closure is not value.

### `RESEARCH-GATED`

**`R-1` Does a locked board after the commit change how people decide?**
The board now refuses a gesture where it used to accept one. That is a defect repair, not a cue —
no information was added and nothing about the decision is revealed earlier. But "the board stops
responding" is a change to what a player experiences between the commit and the reveal, and whether
it changes decision time or completion is not measured here. **Trigger:** the burden/reactivity
protocol `docs/INERTIAL_UX_LAWS.md` already names for instrument friction, if the acquisition trial
shows a completion difference at that step.

**`R-2` A live game whose committed move ends the game.**
`continuationAfter` checks the landing on the `advance` branch and cannot on `play`: the landing is
the position after the committed move **and** the opponent's reply, neither of which exists when it
runs. A player who commits mate therefore reaches `deciding` on a finished board. Established from
source by an adversarial pass, not driven. **Trigger:** a live game walked to mate in Chromium, which
would say whether the opponent effect already covers it.

**`R-3` The board still announces an affordance it does not have.**
At `revealed` the grid's label reads *"חצים להזזת המיקוד, Enter לבחירה"* and all 64 squares stay
enabled, while Enter correctly selects nothing. Measured. Whether an AT user is better served by a
label that changes with the authority or by one that stays stable is an interpretation question, and
this mission has no evidence either way.

### `NOT-A-DEFECT`

- The reveal's four-block order. Measured, recorded, unchanged.
- The commitment accordion's step count. It is the instrument (LAW 9).
- `GATE-TWO-HANDS` being chromatic. It is correct for the question it answers; it simply had no
  behavioural sibling until now.

---

## B2. Adversarial pass on the `O-1` change, 2026-09-03

Four claims, attacked rather than confirmed. Driven in Chromium against the built app with the
shipped engine, five consecutive routes in one session.

**A-1 — "Direct-next does not record continuation before a move." SURVIVES.**
`next_decision_started` is written in exactly one file, `client/src/lib/continuation-event.ts`; the
grep over `client`, `shared` and `server` finds no other writer and no `recordTrialEvent` call with
a computed name. Measured in the walk: the ledger carries **1** `next_decision_started` against
**6** `reveal_presented` and **6** `decision_committed`, and the browser assertions confirm it is
absent before the press, absent after the press, and present after the move.

**A-2 — "The player is always handed a position they may act in." SURVIVES, with a scope note.**
Five consecutive routes, five positions, five accepted moves, and `staleReveals=0` on every one.
The scope note is real and is a property of the bank rather than of the route: an anchor is a
loaded position with **no opponent**, so `positionIsActionable`'s turn clause
(`opponent === null || turn === opponent.playerColor`) is vacuous there and the player answers for
whichever side is to move. The sides across the five were `w, b, b, w, b`. That is what an anchor
is — *"what would you play here"* — and not the `c1d7293` defect, which was a **live** game whose
turn had been passed to a side nobody was playing. Recorded so nobody later reads
`positionWasActionable` as a claim about colour.

**A-3 — "Reveal #2 does enable the value-reconstruction prompt." SURVIVES.**
`value_reconstruction_prompted: 1` against six reveals: put once, after the second, and never
again — which is `ASK_AFTER_REVEALS = 2` and *once per browser*, both unchanged. The dedicated walk
also asserts it is **absent** on the first reveal, which is the half that matters, because a
question there would be measured instead of the continuation it interrupts.

**A-4 — "Routing did not damage the record, history or decision ownership." SURVIVES.**
Five decisions, **five distinct game ids** (`lichess-abcd1234`, then four `anchor-*`), so no game
was forked, truncated or merged — the `LAW 4` failure that cost a loaded PGN seven plies is not
reachable by this route, which serves a new game rather than advancing an old one. Purposes are
intact: `first` on the imported decision and `anchor` on all four bank decisions, which is
`firstDecisionPly: null` doing its load-bearing job. No decision carries two names.

**What this pass does not claim.** That these are the only ways the change could break. Four
attacks were named in advance and four were run; nothing here asserts coverage.

---

## C. The falsification pass — every fix deliberately broken, and what went red

Run after implementation, on the built app in Chromium. Each break was applied alone, rebuilt, and
`tests/layout/the-hand-that-may-move-the-board.layout.test.ts` re-run, so every control is red for
its own reason rather than for its neighbour's.

| break | what was changed | red | green |
| --- | --- | ---: | ---: |
| B1 | `ChessBoard`: `const live = true` — the board accepts a gesture in every state | **3** — both hands, targets offered, a square lit | 3 |
| B2 | B1 **plus** `Home`'s original `if (stage !== "deciding") { playMove(...) }` | **3** — the same three | 3 |
| B3 | `RevealPanel`: `const elsewhere = false` — never marks itself stale | **1** — the reveal over a position it does not describe | 5 |
| B4 | `continuationAfter`: returns `{ kind: "play" }` for every source — forks a loaded game again | **2** — the loaded game's plies, and a continuation offered on the front door | 4 |
| B5 | `Home`: `const canContinue = true` — the control is offered whatever the game holds | **1** — the front door's reveal | 5 |

**What B1 also demonstrated, and it changed a test.** With the board broken but `Home`'s guard
intact, the case *"refuses the machine's hand"* stayed **green** — because at the reveal it is the
player's turn, so one press on an opponent's piece finds no target whatever the board allows. A test
that stopped at one press would have passed over a board that plays both hands. It now drives six
alternating attempts, which is the sequence that produced the defect, and asserts separately that no
press lights a target at all. Both halves go red under B1.

**What is NOT claimed.** That these five breaks are the only ways to reintroduce the defects.
`GATE-BOARD-AUTHORITY` covers the one a type cannot see — a board whose authority is a constant —
and its own control is `tests/fixtures/inertia/BoardThatAlwaysAccepts.tsx`, which typechecks.

---

## C2. The bundle, after the merge with `O-1`

Both changes raised the same two raw ceilings from the same base and the bytes are disjoint: this
branch measured 683.2 / 771.3 and set 684 / 772; `O-1`'s route set 685 / 773. Measured on the
merged tree: **entry raw 684.4, gzipped 214.5, initial download 772.5** — inside `O-1`'s ceilings,
so neither moved again, and the superseded numbers stay in `scripts/check_bundle_budget.ts` with a
note saying what happened to them.

## C3. The third repair to the way out, broken three ways

The pairing rule (section D, repair 3) is a claim about a component, so it was falsified against
`tests/client/reveal-failure.test.tsx` rather than in a browser. Each break applied alone, restored
green after.

| break | what was changed | red |
| --- | --- | ---: |
| B6 | the forward control declares `return-record` while keeping the forward words | **2** — the pairing rule, both kinds |
| B7 | the forward control keeps `next-decision` and wears *"חזרה לרשומה"* | **6** — the pairing rule, the press, and the chrome check, both kinds |
| B8 | the bank branch re-implemented as a locally labelled `next-decision` button instead of rendering `RevealNextPosition` | **2** — the delegation, both kinds |

`B8` is the one that matters, because it is the shape the merge actually produced: a button labelled
before `serveNextBankPosition` was asked. It typechecks, it looks right, and on an exhausted anchor
set it says *"לעמדה הבאה"* and lands on the record.

**What is NOT claimed.** That the rule catches a mismatch inside `RevealNextPosition` itself. That
component owns its own two pairings, and nothing in this file asserts them; the failure panel is
only shown to hand the question over rather than to answer it twice.

---

## D. The adversarial pass, and what it found in the fix

Run in a separate context against the merged branch, with the brief to attack rather than to
confirm. It ran twelve attack classes and found something in six of them. Everything below was
reproduced before it was repaired.

**In the change itself.** The board note asserted where the board was, contradicting the banner the
same commit added (`ULI-X-06`). `RevealFailure`'s control said *"להחלטה הבאה"* while going to the
record, and on a write failure sat beside a second control to the same place. `Blitz.tsx` granted
`play` in two states that refuse. `RevealPanel.boardFen` was optional against the reason its own
docblock gave. `continuationAfter`'s docblock claimed a landing check the `live` branch does not do.

The way out that lied has now been fixed three times, and the third time is the one worth
recording, because the first two were both incomplete.

1. The label was made to travel with the act — as a `{label, act, go}` triple the CALLER passed.
   That moved the mismatch one layer up, to a place nothing checked.
2. `O-1` replaced the destination it had been lying about: `RevealNoContinuation` is gone and
   `RevealNextPosition` serves the bank's next position.
3. Which made a third case real. On an exhausted anchor set the bank route lands on the record,
   and `serveNextBankPosition` has to be asked before anyone knows that — so NO label chosen
   before the press can be right, and a caller with two handlers would have shown *"לעמדה הבאה"*
   and gone to the record. `RevealNextPosition` already answers this by re-rendering with the
   record's own words once the set comes back complete, so the failure panel now RENDERS it rather
   than re-deriving the route: one authority for *"where does this player go next"*, whether or
   not the engine answered (`RNL-05`).

What is asserted is therefore the pairing RULE and not one pair, in `tests/client/reveal-failure.test.tsx`
and in the stranger walk: a control declaring `next-decision` may say either forward sentence and
must not wear the record's; one declaring `return-record` must. The old assertion hard-coded a
single pair and went red on the merge, which is the assertion doing its job.

The duplicate-control guard survives the merge, because the write-failure path still renders both
panels.

**In the gate.** `GATE-BOARD-AUTHORITY`'s scanner matched one spelling of a constant, so
`authority={"propose"}` and `authority={ALWAYS}` typechecked and produced `34 gates: 34 pass`. And
its positive control returned FAIL on both branches, so deleting the fixture left `gates:controls`
green — a control satisfied by deleting the thing it controls, which is the one shape `RNL-04`
exists to refuse. Both are repaired; the deletion case is now a `HARNESS_ERROR`, which the runner
already counts as red for the wrong reason, and `GATE-TOOLBOX-OUTSIDE-FOCUS` had the same hole and
says so now too.

**Predating the change.** The counterfactual probe validated its answer against the board rather
than against the position it asked about, so an alternative illegal in the decision's position was
accepted, offered and **written to the record** with `cpLoss: null` — a row `readCounterfactuals`
drops. That is the most serious thing this mission found, and it was found after the fix shipped.
Also: the engine-failure path left the "engine is computing" note standing; the deferred-timing arm
played the committed move at whatever ply the timeline had reached.

**Attacks that found nothing**, recorded because a register of hits only makes a pass look better
than it was: pre-commit engine leakage; decision N's reveal attached to N+1; `revealAt` going stale
across every loader and the resume path; `RevealPanel`'s staleness derivation; `Record.tsx`'s
handoffs, drills and transfers (the board is rendered in exactly two files); `revealPly + 2` parity
and the mate/stalemate landing on the `advance` branch; `GATE-ONE-PRIMARY-ACTION` on the new reveal
states; keyboard Enter and Space at the reveal; drag at the reveal.

**Not repaired, and named.** A live game whose committed move is mate still reaches `deciding` on a
finished board: the landing does not exist when `continuationAfter` runs, so the check would have to
move to the caller, and nothing in this mission drove it. `ChessBoard`'s grid still announces
*"Enter לבחירה"* at `revealed`, where Enter correctly does nothing. Both are in `B` above.
