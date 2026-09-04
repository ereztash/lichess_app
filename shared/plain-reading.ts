/**
 * THE NUMBER STAYS. IT JUST STOPS BEING THE FIRST THING.
 *
 * §6 and §8 of the master plan: the product must not open with a percentage, and a stored `6` must
 * not reach a screen as a `6`. Both are the same rule -- a figure that arrives without its meaning
 * asks the reader to do the interpretation, which is the work this product exists to do for them.
 *
 * THIS FILE IS NOT A FORMATTER. Every boundary in it comes from the measurement contract, and where
 * the contract has no boundary this file has no band. That is the constraint the plan states in one
 * line -- "הגבולות חייבים להגיע מה־measurement contract, לא מעיצוב" -- and it is the reason there
 * are THREE cost bands here and not the four the plan sketches. Two constants are measured
 * (`ENGINE_NOISE_CP`, `MATERIAL_LOSS_CP`); a third boundary between "noticeable" and "large" is not,
 * and inventing one would put a designer's opinion inside a sentence the player reads as a
 * measurement. Three measured bands are worth more than four with one invented, and the day
 * somebody measures the fourth it is one entry here.
 *
 * THE COST BANDS ARE ON WIN PROBABILITY, NOT ON CENTIPAWNS, for the reason `accurateDecision`
 * already gives about itself: thirty centipawns is 2.76 points of winning chances at a level
 * position and 0.28 at +10.00, so a band on raw centipawns would call the same move "small" in one
 * position and "large" in another with nothing about the move having changed. The two thresholds
 * are converted once, at the same reference `ACCURATE_WIN_PROBABILITY_LOSS` uses, so the boundary
 * between "no real cost" and "a small cost" is EXACTLY the boundary between accurate and not.
 * One rule, one place -- a second definition of "accurate" wearing different words is how two
 * screens in this repository came to disagree before.
 *
 * THE CONFIDENCE WORDS ARE VERSIONED WITH THE GRID, which is R-10's lesson applied to language. A
 * word is a claim about a probability; move the probability and the word is wrong, silently, with
 * the count still matching. So the words live in a table keyed the same way `PUBLISHED_GRIDS` is,
 * and a gate requires every published grid to have a word for every level it defines.
 */
import {
  CONFIDENCE_GRID_VERSION,
  LEGACY_CONFIDENCE_GRID_VERSION,
  PUBLISHED_GRIDS,
} from "./confidence.js";
import { ACCURATE_WIN_PROBABILITY_LOSS } from "./detector.js";
import { ENGINE_NOISE_CP, MATERIAL_LOSS_CP } from "./reveal.js";
import { winProbabilityLoss } from "./win-probability.js";

/**
 * The second boundary, derived the way the first one was.
 *
 * `ACCURATE_WIN_PROBABILITY_LOSS` is `winProbabilityLoss(ACCURATE_CP_LOSS / 2, ACCURATE_CP_LOSS)`
 * -- the loss a 30cp mistake costs when it is centred on the position it was made in. This is the
 * same construction at `MATERIAL_LOSS_CP`, so the two boundaries are on one scale and neither is
 * a number somebody picked.
 */
export const MATERIAL_WIN_PROBABILITY_LOSS = winProbabilityLoss(
  MATERIAL_LOSS_CP / 2,
  MATERIAL_LOSS_CP,
);

export const COST_BANDS = ["no-real-cost", "small-cost", "large-cost"] as const;
export type CostBand = (typeof COST_BANDS)[number];

/**
 * What each band is called, and the one sentence that says why it is that band.
 *
 * `detail` IS NOT THE NUMBER. It says what the band MEANS -- what a move in it did to the game --
 * so a reader who opens the disclosure learns something rather than seeing the same figure again
 * with a decimal point. The centipawn value goes beside it, from the record, unformatted.
 */
export const COST_BAND_WORD: Readonly<Record<CostBand, { word: string; detail: string }>> = {
  "no-real-cost": {
    word: "בלי מחיר ממשי",
    detail: "ההפרש מהמהלך של המנוע קטן מרעש החיפוש עצמו. זה לא טעות שנמדדה.",
  },
  "small-cost": {
    word: "מחיר קטן",
    detail: "המהלך עלה משהו בסיכויי הזכייה, אבל פחות ממה שהפסד חומר היה עולה.",
  },
  "large-cost": {
    word: "מחיר גדול",
    detail: "המהלך עלה בסיכויי הזכייה לפחות כמו הפסד חומר בעמדה הזאת.",
  },
};

