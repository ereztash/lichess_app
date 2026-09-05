/**
 * WHICH REGIME THE BETWEEN-PLAYER READING IS OVER, AND WHY IT IS NOT THE ONE IN FORCE.
 *
 * THE LINEAGE, because it is half the finding. `57f561d` stratified the described reading and took
 * the LARGEST stratum. `4049c16` carried the wall to the bank and copied that sort, under a message
 * naming the very defect it was fixing: *"`readRecord` computes two readings and the first commit
 * walled only one of them."* Then `67bad3c` falsified "the largest" -- largest is not latest -- and
 * replaced it with the regime in force. On one of the two readings. The bank went on sorting by
 * size, which is what `regimeInForceFirst` exists to stop happening a third time: ONE function, two
 * callers, and each caller says in its own argument which rule it is asking for.
 *
 * AND THE BANK ASKS FOR THE LARGEST, DELIBERATELY. The in-force rule was carried over here and then
 * falsified by measurement, which is the other half. Its claim is that staleness is bounded by
 * thirty decisions rather than by the length of the record. The bank is not an open stream:
 * `ANCHOR_POSITIONS` is sixty items, `anchorAnswered` is cross-regime by design, and `nextAnchor`
 * serves the first position NOT already answered. So a bump leaves at most `60 - answered` distinct
 * answers available in the new regime, and a player who had answered 31 or more can never reach the
 * floor in it. The first case below is that player, and the reading it gets is the stale one the
 * in-force rule was written to prevent -- permanently, with the set exhausted.
 *
 * THE VERSION OF THIS FILE THAT CERTIFIED THE IN-FORCE RULE WAS CHECKED AGAINST A RECORD THE PRODUCT
 * CANNOT PRODUCE. It built the running regime from positions 0-29, which the retired regime had
 * already answered -- thirty reload-repeats, which the front door never serves. It went red when the
 * rule was reverted, so it looked like a gate. It was a gate on an unreachable record. Every case
 * here now answers DISTINCT positions and asserts the total against the size of the set.
 *
 * WHAT IS NOT DECIDED HERE. What a between-player comparison should do when the regime in force can
 * never accumulate enough items is a question about what the product measures on a finite set.
 * `N-11`, and it is the owner's.
 */
import { describe, expect, it } from "vitest";
import { MemoryRecordStore } from "../../server/record";
import * as service from "../../shared/record-service";
import { CONFIDENCE_LEVELS } from "../../shared/confidence";
import { ANCHOR_POSITIONS } from "../../shared/anchor-set";
import { MIN_BUCKET_N } from "../../shared/detector";
import { classifyPhase } from "../../shared/phase";
import type { DecisionPurpose } from "../../shared/confidence-asked";

let seq = 0;
const nextId = () => `44444444-4444-4444-8444-${String(++seq).padStart(12, "0")}`;

/** One bank answer, scored by a named engine build -- which is what puts it in a stratum. */
async function answer(
  store: MemoryRecordStore,
  options: { fen: string; build: string; accurate: boolean; purpose?: DecisionPurpose },
) {
  const id = nextId();
  await service.commitDecision(store, {
    decision_id: id,
    entry_state: {
      game_id: "g",
      fen: options.fen,
      ply: 30,
      phase: classifyPhase(options.fen, 30),
      clock_ms_remaining: null,
    },
    purpose: options.purpose ?? "anchor",
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
    reveal_timing: "per-decision",
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
    engine_build: options.build,
    cp_loss: options.accurate ? 0 : 300,
  });
}

const RETIRED = "sf18-retired-build";
const RUNNING = "sf19-running-build";

/** `n` answers under `build`, taken from distinct bank positions starting at `from`. */
async function run(
  store: MemoryRecordStore,
  opts: { n: number; from: number; build: string; accurate: boolean },
) {
  for (let i = 0; i < opts.n; i += 1) {
    await answer(store, {
      fen: ANCHOR_POSITIONS[(opts.from + i) % ANCHOR_POSITIONS.length].fen,
      build: opts.build,
      accurate: opts.accurate,
    });
  }
}

