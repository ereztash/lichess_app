/**
 * Turning a candidate pattern (Layer A statistics) into a claim (Layer B).
 *
 * Every claim produced here is a HYPOTHESIS. That is not a hedge -- it is the only grade
 * retrospective data can support. Nothing in this file can produce 'replicated'; the return type
 * says so, and the only function that raises a grade lives in claim.ts and accepts a prospective
 * drill result exclusively.
 *
 * The statement is assembled from measured quantities. It carries its n, it names its scope, and
 * it states in advance what would refute it. A sentence that cannot do all four is not written.
 */
import type { Claim, RetrospectiveEvidence } from "./claim.js";
import { formHypothesis } from "./claim.js";
import { PREREGISTERED_SEPARABILITY_K, type CandidatePattern } from "./detector.js";
import { readVariables } from "./bucket-variable.js";

/**
 * The unit of output is ONE claim (section 3.5). If the system has three candidates it shows the
 * one with the most supporting decisions and says the other two exist. Showing everything is how
 * the player ends up changing nothing.
 */
export interface ClaimSelection {
  claim: Claim & { grade: "hypothesis" };
  /** How many other candidates were found and deliberately not shown. */
  othersWithheld: number;
  /** The bucket the claim is about. Exposed so a caller cannot re-derive it and get it wrong. */
  key: string;
}

/**
 * The claim's stable id, derived from the bucket the claim is ACTUALLY about.
 *
 * DERIVED HERE AND NOWHERE ELSE, and that is the fix rather than the tidying. The caller used to
 * build it from `patterns[0].key` while `selectClaim` chose which pattern to speak about --
 * two independent answers to one question. The moment those two disagreed, the record stored a
 * claim carrying one bucket's id and another bucket's statement: `getClaim` would then find a
 * stored claim about a different phase and return it, and a drill result would attach to the
 * wrong hypothesis. Making the id a function of the selection makes that divergence unwritable.
 */
export const claimIdFor = (key: string) => `claim-${key}`;
export const NO_CLAIM_ID = "claim-none";

const pct = (value: number) => `${Math.round(value * 100)}%`;

/**
 * What the claim says. Built from the numbers, not from a template with the numbers dropped in:
 * change the measurement and the sentence changes shape, not just its digits.
 *
 * THE SENTENCE USED TO NAME A LEVEL, AND THE MEASUREMENT IS A CONTRAST.
 *
 * `predicts_overconfidence` is `insideSummary.gap - outsideSummary.gap > 0` (shared/detector.ts).
 * It says this bucket sits ABOVE THE REST of the record. It says nothing about whether the player
 * is overconfident inside it -- and `detect` never tests the inside level against zero, so nothing
 * in the product is entitled to assert one. This function read that boolean and wrote "הביטחון שלך
 * גבוה יותר ממה שהתוצאות מצדיקות", which is a claim about the person in that bucket.
 *
 * Reproduced on the ordinary path, 900 decisions through the real store, nothing injected: a
 * player UNDERconfident everywhere and least so in the opening produced
 *
 *     inside : confidence 50%  accuracy 55%   gap -0.050
 *     outside: confidence 35%  accuracy 65%   gap -0.300
 *     gapDifference +0.250  ->  predicts_overconfidence: true
 *
 * and the screen read "ב-החלטות בפתיחה הביטחון שלך גבוה יותר ממה שהתוצאות מצדיקות: ביטחון ממוצע
 * 50% מול דיוק 55%" -- overconfidence asserted beside two numbers showing five points of the
 * opposite, in the same sentence.
 *
 * THE SECOND CLAUSE WAS WORSE, BECAUSE IT WAS NEVER COMPUTED AT ALL. "בשאר ההחלטות הפער קטן
 * בהרבה" was a template constant. In the run above the rest's gap is 0.300 against the bucket's
 * 0.050 -- six times BIGGER, printed as "much smaller" beside the two numbers that disprove it.
 *
 * WHAT IS SAID NOW. The direction describes the contrast, which is the thing that cleared the
 * separability bar. Both pairs of numbers are printed, so the absolute levels are on the screen
 * and the reader can see them. And the last line says what the comparison is ABOUT, because
 * "confidence sits higher relative to accuracy here than there" is easy to finish reading as
 * "I am overconfident here", and that is the sentence this function is no longer allowed to make.
 *
 * NOT "the gap is bigger". `gapDifference > 0` is an ALGEBRAIC comparison of a signed quantity.
 * In the run above the inside gap is higher than the outside gap and six times smaller in
 * magnitude. A sentence about magnitude would have been a second false statement in the same
 * place, so the wording is about confidence RELATIVE TO accuracy, which is what was measured.
 */
export function statementFor(pattern: CandidatePattern): string {
  const { scope, inside, outside } = pattern;
  const direction = pattern.predicts_overconfidence ? "גבוה יותר" : "נמוך יותר";
  /*
   * PLAYER WORDS, IDENTICAL ARITHMETIC. `הביטחון המוצהר` and `דיוק בפועל` are the internal names
   * for the two quantities; a player says "how sure I said I was" and "what actually came out".
   * Every number, both denominators, the direction and the closing caveat are unchanged -- and the
   * caveat is the load-bearing part: this is a CONTRAST between two groups, never a statement
   * about how confident the player is in one of them.
   */
  return (
    `ב-${scope} (${inside.n} החלטות) אמרת שאתה בטוח ${direction} ביחס למה שיצא בפועל, ` +
    `מאשר בשאר ההחלטות: בממוצע אמרת ${pct(inside.meanConfidence)} ויצא ${pct(inside.accuracyRate)}. ` +
    `בשאר ההחלטות (${outside.n}): אמרת ${pct(outside.meanConfidence)} ויצא ${pct(outside.accuracyRate)}. ` +
    `ההשוואה היא בין שתי הקבוצות, ולא על כמה שהיית בטוח בכל אחת מהן בנפרד.`
  );
}