/**
 * WHAT ONE MOVE COST, IN WORDS.
 *
 * TAKES THE STANDING AS WELL AS THE LOSS, so a caller cannot forget that the rule needs it -- the
 * same signature discipline `accurateDecision` uses, and for the same reason: every call site that
 * could forget it did.
 */
export function costBand(standingCp: number, cpLoss: number): CostBand {
  const loss = winProbabilityLoss(standingCp, cpLoss);
  if (loss <= ACCURATE_WIN_PROBABILITY_LOSS) return "no-real-cost";
  if (loss < MATERIAL_WIN_PROBABILITY_LOSS) return "small-cost";
  return "large-cost";
}

/**
 * THE WORD UNDER EACH BUTTON, PER GRID VERSION AND PER SCALE.
 *
 * KEYED EXACTLY LIKE `PUBLISHED_GRIDS`, and that is the whole design. `shared/confidence.ts` opens
 * with the rule that the scale is three things that must never drift apart -- how many levels, what
 * probability each asserts, and what word sits under it -- and the repository stored the first two
 * and left the third in a component. So a grid change would have moved the probabilities while the
 * words stayed, which is the same silent re-meaning R-10 closed, arriving through the label instead
 * of through the number.
 *
 * THE WORDS ARE ORDINAL AND THEY ARE NOT PROBABILITIES. "בטוח" is not 0.8 spelled out; it is the
 * word for the level whose grid entry is 0.8, and if a later grid puts 0.83 there the word does not
 * change -- the mapping does. That is why this table is keyed by version rather than by value.
 *
 * NO WORD CLAIMS CERTAINTY AT EITHER END. The top of the scale is 0.95 and the bottom is 0.05, and
 * a player who reads "בטוח לגמרי" at the top will state it for positions they are 90% on -- which
 * is the scale-end effect `shared/confidence.ts` names as an open question, made worse by the
 * label. The extremes are worded as strong, not as absolute.
 */
export const CONFIDENCE_WORDS: Readonly<Record<number, Readonly<Record<number, readonly string[]>>>> =
  {
    1: {
      5: ["ניחוש", "נוטה לא", "חצי-חצי", "נוטה כן", "כמעט בטוח"],
      7: ["ניחוש", "כמעט לא", "נוטה לא", "חצי-חצי", "נוטה כן", "בטוח", "בטוח מאוד"],
    },
  };

/**
 * The word for a stored level, or a refusal.
 *
 * REFUSES RATHER THAN FALLING BACK, the same way `normaliseConfidence` does and for the same
 * reason: putting today's word under a level stated on a grid this build does not publish is
 * telling the player they said something they did not.
 */
export function confidenceWord(
  level: number,
  levels: number,
  gridVersion: number = LEGACY_CONFIDENCE_GRID_VERSION,
): string {
  const grid = CONFIDENCE_WORDS[gridVersion];
  if (!grid) throw new Error(`confidenceWord: no words published for grid version ${gridVersion}`);
  const words = grid[levels];
  if (!words) throw new Error(`confidenceWord: cannot read a ${levels}-level scale`);
  if (!Number.isInteger(level) || level < 1 || level > words.length) {
    throw new Error(`confidenceWord: ${level} is not a level on a ${levels}-level scale`);
  }
  return words[level - 1];
}

/**
 * WHAT A PLAYER'S DECISIONS ARE DOING WHEN THEY ARE NOT IN THE POPULATION THIS SCREEN READS.
 *
 * TWO SURFACES SAID THIS AND ONLY ONE OF THEM HAD BEEN WRITTEN. `elsewhereSentence` in
 * `blitz-words.ts` says it on the front door, from the `N-3` owner decision: bank, drill,
 * transfer and imported decisions are counted under their own headings with their own
 * denominators, so a screen that reads only free play must say where the others went rather than
 * report zero. `RecordDashboard` is a record surface with the same populations and the same
 * problem, and it said "עוד לא נחשפה אף החלטה" to a player holding three revealed ones.
 *
 * SO THE CLAUSE IS ONE STRING IN ONE PLACE. Each caller supplies its own second sentence, because
 * what THIS screen measures differs -- the front door measures games played, the dashboard
 * measures a calibration gap -- but the acknowledgement itself may not drift between them.
 *
 * `נרשמו` AND NOT `נמדדו`, carried from `blitz-words.ts` where the choice was made and reasoned:
 * the count is every decision outside this screen's population, and some of those are still
 * waiting for the engine. Recorded is what all of them are; measured is what only some are. The
 * same file also documents why the two registers must not share a bare verb -- `1 נמדדו ונקראות
 * בחלק אחר` above `0 נמדדו מתוך 1 שנרשמו` read as a broken record when both lines were true.
 *
 * NOT A DENOMINATOR. Nothing here counts toward any floor, bucket or eligibility rule. It reports
 * a number that already exists to a reader who would otherwise be told it is zero.
 */
