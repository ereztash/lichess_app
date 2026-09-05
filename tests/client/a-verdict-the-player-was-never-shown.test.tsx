// @vitest-environment jsdom
/**
 * F3. `result !== null` was being spent as "the player was shown this".
 *
 * WHAT `result` MEANS. The engine ran and its verdict was written to the record. That is a fact
 * about the PRODUCER.
 *
 * WHAT THE PRODUCT WAS SAYING WITH IT. "נחשפו N החלטות" and "מה הכלי אמר לכם עד כה" -- both claims
 * about a CONSUMER, a person, having been shown something.
 *
 * THE TWO CAME APART AND THE REPOSITORY ALREADY KNEW IT. `measurement-protocol.ts`, on
 * `analysis_timing`: *"`Home.tsx` on the deferred game: THE ENGINE RUNS IN BOTH MODES; ONLY THE
 * TELLING DIFFERS ... it means `reveal_timing: "end-of-game"` does NOT say the engine was quiet."*
 * And `reveal-timing.ts` owns the rule that does the withholding: `mayShowVerdictNow` is false for
 * `end-of-game`, and a mid-game exception is refused there in as many words. So on a deferred game
 * the engine answers, the result is stored, and the product's own rule keeps the verdict off the
 * screen -- while every surface counting `result` reported those decisions as ones the player had
 * seen.
 *
 * THE LADDER, and only the first two rungs are in this record:
 *
 *     engine finished  ->  result stored  ->  reveal rendered  ->  human noticed / read
 *     [--------- the record witnesses these ---------]   [--- it does not ---]
 *
 * `reveal_presented` exists in `client/src/lib/acquisition-evidence.ts` and is the THIRD rung, for
 * the acquisition trial, behind an import-graph wall from `shared/`. It is not raised here and it
 * would not be enough if it were: rendered is not read.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRecordStore } from "../../server/record";
import * as service from "../../shared/record-service";
import { CONFIDENCE_LEVELS } from "@shared/confidence";
import { MIN_BUCKET_N } from "@shared/detector";
import { classifyPhase } from "@shared/phase";
import type { RevealTiming } from "@shared/reveal-timing";
import { RecordDashboard } from "@/components/RecordDashboard";

vi.mock("recharts", async () => ({
  ...((await vi.importActual("recharts")) as object),
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
    <div style={{ width: 400, height: 150 }}>{children}</div>
  ),
}));

const FREE_PLAY = "r2q1rk1/pp2bppp/2n1bn2/3pp3/3PP3/2N1BN2/PP2BPPP/R2Q1RK1 w - - 0 12";
const PLY = 30;

let seq = 0;
const nextId = () => `33333333-3333-4333-8333-${String(++seq).padStart(12, "0")}`;

/**
 * One committed decision, and one engine verdict written for it.
 *
 * NOTHING HERE PRESENTS ANYTHING. That is the whole fixture: it is exactly the state a deferred
 * game reaches while it is still being played -- committed, scored, and not yet told.
 */
async function recordAndScore(
  store: MemoryRecordStore,
  options: { revealTiming: RevealTiming; confidence: number | null; accurate: boolean },
) {
  const id = nextId();
  await service.commitDecision(store, {
    decision_id: id,
    entry_state: {
      game_id: "g",
      fen: FREE_PLAY,
      ply: PLY,
      phase: classifyPhase(FREE_PLAY, PLY),
      clock_ms_remaining: null,
    },
    purpose: "play",
    drill_id: null,
    transfer_id: null,
    known: "המרכז פתוח",
    unknown: "לא יודע איך הוא יענה",
    known_parts: { tapped: ["המרכז פתוח"], typed: "" },
    unknown_parts: { tapped: ["לא יודע איך הוא יענה"], typed: "" },
    decision: options.accurate ? "d4d5" : "d4c4",
    bounded_action: {
      seconds_taken: 20,
      confidence: options.confidence,
      /*
       * The scale is stated even where the confidence is not: `commitDecision` refuses a decision
       * that does not say which scale its player answered on, whether or not one was asked for.
       */
      confidence_scale: CONFIDENCE_LEVELS,
      candidate_moves_considered: ["d4d5"],
    },
    probe: null,
    reveal_timing: options.revealTiming,
    measurement_protocol: null,
    protocol_version: null,
    analysis_timing: null,
    result: null,
    feedback: null,
  });
  await service.reveal(store, id, {
    engine_eval_cp: 20,
    engine_best_move: "d4d5",
    engine_depth: 18,
    engine_source: "local_sf18",
    engine_build: "sf18-test-build",
    cp_loss: options.accurate ? 0 : 300,
  });
}