describe("which regime the between-player reading is over", () => {
  it("cannot reach the regime in force once the set is spent, and this is the record that shows it", async () => {
    /*
     * THE REACHABLE RECORD, and every position distinct: 40 under a retired build, then the whole
     * remaining set -- 20 -- under the running one. Sixty answers, sixty positions, which is the
     * most this player can ever give. The running regime is 20, under the floor of 30, and no
     * further answer exists to lift it.
     */
    const store = new MemoryRecordStore();
    await run(store, { n: 40, from: 0, build: RETIRED, accurate: true });
    await run(store, { n: ANCHOR_POSITIONS.length - 40, from: 40, build: RUNNING, accurate: false });

    const reading = await service.recordReading(store);
    expect(reading.anchorAnswered.length, "the walk did not answer every bank position").toBe(
      ANCHOR_POSITIONS.length,
    );
    expect(reading.anchorRepeated, "the record was supposed to hold no repeats").toBe(0);
    /*
     * THE READING IS THE RETIRED REGIME, AND THIS ASSERTION IS THE FINDING RATHER THAN THE FIX. It
     * is what the largest-stratum rule gives, and it is also what the in-force rule gave, because
     * 20 is under the floor and the set is spent. Naming it here is what stops the next pass reading
     * a green suite as an absence.
     */
    expect(reading.anchor.n).toBe(40);
    expect(reading.anchor.levels.find((l) => l.n > 0)?.observed).toBe(1);
  });

  it("takes the largest regime, and the ordering is the shared rule rather than a second copy", async () => {
    const store = new MemoryRecordStore();
    await run(store, { n: 20, from: 0, build: RETIRED, accurate: true });
    await run(store, { n: 35, from: 20, build: RUNNING, accurate: false });

    const reading = await service.recordReading(store);
    expect(reading.anchor.n).toBe(35);
    expect(reading.anchor.levels.find((l) => l.n > 0)?.observed).toBe(0);
  });

  it("POSITIVE CONTROL: it is answer-blind -- flipping every outcome chooses the same regime", async () => {
    /*
     * The disqualifying failure for any population rule, and the property that must survive whatever
     * the owner decides about `N-11`. Both terms are counts and arrival order, so neither can reach
     * for the regime holding the better number.
     */
    const sizeOf = async (retiredAccurate: boolean) => {
      const store = new MemoryRecordStore();
      await run(store, { n: 20, from: 0, build: RETIRED, accurate: retiredAccurate });
      await run(store, { n: 35, from: 20, build: RUNNING, accurate: !retiredAccurate });
      return (await service.recordReading(store)).anchor.n;
    };
    expect(await sizeOf(true)).toBe(await sizeOf(false));
  });

  it("POSITIVE CONTROL: one regime is still one reading, and nothing is walled off", async () => {
    /* A rule that shrank every record would pass the cases above for the wrong reason. */
    const store = new MemoryRecordStore();
    await run(store, { n: 35, from: 0, build: RUNNING, accurate: true });

    const reading = await service.recordReading(store);
    expect(reading.anchor.n).toBe(35);
  });

  it("POSITIVE CONTROL: no record can hold more distinct bank answers than the set has positions", async () => {
    /*
     * The premise the first case rests on. If this ever stops being true -- a larger set, or a rule
     * that re-offers answered positions -- the reachability argument above has to be re-derived
     * rather than inherited.
     */
    const store = new MemoryRecordStore();
    await run(store, { n: ANCHOR_POSITIONS.length, from: 0, build: RUNNING, accurate: true });
    await run(store, { n: 10, from: 0, build: RUNNING, accurate: false });

    const reading = await service.recordReading(store);
    expect(reading.anchorAnswered.length).toBe(ANCHOR_POSITIONS.length);
    expect(reading.anchorRepeated).toBe(10);
  });
});
