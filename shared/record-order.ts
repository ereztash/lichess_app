/**
 * THE RECORD, ORDERED BY WHAT IT IS WORTH TO A DECISION (§25).
 *
 * WHAT THE PAGE DOES NOW: a calibration decomposition, six bucket rows, a discrimination area, an
 * effort correlation, a split-half check, a reliability chart and a claim card. Every one of them
 * is true. `OutcomeSummary` was added because a returning player could not answer "did this find
 * anything about me" without assembling it from all of that, and it answers the first of §25's four
 * questions. This module answers the second and the third:
 *
 *     הדבר הכי ברור כרגע    `outcomeSummary`, which already exists
 *     מה עדיין לא ברור      `whatIsUnclear`
 *     מה נבדק עכשיו         `whatIsUnderTest`
 *     כל הנתונים            the dashboard, unchanged, underneath
 *
 * "WHAT IS STILL UNCLEAR" IS NOT AN EMPTY-STATE MESSAGE. It is the most common true statement this
 * product can make -- the M0 audit measured the chain as silent on most records most of the time --
 * and it is currently scattered across the page as individual cells reading "not enough data",
 * each in its own panel, with no way to tell which of them a player can do something about.
 *
 * SO EVERY ITEM CARRIES `waitingHelps`, WHICH IS THE FIELD THAT MAKES THE SECTION USABLE. A bucket
 * eight decisions short of readable and a bucket over a record that holds no clock at all both
 * render as "cannot be read"; one of them is a wait and the other is a dead end, and telling a
 * player to keep playing to fix the second is advice that cannot work. `BucketReading` has carried
 * `unmeasurableReason` for exactly this distinction and nothing had ever read it.
 *
 * NOTHING HERE IS A RATE, AND NOTHING HERE IS PROSE. Each item is a named cause plus a count, so a
 * screen can sort them, count them, and say them in its own words -- and so a test can assert that
 * a dead end is reported as one without matching on a sentence.
 */
import { MIN_BUCKET_N } from "./detector.js";
import { MIN_STABILITY_HALF } from "./stability.js";
import type { RecordReading } from "./record-dashboard.js";
import type { Claim } from "./claim.js";
import { authorityOfClaim, type EvidenceAuthority } from "./evidence-authority.js";

/**
 * WHY SOMETHING CANNOT BE READ. Seven causes, and they are not interchangeable.
 *
 *   too-few-in-bucket        one side of a split is under the floor. A wait, with a number.
 *   no-clock-recorded        the record holds no clock, so a clock bucket can never fill. Not a
 *                            wait: a local game against an engine has no clock, and a Lichess
 *                            export carries none unless the exporter ticked the option.
 *   no-population-baseline   nobody measured a baseline for this bucket, so the figure is a fact
 *                            about chess said in the second person. More play does not fix it.
 *   too-few-accurate         the discrimination area needs both outcomes. This player needs
 *                            HARDER positions, not more of them.
 *   too-few-inaccurate       the mirror, and the far commoner one.
 *   effort-never-varied      the control reading needs the think times or the confidences to
 *                            vary. A player who spends the same time on everything is telling the
 *                            instrument something, and it is not a shortage.
 *   halves-too-short         the split-half check needs two halves above its own floor.
 */
export const UNCLEAR_CAUSES = [
  "too-few-in-bucket",
  "no-clock-recorded",
  "no-population-baseline",
  "too-few-accurate",
  "too-few-inaccurate",
  "effort-never-varied",
  "halves-too-short",
] as const;
export type UnclearCause = (typeof UNCLEAR_CAUSES)[number];

/** Whether more decisions are the answer. Written down once, here, rather than judged per screen. */
export const WAITING_HELPS: Readonly<Record<UnclearCause, boolean>> = {
  "too-few-in-bucket": true,
  "no-clock-recorded": false,
  "no-population-baseline": false,
  /*
   * TRUE, AND ONLY JUST. More decisions do raise the smaller class eventually -- but a player whose
   * record is 96% accurate needs harder positions far more than more of the same, and the sentence
   * a screen writes for these two should say so. The flag answers "will playing on change this",
   * which it will; the cause is what carries the rest.
   */
  "too-few-accurate": true,
  "too-few-inaccurate": true,
  "effort-never-varied": false,
  "halves-too-short": true,
};

