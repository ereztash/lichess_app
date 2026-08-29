/**
 * Tensions between the player's own declarations.
 *
 * Two things this file is guarding, and they pull in opposite directions. One: the layer has to
 * fire on the drafts it exists for. Two: it has to stay silent everywhere else -- a question
 * that appears on an ordinary decision is noise, and noise on the commitment screen is what
 * made the screen unusable the first time.
 *
 * It also pins the property that lets the layer sit before the reveal at all: everything it says
 * comes from the draft, so there is nothing here the engine could have supplied.
 */
import { describe, expect, it } from "vitest";
import {
  CERTAIN,
  HIGH_CONFIDENCE_ASSERTION,
  HIGH_CONFIDENCE_LEVEL,
  MANY_UNKNOWNS,
  declaredTensions,
  foremostTension,
} from "@/lib/declared-tensions";
import { emptyDraft, type DraftDecision } from "@/lib/decision-session";
import { KNOWN_OPTIONS, UNKNOWN_OPTIONS } from "@/lib/read-options";
import { CONFIDENCE_LEVELS, EVEN_ODDS_LEVEL, normaliseConfidence } from "@shared/confidence";

const label = (options: typeof KNOWN_OPTIONS, id: string) => {
  const found = options.find((option) => option.id === id);
  if (!found) throw new Error(`no read option with id "${id}"`);
  return found.label;
};

const draft = (overrides: Partial<DraftDecision> = {}): DraftDecision => ({
  ...emptyDraft(),
  chosenMove: "g8f6",
  knownTags: [label(KNOWN_OPTIONS, "center-open")],
  unknownTags: [label(UNKNOWN_OPTIONS, "reply")],
  confidence: EVEN_ODDS_LEVEL,
  ...overrides,
});

/* The ids the checks are written against. A rename in read-options.ts makes the check inert
   rather than throwing, which is the right production behaviour and the wrong CI behaviour --
   so CI is where it is caught. */
describe("the checks reference options that exist", () => {
  it("resolves every id the tension rules are written against", () => {
    for (const id of ["center-closed", "center-open"]) {
      expect(
        KNOWN_OPTIONS.map((o) => o.id),
        `known option "${id}" was renamed`,
      ).toContain(id);
    }
    for (const id of ["theory", "plan"]) {
      expect(
        UNKNOWN_OPTIONS.map((o) => o.id),
        `unknown option "${id}" was renamed`,
      ).toContain(id);
    }
  });
});

describe("an ordinary decision states no tension", () => {
  it("says nothing about a moderate confidence with one open question", () => {
    expect(declaredTensions(draft())).toEqual([]);
  });

  it("says nothing before a confidence has been chosen", () => {
    expect(declaredTensions(draft({ confidence: null }))).toEqual([]);
  });

  it("says nothing about high confidence on its own", () => {
    expect(declaredTensions(draft({ confidence: CERTAIN, unknownTags: [] }))).toEqual([]);
  });

  it("says nothing about many open questions at a low confidence", () => {
    // The point of the unknown field is that it is allowed to be a lot. Answering it honestly
    // must never be what draws a question.
    const many = UNKNOWN_OPTIONS.slice(0, MANY_UNKNOWNS + 1).map((o) => o.label);
    expect(declaredTensions(draft({ unknownTags: many, confidence: 2 }))).toEqual([]);
  });

  it("says nothing about a fast decision at a moderate confidence", () => {
    expect(declaredTensions(draft({ confidence: EVEN_ODDS_LEVEL }))).toEqual([]);
  });

  it("says nothing about a fast top-of-scale decision with nothing left open", () => {
    // A confident recapture, decided in four seconds, is a real thing and not a contradiction.
    expect(declaredTensions(draft({ confidence: CERTAIN, unknownTags: [] }))).toEqual([]);
  });
});

describe("two readings that cannot both describe one position", () => {
  it("asks which one it is, without needing a confidence at all", () => {
    const both = [label(KNOWN_OPTIONS, "center-closed"), label(KNOWN_OPTIONS, "center-open")];
    const found = declaredTensions(draft({ knownTags: both, confidence: null }));
    expect(found).toHaveLength(1);
    expect(found[0].question).toContain(label(KNOWN_OPTIONS, "center-closed"));
    expect(found[0].question).toContain(label(KNOWN_OPTIONS, "center-open"));
  });

  it("outranks every confidence-based tension on the same draft", () => {
    const both = [label(KNOWN_OPTIONS, "center-closed"), label(KNOWN_OPTIONS, "center-open")];
    const loud = draft({
      knownTags: both,
      unknownTags: UNKNOWN_OPTIONS.slice(0, MANY_UNKNOWNS + 1).map((o) => o.label),
      confidence: CERTAIN,
    });
    expect(declaredTensions(loud).length).toBeGreaterThan(1);
    expect(foremostTension(loud)!.id).toMatch(/^exclusive-read:/);
  });
});

