/**
 * What imported games can say, and the one thing they cannot.
 *
 * A player arrives with hundreds of decisions already made, in games they already played. Those
 * decisions carry everything the six buckets need -- phase, time-to-decide, clock -- except the
 * field this product exists to measure: the confidence they stated before the engine spoke.
 *
 * So the diagnostic screen and the record screen are the same table, and the record screen's
 * column is the one that is empty. That empty column is the argument, stated as an observation.
 *
 * HARD RULES, and they are the reason this module is separate from the record:
 *
 *   - It must not compute a gap. There is no confidence in this data. No field here is named
 *     `gap` or `confidence`, and a caller that wants one has to go through the record.
 *   - `accurateRate` uses the DETECTOR's definition -- share of the player's moves under
 *     ACCURATE_CP_LOSS -- never the exponential score from eval-analysis.ts. See
 *     docs/MEASUREMENTS.md for why one of the two is canonical.
 *   - Every reading carries its n (GATE-DENOM), and a bucket that cannot be read says which kind
 *     of cannot it is.
 *
 * The buckets come from BUCKETINGS, not from a list of this module's own. A second list would
 * drift, and then two screens in one product would disagree about what "under 45 seconds" means.
 */
import { ACCURATE_CP_LOSS, BUCKETINGS, MIN_BUCKET_N, type BucketableDecision } from "./detector.js";
import { classifyPhase } from "./phase.js";
import { clockMsRemainingAt, hasClockData, secondsSpentAt, parseTimeControl } from "./pgn-clock.js";

/** One of the player's past moves, reduced to what a bucket may look at, plus whether it held. */
export interface ImportedDecision extends BucketableDecision {
  ply: number;
  /** Centipawns lost against the engine's line, from the mover's side. Never negative. */
  cpLoss: number;
  accurate: boolean;
}

export interface ImportedBucketReading {
  /** From BUCKETINGS. */
  key: string;
  /** From BUCKETINGS. */
  scope: string;
  /** The player's decisions in this bucket. */
  n: number;
  /** Null when n < MIN_BUCKET_N: a rate over six moves is noise wearing a percentage sign. */
  accurateRate: number | null;
  measurable: boolean;
  /**
   * Why not, when not.
   *
   * "too-few" is a wait: play or import more and it fills. "no-clock-data" is not a wait -- the
   * source cannot produce the field at all, so the bucket can never fill from this import, and
   * telling that player to import more games is advice that cannot work.
   */
  unmeasurableReason: "too-few" | "no-clock-data" | null;
}

export interface ImportDiagnostic {
  buckets: ImportedBucketReading[];
  /** Player moves that could be scored at all. The denominator behind the whole table. */
  scored: number;
  /** True when no imported PGN carried a single clock annotation. */
  missingClockData: boolean;
}

export interface ImportedGameInput {
  /** One FEN per ply as `gamePositions()` produces them: index 0 is the starting position. */
  fens: string[];
  /** Centipawns from WHITE's perspective, one per position, as `analyzePositions` returns. */
  evalScores: number[];
  /** Remaining seconds after each ply, from `[%clk]`. Empty when the PGN carried none. */
  clockTimes: number[];
  /** The `[TimeControl]` header verbatim, or undefined. */
  timeControl?: string;
  playerColor: "w" | "b";
}

/**
 * Centipawn loss for the side that just moved at `ply`.
 *
 * `evalScores` is White-relative throughout, so the sign flips with the mover: White wants the
 * number to go up, Black wants it down. Same convention as shared/eval-analysis.ts.
 */
function cpLossAt(evalScores: number[], ply: number): number | null {
  const before = evalScores[ply - 1];
  const after = evalScores[ply];
  if (before === undefined || after === undefined) return null;
  const isWhiteMove = ply % 2 === 1;
  return Math.max(0, isWhiteMove ? before - after : after - before);
}

