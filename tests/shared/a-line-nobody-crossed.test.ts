/**
 * R-18: two of the six buckets cannot be read on a blitz record, and the page said "keep playing".
 *
 * MEASURED, NOT REASONED. A realistic 3+0 record -- forty player decisions a game, think times
 * log-distributed around a median near four seconds, scaled so the game consumes its clock -- puts
 * every decision on one side of `fast-under-45s` and none on the other. Forty-five seconds is a
 * quarter of the entire clock in a three-minute game; `slow-over-2m` is two thirds of it.
 *
 *     fast-under-45s     inside 480   outside   0
 *     slow-over-2m       inside   0   outside 480
 *     phase-opening      inside 120   outside 360
 *     phase-middlegame   inside 240   outside 240
 *     phase-endgame      inside 120   outside 360
 *     clock-under-1m     inside 156   outside 324
 *
 * SO THE BUCKET THE PRODUCT'S WHOLE NARRATIVE RESTS ON -- when you have little time, you commit
 * before you have checked -- can never be read on the route built to measure time pressure. The
 * four that work do work, which is why this is a defect in the thresholds rather than in the idea.
 *
 * WHAT THIS FILE GATES IS NOT THE THRESHOLD. Replacing 45 seconds with a fraction of the clock is
 * §18 and it needs its own multiplicity measurement before it can be searched: six buckets were
 * calibrated together and `SEPARABILITY_K` is a measurement of that six. What is gated here is that
 * the product STOPS TELLING A PLAYER TO KEEP GOING when going on cannot help -- which it did, and
 * which is the same class of advice `no-clock-data` was added to prevent.
 *
 * TWO OTHER DEFECTS SURFACED IN THE SAME FUNCTION and are gated below. The reading split the record
 * with `predicate` and `!predicate`, so a decision the bucket CANNOT READ landed in the comparison
 * set -- `bucketable` exists to stop exactly that, the detector was repaired, and the reading that
 * draws the chart was not. And `shortBy` counted only the `inside` side, so a split whose
 * comparison set was empty reported that it needed nothing.
 */
import { describe, expect, it } from "vitest";
import { readRecord } from "@shared/record-dashboard";
import { MIN_BUCKET_N, type ScoredDecision } from "@shared/detector";
import { whatIsUnclear, UNCLEAR_SENTENCE, WAITING_HELPS } from "@shared/record-order";

const FEN = "8/8/8/8/8/8/8/K6k w - - 0 1";

/**
 * A blitz record that behaves like one.
 *
 * DETERMINISTIC, so the numbers in this file's header are reproducible rather than approximately
 * right. The think times are log-distributed and then scaled so the game spends its clock, which is
 * what makes the median land near four seconds on a 3+0 game of forty decisions -- the shape, not a
 * number chosen to make the point.
 */
function blitzRecord(games: number, perGame = 40, clockMs = 180_000): ScoredDecision[] {
  const decisions: ScoredDecision[] = [];
  let seed = 12345;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let g = 0; g < games; g += 1) {
    const raw = Array.from({ length: perGame }, () => Math.exp(Math.log(1.6) + rand() * 2.2) * 1000);
    const scale = (clockMs * 0.95) / raw.reduce((a, b) => a + b, 0);
    let clock = clockMs;
    raw.forEach((ms, i) => {
      const thinkMs = ms * scale;
      decisions.push({
        decision_id: `g${g}#${i}`,
        fen: FEN,
        confidence: 0.65,
        accurate: (g + i) % 3 !== 0,
        phase: i < 10 ? "opening" : i < 30 ? "middlegame" : "endgame",
        secondsTaken: thinkMs / 1000,
        clockMsRemaining: clock,
      });
      clock -= thinkMs;
    });
  }
  return decisions;
}

