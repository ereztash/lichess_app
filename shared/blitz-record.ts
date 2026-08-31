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
import { CONFIDENCE_GRID_VERSION, CONFIDENCE_LEVELS } from "./confidence.js";

/**
 * WHETHER THE ENGINE HAS SCORED A GAME. A state, never an absence.
 *
 * The game is written BEFORE the analysis runs, so a tab closed mid-analysis cannot lose it. That
 * makes a null `cpLoss` ambiguous for the first time: it used to mean only "the evaluator could not
 * answer for one of the two positions", and it would now ALSO mean "nothing has asked it yet".
 * Those are different facts and must not share an encoding.
 *
 *   pending         stored, not yet scored. Every cpLoss is null BECAUSE nothing has run.
 *   complete        scored. A null cpLoss now means the evaluator could not answer.
 *   refused         the analysis ran and declined the game -- see `AnalysisRefusal`.
 *   legacy-unknown  written before this field existed. NEVER backfilled to `complete`.
 *
 * The legacy value is separate for the reason `measurement-protocol.ts` gives for its own: those
 * rows really were analysed before they were stored, but nothing recorded it, and writing
 * `complete` into them would assert a fact this build did not observe.
 */
export const BLITZ_ANALYSIS_STATES = ["pending", "complete", "refused", "legacy-unknown"] as const;
export type BlitzAnalysisState = (typeof BLITZ_ANALYSIS_STATES)[number];

/** What scored a game, carried so a reading can refuse to pool two engines. */
export interface BlitzAnalysisProvenance {
  engine: string;
  build: string;
  depth: number;
}

/** Who the player was playing, carried for the same reason. */
export interface BlitzOpponentProvenance {
  kind: string;
  engine: string;
  build: string;
  depth: number;
}

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
  /**
   * HOW MANY BUTTONS THAT LEVEL WAS ONE OF, and the version of the grid it was stated on.
   *
   * `decisions` has carried both since R-10; `blitz_decisions` carried neither, and stored a bare
   * `confidence: 6`. That is the same defect one table over, and it is worse here: the blitz row is
   * the ONLY place a confidence is recorded during a timed game, so a scale change would silently
   * re-mean every blitz calibration reading ever taken, with the count still matching and the word
   * under the button unchanged.
   *
   * NULL MEANS WRITTEN BEFORE THESE COLUMNS EXISTED and is not backfilled -- see
   * `LEGACY_BLITZ_CONFIDENCE_SCALE`. A FRESH row may not omit them: `storedBlitzRecordSchema`
   * refuses a stated confidence that does not say what scale it was stated on.
   */
  confidenceScale: number | null;
  confidenceGridVersion: number | null;
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
  /**
   * Whether the engine has scored this game. See `BLITZ_ANALYSIS_STATES`.
   *
   * A game is now stored the moment it ends, BEFORE the engine runs, so that a tab closed during
   * analysis cannot lose it. This field is what keeps "not scored yet" distinguishable from "the
   * evaluator could not answer", which would otherwise both be a null `cpLoss`.
   */
  analysisState: BlitzAnalysisState;
  /** When the engine finished. Null wherever the state is not `complete`. */
  analysedAt: string | null;
  /** What scored it. Null wherever the state is not `complete`. */
  analysis: BlitzAnalysisProvenance | null;
  /** Who the player was playing. Null only on rows written before this was recorded. */
  opponent: BlitzOpponentProvenance | null;
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
  meta: ScoredBlitzRecordMeta,
): StoredBlitzRecord | JoinRefusal {
  const pending = toPendingRecord(game, instrumented, meta);
  if (isRefusal(pending)) return pending;
  return attachAnalysis(pending, analysed, meta.playedAs, meta.analysis, meta.analysedAt);
}

/** Everything the caller knows that the game core does not. */
export interface BlitzRecordMeta {
  gameId: string;
  playedAs: Side;
  startedAt: string;
  finishedAt: string;
  /**
   * Who the player was playing.
   *
   * Optional and nullable are two different statements here, and both are wanted. Omitting it says
   * this caller does not know; `null` says the same thing explicitly. Neither is allowed to become
   * a default opponent, because a row that names an opponent it never had is worse than a row that
   * names none: nothing downstream could tell it from a real one.
   */
  opponent?: BlitzOpponentProvenance | null;
}

