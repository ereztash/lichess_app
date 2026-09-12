/**
 * Where each thing the product is learning about you actually stands.
 *
 * WHY THIS IS NOT `loop-position.ts`. That file answers ONE question -- which of record, detect,
 * drill, grade is live RIGHT NOW -- and it answers it with a single position because "what should I
 * do next" is singular by nature. This answers a different question, "what has this product
 * learned about me and how far has each of those things got", and that one is PLURAL: a player can
 * hold several learning rules at once, each with its own grade, its own retrieval step and its own
 * due date, and no single position can carry them without electing a winner nobody chose.
 *
 * Checked at head rather than assumed, because two peers argued the stronger version of this and
 * only half of it survives. `currentClaim` returns `claim: Claim | null` TOGETHER WITH
 * `othersWithheld: number`, so for claims the reduction to one is deliberate and its rule is
 * already named on screen. `learningRules` returns an array. The cardinality mismatch is real
 * exactly where transfer lives, and nowhere else.
 *
 * THE THREE SEPARATIONS THIS FILE EXISTS TO HOLD.
 *
 * 1. PRACTISED, PROMPTED_CHECK and WATCHED_IN_PLAY are three different constructs and never one
 *    number. The transfer literature names the last two: MAXIMUM transfer is what a learner can do
 *    when they are prompted to show it, TYPICAL transfer is what they do when nobody prompts them.
 *    `beginLearningTransfer` hands the player their own rule and three positions chosen to test it,
 *    which is the prompted one. The product called that "transfer", and a pass was shown as
 *    evidence that the thing was working.
 *
 * 2. The instrument's silence is not the player's flatness. The six-bucket detector reports
 *    `not-separable` on the owner's whole 2,209-game record, while a frozen research pipeline finds
 *    a residual on that same record that survives its own within-game permutation null. Any
 *    sentence about finding nothing is a sentence about THE DETECTOR.
 *
 * 3. A goal is not a denominator, and that has to be enforced rather than intended -- see
 *    `shared/goal.ts` and `GATE-GOAL-NOT-A-DENOMINATOR`.
 *
 * WHAT IS DELIBERATELY ABSENT. There is no OUTCOME stage. External rating is an observed series
 * with no edge into this machine: attributing it would need a CAUSALITY claim that the research
 * states is unreachable by this pipeline under any result. A named empty OUTCOME state would be a
 * place for that claim to accumulate, so it does not exist.
 */

import { MIN_BUCKET_N } from "./detector.js";
import type { LearningRule } from "./learning-record.js";
import { RETRIEVAL_INTERVAL_DAYS, TRANSFER_POSITION_COUNT } from "./learning-record.js";

/**
 * The stages, in the order the machine draws them.
 *
 * `REFUTED` and `RETIRED` are terminals and are not "further along" than the others: a refuted rule
 * is a result, and the ordering here is the path, not a ranking.
 */
export const JOURNEY_STAGES = [
  "ACCUMULATING",
  "NOTHING_SEPARATED",
  "CANDIDATE",
  "CONTEXT_CHECKED",
  "PRACTISED",
  "PROMPTED_CHECK",
  "WATCHED_IN_PLAY",
  "REFUTED",
  "RETIRED",
] as const;
export type JourneyStage = (typeof JOURNEY_STAGES)[number];

/**
 * A count that cannot be rendered without saying what it counts.
 *
 * `of` IS NULLABLE AND THAT IS NOT A GAP. Some constructs have a floor to compare against (drill
 * positions, transfer successes) and some are simply a count of what happened (decisions judged).
 * A null `of` renders as "N X", never as "N/0" and never as a bare number with an implied whole.
 */
export interface JourneyCount {
  /** What this number is a number OF. Never omitted, never shared between two constructs. */
  construct: string;
  n: number;
  /** The denominator, or null when the construct is a plain count with no whole. */
  of: number | null;
}