/**
 * WHY EACH CAUSE HOLDS, in words a screen can put up without rewriting them.
 *
 * BESIDE THE CAUSES RATHER THAN IN A WORDS MODULE, the way `BLITZ_EXCLUSION_REASON` sits beside
 * `BLITZ_EXCLUSIONS`. A cause and its sentence are one fact; splitting them across two files means
 * a seventh cause can be added without anybody noticing there is no sentence for it.
 *
 * EACH SENTENCE SAYS WHAT IS MISSING, NEVER WHAT THE PLAYER SHOULD FEEL ABOUT IT. "Not enough
 * decisions" is a fact; "keep going, you are nearly there" is a countdown to a locked thing, which
 * is the mechanic this product refuses. The count travels beside the sentence, from `needs`, so
 * the sentence itself carries no number that could go stale.
 */
export const UNCLEAR_SENTENCE: Readonly<Record<UnclearCause, string>> = {
  "too-few-in-bucket": "צד אחד של החלוקה עוד לא הגיע למספר שממנו אפשר להעריך שגיאה.",
  "no-clock-recorded":
    "לא נשמר שעון בהחלטות האלה, ולכן החלוקה הזאת לא תתמלא — לא משנה כמה עוד תשחק.",
  "no-population-baseline":
    "אין לנו מדידה של אנשים אחרים בחלוקה הזאת, ולכן המספר הוא עובדה על שחמט ולא עליך.",
  "too-few-accurate":
    "כמעט כל ההחלטות כאן היו לא מדויקות, ולהשוואה צריך גם וגם. זה אומר עמדות אחרות, לא עוד מאותן.",
  "too-few-inaccurate":
    "כמעט כל ההחלטות כאן היו מדויקות, ולהשוואה צריך גם וגם. זה אומר עמדות קשות יותר, לא עוד מאותן.",
  "effort-never-varied":
    "זמן החשיבה או הביטחון לא השתנו בין ההחלטות, ובלי שינוי אין מה להשוות מולו.",
  "halves-too-short": "אין מספיק החלטות כדי לחלק את הרשומה לשתי מחציות ולהשוות ביניהן.",
};

export interface Unclear {
  /** What cannot be read, in the record's own words for it. */
  what: string;
  because: UnclearCause;
  /**
   * How many more decisions the blocked side needs, or null when a count is not the blocker.
   *
   * NULL IS NOT ZERO AND IS NOT UNKNOWN. It means the question "how many more" does not apply --
   * a bucket over a record with no clock is not eight decisions away from anything.
   */
  needs: number | null;
  waitingHelps: boolean;
}

/**
 * EVERYTHING THE RECORD CANNOT YET SAY, nearest first.
 *
 * ORDERED BY WHAT THE READER CAN DO ABOUT IT: waits before dead ends, and within the waits, fewest
 * decisions first. That ordering is a fact about the record and not a judgement about importance --
 * it cannot prefer the item that flatters the product, because it never looks at an outcome.
 *
 * TIES BROKEN BY `what`, so the same record always produces the same page. A section that reordered
 * itself between two loads of an unchanged record would teach a player that the product's
 * statements are weather.
 */