/**
 * The same, plus the two facts a SCORED record cannot be assembled without.
 *
 * SEPARATE FROM `BlitzRecordMeta`, AND THAT IS THE POINT. These two were optional fields on the
 * meta, which meant `toPendingRecord` accepted them and silently ignored them -- it hard-codes
 * `pending`, so a caller who passed provenance to it was passing it into nothing. Worse, a caller
 * could reach `toStoredRecord` without them and get back a `complete` game whose `analysis` was
 * null: a record the wire schema then refused, at the boundary, at runtime, far from the mistake.
 *
 * REQUIRED AND NON-NULLABLE, so that "a scored game says what scored it and when" is a thing the
 * compiler enforces rather than a thing the schema discovers.
 */
export interface ScoredBlitzRecordMeta extends BlitzRecordMeta {
  analysis: BlitzAnalysisProvenance;
  analysedAt: string;
}

/**
 * THE RECORD AS IT EXISTS BEFORE THE ENGINE HAS SPOKEN, and the reason this function exists.
 *
 * `Blitz.tsx` used to analyse the finished game and only then write it, so a player who closed the
 * tab during analysis lost the whole game -- the moves, the clocks, and the think times, which
 * nothing can reconstruct from anything else. The record is now written HERE, first, and the
 * analysis is attached to it afterwards.
 *
 * A TWO-WAY JOIN, WITH THE SAME REFUSAL DISCIPLINE AS THE THREE-WAY ONE. The engine is simply not
 * one of the sources yet; the core and the instrument still have to agree on every ply and every
 * move, because a best-effort join is a dataset where a confidence belongs to one move and a
 * cp-loss to another, and nothing downstream could detect it.
 */
export function toPendingRecord(
  game: FinishedGame,
  instrumented: readonly InstrumentedDecision[],
  meta: BlitzRecordMeta,
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
  if (core.length === 0) return { refused: "no-decisions" };
  if (core.length !== instrumented.length) {
    return {
      refused: "counts-disagree",
      core: core.length,
      instrument: instrumented.length,
      analysis: core.length,
    };
  }

  const decisions: StoredBlitzDecision[] = [];
  for (let i = 0; i < core.length; i += 1) {
    const c = core[i];
    const inst = instrumented[i];
    /*
     * MATCHED ON PLY AND ON THE MOVE ITSELF, not on position in the array. Equal lengths are not
     * the same fact as the same decisions: a dropped row and a duplicated one leave the count
     * intact and shift everything after them by one, which is exactly the corruption that would be
     * invisible in the finished dataset.
     */
    if (c.ply !== inst.decision.ply) return { refused: "plies-disagree", at: i };
    if (c.san !== inst.decision.san) {
      return { refused: "moves-disagree", at: i, core: c.san, analysis: inst.decision.san };
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
      /*
       * WRITTEN WHENEVER A CONFIDENCE WAS, AND NULL WHENEVER ONE WAS NOT. A scale on a row with no
       * confidence would describe an instrument nobody used; a confidence with no scale is the
       * defect this pair closes. The two are written together or not at all.
       */
      confidenceScale: inst.confidence === null ? null : CONFIDENCE_LEVELS,
      confidenceGridVersion: inst.confidence === null ? null : CONFIDENCE_GRID_VERSION,
      instrumentationLatencyMs: inst.instrumentationLatencyMs,
      /* Null BECAUSE nothing has run. `analysisState: "pending"` is what says so. */
      cpLoss: null,
      standingCp: null,
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
      analysisState: "pending",
      analysedAt: null,
      analysis: null,
      opponent: meta.opponent ?? null,
    },
    decisions,
  };
}

