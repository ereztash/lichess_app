// @vitest-environment jsdom
/**
 * Four reasons the control cell is empty, and it rendered one dash for all of them.
 *
 * `Control.reason` was computed with four distinct values -- `ok`, `too-few`, `flat-time`,
 * `flat-confidence` -- and the dashboard rendered
 * `control.readable && control.rho !== null ? control.rho.toFixed(2) : "—"`. Every unreadable
 * cause produced the identical bare dash and the reason reached no screen at all. The distinction
 * was built in the shared code and thrown away at the last step.
 *
 * WHY IT IS NOT COSMETIC. The advice differs by reason, and two of them are not waits. A player
 * who took the same time over every decision cannot fix that cell by playing more; a player with
 * twelve decisions can. Telling both of them nothing tells the first one to keep going, silently
 * and wrongly -- the same shape as reporting a refusal as a missing database, one panel over.
 */
import { render, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CONFIDENCE_LEVELS, normaliseConfidence } from "@shared/confidence";
import { MIN_BUCKET_N, type ScoredDecision } from "@shared/detector";
import { ANCHOR_POSITIONS } from "@shared/anchor-set";
import { readRecord } from "@shared/record-dashboard";
import { RecordDashboard } from "@/components/RecordDashboard";

vi.mock("recharts", async () => ({
  ...((await vi.importActual("recharts")) as object),
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
    <div style={{ width: 400, height: 150 }}>{children}</div>
  ),
}));

/*
 * ANCHOR positions, because `effortFollowsDoubt` runs on the anchor set alone -- the coefficient
 * is only comparable between players who faced the same positions. A fixture built on free-play
 * FENs would leave the cell at `too-few` in every case below, and every assertion here would pass
 * for the wrong reason.
 */
const anchors = ANCHOR_POSITIONS.map((entry) => entry.fen);

function rng(seed: number) {
  let state = seed >>> 0;
  return () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const build = (
  n: number,
  each: (i: number, next: () => number) => { confidence: number; secondsTaken: number },
  seed = 5,
): ScoredDecision[] => {
  const next = rng(seed);
  return Array.from({ length: n }, (_, i) => {
    const { confidence, secondsTaken } = each(i, next);
    return {
      decision_id: `d-${i}`,
      fen: anchors[i % anchors.length],
      accurate: i % 2 === 0,
      confidence: normaliseConfidence(confidence, CONFIDENCE_LEVELS),
      secondsTaken,
      phase: "middlegame" as const,
      clockMsRemaining: null,
    };
  });
};

const FLAT_TIME = () =>
  build(MIN_BUCKET_N + 20, (i) => ({
    confidence: 1 + (i % CONFIDENCE_LEVELS),
    secondsTaken: 30,
  }));
const FLAT_CONFIDENCE = () =>
  build(MIN_BUCKET_N + 20, (_i, next) => ({ confidence: 4, secondsTaken: 5 + next() * 90 }));
const TOO_FEW = () =>
  build(MIN_BUCKET_N - 5, (i, next) => ({
    confidence: 1 + (i % CONFIDENCE_LEVELS),
    secondsTaken: 5 + next() * 90,
  }));
const INSIDE_NOISE = () =>
  build(
    MIN_BUCKET_N,
    (_i, next) => ({
      confidence: 1 + Math.floor(next() * CONFIDENCE_LEVELS),
      secondsTaken: 5 + next() * 120,
    }),
    20260826,
  );

const why = (decisions: ScoredDecision[]) => {
  const { container } = render(<RecordDashboard reading={readRecord(decisions)} />);
  return container.querySelector(".split-why")?.textContent ?? "";
};

const controlRow = (container: HTMLElement) =>
  [...container.querySelectorAll(".split-row")].find((node) =>
    within(node as HTMLElement).queryByText(/מאמץ שהולך אחרי הספק/),
  ) as HTMLElement;

describe("the empty cell names its own cause", () => {
  it("tells a player who took the same time over everything that more decisions cannot help", () => {
    const text = why(FLAT_TIME());
    expect(text).toMatch(/אותו זמן/);
    expect(text, "a structural dead end is described as a wait").toMatch(/לא ישנו את זה/);
  });

  it("says the same about the other variable when the confidence is what is flat", () => {
    const text = why(FLAT_CONFIDENCE());
    expect(text).toMatch(/אותו דבר/);
    expect(text).toMatch(/לא ישנו את זה/);
  });

  it("tells a short record it is short, and names the number it needs", () => {
    expect(why(TOO_FEW())).toMatch(new RegExp(String(MIN_BUCKET_N)));
  });

  it("tells a measured-but-flat record that it WAS measured", () => {
    /*
     * THE ONE THAT MUST NOT READ LIKE THE OTHER THREE. Enough decisions, both variables vary, the
     * coefficient was computed -- and it came out inside the noise. "Keep playing" is right here
     * and wrong for the flat cases, which is the whole reason they cannot share a sentence.
     */
    const text = why(INSIDE_NOISE());
    expect(text).toMatch(/נמדד/);
    expect(text).toMatch(/יחדדו/);
  });

  it("gives each cause its own sentence rather than one shared apology", () => {
    const said = [FLAT_TIME(), FLAT_CONFIDENCE(), TOO_FEW(), INSIDE_NOISE()].map(why);
    for (const [index, text] of said.entries())
      expect(text, `cause ${index} rendered nothing at all`).not.toBe("");
    expect(new Set(said).size, "two causes share one sentence").toBe(said.length);
  });

  it("says nothing extra once the coefficient is readable", () => {
    // A record with a real, strong association: the cell holds the number and no apology.
    const strong = build(300, (_i, next) => {
      const level = 1 + Math.floor(next() * CONFIDENCE_LEVELS);
      return { confidence: level, secondsTaken: 120 - level * 14 + next() * 10 };
    });
    const { container } = render(<RecordDashboard reading={readRecord(strong)} />);
    expect(container.querySelector(".split-why")).toBeNull();
    expect(within(controlRow(container)).getByText(/^-?0\.\d\d$/)).toBeTruthy();
  });

  it("does not print a coefficient beside a sentence disowning it", () => {
    // Both at once would be the worst of the two: a number the panel is simultaneously retracting.
    const { container } = render(<RecordDashboard reading={readRecord(INSIDE_NOISE())} />);
    const row = controlRow(container);
    expect(within(row).queryByText(/^-?0\.\d\d$/)).toBeNull();
    expect(within(row).getByText("—")).toBeTruthy();
  });
});
