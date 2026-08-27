/**
 * What the reveal is allowed to say (section 4.2).
 *
 * The order is load-bearing: what CANNOT be inferred comes first, always, before any number.
 * Then one thing to work on. Then the next question. Everything else is secondary disclosure.
 *
 * Every sentence produced here is derived from a measured condition. None is a template. The
 * old AnalysisPanel ended every position with the same hardcoded sentence about checking the
 * centre, and a fixed template rendered as insight is manufactured certainty -- replacing it
 * with a more fluent generator would be the same defect with better prose.
 *
 * When there is nothing honest to say, these return null and the interface says so. Section 4.5:
 * the product's credibility is built entirely out of the moments it declines to claim something.
 */

/** Below this depth, differences smaller than ENGINE_NOISE_CP are not meaningful. */
import { normaliseConfidence } from "./confidence.js";

export const SHALLOW_DEPTH = 16;
/** Centipawn differences at or under this are inside evaluation noise, not a mistake. */
export const ENGINE_NOISE_CP = 30;
/** A move this far from the engine's line is worth a sentence. */
export const MATERIAL_LOSS_CP = 100;
/**
 * What a forced mate is worth when a centipawn number is unavoidable: a CLAMP, not a conversion.
 *
 * UCI reports a forced mate as `score mate N`, which is an ORDERING and not a magnitude. There is
 * no centipawn value of "mate in nine"; there is only "this wins and every centipawn score does
 * not". Any number put here is a convention, so the convention is stated once, in one place, and
 * the sentence the reveal prints says which distance it threw away.
 *
 * IT LIVES IN THIS FILE, and not beside the parser, because `shared/` cannot import from
 * `client/` and both engine paths must read the SAME constant. They did not: the import scan
 * clamped mate to a fixed 10000 while the live reveal multiplied the mate distance BY 10000, so
 * the same engine output on the same move produced opposite verdicts depending on which screen
 * asked. Two conventions is not a convention.
 */
export const MATE_SCORE = 10000;
export interface RevealInputs {
  depth: number;
  cpLoss: number;
  chosenMove: string;
  bestMove: string;
  chosenWasBest: boolean;
  /** The stated level as the player pressed it: 1..confidenceScale, NOT a probability. */
  confidence: number;
  /**
   * How many buttons that level was one of.
   *
   * Required, not optional with a default. Every decision stores `confidence_scale` for exactly
   * this reason, and a default here would silently re-interpret rows from the other scale -- which
   * is the defect this field was added to make unreachable.
   */
  confidenceScale: number;
  statedUnknown: string;
  /** Recorded decisions so far, including this one. */
  decisionsOnRecord: number;
  /**
   * The moves the player actually put on the board before committing, in UCI, including the one
   * they chose.
   *
   * READ THIS AS WHAT IT IS. It is a record of board interaction, not of thought. A player who
   * weighed four moves in their head and touched one leaves a list of length one. So the only
   * sound inference runs in one direction: a move that IS in this list was demonstrably in front
   * of the player, and a move that is not may still have been considered. Every sentence derived
   * from it below is phrased in that direction, and the limit that fires on a list of one says
   * the other direction out loud.
   */
  candidatesConsidered: string[];
  /**
   * Set when the engine answered this position with a forced mate rather than a centipawn score.
   *
   * `cpLoss` is then measured against MATE_SCORE, which is a ceiling and not a measurement, and
   * the mate distance -- whether the move brought mate seven moves closer or pushed it away --
   * is not in the number at all. Optional because the branch mix constructs these inputs from
   * stored decisions, where the record kept the loss and not the shape of the score that
   * produced it; absent means "not known to be clamped", never "known not to be".
   */
  clampedMate?: boolean;
}

/**
 * What is true of this BUILD rather than of any one position.
 *
 * `cloudAvailable` was hardcoded false at the call site, so the reveal printed "אין הערכת ענן
 * לעמדה הזו" on every single reveal -- phrased as a finding about that position, when it was a
 * constant. A sentence that always fires carries no information, and one that always fires while
 * claiming to be about the position in front of you is worse than none.
 *
 * The honest version is not per-position and does not pretend to be: this build has one local
 * engine, always, and that is a property of the build. Rendered once, above the per-position
 * limits, in the same register.
 *
 * The alternative was querying Lichess for a cloud evaluation and setting the flag from the
 * answer. Rejected: it puts a network call carrying the player's position on the reveal path of
 * a product whose whole posture is that the record never leaves the deployment.
 */
