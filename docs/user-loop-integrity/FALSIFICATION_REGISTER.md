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

### `OWNER-REQUIRED`

**`O-1` Should the reveal route to the next position, or should the player pass through the record?**
The mechanism exists and works: `return-record` → `/` → *"העמדה הבאה"* hands over the anchor set's
next unanswered position, which is a decision on the player's own side and is the one reading in
this product comparable between players. Measured end to end on the fixed tree. What is **not**
decided is whether the reveal should offer that directly, and offering it changes what
`docs/ACQUISITION_EVIDENCE.md`'s continuation stage counts — `next_decision_started` fires on a
placed move, and a one-press route to another position is a different funnel from a two-press one.
`RNL-11` forbids moving the intervention and the instrument in one step. **Trigger:** an owner
decision, then a protocol-version consideration before it ships.

**`O-2` `next_decision_started` on the front-door path.**
It fires on `movePlaced && revealsPresented > 0`. At `c1d7293` a stranger could satisfy it — by
placing the **opponent's** move — so any continuation figure taken from that path is counting an act
the product should not have offered. After this branch the reveal offers `return-record` instead, so
the event fires only once the player has reached another position and moved in it. Both readings are
about the product's shape rather than anybody's behaviour until `O-1` is settled. **Trigger:** `O-1`.

**`O-3` `ASK_AFTER_REVEALS = 2` and the front door.**
The value-reconstruction question is put after the **second** reveal. A stranger who arrives at the
front door and does nothing else has never had a second reveal available. This is a consequence of
`O-1` and is recorded rather than changed: moving the threshold would change the instrument.

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

## D. The adversarial pass, and what it found in the fix

Run in a separate context against the merged branch, with the brief to attack rather than to
confirm. It ran twelve attack classes and found something in six of them. Everything below was
reproduced before it was repaired.

**In the change itself.** The board note asserted where the board was, contradicting the banner the
same commit added (`ULI-X-06`). `RevealFailure`'s control said *"להחלטה הבאה"* while going to the
record, and on a write failure sat beside a second control to the same place. `Blitz.tsx` granted
`play` in two states that refuse. `RevealPanel.boardFen` was optional against the reason its own
docblock gave. `continuationAfter`'s docblock claimed a landing check the `live` branch does not do.

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