export interface JourneyReading {
  stage: JourneyStage;
  /** What this stage answers, in the player's words. */
  question: string;
  count: JourneyCount;
  /**
   * What the product will do next, and what that will then let it say.
   *
   * THIS IS THE ONLY PRESCRIPTION THE EVIDENCE LICENSES. Not "do this and you will improve", which
   * needs an efficacy claim the research says is unreachable, but "here is what this product will
   * do with you next, and what it will then be able to say" -- a statement about the product's own
   * behaviour, which OWNER can resolve and which asserts nothing about the player's future.
   */
  next: string;
  /**
   * What this stage does NOT establish. Rendered with it, never dropped.
   */
  notEstablished: string;
}

/** Inputs for one learning rule's reading. All of it is already on the record. */
export interface RuleJourneyInputs {
  rule: Pick<LearningRule, "grade" | "retrieval_step" | "created_at">;
  /** Drill positions completed against the claim this rule came from, and how many were asked. */
  drill: { completed: number; total: number } | null;
  /**
   * How many delayed retrieval sittings this rule has completed, or null when none has.
   *
   * SITTINGS AND NOT POSITIONS PASSED, and the difference is a construct error I made and caught.
   * `retrieval_step` is an INDEX INTO THE SCHEDULE: `gradeLearningRule` advances it on every
   * completed sitting, pass or fail, and a rule is refuted only after two failed DAYS. Rendering it
   * as "2 of 3 positions passed" would be a number about the calendar wearing the label of a number
   * about performance, which is precisely the collapse this whole file exists to refuse.
   *
   * So the construct is the count of checks that have happened. Whether they went well is carried
   * by `rule.grade`, which has its own terminals, and is not folded into this figure.
   */
  promptedSittings: number | null;
  /**
   * Ordinary free-play decisions in this rule's scope, split at the moment the rule was written.
   *
   * NOT A TEST OF THE RULE, and the reading says so. Nothing here knows whether the rule's trigger
   * was actually present in any of these positions -- the trigger is free text the player wrote.
   * What it knows is the class of decision the rule is about, which is the same bucket vocabulary
   * the detector already uses, and how the player did in it on either side of the line.
   */
  inScope: { before: number; after: number } | null;
}

/**
 * The floor for the unprompted reading, reused rather than invented.
 *
 * A FRESH CONSTANT HERE WOULD BE A SECOND ANSWER TO A QUESTION THE REPOSITORY HAS ALREADY ANSWERED.
 * `MIN_BUCKET_N` is what every other split in this product needs on each side before it may be
 * read, and a before/after split is a split.
 */
export const UNPROMPTED_FLOOR = MIN_BUCKET_N;

