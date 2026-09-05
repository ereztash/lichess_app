// @vitest-environment jsdom
/**
 * The split, on screen, and the one way rendering it could still mislead.
 *
 * Computing Murphy's decomposition and leaving it in the reading changes nothing: the raw gap
 * stays the only thing anyone sees, which is the state this replaced. So the assertions here are
 * about the SURFACE.
 *
 * And the interesting one is negative. Three numbers rendered identically read as three of a
 * kind, and these are not: `reliability` is a statement about the player, `uncertainty` is a
 * property of the positions they happened to be served and says nothing about them at all. A row
 * that renders them the same way undoes the entire reason for splitting them -- the reader would
 * come away thinking their score is three-thirds theirs, which is exactly the misreading the
 * decomposition exists to prevent.
 */
import { render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { CONFIDENCE_LEVELS, normaliseConfidence } from "@shared/confidence";
import { calibrationScore } from "@shared/calibration-score";
import { readRecord } from "@shared/record-dashboard";
import type { ScoredDecision } from "@shared/detector";
import { RecordDashboard } from "@/components/RecordDashboard";

/** A position that is deliberately NOT in the anchor set: these are free-play records. */
const NON_ANCHOR_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/*
 * Only the responsive wrapper is stubbed, not the whole library. A blanket Proxy mock over
 * `recharts` hangs the run: React probes every export for `$$typeof` and friends, and a Proxy
 * that answers every property with a component makes those probes loop. The chart itself is not
 * under test here -- its container is simply zero-sized in jsdom and would render nothing.
 */
vi.mock("recharts", async () => ({
  ...((await vi.importActual("recharts")) as object),
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
    <div style={{ width: 400, height: 150 }}>{children}</div>
  ),
}));

const root = resolve(__dirname, "../..");

const at = (level: number) => normaliseConfidence(level, CONFIDENCE_LEVELS);
const run = (level: number, count: number, hits: number, seed: number): ScoredDecision[] =>
  Array.from({ length: count }, (_, i) => ({
    decision_id: `d-${seed + i}`,
    fen: NON_ANCHOR_FEN,
    confidence: at(level),
    accurate: i < hits,
    phase: "middlegame" as const,
    secondsTaken: 30,
    clockMsRemaining: 120_000,
  }));

/** A record big enough for the split to be readable at all. */
const readable = [...run(CONFIDENCE_LEVELS, 60, 51, 0), ...run(2, 60, 14, 100)];

describe("the split is on the screen, not just in the reading", () => {
  it("names the player's own term and the positions' term separately", () => {
    render(<RecordDashboard reading={readRecord(readable)} />);
    expect(screen.getByText("שגיאת הכיול")).toBeTruthy();
    expect(screen.getByText("קושי העמדות")).toBeTruthy();
    expect(screen.getByText("כוח ההבחנה")).toBeTruthy();
  });

  it("says out loud that only the first of the three is about the player", () => {
    // Without this sentence the heading is the only thing separating them, and a heading is not
    // an explanation. A reader who skims sees three numbers in a row and averages them.
    render(<RecordDashboard reading={readRecord(readable)} />);
    expect(screen.getByText(/רק שגיאת הכיול מדברת עליכם/)).toBeTruthy();
  });

  it("does not render the positions' term identically to the player's", () => {
    /*
     * Section 4.5, applied to a case it was not written for: distinct states must not render
     * alike. Here the two states are "this number is you" and "this number is the item bank",
     * and they sit side by side in one row.
     */
    const css = readFileSync(resolve(root, "client/src/index.css"), "utf8");
    const rule = css.slice(css.indexOf(".split-theirs dt,"));
    expect(
      rule.slice(0, rule.indexOf("}")),
      "the difficulty term renders exactly like the player's own error",
    ).toMatch(/opacity|font-weight|color/);
  });

  it("prints the terms as the squared quantities they are, not as percentages", () => {
    /*
     * THE DEFECT THIS CAUGHT. The first version rendered these through `Proportion`, which prints
     * `Math.round(value * 100)%` -- so a reliability of 0.016 came out as "2%", a percentage of
     * nothing at all. They are not rates: they are mean squared errors, and the literature they
     * are comparable against (Mandel & Barnes report CI = 0.016) prints them to three places.
     */
    const { container } = render(<RecordDashboard reading={readRecord(readable)} />);
    const split = container.querySelector(".calibration-split")!;
    expect(split.textContent, "a squared error is being shown as a percentage").not.toMatch(/%/);
    for (const cell of split.querySelectorAll("dd")) {
      expect(cell.textContent, `"${cell.textContent}" is not a three-place decimal`).toMatch(
        /^\d\.\d{3}$/,
      );
    }
  });
});

