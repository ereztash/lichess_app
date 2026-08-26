// @vitest-environment jsdom
/**
 * The population comparison, on screen, and the one way its absence could still mislead.
 *
 * A bucket's accuracy is mostly a property of the bucket. On 693,130 real Lichess moves the
 * middlegame is 12.6 points less accurate than everything else FOR EVERYONE, moves that took over
 * two minutes are 14.2 points worse, and the endgame is 14.2 points better. A row that shows a
 * player their middlegame rate alone is telling them a fact about chess in the second person, and
 * computing the comparison without rendering it leaves the screen in exactly that state.
 *
 * The negative assertion is the one that matters. A bucket with no baseline must render NOTHING
 * there -- not "0", which reads as "exactly average", a claim no corpus ever made about them.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CONFIDENCE_LEVELS, normaliseConfidence } from "@shared/confidence";
import { MIN_BUCKET_N, type ScoredDecision } from "@shared/detector";
import { populationBucket } from "@shared/population-baseline";
import { readRecord } from "@shared/record-dashboard";
import { RecordDashboard } from "@/components/RecordDashboard";

/** A position that is deliberately NOT in the anchor set: these are free-play records. */
const NON_ANCHOR_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

vi.mock("recharts", async () => ({
  ...((await vi.importActual("recharts")) as object),
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
    <div style={{ width: 400, height: 150 }}>{children}</div>
  ),
}));

const run = (
  count: number,
  over: { phase: ScoredDecision["phase"]; accurate: boolean; seed: number },
): ScoredDecision[] =>
  Array.from({ length: count }, (_, i) => ({
    decision_id: `d-${over.seed + i}`,
    fen: NON_ANCHOR_FEN,
    confidence: normaliseConfidence(4, CONFIDENCE_LEVELS),
    accurate: over.accurate,
    phase: over.phase,
    secondsTaken: 30,
    clockMsRemaining: 120_000,
  }));

/* Everything inside the middlegame accurate, everything outside it wrong: the record's own rate
 * inside is exactly 1, so the rendered figure is pinned to the baseline and nothing else. */
const readable = [
  ...run(MIN_BUCKET_N + 10, { phase: "middlegame", accurate: true, seed: 0 }),
  ...run(MIN_BUCKET_N + 10, { phase: "opening", accurate: false, seed: 500 }),
];

describe("the bucket is shown against the population, not on its own", () => {
  it("puts the comparison on the screen with the figure the reading computed", () => {
    render(<RecordDashboard reading={readRecord(readable)} />);
    const population = populationBucket("phase-middlegame")!;
    const points = Math.round((1 - population.accuracy) * 100);
    expect(points).toBeGreaterThan(0);
    /*
     * Matched on the ELEMENT's text, not on one text node. The figure is wrapped in `<bdi>` so
     * the bidirectional algorithm cannot drag its sign across the Hebrew beside it, which splits
     * the run into three nodes -- and a `getByText` regex spanning them silently stopped matching.
     * The assertion is about what a reader sees, so it reads the same thing a reader does.
     */
    const versus = document.querySelectorAll(".bucket-versus");
    const texts = [...versus].map((node) => node.textContent?.replace(/\s+/g, " ").trim() ?? "");
    expect(texts.some((text) => text === `+${points} נק׳ מול כולם`), texts.join(" | ")).toBe(true);
  });

  it("says what the comparison is against, so the number is not a bare figure", () => {
    // "מול כולם" is the whole claim: without it the row is two accuracies side by side and the
    // reader has no way to know the second one is not also about them.
    render(<RecordDashboard reading={readRecord(readable)} />);
    expect(screen.getAllByText(/מול כולם/).length).toBeGreaterThan(0);
  });

  it("renders nothing at all where the record cannot read the bucket", () => {
    /*
     * The threshold governs the comparison too. Rendering a population comparison for a bucket
     * holding eight decisions would hand the reader a figure whose provenance -- 693,130 moves --
     * looks far stronger than the half of the subtraction that is actually theirs.
     */
    const thin = readRecord(run(MIN_BUCKET_N - 3, { phase: "middlegame", accurate: true, seed: 0 }));
    expect(thin.buckets.every((b) => b.versusPopulation === null)).toBe(true);
    render(<RecordDashboard reading={thin} />);
    expect(screen.queryAllByText(/מול כולם/)).toHaveLength(0);
  });

  it("never renders a zero comparison for a bucket with no baseline", () => {
    /*
     * THE NEGATIVE THAT MATTERS. Null and zero are different states and render alike if the
     * component reaches for a default: "0 נק׳ מול כולם" reads as "exactly average", which is a
     * measurement, and no corpus made it. Asserted over the whole rendered surface rather than
     * one row, because the failure would be a default anywhere in the map.
     */
    const reading = readRecord(readable);
    const withoutBaseline = {
      ...reading,
      buckets: reading.buckets.map((b) => ({ ...b, versusPopulation: null })),
    };
    render(<RecordDashboard reading={withoutBaseline} />);
    expect(screen.queryAllByText(/מול כולם/)).toHaveLength(0);
    expect(screen.queryAllByText(/0 נק׳/)).toHaveLength(0);
  });
});