export const BUILD_LIMIT =
  "הבילד הזה מריץ מנוע מקומי אחד. אין מקור הערכה שני, ולכן אין למנוע במה להיבדק — בשום עמדה.";

/**
 * SECTION 4.2 STEP 1: what cannot be inferred here. Rendered before any number, always.
 * This list is never empty -- at minimum, one decision is one decision.
 */
export function inferenceLimits(inputs: RevealInputs): string[] {
  const limits: string[] = [];

  limits.push(
    inputs.decisionsOnRecord === 1
      ? "זו החלטה אחת שנרשמה. שום דבר כאן אינו דפוס, ואי אפשר להסיק ממנה על המשחק שלך."
      : `נרשמו ${inputs.decisionsOnRecord} החלטות. זה עדיין תיאור של ההחלטות האלה, לא של השחקן.`,
  );

  if (inputs.depth < SHALLOW_DEPTH) {
    limits.push(
      `המנוע הגיע לעומק ${inputs.depth} בלבד. הפרשים קטנים מ-${ENGINE_NOISE_CP} ס״פ אינם אומרים כאן כלום.`,
    );
  }
  if (inputs.cpLoss <= ENGINE_NOISE_CP && !inputs.chosenWasBest) {
    limits.push(
      `המהלך שלך והמהלך של המנוע רחוקים ${inputs.cpLoss} ס״פ — בתוך רעש ההערכה. זו אינה טעות.`,
    );
  }
  /*
   * The distinction this build cannot make on one recorded candidate.
   *
   * "You did not see it" and "you saw it and rejected it" call for opposite work -- one is
   * vision, the other is the rule that chose between what was seen -- and with a single move on
   * the board the record cannot tell them apart. Saying so is the honest move, and it also tells
   * the player how to make the next reveal say more.
   *
   * Only when the engine preferred something else: with nothing to have missed, there is no
   * distinction to be unable to make.
   */
  /*
   * The number on this screen is a ceiling, and saying so is the whole of section 4.4 here.
   *
   * A forced mate has no centipawn value. When the engine returns one, `cpLoss` is computed
   * against MATE_SCORE -- so "0 centipawns" on a mating move means "nothing was better than
   * this", which is true, and NOT "this move changed nothing", which is what the number looks
   * like. The distance to mate is the part that was dropped, so the distance is what the
   * sentence names.
   */
  if (inputs.clampedMate) {
    limits.push(
      `המנוע החזיר כאן מט כפוי, ומט אינו כמות בסנטי-פונים. עלות ההחלטה נמדדה מול תקרה קבועה של ${MATE_SCORE} ס״פ, ולכן המרחק למט — אם המהלך קירב אותו או דחה אותו — לא נמדד כאן כלל.`,
    );
  }
  if (!inputs.chosenWasBest && inputs.candidatesConsidered.length <= 1) {
    limits.push(
      "רק מהלך אחד נרשם כנשקל, ולכן אי אפשר לדעת כאן אם לא ראית את המהלך של המנוע או שראית ודחית. " +
        "מהלכים שנשקלו בלי להניח אותם על הלוח אינם נרשמים.",
    );
  }
  return limits;
}

/**
 * Which branch produced the sentence.
 *
 * Added so the branches can be COUNTED, not to change what any of them says. The product leads on
 * the calibration gap, which is weeks away and statistical; `chose-past-it` is the one finding
 * here that no other chess tool can produce -- it needs R3's silence to exist, because it depends
 * on knowing what was on the board before the engine spoke -- and it needs no aggregation at all.
 * Whether it can carry more weight than it does depends entirely on how often it actually fires,
 * and nobody has ever measured that. `oneThingMix` below is that measurement.
 */
