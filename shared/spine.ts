/**
 * THE LOOP, STATED ONCE, IN THE LAYER BOTH HALVES OF THE PRODUCT CAN SEE.
 *
 * WHAT THIS IS FOR, AND IT IS ONE PROPERTY. `docs/INERTIAL_UX_LAWS.md` states the target as *"at
 * every moment, the state the player is in nearly dictates the next action"*, and the laws hold
 * that per surface. Nothing held the property ACROSS surfaces: that every state a player can reach
 * has a way back to a real chess decision. A branch with no arc back is not a missing button, it is
 * a product that has quietly become a module, and the only thing that found one in this repository
 * so far was a person walking the built app in Chromium.
 *
 * SO THE ARCS ARE DATA AND THE WAY BACK IS A PREDICATE. `reachesPlay` is not decoration: it is the
 * assertion that `PLAY` is reachable from every phase, and `reentryOf` is total over
 * `NextActionKind`, so a proposal added later without a place in the loop is a compile error rather
 * than a screen somebody forgets to wire.
 *
 * WHY FIVE PHASES AND NOT THE SIX THE OBVIOUS DRAWING HAS. The obvious drawing puts `ACT` between
 * the commitment and the verdict. Measured against this repository, that is wrong in both lanes and
 * wrong in opposite directions:
 *
 *   UNTIMED LANE  the move is PLACED during the decision and PLAYED at the continuation, after the
 *                 reveal. `continuationAfter` is what plays it. So the act follows the verdict.
 *   BLITZ LANE    the move is played immediately and the confidence question is put afterwards, at
 *                 `BLITZ_ASK_RATE`. So the act precedes the packet.
 *
 * Two lanes, two orders, and pinning either into the spine would make the other one an exception.
 * What is invariant across both is the thing the product is actually about:
 *
 *   > The evidence packet closes before any post-commit information becomes available.
 *
 * That is `CAPTURE` before `REVEAL`, and it is the only ordering this module asserts. The act of
 * playing a move is where the loop happens, not a phase of it -- which is `§15` of the brief this
 * module comes from, and also why `PLAY` is the phase everything must return to rather than one
 * stop among five.
 *
 * WHAT IT DOES NOT DO. It runs nothing, renders nothing and routes nothing. `Home.tsx` still owns
 * the stage of a decision, `learning-journey.ts` still owns what may be said about a record, and
 * `next-action.ts` still owns what to propose. This names where each of those sits in one loop so
 * the three can be held against each other, and `docs/decisions/D27-recursive-spine.md` records why
 * that is the whole of the change.
 */
import { type DecisionStage } from "./decision-stage.js";
import type { ClaimStateKind } from "./claim-state.js";
import type { NextActionKind } from "./next-action.js";

/**
 * The phases of one pass, in the order a pass goes through them.
 *
 * NOT A STATE MACHINE THE APP RUNS. It is the coarse layer the three existing state machines are
 * each a part of, which is what makes "does every branch come back" a question anything can answer.
 */
export const LOOP_PHASES = [
  /** Ordinary chess. A decision opportunity is a position where it is the player's move. */
  "PLAY",
  /** The pre-feedback packet is being assembled and closed. Nothing post-commit may be on screen. */
  "CAPTURE",
  /** Post-commit information is available: the evaluation, the outcome, the counterfactual. */
  "REVEAL",
  /** What the accumulated evidence now supports is recomputed. It may legitimately support nothing. */
  "UPDATE",
  /** One act, which puts the player back into the loop. */
  "RETURN",
] as const;

export type LoopPhase = (typeof LOOP_PHASES)[number];

/**
 * Where a decision's event state sits.
 *
 * `committed` IS `CAPTURE` AND NOT `REVEAL`, and that is the whole boundary. The row is written and
 * the engine has not spoken; `shared/counterfactual-stage.ts` pins the probe to exactly this stage
 * for exactly that reason. A mapping that put it in `REVEAL` would make the probe a post-feedback
 * question, which is the contamination the product exists to refuse.
 *
 * `blocked` IS `CAPTURE` TOO. It is the state of a decision that could not be written, so the
 * player is still on the near side of the boundary with nothing to show them.
 */
export function phaseOfDecisionStage(stage: DecisionStage): LoopPhase {
  switch (stage) {
    case "deciding":
    case "committing":
    case "committed":
    case "blocked":
      return "CAPTURE";
    case "revealed":
      return "REVEAL";
  }
}

/**
 * Whether information that only exists after the commit may be on screen in this phase.
 *
 * THE SPINE'S COPY OF `engineMayRun`, AND IT IS HELD AGAINST IT. `decision-session.ts` decides this
 * for the screen, over a stage, in the client. The same boundary has to be stateable over a phase,
 * because the phases are what the other two layers are compared in -- and two definitions of one
 * boundary is how a boundary moves without anybody deciding to move it.
 * `tests/shared/a-loop-with-no-way-back-to-the-board.test.ts` asserts the two agree on every stage.
 */