export function ruleJourney(input: RuleJourneyInputs): JourneyReading {
  const { rule, drill, promptedSittings, inScope } = input;

  if (rule.grade === "retired") {
    return {
      stage: "RETIRED",
      question: "סגרתי את זה?",
      count: { construct: "כלל שנסגר", n: 1, of: null },
      next: "הכלל לא נבדק יותר. אפשר לנסח כלל חדש אחרי חשיפה.",
      notEstablished: "סגירה היא החלטה שלכם, לא תוצאה של מדידה.",
    };
  }

  if (rule.grade === "refuted") {
    return {
      stage: "REFUTED",
      question: "תנאי ההפרכה שכתבתי התקיים?",
      count: { construct: "תנאי הפרכה שהתקיים", n: 1, of: null },
      next: "הכלל נשמר כמו שהוא ולא נבדק שוב. מה שנלמד כאן הוא שהניסוח לא החזיק.",
      notEstablished: "הפרכה של הכלל לא אומרת שהתיאור של הבעיה היה שגוי.",
    };
  }

  /*
   * THE UNPROMPTED READING IS CHECKED BEFORE THE PROMPTED ONE, and the order is the whole point.
   *
   * A rule that passed its retrieval test and has also been watched in ordinary play is further
   * along than one that only passed the test, because the test tells you what the player CAN do
   * when reminded and ordinary play tells you what they DO when nobody reminds them. Reading them
   * in the other order would let a prompted pass stand as the last word.
   */
  if (inScope && inScope.before >= UNPROMPTED_FLOOR && inScope.after >= UNPROMPTED_FLOOR) {
    return {
      stage: "WATCHED_IN_PLAY",
      question: "אני עושה את זה גם כשאף אחד לא מזכיר לי?",
      count: {
        construct: "החלטות חופשיות בסוג הזה מאז שכתבתם את הכלל",
        n: inScope.after,
        of: null,
      },
      next: `הספירה נמשכת. ${inScope.before} החלטות באותו סוג נרשמו לפני הכלל, וזו הצלע השנייה של ההשוואה.`,
      notEstablished:
        "אף אחד כאן לא יודע אם התנאי שכתבתם באמת היה על הלוח באחת מההחלטות האלה, ושום הפרש בין לפני לאחרי לא מיוחס לכלל.",
    };
  }

  if (promptedSittings !== null && promptedSittings > 0) {
    return {
      stage: "PROMPTED_CHECK",
      question: "אני מצליח את זה כשמזכירים לי, אחרי כמה ימים?",
      count: {
        construct: `בדיקות חוזרות שנסתיימו, ${TRANSFER_POSITION_COUNT} עמדות בכל אחת`,
        n: promptedSittings,
        of: null,
      },
      next: unpromptedNext(inScope),
      notEstablished:
        "בדיקה עם תזכורת מודדת מה אפשר לעשות כשמזכירים, לא מה קורה במשחק רגיל בלי תזכורת. המספר הזה סופר כמה בדיקות נעשו, לא כמה מהן עברו.",
    };
  }

  if (drill) {
    return {
      stage: "PRACTISED",
      question: "אני מצליח את זה כשנותנים לי את העמדה ביד?",
      count: { construct: "עמדות דריל שהושלמו", n: drill.completed, of: drill.total },
      next: `הבדיקה הבאה נפתחת בעוד ${daysUntilNextRetrieval(rule.retrieval_step)} ימים, בלי העמדות האלה, ותגיד אם זה נשאר.`,
      notEstablished: "הצלחה בדריל היא הצלחה על עמדות שהוגשו לכם. היא לא מדידה של משחק רגיל.",
    };
  }

  return {
    stage: "CONTEXT_CHECKED",
    question: "מה בדיוק אני מנסה לשנות?",
    count: { construct: "כלל אחד שניסחתם", n: 1, of: null },
    next: "דריל על עמדות מאותו סוג הוא הדבר הבא, ואחריו בדיקה עם תזכורת.",
    notEstablished: "כלל שנוסח הוא תיאור שלכם. עוד לא נמדד עליו כלום.",
  };
}

function unpromptedNext(inScope: RuleJourneyInputs["inScope"]): string {
  if (!inScope) return "מכאן נספרות ההחלטות החופשיות בסוג הזה, בלי תזכורת.";
  const missing = Math.max(
    0,
    UNPROMPTED_FLOOR - Math.min(inScope.before, inScope.after),
  );
  return missing === 0
    ? "יש מספיק החלטות חופשיות משני צדי הקו, והספירה נקראת."
    : `עוד ${missing} החלטות חופשיות בסוג הזה בצד הדל מבין השניים, ואז יש שתי ספירות להעמיד זו מול זו.`;
}

/**
 * Days to the next delayed retrieval, from the rule's own step.
 *
 * READ FROM `RETRIEVAL_INTERVAL_DAYS` RATHER THAN RESTATED. The schedule is one fact and it already
 * lives in `learning-record.ts`; a second copy here would drift the day the intervals change.
 */
function daysUntilNextRetrieval(step: number): number {
  return RETRIEVAL_INTERVAL_DAYS[Math.min(step, RETRIEVAL_INTERVAL_DAYS.length - 1)];
}

