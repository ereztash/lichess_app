/**
 * WHAT THE BOARD MAY DO FOR THE PLAYER RIGHT NOW -- and, by omission, what it may never do for
 * the machine.
 *
 * THIS IS NOT A NEW RULE. `Blitz.tsx` has held it since the second board was removed:
 *
 *   selectedSquare={reviewing ? undefined : selected}
 *   legalTargets={reviewing ? [] : legal}
 *   onSelect={reviewing ? () => {} : setSelected}
 *   onMove={reviewing ? () => {} : onMove}
 *
 * -- under a comment that says it in as many words: *"The board does not need a twin; it needs a
 * MODE."* That is exactly right, it was applied to one screen, and it was never generalised. This
 * module is the generalisation, and `docs/INERTIAL_UX_LAWS.md`'s own table of laws
 * "already argued at ... never generalised to ..." is the shape of the defect it closes.
 *
 * WHAT WENT WRONG WITHOUT IT, measured in Chromium on the built app at
 * `c1d72935c0389c8f301edfd4083aabb584764cc7`. `Home.tsx`'s move handler read
 * `if (stage !== "deciding") { playMove(from, to) }`, so at `committing` and at `revealed` a board
 * interaction did not propose a move -- it PLAYED one, for whichever side happened to be to move.
 * Alternating clicks therefore played both hands: after one committed decision a player moved
 * White d4-c6 and then Black b8-d7 while the engine was still scoring the decision, and again
 * after the reveal was on screen. In a live game against the Stockfish opponent, the same gesture
 * made the opponent's move for it. `docs/FINDINGS.md` had already found this failure once -- *"A
 * game meant playing both colours yourself at one commit-and-reveal cycle per half-move"* -- and
 * closed it by giving the live game an opponent, which repaired the symptom on one path and left
 * the board's authority alone.
 *
 * WHY A NAMED VALUE RATHER THAN A BOOLEAN. Three different things a board can be for are not
 * "interactive" and "not": proposing a move that will be committed, naming the alternative the
 * counterfactual probe asks for, and playing a move in a game that is being played. They differ in
 * what the gesture MEANS, and a boolean cannot carry that -- the same click writes a candidate,
 * writes a probe answer, or advances a game.
 *
 * WHAT IT IS NOT. It is not the interaction mode and does not replace it. `interaction-mode.ts`
 * answers "what is the player in the middle of, and what may be on screen"; this answers the
 * narrower question "may this gesture reach the position, and as what". The two are held against
 * each other in `tests/shared/what-the-board-may-do.test.ts` rather than derived from each other,
 * because a mode contract that forbids prior evidence is not the same claim as a board that
 * refuses a move, and collapsing them would give one answer to two questions (`RNL-05`).
 */
import type { DecisionStage } from "./decision-stage.js";

/**
 * Every authority a board may be granted.
 *
 * ORDERED BY HOW MUCH OF THE RECORD THE GESTURE TOUCHES: nothing, then an answer to one question,
 * then a candidate that is about to be committed, then a move that advances a game.
 */
export const BOARD_AUTHORITIES = [
  /** The board is a picture. A press selects nothing, offers no target, and moves nothing. */
  "none",
  /** A gesture NAMES the alternative the counterfactual probe asked for. It does not play it. */
  "name-alternative",
  /** A gesture PROPOSES the move that will be committed. It does not play it either. */
  "propose",
  /** A gesture PLAYS a move in a game being played. Blitz, where the clock is the instrument. */
  "play",
] as const;

export type BoardAuthority = (typeof BOARD_AUTHORITIES)[number];

/**
 * The decision loop's map, and the two `none` rows are the whole of it.
 *
 * `committing` IS `none`, not `propose`. The write is in flight; the move it is writing is already
 * chosen. A board that still accepted a gesture there would be offering to change a decision that
 * is on its way to the record, which is the one thing an append-only record cannot represent.
 *
 * `revealed` IS `none`, and this is the row the product got wrong. The reveal's whole subject is
 * "the one thing THIS decision showed" (`MODE_CONTRACT.REVEAL`), and the decision is a move taken
 * in a named position. A board that moves under a reveal leaves the reveal describing something
 * that is no longer on screen -- which is section 4.3's own rule, the one `GATE-STALE` enforces
 * everywhere else: *a result rendered against an input it was not computed for is marked stale*.
 *
 * `blocked` IS `propose`, because a decision that could not be written is still open. Nothing sets
 * that stage today; the row exists so that the day something does, the board is not silently
 * inert.
 */
export const BOARD_AUTHORITY_OF_STAGE: Readonly<Record<DecisionStage, BoardAuthority>> = {
  deciding: "propose",
  committing: "none",
  committed: "name-alternative",
  revealed: "none",
  blocked: "propose",
};

/** The decision loop's authority for a stage. One lookup, no branching anywhere else. */
export function boardAuthorityOf(stage: DecisionStage): BoardAuthority {
  return BOARD_AUTHORITY_OF_STAGE[stage];
}

/**
 * The authority once the POSITION is taken into account as well as the stage.
 *
 * WHY THE STAGE IS NOT ENOUGH, and it took an adversarial pass to show it. `committed` grants
 * `name-alternative` because the counterfactual probe asks, of one named position, what would have
 * been played instead. The move timeline is live in that stage, so the board can be somewhere else
 * when the gesture lands -- and `Home.tsx` validated the answer against the board rather than
 * against the question. Reproduced end to end: a decision committed as White at `12. d6`, the
 * timeline walked back to `10. Bb3` where Black is to move, and `b8a6` accepted, offered as
 * *"רשמו b8a6 כחלופה"*, and written to the record. `b8a6` is not a legal move in the position the
 * probe asked about. It landed in the probed arm with `cpLoss: null`, which `readCounterfactuals`
 * drops -- so the row left the experiment silently, which is the exact failure `Home.tsx`'s own
 * retry comment says was closed.
 *
 * AN ANSWER TO A QUESTION ABOUT A POSITION IS ONLY AN ANSWER ON THAT POSITION. Everywhere else the
 * board grants nothing, which is the same sentence `revealed` already lives by.
 */
export function boardAuthorityFor(input: {
  stage: DecisionStage;
  /** Is the board showing the position the open instrument question is about? */
  onTheQuestionsPosition: boolean;
}): BoardAuthority {
  const authority = boardAuthorityOf(input.stage);
  if (authority === "name-alternative" && !input.onTheQuestionsPosition) return "none";
  return authority;
}

/** Whether a gesture on the board may reach the position at all. */
export function boardAccepts(authority: BoardAuthority): boolean {
  return authority !== "none";
}
