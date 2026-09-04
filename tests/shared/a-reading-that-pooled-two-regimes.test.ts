/**
 * F1. The wall `two-regimes-are-not-one-population.test.ts` built for discovery, on the surface a
 * player actually reads.
 *
 * WHAT WAS ALREADY TRUE. `evidence-policy.ts` stratifies the DISCOVERY population by the conditions
 * that make two decisions comparable -- protocol, its version, reveal timing, engine build -- and
 * says in as many words that there is deliberately no function that flattens strata back into one.
 *
 * WHAT WAS NOT. `forDescriptiveHistory` returned a flat `EvidenceSet`, `scoreDecisions` turned it
 * into `ScoredDecision[]`, and `readRecord` averaged the lot. So the record page -- the calibration
 * gap, its three-term split, the six buckets, the discrimination area -- was computed across
 * regimes that the same repository refuses to pool one module away. The old shape let a caller pool
 * by doing nothing at all, which is exactly how the discovery defect survived the policy module
 * written to prevent it.
 *
 * THE COUNTEREXAMPLE IS THE MINIMUM: two sets of decisions identical in every field but
 * `reveal_timing`, with opposite outcomes, so pooling is visible as one number instead of two.
 */
import { describe, expect, it } from "vitest";
import { MemoryRecordStore } from "../../server/record";
import * as service from "../../shared/record-service";
import { CONFIDENCE_LEVELS } from "../../shared/confidence";
import { classifyPhase } from "../../shared/phase";
import type { RevealTiming } from "../../shared/reveal-timing";

const FREE_PLAY = "r2q1rk1/pp2bppp/2n1bn2/3pp3/3PP3/2N1BN2/PP2BPPP/R2Q1RK1 w - - 0 12";
const PLY = 30;

let seq = 0;
const nextId = () => `22222222-2222-4222-8222-${String(++seq).padStart(12, "0")}`;

/** One free-play decision under one reveal regime. Every other field is held constant. */
async function record(
  store: MemoryRecordStore,
  options: { revealTiming: RevealTiming; accurate: boolean },
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
      confidence: CONFIDENCE_LEVELS,
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
  options: { revealTiming: RevealTiming; accurate: boolean },
) => Array.from({ length: n }, () => options).reduce(
  (chain, o) => chain.then(() => record(store, o)),
  Promise.resolve(),
);

describe("the record page reads one population, not a mixture of regimes", () => {
  it("does not average a coached record and a deferred one into one accuracy", async () => {
    /*
     * THE FACT. Thirty-five decisions taken with the verdict shown after each one, all accurate,
     * and thirty taken with the verdict held to the end of the game, none accurate.
     *
     * `reveal-timing.ts`: "by move twenty the player has been told twenty times how their last move
     * scored, so every decision after the first was made by somebody being coached mid-game by a
     * stronger engine. That is a good way to learn and it is not a reading of how the player decides
     * unaided. SO THE TWO ARE NOT POOLABLE."
     *
     * Pooled, this record reports 35/65 -- an accuracy rate no arm of it produced, and a calibration
     * gap belonging to nobody.
     */
    const store = new MemoryRecordStore();
    await fill(store, 35, { revealTiming: "per-decision", accurate: true });
    await fill(store, 30, { revealTiming: "end-of-game", accurate: false });

    const reading = await service.recordReading(store);

    expect(reading.scored, "both regimes entered one reading").toBe(35);
    expect(reading.overall.accuracyRate).toBe(1);
    expect(reading.calibration.n).toBe(35);
    // Not silently gone: named, counted, and reportable -- R1's rule for any denominator that shrank.
    expect(reading.setAside).toEqual([
      { id: "legacy@legacy/end-of-game/sf18-test-build", n: 30 },
    ]);
  });

  it("still reads the whole record when every decision was taken under one regime", async () => {
    /*
     * THE POSITIVE CONTROL, and the reason it is not optional. A rule that put every decision in its
     * own population would satisfy the case above and destroy the page: sixty-five decisions under
     * identical conditions are one population and must read as one.
     */
    const store = new MemoryRecordStore();
    await fill(store, 35, { revealTiming: "per-decision", accurate: true });
    await fill(store, 30, { revealTiming: "per-decision", accurate: false });

    const reading = await service.recordReading(store);

    expect(reading.scored).toBe(65);
    expect(reading.overall.accuracyRate).toBeCloseTo(35 / 65, 12);
    expect(reading.setAside).toEqual([]);
  });

  it("changes nothing for a record written before reveal timing was recorded", async () => {
    /*
     * Behaviour preservation, stated as a test rather than as a hope. A row that recorded no timing
     * is its own regime -- never backfilled to either mode -- so a record made entirely of them is
     * one population and reads exactly as it did.
     */
    const store = new MemoryRecordStore();
    await fill(store, 10, { revealTiming: "per-decision", accurate: true });
    const reading = await service.recordReading(store);
    expect(reading.scored).toBe(10);
    expect(reading.setAside).toEqual([]);
  });
});
