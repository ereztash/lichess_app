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

/**
 * What each step is called on screen, in a chess player's words rather than the loop's.
 *
 * THE STEPS THEMSELVES DO NOT MOVE. `LoopStep` is still record -> detect -> drill -> grade, and
 * every rule that reads it is untouched; this is the label, and only the label. A player does not
 * need to learn that the product calls their moves "רישום" before it will tell them where they are.
 *
 * "תשובה" RATHER THAN A FINISH LINE. The four are not a progress bar and not every record reaches
 * a pattern -- `loopPosition` has a state that says so in as many words, and it is a result rather
 * than a failure to advance.
 */
export const STEP_LABELS: Record<LoopStep, string> = {
  record: "מהלכים",
  detect: "מה חוזר",
  drill: "בדיקה",
  grade: "תשובה",
};

export type ClaimGrade = "hypothesis" | "replicated" | "refuted";

export interface LoopInputs {
  /** A drill is running right now, and its progress. */
  drill: { completed: number; total: number } | null;
  /** Decisions on the record, and how many of them this reading is computed over. */
  recorded: number;
  scored: number;
  /**
   * The two reasons the rest are not in `scored`, taken from the record rather than subtracted.
   *
   * THIS USED TO BE `Math.max(0, recorded - scored)` AND THE SENTENCE IT FED WAS FALSE. The
   * difference is not one thing: some of those decisions are waiting for the engine, and the
   * rest were revealed on positions where the confidence question was never put, so nothing will
   * ever score them. Walked in Chromium from an empty profile -- one decision, revealed, engine
   * verdict in the store -- and the strip said "1 כבר רשומות וממתינות לחשיפה" nine seconds after
   * the reveal had rendered on screen.
   *
   * Under a sampled ask rule the second group is most of the record, so this is not an edge:
   * it is the ordinary state of every player's strip.
   */
  awaitingReveal: number;
  withoutConfidence: number;
  /**
   * Decisions the record holds that this reading does not cover, because another one does.
   *
   * A bank answer, a drill, a transfer check, an imported position. The evidence policy files
   * them `separate` rather than `refused` -- readable under their own heading with their own
   * denominator -- and the strip has to say so, because otherwise the arithmetic on screen has a
   * hole in it: one decision recorded, none measured, and no reason given for the difference.
   *
   * It became visible the day the front door started handing cold arrivals a bank position. Until
   * then every decision a newcomer could make was free play, so this was always zero.
   */
  readElsewhere: number;
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

/**
 * A surface that already owns something the headline names.
 *
 * The headline says "ייבוא משחקים שכבר שיחקת יכול לקצר את זה" and, until this existed, there was
 * no way to act on that from where it was read: the import lived in the tool rail, four controls
 * down, with nothing connecting the sentence to it. The rule the strip was built on -- "it carries
 * no action of its own, and leaves the doing to the surface that already owns it" -- was being
 * read as "and does not say where that surface is", which is a different and worse thing.
 *
 * So this is an ADDRESS, not an action. It opens the surface named in the sentence and stops
 * there; nothing is imported, no drill is started, and nothing here decides that this step is
 * worth more than another. `target` is a closed union precisely so a future headline cannot
 * invent a destination that no surface owns.
 */
export type LoopTarget = "import" | "claim";

export interface LoopAction {
  target: LoopTarget;
  /** Names the SURFACE, not the outcome: "ייבוא לפי שם משתמש", never "קצרו את ההמתנה". */
  label: string;
}

export interface LoopPosition {
  step: LoopStep;
  /** The one thing that advances the loop from here. Never an instruction to a control. */
  headline: string;
  /** What that is derived from. Rendered with it, never without (R1). */
  basis: string;
  /**
   * Where the sentence points, or null when it points at the board.
   *
   * Null is the common case and it is not a gap. "עוד 12 החלטות בסוג אחד" and "אין דפוס מעל הסף"
   * are both answered by deciding on the position already in front of you, and a link to the
   * board you are looking at would be furniture.
   */
  action: LoopAction | null;
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
  const {
    drill,
    recorded,
    scored,
    claimGrade,
    scoredStillNeeded,
    narrowedTo,
    awaitingReveal: awaiting,
    withoutConfidence,
    readElsewhere,
  } = inputs;

  if (drill) {
    return {
      step: "drill",
      headline:
        drill.completed >= drill.total
          ? "הדריל הושלם. הפסק נמדד מול התנאי שנשמר לפניו."
          : `דריל בעיצומו — ${drill.completed} מתוך ${drill.total} עמדות.`,
      basis: `${drill.completed}/${drill.total} עמדות דריל`,
      // No address: the drill runner is the surface, and it is what you are looking at.
      action: null,
    };
  }

