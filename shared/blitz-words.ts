/**
 * THE POST-GAME SCREEN'S SENTENCES, IN ONE PLACE, DERIVED FROM WHAT WAS MEASURED.
 *
 * WHY THE WORDS ARE NOT IN THE COMPONENT. `OutcomeSummary` states the rule this repository already
 * follows: a component chooses type, order and weight, and does not choose words. The moment a
 * screen phrases its own sentence it becomes a second vocabulary beside the module entitled to
 * speak, and the two drift -- which is how "not enough data" came to mean five different things.
 *
 * WHY THESE ARE TEMPLATES AND `reveal.ts` WARNS ABOUT TEMPLATES. That warning is specific and it is
 * about a fixed sentence rendered AS INSIGHT: the old AnalysisPanel closed every position with the
 * same line about the centre, which is manufactured certainty however fluently it is written. Every
 * slot below is filled from a measured value and states only what happened -- the word the player
 * pressed, what the move cost, how long they took. `theOneThing.text` is built the same way and for
 * the same reason: an event is a fact of the record and can be stated; what to make of it is not,
 * and none of these sentences tries.
 *
 * NOTHING HERE IS A PERCENTAGE, AND NOTHING HERE IS A CENTIPAWN. §6 and §8. The centipawn value is
 * still in the record and still reaches the screen -- behind the disclosure, in `why`, where R1
 * wants it, beside its engine and its depth.
 *
 * DURATIONS ARE FORMATTED HERE and that is not a layout decision escaping into shared code. The
 * choice between "1.8 שניות" and "2 שניות" and "00:01.8" is the difference between a reader seeing
 * a hurried decision and seeing a stopwatch, at exactly the scale blitz decisions live at. One
 * place, so two screens cannot round the same think time differently.
 */
import { AUTHORITY, type EvidenceAuthority } from "./evidence-authority.js";
import { COST_BAND_WORD, type CostBand, confidenceWord, costBand } from "./plain-reading.js";
import type { BlitzEvent, PostGameReading, PostGameSilence } from "./blitz-reading.js";

/**
 * A think time, at the resolution a blitz decision is actually made at.
 *
 * ONE DECIMAL UNDER TEN SECONDS AND NONE ABOVE IT. The interesting decisions in a three-minute game
 * are the ones taken in one or two seconds, and "2 שניות" erases the difference between 1.4 and
 * 2.4 -- which is most of the signal. Above ten seconds the tenth is noise a reader would have to
 * ignore, and printing it invites them to read precision the clock does not have.
 */
export function seconds(ms: number): string {
  const value = ms / 1000;
  return value < 10 ? `${value.toFixed(1)} שניות` : `${Math.round(value)} שניות`;
}

/** A remaining clock, as minutes and seconds when there are minutes and as seconds when there are not. */
export function clock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  if (minutes === 0) return `${total} שניות`;
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}

/** One labelled fact about a decision. The component lays these out; it does not compose them. */
export interface EventFact {
  label: string;
  value: string;
}

/**
 * WHAT HAPPENED ON ONE DECISION, as §7 lays it out: the clock, the think time, the word.
 *
 * THE ORDER IS THE ORDER A PLAYER LIVED IT. What was on the clock when the position appeared, how
 * long they spent, what they said. A list starting with the cost would be starting with the
 * verdict, which is the aggregate-first habit §7 exists to break.
 *
 * THE STATED CONFIDENCE IS OMITTED WHEN NOTHING WAS ASKED, and not rendered as "לא נשאל". A row
 * saying the instrument stayed quiet is a fact about the sampler, and it belongs in the disclosure
 * with the rest of the protocol -- not in a three-line summary of what the player did.
 */
export function eventFacts(event: BlitzEvent, costAlreadySaid = false): EventFact[] {
  const facts: EventFact[] = [
    { label: "על השעון", value: clock(event.clockBeforeMs) },
    { label: "חשבת", value: seconds(event.thinkMs) },
  ];
  if (event.confidence !== null) {
    facts.push({
      label: "אמרת",
      value: confidenceWord(event.confidence.level, event.confidence.scale),
    });
  }
  /*
   * THE COST IS DROPPED WHERE SOMETHING ABOVE HAS ALREADY SAID IT.
   *
   * A LIST WHOSE ROWS ALL SHARE A BAND SAID IT SEVEN TIMES. Six rows in a post-game disclosure
   * each read "במהלך X המהלך היה מחיר גדול" and then, on the line below, "המהלך: מחיר גדול" --
   * the same three words in the headline and in the facts, in every row, plus once more implied by
   * a summary that called them all worth seeing. `othersSummary` now says the band once, above the
   * list, and this is how a row stops repeating it.
   */
  if (!costAlreadySaid) {
    facts.push({
      label: "המהלך",
      value: COST_BAND_WORD[costBand(event.standingCp, event.cpLoss)].word,
    });
  }
  return facts;
}

