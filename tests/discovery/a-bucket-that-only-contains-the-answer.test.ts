/**
 * R-08: the claim was validated, the bucket really does separate, and the sentence is still wrong.
 *
 * THE MEASUREMENT THIS IS BUILT AGAINST. `docs/discovery-v2/M0_AUDIT.md` §Q4, 11,600 simulated
 * records through the shipped chain. Against "nothing is there" it is close to perfect — **0
 * validated false claims in 8,000 null records**. On a world whose true effect lives in a region no
 * bucket can express (`fast AND endgame`), it **validated a claim naming the wrong subgroup on 11%
 * of records**, and the judge could not catch it: `fast-under-45s` genuinely separates, because the
 * true region is a *subset* of it and drags the bucket's mean along.
 *
 * SO EVERY STEP BEHAVES CORRECTLY AND THE PLAYER IS STILL TOLD THE WRONG THING — distrust yourself
 * when you play fast — which they will apply to fast middlegame moves where nothing is wrong.
 *
 * WHAT THIS FILE ASSERTS is the one question separability cannot answer: *is the difference a
 * property of this bucket, or of something inside it.* The fixtures are built so the answer is
 * known by construction, which is the only way to test an attribution rule — on a real record
 * nobody knows the true region, which is why the misattribution went unnoticed in the first place.
 *
 * WHAT IT DOES NOT ASSERT: the value of `ATTRIBUTION_K`. A threshold is a trade between withholding
 * true claims and passing misattributed ones, and a trade is measured rather than unit-tested —
 * `research/discovery-oracle` is where that lives. Here `k` is passed explicitly wherever the
 * outcome depends on it, so these cases keep meaning what they say if the constant moves.
 */
import { describe, expect, it } from "vitest";
import {
  attribution,
  bucketingFor,
  ATTRIBUTION_K,
  MIN_SPLIT_N,
} from "@shared/discovery/attribution";
import type { ScoredDecision } from "@shared/detector";

type Phase = ScoredDecision["phase"];

/**
 * One decision, with only the fields the buckets read.
 *
 * `confidence` IS THE STATED PROBABILITY and `accurate` the outcome, so the per-decision gap is
 * `confidence - (accurate ? 1 : 0)`. A run of decisions at confidence 0.8 of which 80% are accurate
 * has a gap of zero; the same run at 40% accurate has a gap of 0.4. That is how these fixtures set
 * a gap to a number: by choosing how many of them are accurate.
 */
const decision = (
  i: number,
  over: { phase?: Phase; secondsTaken?: number | null; clockMsRemaining?: number | null; accurate?: boolean },
): ScoredDecision => ({
  decision_id: `d${i}`,
  fen: "8/8/8/8/8/8/8/K6k w - - 0 1",
  confidence: 0.8,
  accurate: over.accurate ?? true,
  phase: over.phase ?? "middlegame",
  secondsTaken: over.secondsTaken === undefined ? 10 : over.secondsTaken,
  clockMsRemaining: over.clockMsRemaining === undefined ? 120_000 : over.clockMsRemaining,
});

/**
 * `n` decisions of one kind, of which `accurateShare` are accurate — so their gap is
 * `0.8 - accurateShare`.
 *
 * The accurate ones are INTERLEAVED rather than blocked, which matters for nothing in the maths and
 * everything in reading a failure: a blocked fixture that is off by one looks like a gap change
 * rather than like a miscount.
 */
let counter = 0;
const run = (
  n: number,
  accurateShare: number,
  over: Parameters<typeof decision>[1],
): ScoredDecision[] => {
  /* `i < round(n * share)`, not `i % 100 < share * 100`: the first is exact at every n, and the
     second silently caps at 60 accurate decisions in a run of 60, so a fixture asking for 80%
     quietly got 100%. */
  const accurate = Math.round(n * accurateShare);
  return Array.from({ length: n }, (_, i) =>
    decision(counter++, { ...over, accurate: i < accurate }),
  );
};

