/**
 * The confidence scale, and the whole of it.
 *
 * WHY THIS IS ITS OWN MODULE. The scale is three things that must never drift apart: how many
 * levels there are, what probability each level asserts, and what word sits under it. A level
 * whose number moved but whose word stayed put is a player saying something they did not mean,
 * and it would be invisible in every test that only ever reads the number. So they live in one
 * file and nothing outside it knows the count by heart.
 *
 * WHY SEVEN, AND WHY NOT TOUCHING THE ENDS. MEASURED, not chosen. Erev, Wallsten & Budescu (1994)
 * and Merkle (2009) both prescribe the same control: put a PERFECTLY CALIBRATED player through
 * the instrument's own scale and read what the instrument says about them. Whatever it says is
 * the product's zero point, and anything it prints there is manufactured rather than observed.
 *
 * That player knows its own probability `p` of playing accurately in each position exactly -- zero
 * self-knowledge error, which is the entire quantity this product claims to measure -- and its
 * only constraint is having to answer on these levels. Its expected gap is therefore an integral
 * and not a simulation: E[gap] = E[stated(p)] - E[p], because it is accurate with probability p.
 *
 *     scale                                worst reading   spread across difficulty streams
 *     3 levels     .25 .50 .75                  -12.07pp        14.55pp
 *     5 levels     0 .25 .50 .75 1               -1.50pp         2.98pp     <- what this replaces
 *     5 levels     .10 .30 .50 .70 .90           -2.08pp         3.83pp
 *     7 levels     0 .167 .333 .5 .667 .833 1    -0.99pp         1.67pp
 *     7 levels     .05 .20 .35 .50 .65 .80 .95   -0.35pp         0.60pp     <- this
 *     9 levels     .05 ... .95                   -0.52pp         0.55pp
 *
 * Two findings in that table, and the second is the one that decided the grid. THE COARSENESS IS
 * THE DEFECT, NOT THE ENDPOINTS: dropping 0 and 1 while staying at five levels made it WORSE
 * (3.83 against 2.98), so "the ends are indefensible" on its own is the wrong repair. And nine
 * levels buy nothing over seven, which is where Cox (1980) put the usable band -- 7 plus or minus
 * 2 -- from a completely different direction.
 *
 * The inset is worth 3x on top of the level count, and it is also what makes the ends survivable
 * at all: a stated 0 or 1 gives a logarithmic score of infinity and leaves a Cox slope undefined,
 * so no proper scoring rule can ever be computed over a record that contains one. `.05` and `.95`
 * are not hedges. They are the smallest claim and the largest claim this instrument can hear.
 *
 * WHAT THIS MEASUREMENT DOES NOT COVER, so nobody reads more into it later. It is the quantisation
 * bias in the aggregate gap and nothing else. It says nothing about Juslin's scale-end effect on
 * the BEHAVIOUR of a person pinned against the top of a scale, and nothing about whether the map
 * from an ordinal word to a probability should be linear at all -- the human representation is
 * argued to be linear in log odds, which this grid is not. Both are open.
 */

/** How many levels a decision recorded today is stated on. */
export const CONFIDENCE_LEVELS = 7;

/**
 * The five-level scale this replaced.
 *
 * Kept because decisions were recorded on it, and a stored `4` from then asserted 0.75 -- it did
 * not assert whatever 4 happens to mean now. Reading those rows on today's grid would rewrite what
 * a player said, which is the one thing the record may never do.
 */
export const LEGACY_CONFIDENCE_LEVELS = 5;

/**
 * WHICH GRID A LEVEL WAS STATED ON, and why the level count is not enough to say.
 *
 * The module note above opens with the rule this constant exists to keep: the scale is three
 * things that must never drift apart -- how many levels, what probability each asserts, and what
 * word sits under it. The record stores exactly one of the three. `confidence_scale` says SEVEN,
 * and seven levels could be `.05 .20 .35 .50 .65 .80 .95` or any other seven numbers.
 *
 * THE VALUES WERE CHOSEN BY MEASUREMENT AND COULD BE RE-CHOSEN. The table above ends with two
 * questions it explicitly does not answer -- Juslin's scale-end effect, and whether the map from an
 * ordinal word to a probability should be linear at all rather than linear in log odds. Either
 * would move these numbers while leaving the count at seven. Every stored `level 6, scale 7` would
 * then quietly assert the new value instead of the 0.80 the player actually said, and nothing in
 * the row could tell: the count still matches, the word is still "בטוח", and every reading changes.
 *
 * That is the same failure `confidence_scale` was added to prevent, one level down, and the same
 * rule applies -- a stored number whose meaning depends on a setting is not a measurement unless
 * the setting is stored beside it.
 *
 * BUMP THIS WHENEVER A VALUE IN `GRID_HISTORY[current]` CHANGES, and never when a scale is merely
 * added: adding a grid for a level count nobody has used cannot re-mean a stored row.
 * `tests/shared/a-grid-that-moved-under-a-stored-level.test.ts` pins every published grid, so a
 * value edited without a bump fails the build with a message rather than rewriting the record.
 */
export const CONFIDENCE_GRID_VERSION = 1;

