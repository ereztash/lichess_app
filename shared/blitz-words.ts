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
import { COST_BAND_WORD, confidenceWord, costBand } from "./plain-reading.js";
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
export function eventFacts(event: BlitzEvent): EventFact[] {
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
  facts.push({
    label: "המהלך",
    value: COST_BAND_WORD[costBand(event.standingCp, event.cpLoss)].word,
  });
  return facts;
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
export function eventHeadline(event: BlitzEvent): string {
  const cost = COST_BAND_WORD[costBand(event.standingCp, event.cpLoss)].word;
  if (event.confidence === null) {
    return `במהלך ${event.san} המהלך היה ${cost}.`;
  }
  const said = confidenceWord(event.confidence.level, event.confidence.scale);
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
