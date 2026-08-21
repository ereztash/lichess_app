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
/** Fewer own games than this in a position means the repertoire says nothing. */
export const THIN_REPERTOIRE = 5;

export interface RevealInputs {
  depth: number;
  cpLoss: number;
  chosenMove: string;
  bestMove: string;
  chosenWasBest: boolean;
  confidence: number;
  statedUnknown: string;
  cloudAvailable: boolean;
  /** Own games in this exact position, or null if the repertoire was never queried. */
  repertoireGames: number | null;
  /** Recorded decisions so far, including this one. */
  decisionsOnRecord: number;
}

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
  if (!inputs.cloudAvailable) {
    limits.push("אין הערכת ענן לעמדה הזו, כך שיש מקור מנוע אחד בלבד ואין לו במה להיבדק.");
  }
  if (inputs.repertoireGames !== null && inputs.repertoireGames < THIN_REPERTOIRE) {
    limits.push(
      `יש ${inputs.repertoireGames} משחקים שלך בעמדה הזו. הרפרטואר האישי לא אומר כאן כלום.`,
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
