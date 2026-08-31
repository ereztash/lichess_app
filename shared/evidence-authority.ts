/**
 * ONE VOCABULARY FOR "HOW MUCH DOES THIS COUNT", AND NO SCREEN MAY INVENT A SECOND.
 *
 * THE DEFECT THIS CLOSES. A reader cannot tell a claim from an observation by looking at it. The
 * product already distinguishes them internally -- `CLAIM_GRADES` separates a hypothesis from a
 * replicated finding, `EVIDENCE_POLICY` decides what a decision may be pooled into, `theOneThing`
 * refuses to speak when one decision cannot support a sentence -- and then every one of those
 * outcomes is rendered in the same typeface, at the same weight, inside the same card. Something
 * true of one decision and something that survived a prospective test look identical, so the only
 * signal the player receives is that both appeared in a box the product drew.
 *
 * THAT IS NOT A STYLING PROBLEM, and this file is not a stylesheet. It is a naming problem: there
 * was no name for the thing being distinguished, so each screen worded it locally, and the words
 * drifted. `GRADE_WORD` says "השערה"; `RecordDashboard` said "לא מספיק נתונים"; the reveal says
 * "המשפט הזה יצא ממה שנרשם ממך". Three vocabularies for one question a player asks once and asks
 * on every screen: **should I believe this?**
 *
 * FIVE LEVELS, AND THE COUNT IS THE ARGUMENT. Four would collapse the two that matter most --
 * "this happened once" and "this keeps happening" -- and six would ask a player to learn a
 * distinction the record cannot yet support.
 *
 *   one-event   a single decision. n = 1. It is a fact, and it is not about the player.
 *   recurred    a description that repeats in the record. Retrospective, and therefore never
 *               a finding: the pattern was chosen after seeing the data it is measured on.
 *   hypothesis  frozen, with a refutation condition, and not yet tested.
 *   tested      a prospective test ran, could have failed, and did not.
 *   refuted     a prospective test ran and the thing did not come back.
 *
 * NOT A STRENGTH LADDER, and `AUTHORITY_ORDER` is deliberately named for lifecycle rather than
 * for rank. `refuted` is not the weakest level; it is the strongest evidence this product ever
 * produces about a proposition, and it happens to point the other way. Section 22 of the plan is
 * explicit that both settled outcomes are successes, and a UI that sorted by "confidence" would
 * bury the one result that actually closes a question.
 *
 * THE MAPPINGS ARE TOTAL, WHICH IS THE WHOLE MECHANISM. Every state the product can be in has
 * exactly one authority, computed here, from types that already exist. A screen that wanted to
 * say something without an authority would have nothing to render, because the reading it is
 * given carries one. That is why `authorityOfClaim` takes a `Claim` and not a `ClaimGrade`: a
 * caller holding only the grade could have got it from anywhere.
 */
import { GRADE_WORD, type Claim, type ClaimGrade } from "./claim.js";

export const AUTHORITY_ORDER = [
  "one-event",
  "recurred",
  "hypothesis",
  "tested",
  "refuted",
] as const;

export type EvidenceAuthority = (typeof AUTHORITY_ORDER)[number];

/**
 * What each level is called, what mark carries it, and what it licenses.
 *
 * THE MARK IS NOT DECORATION AND IT IS NOT AN ICON FONT. It is a single character that can be
 * read by a screen reader, copied into a bug report, and rendered before any stylesheet loads.
 * The plan proposed ○ / ○○ / ◇ / ● / × and those are kept: they encode the distinction
 * structurally -- hollow for what the record merely shows, solid for what survived a test, a
 * different shape entirely for a proposition, and a cross for a closed negative -- so a reader
 * learns the language from three screens without being taught it.
 *
 * `word` IS A NOUN PHRASE, NEVER A SENTENCE. It is a label under a mark, and a label that is a
 * sentence competes with the headline it is labelling.
 *
 * `means` IS THE ONE LINE THAT APPEARS ON DEMAND (section 15, progressive disclosure). It says
 * what the level IS in terms of what was done, never in terms of how sure anybody feels.
 */
export interface AuthorityVocabulary {
  word: string;
  mark: string;
  means: string;
  /**
   * Whether the question this evidence bears on is closed.
   *
   * TRUE FOR `refuted` AS WELL AS `tested`, and that pairing is the point: a settled question is
   * settled whichever way it went, and a product that treated only the positive outcome as an
   * ending would keep re-testing things it had already answered.
   */
  settled: boolean;
  /**
   * Whether this level may be used to tell the player to play differently.
   *
   * ONLY `tested`. This is section 23 -- coaching arrives last, and only behind evidence that
   * could have come back negative. Everything else may ask for another measurement, which is a
   * different act: a request the product makes of itself, not an instruction it gives the player
   * about their chess.
   *
   * SEPARATE FROM `settled` BECAUSE `refuted` IS BOTH SETTLED AND UNPRESCRIBABLE. A refuted
   * proposition has nothing to recommend; it has something to stop recommending.
   */
  mayPrescribe: boolean;
}