/**
 * What would disprove this, written down BEFORE any drill runs (R5).
 *
 * A claim that predicts nothing specific cannot fail, and a claim that cannot fail measures
 * nothing. This states the observable outcome that would refute it.
 *
 * IT HAS TO NAME THE BAR THE GRADER ACTUALLY APPLIES. This promised a plain comparison -- "if the
 * gap is not larger than in the rest, the hypothesis is refuted" -- while `evaluateRefutation`
 * requires the difference to clear `PREREGISTERED_SEPARABILITY_K` standard errors of itself before
 * it counts as anything. A player who reads the stored sentence, meets it on the drill, and is
 * then told the claim is refuted has been held to a condition nobody showed them, and refutation
 * is terminal.
 *
 * The multiplier is interpolated from the constant rather than typed, so the sentence cannot drift
 * from the test the way it just had. The scope clause is unchanged and is enforced by `beginDrill`
 * and `finishDrill` since cycle 46.
 */
export function refutationConditionFor(pattern: CandidatePattern): string {
  /*
   * THE BAR STAYS IN ITS OWN WORDS. `שגיאות תקן` is a statistical term and it survives the rewrite
   * on purpose: the comment above this function exists because the sentence once promised a plain
   * comparison while `evaluateRefutation` applied a separability bar, and a player held to a
   * condition nobody showed them has been held to nothing. Naming the bar is what makes the claim
   * falsifiable, and refutation here is terminal.
   *
   * `ההשערה הופרכה` is also unchanged. Until the tri-state verdict exists, a test that merely
   * fails to support a claim marks it refuted -- so any plainer phrasing would read as evidence
   * that the pattern is gone, which is more than the mechanism can say.
   */
  const bar = `בפער של לפחות ${PREREGISTERED_SEPARABILITY_K} שגיאות תקן`;
  return pattern.predicts_overconfidence
    ? `בבדיקה חדשה על עמדות מ-${pattern.scope}, אם הפער בין כמה שאמרת שאתה בטוח לבין מה שיצא בפועל לא יהיה גדול יותר מאשר בשאר ההחלטות ${bar} — ההשערה הופרכה.`
    : `בבדיקה חדשה על עמדות מ-${pattern.scope}, אם מה שאמרת לא יהיה נמוך ממה שיצא בפועל יותר מאשר בשאר ההחלטות ${bar} — ההשערה הופרכה.`;
}

export function deriveClaim(
  pattern: CandidatePattern,
  options: { claim_id: string; created_at: string },
): Claim & { grade: "hypothesis" } {
  const evidence: RetrospectiveEvidence = {
    kind: "retrospective",
    decision_ids: pattern.supporting_decision_ids,
  };
  return formHypothesis({
    claim_id: options.claim_id,
    statement: statementFor(pattern),
    scope: pattern.scope,
    evidence,
    refutation_condition: refutationConditionFor(pattern),
    /*
     * THE SAME FLAG THAT CHOSE THE TWO SENTENCES ABOVE, now also kept. It used to be spent here
     * and nowhere else: `statementFor` and `refutationConditionFor` each read it, said "higher"
     * or "lower", and the boolean went out of scope. The claim then travelled to the drill
     * carrying a sentence about a direction and no direction, and the grading path -- which is a
     * signed test -- had to supply its own.
     */
    predicts_overconfidence: pattern.predicts_overconfidence,
    created_at: options.created_at,
  });
}

/**
 * Select the single claim to store, and count what is being withheld.
 *
 * IT DOES NOT TAKE `patterns[0]`, AND THE MEASUREMENT IS WHY. `detect` sorts by support -- the
 * number of decisions behind a bucket -- which is the right rule for choosing between unrelated
 * claims and the wrong one for choosing among levels of a single variable, because the biggest
 * level is whichever the record happens to contain most of.
 *
 * On 400 simulated players per condition, each with exactly one weakness, the claim this function
 * stored named a phase the player was FINE in:
 *
 *     weakness in endgame     14.7%  ->  1.6%
 *     weakness in opening     14.7%  ->  1.0%
 *     weakness in middlegame   0.0%  ->  0.8%
 *
 * One in seven, and forty-four times in forty-five the stored claim was the MIRROR: a player told
 * they were underconfident in a phase they were calibrated in, and then offered a drill to prove
 * it. A claim is the most durable thing this product makes -- it accumulates prospective results
 * and it is what the player is asked to go and test -- so a wrong one does not merely misinform,
 * it spends their decisions.
 *
 * The middlegame case gets very slightly worse, because ranking by distance gives up the guarantee
 * that the largest level always wins. Fourteen points bought for eight tenths of one.
 *
 * `othersWithheld` counts the other VARIABLES that separated, not the other levels. Counting
 * levels reported one weakness as "and 2 more", which is the same overcount printed on a screen.
 */
export function selectClaim(
  patterns: CandidatePattern[],
  options: { created_at: string },
): ClaimSelection | null {
  const { findings } = readVariables(patterns);
  if (findings.length === 0) return null;
  const strongest = findings[0].strongest;
  return {
    claim: deriveClaim(strongest, { claim_id: claimIdFor(strongest.key), ...options }),
    othersWithheld: findings.length - 1,
    key: strongest.key,
  };
}