/**
 * The cost band every one of these events shares, or `null` where they do not all share one.
 *
 * WHY A LIST NEEDS THIS AT ALL. `blitzEventsIn` selects on cost and on what the player said, so a
 * game with several expensive moves and no instrument answers produces a list whose every row has
 * the same band -- and a word repeated in every row of a list carries no information in any of
 * them. It is not wrong; it is the reader's whole screen spent on one fact.
 *
 * `null` IS THE ORDINARY CASE AND NOT A FAILURE. `unsure-and-fine` events are clean by definition,
 * so any list holding one alongside a costly move genuinely has two bands to report, and every row
 * keeps its own.
 */
export function sharedCostBand(events: readonly BlitzEvent[]): CostBand | null {
  if (events.length < 2) return null;
  const first = costBand(events[0].standingCp, events[0].cpLoss);
  return events.every((e) => costBand(e.standingCp, e.cpLoss) === first) ? first : null;
}

/**
 * What the disclosure above the list says.
 *
 * IT USED TO ASSERT VALUE AND NAME NOTHING: *"6 ההחלטות שכדאי לראות"*. Worth seeing for what? The
 * summary is the one place a shared band belongs, because it is the one place it is said once --
 * and saying it there is what lets six rows stop being six copies of it.
 *
 * THE DEFINITE ARTICLE IS GONE WITH IT. `postGameWords` already writes this count as
 * `היו N החלטות שכדאי לראות`, indefinite, and the two disagreed.
 */
export function othersSummary(events: readonly BlitzEvent[]): string {
  const shared = sharedCostBand(events);
  const noun = events.length === 1 ? "החלטה אחת" : `${events.length} החלטות`;
  if (shared === null) return `עוד ${noun} שכדאי לראות`;
  return `עוד ${noun} שעלו ${COST_BAND_WORD[shared].word}`;
}

/**
 * THE HEADLINE FOR ONE EVENT.
 *
 * TWO CLAUSES, AND THE SECOND IS ALWAYS THE COST. "כאן אמרת X, והמהלך Y" -- the thing the player
 * did, then the thing that happened. Not "you were overconfident": that is a statement about the
 * person built from one decision, and one decision cannot carry it, which is exactly what the
 * `one-event` authority beside it says.
 *
 * THE `costly` BRANCH HAS NO FIRST CLAUSE, because there was nothing the player said. Writing one
 * anyway -- "here you moved quickly and it cost you" -- would be the product inventing a process
 * story for a plain engine comparison, which is the one thing the process/engine split exists to
 * prevent.
 */
export function eventHeadline(event: BlitzEvent, costAlreadySaid = false): string {
  const cost = COST_BAND_WORD[costBand(event.standingCp, event.cpLoss)].word;
  if (event.confidence === null) {
    /*
     * NO SENTENCE ONCE THE COST HAS BEEN SAID ABOVE, AND THAT IS THE FINDING RATHER THAN A
     * SHORTENING.
     *
     * For a decision where nothing was asked, the cost band IS the whole of what this product knows
     * that an engine report does not already say -- so with the band in the summary there is
     * nothing left for a sentence to carry, and the row is the move. Writing one anyway is how six
     * identical lines happened: a sentence shape built for the events that earn one, applied to the
     * events that do not.
     *
     * The module's own ordering rule says this in the other direction: *ordered by what the record
     * could say that an engine could not*. A row with no stated confidence is at the bottom of that
     * order, and it should read like it.
     */
    return costAlreadySaid ? event.san : `במהלך ${event.san} המהלך היה ${cost}.`;
  }
  const said = confidenceWord(event.confidence.level, event.confidence.scale);
  /*
   * AND THE ROW THAT DID EARN A SENTENCE KEEPS IT. What the player said is the thing no game review
   * can produce, so it survives the band moving upstairs -- which is also what makes the one row
   * with an instrument answer visibly different from the five without.
   */
  if (costAlreadySaid) return `כאן אמרת "${said}".`;
  return `כאן אמרת "${said}", והמהלך היה ${cost}.`;
}

