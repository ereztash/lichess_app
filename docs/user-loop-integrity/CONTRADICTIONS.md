# Contradictions between what this repository decided and what its screen did

Numbered `ULI-X-nn` so they do not collide with
[`../consolidation-research/CONTRADICTIONS.md`](../consolidation-research/CONTRADICTIONS.md), which
owns the corpus-wide register and is **not** superseded by this file. This one is scoped to the
decision loop's surface.

Every row is `REAL_CONTRADICTION`: an authority this repository holds, and a built screen that
disagreed with it, measured in Chromium at `c1d72935c0389c8f301edfd4083aabb584764cc7`.

---

### `ULI-X-01` — the board granted authority the mode contract does not
**P0. Fixed.**

`MODE_CONTRACT.REVEAL.central` is *"the one thing this decision showed"* and
`MODE_OF_STAGE.committing` is `DECIDE`, whose `central` is *"the commitment"*. `Home.tsx`'s move
handler read `if (stage !== "deciding") { playMove(from, to) }`, so in both of those stages a board
press **played** a move, for whichever side was to move. Alternating presses played both hands.

Measured: after one committed decision, White `d4-c6` and then Black `b8-d7`, at 1440x900,
1920x1080, 390x844 and 1024x500; and in a live game against the Stockfish opponent, White `b2-b4`
then Black `b8-a6` while the engine was still scoring the commit.

This is also **D22 reversal condition 1** firing — *"a surface's screen and the derivation disagree
on a state, in a walk over the built app"* — for `interaction-mode.ts` rather than for
`next-action.ts`. It is recorded here rather than acted on as an ownership transfer; see
`REPO_CROSSWALK.md` §Ownership.

**Fixed by** `shared/board-authority.ts` + a required `authority` prop on `ChessBoard` +
`GATE-BOARD-AUTHORITY`.

---

### `ULI-X-02` — `GATE-TWO-HANDS` is chromatic, and the hands were not separated behaviourally
**P0. Fixed.**

`docs/DESIGN_SYSTEM.md`: *"The colour the machine speaks in is never something a player can press."*
`scripts/two-hands-scan.ts` enforces it in both directions, over CSS tokens, with a control that
reddens twice. Measured: the hues are correct and the **behaviour** was not. A player could author
the machine's move with the player's own gesture, and nothing in the token layer can see that.

The gate is not wrong and is not weakened. `GATE-BOARD-AUTHORITY` is its behavioural sibling and
says so in its own docblock.

---

### `ULI-X-03` — the reveal was the one result not marked stale
**P0. Fixed.**

Section 4.3, the rule `GATE-STALE` states: *a result rendered against an input it was not computed
for is marked stale.* `EvaluationBar` derives it from `currentFen` explicitly *"so a caller cannot
forget to mark it"*; `AnalysisPanel` refuses to replay a principal variation against another
position. `RevealPanel` had no such derivation.

Measured: with the reveal on screen, one press on the move timeline took the board from 27 pieces to
31 — a different position four plies back — and the reveal's text was **byte-identical**, still
naming `g5d8`, `484 ס״פ` and `f2f4`. Only the engine's arrow disappeared.

**Fixed by** `RevealPanel`'s `boardFen`, derived in the component in the same shape `EvaluationBar`
already uses.

---

### `ULI-X-04` — a call to action destroyed something that had already happened
**P0. Fixed.**

LAW 4: *"No call to action may cause something that already happened in the world to be lost, or
left permanently half-recorded."*

Measured: an 18-ply PGN, rewound to ply 9, one decision, one press of the continuation —
**11 plies remained**. `playMove` truncates (`history.slice(0, ply + 1)`), and the continuation was
the caller that threw the rest of a loaded game away. `importPgn`'s own comment says why that is
wrong: *"No opponent for a loaded game: the other side's moves are already in the PGN."* Seven
half-moves of a game the player had loaded, deleted by a call to action.

**Fixed by** `continuation`, which advances a loaded game along itself.

---

### `ULI-X-05` — the continuation handed the player their opponent's turn, and recorded the answer
**P0. Fixed, with a residue that is OWNER-REQUIRED.**

`docs/ACQUISITION_EVIDENCE.md` defines the continue step mechanically: *"board accepts the next
move"*, *"position advances"*. It does not say **whose** move, because until now nothing needed it
to.

Measured on the primary customer journey with nothing done to it — front door, a position from the
player's own Lichess game, one decision, one reveal, one press of *"לבדוק אם זה חוזר"*. The board
read `תור לבן` before the decision and `תור שחור` after the continuation: the player, handed a
position as White, was handed back **Black to move**. The front door trims the game to the one
decision it hands over (`pickFirstDecision`: *"so nothing after it can leak"*), and a loaded game
has no opponent, so playing the committed move simply passed the turn to a side nobody was going to
play. A move proposed there was accepted, the commitment was answered, and the decision **was
written to the record** — `DECISIONS_AFTER_SECOND: 2` — carrying a stated confidence, stored
indistinguishably from a decision the player took for their own side.

`docs/FINDINGS.md` had already found this failure and named it: *"the app asked the player to decide
for that side too"*. It was closed by giving the **live** game an opponent, which repaired one path.

Reproduced in a clean worktree of the untouched baseline, so it is not an artefact of this branch.

> **A correction this register keeps.** The first pass reported this as a **soft lock** — a
> commitment panel over a position with no legal move — because the walk probed White's pieces only
> and found none. That was wrong. Re-probing both colours showed the loop continues, on the wrong
> hand. The corrected finding is worse than the one it replaces: a lock stops a player, and this
> stored a measurement.