export function mayShowPostCommitInformation(phase: LoopPhase): boolean {
  return phase !== "PLAY" && phase !== "CAPTURE";
}

/**
 * Where a claim state is produced.
 *
 * ALL OF THEM IN `UPDATE`, AND THE FUNCTION EXISTS ANYWAY. A claim state that appeared anywhere
 * else would be a reading of the record rendered while the player is producing evidence, which is
 * LAW 1 -- so the constant answer is the assertion, not a placeholder for a table that never
 * arrived. The argument is total over the union so a state added later has to be placed by hand.
 */
export function phaseOfClaimState(kind: ClaimStateKind): LoopPhase {
  switch (kind) {
    case "unread":
    case "accumulating":
    case "nothing-separated":
    case "candidate":
    case "decided":
    /*
     * `retired` IS PRODUCED IN `UPDATE` LIKE THE REST, and placing it here by hand is the point of
     * the switch being total. It is the one state a PERSON writes rather than the record, and the
     * phase is still where the record is read: the act of retiring is available only where a claim
     * is on screen, which is after the reveal and never during play. A claim state offered in
     * `PLAY` or `CAPTURE` would be a reading rendered while the player is producing evidence, which
     * is LAW 1, and that is as true of an offer to withdraw a question as of the question itself.
     */
    case "retired":
      return "UPDATE";
  }
}

/**
 * Where a proposal puts the player back into the loop.
 *
 * THE ARROW THE BRIEF CALLS ESSENTIAL, as a total function. Reveal is not the end of the product,
 * a pattern card is not the end of the product and practice is not the end of the product -- which
 * is checkable exactly when every proposal names the phase it re-enters and every phase reaches
 * `PLAY`.
 *
 * `wait-analysis` AND `return-record` BOTH RE-ENTER AT `UPDATE`, which is the interesting pair.
 * Neither asks for a decision: one waits for the engine to finish scoring evidence that already
 * exists, the other reads what the evidence already supports. Both change what the claim state is,
 * and neither is a dead end, because `UPDATE` has an arc on to `RETURN`.
 */
export function reentryOf(kind: NextActionKind): LoopPhase {
  switch (kind) {
    case "play-first-decision":
    case "play-blitz":
    case "collect-more-evidence":
    case "none":
      return "PLAY";
    case "test-hypothesis":
    case "test-claim":
    case "continue-drill":
    case "continue-transfer":
      return "CAPTURE";
    case "review-event":
      return "REVEAL";
    case "wait-analysis":
    case "return-record":
      return "UPDATE";
  }
}

/**
 * Every arc, and each one is a transition the product actually performs.
 *
 * `PLAY -> PLAY` IS THE ONE THAT MAKES REFLECTION OPTIONAL. A player who is offered a reflection
 * and declines, or who is never offered one -- the common case, since the confidence question is
 * drawn at `ASK_RATE` -- stays in `PLAY` and the loop is not broken by it. An architecture with no
 * such arc would be one where capture is the price of every move.
 *
 * `CAPTURE -> PLAY` IS THE DEFERRED VERDICT. Under `בסוף המשחק` and in every blitz game, the packet
 * closes and the game continues; the reveal arrives later, for the game rather than the move. The
 * arc is not a shortcut past `REVEAL`, it is a reveal that has not happened yet.
 *
 * `RETURN` FANS OUT TO FOUR PHASES because the proposal decides which, and `reentryOf` is the
 * decision. It is the only phase that does, which is what makes it the phase where the journey
 * layer lives.
 */
export const PHASE_ARCS: Readonly<Record<LoopPhase, readonly LoopPhase[]>> = {
  PLAY: ["CAPTURE", "PLAY"],
  CAPTURE: ["REVEAL", "PLAY"],
  REVEAL: ["UPDATE"],
  UPDATE: ["RETURN"],
  RETURN: ["PLAY", "CAPTURE", "REVEAL", "UPDATE"],
};

/**
 * Whether ordinary chess is reachable from here.
 *
 * A WALK AND NOT A LOOKUP, because the property is about the graph rather than about one row. A
 * phase whose only arcs lead to other phases that lead back to it is a loop the player is inside
 * and cannot leave, and that reads identically to a correct row in a table.
 */
export function reachesPlay(from: LoopPhase): boolean {
  const seen = new Set<LoopPhase>();
  const queue: LoopPhase[] = [from];
  while (queue.length) {
    const phase = queue.shift()!;
    if (phase === "PLAY") return true;
    if (seen.has(phase)) continue;
    seen.add(phase);
    queue.push(...PHASE_ARCS[phase]);
  }
  return false;
}