/** The player's own decisions in one imported game, reduced to what a bucket may see. */
export function decisionsFromGame(game: ImportedGameInput): ImportedDecision[] {
  const increment = parseTimeControl(game.timeControl)?.incrementSeconds ?? 0;
  const clocks = hasClockData(game.clockTimes);
  const out: ImportedDecision[] = [];

  for (let ply = 1; ply < game.fens.length; ply++) {
    // Ply 1 is White's first move; odd plies are White's throughout.
    const isWhiteMove = ply % 2 === 1;
    if (isWhiteMove !== (game.playerColor === "w")) continue;

    const cpLoss = cpLossAt(game.evalScores, ply);
    const fen = game.fens[ply];
    if (cpLoss === null || fen === undefined) continue;

    /*
     * secondsTaken is 0 when there are no clocks, and that is not a measurement -- it is the
     * absence of one. It cannot be null because BucketableDecision types it as a number, so the
     * time buckets are instead reported unmeasurable for the whole import below. A zero here
     * would quietly land every decision in "under 45 seconds".
     */
    const seconds = clocks ? secondsSpentAt(game.clockTimes, ply, increment) : null;

    out.push({
      ply,
      phase: classifyPhase(fen, ply),
      secondsTaken: seconds ?? 0,
      clockMsRemaining: clocks ? clockMsRemainingAt(game.clockTimes, ply) : null,
      cpLoss,
      accurate: cpLoss <= ACCURATE_CP_LOSS,
    });
  }
  return out;
}

/**
 * The reading. Every bucket is reported, including the ones that cannot be read.
 *
 * A screen that omits what it could not measure looks like a screen that measured everything.
 */
export function diagnoseImportedGames(games: ImportedGameInput[]): ImportDiagnostic {
  const anyClock = games.some((g) => hasClockData(g.clockTimes));
  const decisions = games.flatMap(decisionsFromGame);

  const buckets: ImportedBucketReading[] = BUCKETINGS.map((bucketing) => {
    /*
     * A time-derived bucket is not merely empty without clocks -- it is unfillable, and its
     * predicate would be reading a zero this module invented. Report no n for it rather than a
     * count of decisions that were never really placed there.
     */
    const timeDerived = bucketing.requiresClock === true || usesTime(bucketing.key);
    const unfillable = timeDerived && !anyClock;
    const inside = unfillable ? [] : decisions.filter(bucketing.predicate);
    const measurable = !unfillable && inside.length >= MIN_BUCKET_N;

    return {
      key: bucketing.key,
      scope: bucketing.scope,
      n: inside.length,
      accurateRate: measurable ? inside.filter((d) => d.accurate).length / inside.length : null,
      measurable,
      unmeasurableReason: measurable ? null : unfillable ? "no-clock-data" : "too-few",
    };
  });

  return { buckets, scored: decisions.length, missingClockData: !anyClock };
}

/**
 * Which buckets read a time field.
 *
 * `requiresClock` marks the one that needs the clock REMAINING. Two more read secondsTaken, which
 * is equally underivable without `[%clk]`, and they are named here rather than inferred so that
 * adding a seventh bucket forces a decision instead of silently defaulting.
 */
function usesTime(key: string): boolean {
  return key === "fast-under-45s" || key === "slow-over-2m";
}

/**
 * The worst measurable bucket, or null when none can be read.
 *
 * "Worst" is lowest accuracy. Null is a real answer and the screen must render it as one: with
 * no measurable bucket there is no observation to make, and inventing one from an unmeasurable
 * bucket is exactly the failure this whole module is shaped to avoid.
 */
export function worstMeasurableBucket(
  diagnostic: ImportDiagnostic,
): ImportedBucketReading | null {
  const measurable = diagnostic.buckets.filter(
    (b): b is ImportedBucketReading & { accurateRate: number } =>
      b.measurable && b.accurateRate !== null,
  );
  if (!measurable.length) return null;
  return measurable.reduce((worst, b) => (b.accurateRate < worst.accurateRate ? b : worst));
}