/**
 * THE TWO CUT POINTS, IN STATED PROBABILITY RATHER THAN IN BUTTON NUMBERS.
 *
 * They used to be `confidence >= 4` and `confidence <= 2`, read off the RAW stored level. Those
 * numbers were written for the five-level scale, whose grid is `[0, 0.25, 0.5, 0.75, 1]`
 * (shared/confidence.ts) -- so they meant "asserted at least 75%" and "asserted at most 25%".
 *
 * The product now offers seven buttons on the grid `[0.05, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95]`, and
 * `shared/confidence.ts` says why the old numbers cannot survive that: "'בטוח' was 4 of 5 and is
 * 6 of 7. That is precisely why a stored level is meaningless without the scale it was stated on."
 * `normaliseConfidence` exists to do this conversion and was never called from here.
 *
 * Measured at every button the picker actually offers, on a move costing 150cp:
 *
 *     button 4 (שקול, asserts 50%) -> confident-and-wrong   "אמרת ביטחון 4 מתוך 5"
 *     button 5 (סביר, asserts 65%) -> confident-and-wrong   "אמרת ביטחון 5 מתוך 5"
 *     button 6 (בטוח, asserts 80%) -> confident-and-wrong   "אמרת ביטחון 6 מתוך 5"
 *     button 7 (ודאי, asserts 95%) -> confident-and-wrong   "אמרת ביטחון 7 מתוך 5"
 *
 * `שקול` is `EVEN_ODDS_LEVEL` -- the button that exists so a player can decline to claim anything
 * -- and it was being told the gap between its confidence and the result was the thing to work on.
 * Two of the four printed a denominator that is not the scale they were stated on, beside a screen
 * showing "7 · ודאי".
 *
 * These constants reproduce the ORIGINAL meaning exactly, and are scale-independent: on the
 * seven-grid, 0.75 admits `בטוח` and `ודאי`, and 0.25 admits `ניחוש` and `ספק`.
 */
export const CONFIDENT_ENOUGH_TO_NAME = 0.75;
export const UNSURE_ENOUGH_TO_NAME = 0.25;

export type OneThingKind =
  /** The engine's move was among the ones the player put on the board, and they played another. */
  | "chose-past-it"
  /** Asserted at least CONFIDENT_ENOUGH_TO_NAME, and the move cost material. */
  | "confident-and-wrong"
  /** Cost material, with nothing else the measurement can add. */
  | "outplayed"
  /** Chose well inside the noise, having asserted at most UNSURE_ENOUGH_TO_NAME. */
  | "trusted-it-too-little";

export interface OneThing {
  kind: OneThingKind;
  text: string;
  /** What measurement produced this sentence. Rendered with it, never without. */
  basis: string;
}

/**
 * SECTION 4.2 STEP 2: the one thing to work on. One. Not a list.
 * Returns null when the measurement does not support saying anything, which is a valid outcome.
 */
export function theOneThing(inputs: RevealInputs): OneThing | null {
  const noisy = inputs.cpLoss <= ENGINE_NOISE_CP;
  const rejectedTheBest = inputs.candidatesConsidered.includes(inputs.bestMove);

  /*
   * The choice rule, and it comes first.
   *
   * It outranks the calibration sentence below, which is the primary measure everywhere else in
   * this product -- so the reason has to be stated. A calibration gap read off ONE decision is
   * the aggregate claim at n=1; the detector needs MIN_BUCKET_N before it will say anything of
   * the kind, and this sentence is standing in for it locally. "The best move was on your board
   * and you played another" needs no aggregation at all. It is a fact about this decision, it
   * uses strictly more of the record than the branches below, and it points at different work:
   * not seeing further, but choosing better between things already seen.
   *
   * Phrased as "you recorded it" rather than "you saw it", per the field's own caveat.
   */
  if (!noisy && inputs.cpLoss >= MATERIAL_LOSS_CP && rejectedTheBest) {
    return {
      kind: "chose-past-it",
      text: `${inputs.bestMove} היה בין המהלכים שהנחת על הלוח, ובחרת ב-${inputs.chosenMove} — הפרש של ${inputs.cpLoss} ס״פ. ראית את המהלך; מה שהכריע ביניהם הוא מה שכדאי להסתכל עליו, לא הראייה.`,
      basis: `${inputs.bestMove} נרשם בין ${inputs.candidatesConsidered.length} מהלכים שנשקלו, ${inputs.cpLoss} ס״פ בעומק ${inputs.depth}`,
    };
  }

  // The calibration gap is the primary measure (section 6): stated confidence against realised
  // accuracy. It outranks the move itself, because it is a property of the decision policy.
  const stated = normaliseConfidence(inputs.confidence, inputs.confidenceScale);
  if (!noisy && inputs.cpLoss >= MATERIAL_LOSS_CP && stated >= CONFIDENT_ENOUGH_TO_NAME) {
    return {
      kind: "confident-and-wrong",
      text: `אמרת ביטחון ${inputs.confidence} מתוך ${inputs.confidenceScale}, וההחלטה עלתה ${inputs.cpLoss} ס״פ. הפער בין הביטחון לתוצאה הוא מה שכדאי להסתכל עליו, לא המהלך.`,
      basis: `ביטחון ${inputs.confidence}/${inputs.confidenceScale} מול ${inputs.cpLoss} ס״פ בעומק ${inputs.depth}`,
    };
  }
  if (!noisy && inputs.cpLoss >= MATERIAL_LOSS_CP) {
    return {
      kind: "outplayed",
      text: `המהלך ${inputs.chosenMove} עלה ${inputs.cpLoss} ס״פ מול ${inputs.bestMove}. שווה להבין מה ${inputs.bestMove} רואה שהוא לא.`,
      basis: `${inputs.cpLoss} ס״פ בעומק ${inputs.depth}`,
    };
  }
  if (noisy && stated <= UNSURE_ENOUGH_TO_NAME) {
    return {
      kind: "trusted-it-too-little",
      text: `בחרת נכון בתוך רעש ההערכה, אבל אמרת ביטחון ${inputs.confidence} מתוך ${inputs.confidenceScale}. ייתכן שאתה יודע כאן יותר ממה שאתה סומך על עצמו.`,
      basis: `ביטחון ${inputs.confidence}/${inputs.confidenceScale} מול ${inputs.cpLoss} ס״פ בעומק ${inputs.depth}`,
    };
  }
  // Nothing measured here supports a sentence. Say nothing rather than fill the space.
  return null;
}

