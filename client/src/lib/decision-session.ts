/**
 * The client-side decision state machine (R3).
 *
 * The engine is a RESULT, never a teacher. It is not permitted to render -- or to be started,
 * or to appear in the DOM or the network tab -- before the player has committed a move and a
 * stated reason. This machine is what makes that structural rather than a matter of discipline:
 * `engineMayRun` is false in every state except `revealed`, and the reveal state cannot be
 * reached except through a recorded commit.
 *
 * Time-to-decide is captured here. It is a predictor, not telemetry (section 4.1).
 */
import type { DecisionAtom } from "@shared/decision-atom";
import { comparableCp, type EngineLine } from "@/lib/engine-line";
import { classifyPhase } from "@shared/phase";
import { composeStatement } from "./read-options";

export type SessionStage = "deciding" | "committing" | "committed" | "revealed" | "blocked";

export interface PositionUnderDecision {
  gameId: string;
  fen: string;
  ply: number;
  clockMsRemaining: number | null;
}

export interface DraftDecision {
  chosenMove: string | null;
  /**
   * The read, tapped. Labels rather than ids: the label is what goes on the record, in the
   * player's own language, and an id would make the record unreadable without this table.
   */
  knownTags: string[];
  /** The read, typed. Optional, and additive to the tags -- not an alternative to them. */
  known: string;
  unknownTags: string[];
  unknown: string;
  confidence: number | null;
  candidatesConsidered: string[];
}

export const emptyDraft = (): DraftDecision => ({
  chosenMove: null,
  // Nothing preselected, deliberately. A default read is the machine stating one on the player's
  // behalf and then measuring them against it.
  knownTags: [],
  known: "",
  unknownTags: [],
  unknown: "",
  confidence: null,
  candidatesConsidered: [],
});

/** What this draft actually asserts for one field: what was tapped plus what was typed. */
export const statedKnown = (draft: DraftDecision) => composeStatement(draft.knownTags, draft.known);
export const statedUnknown = (draft: DraftDecision) =>
  composeStatement(draft.unknownTags, draft.unknown);

export interface DraftProblem {
  field: keyof DraftDecision;
  message: string;
}

/**
 * What is still missing before this decision can be recorded. Returned as a list rather than a
 * boolean so the interface can say WHICH part is absent -- "incomplete" and "invalid" are
 * different states and must not render the same (R2).
 */
export function draftProblems(draft: DraftDecision): DraftProblem[] {
  const problems: DraftProblem[] = [];
  if (!draft.chosenMove) {
    problems.push({ field: "chosenMove", message: "לא נבחר מהלך." });
  }
  // Still required, and still with no default -- an unanswered field and an empty one must not
  // look the same (R2). What changed is the cost of answering: one tap satisfies it.
  if (statedKnown(draft).length === 0) {
    problems.push({ field: "known", message: "לא נאמר מה אתם קוראים בעמדה." });
  }
  if (statedUnknown(draft).length === 0) {
    problems.push({ field: "unknown", message: "לא נאמר מה אי אפשר להעריך כאן." });
  }
  if (draft.confidence === null) {
    problems.push({ field: "confidence", message: "לא נבחרה רמת ביטחון." });
  }
  return problems;
}

export const isCommittable = (draft: DraftDecision) => draftProblems(draft).length === 0;

/**
 * The engine may only run once the decision is on the record. Every other stage returns false,
 * including `committing` -- a write in flight is not a completed write.
 */
export const engineMayRun = (stage: SessionStage): boolean => stage === "revealed";

/**
 * The commit event. Field names are the atom's, unchanged (section 3.1, GATE-ISO).
 *
 * `result` and `feedback` are typed as exactly `null`, not as nullable: at commit time the
 * engine has not spoken (R3) and the player has not revised anything. Widening these to the
 * atom's nullable types would make an event carrying an evaluation constructible here, which
 * is precisely what R3 forbids. The narrowing is the enforcement.
 */
export type CommitEvent = Omit<DecisionAtom, "result" | "feedback"> & {
  decision_id: string;
  result: null;
  feedback: null;
};