describe("it refuses to split a record too small to split", () => {
  it("says so rather than printing three numbers that are noise", () => {
    /*
     * RELIABILITY is biased upward in small samples -- at one decision per level it is at its
     * maximum by construction. The figures would still be arithmetically correct, which is
     * exactly what makes printing them dangerous: they look like a finding.
     */
    const thin = [...run(CONFIDENCE_LEVELS, 4, 3, 0), ...run(3, 3, 1, 50)];
    expect(calibrationScore(thin).reliable).toBe(false);
    render(<RecordDashboard reading={readRecord(thin)} />);
    expect(screen.queryByText("שגיאת הכיול")).toBeNull();
    /*
     * The sentence names the levels used and the decisions on them, not only the floor, because
     * that is what says how far off the reader is. `every` was tried as the rule here and is
     * falsified -- it never certifies and it is not monotone -- so this state is again exactly
     * "no level has been stated enough times", which is what it says.
     */
    expect(screen.getByText(/הפירוק הוא רעש הדגימה, לא ממצא עליכם/)).toBeTruthy();
    expect(screen.getByText(/אף רמת ביטחון עוד לא נאמרה 30 פעמים/)).toBeTruthy();
    expect(screen.getByText(/7 החלטות בסך הכול/)).toBeTruthy();
  });

  it("still shows the heading, so the absence is visible rather than silent", () => {
    // A section that vanishes entirely makes the surviving figures look like the whole picture,
    // which is the same defect the bucket rows were fixed for.
    const thin = [...run(CONFIDENCE_LEVELS, 4, 3, 0), ...run(3, 3, 1, 50)];
    render(<RecordDashboard reading={readRecord(thin)} />);
    expect(screen.getByText("ממה מורכב הפער")).toBeTruthy();
  });
});

describe("the raw gap has stopped being the last word", () => {
  it("keeps the gap on screen but no longer alone", () => {
    /*
     * The gap is not wrong and is not removed -- it is the thing a player recognises. What
     * changed is that it can no longer be read without the term that says how much of it was the
     * positions.
     */
    const { container } = render(<RecordDashboard reading={readRecord(readable)} />);
    expect(screen.getByText(/ביטחון־יתר|ביטחון־חסר/)).toBeTruthy();
    /*
     * Scoped to the FIRST panel. There are two now -- the Murphy split and the two facets it
     * cannot see -- and a document-wide row count silently became an assertion about both.
     */
    const panels = container.querySelectorAll(".calibration-split");
    expect(panels.length).toBeGreaterThanOrEqual(1);
    expect(panels[0].querySelectorAll(".split-row")).toHaveLength(3);
  });
});

describe("the two facets the gap cannot see reach the screen", () => {
  it("shows discrimination and effort, named for what they answer", () => {
    render(<RecordDashboard reading={readRecord(readable)} />);
    expect(screen.getByText("ההבחנה שלכם")).toBeTruthy();
    expect(screen.getByText("מאמץ שהולך אחרי הספק")).toBeTruthy();
  });

  it("prints discrimination as an area, not a percentage or a squared error", () => {
    /*
     * AUROC2 runs 0 to 1 with 0.5 as chance. Two decimal places, and never a percent sign: it is
     * not a rate, and the same defect that printed a mean squared error as "2%" would print this
     * as "71%" and invite the reader to compare it with their accuracy.
     */
    const { container } = render(<RecordDashboard reading={readRecord(readable)} />);
    const blocks = container.querySelectorAll(".calibration-split");
    const facets = blocks[blocks.length - 1];
    expect(facets.textContent, "an area under a curve is being shown as a percentage").not.toMatch(
      /%/,
    );
    const shown = facets.querySelector("dd")!.textContent!;
    expect(shown, `"${shown}" is not a two-place area`).toMatch(/^-?\d\.\d{2}$/);
  });

  it("says the effort number is confounded on the player's own games", () => {
    /*
     * The honest caveat, on screen rather than only in the module. On a player's own games "took
     * longer" and "felt less sure" are both caused by the position being hard, so the coefficient
     * says as much about the positions as about the player until it is read on shared ones.
     */
    render(<RecordDashboard reading={readRecord(readable)} />);
    expect(screen.getByText(/מעורבב עם קושי העמדה/)).toBeTruthy();
    expect(screen.getByText(/רק על הסט המשותף/)).toBeTruthy();
  });

  it("shows a dash rather than a number it cannot compute", () => {
    /*
     * A record where every decision went the same way has no false-alarm rate and therefore no
     * curve. Printing 0.50 there would say "this player has no discrimination" about a record
     * that cannot say anything.
     *
     * The sentence NAMES WHICH SIDE IS MISSING. It used to read "בלי שתיהן אין מה להפריד" for
     * every silent case, which is true of a record short of both and false of this one -- 60
     * decisions that all went well are not short of decisions that went well. The advice differs:
     * this player needs harder positions, not more of the same.
     */
    const oneSided = run(CONFIDENCE_LEVELS, 60, 60, 0);
    render(<RecordDashboard reading={readRecord(oneSided)} />);
    const note = screen.getByText(/החלטות שלא יצאו טוב/);
    expect(note).toBeTruthy();
    expect(note.textContent, "the reader is told to record more of what they already have").toMatch(
      /עמדות קשות יותר/,
    );
    expect(
      screen.queryByText(/בלי שתיהן אין מה להפריד/),
      "a one-sided record is described as short of both kinds",
    ).toBeNull();
  });
});
