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
import {
  accurateDecision,
  bucketable,
  BUCKETINGS,
  MIN_BUCKET_N,
  type BucketableDecision,
} from "./detector.js";
import { Chess } from "chess.js";
import { classifyPhase } from "./phase.js";
import { NO_BOOK, type BookLookup } from "./opening-book.js";
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
  /**
   * The position offered exactly one legal move, so the player chose nothing.
   *
   * Scored as accurate by every rule in this file -- cpLoss on a move with no alternative is
   * whatever the engine's line was -- and counting it inflates the rate with something the
   * player did not do. Excluded from every bucket, and counted so the exclusion is visible.
   *
   * THE LIMIT OF THIS, stated because the number it fixes is still wrong: it removes a handful
   * of moves a game. It does NOT touch opening book or the recaptures that are forced in every
   * sense except the legal one, which are the bulk of the inflation. See docs/MEASUREMENTS.md.
   */
  forced: boolean;
  /**
   * The position is one the reference corpus says players arrive at prepared.
   *
   * A SEPARATE EXCLUSION FROM `forced`, and a much larger one. `forced` removes a handful of moves
   * a game; book is most of what this repository's ledger calls the inflation -- `phase-opening` is
   * `ply <= 20`, mostly theory, so it measures recall rather than decisions.
   *
   * It is a fact about the POSITION, never about the move: a player who leaves theory here has
   * made a decision rather than avoided one, and conditioning on what they played would condition
   * on the outcome. False when no book was loaded, which the counters report so a rate is never
   * read as corrected when nothing corrected it.
   */
  book: boolean;
}

/**
 * Did the player have a choice at all?
 *
 * chess.js rather than the engine: legality is a fact about the position and needs no search.
 * It is the only part of "was this a decision" that can be answered for free.
 */
function onlyLegalMove(fenBefore: string): boolean {
  try {
    return new Chess(fenBefore).moves().length === 1;
  } catch {
    // A FEN chess.js will not load cannot be shown to have been forced, so it is not claimed to be.
    return false;
  }
}

/**
 * Can the position be read at all?
 *
 * `forced` above can answer "not shown to be" for a FEN chess.js rejects, because `false` is a
 * truthful reading of a position nobody could inspect. `phase` has no such value -- Phase is
 * three cases and every one of them is a claim -- and since cycle 48 the phase is read off this
 * same position. So an unreadable before-position stops being a decision with a hole in it and
 * becomes no decision at all, which is the rule the rest of this loop already follows.
 */
