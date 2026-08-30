/**
 * HOW MUCH OF THE CALIBRATION GAP IS A PROPERTY OF THE GAME RATHER THAN OF THE DECISION.
 *
 * WHY THE QUESTION IS OPEN AT ALL. `shared/detector.ts` divides a bucket's gap variance by the
 * number of DECISIONS in it, which is right if decisions are independent draws. `DecisionAtom`
 * carries `game_id`, and moves from one game share an opponent, an opening, a clock, a time
 * control and a player who was in one state of mind for all of them. Nobody has ever measured how
 * much that matters on a real record, because `scoreDecisions` does not carry `game_id` through to
 * the detector -- game identity is dropped at exactly the boundary where the question arises.
 *
 * WHAT THE ORACLE ALREADY SETTLED, so this module is not asking a question that has an answer.
 * `research/discovery-oracle/q1_units.py` measured the shipped standard error against the TRUE
 * sampling error over 6,000 simulated records: it is understated by 0 to 38% as the game-level
 * component runs from nothing to an intraclass correlation of 0.058, and the worst cells are the
 * clock and think-time buckets, whose membership is a property of the game. It also measured the
 * obvious fix and REFUTED it -- a cluster-robust standard error over twenty games is worse
 * calibrated than the formula it would replace, because twenty clusters is not enough for the
 * sandwich to estimate itself. So the detector is unchanged, and what is missing is not an
 * estimator but a NUMBER: the intraclass correlation of a real player's gap.
 *
 * THIS MODULE IS THAT MEASUREMENT AND NOTHING ELSE. It computes no verdict, changes no threshold
 * and is read by no product path. It exists so the open question in the M0 audit can be closed
 * with data the moment a record with enough games exists, rather than argued.
 */
import type { DecisionAtom } from "../decision-atom.js";
import { decisionGap, type ScoredDecision } from "../detector.js";

/**
 * The per-decision gaps of one record, grouped by the game they were taken in.
 *
 * TAKES THE ATOMS ALONGSIDE THE SCORED DECISIONS, and the awkwardness is the finding rather than
 * a design flaw: `ScoredDecision` has no `game_id`, so the only way to recover it is to carry the
 * atoms in parallel. `scoreDecisions` SKIPS atoms -- unrevealed ones, and ones where no confidence
 * was asked -- so the two arrays are not index-aligned, and this takes the ids it kept.
 *
 * A decision whose game is not known is EXCLUDED and counted, never pooled into a group of its
 * own: one bag of decisions from unknown games would look like one enormous cluster and would
 * dominate every quantity below.
 */
export function gapsByGame(
  scored: readonly ScoredDecision[],
  gameIdOf: (decision: ScoredDecision) => string | null,
): { groups: Map<string, number[]>; withoutGame: number } {
  const groups = new Map<string, number[]>();
  let withoutGame = 0;
  for (const decision of scored) {
    const gameId = gameIdOf(decision);
    if (gameId === null) {
      withoutGame += 1;
      continue;
    }
    const bucket = groups.get(gameId) ?? [];
    bucket.push(decisionGap(decision));
    groups.set(gameId, bucket);
  }
  return { groups, withoutGame };
}

/**
 * A lookup from a scored decision back to the game it came from.
 *
 * Built from the atoms and the ids `scoreDecisions` was given, which is the only place both facts
 * are available. Returns null for a decision id nothing mapped, rather than a fabricated game.
 */
export function gameIdLookup(
  atoms: readonly DecisionAtom[],
  ids: readonly string[],
): (decision: ScoredDecision) => string | null {
  const byId = new Map<string, string>();
  atoms.forEach((atom, index) => {
    const id = ids[index];
    if (id !== undefined) byId.set(id, atom.entry_state.game_id);
  });
  return (decision) => byId.get(decision.decision_id) ?? null;
}

export interface ClusterReading {
  decisions: number;
  games: number;
  /** Decisions whose game was not recoverable. Counted, never pooled. See `gapsByGame`. */
  withoutGame: number;
  meanGameSize: number;
  /**
   * The share of the gap's variance that lies BETWEEN games rather than within them.
   *
   * NaN rather than zero where it cannot be estimated -- fewer than two games, or no decision
   * inside a game. Zero would assert that the between-game component was measured and found
   * absent, which is a different statement from "this record cannot say".
   *
   * IT CAN COME BACK NEGATIVE, AND THAT IS NOT A BUG TO CLAMP AWAY. The ANOVA estimator's value
   * when the true correlation is zero is not zero -- it is `-1 / (n0 - 1)`, because the
   * between-game mean square is then an unbiased estimate of the within-game one and the
   * difference is as often below as above. A record of twenty-decision games with no game effect
   * reads about -0.053. Clamping it at zero here would make every no-effect record look like a
   * small positive effect, which is the direction that manufactures a reason to change the
   * detector. `moultonFactor` clamps instead, where clamping is the conservative direction.
   */
  intraclassCorrelation: number;
  /**
   * What the shipped standard error would be multiplied by, for a subgroup whose MEMBERSHIP is
   * perfectly determined by the game. The upper bound rather than the estimate -- see
   * `moultonFactor`.
   */
  worstCaseInflation: number;
}