describe("certainty alongside a stated blind spot", () => {
  it("asks what the confidence rests on when the position is unfamiliar", () => {
    const found = declaredTensions(
      draft({
        unknownTags: [label(UNKNOWN_OPTIONS, "theory")],
        confidence: HIGH_CONFIDENCE_LEVEL,
      }),
    );
    expect(found.map((t) => t.id)).toContain("certainty-without-familiarity");
  });

  it("asks what the confidence is in when the plan is unknown", () => {
    const found = declaredTensions(
      draft({ unknownTags: [label(UNKNOWN_OPTIONS, "plan")], confidence: HIGH_CONFIDENCE_LEVEL }),
    );
    expect(found.map((t) => t.id)).toContain("certainty-without-plan");
  });

  it("stays quiet one step below the high-confidence threshold", () => {
    const found = declaredTensions(
      draft({
        unknownTags: [label(UNKNOWN_OPTIONS, "theory"), label(UNKNOWN_OPTIONS, "plan")],
        confidence: HIGH_CONFIDENCE_LEVEL - 1,
      }),
    );
    expect(found).toEqual([]);
  });
});

/**
 * The layer cannot see the clock, and these are the assertions that keep it that way.
 *
 * `fast-certainty` used to fire only on a draft under ten seconds old. `secondsTaken` is a
 * detector variable -- `fast-under-45s` in shared/detector.ts -- so that question was a treatment
 * applied to one arm of the very measurement the screen exists to take, and nothing recorded who
 * received it. Nothing replaced it: the substantive contradictions it caught are caught by the
 * time-free rules, at any speed.
 */
describe("no rule fires on how long the decision took", () => {
  it("no longer asks the question that was asked only of fast deciders", () => {
    const certain = draft({ confidence: CERTAIN });
    expect(declaredTensions(certain).map((t) => t.id)).not.toContain("fast-certainty");
  });

  it("never quotes a duration in a question or a basis", () => {
    /*
     * The signature is the real guarantee -- there is no clock left to pass. This pins the other
     * half: no rule may reach a duration by some other route and print it at the player.
     */
    const drafts = [
      draft({ confidence: CERTAIN }),
      draft({
        confidence: CERTAIN,
        unknownTags: UNKNOWN_OPTIONS.slice(0, MANY_UNKNOWNS + 1).map((o) => o.label),
      }),
      draft({
        knownTags: [label(KNOWN_OPTIONS, "center-closed"), label(KNOWN_OPTIONS, "center-open")],
        confidence: CERTAIN,
      }),
      draft({ confidence: CONFIDENCE_LEVELS, unknownTags: [label(UNKNOWN_OPTIONS, "theory")] }),
    ];
    for (const one of drafts) {
      for (const tension of declaredTensions(one)) {
        for (const text of [tension.question, tension.basis]) {
          expect(text, `a tension quoted a duration: "${text}"`).not.toMatch(/שניות|דקות/);
        }
      }
    }
  });
});

describe("every question carries the selections that produced it", () => {
  it("never returns a tension without a basis", () => {
    const loud = draft({
      knownTags: [label(KNOWN_OPTIONS, "center-closed"), label(KNOWN_OPTIONS, "center-open")],
      unknownTags: UNKNOWN_OPTIONS.slice(0, MANY_UNKNOWNS + 1).map((o) => o.label),
      confidence: CERTAIN,
    });
    const found = declaredTensions(loud);
    expect(found.length).toBeGreaterThan(0);
    for (const tension of found) {
      expect(tension.basis.trim(), `${tension.id} has no basis`).not.toBe("");
      expect(tension.id).toBeTruthy();
    }
  });

  it("asks rather than rules: every question ends in a question mark", () => {
    // A layer with no access to the position is not entitled to a finding.
    const loud = draft({
      knownTags: [label(KNOWN_OPTIONS, "center-closed"), label(KNOWN_OPTIONS, "center-open")],
      unknownTags: [
        label(UNKNOWN_OPTIONS, "theory"),
        label(UNKNOWN_OPTIONS, "plan"),
        label(UNKNOWN_OPTIONS, "reply"),
      ],
      confidence: CERTAIN,
    });
    const found = declaredTensions(loud);
    expect(found.length).toBeGreaterThan(0);
    for (const tension of found) {
      expect(tension.question.trim().endsWith("?"), `${tension.id} is phrased as a finding`).toBe(
        true,
      );
    }
  });
});