/**
 * WHY THIS GAME HAD NOTHING TO CONCLUDE, in the player's terms.
 *
 * THREE SENTENCES BECAUSE THERE ARE THREE CAUSES AND THEY SEND A PLAYER TO THREE DIFFERENT PLACES.
 * The screen this replaces printed one thing for all of them -- a count of analysed decisions --
 * which answered none.
 */
export const POST_GAME_SILENCE_SENTENCE: Readonly<Record<PostGameSilence, string>> = {
  "not-scored": "המנוע עוד לא עבר על המשחק הזה, אז אין עדיין מה לקרוא ממנו.",
  "no-decisions": "לא נרשמו כאן החלטות שלך, אז אין מה למדוד במשחק הזה.",
  /*
   * THE ORDINARY CASE, AND THE ONE WORTH SAYING OUT LOUD. There were costly moves; none of them
   * needed anything the record holds. `EVIDENCE_LABEL.engine` in `reveal.ts` makes the same
   * statement about a single reveal and makes it without apologising, which is what lets the other
   * branch be believed.
   */
  "engine-only": "לא מצאתי במשחק הזה לבדו משהו שכדאי להסיק ממנו עליך.",
};

/** The four slots of a 1-1-1-1 card, with nothing left for a component to compose. */
export interface PostGameWords {
  /** The one thing. */
  headline: string;
  /** The concrete case, or null when the state has none. */
  facts: EventFact[] | null;
  authority: EvidenceAuthority;
  action: { label: string; because: string };
  /** A second sentence under the headline, when the state has one to add. */
  note: string | null;
}

/**
 * THE OFFER §24 MAKES IN STATE A, and it is deliberately not the headline.
 *
 * "There were N decisions worth looking at" is true and is not a finding, so it goes under the
 * sentence that says there was no finding -- not instead of it. A screen that led with the offer
 * would be answering "was there anything?" with "here are some things", which is the shape of every
 * dashboard this plan is written against.
 */
function worthSeeingNote(n: number): string | null {
  if (n === 0) return null;
  return n === 1
    ? "הייתה החלטה אחת שכדאי לראות."
    : `היו ${n} החלטות שכדאי לראות.`;
}

/**
 * The whole post-game card, from the reading.
 *
 * THE ACTION IS THE PART THAT CHANGES BETWEEN STATES, and it changes for a reason each time. With a
 * position to show, the next thing is to look at it -- §7's "ראה את העמדה", the concrete case
 * before anything aggregate. With no position, the next thing is another measurement, and the
 * sentence under the button says what that measurement is for rather than that the product wants
 * the click.
 */
export function postGameWords(reading: PostGameReading): PostGameWords {
  if (reading.state === "nothing-to-conclude") {
    return {
      headline: POST_GAME_SILENCE_SENTENCE[reading.because],
      facts: null,
      /*
       * `one-event` EVEN WITH NOTHING TO SHOW, and this looked wrong until it did not. The five
       * levels answer "how much does this count", and the honest answer for a single game that
       * found nothing is the same as for a single game that found something: it is one game. The
       * alternative would be a sixth level meaning "no evidence", which is not an evidence level.
       */
      authority: "one-event",
      action: {
        label: "שחק עוד משחק",
        because: "עוד משחק מוסיף החלטות חדשות, וזה מה שמאפשר לבדוק אם משהו חוזר.",
      },
      note: worthSeeingNote(reading.worthSeeing.length),
    };
  }

  if (reading.state === "joins-what-we-are-watching") {
    return {
      headline: eventHeadline(reading.lead),
      facts: eventFacts(reading.lead),
      /*
       * THE WATCHED THING'S AUTHORITY, NOT THE EVENT'S, and that is the whole content of state C.
       * The decision is still one decision; what changed is that it landed inside something the
       * product had already committed to looking at. If that thing is a frozen hypothesis the card
       * says so; if it is a description the record keeps returning, it says that instead.
       */
      authority: reading.watching.authority,
      action: {
        label: "ראה את העמדה",
        because: `זה קרה שוב ב${reading.watching.scope} — המקום שאנחנו כבר בודקים.`,
      },
      note:
        `${reading.added === 1 ? "החלטה אחת חדשה נכנסה" : `${reading.added} החלטות חדשות נכנסו`} ` +
        `לבדיקה הזאת. סך הכול ${reading.nowUnderWatch}.`,
    };
  }

  return {
    headline: eventHeadline(reading.lead),
    facts: eventFacts(reading.lead),
    authority: reading.lead.authority,
    action: {
      label: "ראה את העמדה",
      because: "זה מקרה אחד. לראות אותו על הלוח זה מה שהופך אותו למשהו שאפשר לזכור.",
    },
    /*
     * §24 STATE B, VERBATIM: "זה אירוע אחד. עדיין לא דפוס." Said here rather than left to the
     * authority mark, because the mark is a label and this is the sentence a reader carries away.
     * `AUTHORITY["one-event"].means` says the same thing at more length and behind a disclosure.
     */
    note: "זה אירוע אחד. עדיין לא דפוס.",
  };
}

