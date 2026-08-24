import { MIN_BUCKET_N, PREREGISTERED_THRESHOLDS } from "@shared/detector";
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
   *
   * Under a narrowed search this must be counted from the REGISTRATION, against the narrowed
   * floor -- see `narrowedTo`. The caller computes it because only the caller knows which search
   * is running.
   */
  scoredStillNeeded: number | null;
  /**
   * The bucket a registered hypothesis narrowed the search to, or null for the ordinary scan.
   *
   * Present changes what the wait MEANS, not just its size: it is counted from the import
   * onward and it is about one named bucket. Absent means an import has not narrowed anything,
   * and that is the only state where offering one is honest.
   */
  narrowedTo: string | null;
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
/**
 * How many revealed decisions are still needed, measured against the search that is ACTUALLY
 * running.
 *
 * This lived inline in LoopStrip as `MIN_BUCKET_N * 2 - scored`, and that is wrong in two ways at
 * once once a registered hypothesis narrows the search: the floor is PREREGISTERED_MIN_BUCKET_N*2
 * rather than MIN_BUCKET_N*2, and the count is decisions recorded AFTER the import rather than the
 * whole record. The strip would have announced a 60-decision wait while `currentClaim` ran a
 * 40-decision one over a different set -- the screen contradicting the engine behind it, which is
 * the failure this codebase spends its gates on.
 *
 * `preregScored` is null exactly when the ordinary scan is running, and that is what selects the
 * pair. Both numbers must come from the same side of the boundary or the subtraction is meaningless.
 */
export function remainingBeforeClaim(input: {
  /** Whole-record revealed decisions. */
  scored: number;
  /** Revealed decisions recorded after the registration, or null when not narrowing. */
  preregScored: number | null;
  /** The record could not be read. Distance is unknown, not zero. */
  unreadable: boolean;
}): number | null {
  if (input.unreadable) return null;
  return input.preregScored !== null
    ? Math.max(0, PREREGISTERED_THRESHOLDS.minBucketN * 2 - input.preregScored)
    : Math.max(0, MIN_BUCKET_N * 2 - input.scored);
}

export function loopPosition(inputs: LoopInputs): LoopPosition {
  const { drill, recorded, scored, claimGrade, scoredStillNeeded, narrowedTo } = inputs;
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
    const waiting = awaiting > 0 ? ` ${awaiting} כבר רשומות וממתינות לחשיפה.` : "";

    if (narrowedTo) {
      /*
       * A narrowed search is a DIFFERENT wait, not a shorter number in the same sentence: it is
       * counted from the import onward and it is about one bucket. Saying "another 12 decisions"
       * without saying which 12 count would leave the player measuring against the whole record.
       */
      return {
        step: "record",
        headline: `עוד ${scoredStillNeeded} החלטות חשופות שנרשמו אחרי הייבוא, בדלי אחד — ${narrowedTo}.${waiting}`,
        basis: `${scored} חשופות ברשומה · החיפוש מצומצם`,
      };
    }

    /*
     * THE SHORTCUT, NAMED WHERE THE WAIT IS ANNOUNCED.
     *
     * The import can cut this floor from 60 to 40 by naming a bucket in advance, and until this
     * line existed nothing anywhere connected the two: the strip announced a 60-decision wait and
     * the button that shortens it sat in the tool rail with no reason to press it.
     *
     * Stated as a CONDITION, not a promise. An import only narrows anything when one of its
     * buckets is separable from the next by two standard errors, and most will not be. "can
     * shorten, if" is what shared/prereg.ts actually does; "will shorten" would be the product
     * promising an outcome it cannot know before the scan runs.
     */
    return {
      step: "record",
      headline:
        `עוד ${scoredStillNeeded} החלטות חשופות עד שאפשר לומר משהו.${waiting} ` +
        `ייבוא משחקים שכבר שיחקת יכול לקצר את זה — אם יימצא בהם דלי אחד שנבדל מהשאר.`,
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
