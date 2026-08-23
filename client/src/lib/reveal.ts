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
export const SHALLOW_DEPTH = 16;
/** Centipawn differences at or under this are inside evaluation noise, not a mistake. */
export const ENGINE_NOISE_CP = 30;
/** A move this far from the engine's line is worth a sentence. */
export const MATERIAL_LOSS_CP = 100;
export interface RevealInputs {
  depth: number;
  cpLoss: number;
  chosenMove: string;
  bestMove: string;
  chosenWasBest: boolean;
  confidence: number;
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
  if (!inputs.chosenWasBest && inputs.candidatesConsidered.length <= 1) {
    limits.push(
      "רק מהלך אחד נרשם כנשקל, ולכן אי אפשר לדעת כאן אם לא ראית את המהלך של המנוע או שראית ודחית. " +
        "מהלכים שנשקלו בלי להניח אותם על הלוח אינם נרשמים.",
    );
  }
  return limits;
}

export interface OneThing {
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
      text: `${inputs.bestMove} היה בין המהלכים שהנחת על הלוח, ובחרת ב-${inputs.chosenMove} — הפרש של ${inputs.cpLoss} ס״פ. ראית את המהלך; מה שהכריע ביניהם הוא מה שכדאי להסתכל עליו, לא הראייה.`,
      basis: `${inputs.bestMove} נרשם בין ${inputs.candidatesConsidered.length} מהלכים שנשקלו, ${inputs.cpLoss} ס״פ בעומק ${inputs.depth}`,
    };
  }

  // The calibration gap is the primary measure (section 6): stated confidence against realised
  // accuracy. It outranks the move itself, because it is a property of the decision policy.
  if (!noisy && inputs.cpLoss >= MATERIAL_LOSS_CP && inputs.confidence >= 4) {
    return {
      text: `אמרת ביטחון ${inputs.confidence} מתוך 5, וההחלטה עלתה ${inputs.cpLoss} ס״פ. הפער בין הביטחון לתוצאה הוא מה שכדאי להסתכל עליו, לא המהלך.`,
      basis: `ביטחון ${inputs.confidence}/5 מול ${inputs.cpLoss} ס״פ בעומק ${inputs.depth}`,
    };
  }
  if (!noisy && inputs.cpLoss >= MATERIAL_LOSS_CP) {
    return {
      text: `המהלך ${inputs.chosenMove} עלה ${inputs.cpLoss} ס״פ מול ${inputs.bestMove}. שווה להבין מה ${inputs.bestMove} רואה שהוא לא.`,
      basis: `${inputs.cpLoss} ס״פ בעומק ${inputs.depth}`,
    };
  }
  if (noisy && inputs.confidence <= 2) {
    return {
      text: `בחרת נכון בתוך רעש ההערכה, אבל אמרת ביטחון ${inputs.confidence} מתוך 5. ייתכן שאתה יודע כאן יותר ממה שאתה סומך על עצמו.`,
      basis: `ביטחון ${inputs.confidence}/5 מול ${inputs.cpLoss} ס״פ בעומק ${inputs.depth}`,
    };
  }
  // Nothing measured here supports a sentence. Say nothing rather than fill the space.
  return null;
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
  return `מה היית צריך לדעת כדי לבחור בין ${inputs.chosenMove} ל-${inputs.bestMove}?`;
}
