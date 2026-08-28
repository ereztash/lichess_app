/**
 * What this product has actually produced for you, in at most three statements.
 *
 * THE PROBLEM IS NOT MISSING INFORMATION. The Record page already holds a calibration
 * decomposition, six bucket readings, a discrimination area with a reference class, an effort
 * correlation, a split-half check, a counterfactual reading, a profile of variables and their
 * crossings, and a claim with a grade. What it does not do is answer, in the first five seconds,
 * the question a returning player actually arrives with: *did this thing find anything about me,
 * and how much should I believe it?* Today that has to be reverse-engineered out of the
 * instrumentation.
 *
 * A PROJECTION, NOT A SOURCE OF TRUTH, and that is the whole design. Every statement below is
 * produced by an existing module and carries the name of that module in `source`. Nothing here
 * detects, scores, thresholds, ranks by predicted value, or decides what the player should work
 * on. If a sentence cannot name the object entitled to say it, it does not belong here -- and
 * `source` is a field rather than a comment so a test can hold that.
 *
 * WHAT IT REFUSES, EACH FOR A REASON THE REPOSITORY ALREADY ESTABLISHED:
 *
 *   - It never recomputes the distance to a claim. `remainingBeforeClaim` owns that, because the
 *     floor and the observation set BOTH change under a registered hypothesis (20 vs 30 per side,
 *     decisions-since-registration vs the whole record), and a second copy would announce a wait
 *     the detector is not running. It is called, never reimplemented.
 *   - It never turns the detector's contrast into an absolute. What cleared the separability bar
 *     is `inside gap - outside gap`; "confidence sits higher relative to the outcome than in the
 *     rest of this record" is what that supports, and it is NOT "you are overconfident here".
 *     The wording comes from ProfilePanel's own generator.
 *   - It never upgrades a grade. `GRADE_WORD` is the vocabulary; a hypothesis gets the hypothesis
 *     word even when it is the most interesting thing on the page.
 *   - It never merges the two evidence layers. Nothing imported reaches this function: it takes
 *     the confidence-bearing reading and the claim view, and imported accuracy is neither.
 *   - It never manufactures a statement when the record is thin. Zero statements is a valid
 *     answer and the caller renders nothing.
 */
import type { ClaimView } from "@shared/record-service";
import type { RecordReading } from "@shared/record-dashboard";
import { GRADE_WORD, type Claim, type ClaimGrade } from "@shared/claim";
import { remainingBeforeClaim } from "@/lib/loop-position";

/**
 * The epistemic type of one statement. This is the field that must never be flattened.
 *
 * `tested-claim` and `hypothesis` are deliberately separate kinds rather than one kind carrying a
 * grade, because the difference is what a reader is most likely to lose: a hypothesis that renders
 * beside a replicated finding in the same box, with the same weight, has been promoted by layout.
 */
export type OutcomeKind =
  /** A claim whose grade reflects prospective evidence. Renders `replicated` or `refuted`. */
  | "tested-claim"
  /** A pattern from retrospective evidence that has survived no forward test. */
  | "hypothesis"
  /** A variable that separated in THIS record. No refutation condition, no drill behind it. */
  | "record-description"
  /** The search ran with enough evidence and nothing cleared the threshold. An outcome. */
  | "no-pattern"
  /** The measurement cannot support a conclusion yet, with the existing reason. */
  | "insufficient"
  /** The record could not be read. Not the same as a record with nothing in it (R2). */
  | "unreadable"
  /** The split-half check, which has no verdict and must not be given one. */
  | "same-twice";

