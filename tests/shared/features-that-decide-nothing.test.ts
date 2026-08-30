/**
 * The blitz feature layer: it computes, and it decides nothing.
 *
 * WHAT IS BEING GUARDED. Not correctness of arithmetic -- that is the easy half and the assertions
 * below carry it. The hard half is that every one of these numbers has a way of being subtly wrong
 * in a direction nobody notices: a null that becomes a zero, a fraction that is clamped so a real
 * reading looks like a boundary, a percentile fitted on the data it describes. Each of those is a
 * defect this repository or its research has already made once.
 */
import { describe, expect, it } from "vitest";
import {
  blitzFeatures,
  BLITZ_FEATURE_VERSION,
  thinkPercentile,
  type ClockObservation,
  type ThinkTimeReference,
} from "@shared/blitz-features";
import { NO_TIME_CONTROL } from "@shared/pgn-clock";

const THREE_ZERO = { initialMs: 180_000, incrementMs: 0 };

const observed = (over: Partial<ClockObservation> = {}): ClockObservation => ({
  thinkMs: 4_000,
  clockBeforeMs: 120_000,
  opponentClockBeforeMs: 90_000,
  timeControl: THREE_ZERO,
  ...over,
});

describe("features that decide nothing", () => {
  it("derives every candidate from one decision", () => {
    const f = blitzFeatures(observed());
    expect(f.thinkMs).toBe(4_000);
    expect(f.clockRemainingFraction).toBeCloseTo(120 / 180, 10); // 0.666…
    expect(f.clockBalanceMs).toBe(30_000); // 120s against 90s: half a minute up
    expect(f.clockShare).toBeCloseTo(120 / 210, 10);
    expect(f.thinkFractionOfClockBefore).toBeCloseTo(4 / 120, 10);
    expect(f.logThinkTime).toBeCloseTo(Math.log(5), 10); // log(1 + 4)
    expect(f.featureVersion).toBe(BLITZ_FEATURE_VERSION);
  });

  it("says 0.5 for a level clock whatever the time control, which raw milliseconds cannot", () => {
    /*
     * The reason `clockShare` exists beside `clockBalanceMs`. Thirty seconds up is a rout at 3+0
     * and nothing at 15+10; the share is the same number in both, and the balance is not.
     */
    const level = blitzFeatures(observed({ clockBeforeMs: 60_000, opponentClockBeforeMs: 60_000 }));
    expect(level.clockShare).toBe(0.5);
    expect(level.clockBalanceMs).toBe(0);
  });

  it("does NOT clamp a clock fraction above 1, because the increment really does that", () => {
    /*
     * A 300+3 game climbs past its own start -- the 117-game corpus contains readings of 301, 302,
     * 304 and 306 seconds. Clamping would turn a real state into a boundary value that then looks
     * like the most common state in the game.
     */
    const climbed = blitzFeatures(
      observed({ clockBeforeMs: 306_000, timeControl: { initialMs: 300_000, incrementMs: 3_000 } }),
    );
    expect(climbed.clockRemainingFraction).toBeCloseTo(1.02, 10);
    expect(climbed.clockRemainingFraction).toBeGreaterThan(1);
  });

  it("keeps a real zero apart from a missing reading, in every field that has both", () => {
    // Zero seconds of thinking is a measurement. No recorded think time is not.
    const flagged = blitzFeatures(observed({ thinkMs: 0, clockBeforeMs: 0 }));
    expect(flagged.thinkMs).toBe(0);
    expect(flagged.logThinkTime).toBe(0); // log(1 + 0)
    expect(flagged.clockRemainingFraction).toBe(0);
    // ...and dividing BY that zero is not a zero, it is unanswerable.
    expect(flagged.thinkFractionOfClockBefore).toBeNull();

    const unknown = blitzFeatures(observed({ thinkMs: null, clockBeforeMs: null }));
    expect(unknown.thinkMs).toBeNull();
    expect(unknown.logThinkTime).toBeNull();
    expect(unknown.clockRemainingFraction).toBeNull();
    expect(unknown.thinkFractionOfClockBefore).toBeNull();
  });

  it("gives up on the fraction rather than guessing when the time control is unknown", () => {
    const f = blitzFeatures(observed({ timeControl: NO_TIME_CONTROL }));
    expect(f.clockRemainingFraction).toBeNull();
    // The absolute readings survive: not knowing the denominator does not erase the numerator.
    expect(f.clockBeforeMs).toBe(120_000);
    expect(f.clockBalanceMs).toBe(30_000);
  });

  it("returns no share and no balance when only one clock was recorded", () => {
    const f = blitzFeatures(observed({ opponentClockBeforeMs: null }));
    expect(f.clockShare).toBeNull();
    expect(f.clockBalanceMs).toBeNull();
    expect(f.clockRemainingFraction).toBeCloseTo(120 / 180, 10); // own-clock features unaffected
  });

  describe("the percentile, which is the one that can leak", () => {
    const reference: ThinkTimeReference = {
      sortedMs: [1_000, 1_000, 2_000, 3_000, 8_000],
      source: "derivation half",
    };

    it("counts ties as below, because on integer seconds ties are most of the data", () => {
      /*
       * Lichess writes `[%clk H:MM:SS]`, so every think time is a whole second and the modal value
       * is enormous -- 290 of 1,308 held-out decisions in the 117-game corpus are exactly one
       * second. Counting strictly-below would put that entire mode at the bottom of its own
       * distribution.
       */
      expect(thinkPercentile(1_000, reference)).toBe(2 / 5);
      expect(thinkPercentile(3_000, reference)).toBe(4 / 5);
      expect(thinkPercentile(8_000, reference)).toBe(1);
      expect(thinkPercentile(500, reference)).toBe(0);
    });

    it("refuses to invent a percentile when no reference was supplied", () => {
      // An ad-hoc distribution is worse than no percentile: it looks like one and is not.
      const f = blitzFeatures(observed());
      expect(f.playerRelativeThinkPercentile).toBeNull();
      expect(f.percentileSource).toBeNull();
    });

    it("records WHICH reference produced it, so a fitted-on-itself percentile is visible", () => {
      const f = blitzFeatures(observed({ thinkMs: 2_000 }), reference);
      expect(f.playerRelativeThinkPercentile).toBe(3 / 5);
      expect(f.percentileSource).toBe("derivation half");
    });

    it("says nothing rather than zero for an empty reference", () => {
      expect(thinkPercentile(1_000, { sortedMs: [], source: "nothing yet" })).toBeNull();
    });
  });

  it("holds no threshold, no bucket and no verdict anywhere in the module", () => {
    /*
     * The structural claim this file makes about itself. The 117-game study found the shipped cut
     * unsuitable for blitz and licensed no substitute; a feature layer that quietly shipped one
     * would be exactly the "no silent scientific changes" failure. Read the source and check.
     */
    const source = new URL("../../shared/blitz-features.ts", import.meta.url);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const text = require("node:fs").readFileSync(source, "utf8") as string;
    const body = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    for (const forbidden of ["45", "120", "bucket", "threshold", "accurate", "slow", "fast"]) {
      expect(body.toLowerCase(), `the feature layer must not mention ${forbidden}`).not.toContain(
        forbidden.toLowerCase(),
      );
    }
  });
});
