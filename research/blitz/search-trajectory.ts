/**
 * RESEARCH CODE. THE PRODUCT DOES NOT IMPORT THIS, AND MUST NOT UNTIL A GATE SAYS IT MAY.
 *
 * It lives under research/ rather than shared/ on purpose. Gate 1 of
 * docs/research/BLITZ_COMPUTATION_PREREG.md failed: no tested node budget produces a deep reference
 * stable to the preregistered tolerance, so nothing computed here has a validated ground truth to
 * be computed against. A module in shared/ says "the product measures this". The product does not.
 *
 * What it IS good for is the descriptive question, which survives the failed gate as an OBSERVATION
 * and nothing more: do positions differ at all in how much a search changes its answer as it is
 * given more to spend? See docs/research/BLITZ_COMPUTATION_RESULTS.md.
 *
 * What a search DID as it was given more to spend, expressed as numbers rather than as a score.
 *
 * The question this exists for is not "was the move best" but "how much did this position repay
 * further computation". A position where the engine's answer is settled at 200 nodes and a position
 * where it is still changing at 20,000 are different decision problems, and centipawn loss cannot
 * tell them apart -- it is computed after the fact, from one budget, and says nothing about how
 * hard the answer was to find.
 *
 * THE RULE THAT MAKES THESE NUMBERS MEAN ANYTHING: a move chosen at a small budget is scored by the
 * DEEP REFERENCE, never by the budget that chose it. A shallow search that both picks a move and
 * grades it will report that its own move is excellent, because that is what "chose it" means. The
 * shallow value is kept alongside, and it is deliberately not what any metric below reads.
 *
 * Deliberately NOT a composite. `remainingComputationValue`, `convergenceNodes`, `moveInstability`
 * and `candidateGap` stay separate: combining them into one "computation need" number is a claim
 * that they measure one thing, and that claim needs evidence rather than an average. See
 * docs/research/BLITZ_COMPUTATION_PREREG.md §6.4.
 *
 * Values are winning chances in [0, 1] from the MOVER's point of view (shared/win-probability.ts),
 * not centipawns: thirty centipawns is worth ten times as much at a level position as at +10.00,
 * and a metric denominated in them would mean something different in every position.
 */

/** One budget's worth of observation. `null` where the engine returned nothing usable. */
export interface BudgetObservation {
  /** The node budget asked for. */
  nodes: number;
  /** Nodes the engine actually spent; it overshoots a limit. */
  actualNodes?: number;
  /** The move this budget would have played, in UCI notation. */
  chosenMove: string | null;
  /** What this budget thought the position was worth. NOT used by any metric below. */
  shallowValue: number | null;
  /** What the deep reference says the move chosen here is worth. This is what the metrics read. */
  deepValueOfChosenMove: number | null;
  /** This budget's ranked candidates, best first, with its own (shallow) values. */
  topMoves: Array<{ move: string; shallowValue: number }>;
}

/** The reference every shallow choice is judged against. */
export interface DeepReference {
  /** Budget in nodes at which the reference was computed. */
  nodes: number;
  /** The reference's own best move, UCI. */
  bestMove: string | null;
  /** Deep value of the reference's best move -- the ceiling for this position. */
  bestValue: number | null;
  /**
   * Deep values of the reference's ranked candidates, best first.
   *
   * Every entry is scored by the SAME procedure at the SAME budget (`go searchmoves <m>`), so the
   * numbers are comparable to each other and to `deepValueOfChosenMove`. Reading them off a
   * MultiPV list instead would mix ranks that were searched to different effective depths.
   */
  ranked: Array<{ move: string; value: number }>;
}

export interface SearchTrajectory {
  /** Value still on the table after the largest budget observed. */
  remainingComputationValue: number | null;
  /** The same at the 1,000-node budget, or the nearest budget at or below it. */
  remainingComputationValueEarly: number | null;
  /** Mean remaining value across all observed budgets -- the area under the RCV curve. */
  remainingComputationValueArea: number | null;
  /** Smallest budget from which the chosen move never changes again. Null when it never settles. */
  convergenceNodes: number | null;
  /** How many times the chosen move changed from one budget to the next. */
  moveInstability: number;
  /** The largest budget at which the move still changed. Null when it never changed. */
  lastSwitchNodes: number | null;
  /** Deep value of the last budget's move minus the first budget's move. */
  valueGainFirstToLast: number | null;
  /** Deep value of the best move minus the second best. Null when there is no second. */
  candidateGap: number | null;
  /** Budgets that produced a usable observation. A metric from two points is not a trajectory. */
  observedBudgets: number;
}

/** Budget at or below which `remainingComputationValueEarly` is read. */
export const EARLY_BUDGET = 1_000;

const usable = (o: BudgetObservation) => o.chosenMove !== null && o.deepValueOfChosenMove !== null;