  if (claimGrade === "hypothesis") {
    return {
      step: "drill",
      headline: "יש השערה. דריל הוא הדבר היחיד שיכול לדרג אותה.",
      basis: `${scored} החלטות שנמדדו · השערה אחת פתוחה`,
      /*
       * `ClaimPanel` renders the only control that can start a drill, and it needs the claim_id
       * to do it -- which is why this is an address and not a button that runs one. On a phone
       * the panel is below the board; on a wide screen it is in the right column and may still
       * be scrolled past. Either way the sentence now says where it is.
       */
      action: { target: "claim", label: "לוח הדפוסים" },
    };
  }

  if (claimGrade === "replicated" || claimGrade === "refuted") {
    return {
      step: "grade",
      headline:
        claimGrade === "refuted"
          ? "הטענה הופרכה ונשמרת. היא לא נבדקת שוב."
          : "הטענה שרדה דריל. עוד החלטות יכולות להוליד את הבאה.",
      basis: `${scored} החלטות שנמדדו · טענה מדורגת`,
      // A grade is an outcome. There is no surface that changes it, so there is no address.
      action: null,
    };
  }

  // No claim. The record layer says why -- either the floor is not met, or it is and nothing
  // cleared the detector's threshold. Those are different states and must not render alike.
  if (scoredStillNeeded === null) {
    return {
      step: "record",
      headline: "לא ניתן לקרוא את הרשומה, ולכן לא ידוע מה המרחק לדפוס.",
      basis: "שכבת הרשומה לא נענתה",
      // Sending the player somewhere would imply the destination can fix this. It cannot.
      action: null,
    };
  }

  if (scoredStillNeeded > 0) {
    /*
     * TWO SENTENCES BECAUSE THERE ARE TWO STATES, and folding them was the defect.
     *
     * A decision waiting for the engine is a wait: it ends by itself, and saying so is useful.
     * A decision recorded where the confidence question was not put is not waiting for anything,
     * and telling the player it is describes a problem they cannot act on -- while hiding the one
     * they can, which is that the floor is counted in a unit that only some decisions reach.
     *
     * The second sentence says WHY rather than how many are left, because how many are left
     * depends on a draw and the product does not know it in advance. What it does know is the
     * rule, and the rule is what makes the number on the left of it interpretable.
     */
    const waiting = awaiting > 0 ? ` ${awaiting} כבר רשומות וממתינות לחשיפה.` : "";
    const passed =
      withoutConfidence > 0
        ? ` ${withoutConfidence} נרשמו בעמדות שבהן לא נשאלה שאלת הביטחון, ולכן אינן נספרות כאן.`
        : "";
    /* Not a loss and not a wait: they are counted, under another heading, with their own
       denominator. Saying nothing about them leaves a hole in the arithmetic on screen. */
    const elsewhere =
      readElsewhere > 0
        ? ` ${readElsewhere} נמדדו ונקראות בחלק אחר של הרשומה — הסט המשותף, תרגול או משחקים שיובאו.`
        : "";

    if (narrowedTo) {
      /*
       * A narrowed search is a DIFFERENT wait, not a shorter number in the same sentence: it is
       * counted from the import onward and it is about one bucket. Saying "another 12 decisions"
       * without saying which 12 count would leave the player measuring against the whole record.
       */
      return {
        step: "record",
        headline: `עוד ${scoredStillNeeded} החלטות מדודות שנרשמו אחרי הייבוא, בסוג אחד — ${narrowedTo}.${waiting}${passed}${elsewhere}`,
        basis: `${scored} החלטות שנמדדו ברשומה · החיפוש מצומצם`,
        /*
         * Nowhere to send anyone. An import has already narrowed the search, so the one thing
         * that closes this gap is deciding on the position on screen -- and a second import
         * cannot narrow what is already narrowed.
         */
        action: null,
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
        `עוד ${scoredStillNeeded} החלטות מדודות עד שאפשר לומר משהו.${waiting}${passed}${elsewhere} ` +
        `ייבוא משחקים שכבר שיחקת יכול לקצר את זה — אם יימצא בהם סוג אחד שנבדל מהשאר.`,
      basis: `${scored} נמדדו מתוך ${recorded} שנרשמו`,
      /*
       * The only headline that names a surface out loud, and the reason this field exists: it
       * said an import can shorten the wait while the import sat four controls away in the tool
       * rail with nothing linking the two.
       */
      action: { target: "import", label: "ייבוא לפי שם משתמש" },
    };
  }

  return {
    step: "detect",
    headline: "יש מספיק החלטות, ואף דפוס לא עבר את הסף. זו תשובה ולא שתיקה.",
    basis: `${scored} החלטות שנמדדו · אין דפוס מעל הסף`,
    // An answer, not a queue. More decisions may change it, and those are taken on the board.
    action: null,
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