/** Re-exported so a card can render the level's own explanation without a second import. */
export const authorityMeaning = (authority: EvidenceAuthority): string => AUTHORITY[authority].means;

/**
 * THE RESUME SCREEN'S THREE SENTENCES (§13, §28).
 *
 * ONE FUNCTION PER QUESTION, because the three answers have different lifetimes: what changed is
 * about a visit, what is known is about a record, and what to do next is about a gate. A single
 * composer would have to take all three and would then be the only place any of them could be
 * changed.
 *
 * NO PARAGRAPH ANYWHERE. §28's acceptance criterion is that a returning player answers all three
 * within seconds without reading prose, so every sentence below is one clause plus at most one
 * number, and `tests/client/a-screen-nobody-reads-twice` holds a character budget over the three
 * of them together.
 */
import type { BlitzPattern } from "./blitz-reading.js";
import type { ResumeChange, ResumeKnowledge } from "./resume-reading.js";

/**
 * WHAT CHANGED, or null when there is nothing to report.
 *
 * NULL WHEN NOTHING IS NEW, and that is not the same as a first visit -- the caller already
 * separated those by passing null for `change` itself. A returning player with no new games gets
 * no line here rather than "0 משחקים חדשים", which is a sentence whose only content is a zero.
 *
 * THE TWO NUMBERS APPEAR TOGETHER ONLY WHEN THEY DISAGREE. On a healthy record every new game is
 * scored and "4 משחקים חדשים, 4 נותחו" is the same fact twice. When they diverge, the gap is the
 * whole message, and it is what a broken analysis path looks like from the outside.
 */
export function changedSentence(change: ResumeChange | null): string | null {
  if (change === null || change.newGames === 0) return null;
  const games =
    change.newGames === 1 ? "משחק אחד חדש" : `${change.newGames} משחקים חדשים`;
  if (change.newlyScored === change.newGames) {
    return `${games} מאז הפעם הקודמת, וכולם נותחו.`;
  }
  if (change.newlyScored === 0) {
    return `${games} מאז הפעם הקודמת. אף אחד מהם עוד לא נותח.`;
  }
  return `${games} מאז הפעם הקודמת, ${change.newlyScored} מהם נותחו.`;
}

/**
 * WHAT ONE RETROSPECTIVE PATTERN SAYS, AS A HEADLINE.
 *
 * SPLIT FROM THE COUNTS, AND THE SPLIT WAS FOUND BY PRINTING THE SCREEN. One function produced both
 * and the resume card rendered it twice -- once as the headline and once as the example -- for 371
 * characters of which half was a duplicate. No assertion about wording would have caught that; a
 * character budget did, and only because somebody looked at what it was counting.
 *
 * IT NAMES THE DIRECTION AND THE SCOPE, AND CLAIMS NOTHING ELSE. A calibration gap difference says
 * that inside this bucket the stated confidence sits further from the outcomes than it does outside
 * it -- that, scoped, is the whole sentence. "You commit too fast" would be an explanation, and
 * this measurement contains no explanation: it cannot tell haste from misreading from a genuinely
 * harder position.
 *
 * NO HEDGE WORD. "לפעמים" and "נוטה" and "אולי" are the vocabulary a sentence reaches for when it
 * is doing the work the evidence mark is supposed to do. The mark under this line says `חוזר
 * ברשומה`, which is exact; a hedge on top of it would be the same caution said twice and less
 * precisely.
 */
