/**
 * The population baseline, and the reason a bucket's own number is not a finding without it.
 *
 * MEASURED, NOT ASSUMED: on 693,130 real Lichess moves, the middlegame is 12.6 points less
 * accurate than everything else FOR EVERYONE, decisions over two minutes are 14.2 points worse,
 * and the endgame is 14.2 points BETTER. None of that is about any player. Reporting someone's
 * middlegame accuracy without it is telling them a fact about chess in the second person.
 *
 * THE BASELINE IS ONLY WORTH HAVING IF IT WAS BUILT THE PRODUCT'S OWN WAY. Same `classifyPhase`,
 * same `BUCKETINGS`, same accuracy rule. A baseline computed with its own idea of "accurate"
 * would be a number from a different instrument, and subtracting it would be arithmetic between
 * two measurements.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BUCKETINGS } from "@shared/detector";
import {
  POPULATION_BASELINE,
  POPULATION_BASELINE_N,
  POPULATION_BASELINE_VERSION,
  populationBucket,
} from "@shared/population-baseline";

const root = resolve(__dirname, "../..");

describe("every baseline is a rate over a real denominator", () => {
  it("holds accuracies inside the unit interval, on both sides", () => {
    for (const bucket of POPULATION_BASELINE) {
      expect(bucket.accuracy, bucket.key).toBeGreaterThan(0);
      expect(bucket.accuracy, bucket.key).toBeLessThan(1);
      expect(bucket.outsideAccuracy, bucket.key).toBeGreaterThan(0);
      expect(bucket.outsideAccuracy, bucket.key).toBeLessThan(1);
    }
  });

  it("carries enough moves on each side to be a population rather than a handful", () => {
    /*
     * The same discipline the instrument applies to a player's record, applied to the corpus. It
     * matters here because two buckets really are thin in any realistic corpus: `slow-over-2m`
     * barely occurs in blitz, and `clock-under-1m` needs games that ran the clock down.
     */
    for (const bucket of POPULATION_BASELINE) {
      expect(bucket.n, `${bucket.key} inside`).toBeGreaterThanOrEqual(500);
      expect(bucket.outsideN, `${bucket.key} outside`).toBeGreaterThanOrEqual(500);
    }
  });

  it("adds up to the corpus it claims", () => {
    // Inside plus outside is the whole corpus, for every bucketing: they partition it.
    for (const bucket of POPULATION_BASELINE) {
      expect(bucket.n + bucket.outsideN, bucket.key).toBe(POPULATION_BASELINE_N);
    }
    expect(POPULATION_BASELINE_N).toBeGreaterThan(100_000);
  });

  it("only names buckets the detector actually looks at", () => {
    // A baseline for a bucket the product does not bucket by is a number nothing can use.
    const known = new Set(BUCKETINGS.map((b) => b.key));
    for (const bucket of POPULATION_BASELINE) expect(known.has(bucket.key), bucket.key).toBe(true);
  });
});

describe("it says nothing where nothing was measured", () => {
  it("returns null for a bucket the corpus has no baseline for", () => {
    expect(populationBucket("not-a-bucket")).toBeNull();
    expect(populationBucket("")).toBeNull();
  });

  it("returns the bucket itself where one exists", () => {
    const first = POPULATION_BASELINE[0];
    expect(populationBucket(first.key)).toEqual(first);
  });

  it("is versioned, because a baseline from another corpus is another number", () => {
    expect(POPULATION_BASELINE_VERSION).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(POPULATION_BASELINE_VERSION)).toBe(true);
  });
});

describe("the confound it exists for is real and is in the data", () => {
  it("shows the middlegame is harder for everyone, not just for one player", () => {
    /*
     * THE FINDING THAT JUSTIFIES THE WHOLE FILE. If this ever stops holding, the baseline is
     * either measuring something else or the corpus changed shape -- and either way a bucket's
     * raw accuracy has become interpretable on its own, which would be news.
     */
    const middlegame = populationBucket("phase-middlegame")!;
    expect(middlegame.accuracy).toBeLessThan(middlegame.outsideAccuracy - 0.05);
  });

  it("shows the slow bucket is worse for everyone, which is reverse causation and not fatigue", () => {
    // People think longer BECAUSE the position is hard. The population cannot be tired.
    const slow = populationBucket("slow-over-2m")!;
    expect(slow.accuracy).toBeLessThan(slow.outsideAccuracy - 0.05);
  });
});

describe("it was built with the product's own definitions", () => {
  it("reads the accuracy rule and the buckets from the shared modules, not its own copies", () => {
    /*
     * Asserted against the source, because this is a claim about what the generator is allowed to
     * define for itself. A baseline with its own threshold would look identical in the output and
     * be a different measurement.
     */
    const script = readFileSync(resolve(root, "scripts/build_population_baseline.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(script).toMatch(/import \{[\s\S]*?ACCURATE_WIN_PROBABILITY_LOSS[\s\S]*?\} from "\.\.\/shared\/detector/);
    expect(script).toMatch(/BUCKETINGS/);
    expect(script).toMatch(/classifyPhase/);
    expect(script, "the generator defines its own accuracy threshold").not.toMatch(
      /const\s+\w*ACCURATE\w*\s*=/,
    );
  });
});
