/**
 * The one promise, in one place, because it is made on four surfaces and three of them are
 * outside React.
 *
 * THE FAILURE THIS EXISTS TO MAKE IMPOSSIBLE. A player meets this product as a chain: a message
 * with a link, the card that link unfurls into, the front door, the sentence above the first
 * decision, and finally a reveal. Every stage was written at a different time, and until now every
 * stage held its own copy of the promise. The share card said "כל כלי שחמט אחר אומר לכם מה עשיתם
 * לא נכון. זה מודד מתי לא ידעתם שאתם לא יודעים"; the front door was rewritten to lead with a chess
 * problem instead of a research construct; and for the length of that edit the two disagreed. A
 * player arriving through the card would have been promised one product and handed another.
 *
 * That is not a copywriting problem. It is the failure mode the whole acquisition trial is built
 * to be able to detect -- promise and product drifting apart -- and a trial cannot measure a
 * drift it is itself producing. So the sentences live here, the front door and the card builder
 * import them, and `tests/client/the-link-someone-was-sent.test.ts` holds the two copies that
 * cannot import anything: `client/index.html`, which is static, and the PNG, which is pixels.
 *
 * WHAT THE PROMISE IS ALLOWED TO SAY, and this is the harder constraint. It names what an engine
 * cannot reach and what this records instead. It does not name a finding. The reveal branch that
 * carries the distinction fires only when the record happens to contain the evidence for it, so a
 * surface that promised it on every decision would bring every arrival an expectation the
 * instrument cannot meet -- and then no continuation measured afterwards would mean anything,
 * because everyone who did not get that branch was disappointed by the copy rather than by the
 * product. "לפעמים" and "לא בכל החלטה" are load-bearing.
 *
 * AND WHAT IT MAY NEVER SAY: anything about what the player saw, considered, thought or knew. The
 * record holds moves placed on a board. Absence from that list means the move was not placed,
 * never that it was not seen, and no acquisition surface may blur the two.
 */

/**
 * The front door's three sentences, in the order the reader meets them.
 *
 * PROBLEM, THEN MECHANISM, THEN A HEDGED PAYOFF. The construct this product measures --
 * calibration, knowing when you did not know -- is true and is not a problem a chess player
 * recognises having. It survives further down the page, as a consequence. Leading with it teaches
 * vocabulary to someone who has not yet been told there is a problem.
 */
export const PROMISE = {
  /** What an engine is good at, and the thing it structurally cannot reach. */
  problem: "מנוע יכול להגיד איזה מהלך היה טוב יותר. הוא לא יודע מה קרה אצלכם בדרך לבחירה.",
  /** Why this one is different: an ordering, and the four things the ordering makes recordable. */
  mechanism:
    "כאן ההחלטה נרשמת לפני שהמנוע מדבר — מה קראתם בעמדה, מה לא ידעתם להעריך, כמה הייתם בטוחים, ואילו מהלכים הנחתם על הלוח.",
  /** What that buys, hedged exactly as far as the instrument is hedged. */
  payoff:
    "לכן לפעמים אפשר להבדיל בין מהלך שעלה יותר לבין משהו שקרה בדרך שבה הוא נבחר. לא בכל החלטה — רק כשזה נרשם.",
} as const;

/**
 * The same promise at the length an unfurl and a 1200x630 card can hold.
 *
 * Not a different promise: the first two lines are `PROMISE.problem` split at its own full stop,
 * and the third is `PROMISE.mechanism` up to its dash. A card is a smaller window onto one
 * sentence, never a second sentence.
 */
export const PROMISE_SHORT = {
  engineDoes: "מנוע יכול להגיד איזה מהלך היה טוב יותר.",
  engineCannot: "הוא לא יודע מה קרה אצלכם בדרך לבחירה.",
  mechanism: "כאן ההחלטה נרשמת לפני שהמנוע מדבר.",
} as const;

/**
 * The header once there is a record to head. Same three ideas, past the point where the reader
 * needs to be told what the product is for.
 */
export const PROMISE_RETURNING =
  "מנוע יכול להגיד איזה מהלך היה טוב יותר. כאן ההחלטה נרשמת לפני שהוא מדבר, ולכן יש כאן גם משהו על הדרך שבה בחרתם.";

/**
 * The three ideas that must survive every stage of the chain, as patterns rather than strings.
 *
 * WHY PATTERNS. A card has less room than a page and a page has less room than a reveal, so the
 * wording legitimately shortens along the chain. What may not change is which three things are
 * being claimed. A stage that drops one of these has stopped making the same promise, whatever
 * else it says -- and that is what the continuity test asserts, on every surface, in this order.
 */
export const PROMISE_ANCHORS: readonly { readonly idea: string; readonly pattern: RegExp }[] = [
  { idea: "what the engine is good at", pattern: /איזה מהלך היה טוב יותר/ },
  { idea: "what it cannot reach", pattern: /בדרך לבחירה|בדרך שבה (הוא )?נבחר|הדרך שבה בחרתם/ },
  { idea: "the ordering that creates the record", pattern: /נרשמת לפני ש(המנוע|הוא) מדבר/ },
];

/**
 * Vocabulary no acquisition surface may use, with the reason each is out.
 *
 * The first group claims access to a mind. The second promises a diagnosis, and the third
 * promises a specific reveal branch -- all three make an arrival's expectation something the
 * instrument cannot honour on a given decision.
 */
export const PROMISE_PROHIBITED: readonly { readonly pattern: RegExp; readonly why: string }[] = [
  { pattern: /ראית|ראיתם|חשבת|חשבתם|שקלת|שקלתם|ידעת בלב/, why: "claims to know what was in a mind" },
  { pattern: /נגלה לך|נראה לך בדיוק|נאבחן|נגיד לכם למה/, why: "promises a diagnosis" },
  { pattern: /פספסת|פספסתם|תגלו את המהלך ש/, why: "promises a reveal branch that may never fire" },
];