const fill = (
  store: MemoryRecordStore,
  n: number,
  options: { revealTiming: RevealTiming; confidence: number | null; accurate: boolean },
) =>
  Array.from({ length: n }, () => options).reduce(
    (chain, o) => chain.then(() => recordAndScore(store, o)),
    Promise.resolve(),
  );

describe("a stored verdict is not a verdict the player was shown", () => {
  it("does not tell a deferred player the tool has already told them things", async () => {
    /*
     * THE MINIMAL COUNTEREXAMPLE. Thirty decisions in a deferred game: committed, engine ran,
     * verdicts stored, and by `mayShowVerdictNow` not one of them was put on a screen.
     *
     * The panel headed "מה הכלי אמר לכם עד כה" then distributed those thirty across four sentences
     * the player had never read, and its own note opened "מתוך N ההחלטות".
     */
    const store = new MemoryRecordStore();
    await fill(store, MIN_BUCKET_N, {
      revealTiming: "end-of-game",
      confidence: CONFIDENCE_LEVELS,
      accurate: true,
    });
    const reading = await service.recordReading(store);
    expect(reading.mix.n, "the engine did answer on all of them").toBe(MIN_BUCKET_N);

    // The record can say the rule withheld every one of them, because the rule is in the record.
    expect(reading.mix.withheld).toBe(MIN_BUCKET_N);

    render(<RecordDashboard reading={reading} />);
    /*
     * The panel says what the record can witness: the engine answered, and on these decisions the
     * rule held the sentence back. (The HEADING no longer claims presentation on any record --
     * that is F4's separate reason, and its own test pins it.)
     */
    expect(screen.getByText(/הכלי החזיק את המשפט עד סוף המשחק/)).toBeTruthy();
    expect(screen.getByText(/היא לא מתעדת מתי, ואם, קראתם את התשובה/)).toBeTruthy();
  });

  it("does not call a verdict nobody was shown a decision that was revealed", async () => {
    /*
     * The other surface, and it needs one decision rather than thirty. A deferred decision on which
     * the sampler did not put the confidence question lands in `withoutConfidence`, and the empty
     * state opened "N החלטות נחשפו" -- said about a decision the product had deliberately not shown.
     */
    const store = new MemoryRecordStore();
    await fill(store, 1, { revealTiming: "end-of-game", confidence: null, accurate: true });
    const reading = await service.recordReading(store);
    expect(reading.scored).toBe(0);
    expect(reading.withoutConfidence).toBe(1);

    render(<RecordDashboard reading={reading} />);
    expect(screen.queryByText(/החלטות נחשפו/)).toBeNull();
    expect(screen.getByText(/המנוע ענה על 1 החלטות/)).toBeTruthy();
  });

  it("still counts the coached record as one the tool spoke on", async () => {
    /*
     * THE POSITIVE CONTROL, and it is the reason this cannot be fixed by deleting the sentence.
     * Under `per-decision` the same rule PERMITS the verdict at the commitment -- that is what the
     * mode is -- so nothing in the record withheld anything, and the panel says what it always said.
     */
    const store = new MemoryRecordStore();
    await fill(store, MIN_BUCKET_N, {
      revealTiming: "per-decision",
      confidence: CONFIDENCE_LEVELS,
      accurate: true,
    });
    const reading = await service.recordReading(store);
    expect(reading.mix.n).toBe(MIN_BUCKET_N);
    expect(reading.mix.withheld).toBe(0);

    render(<RecordDashboard reading={reading} />);
    // Nothing was held back, so the sentence that says something was does not appear.
    expect(screen.queryByText(/הכלי החזיק את המשפט עד סוף המשחק/)).toBeNull();
    expect(document.querySelector(".mix-block")).not.toBeNull();
  });

  it("keeps `result` as scoring completion, which is the reading it can carry", async () => {
    /*
     * THE BOUNDARY. This repair does not make `result` mean less everywhere -- it separates the two
     * readings. A deferred decision is still scored, still in the calibration, still in the buckets:
     * the engine answered, and that is exactly what the detector needs from it.
     */
    const store = new MemoryRecordStore();
    await fill(store, MIN_BUCKET_N, {
      revealTiming: "end-of-game",
      confidence: CONFIDENCE_LEVELS,
      accurate: true,
    });
    const reading = await service.recordReading(store);
    expect(reading.scored).toBe(MIN_BUCKET_N);
    expect(reading.overall.accuracyRate).toBe(1);
    expect(reading.awaitingReveal).toBe(0);
  });
});