/**
 * The one-way ANOVA intraclass correlation of the gap, with the unbalanced-design correction.
 *
 * THE CORRECTION IS NOT OPTIONAL HERE. Games differ in length by a factor of ten in this record --
 * a three-minute game and a thirty-minute one are not the same number of decisions -- and the
 * textbook formula assumes equal group sizes. Without `n0` the estimate is biased by exactly the
 * property of the data that made the question worth asking.
 */
export function intraclassCorrelation(groups: ReadonlyMap<string, readonly number[]>): number {
  const sizes: number[] = [];
  const means: number[] = [];
  let total = 0;
  let sum = 0;
  for (const values of groups.values()) {
    if (values.length === 0) continue;
    sizes.push(values.length);
    means.push(values.reduce((a, b) => a + b, 0) / values.length);
    total += values.length;
    sum += values.reduce((a, b) => a + b, 0);
  }
  const k = sizes.length;
  if (k < 2 || total <= k) return Number.NaN;
  const grand = sum / total;

  let ssBetween = 0;
  let index = 0;
  for (const values of groups.values()) {
    if (values.length === 0) continue;
    ssBetween += values.length * (means[index] - grand) ** 2;
    index += 1;
  }
  let ssWithin = 0;
  index = 0;
  for (const values of groups.values()) {
    if (values.length === 0) continue;
    for (const value of values) ssWithin += (value - means[index]) ** 2;
    index += 1;
  }

  const msBetween = ssBetween / (k - 1);
  const msWithin = ssWithin / (total - k);
  const sumSquares = sizes.reduce((a, b) => a + b * b, 0);
  const n0 = (total - sumSquares / total) / (k - 1);
  const denominator = msBetween + (n0 - 1) * msWithin;
  if (!(denominator > 0)) return Number.NaN;
  return (msBetween - msWithin) / denominator;
}

/**
 * Moulton's variance inflation: how much a clustered residual costs a standard error.
 *
 *     factor = sqrt(1 + (meanGameSize - 1) * regressorIcc * residualIcc)
 *
 * BOTH CORRELATIONS ARE REQUIRED, and that is the part usually skipped. A clustered residual costs
 * nothing if the thing being compared varies freely WITHIN a game: the three phase buckets are all
 * present in every game, so `phase-endgame` is barely affected -- which is what the oracle
 * measured. It is the clock and think-time buckets that suffer, because a three-minute game is
 * entirely inside `fast-under-45s` and a thirty-minute one is mostly outside it, so membership is
 * very nearly a property of the game.
 *
 * PASSING `regressorIcc = 1` GIVES THE WORST CASE and is what `ClusterReading` reports: a subgroup
 * that a game is wholly in or wholly out of. No real bucket reaches it, so the reported figure is
 * a bound rather than a prediction -- which is the right shape for a number whose purpose is to
 * say whether anything needs to change.
 */
export function moultonFactor(
  residualIcc: number,
  meanGameSize: number,
  regressorIcc = 1,
): number {
  if (!Number.isFinite(residualIcc) || !Number.isFinite(meanGameSize)) return Number.NaN;
  const inflation = 1 + (meanGameSize - 1) * regressorIcc * Math.max(residualIcc, 0);
  return Math.sqrt(Math.max(inflation, 0));
}

/** Everything this record can say about whether a decision is an observation. */
export function readClustering(
  scored: readonly ScoredDecision[],
  gameIdOf: (decision: ScoredDecision) => string | null,
): ClusterReading {
  const { groups, withoutGame } = gapsByGame(scored, gameIdOf);
  let counted = 0;
  for (const values of groups.values()) counted += values.length;
  const games = groups.size;
  const meanGameSize = games > 0 ? counted / games : Number.NaN;
  const icc = intraclassCorrelation(groups);
  return {
    decisions: counted,
    games,
    withoutGame,
    meanGameSize,
    intraclassCorrelation: icc,
    worstCaseInflation: moultonFactor(icc, meanGameSize),
  };
}