describe("a bucket that only contains the answer", () => {
  describe("the case M0 measured", () => {
    it("REFUSES to attribute a fast-bucket claim whose gap is all in the endgame half", () => {
      /*
       * THE WORLD `interaction-only` DESCRIBES, built by hand so the truth is known. Inside
       * `fast-under-45s` there are two halves: the endgame decisions carry a gap of 0.4, and the
       * middlegame ones carry none. The bucket's own mean is therefore comfortably away from the
       * rest of the record — which is exactly why the judge validates it — and the name is wrong.
       */
      const inside = [
        ...run(60, 0.4, { secondsTaken: 10, phase: "endgame" }),
        ...run(60, 0.8, { secondsTaken: 10, phase: "middlegame" }),
      ];
      const report = attribution("fast-under-45s", inside);
      expect(report.verdict.kind).toBe("not-attributable");
      if (report.verdict.kind !== "not-attributable") throw new Error("unreachable");
      /* And it names the division a later pre-registration should be written about. */
      expect(report.verdict.splitBy).toBe("phase-endgame");
      expect(Math.abs(report.verdict.z)).toBeGreaterThanOrEqual(ATTRIBUTION_K);
    });

    it("ATTRIBUTES the same claim when the gap really is spread across the bucket", () => {
      /*
       * THE CONTROL, and without it the test above proves nothing: a rule that vetoed every claim
       * would satisfy it and silence the product. Same bucket, same size, same overall gap — spread
       * evenly instead of concentrated.
       */
      const inside = [
        ...run(60, 0.6, { secondsTaken: 10, phase: "endgame" }),
        ...run(60, 0.6, { secondsTaken: 10, phase: "middlegame" }),
      ];
      expect(attribution("fast-under-45s", inside).verdict.kind).toBe("attributed");
    });

    it("does not veto on a difference that is real but small against its own error", () => {
      // A rule that fired on any difference at all would be a rule about sample noise.
      const inside = [
        ...run(60, 0.58, { secondsTaken: 10, phase: "endgame" }),
        ...run(60, 0.62, { secondsTaken: 10, phase: "middlegame" }),
      ];
      const report = attribution("fast-under-45s", inside);
      expect(report.verdict.kind).toBe("attributed");
      const byPhase = report.splits.find((s) => s.key === "phase-endgame");
      expect(byPhase?.z, "the split was not even readable").not.toBeNull();
      expect(Math.abs(byPhase!.z!)).toBeLessThan(ATTRIBUTION_K);
    });
  });

  describe("what it refuses to answer, rather than answering badly", () => {
    it("says the bucket is too small rather than testing it", () => {
      const inside = run(MIN_SPLIT_N, 0.4, { secondsTaken: 10, phase: "endgame" });
      const report = attribution("fast-under-45s", inside);
      expect(report.verdict).toEqual({ kind: "unreadable", because: "bucket-too-small" });
      expect(report.splits).toHaveLength(0);
    });

    it("says NO READABLE SPLIT when the bucket is big enough but every division is one-sided", () => {
      /*
       * A bucket of 120 decisions that are all endgame, all fast, all with the same clock: every
       * split puts everything on one side. That is not evidence of homogeneity — nothing was
       * compared — and reporting it as `attributed` would turn "we could not look" into "we looked
       * and it was fine", which is the R2 failure this repository is built around.
       */
      const inside = run(120, 0.4, { secondsTaken: 10, phase: "endgame", clockMsRemaining: 120_000 });
      const report = attribution("fast-under-45s", inside);
      expect(report.verdict).toEqual({ kind: "unreadable", because: "no-readable-split" });
      expect(report.splits.every((s) => s.unreadable !== null)).toBe(true);
    });

    it("refuses a split whose standard error cannot be estimated", () => {
      /*
       * Both halves large, one of them perfectly uniform: every decision the same confidence and
       * the same outcome, so its sample variance is exactly zero. `gapDifferenceStandardError`
       * refuses that for the reason it states at length — a sample that cannot estimate its own
       * error is not one that knows its gap exactly — and a veto computed from it would divide by
       * an error that came from one side only.
       */
      const inside = [
        ...run(60, 1, { secondsTaken: 10, phase: "endgame" }),
        ...run(60, 0.5, { secondsTaken: 10, phase: "middlegame" }),
      ];
      const report = attribution("fast-under-45s", inside);
      const byPhase = report.splits.find((s) => s.key === "phase-endgame");
      expect(byPhase?.unreadable).toBe("no-standard-error");
      expect(byPhase?.breaks).toBe(false);
    });

    it("refuses a bucketing that does not exist rather than inventing one", () => {
      const inside = run(120, 0.4, { secondsTaken: 10 });
      expect(attribution("a-bucket-nobody-defined", inside).verdict).toEqual({
        kind: "unreadable",
        because: "bucket-too-small",
      });
      expect(bucketingFor("a-bucket-nobody-defined")).toBeNull();
    });
  });

  describe("what it splits by, and what it does not", () => {
    it("never splits a bucket by itself, because that is not a split", () => {
      const inside = [
        ...run(60, 0.4, { secondsTaken: 10, phase: "endgame" }),
        ...run(60, 0.8, { secondsTaken: 10, phase: "middlegame" }),
      ];
      const report = attribution("fast-under-45s", inside);
      expect(report.splits.some((s) => s.key === "fast-under-45s")).toBe(false);
      /* All five others were attempted, readable or not: a reader can see what was asked. */
      expect(report.splits).toHaveLength(5);
    });

    it("drops decisions a split cannot read from BOTH sides of it", () => {
      /*
       * The `bucketable` rule, one layer in. Half the bucket has no clock; `clock-under-1m` must
       * not count those as "over a minute", because that is the same fabrication pointing the other
       * way and it moves the baseline the veto is computed against.
       */
      const inside = [
        ...run(40, 0.4, { secondsTaken: 10, clockMsRemaining: 30_000 }),
        ...run(40, 0.4, { secondsTaken: 10, clockMsRemaining: 120_000 }),
        ...run(40, 0.8, { secondsTaken: 10, clockMsRemaining: null }),
      ];
      const byClock = attribution("fast-under-45s", inside).splits.find(
        (s) => s.key === "clock-under-1m",
      );
      expect(byClock, "the clock split was not attempted").toBeDefined();
      expect(byClock!.nInside + byClock!.nOutside, "clockless decisions entered the split").toBe(80);
    });

    it("carries every split it attempted, so a silent verdict can still be read", () => {
      const inside = [
        ...run(60, 0.4, { secondsTaken: 10, phase: "endgame" }),
        ...run(60, 0.8, { secondsTaken: 10, phase: "middlegame" }),
      ];
      const report = attribution("fast-under-45s", inside);
      expect(report.n).toBe(120);
      for (const split of report.splits) {
        expect(typeof split.key).toBe("string");
        expect(split.nInside + split.nOutside).toBeLessThanOrEqual(report.n);
      }
    });
  });

  describe("the threshold is an argument, not a constant this file owns", () => {
    it("vetoes at a lax k and does not at a strict one, on the same record", () => {
      /*
       * THE TRADE, MADE VISIBLE. Attribution can only withhold, so a lax `k` costs silence about
       * something real and a strict one lets the misattribution through. This asserts the direction
       * of that trade rather than a value: `research/discovery-oracle` measures where to sit on it.
       */
      const inside = [
        ...run(60, 0.55, { secondsTaken: 10, phase: "endgame" }),
        ...run(60, 0.72, { secondsTaken: 10, phase: "middlegame" }),
      ];
      expect(attribution("fast-under-45s", inside, 1.0).verdict.kind).toBe("not-attributable");
      expect(attribution("fast-under-45s", inside, 12).verdict.kind).toBe("attributed");
    });
  });
});