/**
 * The version a row that does not carry one was written under.
 *
 * ABSENCE DATES THE ROW, exactly as it does for `confidence_scale`. Every decision stored before
 * this field existed was stated on the grids below as version 1 defines them, because those are the
 * only grids that have ever shipped. That is a fact about the history of this file rather than a
 * default, and it stops being true the moment version 2 exists -- at which point rows carrying no
 * version are still version 1 and the new ones say so.
 */
export const LEGACY_CONFIDENCE_GRID_VERSION = 1;

/**
 * What each level asserts, per scale, PER VERSION OF THE GRID.
 *
 * Written out rather than derived from a formula, because the two scales do not share one. The
 * old scale ran to the ends and the new one is inset; a single expression covering both would
 * have to encode that difference anyway, less legibly, and the old row is a historical fact that
 * should be readable as one.
 *
 * A VERSION IS APPENDED, NEVER EDITED. The rows stored under version 1 are only readable while
 * version 1's numbers are still here, so changing one is not a correction -- it is a rewrite of
 * what a player said, which is the one thing the record may never do.
 */
const GRID_HISTORY: Readonly<Record<number, Readonly<Record<number, readonly number[]>>>> = {
  1: {
    [LEGACY_CONFIDENCE_LEVELS]: [0, 0.25, 0.5, 0.75, 1],
    [CONFIDENCE_LEVELS]: [0.05, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95],
  },
};

/** Every grid this build can read, for the pinning test and for anything that has to enumerate. */
export const PUBLISHED_GRIDS = GRID_HISTORY;

/**
 * The word under each level of the CURRENT scale.
 *
 * Seven rungs that a person can actually tell apart, which is the constraint that decides them:
 * a ladder whose neighbours are synonyms is a five-point scale with two extra buttons. Five of
 * these are the words the old scale used, kept deliberately -- a player who learned "בטוח" should
 * not have to relearn it -- and the two additions sit either side of the middle, which is where
 * the old scale had nothing to say between "leaning" and "likely".
 *
 * Their POSITIONS moved: "בטוח" was 4 of 5 and is 6 of 7. That is precisely why a stored level is
 * meaningless without the scale it was stated on.
 */
export const CONFIDENCE_LABELS: readonly string[] = [
  "ניחוש",
  "ספק",
  "נוטה",
  "שקול",
  "סביר",
  "בטוח",
  "ודאי",
];

/**
 * The level that asserts even odds, so nothing has to work out where the middle is.
 *
 * A player with no read at all has to be able to say so, and which BUTTON that is moves with the
 * scale -- it was 3 of 5 and is 4 of 7. Fixtures that plant "no opinion" by writing the integer
 * would keep planting 0.75 after a scale change, silently, while every assertion still passed.
 */
export const EVEN_ODDS_LEVEL = Math.ceil(CONFIDENCE_LEVELS / 2);

/**
 * The distance between neighbouring levels, in probability.
 *
 * Exported because fixtures need to express "one whole point of stated confidence" and used to do
 * it by writing `0.25` -- the old step -- inline. That is the same drift the grid was pulled into
 * one module to prevent, one level down: a scale change would silently rescale every planted
 * effect in the test suite while every test stayed green.
 */
export const CONFIDENCE_STEP = 0.9 / (CONFIDENCE_LEVELS - 1);

/** Every level of the current scale, as the numbers a player sees on the buttons. */
export const CONFIDENCE_CHOICES: readonly number[] = Array.from(
  { length: CONFIDENCE_LEVELS },
  (_, index) => index + 1,
);

/**
 * A stated level, as the probability it asserts.
 *
 * BOTH ARGUMENTS ARE REQUIRED, and the missing default is the point. A stored row without a scale
 * is a row written before scales were recorded, so it is five-level -- but that is a fact about
 * WHEN it was written, and it belongs at the one place that reads stored rows, not in a default
 * here that would silently apply to a fresh decision that simply forgot to pass its scale.
 *
 * Throws rather than guessing. An unrecognised scale is not a small error to be smoothed over:
 * every downstream number is a probability, and a probability read off the wrong grid is wrong
 * quietly, in a direction nobody can see.
 */
export function normaliseConfidence(
  level: number,
  levels: number,
  /**
   * The grid the level was stated on.
   *
   * DEFAULTED, UNLIKE `levels`, and the asymmetry is deliberate. A missing scale could belong to a
   * fresh decision that forgot to pass one, so defaulting it would silently misread a live row.
   * A missing grid version cannot: only one version has ever shipped, so every row without one --
   * stored or fresh -- was stated on version 1. The day that stops being true is the day the
   * constant moves, and rows written after it will carry their own.
   */
  gridVersion: number = LEGACY_CONFIDENCE_GRID_VERSION,
): number {
  const grids = GRID_HISTORY[gridVersion];
  if (!grids) {
    throw new RangeError(
      `confidence was stated on grid version ${gridVersion}, which this build cannot read`,
    );
  }
  const grid = grids[levels];
  if (!grid) {
    throw new RangeError(
      `confidence was stated on a ${levels}-level scale, which this build cannot read`,
    );
  }
  const value = grid[level - 1];
  if (value === undefined) {
    throw new RangeError(`confidence ${level} is not a level of a ${levels}-level scale`);
  }
  return value;
}
