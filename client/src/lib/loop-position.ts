/**
 * Where you are in the loop, and the one thing that moves you along it.
 *
 * This is the ranking mechanism ported from MATI's home screen, not its card. The card itself
 * would have been this app's THIRD place saying the same sentence: the commitment submit already
 * names what is missing, the header already offers the next decision once one is revealed, the
 * claim panel already offers the drill and already states the distance, and the drill runner
 * already counts its own positions. A fourth copy of any of those is the dashboard the product
 * exists to not be.
 *
 * What is genuinely absent is the ranking those surfaces imply and none of them states: which
 * one matters right now. Five tool-rail buttons, a commitment screen and a claim panel all
 * render at the same weight, and during a reveal nothing on screen says where in the loop you
 * are at all.
 *
 * So this carries no action of its own. It answers one question -- record, detect, drill, grade:
 * which of those is live, and what stands between here and the next one -- and it leaves the
 * doing to the surface that already owns it. When the distance is not knowable it says so rather
 * than estimating; section 4.5 applies here as everywhere else.
 */

/** The four steps of the loop, in the order the README draws them. */
export const LOOP_STEPS = ["record", "detect", "drill", "grade"] as const;
export type LoopStep = (typeof LOOP_STEPS)[number];

export const STEP_LABELS: Record<LoopStep, string> = {
  record: "רישום",
  detect: "דפוס",
  drill: "דריל",
  grade: "דירוג",
};

export type ClaimGrade = "hypothesis" | "replicated" | "refuted";

export interface LoopInputs {
  /** A drill is running right now, and its progress. */
  drill: { completed: number; total: number } | null;
  /** Decisions on the record, and how many of them the engine has answered. */
  recorded: number;
  scored: number;
  /** The grade of the claim currently on offer, or null when there is no claim. */
  claimGrade: ClaimGrade | null;
  /**
   * Revealed decisions still needed before a claim is possible, or null when the record layer
   * could not be read. Zero means the floor is met and no pattern cleared the threshold.
   */
  scoredStillNeeded: number | null;
}

export interface LoopPosition {
  step: LoopStep;
  /** The one thing that advances the loop from here. Never an instruction to a control. */
  headline: string;
  /** What that is derived from. Rendered with it, never without (R1). */
  basis: string;
}

/**
 * Which step is live, and what moves it.
 *
 * Ordered by what is actually happening rather than by how far along the record is: a drill in
 * progress outranks everything, because it is the only evidence that postdates a claim and the
 * only thing that can change a grade.
 */
export function loopPosition(inputs: LoopInputs): LoopPosition {
  const { drill, recorded, scored, claimGrade, scoredStillNeeded } = inputs;
  const awaiting = Math.max(0, recorded - scored);

  if (drill) {
    return {
      step: "drill",
      headline:
        drill.completed >= drill.total
          ? "הדריל הושלם. הפסק נמדד מול התנאי שנשמר לפניו."
          : `דריל בעיצומו — ${drill.completed} מתוך ${drill.total} עמדות.`,
      basis: `${drill.completed}/${drill.total} עמדות דריל`,
    };
  }

  if (claimGrade === "hypothesis") {
    return {
      step: "drill",
      headline: "יש השערה. דריל הוא הדבר היחיד שיכול לדרג אותה.",
      basis: `${scored} החלטות חשופות · השערה אחת פתוחה`,
    };
  }

  if (claimGrade === "replicated" || claimGrade === "refuted") {
    return {
      step: "grade",
      headline:
        claimGrade === "refuted"
          ? "הטענה הופרכה ונשמרת. היא לא נבדקת שוב."
          : "הטענה שרדה דריל. עוד החלטות יכולות להוליד את הבאה.",
      basis: `${scored} החלטות חשופות · טענה מדורגת`,
    };
  }

  // No claim. The record layer says why -- either the floor is not met, or it is and nothing
  // cleared the detector's threshold. Those are different states and must not render alike.
  if (scoredStillNeeded === null) {
    return {
      step: "record",
      headline: "לא ניתן לקרוא את הרשומה, ולכן לא ידוע מה המרחק לדפוס.",
      basis: "שכבת הרשומה לא נענתה",
    };
  }

  if (scoredStillNeeded > 0) {
    return {
      step: "record",
      headline:
        awaiting > 0
          ? `עוד ${scoredStillNeeded} החלטות חשופות עד שאפשר לומר משהו. ${awaiting} כבר רשומות וממתינות לחשיפה.`
          : `עוד ${scoredStillNeeded} החלטות חשופות עד שאפשר לומר משהו.`,
      basis: `${scored} חשופות מתוך ${recorded} רשומות`,
    };
  }

  return {
    step: "detect",
    headline: "יש מספיק החלטות, ואף דפוס לא עבר את הסף. זו תשובה ולא שתיקה.",
    basis: `${scored} החלטות חשופות · אין דפוס מעל הסף`,
  };
}

/** How each step renders in the strip: done, live, or not reached. */
export function stepStates(
  step: LoopStep,
): Array<{ step: LoopStep; state: "done" | "live" | "ahead" }> {
  const current = LOOP_STEPS.indexOf(step);
  return LOOP_STEPS.map((candidate, index) => ({
    step: candidate,
    state: index < current ? "done" : index === current ? "live" : "ahead",
  }));
}
