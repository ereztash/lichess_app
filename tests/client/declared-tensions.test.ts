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
  FAST_DECISION_SECONDS,
  HIGH_CONFIDENCE,
  MANY_UNKNOWNS,
  declaredTensions,
  foremostTension,
} from "@/lib/declared-tensions";
import { emptyDraft, type DraftDecision } from "@/lib/decision-session";
import { KNOWN_OPTIONS, UNKNOWN_OPTIONS } from "@/lib/read-options";

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
  confidence: 3,
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
    expect(declaredTensions(draft(), 40)).toEqual([]);
  });

  it("says nothing before a confidence has been chosen", () => {
    expect(declaredTensions(draft({ confidence: null }), 40)).toEqual([]);
  });

  it("says nothing about high confidence on its own", () => {
    expect(declaredTensions(draft({ confidence: CERTAIN, unknownTags: [] }), 40)).toEqual([]);
  });

  it("says nothing about many open questions at a low confidence", () => {
    // The point of the unknown field is that it is allowed to be a lot. Answering it honestly
    // must never be what draws a question.
    const many = UNKNOWN_OPTIONS.slice(0, MANY_UNKNOWNS + 1).map((o) => o.label);
    expect(declaredTensions(draft({ unknownTags: many, confidence: 2 }), 40)).toEqual([]);
  });

  it("says nothing about a fast decision at a moderate confidence", () => {
    expect(declaredTensions(draft({ confidence: 3 }), 2)).toEqual([]);
  });

  it("says nothing about a fast top-of-scale decision with nothing left open", () => {
    // A confident recapture, decided in four seconds, is a real thing and not a contradiction.
    expect(declaredTensions(draft({ confidence: CERTAIN, unknownTags: [] }), 4)).toEqual([]);
  });
});

describe("two readings that cannot both describe one position", () => {
  it("asks which one it is, without needing a confidence at all", () => {
    const both = [label(KNOWN_OPTIONS, "center-closed"), label(KNOWN_OPTIONS, "center-open")];
    const found = declaredTensions(draft({ knownTags: both, confidence: null }), 40);
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
    expect(declaredTensions(loud, 2).length).toBeGreaterThan(1);
    expect(foremostTension(loud, 2)!.id).toMatch(/^exclusive-read:/);
  });
});

describe("certainty alongside a stated blind spot", () => {
  it("asks what the confidence rests on when the position is unfamiliar", () => {
    const found = declaredTensions(
      draft({
        unknownTags: [label(UNKNOWN_OPTIONS, "theory")],
        confidence: HIGH_CONFIDENCE,
      }),
      40,
    );
    expect(found.map((t) => t.id)).toContain("certainty-without-familiarity");
  });

  it("asks what the confidence is in when the plan is unknown", () => {
    const found = declaredTensions(
      draft({ unknownTags: [label(UNKNOWN_OPTIONS, "plan")], confidence: HIGH_CONFIDENCE }),
      40,
    );
    expect(found.map((t) => t.id)).toContain("certainty-without-plan");
  });

  it("stays quiet one step below the high-confidence threshold", () => {
    const found = declaredTensions(
      draft({
        unknownTags: [label(UNKNOWN_OPTIONS, "theory"), label(UNKNOWN_OPTIONS, "plan")],
        confidence: HIGH_CONFIDENCE - 1,
      }),
      40,
    );
    expect(found).toEqual([]);
  });
});

describe("top of the scale, decided fast, with something open", () => {
  it("asks once, and quotes the clock reading it was given", () => {
    const found = declaredTensions(draft({ confidence: CERTAIN }), 6);
    expect(found.map((t) => t.id)).toContain("fast-certainty");
    expect(found.find((t) => t.id === "fast-certainty")!.question).toContain("6 שניות");
  });

  it("stops at the threshold", () => {
    const deliberated = draft({ confidence: CERTAIN });
    expect(declaredTensions(deliberated, FAST_DECISION_SECONDS).map((t) => t.id)).not.toContain(
      "fast-certainty",
    );
  });
});

describe("every question carries the selections that produced it", () => {
  it("never returns a tension without a basis", () => {
    const loud = draft({
      knownTags: [label(KNOWN_OPTIONS, "center-closed"), label(KNOWN_OPTIONS, "center-open")],
      unknownTags: UNKNOWN_OPTIONS.slice(0, MANY_UNKNOWNS + 1).map((o) => o.label),
      confidence: CERTAIN,
    });
    const found = declaredTensions(loud, 3);
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
    const found = declaredTensions(loud, 3);
    expect(found.length).toBeGreaterThan(0);
    for (const tension of found) {
      expect(tension.question.trim().endsWith("?"), `${tension.id} is phrased as a finding`).toBe(
        true,
      );
    }
  });
});