/**
 * Budgets in ascending order, and every function below starts here.
 *
 * "The caller passes them in order" is the kind of contract that holds until one caller builds the
 * list from a Map. `moveInstability` and `convergenceNodes` read ADJACENCY, so an out-of-order list
 * does not fail -- it silently returns a different number, which is the worst way for this to go
 * wrong.
 */
const byBudget = (observations: readonly BudgetObservation[]) =>
  [...observations].sort((a, b) => a.nodes - b.nodes);

/**
 * Value the search had not yet found at this budget: what the reference's move is worth, minus
 * what this budget's move is worth, both judged deep.
 *
 * Clamped at zero. A shallow search that stumbles onto something the reference ranks higher than
 * its own best move is a reference that is not deep enough, not a negative amount of missing value;
 * the clamp keeps that from reading as a discovery. The saturation study is what bounds how often
 * it can happen.
 */
export function remainingComputationValue(
  deepBestValue: number | null,
  deepValueOfChosenMove: number | null,
): number | null {
  if (deepBestValue === null || deepValueOfChosenMove === null) return null;
  return Math.max(0, deepBestValue - deepValueOfChosenMove);
}

/** How many times the chosen move changed between adjacent observed budgets. */
export function moveInstability(observations: readonly BudgetObservation[]): number {
  const moves = byBudget(observations).filter((o) => o.chosenMove !== null).map((o) => o.chosenMove);
  let switches = 0;
  for (let i = 1; i < moves.length; i += 1) if (moves[i] !== moves[i - 1]) switches += 1;
  return switches;
}

/**
 * The smallest budget from which the chosen move is the final one and never changes again.
 *
 * Null when the last budget produced nothing to converge ON -- which is a different statement from
 * "converged at the largest budget" and must not be encoded as the same number.
 */
export function convergenceNodes(observations: readonly BudgetObservation[]): number | null {
  const seen = byBudget(observations).filter((o) => o.chosenMove !== null);
  if (!seen.length) return null;
  const final = seen[seen.length - 1].chosenMove;
  let at = seen[seen.length - 1].nodes;
  for (let i = seen.length - 1; i >= 0; i -= 1) {
    if (seen[i].chosenMove !== final) break;
    at = seen[i].nodes;
  }
  return at;
}

/** The largest budget at which the move still changed; null when it never did. */
export function lastSwitchNodes(observations: readonly BudgetObservation[]): number | null {
  const seen = byBudget(observations).filter((o) => o.chosenMove !== null);
  let last: number | null = null;
  for (let i = 1; i < seen.length; i += 1)
    if (seen[i].chosenMove !== seen[i - 1].chosenMove) last = seen[i].nodes;
  return last;
}

/**
 * The gap between the reference's best and second-best move, both judged deep.
 *
 * This is a POSITION-DIFFICULTY measure and is treated as one everywhere: in the preregistered
 * models it sits in the BASELINE, not among the trajectory features, precisely so that "does search
 * shape add anything" is not answered by smuggling in the simplest possible statement that a
 * position is sharp.
 */
export function candidateGap(reference: DeepReference): number | null {
  if (reference.ranked.length < 2) return null;
  return Math.max(0, reference.ranked[0].value - reference.ranked[1].value);
}

/** Every preregistered metric, from one position's observations. Budget order does not matter. */
export function searchTrajectory(
  reference: DeepReference,
  observations: readonly BudgetObservation[],
): SearchTrajectory {
  const ordered = byBudget(observations);
  const seen = ordered.filter(usable);
  const rcvs = seen
    .map((o) => remainingComputationValue(reference.bestValue, o.deepValueOfChosenMove))
    .filter((v): v is number => v !== null);
  const early = seen.filter((o) => o.nodes <= EARLY_BUDGET).pop() ?? null;
  const last = seen[seen.length - 1] ?? null;
  const first = seen[0] ?? null;

  return {
    remainingComputationValue: last
      ? remainingComputationValue(reference.bestValue, last.deepValueOfChosenMove)
      : null,
    remainingComputationValueEarly: early
      ? remainingComputationValue(reference.bestValue, early.deepValueOfChosenMove)
      : null,
    remainingComputationValueArea: rcvs.length
      ? rcvs.reduce((a, b) => a + b, 0) / rcvs.length
      : null,
    convergenceNodes: convergenceNodes(ordered),
    moveInstability: moveInstability(ordered),
    lastSwitchNodes: lastSwitchNodes(ordered),
    valueGainFirstToLast:
      last && first && last.deepValueOfChosenMove !== null && first.deepValueOfChosenMove !== null
        ? last.deepValueOfChosenMove - first.deepValueOfChosenMove
        : null,
    candidateGap: candidateGap(reference),
    observedBudgets: seen.length,
  };
}