export interface OutcomeStatement {
  kind: OutcomeKind;
  /**
   * The grade word, verbatim from `GRADE_WORD`, or null for kinds that have no grade.
   *
   * Null rather than a neutral word: a description and a hypothesis are different states, and
   * giving the description a badge of its own invites the reading that it earned one.
   */
  gradeWord: string | null;
  /**
   * The grade itself, kept beside its word so styling can key off the state rather than the text.
   *
   * WHY BOTH. `gradeWord` is what the reader sees and `GRADE_WORD` owns it; this is what the
   * REPOSITORY says, and the two are needed separately because `replicated` and `refuted` are one
   * `kind` -- both are claims a forward test has graded -- while they are emphatically not one
   * outcome. Without this the stylesheet could only reach them through `kind`, and a rule meant
   * for a survived test would land on a refuted one as well: the words would still differ and the
   * weight would not, which is the promotion-by-layout this whole layer exists to prevent.
   */
  grade: ClaimGrade | null;
  /** The statement itself, taken from its producer rather than composed here. */
  text: string;
  /** What that statement rests on -- the n, the count, the scope. Rendered with it (R1). */
  basis: string | null;
  /**
   * WHICH REPOSITORY OBJECT IS ALLOWED TO SAY THIS. Not decoration: the acceptance rule for this
   * whole layer is that every sentence can name its author, and a test asserts every statement
   * carries one. A statement whose source would be "the summary worked it out" is a defect.
   */
  source: string;
}

/**
 * TWO FAILURES RATHER THAN ONE FLAG, because they are not the same failure and the caller had
 * been folding them together with `||`.
 *
 * The claim layer and the reading are separate queries and either can fail alone. Folded into one
 * boolean, a failed READING made the whole summary say "the record could not be read" -- throwing
 * away a claim that had loaded perfectly well -- and a failed CLAIM could not say anything at all,
 * because a failed query has no `data` and the function returned early on the missing view before
 * the flag was ever consulted. The empty summary that came out was indistinguishable from the one
 * a brand-new record gets, which is precisely the R2 confusion this layer is supposed to report.
 */
export interface OutcomeSummaryInput {
  claim: ClaimView | undefined;
  reading: RecordReading | undefined;
  /** The claim layer could not be read. The claim state is unknown, not empty. */
  claimUnreadable: boolean;
  /** The reading could not be read. The claim state is unaffected and still says what it says. */
  readingUnreadable: boolean;
}

/** ProfilePanel's own sentence about what its findings are. Quoted, not paraphrased. */
export const DESCRIPTION_CAVEAT =
  "תיאור של הרשומה, לא טענה שנבדקה. אין לזה תנאי הפרכה ואף דריל לא העמיד את זה במבחן.";

/** R2, as its own statement: the claim layer did not answer, which is not an empty record. */
function unreadableStatement(): OutcomeStatement {
  return {
    kind: "unreadable",
    gradeWord: null,
    grade: null,
    text: "הרשומה לא נקראה, ולכן אי אפשר לומר מה יש בה.",
    basis: null,
    source: "ClaimView (unreadable) — R2",
  };
}

/**
 * WHAT THE READER IS OWED BENEATH A GRADE, which is not the number that was under it.
 *
 * `Claim.n` counts the RETROSPECTIVE decisions the hypothesis was built from, and printing it
 * alone beneath the word "שוחזר" reads as the evidence that earned the word. It is not: in this
 * repository a grade moves on `ProspectiveDrillResult` and on nothing else, so the count that
 * bought `replicated` or `refuted` is the decisions taken in the drills that followed the claim.
 * The two numbers answer different questions -- where the idea came from, and what tested it --
 * and one line carrying only the first is not a wrong number, it is a compression that credits
 * the grade to the wrong evidence. `ClaimCard` already says "נבדק קדימה N פעמים" one screen down;
 * this is the same fact, kept beside the word that depends on it.
 */
