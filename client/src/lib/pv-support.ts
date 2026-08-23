/**
 * How far a principal variation is actually backed, and where the reason for the move lives.
 *
 * THE DEFECT THIS EXISTS FOR. AnalysisPanel rendered eight PV moves as one flat list of equal
 * weight under a `D14` chip, on the same screen that says differences under 30 centipawns say
 * nothing. Two separate misreadings follow, and only the second is the one a player actually
 * runs into:
 *
 *   1. `D14` is the depth of the ROOT. The move at PV index i was chosen by a subtree search of
 *      roughly `14 - i` plies, so the tail is not backed the way the head is. Rendering them
 *      identically states otherwise.
 *   2. A PV is not an explanation. It is the engine's guess at how play continues if both sides
 *      play best -- and the answer to "why h5 and not f5" is nowhere in it, because it only ever
 *      describes what happens AFTER h5. The reason lives in the comparison against the move that
 *      was not played.
 *
 * A CORRECTION TO AN EARLIER SKETCH, recorded because it changes what is buildable. A third
 * criterion was proposed: find the node where the eval moves off the root value. It cannot be
 * derived from one search. The principal variation is BY CONSTRUCTION the line along which the
 * evaluation is the root score -- that is what makes it principal. Finding where an evaluation
 * moves would take a fresh search at every node of the line, at a cost this product measured for
 * the import path and declined there for the same reason.
 *
 * So the two things below are the two that a single search plus one alternative can honestly say.
 */
import { ENGINE_NOISE_CP } from "@/lib/reveal";

/** One move of the line, with the depth that stands behind it. */
export interface PvPly {
  move: string;
  /**
   * Plies of search below this node: `rootDepth - index`.
   *
   * Arithmetic, not a claim about Stockfish's internals. It is what "searched to depth D" means:
   * the root got D, the reply to the root move got D-1, and so on down the line.
   */
  remainingDepth: number;
}

export interface PvBacking {
  /** The prefix the nominal depth covers. */
  backed: PvPly[];
  /**
   * Moves dropped for sitting at or beyond the nominal depth.
   *
   * Not always zero: a PV can run longer than its nominal depth, because search extensions and
   * the transposition table both hand back moves the depth counter never paid for. Those are the
   * moves with the least behind them, printed in the same typeface as the first.
   */
  dropped: number;
  rootDepth: number;
}

/**
 * Split a PV into the part the nominal depth covers and the part it does not.
 *
 * The cut is `remainingDepth <= 0`, which needs no threshold to justify: it is the point where
 * the line has outrun the search that produced it. Everything shallower than that but still
 * positive is kept and carries its own number, because the honest presentation of a fall-off is
 * to show it, not to pick a cutoff nobody measured and call the rest equal.
 */
export function pvBacking(pv: string[], rootDepth: number): PvBacking {
  const plies = pv.map((move, index) => ({ move, remainingDepth: rootDepth - index }));
  const backed = plies.filter((p) => p.remainingDepth > 0);
  return { backed, dropped: plies.length - backed.length, rootDepth };
}

/** One root line, reduced to what the comparison needs. */
export interface RootLine {
  move: string;
  /** Centipawns from the side to move, as UCI reports it. */
  scoreCp: number;
  /** Set when this line is a forced mate. Then `scoreCp` is not a centipawn quantity. */
  mate?: number;
}

export type RootChoice =
  /** The engine returned one line. Nothing to compare, so nothing to say about the choice. */
  | { kind: "alone"; best: RootLine }
  /** At least one line is a forced mate. The difference is not a centipawn quantity. */
  | { kind: "mate"; best: RootLine; runnerUp: RootLine }
  /** The two are within evaluation noise: a preference, not a reason. */
  | { kind: "preference"; best: RootLine; runnerUp: RootLine; gapCp: number }
  /** The alternative really is worse, by this much. */
  | { kind: "reason"; best: RootLine; runnerUp: RootLine; gapCp: number };

/**
 * What the engine's choice at the root is worth.
 *
 * Both lines are scored at the same position with the same side to move, so the difference is
 * directly comparable with no perspective flip -- which is exactly why this is the one comparison
 * worth making, and why it is made here rather than between two separate `analyze` calls.
 *
 * `preference` is the case the product most needs and would otherwise fake. A 12-centipawn
 * difference at depth 14 is not a reason to play one move over the other; it is the engine
 * breaking a tie. Saying "the engine prefers h5" is true. Saying "h5 is right" is not, and a
 * screen that shows a line and a number and no third state will be read as the second.
 */
export function rootChoice(lines: RootLine[]): RootChoice | null {
  const best = lines[0];
  if (!best) return null;
  const runnerUp = lines[1];
  if (!runnerUp) return { kind: "alone", best };
  if (best.mate !== undefined || runnerUp.mate !== undefined) return { kind: "mate", best, runnerUp };

  /*
   * Clamped at zero. MultiPV returns lines in order, so the first should never score below the
   * second -- but a negative here would render as "the engine's own choice is worse", which is a
   * parsing bug wearing the costume of a finding.
   */
  const gapCp = Math.max(0, best.scoreCp - runnerUp.scoreCp);
  return gapCp <= ENGINE_NOISE_CP
    ? { kind: "preference", best, runnerUp, gapCp }
    : { kind: "reason", best, runnerUp, gapCp };
}