export function buildCommitEvent(
  decisionId: string,
  position: PositionUnderDecision,
  draft: DraftDecision,
  secondsTaken: number,
): CommitEvent {
  const problems = draftProblems(draft);
  if (problems.length) {
    throw new Error(`decision is not committable: ${problems.map((p) => p.message).join(" ")}`);
  }
  return {
    decision_id: decisionId,
    entry_state: {
      game_id: position.gameId,
      fen: position.fen,
      ply: position.ply,
      phase: classifyPhase(position.fen, position.ply),
      clock_ms_remaining: position.clockMsRemaining,
    },
    known: statedKnown(draft),
    unknown: statedUnknown(draft),
    decision: draft.chosenMove!,
    bounded_action: {
      seconds_taken: secondsTaken,
      confidence: draft.confidence!,
      /*
       * TOUCH ORDER IS THE DATA, and this line used to destroy it.
       *
       * `handleBoardMove` appends each distinct move in the order it was put on the board, and
       * the chosen move is in there at its own position -- choosing is touching. The old write
       * was `new Set([chosenMove, ...touched])`, which prepends; `Set` keeps the FIRST
       * occurrence, so the chosen move was forced to index 0 and its real position was lost.
       *
       * What that erased: whether the engine's move was touched FIRST and then abandoned, or
       * touched LAST and rejected. Those are opposite events. One is "you had it and talked
       * yourself out of it"; the other is "you weighed it and decided against it" -- and the two
       * bodies of literature on move choice prescribe opposite remedies for them. The product
       * currently asserts the second reading in as many words. It cannot tell which it has.
       *
       * Appending instead of prepending keeps the guarantee (the chosen move is always present)
       * and costs the player nothing: no new field, no new interaction, same array type.
       */
      candidate_moves_considered: keepTouchOrder(
        draft.candidatesConsidered,
        draft.chosenMove!,
      ),
    },
    result: null,
    feedback: null,
  };
}

/**
 * The moves that were on the board, in the order they got there, capped at what the atom holds.
 *
 * The cap is the reason this is not one expression. Truncation must never drop the move actually
 * played -- an atom whose `decision` is absent from its own candidate list is incoherent, and it
 * would silently break the one branch that reads this field. So the first `MAX` are kept in touch
 * order, and if the chosen move fell outside that window it takes the last slot: the record then
 * says "this was touched, late" rather than losing it, which is true and is the least it can say.
 */
const MAX_CANDIDATES = 8;

export function keepTouchOrder(touched: string[], chosenMove: string): string[] {
  const ordered = [...new Set([...touched, chosenMove])];
  const kept = ordered.slice(0, MAX_CANDIDATES);
  if (!kept.includes(chosenMove)) kept[kept.length - 1] = chosenMove;
  return kept;
}

/** Centipawn loss from the mover's perspective. Never negative: choosing better than the
 *  engine's line at this depth means the depth was insufficient, not that loss was negative. */
export function centipawnLoss(bestEvalCp: number, chosenEvalCp: number): number {
  return Math.max(0, bestEvalCp - chosenEvalCp);
}

/**
 * Centipawn loss computed from two engine searches, handling the perspective flip.
 *
 * UCI `score cp` is always from the side-to-move's point of view. The first search runs with the
 * PLAYER to move, so its score is already theirs. The second runs on the position after their
 * move, where the OPPONENT is to move -- so that score must be negated before comparing.
 *
 * Getting this backwards produces a plausible number with the wrong sign, which is exactly the
 * kind of error that survives review and then feeds a claim.
 *
 * IT TAKES LINES AND NOT NUMBERS, and that is the fix rather than a tidying. It used to take two
 * `scoreCp` values, and `scoreCp` on a mate line is the mate distance times ten thousand -- so
 * the caller handed it a quantity that is not centipawns and it had no way to know. Measured
 * against the shipped code, on positions the engine reports as mate:
 *
 *     delivering mate in 9, playing the FASTEST mate   -> cp_loss 10000 -> "inaccurate"
 *     delivering mate in 2, playing the FASTEST mate   -> cp_loss 10000 -> "inaccurate"
 *     being mated in 4, ACCELERATING it to mate in 1   -> cp_loss     0 -> "ACCURATE"
 *
 * Both errors push the calibration gap the same way -- the first lands on decisions stated at
 * full confidence and marks them wrong, the second lands on hopeless positions and marks them
 * right -- and both concentrate in the endgame, where the detector has a phase bucket. Taking
 * the line means `comparableCp` is unavoidable and a caller cannot reintroduce this by passing
 * the wrong field.
 */
export function cpLossFromSearches(best: EngineLine, afterChosen: EngineLine): number {
  const chosenFromPlayersView = -comparableCp(afterChosen);
  return centipawnLoss(comparableCp(best), chosenFromPlayersView);
}

/**
 * The cost of a move that ENDED the game, where there is no second search to compare against.
 *
 * A terminal position has no legal reply, so the engine emits no principal variation and
 * `analyze` resolves with `emptyLine` -- `scoreCp: 0`. Fed to the comparison above, that reads as
 * a dead-level evaluation, and the arithmetic then charges the player their entire advantage for
 * winning: a mate delivered from a +5.00 position scored as a 500-centipawn blunder, on the best
 * move of the game.
 *
 * Neither outcome needs the engine, because both are facts of the rules rather than evaluations:
 *
 *   - Checkmate is the best available move by definition. Nothing scores higher, so the loss is
 *     zero. This is not the clamp and not a convention; there is no better move to have played.
 *   - A draw by stalemate, repetition, the fifty-move rule or insufficient material really is
 *     0.00, so the loss is whatever the player was giving up by drawing -- which is the ordinary
 *     comparison against a genuine zero.
 */
export function cpLossOfFinalMove(best: EngineLine, outcome: "checkmate" | "draw"): number {
  return outcome === "checkmate" ? 0 : centipawnLoss(comparableCp(best), 0);
}