/**
 * The same unfinished 5→7 migration that had `shared/reveal.ts` printing "ביטחון 7 מתוך 5".
 *
 * `HIGH_CONFIDENCE` was the literal `4` — 75% when the scale had five buttons, and `EVEN_ODDS_LEVEL`
 * once it had seven. `CERTAIN` was the literal `5`, whose own doc comment named it "ודאי"; on the
 * seven-level scale button 5 is `סביר` at 65% and `ודאי` is button 7. Both were compared against
 * the raw level, and `CERTAIN` with `===`.
 *
 * MEASURED BEFORE THE FIX, three unknowns tapped and five seconds on the clock:
 *
 *     button 4 (שקול, 50%) -> certainty-without-familiarity   "ביטחון 4 מתוך 5"
 *     button 5 (סביר, 65%) -> all three                       "ביטחון 5 מתוך 5"
 *     button 6 (בטוח, 80%) -> certainty-without-familiarity   "ביטחון 6 מתוך 5"
 *     button 7 (ודאי, 95%) -> certainty-without-familiarity   "ביטחון 7 מתוך 5"
 *
 * A player who had just said 50/50 was asked what their certainty rested on, and the two rules
 * written for "the top of the scale" fired at `סביר` and were silent at both `בטוח` and `ודאי` —
 * they could not fire at the top of the scale.
 */
describe("the tensions fire on what the player asserted, not on a button number", () => {
  // Real ids, resolved through `label`, which throws on one that no longer exists -- so a renamed
  // option breaks this loudly instead of quietly reducing the fixture to two unknowns.
  const threeUnknowns = [
    label(UNKNOWN_OPTIONS, "theory"),
    label(UNKNOWN_OPTIONS, "plan"),
    label(UNKNOWN_OPTIONS, "reply"),
  ];

  it("does not ask a player who said even odds what their certainty rests on", () => {
    expect(normaliseConfidence(EVEN_ODDS_LEVEL, CONFIDENCE_LEVELS)).toBe(0.5);
    const found = declaredTensions(
      draft({ unknownTags: threeUnknowns, confidence: EVEN_ODDS_LEVEL }),
    );
    expect(found.map((t) => t.id)).not.toContain("certainty-without-familiarity");
    expect(found.map((t) => t.id)).not.toContain("certainty-with-open-questions");
  });

  it("fires the top-of-scale rules at the top of the scale", () => {
    // The whole point of `CERTAIN`. It was silent here.
    const found = declaredTensions(
      draft({ unknownTags: threeUnknowns, confidence: CONFIDENCE_LEVELS }),
    );
    expect(found.map((t) => t.id)).toContain("certainty-with-open-questions");
  });

  it("asks about high confidence at exactly the levels that assert enough", () => {
    for (let level = 1; level <= CONFIDENCE_LEVELS; level += 1) {
      const asserted = normaliseConfidence(level, CONFIDENCE_LEVELS);
      const ids = declaredTensions(
        draft({ unknownTags: [label(UNKNOWN_OPTIONS, "theory")], confidence: level }),
      ).map((t) => t.id);
      const shouldAsk = asserted >= HIGH_CONFIDENCE_ASSERTION;
      expect(ids.includes("certainty-without-familiarity"), `level ${level} asserts ${asserted}`).toBe(
        shouldAsk,
      );
    }
  });

  it("never prints a denominator that is not the scale on the screen", () => {
    for (let level = 1; level <= CONFIDENCE_LEVELS; level += 1) {
      for (const tension of declaredTensions(
        draft({ unknownTags: threeUnknowns, confidence: level }),
      )) {
        expect(tension.question, tension.question).not.toContain("מתוך 5");
        expect(tension.basis, tension.basis).not.toMatch(/\/5\b/);
      }
    }
  });
});
