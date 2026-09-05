/**
 * THE ONLY BETWEEN-PLAYER COMPARISON, READING A PROTOCOL THAT IS NO LONGER RUNNING.
 *
 * THE LINEAGE, because it is the finding. `57f561d` stratified the described reading and picked
 * the LARGEST stratum. `4049c16` carried the wall to the bank reading and copied that sort, under a
 * message that named the very defect it was fixing: *"`readRecord` computes two readings and the
 * first commit walled only one of them."* Then `67bad3c` falsified "the largest" -- largest is not
 * latest -- and replaced it with the regime in force. On one of the two readings. The bank went on
 * sorting by size.
 *
 * WHAT "LARGEST" COSTS, measured in `67bad3c` on the reading it was fixed for: a bump to
 * `CURRENT_PROTOCOL_VERSION` starts a stratum at zero while the retired one holds the whole
 * history, so 120 decisions under version 4 against 40 under version 5 reported n=120 at 100%
 * accuracy from a protocol no longer running, and would have gone on for 81 more decisions.
 *
 * IT IS WORSE HERE THAN THERE. The described reading describes one player, and a stale one is a
 * stale description. The bank is the only reading this product claims is comparable BETWEEN
 * players, and its whole argument is that item difficulty and scoring are held fixed --
 * `docs/ACTION_PLAN.md` B1 measured 13.61% of verdicts flipping between two engine builds. A stale
 * regime here is a comparison run across the exact change the stratification exists to wall off.
 *
 * THE REPAIR IS ONE FUNCTION WITH TWO CALLERS, not the same rule written twice. A rule that lives
 * in two places gets repaired in one, which is what happened here, twice, one commit apart.
 *
 * THE BANK COMPUTES ITS OWN REGIME IN FORCE and does not borrow the described reading's. The two
 * populations do not admit the same rows, so the latest row of one is not the latest row of the
 * other, and the last case here is what holds that apart.
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

describe("the bank reading reads the regime in force", () => {
  it("does not describe a retired engine build because it holds more rows", async () => {
    const store = new MemoryRecordStore();
    /* The retired regime is the larger one, and every one of its answers was accurate. */
    await run(store, { n: 40, from: 0, build: RETIRED, accurate: true });
    /* The regime the record is still appending to, over the floor, and every answer inaccurate. */
    await run(store, { n: MIN_BUCKET_N, from: 0, build: RUNNING, accurate: false });

    const reading = await service.recordReading(store);
    expect(
      reading.anchor.n,
      `the comparable reading is over ${reading.anchor.n} answers; the running regime holds ${MIN_BUCKET_N}`,
    ).toBe(MIN_BUCKET_N);
    /* And it is the running regime's answers, not the retired one's flattering ones. */
    expect(reading.anchor.levels.find((l) => l.n > 0)?.observed).toBe(0);
  });

  it("POSITIVE CONTROL: falls back to the largest while the regime in force is too small to read", async () => {
    /*
     * Without this the rule would be "always the newest", which trades a stale number for silence
     * on every bump. `MIN_BUCKET_N` is the floor these readings already answer nothing below.
     */
    const store = new MemoryRecordStore();
    await run(store, { n: 40, from: 0, build: RETIRED, accurate: true });
    await run(store, { n: MIN_BUCKET_N - 1, from: 0, build: RUNNING, accurate: false });

    const reading = await service.recordReading(store);
    expect(reading.anchor.n).toBe(40);
  });

  it("POSITIVE CONTROL: it is answer-blind -- flipping every outcome chooses the same regime", async () => {
    /*
     * The disqualifying failure for any population rule. Both terms are counts and arrival order,
     * so neither can reach for the regime holding the better number.
     */
    const sizeOf = async (retiredAccurate: boolean) => {
      const store = new MemoryRecordStore();
      await run(store, { n: 40, from: 0, build: RETIRED, accurate: retiredAccurate });
      await run(store, { n: MIN_BUCKET_N, from: 0, build: RUNNING, accurate: !retiredAccurate });
      return (await service.recordReading(store)).anchor.n;
    };
    expect(await sizeOf(true)).toBe(await sizeOf(false));
  });

  it("POSITIVE CONTROL: one regime is still one reading, and nothing is walled off", async () => {
    /* A rule that shrank every record would pass the first case for the wrong reason. */
    const store = new MemoryRecordStore();
    await run(store, { n: 35, from: 0, build: RUNNING, accurate: true });

    const reading = await service.recordReading(store);
    expect(reading.anchor.n).toBe(35);
  });

  it("takes its regime from its own latest answer, not from the described reading's", async () => {
    /*
     * The two populations admit different rows. Here the record's last decision is FREE PLAY, which
     * the bank does not admit at all -- so a bank reading that borrowed `currentId` would name a
     * regime holding no bank answers and fall back to size for the wrong reason. The bank's own
     * latest answer is under RUNNING, and that is what it must read.
     */
    const store = new MemoryRecordStore();
    await run(store, { n: 40, from: 0, build: RETIRED, accurate: true });
    await run(store, { n: MIN_BUCKET_N, from: 0, build: RUNNING, accurate: false });
    for (let i = 0; i < 5; i += 1) {
      await answer(store, {
        fen: "r2q1rk1/pp2bppp/2n1bn2/3pp3/3PP3/2N1BN2/PP2BPPP/R2Q1RK1 w - - 0 12",
        build: "sf20-later-build",
        accurate: true,
        purpose: "play",
      });
    }

    const reading = await service.recordReading(store);
    expect(reading.anchor.n).toBe(MIN_BUCKET_N);
  });
});