**Fixed by** offering the continuation only where it can be taken, which on the front door's
one-position handoff is nowhere — the screen says so and offers `return-record`, and `/` hands over
the anchor set's next position. Measured: `return-record` → the record → *"העמדה הבאה"* → `/play`,
`"11. O-O-O תור שחור"`, and `b5-b4` offered. What is established is that the position **can be
decided in** and that everyone answers the same bank in the same order, which is what makes that one
reading comparable between players. What was claimed once and is **not** established: that it is
"a decision on the player's own side". It is a position from a game the player never played, and at
the one measured it is Black to move for a visitor handed White at the front door. It is stamped
`purpose: "anchor"`, which is the honest label and is not the same claim.

**The residue:** whether the reveal itself should route there, rather than the player passing
through the record, changes what `docs/ACQUISITION_EVIDENCE.md`'s continuation stage counts. It is
`OWNER-REQUIRED` in `FALSIFICATION_REGISTER.md` `O-1`.

---

### `ULI-X-06` — the note said the engine was still computing after it had answered
**P1. Fixed, and the first fix was itself wrong.**

`setNotice("ההחלטה נרשמה. המנוע מחשב עכשיו.")` fires at the commit and nothing replaced it.
Measured in every walk: the note said the engine was computing with the reveal on screen. `F0`
asserting one thing while `F1` showed another.

**Two things the first repair got wrong, both found by an adversarial pass and both measured.**

It replaced the sentence on the engine-**success** path only. On an engine failure the note still
said `המנוע מחשב עכשיו` beside a panel saying the engine never finished. Fixed.

And the replacement asserted something else that a live surface denies. It ended
*"...הלוח נעול על העמדה שהחלטתם בה"* — locked **on the position you decided in** — while the move
timeline is live at `revealed`, so one press had a `role="status"` region asserting exactly what
`.reveal-elsewhere` was denying beside it. Two live regions contradicting each other is worse than
the stale note it replaced. The note says what the board **does** now; where the board **is** belongs
to the banner, which derives it. Measured after the repair: note
*"ההחלטה נרשמה והמנוע ענה. הלוח כבר לא מקבל מהלכים"*, banner
*"הלוח מציג עכשיו עמדה אחרת"* — no contradiction.

---

### `ULI-X-07` — the board acknowledged a selection it had no authority to act on
**P1. Fixed. It was marked fixed once before it was, and that is recorded here rather than tidied.**

Measured: 14 of 14 opponent pieces at the handed-over position, and 16 of 16 at the start of a live
game, took `selected-square`, `aria-selected="true"` and the full focus ring, with zero legal
targets. A press that lights up and can never lead anywhere is an acknowledgment of authority the
player does not have — which is what *"several controls feel inert"* looks like on a chessboard.

**The first repair closed it only where the board's authority is `none`.** At `deciding` the
authority is `propose`, and an adversarial pass re-measured the same handed-over position: still
**14 of 14**, `aria-selected="true"`, zero targets. This register had said *"Fixed"*.

**What closes it.** `ChessBoard` takes `sideToMove` and refuses to select a piece of the side that
is not to move — a fact about the position, not about the player, so an imported game decided from
either side is untouched (`decisionPurposeFor` stamps those `import`, and deciding at any ply is
what importing is for). It announces the refusal rather than swallowing it, because an AT user who
presses Enter and gets silence has learnt less than one who is told whose turn it is. Measured
after: **0 of 14**, with the player's own hand unchanged — which the judge asserts in the same case,
so the fix cannot pass by disabling the board.

---

## What was NOT a contradiction

Recorded because a register that lists only what was found makes the pass look better than it was.

- **`INTERACTION_GEOMETRY`'s defect does not recur.** The board measured 812px at 1920, 632 at 1440,
  370 at 390x844 and 366 in short landscape — squares of 100, 77, 45 and 44px, all at or above this
  repository's own 44px `--tap-floor`, with no horizontal overflow at any width.
- **Controls on the primary loop are not inert.** Read chips invert background, border, colour and
  weight and set `aria-pressed`; the confidence, the submit and the continuation each advance the
  screen. The owner's third symptom, taken literally, is **falsified**; what is real is `ULI-X-07`
  and `ULI-X-06`, which are acknowledgments that are *wrong* rather than absent.
- **Keyboard-only reaches a proposal.** One Tab to the front door's primary control, twelve to the
  board, then arrows and Enter: `chosenFrom: 1, chosenTo: 1`.
- **The commit boundary held in the record throughout.** `decisions: 1, reveals: 0` before the
  engine spoke, on every walk. R3 was never observed to leak.
- **The loop was never locked.** The corrected measurement above is the reason this register says
  so twice: a claim that flattered the finding was withdrawn rather than left standing.
- **Three rows of this register said "Fixed" for defects that measurably persisted** (`ULI-X-06`,
  `ULI-X-07`, and `LOOP_CORPUS.md`'s blitz row). An adversarial pass measured all three. They are
  fixed now and the wrong claims are above, struck through by their own corrections rather than
  deleted, because a register that only ever recorded its successes is the one thing this
  repository's registers are built not to be.
- **Deciding at an arbitrary ply of an imported game is not the same defect.** Measured on the
  fixed tree: a pasted PGN, rewound to ply 2, a decision recorded for Black. That is what importing
  is for, and `decisionPurposeFor` stamps it `purpose: "import"` rather than pretending it is the
  player's own game. The defect is specific to a position the product **handed the player as a
  side**.
- **`theOneThing`'s silence branch does not erase the local result.** It renders one of two distinct
  sentences, and the second names the centipawn cost.