/**
 * WHY there was nothing to say -- and there are two reasons, not one.
 *
 * The defect this exists to fix. `theOneThing` returns null on two disjoint bands, and the panel
 * printed the SAME sentence for both: *"you chose within the evaluation noise and your confidence
 * matched"*. That is true on the first band and false on the second. Enumerated:
 *
 *     cpLoss <= 30, confidence >= 3   -> inside the noise. The sentence was right.
 *     31 <= cpLoss <= 99, ANY confidence -> NOT inside the noise, and nothing was asserted about
 *                                        confidence either -- it is silent at 5/5 as much as 3/5.
 *
 * So on the whole 31-99 band the product's most reliable output was stating a basis its own
 * constants contradict, and section 4.5 was broken at the same time: two different situations
 * rendering as one sentence. The band was untested; every fixture sat at 4 or 20 centipawns.
 *
 * Only meaningful when `theOneThing` returned null. Calling it otherwise asks a question about a
 * decision that already had an answer.
 */
export type SilenceBasis = "inside-noise" | "below-the-line";

export function silenceBasis(inputs: RevealInputs): SilenceBasis {
  return inputs.cpLoss <= ENGINE_NOISE_CP ? "inside-noise" : "below-the-line";
}

/**
 * HOW OFTEN EACH BRANCH ACTUALLY FIRES, over the record.
 *
 * WHY THIS EXISTS. `chose-past-it` is the only sentence in this product that no other chess tool
 * can write. Every engine knows the best move; none knows it was already on your board, because
 * none of them makes you commit first. It arrives on decision one, it needs no aggregation, and
 * it separates two failures that look identical everywhere else -- not seeing far enough, versus
 * seeing and choosing wrong. Those point at different work.
 *
 * None of which matters if it fires on three decisions in a hundred. That number has never been
 * measured, and it cannot be taken from imported games: an imported PGN carries no record of what
 * was on the board before the move, so `candidate_moves_considered` is empty for every one of
 * them and this branch can never fire. It needs live decisions, which is what this counts.
 *
 * WHAT THIS IS NOT. Not a finding about the player. It is a reading of the instrument -- which of
 * its four sentences the record actually produces -- and it is reported with its denominator and
 * below the same floor as everything else here.
 *
 * THE DIRECTION OF THE INFERENCE, carried from `candidate_moves_considered`. A move IS in that
 * list only if it was physically put on the board. A player who weighed four moves in their head
 * and touched one leaves a list of length one. So `chose-past-it` is a LOWER bound on "saw it and
 * chose past it", never an estimate, and the same asymmetry it already states per decision.
 */
export interface OneThingMix {
  /** Decisions the engine has answered. Nothing here can be computed before a reveal. */
  n: number;
  counts: Record<OneThingKind, number>;
  /** Decisions where the measurement supported no sentence. A valid outcome, counted as one. */
  silent: number;
  /**
   * Of `n`, how many were even eligible for `chose-past-it` -- above the engine noise and at or
   * over the material threshold. It is the ceiling that branch could ever reach, and the gap
   * between it and the branch's own count is the share where the move was NOT on the board.
   */
  eligible: number;
}