export function decisionsHeldElsewhere(n: number): string {
  return n === 1
    ? "החלטה אחת שלך נרשמה ונקראת בחלק אחר של הרשומה"
    : `${n} החלטות שלך נרשמו ונקראות בחלק אחר של הרשומה`;
}

/**
 * THE SMALLEST NUMBER OF OBSERVATIONS A "USUAL RANGE" CAN BE DRAWN FROM.
 *
 * At three or fewer, the first and third quartiles are two of the three values, so the "usual
 * range" would be the whole sample presented as a typical band -- a shape that says "this is where
 * you normally are" while containing every observation there is. Four is the first size at which
 * the range excludes anything.
 *
 * IT IS A FLOOR ON DEFINEDNESS, NOT A FLOOR ON CREDIBILITY, and the difference matters: `n` is
 * returned beside the range so a caller can decline to draw one from five observations. Choosing a
 * credibility floor here would put that judgement in the wrong place and would be unmeasured.
 */
export const MIN_USUAL_RANGE_N = 4;

/**
 * ONE DECISION'S TIME, AS SOMETHING TO DRAW RATHER THAN SOMETHING TO READ.
 *
 * §9: "Think-time percentile: 14.3%" is a number a player has to convert into a feeling. Two bars
 * and a band are the same fact, and the eye sees the outlier before the mind does the arithmetic.
 *
 * SO THIS RETURNS MILLISECONDS AND NOT A PERCENTILE. Every field is a length a component can draw
 * directly. A percentile would force the component to invent a scale to render it against, which is
 * the inference-in-the-render this whole layer exists to remove.
 */
export interface TimeShape {
  /** What the player's own clock held as they faced the position. */
  clockBeforeMs: number;
  /** What they spent on it. */
  thinkMs: number;
  /**
   * Where they usually are, as an interquartile range, with the number of observations behind it.
   *
   * NULL BELOW `MIN_USUAL_RANGE_N`, and null rather than the whole sample: a band that contains
   * every observation is not a comparison, and drawn beside one decision it would say the decision
   * was typical no matter what it was.
   */
  usualMs: { low: number; high: number; n: number } | null;
}

/**
 * The quartile at `fraction` of a sorted sample, by nearest rank.
 *
 * NEAREST RANK AND NOT INTERPOLATION, because every value here is an observed think time and the
 * band is going to be drawn as a length beside one. An interpolated bound is a duration nobody
 * spent, and at these sample sizes it moves the edge by more than the difference it is meant to
 * express.
 */
function quantile(sortedMs: readonly number[], fraction: number): number {
  const index = Math.min(sortedMs.length - 1, Math.max(0, Math.round(fraction * (sortedMs.length - 1))));
  return sortedMs[index];
}

export function timeShape(
  clockBeforeMs: number,
  thinkMs: number,
  /**
   * Comparable think times, in milliseconds, in any order.
   *
   * WHAT COUNTS AS COMPARABLE IS THE CALLER'S PROBLEM AND MUST STAY THERE. A reference assembled
   * here would have to guess whether "usual" means this game, this time control, or the whole
   * record -- and `ThinkTimeReference` in `blitz-features.ts` already carries a `source` field
   * precisely because a percentile fitted on the wrong population is invisible afterwards.
   */
  comparableMs: readonly number[] = [],
): TimeShape {
  if (comparableMs.length < MIN_USUAL_RANGE_N) {
    return { clockBeforeMs, thinkMs, usualMs: null };
  }
  const sorted = [...comparableMs].sort((a, b) => a - b);
  return {
    clockBeforeMs,
    thinkMs,
    usualMs: { low: quantile(sorted, 0.25), high: quantile(sorted, 0.75), n: sorted.length },
  };
}

/**
 * Every grid version this build publishes WORDS for. Used by the gate, and by nothing else.
 *
 * A VERSION WITH A GRID AND NO WORDS IS A SCREEN THAT THROWS, far from whoever added the grid. The
 * gate turns that into a failing build in the commit that causes it.
 */
export const WORDED_GRID_VERSIONS: readonly number[] = Object.keys(CONFIDENCE_WORDS).map(Number);

/** Every version with published probabilities. The two lists must be equal. */
export const PUBLISHED_GRID_VERSIONS: readonly number[] = Object.keys(PUBLISHED_GRIDS).map(Number);

/** The current version, re-exported so a gate need not import two modules to check one invariant. */
export const WORDED_GRID_VERSION = CONFIDENCE_GRID_VERSION;
