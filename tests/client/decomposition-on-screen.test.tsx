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
    expect(screen.getByText(/בגודל כזה הפירוק הוא רעש, לא ממצא/)).toBeTruthy();
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
    expect(container.querySelector(".calibration-split")).toBeTruthy();
    expect(container.querySelectorAll(".calibration-split .split-row")).toHaveLength(3);
  });
});