function gradeBasis(claim: Claim): string {
  const built = `נבנה מ־${claim.n} החלטות`;
  if (claim.grade === "hypothesis") return `${claim.scope} · ${built}`;

  const tests = claim.prospective_tests;
  /*
   * A GRADED CLAIM WITH NO FORWARD TEST BEHIND IT IS SAID, NOT SMOOTHED. `evaluateClaim` is the
   * only thing that moves a grade and it moves it on a drill result, so this state should not
   * exist -- and "נבדק קדימה 0 פעמים" beneath the word "שוחזר" would be the page asserting an
   * evidence base it is simultaneously reporting as absent. R2: an unexplained state is named.
   */
  if (tests.length === 0) {
    return `${claim.scope} · ${built} · הראיה שקבעה את הדירוג לא נמצאת על הטענה`;
  }
  const decisions = tests.reduce((sum, test) => sum + test.decision_ids.length, 0);
  const times = tests.length === 1 ? "פעם אחת" : `${tests.length} פעמים`;
  return `${claim.scope} · ${built} · נבדק קדימה ${times} על ${decisions} החלטות`;
}

/**
 * The one statement about the claim search -- exactly one of four states, never two.
 *
 * The order of the checks is the epistemic order and not a convenience: a graded claim outranks a
 * hypothesis, and both outrank a silence. The two silences are told apart by
 * `remainingBeforeClaim`, whose own comment states the mapping -- "zero means the floor is met and
 * no pattern cleared the threshold" -- so the distinction between "still waiting" and "searched
 * and found nothing" is read from the existing function rather than re-derived from the reason
 * string, which would be parsing prose to recover a fact the code already knows.
 *
 * THE FIFTH STATE IS NOT HERE ANY MORE. "The record could not be read" used to be produced by
 * this function, from a `ClaimView` it had been handed -- which is a contradiction: the view only
 * exists when the query succeeded. It is answered by the caller now, where a failed query is
 * actually visible.
 */
function claimStatement(view: ClaimView): OutcomeStatement {
  if (view.claim) {
    const grade: ClaimGrade = view.claim.grade;
    return {
      kind: grade === "hypothesis" ? "hypothesis" : "tested-claim",
      gradeWord: GRADE_WORD[grade].he,
      grade,
      text: view.claim.statement,
      basis: gradeBasis(view.claim),
      source: "Claim.statement + Claim.grade + Claim.prospective_tests (shared/claim.ts)",
    };
  }

  const remaining = remainingBeforeClaim({
    scored: view.scored,
    preregScored: view.preregScored,
    /*
     * False, and not a flag threaded through from the caller: `outcomeSummary` answers an
     * unreadable claim layer before it ever calls this, so by here the view is one that loaded.
     */
    unreadable: false,
  });

  /*
   * Unreachable from here for the reason directly above. Kept rather than cast away, because the
   * signature says null is possible and a non-null assertion would be this function asserting
   * something about a function it does not own.
   */
  if (remaining === null) return unreadableStatement();

  if (remaining > 0) {
    return {
      kind: "insufficient",
      gradeWord: null,
      grade: null,
      // The existing reason, which already says WHY the floor is where it is.
      text: view.reason ?? "אין עדיין מספיק החלטות מדודות כדי לחפש דפוס.",
      basis: `${view.scored} החלטות מדודות · חסרות עוד ${remaining}`,
      source: "ClaimView.reason + remainingBeforeClaim (loop-position.ts)",
    };
  }

  return {
    kind: "no-pattern",
    gradeWord: null,
    grade: null,
    text: view.reason ?? "אף דפוס לא עבר את הסף.",
    basis: `${view.scored} החלטות מדודות · אין דפוס מעל הסף`,
    source: "ClaimView.reason (emptySearchReason) — an outcome, not a silence",
  };
}

/**
 * The strongest variable that separated in this record, as a DESCRIPTION.
 *
 * IT DOES NOT RESTATE THE DIRECTION, and that omission is the point. ProfilePanel renders the
 * contrast through its own generator, correctly worded as a comparison against the rest of the
 * record; repeating it here in a box that sits above the claim would be the one place a reader
 * could mistake it for the finding. What the summary says is which variable separated, on how
 * many decisions, and that it is a description -- and the reading itself stays where it is
 * already worded properly, one screen down.
 *
 * `findings[0]` and not all of them: `readVariables` already collapses each variable's levels to
 * one finding and separates the mirrored levels, so a phase that looks good only because another
 * looks bad is not a second discovery. Taking the head of that list inherits the collapse.
 */
