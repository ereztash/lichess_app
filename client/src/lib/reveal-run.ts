import type { DraftDecision } from "@/lib/decision-session";
import type { LearningTransfer } from "@shared/learning-record";
import type { RevealTiming } from "@shared/reveal-timing";

/**
 * Everything the reveal needs, as one value.
 *
 * IT USED TO BE EIGHT POSITIONAL ARGUMENTS AND, SEPARATELY, A SEVEN-FIELD PIECE OF STATE. `probe`
 * holds a decision waiting on the counterfactual question -- the same seven values under another
 * name, kept in step by hand with nothing checking that they were. Naming the shape once is what
 * types `probe` as this minus the answer it waits for, and what lets a failed reveal be re-run at
 * all: a run is a value, so it can be kept.
 */
export type RevealRun = {
  draft: DraftDecision;
  decisionId: string;
  positionFen: string;
  /** The ply `positionFen` is; carried for the reason `transfer` is. */
  positionPly: number;
  isDrillDecision: boolean;
  /**
   * The transfer run this decision belongs to, or null.
   *
   * PASSED IN RATHER THAN READ FROM STATE. It used to be a boolean beside a `learningTransfer`
   * `runReveal` closed over -- which types as possibly-null and, worse, could have MOVED ON by the
   * time it runs: the counterfactual probe sits between the commit and the engine, so "the
   * transfer that was active when the decision was committed" and "the transfer that is active
   * now" are no longer the same value by construction.
   */
  transfer: LearningTransfer | null;
  /** The alternative the player named, or null. Scored off the same root search. */
  alternative: string | null;
  /** Which timing was in force. Everything the player is SHOWN is gated on it. */
  timing: RevealTiming;
};

