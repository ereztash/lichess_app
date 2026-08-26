// @vitest-environment jsdom
/**
 * The research range, on screen, and what it must never be allowed to become.
 *
 * Computing a reference class and leaving it in a module changes nothing: a bare 0.71 stays the
 * only thing anyone sees, and nobody knows whether 0.71 is good. So the range is beside the
 * figure -- and the two assertions that matter here are both negative, because a range on a
 * screen is one careless render away from being read as a grade.
 *
 *   - It must not appear beside a number that could not be read. A band next to a dash invites
 *     the reader to take the literature's median as their own result.
 *   - It must not appear without saying that the people in it scored about as accurately as the
 *     reader, and that their task was not chess. Without those two the range IS a grade.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CONFIDENCE_LEVELS, normaliseConfidence } from "@shared/confidence";
import { MIN_BUCKET_N, type ScoredDecision } from "@shared/detector";
import { sensitivityBand } from "@shared/sensitivity-reference";
import { readRecord } from "@shared/record-dashboard";
import { RecordDashboard } from "@/components/RecordDashboard";

const NON_ANCHOR_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

vi.mock("recharts", async () => ({
  ...((await vi.importActual("recharts")) as object),
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
    <div style={{ width: 400, height: 150 }}>{children}</div>
  ),
}));

/**
 * A record whose accuracy lands in a stratum the corpus supports, with enough of both outcomes
 * for the reader's own AUROC2 to be readable at all.
 *
 * Two thirds accurate, so it falls in the 0.6-0.7 band -- which is also where the whole Lichess
 * corpus sits under this product's own rule, at 64.9%.
 */
const run = (count: number, accurate: boolean, level: number, seed: number): ScoredDecision[] =>
  Array.from({ length: count }, (_, i) => ({
    decision_id: `d-${seed + i}`,
    fen: NON_ANCHOR_FEN,
    confidence: normaliseConfidence(level, CONFIDENCE_LEVELS),
    accurate,
    phase: "middlegame" as const,
    secondsTaken: 30,
    clockMsRemaining: 120_000,
  }));

const readable = [
  ...run(2 * MIN_BUCKET_N + 6, true, 6, 0),
  ...run(MIN_BUCKET_N + 3, false, 2, 500),
];

describe("the reading is shown against a reference class, not on its own", () => {
  it("puts the range on the screen at the percentiles the band publishes", () => {
    const reading = readRecord(readable);
    expect(reading.sensitivity.readable).toBe(true);
    const reference = sensitivityBand(reading.overall.accuracyRate);
    expect(reference, "the fixture landed outside every stratum").not.toBeNull();
    const low = reference!.percentiles.find((p) => p.p === 10)!.auroc2.toFixed(2);
    const high = reference!.percentiles.find((p) => p.p === 90)!.auroc2.toFixed(2);
    render(<RecordDashboard reading={reading} />);
    expect(screen.getByText(new RegExp(`במחקר\\s*${low}.*${high}`))).toBeTruthy();
  });

  it("says the people in it scored about as accurately as the reader", () => {
    /*
     * The load-bearing half of the caveat. AUROC2 climbs steeply with first-order accuracy, so a
     * range presented as "everyone" would tell a strong player they are metacognitively gifted
     * for being good at chess.
     */
    render(<RecordDashboard reading={readRecord(readable)} />);
    expect(screen.getByText(/דייקו בערך כמוכם/)).toBeTruthy();
    expect(screen.getByText(/ההבחנה עולה עם הדיוק עצמו/)).toBeTruthy();
  });

  it("says the task behind the range is not chess", () => {
    // Conditioning on accuracy narrows the mismatch between a psychophysics subject and a chess
    // player. It does not close it, and a reader who is not told assumes it was closed.
    render(<RecordDashboard reading={readRecord(readable)} />);
    expect(screen.getByText(/אינה שחמט/)).toBeTruthy();
  });

  it("names the corpus, so the range is attributable rather than asserted", () => {
    render(<RecordDashboard reading={readRecord(readable)} />);
    expect(screen.getByText(/Rahnev/)).toBeTruthy();
  });

  it("renders no range beside a number that could not be read", () => {
    /*
     * THE NEGATIVE THAT MATTERS MOST. The figure renders as a dash here, and a range beside a
     * dash is an invitation to read the literature's median as your own result.
     *
     * THE FIXTURE HAS TO LAND IN A SUPPORTED STRATUM or it proves nothing, and the first version
     * of this test did not. It used an all-accurate record, whose accuracy rate is 1.0 -- for
     * which the corpus has no stratum anyway -- so the reading came back null for the wrong
     * reason and a positive control removing the readability check survived. Three quarters
     * accurate lands in the 0.7-0.8 band, which the corpus supports, while staying under the
     * floor on both outcomes.
     */
    const thin = readRecord([
      ...run(MIN_BUCKET_N - 9, true, 6, 0),
      ...run(9, false, 2, 900),
    ]);
    expect(thin.overall.accuracyRate).toBeGreaterThanOrEqual(0.7);
    expect(thin.overall.accuracyRate).toBeLessThan(0.8);
    expect(sensitivityBand(thin.overall.accuracyRate), "the stratum is absent, so this proves nothing").not.toBeNull();
    expect(thin.sensitivity.readable).toBe(false);
    expect(thin.sensitivityReference).toBeNull();
    render(<RecordDashboard reading={thin} />);
    expect(screen.queryAllByText(/במחקר/)).toHaveLength(0);
    expect(screen.queryAllByText(/דייקו בערך כמוכם/)).toHaveLength(0);
  });

  it("renders no range where the corpus has no stratum for this reader's accuracy", () => {
    /*
     * A real case: the corpus holds only 161 people above 90% accuracy, under the floor, so that
     * stratum is absent. A reader who is that accurate gets no range -- not the unconditioned
     * one, which is precisely where the confound is largest.
     */
    const veryAccurate = [
      ...run(20 * MIN_BUCKET_N, true, 6, 0),
      ...run(MIN_BUCKET_N + 1, false, 2, 5000),
    ];
    const reading = readRecord(veryAccurate);
    expect(reading.overall.accuracyRate).toBeGreaterThan(0.9);
    expect(reading.sensitivity.readable).toBe(true);
    expect(reading.sensitivityReference).toBeNull();
    render(<RecordDashboard reading={reading} />);
    expect(screen.queryAllByText(/במחקר/)).toHaveLength(0);
  });
});