/** The atom fields this reads. Kept structural so the record's own type does not leak in here. */
export interface MixableDecision {
  confidence: number;
  /**
   * The scale that level was stated on, straight off `bounded_action.confidence_scale`.
   *
   * Carried because this mix runs over the WHOLE record, which is where a scale change actually
   * bites: pooling legacy five-level rows and current seven-level rows on one raw threshold
   * counts a stored 4 (which asserted 75%) and a current 4 (which asserts 50%) as the same claim.
   */
  confidenceScale: number;
  candidatesConsidered: string[];
  chosenMove: string;
  cpLoss: number | null;
  bestMove: string | null;
}

export function oneThingMix(decisions: MixableDecision[]): OneThingMix {
  const counts: Record<OneThingKind, number> = {
    "chose-past-it": 0,
    "confident-and-wrong": 0,
    outplayed: 0,
    "trusted-it-too-little": 0,
  };
  let n = 0;
  let silent = 0;
  let eligible = 0;

  for (const d of decisions) {
    // No reveal, nothing to classify. R3 again: before the engine answers there is no cp loss.
    if (d.cpLoss === null || d.bestMove === null) continue;
    n += 1;
    if (d.cpLoss > ENGINE_NOISE_CP && d.cpLoss >= MATERIAL_LOSS_CP) eligible += 1;
    /*
     * The real function, not a restatement of its conditions.
     *
     * Copying the four `if`s into this loop would be the obvious way to write it and would drift
     * the first time a threshold moves -- and then the product and the measurement OF the product
     * would disagree about what the product does, which is the worst version of this bug.
     *
     * The fields `theOneThing` does not read for its branching are filled with values that cannot
     * change the outcome; only `statedUnknown` and `decisionsOnRecord` are unused by it, and both
     * feed other sentences.
     */
    const one = theOneThing({
      depth: 0,
      cpLoss: d.cpLoss,
      chosenMove: d.chosenMove,
      bestMove: d.bestMove,
      chosenWasBest: d.chosenMove === d.bestMove,
      confidence: d.confidence,
      confidenceScale: d.confidenceScale,
      statedUnknown: "",
      decisionsOnRecord: decisions.length,
      candidatesConsidered: d.candidatesConsidered,
    });
    if (one === null) silent += 1;
    else counts[one.kind] += 1;
  }
  return { n, counts, silent, eligible };
}

/**
 * SECTION 4.2 STEP 3: the next question, anchored to what the player said they could not
 * evaluate. That text is the one thing on screen the engine did not produce.
 */
export function nextQuestion(inputs: RevealInputs): string {
  const unknown = inputs.statedUnknown.trim();
  if (unknown.length > 0) {
    return `כתבת שאתה לא יכול להעריך: "${unknown}". האם הקו של המנוע עונה על זה, או שהוא פשוט לא נכנס לשם?`;
  }
  /*
   * THE TWO MOVES HAVE TO BE TWO. Without this branch the sentence came out as "מה היית צריך
   * לדעת כדי לבחור בין e4d5 ל-e4d5?" every time the player picked exactly the move the engine
   * picked -- a comparison between a move and itself, printed with complete confidence.
   *
   * AND THE REPLACEMENT DOES NOT CONGRATULATE. Choosing the engine's move is not evidence of
   * having understood it: the whole product exists to refuse that inference, and "correct!" here
   * would be the app grading its own success on the one screen that must not. So the question
   * asks whether the reason would have survived the engine choosing differently, which is the
   * only form of it that can come back false.
   *
   * GUARDED ON THE STRINGS, NOT ON `chosenWasBest`, and the redundancy is the reason. The single
   * call site computes the flag as `bestMove === draft.chosenMove`, so the two can never
   * disagree in the running product -- which means one of them is dead weight. The strings are
   * what get interpolated, so they are the half kept: if a caller ever passes a flag that lies,
   * the sentence is still about two real things. A positive control found the disjunction by
   * flipping it to the flag alone and watching nothing fail.
   */
  if (inputs.chosenMove === inputs.bestMove) {
    return `בחרת את ${inputs.chosenMove}, וזה גם המהלך של המנוע. מה היה הנימוק שלך — והאם הוא היה מחזיק גם אילו המנוע היה בוחר אחרת?`;
  }
  return `מה היית צריך לדעת כדי לבחור בין ${inputs.chosenMove} ל-${inputs.bestMove}?`;
}
