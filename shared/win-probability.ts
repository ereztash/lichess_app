/**
 * What a mistake actually cost, in the only unit that means the same thing twice.
 *
 * THE DEFECT THIS EXISTS FOR. A decision counted as accurate when it cost no more than
 * `ACCURATE_CP_LOSS = 30` centipawns. Calibration is `P(event | stated confidence)`, and that
 * requires the event to be ONE event -- but thirty centipawns is not one thing:
 *
 *     position stood at    30cp costs
 *              level          2.76pp of winning chances
 *             +2.00           2.46pp
 *             +5.00           1.36pp
 *            +10.00           0.28pp      <- a tenth of the same "event"
 *
 * Nearly ten to one across the range, so "accurate" meant something different depending on how
 * the game stood -- and a player in a winning position was being charged for a slip that cost
 * them nothing, while the same slip at level cost them real chances. Read the other way it is
 * starker: at level, 2.76pp of winning chances costs 30cp; at +10.00 it takes 212cp to lose the
 * same 2.76pp.
 *
 * The repair is to define the outcome in the quantity that is invariant -- how much of the
 * player's winning chances the move gave away -- rather than in centipawns, which are a currency
 * whose exchange rate moves with the position.
 *
 * THE THRESHOLD IS DERIVED, NOT CHOSEN. It is exactly what thirty centipawns costs at a level
 * position, so the new rule agrees with the old one where the old one was defensible and departs
 * from it only where it was not. Nothing about the accuracy rate on balanced positions moves.
 *
 * THE CONSTANT IS POPULATION-DEPENDENT, AND THIS IS THE HONEST CAVEAT. Lichess fitted k on games
 * between 2300-rated players; published estimates for grandmasters are roughly twice as steep,
 * which means a given centipawn loss costs a stronger field MORE of its winning chances than this
 * curve says. Every product that inherits this constant for a different population is misstating
 * what moves cost, this one included. It is used because it is the published, reproducible fit
 * for the population this app's players actually come from; it is not a law of chess.
 */

/**
 * Lichess's logistic, from their `AccuracyPercent.scala`, fitted on 2300-rated games.
 *
 * Kept at their value rather than re-fitted, so a number here can be checked against theirs.
 */
export const WIN_PROBABILITY_K = 0.00368208;

/**
 * The mover's winning chances at an evaluation, 0..1.
 *
 * `cp` is from the side to move's point of view, which is what UCI reports and what the record
 * stores. Positive means the player about to move is better.
 */
export function winProbability(cp: number): number {
  return 1 / (1 + Math.exp(-WIN_PROBABILITY_K * cp));
}

/**
 * How much of the mover's winning chances a move gave away, 0..1.
 *
 * Clamped at zero: a negative loss is not a thing that exists, and a search that came back out of
 * order should not be able to hand a player credit for a mistake.
 */
export function winProbabilityLoss(evalCp: number, cpLoss: number): number {
  return Math.max(0, winProbability(evalCp) - winProbability(evalCp - cpLoss));
}
