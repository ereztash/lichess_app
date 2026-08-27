/**
 * The menu is an instrument, and until now nobody could measure it.
 *
 * Two questions on the commitment screen -- what you can read here, what you cannot evaluate --
 * are answered by tapping from a fixed list, with a free-text box beside it for the position the
 * list does not describe. `composeStatement` joined the taps and the typing with " · " and stored
 * one string, and `client/src/lib/read-options.ts` said so in as many words: "a selected option
 * and the same words typed by hand are indistinguishable in the record."
 *
 * SO THE ONE SIGNAL THE PRODUCT HAS ABOUT ITS OWN WORDS WAS DESTROYED AT WRITE TIME. Every escape
 * to free text is a measurement that the list failed -- the thing in front of the player was not
 * in it -- and what they typed is the missing words. That is the whole method for deciding what
 * the words should be, and it needs no interview, no model in the loop and no new screen.
 *
 * This file holds the reading. The write path is held next door in
 * `the-parts-a-read-was-said-in.test.ts`, because a reading of a field nothing fills is a reading
 * of nothing.
 */
import { describe, expect, it } from "vitest";
import { readVocabulary, type VocabularyInput } from "@shared/vocabulary-reading";

const KNOWN = ["המרכז סגור", "המרכז פתוח", "מלך חשוף", "יש נקודה חלשה לתפוס"];
const UNKNOWN = ["לא יודע איך הוא יענה", "לא מכיר את העמדה הזו"];
const LISTS = { known: KNOWN, unknown: UNKNOWN };

/** One decision, from the reading's point of view. */
const said = (tapped: string[], typed = ""): VocabularyInput => ({
  knownParts: { tapped, typed },
  unknownParts: { tapped: [], typed: "" },
});

/** A decision from before the parts existed. */
const unrecorded: VocabularyInput = { knownParts: null, unknownParts: null };

describe("how often the list failed", () => {
  it("counts an escape to free text, and states the denominator it is out of", () => {
    const reading = readVocabulary(
      [said(["המרכז סגור"]), said([], "הרגל על d5 מקובע ואין לי איך לתקוף אותו"), said(["מלך חשוף"])],
      LISTS,
    );
    expect(reading.known.recorded).toBe(3);
    expect(reading.known.escaped).toBe(1);
    // Typed with nothing tapped: the list did not even start them off, which is the worse case.
    expect(reading.known.typedOnly).toBe(1);
  });

  it("keeps what was typed, verbatim, because that IS the answer being looked for", () => {
    const words = "הרגל על d5 מקובע";
    const reading = readVocabulary([said(["המרכז סגור"], words)], LISTS);
    expect(reading.known.typed).toEqual([words]);
    // Tapping AND typing is one decision that escaped, not two answers.
    expect(reading.known.escaped).toBe(1);
    expect(reading.known.typedOnly, "a decision that also tapped was counted as typed-only").toBe(0);
  });

  it("does not count whitespace as an escape", () => {
    // A focused-then-abandoned box leaves a space. That is not a word the list is missing.
    const reading = readVocabulary([said(["המרכז סגור"], "   ")], LISTS);
    expect(reading.known.escaped).toBe(0);
    expect(reading.known.typed).toEqual([]);
  });
});

describe("the decisions nobody recorded parts for", () => {
  it("counts them out of the denominator rather than into the numerator", () => {
    /*
     * THE ONE THING THAT WOULD MAKE EVERY NUMBER HERE A LIE. A row written before the parts
     * existed carries null, which means "nobody recorded this" -- not "tapped nothing and typed
     * nothing". Read as an un-escaped decision it would say the list worked in a decision where
     * nobody looked, and the escape rate would FALL as the old record grew: the more history a
     * player has, the better the menu would appear to be doing.
     */
    const reading = readVocabulary([said([], "מילים חסרות"), unrecorded, unrecorded], LISTS);
    expect(reading.known.recorded, "an unreadable row was counted as a readable one").toBe(1);
    expect(reading.known.escaped).toBe(1);
    expect(reading.known.unrecorded, "the size of the hole is not stated").toBe(2);
  });
});