/**
 * Attach the engine's verdict to a record that is already stored, or refuse.
 *
 * THE SAME JOIN RULE, RUN LATE. Ply and move must agree with what was stored, for the reason the
 * two-way join gives: a shifted array leaves the counts intact and moves every cp-loss one row from
 * the decision it belongs to.
 *
 * A REFUSAL LEAVES THE RECORD `pending`, WHICH IS THE HONEST OUTCOME. The game is not lost -- it is
 * stored, complete, and unscored, and it says so. That is strictly better than the state this
 * replaces, where a refusal meant the game was never written at all.
 */
export function attachAnalysis(
  record: StoredBlitzRecord,
  analysed: readonly AnalysedDecision[],
  playedAs: Side,
  provenance: BlitzAnalysisProvenance,
  analysedAt: string,
): StoredBlitzRecord | JoinRefusal {
  const mine = analysed.filter((d) => d.side === playedAs);
  if (mine.length !== record.decisions.length) {
    return {
      refused: "counts-disagree",
      core: record.decisions.length,
      instrument: record.decisions.length,
      analysis: mine.length,
    };
  }
  const decisions: StoredBlitzDecision[] = [];
  for (let i = 0; i < mine.length; i += 1) {
    const stored = record.decisions[i];
    const an = mine[i];
    if (stored.ply !== an.ply) return { refused: "plies-disagree", at: i };
    if (stored.san !== an.san) {
      return { refused: "moves-disagree", at: i, core: stored.san, analysis: an.san };
    }
    /* Null HERE means the evaluator could not answer -- a different fact from `pending`. */
    decisions.push({ ...stored, cpLoss: an.cpLoss, standingCp: an.standingCp });
  }
  return {
    game: {
      ...record.game,
      analysisState: "complete",
      /*
       * NO `?? new Date()` FALLBACK, and it was there in the first draft. A caller who does not
       * know when the engine finished would have had "now" invented for them -- a timestamp that
       * looks measured, reads as measured, and is the moment the join ran. The parameter is
       * required instead, so there is nothing to fall back from.
       */
      analysedAt,
      analysis: provenance,
    },
    decisions,
  };
}

/**
 * WHAT A BLITZ ROW WITH NO SCALE WAS STATED ON, and why the answer is 7 rather than 5.
 *
 * `LEGACY_CONFIDENCE_LEVELS` is 5, because the `decisions` table predates the seven-level scale.
 * The blitz route does not: it has rendered `[1..7]` since its first commit and has never shipped
 * any other scale, so a blitz row without a scale was stated on seven levels of grid version 1.
 *
 * TWO LEGACY CONSTANTS FOR ONE PRODUCT IS NOT A SMELL, IT IS THE FACT. The two tables have
 * different histories, and one constant covering both would have to be wrong for one of them --
 * silently, in the direction nobody checks. `confidence.ts` makes the same argument for keeping
 * the scale and the grid version separate; this is that argument one table further out.
 *
 * ABSENCE DATES THE ROW. That is the whole justification, and it stops holding the moment a second
 * blitz scale ships -- at which point this constant does not change, because the rows it describes
 * do not. What changes is that new rows carry their own, which they already do.
 */
export const LEGACY_BLITZ_CONFIDENCE_SCALE = 7;
export const LEGACY_BLITZ_CONFIDENCE_GRID_VERSION = 1;

/**
 * WHAT ONE STORED BLITZ DECISION SAID, AS A PROBABILITY -- or why it cannot be read.
 *
 * THE ONE PLACE THE LEGACY ALLOWANCE LIVES. `storedBlitzRecordSchema` refuses a fresh row that
 * omits its scale, so nothing arriving over the wire reaches the fallback below; it exists for
 * rows already in the table and for nothing else. A second reader applying its own default is how
 * "written before the column existed" turns into "stated on today's grid".
 *
 * RETURNS A REASON RATHER THAN NULL. "Nobody was asked" and "somebody answered on a grid this
 * build cannot read" are different facts about a record and a denominator that cannot tell them
 * apart cannot say what it left out.
 */
export type BlitzConfidenceReading =
  | { read: number; scale: number; gridVersion: number; dated: boolean }
  | { unreadable: "not-asked" | "unknown-grid" };