export function whatIsUnclear(reading: RecordReading): Unclear[] {
  const items: Unclear[] = [];

  for (const bucket of reading.buckets) {
    if (!bucket.measurable) {
      const because: UnclearCause =
        bucket.unmeasurableReason === "no-clock-data" ? "no-clock-recorded" : "too-few-in-bucket";
      items.push({
        what: bucket.scope,
        because,
        /*
         * `shortBy` IS THE RECORD'S OWN NUMBER, not a subtraction done here. It is computed where
         * the split is, against the same floor the split is judged by, and re-deriving it would be
         * a second definition of "how far short" that could disagree with the panel beside it.
         */
        needs: because === "too-few-in-bucket" ? bucket.shortBy : null,
        waitingHelps: WAITING_HELPS[because],
      });
      continue;
    }
    if (bucket.versusPopulation === null) {
      /*
       * READABLE, AND NOT COMPARABLE. The split can be measured; what it cannot do is say whether
       * the number is about this player or about chess. `versusPopulation`'s own field note is
       * blunt about it -- the middlegame is 12.6 points less accurate for EVERYONE -- so a bucket
       * with no baseline is a figure that must not be read in the second person, and that is a
       * different kind of unclear from a bucket with too few rows.
       */
      items.push({
        what: bucket.scope,
        because: "no-population-baseline",
        needs: null,
        waitingHelps: false,
      });
    }
  }

  if (reading.sensitivity.reason === "too-few-accurate" || reading.sensitivity.reason === "too-few-both") {
    items.push({
      what: "האם הביטחון שלך מפריד בין החלטות מדויקות ללא מדויקות",
      because: "too-few-accurate",
      needs: null,
      waitingHelps: WAITING_HELPS["too-few-accurate"],
    });
  }
  if (reading.sensitivity.reason === "too-few-inaccurate" || reading.sensitivity.reason === "too-few-both") {
    items.push({
      what: "האם הביטחון שלך מפריד בין החלטות מדויקות ללא מדויקות",
      because: "too-few-inaccurate",
      needs: null,
      waitingHelps: WAITING_HELPS["too-few-inaccurate"],
    });
  }

  if (reading.control.reason === "flat-time" || reading.control.reason === "flat-confidence") {
    items.push({
      what: "האם המאמץ שלך הולך לאן שהספק הולך",
      because: "effort-never-varied",
      needs: null,
      waitingHelps: false,
    });
  }
  if (reading.control.reason === "too-few") {
    items.push({
      what: "האם המאמץ שלך הולך לאן שהספק הולך",
      because: "too-few-in-bucket",
      needs: null,
      waitingHelps: true,
    });
  }

  const [firstHalf, secondHalf] = reading.stability.n;
  if (Math.min(firstHalf, secondHalf) < MIN_STABILITY_HALF) {
    items.push({
      what: "האם הרשומה אומרת את אותו דבר בשתי המחציות שלה",
      because: "halves-too-short",
      /*
       * TWO HALVES, SO THE SHORTFALL IS COUNTED IN WHOLE DECISIONS AND DOUBLED. A record needs
       * `MIN_STABILITY_HALF` in EACH half, and decisions arrive into the record rather than into a
       * half -- so closing a five-decision gap in the smaller half takes about ten more decisions,
       * not five. Reporting five would be a promise the next five decisions cannot keep.
       */
      needs: (MIN_STABILITY_HALF - Math.min(firstHalf, secondHalf)) * 2,
      waitingHelps: true,
    });
  }

  return items.sort(
    (a, b) =>
      Number(b.waitingHelps) - Number(a.waitingHelps) ||
      (a.needs ?? Number.MAX_SAFE_INTEGER) - (b.needs ?? Number.MAX_SAFE_INTEGER) ||
      a.what.localeCompare(b.what) ||
      a.because.localeCompare(b.because),
  );
}

/** What the product has committed to checking, and how far in it is. */
export interface UnderTest {
  statement: string;
  scope: string;
  authority: EvidenceAuthority;
  /** Forward tests recorded against it so far. Zero is ordinary and is not a failure. */
  testsRecorded: number;
  /** What would end it the other way. Stored before the test ran (R5), and shown for that reason. */
  refutationCondition: string;
}

/**
 * WHAT IS BEING CHECKED RIGHT NOW, or null.
 *
 * ONLY A HYPOTHESIS. A settled claim -- tested or refuted -- is not under test, and putting it in
 * this section would answer §25's third question with something that had already been answered.
 * `gradeIsSettled` is not used here because the condition is narrower than "settled": a claim this
 * function will report is one whose grade is exactly `hypothesis`, which `authorityOfClaim` maps
 * to the `hypothesis` authority and nothing else can reach.
 *
 * THE REFUTATION CONDITION IS PART OF THE ANSWER, not a detail behind a disclosure. "What is being
 * tested" is not answered by naming the claim; it is answered by saying what result would end it,
 * which is the only thing that distinguishes a test from a search for confirmation. It is stored
 * before the test runs precisely so it can be shown while the test is running.
 */
export function whatIsUnderTest(claim: Claim | null | undefined): UnderTest | null {
  if (!claim || claim.grade !== "hypothesis") return null;
  return {
    statement: claim.statement,
    scope: claim.scope,
    authority: authorityOfClaim(claim),
    testsRecorded: claim.prospective_tests.length,
    refutationCondition: claim.refutation_condition,
  };
}

/** The floor a bucket is judged against, re-exported so a screen need not import the detector. */
export const UNCLEAR_BUCKET_FLOOR = MIN_BUCKET_N;