export const AUTHORITY: Readonly<Record<EvidenceAuthority, AuthorityVocabulary>> = {
  "one-event": {
    word: "אירוע אחד",
    mark: "○",
    means: "זה קרה פעם אחת, במשחק הזה. זה עדיין לא אומר משהו עליך.",
    settled: false,
    mayPrescribe: false,
  },
  recurred: {
    word: "חוזר ברשומה",
    mark: "○○",
    means: "זה חוזר במה שכבר נאסף. מצאנו את זה אחרי שראינו את הנתונים, ולכן זה עדיין לא נבדק.",
    settled: false,
    mayPrescribe: false,
  },
  /*
   * THE THREE CLAIM LEVELS CITE `GRADE_WORD` RATHER THAN RESTATING IT, and the first draft of this
   * file got that wrong in the exact way its own opening paragraph complains about. It wrote
   * "השערה לבדיקה", "חזר גם בבדיקה" and "לא חזר בבדיקה" -- better sentences for a reader, and a
   * SECOND vocabulary for three states that already had one. `tests/gates/grade.test.tsx` asserts
   * on the shipped words and `tests/fixtures/claim-render-assertions.ts` keeps a list of finding
   * words a hypothesis may never be given; a parallel table would have drifted from both, silently,
   * the first time either was reworded.
   *
   * So the label is `GRADE_WORD[grade].he`, imported, and `GRADE_AUTHORITY` is exported so
   * `tests/shared/one-word-for-how-much-this-counts.test.ts` can prove the two cannot come apart.
   * What this file adds for those levels is the mark and the `means` line --
   * neither of which existed anywhere, and both of which are what a reader actually needs.
   */
  hypothesis: {
    word: GRADE_WORD.hypothesis.he,
    mark: "◇",
    means: "ניסחנו את זה מראש, כולל מה ייחשב הפרכה, ועוד לא בדקנו במשחקים חדשים.",
    settled: false,
    mayPrescribe: false,
  },
  tested: {
    word: GRADE_WORD.replicated.he,
    mark: "●",
    means: "בדקנו במשחקים חדשים, בלי לשנות את ההגדרה. זה יכול היה לא לחזור, והוא חזר.",
    settled: true,
    mayPrescribe: true,
  },
  refuted: {
    word: GRADE_WORD.refuted.he,
    mark: "×",
    means: "בדקנו במשחקים חדשים ולא מצאנו את זה. השאלה סגורה, וזו תשובה ולא כישלון.",
    settled: true,
    mayPrescribe: false,
  },
};

/**
 * A claim's authority, from the claim itself.
 *
 * TAKES THE WHOLE CLAIM AND NOT ITS GRADE, on purpose. A `ClaimGrade` is a string a caller could
 * have assembled, defaulted, or carried across from a different claim; a `Claim` was produced by
 * `formHypothesis` and can only have been re-graded by `evaluateClaim`. The type is the proof that
 * the grade came from the grading function.
 */
export function authorityOfClaim(claim: Claim): EvidenceAuthority {
  return GRADE_AUTHORITY[claim.grade];
}

/**
 * The grade-to-authority table, written out rather than inferred from the strings matching.
 *
 * `replicated` MAPS TO `tested` AND THE RENAME IS DELIBERATE. "Replicated" is a method word and it
 * is the correct one internally; on screen it reads as a promise about the world. What actually
 * happened is narrower and is what the player needs: the thing was checked forward, and it held.
 */
export const GRADE_AUTHORITY: Readonly<Record<ClaimGrade, EvidenceAuthority>> = {
  hypothesis: "hypothesis",
  replicated: "tested",
  refuted: "refuted",
};

/**
 * The authority of something read off the record with no claim behind it.
 *
 * TWO OUTCOMES ONLY, and there is no third for "a strong pattern". Strength does not promote a
 * retrospective reading -- the region was chosen after seeing the data, so a bigger gap is a
 * bigger retrospective gap. That is the rule R5 exists for, stated at the level of what may be
 * rendered rather than at the level of what may be computed.
 *
 * `n` IS THE ONLY INPUT because it is the only thing that separates the two: one decision is an
 * event, more than one that share a description is a description. Everything else about the
 * reading -- how large, how clean, how surprising -- is a property of a retrospective look.
 */
export function authorityOfRecordReading(n: number): EvidenceAuthority {
  return n <= 1 ? "one-event" : "recurred";
}

/**
 * Whether one authority may be spoken about using the vocabulary of another.
 *
 * THE GUARD `GRADE_WORD` ALREADY MAKES FOR CLAIMS, WIDENED TO EVERY SURFACE. A hypothesis is never
 * given the word for a finding; and now, an event is never given the word for a pattern, and a
 * retrospective description is never given the word for something that was tested.
 *
 * IMPLEMENTED AS EQUALITY RATHER THAN AS AN ORDERING, and that is the strict reading on purpose:
 * "may I use a weaker word than I have earned" sounds harmless and is how `tested` results end up
 * described as השערה, which is the same drift in the other direction.
 */
export function mayBeSpokenAs(actual: EvidenceAuthority, spoken: EvidenceAuthority): boolean {
  return actual === spoken;
}

/** Every word this product is allowed to put under a mark. Used by the gate. */
export const AUTHORITY_WORDS: readonly string[] = AUTHORITY_ORDER.map((a) => AUTHORITY[a].word);