export function blitzConfidenceOf(
  decision: Pick<StoredBlitzDecision, "confidence" | "confidenceScale" | "confidenceGridVersion">,
  /** Injected so this module does not import the grid, and so a test can pin an old one. */
  normalise: (level: number, levels: number, gridVersion: number) => number,
): BlitzConfidenceReading {
  if (decision.confidence === null) return { unreadable: "not-asked" };
  /*
   * `dated` IS TRUE EXACTLY WHEN THE FALLBACK WAS USED, and it is returned rather than logged so a
   * reading can report how much of its denominator rests on an inference about age rather than on
   * something the row says. A count of those is a debt that pays itself down as the old rows age
   * out; without the flag it is invisible and permanent.
   */
  const dated = decision.confidenceScale === null || decision.confidenceGridVersion === null;
  const scale = decision.confidenceScale ?? LEGACY_BLITZ_CONFIDENCE_SCALE;
  const gridVersion = decision.confidenceGridVersion ?? LEGACY_BLITZ_CONFIDENCE_GRID_VERSION;
  try {
    return { read: normalise(decision.confidence, scale, gridVersion), scale, gridVersion, dated };
  } catch {
    /*
     * A ROW FROM A NEWER BUILD, IN A STORE AN OLDER BUILD IS READING. `normaliseConfidence` throws
     * rather than falling back, which is correct, and the correct thing to do with the throw is to
     * report the row as unreadable -- not to drop it, and certainly not to re-read it on a grid its
     * author never saw.
     */
    return { unreadable: "unknown-grid" };
  }
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
  confidenceScale: z.number().int().positive().nullable(),
  confidenceGridVersion: z.number().int().positive().nullable(),
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
      analysisState: z.enum(BLITZ_ANALYSIS_STATES),
      analysedAt: z.string().min(1).nullable(),
      analysis: z
        .object({
          engine: z.string().min(1).max(64),
          build: z.string().min(1).max(64),
          depth: z.number().int().positive(),
        })
        .nullable(),
      opponent: z
        .object({
          kind: z.string().min(1).max(32),
          engine: z.string().min(1).max(64),
          build: z.string().min(1).max(64),
          depth: z.number().int().nonnegative(),
        })
        .nullable(),
    }),
    decisions: z.array(storedBlitzDecisionSchema).min(1),
  })
  .refine((r) => r.decisions.every((d) => d.gameId === r.game.gameId), {
    message: "a decision names a different game than the one it arrived with",
  })
  .refine((r) => r.game.analysisState !== "complete" || r.game.analysis !== null, {
    message: "a scored game must say which engine scored it",
  })
  .refine((r) => r.game.analysisState !== "complete" || r.game.analysedAt !== null, {
    message: "a scored game must say when it was scored",
  })
  .refine(
    (r) => r.game.analysisState !== "pending" || r.decisions.every((d) => d.cpLoss === null),
    { message: "an unscored game carries a cp-loss, so one of the two is wrong" },
  )
  .refine((r) => new Set(r.decisions.map((d) => d.ply)).size === r.decisions.length, {
    message: "two decisions claim the same ply",
  })
  /*
   * A STATED CONFIDENCE MUST SAY WHAT IT WAS STATED ON, AT THE BOUNDARY.
   *
   * The legacy allowance is for rows already in the table, which this schema never sees: nothing
   * crossing this wire predates the columns. So the check is unconditional here and the leniency
   * lives exactly one place -- `blitzConfidenceOf`, which reads what is already stored.
   */
  .refine(
    (r) =>
      r.decisions.every(
        (d) =>
          d.confidence === null ||
          (d.confidenceScale !== null && d.confidenceGridVersion !== null),
      ),
    { message: "a stated confidence must carry the scale and grid version it was stated on" },
  )
  .refine(
    (r) =>
      r.decisions.every(
        (d) => d.confidence !== null || (d.confidenceScale === null && d.confidenceGridVersion === null),
      ),
    { message: "a decision with no confidence names a scale nobody used" },
  );
