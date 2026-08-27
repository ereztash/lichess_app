// @vitest-environment jsdom
/**
 * The profile, RENDERED.
 *
 * A source grep would pass while the sentence said nothing -- this session has already shipped
 * that mistake once, on the phase caveat, where a mutation rewriting the opening sentence left the
 * interpolations in place and the test green.
 *
 * WHAT THIS PANEL HAS TO GET RIGHT, and each is a defect it exists to prevent:
 *   - one finding per variable, so a weakness is not reported three times;
 *   - the mirrored level said to be a CONSEQUENCE, so a player does not read it as a second problem;
 *   - the crossed cells' denominator, so silence is a state rather than a blank;
 *   - a cell that can never fill held apart from one that is merely short.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProfilePanel } from "../../client/src/components/ProfilePanel";
import { CONFIDENCE_LEVELS, normaliseConfidence } from "@shared/confidence";
import { detect, seededRandom, type ScoredDecision } from "@shared/detector";
import { readVariables } from "@shared/bucket-variable";
import { crossVariables } from "@shared/crossing";

const FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** Miscalibrated in the middlegame and nowhere else -- the fixture the whole finding came from. */
function oneWeakness(n: number, rand: () => number): ScoredDecision[] {
  return Array.from({ length: n }, (_, i) => {
    const r = rand();
    const phase = (r < 0.25 ? "opening" : r < 0.75 ? "middlegame" : "endgame") as ScoredDecision["phase"];
    const stated = normaliseConfidence(1 + Math.floor(rand() * CONFIDENCE_LEVELS), CONFIDENCE_LEVELS);
    return {
      decision_id: `d-${i}`,
      fen: FEN,
      confidence: stated,
      accurate: rand() < (phase === "middlegame" ? Math.max(0, stated - 0.3) : stated),
      phase,
      secondsTaken: 60 + rand() * 60,
      clockMsRemaining: null,
    };
  });
}

const show = (decisions: ScoredDecision[]) =>
  render(
    <ProfilePanel
      variables={readVariables(detect(decisions))}
      crossing={crossVariables(decisions)}
    />,
  );

/** A seed whose run produced a mirrored level, so the mirror sentence has something to render. */
function withMirror(): ScoredDecision[] {
  for (let seed = 1000; seed < 1400; seed += 1) {
    const decisions = oneWeakness(240, seededRandom(seed));
    if (readVariables(detect(decisions)).findings[0]?.mirrored.length) return decisions;
  }
  throw new Error("no seed produced a mirrored level");
}

describe("nothing here is a claim, and it says so", () => {
  /*
   * THE GAP THAT MADE THIS NECESSARY. These rows come out of `detect` -- the same candidates a
   * Layer B claim is drawn from -- but they are not `Claim` objects, so GATE-GRADE does not
   * govern them. In a product whose discipline is that a claim renders at its grade, a row that
   * reads like a finding and carries no grade is the one place a statement about the player
   * escapes the rule: by not being shaped like the thing the rule checks.
   */
  it("says the panel describes rather than claims, before saying anything else", () => {
    /*
     * ASSERTED AS VISIBLE, NOT AS PRESENT, and the difference is not pedantry.
     *
     * `getByText` and `document.body.textContent` both find text inside a `hidden` element, so
     * the first version of this passed against a mutation that added `hidden` to the paragraph --
     * a sentence in the DOM and not on the screen, which for a caveat is the same as no sentence.
     * Every other text assertion in this file is about content that would be meaningless if
     * invisible anyway; this one is about a reader seeing a warning, so it checks that.
     */
    show(withMirror());
    const status = screen.getByText(/תיאור של הרשומה, לא טענה שנבדקה/);
    expect(status).toBeVisible();
  });

  it("says no refutation condition and no drill stand behind it", () => {
    // The two things that make a claim a claim in this product. Their absence is the point.
    show(withMirror());
    expect(document.body.textContent).toMatch(/אין לזה תנאי הפרכה/);
    expect(document.body.textContent).toMatch(/אף דריל לא העמיד/);
  });

  it("says it on an empty record too, where a reader has least context", () => {
    show([]);
    expect(document.body.textContent).toMatch(/לא טענה שנבדקה/);
  });
});

