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
900/1080 — above the fold. At 390x844 the reveal begins at **y=893 in an 844px viewport**, and the
finding at y=1120, so a handset shows the board and nothing else after a commit. The order of the
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