export function patternHeadline(pattern: BlitzPattern): string {
  return pattern.predictsOverconfidence
    ? `ב${pattern.scope}, הביטחון שלך גבוה יותר ממה שהתוצאות מראות.`
    : `ב${pattern.scope}, הביטחון שלך נמוך יותר ממה שהתוצאות מראות.`;
}

/**
 * THE SAME PATTERN AS TWO COUNTS, in §10's shape: both sides, and no percentage.
 *
 * "48 מתוך 60, מול 30 מתוך 60" RATHER THAN "80% מול 50%". The second is more precise and less
 * understood, and the precision is spurious at these sizes anyway -- a tenth of a percent on nine
 * observations is a decimal place the record cannot support.
 *
 * THE SECOND CLAUSE IS WITHHELD WHEN `comparable` IS FALSE. "48 of 60 here, against 0 of 0
 * elsewhere" is not a comparison; it reads as a total contrast, which is the strongest possible
 * claim, drawn from no observations. The first clause is still true and is still said.
 *
 * THE DIRECTION DECIDES THE VERB. An overconfidence pattern counts times the player said they were
 * sure and were not; an underconfidence pattern counts times they said they were unsure and were
 * right. Counting the same event for both would describe one of them backwards, which is the
 * defect `predicts_overconfidence` was added to the claim to prevent one layer up.
 */
export function patternCounts(pattern: BlitzPattern): string {
  const { inside, outside } = pattern.countable;
  const said = pattern.predictsOverconfidence
    ? "אמרת שאתה בטוח והמהלך עלה לך"
    : "אמרת שאתה לא בטוח והמהלך היה בסדר";
  const here = `${said} ב-${inside.hit} מתוך ${inside.of} מהפעמים.`;
  if (!pattern.comparable) return here;
  return `${here} בשאר ההחלטות: ${outside.hit} מתוך ${outside.of}.`;
}

/**
 * WHY THERE IS NOTHING TO SAY YET, per blocker, with the number when there is one.
 *
 * §13 VERBATIM WHERE IT APPLIES: "לא הצטבר עדיין מספיק מידע. עוד שני משחקים יאפשרו בדיקה ראשונה."
 * The two comes from `BlitzShortfall.games`, which comes from the bucketing that is actually
 * blocking, converted at the rate this record has observed. When there is no rate the clause is
 * dropped rather than filled with a guess -- a number a player plans around is worse invented than
 * absent.
 *
 * THE GAMES FIGURE IS A FLOOR AND THE SENTENCE SAYS SO. New decisions do not all land in the thin
 * side of a split, so "at least" is not hedging; it is the only honest reading of a number computed
 * as if they did.
 */
export function nothingYetSentence(knows: Extract<ResumeKnowledge, { kind: "nothing-yet" }>): string {
  switch (knows.because) {
    case "no-games":
      return "עוד לא שיחקת כאן משחק, אז אין עדיין מה למדוד.";
    case "nothing-scored":
      return "יש משחקים שמורים, והמנוע עוד לא עבר על אף אחד מהם.";
    case "nothing-asked":
      return "עוד לא נשאלת על אף החלטה, אז אין ביטחון להשוות מולו.";
    case "no-split-yet":
      /*
       * NOT A SHORTAGE. Every division was tested and none separated, which is an answer and is the
       * most common one the M0 audit measured. Calling it "not enough data" would be false, and
       * showing nothing at all is what the product did before this screen existed.
       */
      return "בדקנו את כל החלוקות שיש לנו, ואף אחת מהן לא הפרידה בין ההחלטות שלך.";
    case "too-few-readable": {
      const start = "עוד לא הצטבר מספיק כדי לבדוק משהו.";
      const games = knows.needs?.games;
      if (games === undefined || games === null) return start;
      return games === 1
        ? `${start} עוד משחק אחד לפחות יאפשר בדיקה ראשונה.`
        : `${start} עוד ${games} משחקים לפחות יאפשרו בדיקה ראשונה.`;
    }
  }
}

/** The one sentence for `knows`, whichever kind it is. */
export function knowsSentence(knows: ResumeKnowledge): string {
  return knows.kind === "one-thing" ? patternHeadline(knows.pattern) : nothingYetSentence(knows);
}
