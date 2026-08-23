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
 * The six shared BUCKETINGS come from detector.ts, not from a list of this module's own. A second
 * definition of "under 45 seconds" would drift, and then two screens in one product would
 * disagree about the same words.
 *
 * There IS a second list here, IMPORT_BUCKETINGS, and it is not a redefinition of anything. It
 * splits on a field the live record structurally cannot have: the engine's evaluation of the
 * position BEFORE the decision. R3 forbids the engine speaking before a decision is recorded, so
 * a live decision has no such number at the moment it is made. An imported game is already over,
 * and the whole eval curve is sitting in the array this module is handed.
 *
 * Those buckets are import-only and DELIBERATELY cannot produce a claim -- claims come from the
 * detector running over the record, and nothing here reaches it.
 */
import { ACCURATE_CP_LOSS, BUCKETINGS, MIN_BUCKET_N, type BucketableDecision } from "./detector.js";
import { classifyPhase } from "./phase.js";
import { clockMsRemainingAt, hasClockData, secondsSpentAt, parseTimeControl } from "./pgn-clock.js";

/** One of the player's past moves, reduced to what a bucket may look at, plus whether it held. */
/**
 * Where the player stood when they decided, from THEIR side of the board.
 *
 * A pawn is the boundary in both directions. It is the unit the game itself is denominated in,
 * not a threshold invented here: under a pawn the position is not clearly anyone's, and calling
 * it "winning" would be naming evaluation noise a state.
 */
export type Standing = "winning" | "level" | "losing";

/** One pawn, in centipawns. The line between an edge and a position that is merely uneven. */
export const CLEAR_EDGE_CP = 100;

export function standingFrom(evalBeforeCp: number): Standing {
  if (evalBeforeCp >= CLEAR_EDGE_CP) return "winning";
  if (evalBeforeCp <= -CLEAR_EDGE_CP) return "losing";
  return "level";
}

export interface ImportedDecision extends BucketableDecision {
  ply: number;
  /** Centipawns lost against the engine's line, from the mover's side. Never negative. */
  cpLoss: number;
  accurate: boolean;
  /**
   * The engine's verdict on the position the player FACED, from the player's side.
   *
   * Free: it is `evalScores[ply - 1]`, already in the array this module is handed. Nothing extra
   * is searched for it. The live record has no equivalent, and cannot -- see the module note.
   */
  standing: Standing;
  /** Lichess's time class for the game this came from: bullet, blitz, rapid, classical. */
  speed: string | null;
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
  /**
   * The time class the clock-derived buckets were restricted to, or null when the import carried
   * no speed at all.
   *
   * WHY THE RESTRICTION EXISTS. "Under 45 seconds" is not one thing across time classes: in a
   * 3+0 game it is most of the game, in a 30+0 game it is a move played without thinking. An
   * import mixing blitz and rapid puts both in the same bucket and reports the average of two
   * different questions. The dominant class is used rather than blanket silence because the
   * point of the bucket is to have an n, and splitting six ways empties every cell.
   */
  timeBucketSpeed: string | null;
  /** Decisions left out of the clock-derived buckets for coming from another time class. */
  excludedForSpeed: number;
  /** Every time class in the import, with its decision count. Largest first. */
  speedMix: Array<{ speed: string; n: number }>;
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
  /** Lichess's time class: bullet, blitz, rapid, classical. Undefined for a PGN with no source. */
  speed?: string;
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

    /*
     * The evaluation of the position the player faced, flipped to their side. evalScores is
     * White-relative throughout, so Black's +200 is a two-pawn deficit and must not be read as
     * an edge -- the same sign convention, and the same trap, as cpLossAt above.
     */
    const evalBefore = game.evalScores[ply - 1];
    const facing = isWhiteMove ? evalBefore : -evalBefore;