describe("with nothing separated", () => {
  it("says so rather than rendering an empty list", () => {
    show([]);
    expect(document.body.textContent).toMatch(/אף משתנה עדיין לא נפרד/);
  });

  it("still prints the crossing denominator, so the silence has a size", () => {
    show([]);
    expect(document.body.textContent).toMatch(/תאים מוצלבים/);
  });
});

describe("one weakness, one finding", () => {
  it("names the variable and the level, once", () => {
    show(withMirror());
    const labels = document.querySelectorAll(".profile-panel__variable");
    expect(labels.length).toBe(1);
    expect(document.body.textContent).toContain("שלב המשחק");
    expect(document.body.textContent).toMatch(/החלטות באמצע המשחק/);
  });

  it("says the mirrored level is a consequence and not a second finding", () => {
    /*
     * THE SENTENCE THE MEASUREMENT EXISTS FOR. Without it a player reads two problems where the
     * record contains one, and the second is a phase they are calibrated in.
     */
    show(withMirror());
    expect(screen.getByText(/אותה מדידה מהצד השני/)).toBeTruthy();
    expect(document.body.textContent).toMatch(/ולא ממצא נוסף/);
  });

  it("states the direction as the comparison it measured, never as a label about the player", () => {
    /*
     * THE PRINCIPLE WAS RIGHT AND THE STRING IT ASSERTED WAS AN INSTANCE OF WHAT IT FORBADE.
     *
     * This asserted "הצהרתם יותר ביטחון ממה שיצא" -- "you stated more confidence than came out" --
     * and its own comment explained that a trait is forbidden and a measurement is required. But
     * that sentence is not the measurement either. `direction()` is handed `gapDifference`, which
     * is `inside.gap - outside.gap`: a CONTRAST between this cell and the rest of the record.
     * `detect` never tests a cell's own gap against zero, so the one number the function has
     * cannot support a statement about what happened INSIDE the cell.
     *
     * Reproduced on the real record: a player underconfident everywhere and least so in the
     * opening has inside.gap -0.050 against outside.gap -0.300, so gapDifference is +0.250 and
     * this line told them they had stated MORE confidence than came out in the one phase where
     * they had stated five points less.
     *
     * So the assertion moves to the contrast, and the forbidden-trait list grows to include the
     * absolute reading that used to be the expected value.
     */
    show(withMirror());
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/הביטחון המוצהר (גבוה|נמוך) יותר ביחס לתוצאה מאשר בשאר הרשומה/);
    // Traits, as before.
    expect(text).not.toMatch(/אתם בטוחים מדי|אתם לא בטוחים מספיק|חלש ב/);
    // ...and the absolute reading of a relative number, which is what this test used to require.
    expect(
      text,
      "a contrast spoken as a fact about the player inside the cell",
    ).not.toMatch(/הצהרתם יותר ביטחון ממה שיצא|הצהרתם פחות ביטחון ממה שיצא/);
  });

  it("carries the n the finding rests on", () => {
    show(withMirror());
    expect(document.body.textContent).toMatch(/על\s*\d+\s*החלטות/);
  });
});

describe("the crossing's denominator", () => {
  it("prints how many cells could be read out of how many were tried", () => {
    const decisions = oneWeakness(240, seededRandom(1000));
    const crossing = crossVariables(decisions);
    show(decisions);
    expect(document.body.textContent).toMatch(
      new RegExp(`\\(${crossing.measurable}/${crossing.tried}\\)`),
    );
  });

  it("holds an unfillable cell apart from a merely short one", () => {
    /*
     * R2. These decisions carry no clock, so every clock cell is unreachable however long the
     * player keeps going -- and "keep playing" said about them would be false.
     */
    show(oneWeakness(240, seededRandom(1000)));
    expect(document.body.textContent).toMatch(/לא יתמלאו לעולם/);
    expect(document.body.textContent).toMatch(/לא עניין של עוד החלטות/);
  });

  it("names the floor a cell has to clear", () => {
    show(oneWeakness(240, seededRandom(1000)));
    expect(document.body.textContent).toMatch(/לפחות\s*30\s*החלטות/);
  });
});