describe("which options nobody picks", () => {
  it("lists every option the menu offers, including the ones at zero", () => {
    // A zero is the finding. An option missing from the output would be a finding thrown away.
    const reading = readVocabulary([said(["המרכז סגור"]), said(["המרכז סגור", "מלך חשוף"])], LISTS);
    expect(reading.known.options).toEqual([
      { label: "המרכז סגור", chosen: 2 },
      { label: "המרכז פתוח", chosen: 0 },
      { label: "מלך חשוף", chosen: 1 },
      { label: "יש נקודה חלשה לתפוס", chosen: 0 },
    ]);
  });

  it("counts a decision once, however many times one option appears in it", () => {
    const reading = readVocabulary([said(["המרכז סגור", "המרכז סגור"])], LISTS);
    expect(reading.known.options[0].chosen).toBe(1);
  });

  it("names a tapped label the list does not offer, rather than dropping it", () => {
    /*
     * A record older than a rewording still names what its player was shown. Silently discarding
     * it would erase exactly the decisions taken under the words being replaced.
     */
    const reading = readVocabulary([said(["יתרון מרחב"]), said(["יתרון מרחב"])], LISTS);
    expect(reading.known.unrecognised).toEqual([{ label: "יתרון מרחב", chosen: 2 }]);
    expect(reading.known.options.every((option) => option.chosen === 0)).toBe(true);
  });
});

describe("which options mean the same thing to a player", () => {
  it("counts a pair against how often EITHER was picked, not just how often both were", () => {
    /*
     * THE NUMBER THAT MAKES THE PAIR MEAN ANYTHING, and the one an obvious implementation gets
     * wrong. Counting `either` in the same loop that counts `together` can only ever see
     * decisions where both appeared -- so `either` would equal `together`, the ratio would be 1,
     * and every pair that ever co-occurred once would look like two words for one thing.
     *
     * Here: the two centre options co-occur once, and one of them appears alone three more times.
     * A real duplicate would be at four of four.
     */
    const reading = readVocabulary(
      [
        said(["המרכז סגור", "המרכז פתוח"]),
        said(["המרכז סגור"]),
        said(["המרכז סגור"]),
        said(["המרכז סגור"]),
      ],
      LISTS,
    );
    const pair = reading.known.pairs[0];
    expect(pair.together).toBe(1);
    expect(pair.either, "either was counted only where both appeared").toBe(4);
  });

  it("finds the duplicate when there is one", () => {
    const reading = readVocabulary(
      [said(["מלך חשוף", "יש נקודה חלשה לתפוס"]), said(["מלך חשוף", "יש נקודה חלשה לתפוס"])],
      LISTS,
    );
    const [pair] = reading.known.pairs;
    expect(pair.together).toBe(2);
    expect(pair.either).toBe(2);
  });

  it("counts a pair once rather than once per order", () => {
    const reading = readVocabulary(
      [said(["המרכז סגור", "מלך חשוף"]), said(["מלך חשוף", "המרכז סגור"])],
      LISTS,
    );
    expect(reading.known.pairs).toHaveLength(1);
    expect(reading.known.pairs[0].together).toBe(2);
  });
});

describe("the two fields are read separately", () => {
  it("does not pool what was said about the position with what was said about the doubt", () => {
    const reading = readVocabulary(
      [
        {
          knownParts: { tapped: ["המרכז סגור"], typed: "" },
          unknownParts: { tapped: [], typed: "לא יודע אם יש לי זמן לזה" },
        },
      ],
      LISTS,
    );
    expect(reading.known.escaped).toBe(0);
    expect(reading.unknown.escaped).toBe(1);
    expect(reading.unknown.typed).toEqual(["לא יודע אם יש לי זמן לזה"]);
    expect(reading.unknown.options.map((option) => option.label)).toEqual(UNKNOWN);
  });
});

describe("nothing here is a rate", () => {
  it("returns counts and their denominator, and divides nothing", () => {
    /*
     * R1, and GATE-DENOM enforces it on any screen. A rate computed here would arrive somewhere
     * without the n that produced it, and "half the decisions escaped" reads identically at n=2
     * and n=200.
     */
    const reading = readVocabulary([said([], "x"), said(["המרכז סגור"])], LISTS);
    for (const value of Object.values(reading.known)) {
      if (typeof value !== "number") continue;
      expect(Number.isInteger(value), `${value} is not a count`).toBe(true);
    }
  });
});