/**
 * The record's own stage, before any rule exists.
 *
 * `NOTHING_SEPARATED` IS A STATEMENT ABOUT THE DETECTOR AND THE WORDING SAYS SO. The sentence this
 * replaces read "there are enough decisions and no pattern cleared the threshold", which a player
 * reads as a fact about themselves. The six-bucket detector returns `not-separable` on a 2,209-game
 * record where a frozen research pipeline finds a residual that survives its own permutation null,
 * so "nothing was found" is a property of what this product is looking with.
 */
export function recordJourney(input: {
  /** Revealed decisions the SEARCH counts. Not the same number as the dashboard's `n`. */
  scored: number;
  hasClaim: boolean;
  othersWithheld: number;
  /**
   * Decisions the record holds that this search does not count, because another reading does.
   *
   * CARRIED BECAUSE THE SCREEN SHOWED TWO NUMBERS FOR ONE SENTENCE. Found by looking at the frame
   * rather than by a test: the ledger read "0 of 60 measured decisions" directly beneath a
   * dashboard reading `n=1`, on a record holding exactly one decision. Both were true. `scored` is
   * the discovery population -- free play and nothing else -- and a decision from the shared bank
   * is filed `separate`, counted under its own heading with its own denominator.
   *
   * `loopPosition` had already met this and fixed it by giving the two registers different verbs:
   * `נמדדו` stays with decisions that were measured, `נספרות` with what a particular search counts.
   * This is the same repair in the same words, because a second vocabulary for one distinction is
   * how the distinction gets lost.
   */
  readElsewhere: number;
}): JourneyReading {
  const floor = MIN_BUCKET_N * 2;
  /*
   * SINGULAR AND PLURAL ARE DIFFERENT SENTENCES IN HEBREW, and "1 החלטות" is not a thing anyone
   * says. The first record a player has is exactly the one-decision case, so the ungrammatical
   * branch is the one every new player would have read.
   */
  const elsewhere =
    input.readElsewhere === 0
      ? ""
      : input.readElsewhere === 1
        ? " החלטה אחת נמדדה ונקראת בחלק אחר של ההיסטוריה, עם מכנה משלה."
        : ` ${input.readElsewhere} החלטות נמדדו ונקראות בחלק אחר של ההיסטוריה, עם מכנה משלהן.`;
  if (input.hasClaim) {
    return {
      stage: "CANDIDATE",
      question: "מה נמצא?",
      count: { construct: "החלטות שהחיפוש הזה סופר", n: input.scored, of: null },
      next:
        (input.othersWithheld > 0
          ? `אפשר לנסח כלל ולבדוק אותו בדריל. ${input.othersWithheld} מועמדים נוספים לא מוצגים.`
          : "אפשר לנסח כלל ולבדוק אותו בדריל.") + elsewhere,
      notEstablished:
        "הפרדה בין שני סוגי החלטות היא תיאור של ההיסטוריה הזו. היא לא אומרת שזה מה שמייחד אתכם משחקנים אחרים.",
    };
  }
  if (input.scored >= floor) {
    return {
      stage: "NOTHING_SEPARATED",
      question: "המכשיר הזה מצא משהו?",
      count: { construct: "החלטות שהחיפוש הזה סופר", n: input.scored, of: null },
      next: "אפשר להמשיך לשחק. אותם שישה סוגים ייבדקו שוב עם כל החלטה שנוספת." + elsewhere,
      notEstablished:
        "שישה הסוגים האלה הם מה שהמכשיר הזה יודע לחפש. שהוא לא הפריד ביניהם לא אומר שאין מה למצוא בכם, אלא שהוא לא מצא.",
    };
  }
  return {
    stage: "ACCUMULATING",
    question: "מה אנחנו מנסים ללמוד עליי עכשיו?",
    count: { construct: "החלטות שהחיפוש הזה סופר", n: input.scored, of: floor },
    next: `מ-${floor} כאלה אפשר להריץ את החיפוש. עד אז כל החלטה נספרת ואף אחת לא נקראת.` + elsewhere,
    notEstablished: "מתחת לרצפה הזו כל הפרדה שתימצא היא רעש, ולכן לא מוצגת.",
  };
}
