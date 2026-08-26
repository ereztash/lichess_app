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

  it("states the direction as what happened, never as a label about the player", () => {
    /*
     * The standing constraint: the product must not say more about the player than it measured.
     * "You are overconfident" is a trait; "you stated more confidence than came out" is the
     * measurement.
     */
    show(withMirror());
    const text = document.body.textContent ?? "";
    expect(text).toMatch(/הצהרתם יותר ביטחון ממה שיצא|הצהרתם פחות ביטחון ממה שיצא/);
    expect(text).not.toMatch(/אתם בטוחים מדי|אתם לא בטוחים מספיק|חלש ב/);
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