function descriptionStatement(reading: RecordReading): OutcomeStatement | null {
  const findings = reading.profile.variables.findings;
  if (findings.length === 0) return null;
  const finding = findings[0];
  const others = findings.length - 1;
  return {
    kind: "record-description",
    gradeWord: null,
    grade: null,
    text: `${finding.variable.label}: ${finding.strongest.scope} נפרד משאר הרשומה. ${DESCRIPTION_CAVEAT}`,
    basis:
      others > 0
        ? `${finding.strongest.inside.n} החלטות · עוד ${others} משתנים נפרדו`
        : `${finding.strongest.inside.n} החלטות`,
    source: "RecordReading.profile.variables (shared/bucket-variable.ts) + ProfilePanel wording",
  };
}

/**
 * The split-half check, with its refusal intact.
 *
 * NO VERDICT, AND NO THRESHOLD. `Stability` ships neither on purpose -- its own comment says a
 * pass/fail here "would invite exactly the reading it is meant to prevent, that a passing record
 * has a number about the person". So this reports the spread and the sentence that bounds it, and
 * says nothing about a trait. It is also not test-retest: both halves are the same sitting.
 */
function stabilityStatement(reading: RecordReading): OutcomeStatement | null {
  const { spread, n } = reading.stability;
  if (spread === null) return null;
  return {
    kind: "same-twice",
    gradeWord: null,
    grade: null,
    text:
      /*
       * "תכונה יציבה" was the first phrasing and the test rejected it -- correctly. The sentence
       * DENIED the verdict, but the guard bans the word outright, and a guard that has to parse
       * whether a verdict word is being asserted or refused is a guard that will eventually let
       * one through. Saying "קבועה" instead costs nothing and keeps the ban absolute.
       */
      "שתי מחציות הרשומה אמרו את אותו הדבר בהפרש הזה. הפרש קטן אומר שהמספרים לא סותרים " +
      "את עצמם — הוא לא קובע שיש כאן תכונה קבועה, ואינו מבחן חוזר לאורך זמן.",
    basis: `${spread.toFixed(1)} שגיאות תקן · ${n[0]} מול ${n[1]} החלטות`,
    source: "RecordReading.stability (shared/stability.ts) — no threshold by design",
  };
}

/**
 * The whole summary, strongest first, at most three statements.
 *
 * EMPTY IS A VALID ANSWER. A record with nothing measured in it gets no summary at all rather
 * than a placeholder, because the alternative is manufacturing value before it exists -- and the
 * front door already owns that moment.
 */
export function outcomeSummary(input: OutcomeSummaryInput): OutcomeStatement[] {
  const { claim, reading, claimUnreadable, readingUnreadable } = input;

  /*
   * BEFORE THE MISSING VIEW, AND THAT ORDER IS THE FIX. A failed query has no `data`, so the
   * check below sees `undefined` and returns nothing -- which rendered a failed claim layer as a
   * record with nothing in it. The failure has to be answered where it is known, and it is known
   * here rather than inside `claimStatement`, which takes a view that by definition loaded.
   */
  if (claimUnreadable) return [unreadableStatement()];
  // Not an error: the query has not resolved yet, and a summary of a pending record is a guess.
  if (!claim) return [];

  const statements: OutcomeStatement[] = [claimStatement(claim)];

  /*
   * Nothing below the claim state when the READING could not be read -- and the claim statement
   * above survives, because the two are separate queries and one failing says nothing about the
   * other. The description and the split-half both describe the contents of a reading, and a
   * reading that failed to load has no contents to describe: rendering them from a stale or empty
   * object is exactly the R2 failure this layer exists to report.
   */
  if (readingUnreadable || !reading) return statements;

  const description = descriptionStatement(reading);
  if (description) statements.push(description);

  const stability = stabilityStatement(reading);
  if (stability) statements.push(stability);

  return statements.slice(0, 3);
}
