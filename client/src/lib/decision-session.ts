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
import { classifyPhase } from "@shared/phase";

export type SessionStage = "deciding" | "committing" | "committed" | "revealed" | "blocked";

export interface PositionUnderDecision {
  gameId: string;
  fen: string;
  ply: number;
  clockMsRemaining: number | null;
}

export interface DraftDecision {
  chosenMove: string | null;
  known: string;
  unknown: string;
  confidence: number | null;
  candidatesConsidered: string[];
}

export const emptyDraft = (): DraftDecision => ({
  chosenMove: null,
  known: "",
  unknown: "",
  confidence: null,
  candidatesConsidered: [],
});

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
  if (draft.known.trim().length === 0) {
    problems.push({ field: "known", message: "לא נכתב מה העמדה דורשת." });
  }
  if (draft.unknown.trim().length === 0) {
    // Required, with no default. An empty answer and an unanswered one must not look the same.
    problems.push({ field: "unknown", message: "לא נכתב מה אי אפשר להעריך כאן." });
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
    known: draft.known.trim(),
    unknown: draft.unknown.trim(),
    decision: draft.chosenMove!,
    bounded_action: {
      seconds_taken: secondsTaken,
      confidence: draft.confidence!,
      // The chosen move is always among the candidates considered.
      candidate_moves_considered: [
        ...new Set([draft.chosenMove!, ...draft.candidatesConsidered]),
      ].slice(0, 8),
    },
    result: null,
    feedback: null,
  };
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
 */
export function cpLossFromSearches(bestScoreCp: number, afterChosenScoreCp: number): number {
  const chosenFromPlayersView = -afterChosenScoreCp;
  return centipawnLoss(bestScoreCp, chosenFromPlayersView);
}
