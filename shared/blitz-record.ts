/**
 * WHAT A PLAYED BLITZ GAME LEAVES BEHIND, and the join that refuses rather than guesses.
 *
 * Until this file the blitz route measured a great deal and kept none of it: a game was played,
 * analysed once it ended, shown, and lost with the tab. That is the whole reason PR-11's dataset
 * did not exist -- not because nobody had played, but because nothing wrote anything down.
 *
 * THREE SOURCES DESCRIBE THE SAME PLIES AND NONE OF THEM IS THE OTHERS.
 *
 *   `BlitzDecision`        the game core -- move, both clocks, and the think time FROZEN AT COMMIT
 *   `InstrumentedDecision` the instrument -- whether the sampler asked, at what probability, the
 *                          confidence when one was given, and the latency the question cost
 *   `AnalysedDecision`     the engine, AFTER THE GAME ENDED (INV-4) -- centipawns lost, standing
 *
 * Joining them is the one operation here, and it REFUSES on any disagreement instead of matching up
 * what it can. A dataset assembled from a best-effort join is a dataset where a confidence belongs
 * to one move and a cp-loss to another, and nothing downstream could ever detect it: every row
 * would look complete. See `JoinRefusal`.
 *
 * WHY THESE ROWS DO NOT BECOME DECISION ATOMS: `docs/blitz/ADR-004`. The atom requires two stated
 * reads that nobody writes during a three-minute game, and an empty string for them would read
 * afterwards as "asked, and answered with silence".
 */
import type { BlitzDecision, RequiredTimeControl, Side } from "./blitz-game-core.js";
import type { FinishedGame, AnalysedDecision } from "./blitz-post-game.js";
import type { InstrumentedDecision } from "./blitz-instrument.js";
import { BLITZ_ASK_RATE, BLITZ_SAMPLING_POLICY_VERSION } from "./blitz-instrument.js";
import { CURRENT_PROTOCOL_VERSION } from "./measurement-protocol.js";

/** One decision, with everything the three sources knew about it and nothing invented. */
export interface StoredBlitzDecision {
  gameId: string;
  ply: number;
  side: Side;
  san: string;
  fenBefore: string;
  /** Frozen at commit by the core. Nothing here recomputes it. */
  thinkMs: number;
  clockBeforeMs: number;
  opponentClockBeforeMs: number;
  /** Whether the sampler chose this decision. Recorded even when no answer ever came. */
  wasAsked: boolean;
  /** The probability in force at the moment of the choice, so the regime is reconstructable. */
  samplingProbability: number;
  /** Null when unasked or unanswered. Never zero -- zero is a confidence somebody stated. */
  confidence: number | null;
  /** Null when nothing was asked. Never zero -- see the field note on `InstrumentedDecision`. */
  instrumentationLatencyMs: number | null;
  /** Null when the evaluator could not answer for one of the two positions. */
  cpLoss: number | null;
  standingCp: number | null;
}

/** The game the decisions came from, and the conditions every one of them was made under. */
export interface StoredBlitzGame {
  gameId: string;
  playedAs: Side;
  timeControl: RequiredTimeControl;
  outcome: FinishedGame["outcome"];
  startedAt: string;
  finishedAt: string;
  /*
   * THE CONDITIONS, STORED ON THE GAME RATHER THAN RE-DERIVED. A later reader must be able to tell
   * which regime produced a row without knowing what the constants happened to be that week, which
   * is the same argument `samplingProbability` makes per decision.
   */
  measurementProtocol: "instrumented-blitz";
  protocolVersion: number;
  analysisTiming: "after-play";
  samplingPolicyVersion: number;
  askRate: number;
}

export interface StoredBlitzRecord {
  game: StoredBlitzGame;
  decisions: StoredBlitzDecision[];
}

/**
 * Why a game was not stored. Every one of these is a bug upstream, not a condition to work around.
 */
export type JoinRefusal =
  | { refused: "counts-disagree"; core: number; instrument: number; analysis: number }
  | { refused: "plies-disagree"; at: number }
  | { refused: "moves-disagree"; at: number; core: string; analysis: string }
  | { refused: "no-decisions" };

/**
 * Assemble one stored record, or refuse.
 *
 * THE CALLER PASSES THE PLAYER'S SIDE because the game core does not know it -- it runs both sides
 * of the board and `chooseOpponentMove` drives one of them. Deriving it here from, say, the side of
 * the first decision would be right in every game the product plays today and wrong the moment
 * anything starts a game from a position where it is Black to move.
 */
export function toStoredRecord(
  game: FinishedGame,
  instrumented: readonly InstrumentedDecision[],
  analysed: readonly AnalysedDecision[],
  meta: { gameId: string; playedAs: Side; startedAt: string; finishedAt: string },
): StoredBlitzRecord | JoinRefusal {
  const core: readonly BlitzDecision[] = game.decisions;
  if (core.length === 0) return { refused: "no-decisions" };
  if (core.length !== instrumented.length || core.length !== analysed.length) {
    return {
      refused: "counts-disagree",
      core: core.length,
      instrument: instrumented.length,
      analysis: analysed.length,
    };
  }

  const decisions: StoredBlitzDecision[] = [];
  for (let i = 0; i < core.length; i += 1) {
    const c = core[i];
    const inst = instrumented[i];
    const an = analysed[i];
    /*
     * MATCHED ON PLY AND ON THE MOVE ITSELF, not on position in the array. Equal lengths are not
     * the same fact as the same decisions: a dropped row and a duplicated one leave the count
     * intact and shift everything after them by one, which is exactly the corruption that would be
     * invisible in the finished dataset.
     */
    if (c.ply !== inst.decision.ply || c.ply !== an.ply) return { refused: "plies-disagree", at: i };
    if (c.san !== an.san || c.san !== inst.decision.san) {
      return { refused: "moves-disagree", at: i, core: c.san, analysis: an.san };
    }
    decisions.push({
      gameId: meta.gameId,
      ply: c.ply,
      side: c.side,
      san: c.san,
      fenBefore: c.fenBefore,
      thinkMs: c.thinkMs,
      clockBeforeMs: c.clockBeforeMs,
      opponentClockBeforeMs: c.opponentClockBeforeMs,
      wasAsked: inst.wasAsked,
      samplingProbability: inst.samplingProbability,
      confidence: inst.confidence,
      instrumentationLatencyMs: inst.instrumentationLatencyMs,
      cpLoss: an.cpLoss,
      standingCp: an.standingCp,
    });
  }

  return {
    game: {
      gameId: meta.gameId,
      playedAs: meta.playedAs,
      timeControl: game.timeControl,
      outcome: game.outcome,
      startedAt: meta.startedAt,
      finishedAt: meta.finishedAt,
      measurementProtocol: "instrumented-blitz",
      protocolVersion: CURRENT_PROTOCOL_VERSION,
      analysisTiming: "after-play",
      samplingPolicyVersion: BLITZ_SAMPLING_POLICY_VERSION,
      askRate: BLITZ_ASK_RATE,
    },
    decisions,
  };
}

export const isRefusal = (r: StoredBlitzRecord | JoinRefusal): r is JoinRefusal => "refused" in r;