    out.push({
      ply,
      phase: classifyPhase(fen, ply),
      secondsTaken: seconds ?? 0,
      clockMsRemaining: clocks ? clockMsRemainingAt(game.clockTimes, ply) : null,
      cpLoss,
      accurate: cpLoss <= ACCURATE_CP_LOSS,
      standing: standingFrom(facing),
      speed: game.speed ?? null,
    });
  }
  return out;
}

/**
 * Buckets that split on the POSITION rather than on how the player decided.
 *
 * Import-only, for the reason given at the top of this file: they read the engine's verdict on
 * the position before the move, which a live decision cannot have without breaking R3.
 *
 * They are here because they ask a different question from the six. The shared buckets ask when
 * the player decides badly -- fast, late, short of clock. These ask what the board looked like
 * when they did. "Accurate when level, inaccurate when winning" is a finding about a decision
 * policy, and nothing in the six could ever surface it.
 *
 * Three, not more. The n has to go somewhere, and every split empties the cells.
 */
export const IMPORT_BUCKETINGS: Array<{
  key: string;
  scope: string;
  standing: Standing;
}> = [
  { key: "standing-winning", scope: "החלטות מתוך עמדה מנצחת", standing: "winning" },
  { key: "standing-level", scope: "החלטות מתוך עמדה שקולה", standing: "level" },
  { key: "standing-losing", scope: "החלטות מתוך עמדה מפסידה", standing: "losing" },
];

/** The time class most of the player's decisions came from, or null when none is recorded. */
function dominantSpeed(decisions: ImportedDecision[]): {
  speed: string | null;
  mix: Array<{ speed: string; n: number }>;
} {
  const counts = new Map<string, number>();
  for (const d of decisions) {
    if (d.speed) counts.set(d.speed, (counts.get(d.speed) ?? 0) + 1);
  }
  const mix = [...counts.entries()]
    .map(([speed, n]) => ({ speed, n }))
    .sort((a, b) => b.n - a.n);
  return { speed: mix[0]?.speed ?? null, mix };
}

/**
 * The reading. Every bucket is reported, including the ones that cannot be read.
 *
 * A screen that omits what it could not measure looks like a screen that measured everything.
 */
