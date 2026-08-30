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
import { z } from "zod";
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
  /*
   * THE PLAYER'S DECISIONS, NOT THE GAME'S, AND THIS WAS A DEFECT THE UNIT TESTS COULD NOT SEE.
   *
   * The core records a decision for every move, both sides -- it runs the whole board. The engine
   * scores every one of them, for the same reason. The instrument records only the PLAYER'S, since
   * `recordCommitted` is called from the move handler and the opponent does not go through it. So
   * the three sources are two lengths, and requiring all three to match rejected every real game.
   *
   * Found end to end, not here: every fixture in the unit tests fed all three sources the same
   * plies, which is the one thing a real game never does. Filtering to the player is also the
   * dataset the study wants -- a calibration record is about the person, not their opponent.
   */
  const core: readonly BlitzDecision[] = game.decisions.filter((d) => d.side === meta.playedAs);
  const mine: readonly AnalysedDecision[] = analysed.filter((d) => d.side === meta.playedAs);
  if (core.length === 0) return { refused: "no-decisions" };
  if (core.length !== instrumented.length || core.length !== mine.length) {
    return {
      refused: "counts-disagree",
      core: core.length,
      instrument: instrumented.length,
      analysis: mine.length,
    };
  }

  const decisions: StoredBlitzDecision[] = [];
  for (let i = 0; i < core.length; i += 1) {
    const c = core[i];
    const inst = instrumented[i];
    const an = mine[i];
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

/**
 * The wire shape, validated rather than trusted.
 *
 * THE JOIN RUNS ON THE CLIENT because that is where all three sources are, and a server that took
 * the three separately would have to reproduce the join and could disagree with the one the player
 * saw. What crosses the wire is therefore already assembled -- which is exactly why it is checked
 * here rather than accepted: an assembled object is one a caller could have assembled wrongly.
 *
 * `nullable()` on the four is load-bearing. `optional()` would let a client that simply omitted a
 * confidence be indistinguishable from one reporting that none was given.
 */
export const storedBlitzDecisionSchema = z.object({
  gameId: z.string().min(1).max(64),
  ply: z.number().int().positive(),
  side: z.enum(["w", "b"]),
  san: z.string().min(2).max(16),
  fenBefore: z.string().min(10).max(120),
  thinkMs: z.number().int().nonnegative(),
  clockBeforeMs: z.number().int(),
  opponentClockBeforeMs: z.number().int(),
  wasAsked: z.boolean(),
  samplingProbability: z.number().min(0).max(1),
  confidence: z.number().int().nullable(),
  instrumentationLatencyMs: z.number().int().nonnegative().nullable(),
  cpLoss: z.number().int().nullable(),
  standingCp: z.number().int().nullable(),
});

export const storedBlitzRecordSchema = z
  .object({
    game: z.object({
      gameId: z.string().min(1).max(64),
      playedAs: z.enum(["w", "b"]),
      timeControl: z.object({
        initialMs: z.number().int().positive(),
        incrementMs: z.number().int().nonnegative(),
      }),
      /*
       * THE UNION SPELLED OUT, not `{ kind: string }` with the rest waved through. A passthrough
       * here would accept `{ kind: "flag" }` with no loser and store a decisive game that names
       * nobody as having lost it, which nothing downstream could repair.
       */
      outcome: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("flag"), loser: z.enum(["w", "b"]) }),
        z.object({ kind: z.literal("checkmate"), loser: z.enum(["w", "b"]) }),
        z.object({
          kind: z.literal("draw"),
          reason: z.enum(["stalemate", "insufficient", "threefold", "fifty-move"]),
        }),
        z.object({ kind: z.literal("resignation"), loser: z.enum(["w", "b"]) }),
      ]),
      startedAt: z.string().min(1),
      finishedAt: z.string().min(1),
      /*
       * LITERALS, NOT THE FULL ENUMS. This route stores blitz games, and INV-4 says the engine ran
       * after the game or the game was not analysed. A client reporting `during-play` here is not a
       * variant to record, it is a client that violated the invariant, and the honest answer is to
       * refuse the row rather than to store the claim.
       */
      measurementProtocol: z.literal("instrumented-blitz"),
      protocolVersion: z.number().int().positive(),
      analysisTiming: z.literal("after-play"),
      samplingPolicyVersion: z.number().int().nonnegative(),
      askRate: z.number().min(0).max(1),
    }),
    decisions: z.array(storedBlitzDecisionSchema).min(1),
  })
  .refine((r) => r.decisions.every((d) => d.gameId === r.game.gameId), {
    message: "a decision names a different game than the one it arrived with",
  })
  .refine((r) => new Set(r.decisions.map((d) => d.ply)).size === r.decisions.length, {
    message: "two decisions claim the same ply",
  });