describe("a line nobody crossed", () => {
  describe("what a blitz record does to the six buckets", () => {
    const reading = readRecord(blitzRecord(12));
    const bucket = (key: string) => reading.buckets.find((b) => b.key === key)!;

    it("puts every decision on one side of the 45-second line", () => {
      expect(bucket("fast-under-45s").outside.n).toBe(0);
      expect(bucket("fast-under-45s").inside.n).toBe(480);
    });

    it("puts none of them past the two-minute line", () => {
      expect(bucket("slow-over-2m").inside.n).toBe(0);
    });

    it("leaves the other four readable, which is why this is a threshold defect", () => {
      /*
       * The control. If the record were simply too small, or the fixture degenerate, the phase and
       * clock splits would fail too -- and then this file would be measuring its own fixture.
       */
      for (const key of ["phase-opening", "phase-middlegame", "phase-endgame", "clock-under-1m"]) {
        expect(bucket(key).measurable, `${key} is not readable on this record`).toBe(true);
      }
    });
  });

  describe("what the page now says about it", () => {
    const items = whatIsUnclear(readRecord(blitzRecord(12)));

    it("calls a saturated split a division that does not divide, not a shortage", () => {
      const fast = items.find((i) => i.what.includes("45"));
      expect(fast).toBeDefined();
      expect(fast!.because).toBe("split-does-not-divide");
      expect(fast!.waitingHelps).toBe(false);
      expect(fast!.needs).toBeNull();
    });

    it("does NOT tell the player that more games will open it", () => {
      /*
       * The failure this whole row exists for. Before the third reason existed, both dead splits
       * came back `too-few-in-bucket` with a count -- "thirty more decisions" -- on a record where
       * four hundred and eighty had already failed to produce one.
       */
      expect(WAITING_HELPS["split-does-not-divide"]).toBe(false);
      expect(UNCLEAR_SENTENCE["split-does-not-divide"]).toContain("לא ייפתח");
    });

    it("still calls a genuinely thin split a wait", () => {
      // The control on the other side: a rule that called everything a dead end would satisfy the
      // two cases above and stop the product ever asking for another decision.
      const thin = whatIsUnclear(readRecord(blitzRecord(1, 20)));
      expect(thin.some((i) => i.because === "too-few-in-bucket" && i.waitingHelps)).toBe(true);
    });
  });

  describe("two defects in the same function", () => {
    it("keeps a decision the bucket cannot read OUT of the comparison set", () => {
      /*
       * `bucketable`'s own comment: "we could not measure how long this took" must not become "this
       * took more than 45 seconds", which is the same fabrication pointing the other way and moves
       * the baseline the bucket is judged against. The detector was repaired; this reading, which
       * draws the chart the player looks at, was still splitting on `predicate` and `!predicate`.
       */
      const timed = blitzRecord(2);
      const untimed: ScoredDecision[] = Array.from({ length: 50 }, (_, i) => ({
        decision_id: `u${i}`,
        fen: FEN,
        confidence: 0.5,
        accurate: i % 2 === 0,
        phase: "middlegame",
        secondsTaken: null,
        clockMsRemaining: null,
      }));
      const reading = readRecord([...timed, ...untimed]);
      const fast = reading.buckets.find((b) => b.key === "fast-under-45s")!;
      expect(fast.inside.n + fast.outside.n).toBe(timed.length);
      expect(fast.outside.n).toBe(0);
    });

    it("counts the shortfall on the empty side, not on the full one", () => {
      const reading = readRecord(blitzRecord(1, MIN_BUCKET_N - 3));
      const fast = reading.buckets.find((b) => b.key === "fast-under-45s")!;
      expect(fast.inside.n).toBe(MIN_BUCKET_N - 3);
      expect(fast.outside.n).toBe(0);
      /* The old field answered "how far is INSIDE from the floor" and returned 3. */
      expect(fast.shortBy).toBe(MIN_BUCKET_N);
    });

    it("does not call a small record's empty side a dead end", () => {
      /*
       * THE SIZE CONDITION, AND IT IS WHAT KEEPS THE NEW REASON HONEST. Twenty decisions with
       * nothing over two minutes says nothing about where the line belongs; four hundred and eighty
       * does. Without this the product would announce a dead end on somebody's first game.
       */
      const small = readRecord(blitzRecord(1, 20));
      const slow = small.buckets.find((b) => b.key === "slow-over-2m")!;
      expect(slow.inside.n).toBe(0);
      expect(slow.unmeasurableReason).toBe("too-few");
    });
  });
});