function loadable(fen: string): boolean {
  try {
    new Chess(fen);
    return true;
  } catch {
    return false;
  }
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
  /** Player moves that could be scored at all, forced ones included. */
  scored: number;
  /**
   * What is left after every exclusion below -- the denominator the buckets are actually drawn
   * from.
   *
   * Reported as a field rather than left to the reader's subtraction: `scored` is the number a
   * screen reaches for when it wants to sound like it measured a lot, and it is not the number
   * any rate on that screen was computed over.
   */
  eligible: number;
  /**
   * Of the scored moves, how many were in a book position and not already forced.
   *
   * Counted separately from `forced` because the two exclusions are different sizes and a reader
   * comparing this run with an older one needs to see which of them moved. Zero when no book was
   * loaded, which is not the same as "no book positions" and is why the panel says which.
   */
  book: number;
  /** True when a book was supplied at all. A run without one excludes nothing and must say so. */
  bookLoaded: boolean;
  /**
   * Of the eligible decisions, how many carry no derivable think time, and no derivable clock.
   *
   * These are not zeroes and they are not slow decisions. They are absences, and both time
   * buckets and the clock bucket exclude them from the bucket AND from the rest of the record it
   * is compared against.
   */
  withoutTime: number;
  withoutClock: number;
  /**
   * Of those, how many offered exactly one legal move.
   *
   * Reported rather than quietly netted off, because excluding them lowers every n and a
   * reader with no explanation takes a smaller n for "not enough games yet".
   */
  forced: number;
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

/**
 * A reading as KEPT, which is not the same object as a reading as computed.
 *
 * The diagnostic used to live in a `useState` inside the import overlay: closing it discarded the
 * whole thing, and the only way back was to re-run the scan -- 971 positions and 43 seconds on the
 * one machine it was measured on. The most expensive artefact this app produces was the one it
 * did not keep.
 *
 * WHY THE EXTRA FIELDS. A diagnostic on its own is a set of rates with no origin. Shown at the
 * moment of the scan the origin is obvious and the object can get away with omitting it; shown
 * three days later from storage it is a number with no source, which is exactly what section 4.4
 * forbids. So what is stored is the reading plus the three facts a reader needs to judge it: whose
 * games, how many, and when. `scanned_at` in particular is the difference between "your accuracy"
 * and "your accuracy across 20 games read on 24 August" -- the second is a measurement and the
 * first is a claim about a person.
 *
 * Append-only, like everything else in this record. A second import writes a NEW row; the newest
 * is the one displayed. Nothing edits a reading after the fact, so a rate on screen can always be
 * traced to the scan that produced it.
 */
export interface StoredImportDiagnostic {
  diagnostic: ImportDiagnostic;
  /** The Lichess account the games were read from. Rendered with the reading, never inferred. */
  username: string;
  /** How many games the scan covered. Not the same as `diagnostic.scored`, which counts moves. */
  games: number;
  /** When the scan finished. ISO 8601. */
  scanned_at: string;
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
export function decisionsFromGame(
  game: ImportedGameInput,
  /* Injected rather than imported: the key set is loaded on demand, and shared/ stays free of it. */
  isBook: BookLookup = NO_BOOK,
): ImportedDecision[] {
  const increment = parseTimeControl(game.timeControl)?.incrementSeconds ?? 0;
  const clocks = hasClockData(game.clockTimes);
  const out: ImportedDecision[] = [];

  for (let ply = 1; ply < game.fens.length; ply++) {
    // Ply 1 is White's first move; odd plies are White's throughout.
    const isWhiteMove = ply % 2 === 1;
    if (isWhiteMove !== (game.playerColor === "w")) continue;

    const cpLoss = cpLossAt(game.evalScores, ply);
    const fen = game.fens[ply];
    /*
     * The position as the player found it, which is the one BEFORE their move.
     *
     * Everything about a DECISION is a fact about this position, not about the one the move
     * produced: what the player was facing, whether they had a choice, and -- since cycle 48 --
     * which phase the decision is filed under. `classifyPhase` reads material off the FEN, and a
     * capture changes material, so handing it `fen` answered a different question. Required now
     * rather than optional: a decision whose before-position is missing is skipped, because a
     * wrong bucket is worse than a smaller n.
     */
    const fenBefore = game.fens[ply - 1];
    if (cpLoss === null || fen === undefined || fenBefore === undefined) continue;
    if (!loadable(fenBefore)) continue;

    /*
     * Null where nothing measured it, and null all the way through now that `BucketableDecision`
     * admits one.
     *
     * This used to be written out as `seconds ?? 0`, defended on the grounds that the time buckets
     * are reported unmeasurable for an import with NO clocks at all. That defence covered the
     * whole-import case and missed the per-decision one: `secondsSpentAt` also returns null when
     * the clocks are present but this particular reading is not derivable -- the player's FIRST
     * MOVE has no previous reading of their own clock, and neither does the move after it when the
     * TimeControl header is missing, which is what makes the starting clock NaN.
     *
     * So every imported game with clocks contributed at least one invented "0 seconds" decision,
     * and 0 < 45.
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
      phase: classifyPhase(fenBefore, ply),
      secondsTaken: seconds,
      clockMsRemaining: clocks ? clockMsRemainingAt(game.clockTimes, ply) : null,
      cpLoss,
      /*
       * The record's rule, against the evaluation this position actually stood at.
       *
       * This was `cpLoss <= ACCURATE_CP_LOSS` -- the raw cut `shared/detector.ts` records as
       * abandoned. The header of this file says it uses "the DETECTOR's definition", and the
       * detector's definition moved to win-probability loss without this call site following.
       * `facing` is the evaluation before the move and is already in scope, two lines below.
       *
       * It matters here for the same reason it mattered in the transfer: the bucket this screen
       * picks is what `registerHypothesis` pre-registers, so a third definition of דיוק selected
       * the hypothesis that a different definition would go on to grade.
       */
      accurate: accurateDecision(facing, cpLoss),
      standing: standingFrom(facing),
      speed: game.speed ?? null,
      forced: onlyLegalMove(fenBefore),
      book: isBook(fenBefore),
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
export function diagnoseImportedGames(
  games: ImportedGameInput[],
  isBook: BookLookup = NO_BOOK,
): ImportDiagnostic {
  const anyClock = games.some((g) => hasClockData(g.clockTimes));
  const decisions = games.flatMap((game) => decisionsFromGame(game, isBook));
  return diagnosticFromDecisions(decisions, { anyClock, bookLoaded: isBook !== NO_BOOK });
}

/**
 * The reading, from decisions that already exist.
 *
 * Split out of `diagnoseImportedGames` so a null control can run the PRODUCT'S bucket arithmetic
 * over a record it has permuted, rather than a second copy of that arithmetic which could drift
 * from this one. `worstBucketVerdict` ranks nine overlapping buckets and picks the lowest two, and
 * whether that comparison is calibrated is a question about THIS code, so the control has to reach
 * it and not a reimplementation. See tests/fixtures/worst-bucket-scenario.ts.
 */
export function diagnosticFromDecisions(
  decisions: ImportedDecision[],
  source: { anyClock: boolean; bookLoaded: boolean },
): ImportDiagnostic {
  const { anyClock } = source;
  const { speed: timeBucketSpeed, mix: speedMix } = dominantSpeed(decisions);

  /*
   * Every bucket reads only positions where the player actually chose something. A move with one
   * legal reply is scored accurate by the rules in this file, and counting it credits the player
   * for something they did not do; a book position credits them for what everybody plays.
   */
  const chosen = decisions.filter((d) => !d.forced && !d.book);

  /*
   * The clock-derived buckets read only the dominant time class. Everything else -- the phase
   * buckets, the standing buckets -- reads every game, because neither phase nor the engine's
   * verdict on a position means anything different in blitz than in rapid.
   */
  const sameSpeed = (d: ImportedDecision) => timeBucketSpeed === null || d.speed === timeBucketSpeed;
  const excludedForSpeed = chosen.filter((d) => !sameSpeed(d)).length;

  const buckets: ImportedBucketReading[] = BUCKETINGS.map((bucketing) => {
    /*
     * A time-derived bucket is not merely empty without clocks -- it is unfillable, and its
     * predicate would be reading a zero this module invented. Report no n for it rather than a
     * count of decisions that were never really placed there.
     */
    const timeDerived = bucketing.requiresClock === true || bucketing.requiresTime === true;
    const unfillable = timeDerived && !anyClock;
    const pool = (timeDerived ? chosen.filter(sameSpeed) : chosen).filter((d) =>
      bucketable(bucketing, d),
    );
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
    const inside = chosen.filter((d) => d.standing === bucketing.standing);
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
    /*
     * Counted directly, not as `decisions.length - chosen.length`. That subtraction was correct
     * while forced positions were the only exclusion; the moment book joined them it silently
     * became "excluded for any reason", so the ledger on screen stopped adding up and the two
     * exclusions could not be told apart.
     */
    forced: decisions.filter((d) => d.forced).length,
    eligible: chosen.length,
    book: decisions.filter((d) => d.book && !d.forced).length,
    bookLoaded: source.bookLoaded,
    withoutTime: chosen.filter((d) => d.secondsTaken === null).length,
    withoutClock: chosen.filter((d) => d.clockMsRemaining === null).length,
    missingClockData: !anyClock,
    timeBucketSpeed,
    excludedForSpeed,
    speedMix,
  };
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
export function worstBucketVerdict(
  diagnostic: ImportDiagnostic,
  /**
   * How many standard errors the separation must clear. Two by default, which is the bar this
   * screen has always applied.
   *
   * A parameter only so a null control can run the SAME code at a bar that is known to be too
   * permissive, and show that the control is capable of going red. Nothing in the product passes
   * anything but the default -- a test asserts that.
   */
  standardErrors = 2,
): WorstBucketVerdict | null {
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
    standardErrors *
    Math.sqrt(variance(worst.accurateRate, worst.n) + variance(runnerUp.accurateRate, runnerUp.n));
  const separation = runnerUp.accurateRate - worst.accurateRate;

  return separation > threshold
    ? { worst, runnerUp, separation, threshold, separable: true }
    : { worst, runnerUp, separation, threshold, separable: false };
}

/**
 * How many times this import's size the reading would need for its own gap to clear its own bar.
 *
 * WHY A SCREEN NEEDS THIS. "The buckets are not distinguishable" is a true sentence and an opaque
 * one: it does not say whether the player is one game short or a hundred, and a reader with no
 * number fills the gap with the least flattering guess. The threshold falls as 1/sqrt(n), so
 * scaling every bucket by k scales the bar by 1/sqrt(k), and the factor that would close the gap is
 * `(threshold / separation)^2`.
 *
 * THE ASSUMPTION, WHICH IS LOAD-BEARING AND MUST BE SAID WHEREVER THIS IS PRINTED: it holds only if
 * the rates stay where they are. They are estimates from exactly the sample that is too small, so
 * this is the size at which a gap THIS BIG would become readable -- not a prediction that the gap
 * will still be there. A separation of zero has no such size and returns null rather than Infinity.
 */
export function resolutionFactor(reading: { separation: number; threshold: number }): number | null {
  if (reading.separation <= 0 || reading.threshold <= 0) return null;
  return (reading.threshold / reading.separation) ** 2;
}

/**
 * Above this the factor stops being a number a person can act on and becomes a way of saying no.
 *
 * Printing "you would need 300 times as many games" invites the reader to average it down to
 * something imaginable. The screen says the honest thing instead: more than an import can supply.
 */
export const RESOLUTION_FACTOR_CEILING = 50;