export function diagnoseImportedGames(games: ImportedGameInput[]): ImportDiagnostic {
  const anyClock = games.some((g) => hasClockData(g.clockTimes));
  const decisions = games.flatMap(decisionsFromGame);
  const { speed: timeBucketSpeed, mix: speedMix } = dominantSpeed(decisions);

  /*
   * The clock-derived buckets read only the dominant time class. Everything else -- the phase
   * buckets, the standing buckets -- reads every game, because neither phase nor the engine's
   * verdict on a position means anything different in blitz than in rapid.
   */
  const sameSpeed = (d: ImportedDecision) => timeBucketSpeed === null || d.speed === timeBucketSpeed;
  const excludedForSpeed = decisions.filter((d) => !sameSpeed(d)).length;

  const buckets: ImportedBucketReading[] = BUCKETINGS.map((bucketing) => {
    /*
     * A time-derived bucket is not merely empty without clocks -- it is unfillable, and its
     * predicate would be reading a zero this module invented. Report no n for it rather than a
     * count of decisions that were never really placed there.
     */
    const timeDerived = bucketing.requiresClock === true || usesTime(bucketing.key);
    const unfillable = timeDerived && !anyClock;
    const pool = timeDerived ? decisions.filter(sameSpeed) : decisions;
    const inside = unfillable ? [] : pool.filter(bucketing.predicate);
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

  /* The position buckets. Appended after the six so the shared table keeps its order. */
  for (const bucketing of IMPORT_BUCKETINGS) {
    const inside = decisions.filter((d) => d.standing === bucketing.standing);
    const measurable = inside.length >= MIN_BUCKET_N;
    buckets.push({
      key: bucketing.key,
      scope: bucketing.scope,
      n: inside.length,
      accurateRate: measurable ? inside.filter((d) => d.accurate).length / inside.length : null,
      measurable,
      unmeasurableReason: measurable ? null : "too-few",
    });
  }

  return {
    buckets,
    scored: decisions.length,
    missingClockData: !anyClock,
    timeBucketSpeed,
    excludedForSpeed,
    speedMix,
  };
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
  const readable = measurableBuckets(diagnostic);
  if (!readable.length) return null;
  return readable.reduce((worst, b) => (b.accurateRate < worst.accurateRate ? b : worst));
}

/**
 * A bucket that actually has a rate.
 *
 * Named and exported so a caller does not have to assert it. The screen renders `accurateRate`
 * into a component that requires a number, and a `!` there would be the component promising
 * something the type did not -- exactly the shape of claim this module exists to prevent.
 */
export type ReadableBucket = ImportedBucketReading & { accurateRate: number };

function measurableBuckets(diagnostic: ImportDiagnostic): ReadableBucket[] {
  return diagnostic.buckets.filter(
    (b): b is ReadableBucket => b.measurable && b.accurateRate !== null,
  );
}

interface VerdictFigures {
  worst: ReadableBucket;
  /** How far apart the two lowest are, as a difference of rates. Zero with no runner-up. */
  separation: number;
  /** Two standard errors of that difference. */
  threshold: number;
}

/**
 * A union rather than a boolean field, so that `separable` carries the runner-up with it.
 *
 * The screen's sentence names both buckets -- "lowest here, against this next to it" -- and a
 * nullable runnerUp beside a boolean would leave the component asserting the connection between
 * them with a `!`. There is no `!` to write if the type says it.
 *
 * When `separable` is false the screen must NOT name a weakest bucket. Six rates of 62, 61, 63,
 * 62, 61 and 62 have a minimum, and naming it is naming the noise. That is a different state
 * from "not enough decisions" and has to read differently.
 */
export type WorstBucketVerdict =
  | (VerdictFigures & { separable: true; runnerUp: ReadableBucket })
  | (VerdictFigures & { separable: false; runnerUp: ReadableBucket | null });

/**
 * Whether the worst bucket is distinguishable from the next-worst, or merely the lowest number.
 *
 * MIN_BUCKET_N makes each rate readable on its own. It says nothing about whether two readable
 * rates differ, and "your weakest area" is a claim about a difference, not about a rate.
 *
 * The test is the ordinary one for two proportions: the standard error of a difference is
 *
 *     sqrt( p1(1-p1)/n1 + p2(1-p2)/n2 )
 *
 * and the separation has to clear two of them. Two rather than one because one is a coin flip
 * dressed as a finding; this is the same reasoning that put MIN_BUCKET_N at 30 rather than at
 * whatever number made the screen fill up soonest.
 *
 * At n = 30 in both buckets and rates near 60%, that threshold is roughly 25 percentage points --
 * deliberately hard to clear. A bucket that clears it is a real difference in the player's games.
 * A bucket that does not is a screen that should say nothing, and the caller must let it.
 */
export function worstBucketVerdict(diagnostic: ImportDiagnostic): WorstBucketVerdict | null {
  const readable = measurableBuckets(diagnostic);
  if (!readable.length) return null;

  const sorted = [...readable].sort((a, b) => a.accurateRate - b.accurateRate);
  const worst = sorted[0];
  const runnerUp = sorted[1] ?? null;

  if (!runnerUp) {
    /*
     * One readable bucket is a rate, not a comparison. There is nothing for it to be worse than,
     * so it cannot be called the worst -- and the screen has to say the rate without the word.
     */
    return { worst, runnerUp: null, separation: 0, threshold: 0, separable: false };
  }

  const variance = (p: number, n: number) => (p * (1 - p)) / n;
  const threshold =
    2 * Math.sqrt(variance(worst.accurateRate, worst.n) + variance(runnerUp.accurateRate, runnerUp.n));
  const separation = runnerUp.accurateRate - worst.accurateRate;

  return separation > threshold
    ? { worst, runnerUp, separation, threshold, separable: true }
    : { worst, runnerUp, separation, threshold, separable: false };
}
