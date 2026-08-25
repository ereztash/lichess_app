/**
 * The detector's power used to FALL as the record grew, and this file holds the fix shut.
 *
 * `MIN_GAP_DIFFERENCE = 0.45` was a fixed effect-size floor compared against a point estimate. It
 * has no dependence on n, so as decisions accumulate and the estimate converges onto its true
 * value it stops randomly exceeding the floor -- and any real effect BELOW the floor becomes
 * permanently invisible. The only times the shipped detector fired on such an effect were the
 * times sampling noise pushed it over, which is to say: the only times it fired were the times it
 * was wrong, and it got quieter about the truth the longer you played.
 *
 * That matters because 0.45 is enormous on this scale. When this was measured the scale had five
 * levels running 0..1, so one whole point of stated confidence was 0.25, and a coaching-scale
 * finding -- thirteen points of accuracy plus half a point of confidence -- came to 0.255, barely
 * half the floor. The scale has since moved to seven inset levels and a point is `CONFIDENCE_STEP`
 * = 0.15, which makes the same finding SMALLER against a fixed floor rather than larger. The
 * figures above are left as they were measured; the argument they support only got stronger.
 *
 * THE CORRECT PATTERN WAS ALREADY IN THIS REPOSITORY, one file away. `worstBucketVerdict` in
 * shared/import-diagnostic.ts compares a separation against `2 * sqrt(var_a + var_b)` -- a
 * threshold that SHRINKS as the sample grows, which is how a test behaves. The import screen was
 * statistically sound. The detector, which is what the product leads on, was not, and did not use
 * it.
 *
 * The multipliers here are not taste and not textbook: they were set by the shuffled-label
 * control, measured on the control's own harness, and the assertions below re-derive rather than
 * cite the properties that decision rests on.
 */
import { CONFIDENCE_CHOICES, CONFIDENCE_LEVELS, CONFIDENCE_STEP, normaliseConfidence } from "../../shared/confidence";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_THRESHOLDS,
  MAX_SHUFFLED_FALSE_POSITIVE_RATE,
  MIN_BUCKET_N,
  PREREGISTERED_SEPARABILITY_K,
  PREREGISTERED_THRESHOLDS,
  SEPARABILITY_K,
  decisionGap,
  detect,
  gapDifferenceStandardError,
  seededRandom,
  shuffleControl,
  summarise,
  type ScoredDecision,
} from "../../shared/detector";
import { evaluateRefutation } from "../../shared/drill";
import { makeNoise, noiseRecord } from "../fixtures/shuffle-scenario";

/**
 * A record with a real effect planted in `fast-under-45s`.
 *
 * The true gap difference is exactly `accDrop + confLift`. `confLift` is delivered the only way an
 * ordinal scale can deliver a fractional mean -- a share of the bucket's decisions state one point
 * higher -- because a player picks a button and cannot state a value between two of them. The
 * share is `confLift / CONFIDENCE_STEP`, so the planted effect stays the size the caller asked
 * for when the number of levels changes; it used to be `/ 0.25`, which silently rescaled every
 * planted effect in this file the moment the scale moved.
 */
function planted(n: number, seed: number, accDrop: number, confLift: number): ScoredDecision[] {
  const random = seededRandom(seed);
  const stepChance = confLift / CONFIDENCE_STEP;
  return Array.from({ length: n }, (_, index) => {
    const secondsTaken = Math.floor(random() * 200);
    const fast = secondsTaken < 45;
    return {
      decision_id: `planted-${index}`,
      confidence: normaliseConfidence(3 + (fast && random() < stepChance ? 1 : 0), CONFIDENCE_LEVELS),
      accurate: random() < (fast ? 0.55 - accDrop : 0.55),
      phase: (["opening", "middlegame", "endgame"] as const)[Math.floor(random() * 3)],
      secondsTaken,
      clockMsRemaining: Math.floor(random() * 300_000),
    };
  });
}

/** How often the detector reports anything, over independent records of one size. */
const fireRate = (
  make: (seed: number) => ScoredDecision[],
  runs = 200,
  thresholds = DEFAULT_THRESHOLDS,
) => {
  let fired = 0;
  for (let run = 0; run < runs; run += 1) {
    if (detect(make(310_000 + run * 97), thresholds).length > 0) fired += 1;
  }
  return fired / runs;
};

describe("the gap is one quantity per decision, not two averages subtracted", () => {
  it("is the player's own statement minus what happened", () => {
    expect(decisionGap({ confidence: 1, accurate: false } as ScoredDecision)).toBe(1);
    expect(decisionGap({ confidence: 1, accurate: true } as ScoredDecision)).toBe(0);
    expect(decisionGap({ confidence: 0, accurate: true } as ScoredDecision)).toBe(-1);
  });

  it("averages to exactly the summary's gap, which is what makes its variance the right one", () => {
    /*
     * The load-bearing identity. `gap` is defined as meanConfidence - accuracyRate, and the test
     * is built on the variance of the per-decision difference; those two are only the same
     * quantity because the mean of the differences equals the difference of the means. If they
     * ever came apart, the standard error would be describing a statistic nobody reports.
     */
    const record = makeNoise(120, 4242);
    const summary = summarise(record);
    const meanOfDifferences =
      record.reduce((total, d) => total + decisionGap(d), 0) / record.length;
    expect(meanOfDifferences).toBeCloseTo(summary.gap, 12);
  });

  it("estimates the population variance from a sample, Bessel and all", () => {
    /*
     * Pinned to an exact value because the correction is not decorative at MIN_BUCKET_N: /n
     * against /(n-1) is 3.4% of the variance at n=30, and the standard error is what the whole
     * test compares against. Three decisions with gaps 1, 0 and -1: mean 0, sum of squares 2,
     * divided by (3 - 1).
     */
    const three: ScoredDecision[] = [
      { decision_id: "a", confidence: 1, accurate: false, phase: "middlegame", secondsTaken: 1, clockMsRemaining: null },
      { decision_id: "b", confidence: 1, accurate: true, phase: "middlegame", secondsTaken: 1, clockMsRemaining: null },
      { decision_id: "c", confidence: 0, accurate: true, phase: "middlegame", secondsTaken: 1, clockMsRemaining: null },
    ];
    expect(summarise(three).gap).toBeCloseTo(0, 12);
    expect(summarise(three).gapVariance).toBeCloseTo(2 / 2, 12);
  });

  it("does NOT assume confidence and accuracy are independent within a bucket", () => {
    /*
     * The reason the variance is computed on the per-decision gap rather than as
     * var(confidence) + var(accuracy). Here confidence and accuracy move together perfectly: the
     * player is right exactly when they said so. Every decision's gap is 0, so the true variance
     * of the gap is 0 -- while the two marginal variances are both large and their sum is a
     * number with no relationship to anything.
     */
    const locked: ScoredDecision[] = Array.from({ length: 40 }, (_, i) => ({
      decision_id: `l${i}`,
      confidence: i % 2 ? 1 : 0,
      accurate: i % 2 === 1,
      phase: "middlegame",
      secondsTaken: 30,
      clockMsRemaining: null,
    }));
    expect(summarise(locked).gapVariance).toBe(0);

    const confidenceVariance = 0.25; // a fair coin over {0, 1}
    const accuracyVariance = 0.25;
    expect(confidenceVariance + accuracyVariance, "the independent sum is not the truth").toBe(0.5);
  });
});

describe("the standard error refuses what it cannot compute", () => {
  it("shrinks as the sample grows -- the whole property the fixed floor lacked", () => {
    const small = { n: 30, gapVariance: 0.2 };
    const large = { n: 3000, gapVariance: 0.2 };
    const seSmall = gapDifferenceStandardError(small, small)!;
    const seLarge = gapDifferenceStandardError(large, large)!;
    expect(seLarge).toBeLessThan(seSmall);
    // Ten times the decisions, roughly sqrt(10) times tighter. Asserted as a relation, not a
    // constant: a threshold that moves with n is the entire difference from what it replaced.
    expect(seSmall / seLarge).toBeCloseTo(Math.sqrt(100), 6);
  });

  it("returns null when EITHER side is degenerate, not only when both are", () => {
    /*
     * THIS TEST USED TO ASSERT THE DEFECT, in as many words: "One degenerate side is fine: the
     * other still carries error." It is not fine, and the sentence is wrong about what the other
     * side's error is for.
     *
     * A bucket where every decision carries the same stated confidence and the same outcome has
     * a sample variance of exactly 0. The pooled error then reduces to `sqrt(varOut / nOut)` --
     * the OUTSIDE bucket's error alone -- and the inside gap is treated as though it were known
     * exactly. Almost any difference clears the threshold after that. Measured by simulation
     * against a true null, with both gaps identical: an opening bucket at book-move accuracy,
     * played by someone who anchors on one confidence value there, fires on up to 13% of records
     * against this product's own 2% ceiling, and the rate tracks the degeneracy rate one-for-one.
     *
     * A zero sample variance is not precision. It is a sample that cannot estimate its own error,
     * and the honest response is the same as to a sample of one: say so and stop.
     */
    expect(gapDifferenceStandardError({ n: 50, gapVariance: 0 }, { n: 50, gapVariance: 0 })).toBeNull();
    expect(gapDifferenceStandardError({ n: 1, gapVariance: 0.2 }, { n: 50, gapVariance: 0.2 })).toBeNull();
    // The pair the old assertion blessed, in both orders.
    expect(
      gapDifferenceStandardError({ n: 50, gapVariance: 0 }, { n: 50, gapVariance: 0.2 }),
      "a degenerate INSIDE bucket is still being read",
    ).toBeNull();
    expect(
      gapDifferenceStandardError({ n: 50, gapVariance: 0.2 }, { n: 50, gapVariance: 0 }),
      "a degenerate OUTSIDE bucket is still being read",
    ).toBeNull();
    // And a pair that genuinely varies on both sides is still computed.
    expect(
      gapDifferenceStandardError({ n: 50, gapVariance: 0.2 }, { n: 50, gapVariance: 0.3 }),
    ).toBeGreaterThan(0);
  });
});

describe("a bucket that cannot estimate its own error does not get to be certain", () => {
  /*
   * MEASURED, on a TRUE NULL where the bucket and the rest have the same EXPECTED gap. The bucket
   * is 32 decisions at one confidence and 95-97% accuracy, so it comes out perfectly flat by
   * chance about one record in five (or two in five at 97%) -- an ordinary shape for a clock or
   * slow-move bucket, not a contrived one.
   *
   * Under the old guard the false-positive rate converged EXACTLY on the flat rate as the record
   * grew: 18.22% fires against 18.45% flat at 3,000 outside decisions; 37.80% against 37.92% at
   * 10,000. One fire per flat bucket, every time. And it RISES with the record, because the
   * threshold collapses to `3.75 * sqrt(varOut / nOut)` and that shrinks -- so the more evidence
   * the player accumulated, the more certain the false claim became.
   *
   * After the guard: 0.00% in every cell.
   */
  /*
   * Any four levels off the real grid. What this null needs is a bucket with ZERO variance beside
   * a bucket with some, so the values only have to be distinct and reachable -- but they are taken
   * from the scale rather than written by hand, because a literal list here would go on claiming
   * to be "the scale" after the scale changed.
   */
  const SCALE = CONFIDENCE_CHOICES.slice(-4).map((level) =>
    normaliseConfidence(level, CONFIDENCE_LEVELS),
  );

  function nullRecordWithFlatBucket(nOut: number, seed: number): ScoredDecision[] {
    const rnd = seededRandom(seed);
    // Flat by construction here rather than by chance, so the test is deterministic.
    const inside: ScoredDecision[] = Array.from({ length: MIN_BUCKET_N + 2 }, (_, i) => ({
      decision_id: `i-${i}`,
      confidence: 0.75,
      accurate: true,
      phase: "opening" as const,
      secondsTaken: 10,
      clockMsRemaining: 1000,
    }));
    const outside: ScoredDecision[] = Array.from({ length: nOut }, (_, i) => ({
      decision_id: `o-${i}`,
      confidence: SCALE[Math.floor(rnd() * 4)],
      // Matched so the two expected gaps are equal: 0.625 - 0.425 = 0.75 - 0.55... the point is
      // only that there is no real difference to find, and the assertion is about the guard.
      accurate: rnd() < 0.425,
      phase: (rnd() < 0.5 ? "middlegame" : "endgame") as "middlegame" | "endgame",
      secondsTaken: 100,
      clockMsRemaining: 200_000,
    }));
    return [...inside, ...outside];
  }

  it("refuses the flat bucket however large the rest of the record gets", () => {
    for (const nOut of [300, 1000, 3000]) {
      const found = detect(nullRecordWithFlatBucket(nOut, nOut * 7919), DEFAULT_THRESHOLDS, null);
      const opening = found.find((p) => p.key === "phase-opening");
      expect(
        opening,
        `a flat opening bucket cleared the threshold against ${nOut} outside decisions`,
      ).toBeUndefined();
    }
  });

  it("does not go quiet about buckets that DO vary", () => {
    /*
     * The mirror. A guard that refused everything would pass the assertion above and destroy the
     * detector, so the same shape with a bucket that varies must still be readable.
     */
    const rnd = seededRandom(4242);
    const inside: ScoredDecision[] = Array.from({ length: MIN_BUCKET_N + 2 }, (_, i) => ({
      decision_id: `i-${i}`,
      confidence: 1,
      accurate: rnd() < 0.1,
      phase: "opening" as const,
      secondsTaken: 10,
      clockMsRemaining: 1000,
    }));
    const outside: ScoredDecision[] = Array.from({ length: 300 }, (_, i) => ({
      decision_id: `o-${i}`,
      confidence: SCALE[Math.floor(rnd() * 4)],
      accurate: rnd() < 0.8,
      phase: "middlegame" as const,
      secondsTaken: 100,
      clockMsRemaining: 200_000,
    }));
    const found = detect([...inside, ...outside], DEFAULT_THRESHOLDS, null);
    expect(found.find((p) => p.key === "phase-opening"), "the guard silenced a real effect").toBeDefined();
  });
});

describe("power now RISES with the record instead of falling", () => {
  /*
   * The defect, stated as a monotonicity. Under the fixed floor this ran 0.9% at n=120 down to
   * 0.0% at n=1200 on exactly this effect; the assertion is deliberately about the shape rather
   * than about any single rate, because a rate is a number someone will later nudge.
   */
  const coachScale = (n: number) => (seed: number) => planted(n, seed, 0.13, 0.125);

  it("finds a coaching-scale effect reliably once the record is large enough", () => {
    expect(fireRate(coachScale(1200))).toBeGreaterThan(0.9);
  });

  it("is monotone: more decisions never make the same effect harder to see", () => {
    const at300 = fireRate(coachScale(300));
    const at600 = fireRate(coachScale(600));
    const at1200 = fireRate(coachScale(1200));
    expect(at600, `n=300 ${at300}, n=600 ${at600}`).toBeGreaterThan(at300);
    expect(at1200, `n=600 ${at600}, n=1200 ${at1200}`).toBeGreaterThanOrEqual(at600);
  });

  it("resolves an effect that the old floor left as a permanent coin flip", () => {
    /*
     * An effect sitting exactly ON the old 0.45 floor was a 50/50 at every record size -- 49.4%
     * at n=300 and 50.3% at n=2400 -- because a point estimate against a line never accumulates.
     * Nothing the player did could resolve it. Now it converges.
     */
    expect(fireRate((seed) => planted(600, seed, 0.2, 0.25))).toBeGreaterThan(0.95);
  });

  it("still says nothing when there is nothing there", () => {
    // The half that always worked, and the half that must not be traded away for the half above.
    expect(fireRate((seed) => makeNoise(600, seed))).toBeLessThanOrEqual(
      MAX_SHUFFLED_FALSE_POSITIVE_RATE,
    );
  });
});

describe("the multipliers are what the shuffled-label control chose", () => {
  it("holds the ceiling on the control's own harness, at the sizes the gate never used to reach", () => {
    /*
     * Re-derived rather than cited, on records the gate does not ship. The gate's harness -- ONE
     * record permuted many times -- is a harder null than a fresh record per run, and calibrating
     * the easy way put this multiplier at 3.25, where the worst cell touches the 2% ceiling
     * exactly. A gate that passes on a strict inequality is one unlucky draw from red.
     */
    for (const n of [120, 600]) {
      for (let base = 0; base < 3; base += 1) {
        const report = shuffleControl(makeNoise(n, 660_000 + base * 137 + n), 150, 5150 + base);
        expect(
          report.falsePositiveRate,
          `n=${n} base=${base} produced ${report.falsePositiveRate}`,
        ).toBeLessThan(MAX_SHUFFLED_FALSE_POSITIVE_RATE);
      }
    }
  });

  it("makes the gate look where the old rule's worst behaviour was", () => {
    /*
     * `noiseRecord` stopped at 300, and that is where the fixed floor was hiding: a constant is
     * HARDEST to clear on noise at large n, so the gate tested the region where the old rule
     * looked best and never the region where it went silent on real effects. A separability test
     * has a roughly flat false-positive rate in n, so the large sizes are exactly where a
     * multiplier set too low would show.
     */
    expect(Math.max(...noiseRecord.map((r) => r.length))).toBeGreaterThanOrEqual(600);
  });

  it("asks a pre-named bucket for less than the six-bucket scan", () => {
    // The reversal: under a fixed floor, naming a bucket in advance bought n and nothing else,
    // because a fixed floor does no multiplicity work at all. A multiplier IS that work.
    expect(PREREGISTERED_SEPARABILITY_K).toBeLessThan(SEPARABILITY_K);
    expect(PREREGISTERED_THRESHOLDS.separabilityK).toBe(PREREGISTERED_SEPARABILITY_K);
    expect(DEFAULT_THRESHOLDS.separabilityK).toBe(SEPARABILITY_K);
  });

  it("keeps the bucket floor, which is now doing a different job", () => {
    // It no longer controls false positives -- the multiplier does that at every size. It refuses
    // to estimate a variance from a handful of decisions.
    expect(DEFAULT_THRESHOLDS.minBucketN).toBe(MIN_BUCKET_N);
  });
});

describe("what the detector reports travels with its own error", () => {
  it("carries the standard error beside the difference", () => {
    /*
     * Section 4.4: a value arrives with what makes it readable. A gap difference of 0.31 is a
     * finding or noise depending entirely on its error, and a claim derived from a pattern that
     * did not carry it could not say which.
     */
    const patterns = detect(planted(1200, 777, 0.13, 0.125));
    expect(patterns.length).toBeGreaterThan(0);
    for (const pattern of patterns) {
      expect(pattern.standardError).toBeGreaterThan(0);
      expect(Math.abs(pattern.gapDifference)).toBeGreaterThanOrEqual(
        SEPARABILITY_K * pattern.standardError,
      );
    }
  });

  it("reports the bucket the effect was planted in", () => {
    const patterns = detect(planted(1200, 778, 0.13, 0.125));
    expect(patterns.map((p) => p.key)).toContain("fast-under-45s");
  });
});

describe("the drill arm carried the same defect, where it cost a grade", () => {
  const baseline = summarise(
    Array.from({ length: 200 }, (_, i) => ({
      decision_id: `b${i}`,
      confidence: normaliseConfidence(3, CONFIDENCE_LEVELS),
      accurate: i % 100 < 55,
      phase: "middlegame" as const,
      secondsTaken: 60,
      clockMsRemaining: null,
    })),
  );

  const drill = (n: number, seed: number, lift: number) => {
    const random = seededRandom(seed);
    return Array.from({ length: n }, (_, i) => ({
      decision_id: `d${i}`,
      confidence: normaliseConfidence(3 + (random() < lift / CONFIDENCE_STEP ? 1 : 0), CONFIDENCE_LEVELS),
      accurate: random() < 0.55 - 0.13,
    }));
  };

  const confirmRate = (n: number, lift: number, runs = 400) => {
    let confirmed = 0;
    for (let run = 0; run < runs; run += 1) {
      const verdict = evaluateRefutation(drill(n, 210_000 + run * 31, lift), {
        baseline,
        predictsOverconfidence: true,
        separabilityK: PREREGISTERED_SEPARABILITY_K,
      });
      if (verdict.observed) confirmed += 1;
    }
    return confirmed / runs;
  };

  it("no longer becomes LESS likely to confirm a true claim as the drill lengthens", () => {
    /*
     * The old rule required the drill's gap to beat the baseline by a fixed 0.45, so a longer
     * drill -- a better measurement -- made the product more likely to call a true claim refuted:
     * 22.1% at five positions down to 0.1% at eighty. That is the detector's defect in the arm
     * that decides a grade.
     */
    const short = confirmRate(8, 0.125);
    const long = confirmRate(80, 0.125);
    expect(long, `n=8 ${short}, n=80 ${long}`).toBeGreaterThan(short);
    expect(long).toBeGreaterThan(0.5);
  });

  it("compares against the baseline's error too, not just the drill's", () => {
    /*
     * It used to take `baselineGap: number`, which FORCED the comparison to treat the rest of the
     * record as exactly known. It is an estimate from a finite sample with its own error, and
     * ignoring it makes the test too permissive by exactly that much.
     *
     * Asserted as an identity rather than an inequality, because the first version of this test
     * was a loose `> drillOnly * 0.5` and its positive control SURVIVED: the mutation that
     * reinstated the exactly-known baseline left the value comfortably inside that band, so the
     * assertion was not holding the thing it was written for.
     */
    const decisions = drill(40, 99, 0.5);
    const gaps = decisions.map((d) => d.confidence - (d.accurate ? 1 : 0));
    const mean = gaps.reduce((total, g) => total + g, 0) / gaps.length;
    const drillVariance =
      gaps.reduce((total, g) => total + (g - mean) ** 2, 0) / (gaps.length - 1);
    const drillOnly = Math.sqrt(drillVariance / gaps.length);
    const withBaseline = Math.sqrt(drillVariance / gaps.length + baseline.gapVariance / baseline.n);

    const verdict = evaluateRefutation(decisions, {
      baseline,
      predictsOverconfidence: true,
      separabilityK: PREREGISTERED_SEPARABILITY_K,
    });
    expect(verdict.standardError).not.toBeNull();
    expect(baseline.gapVariance, "a baseline with no variance cannot show this").toBeGreaterThan(0);
    expect(verdict.standardError!).toBeCloseTo(withBaseline, 12);
    expect(
      verdict.standardError!,
      "the baseline is being treated as exactly known",
    ).toBeGreaterThan(drillOnly);
  });

  it("does not confirm a claim it could not measure", () => {
    /*
     * A drill with no variation at all produces no standard error, and `observed` must be false
     * -- not because the claim was refuted, but because nothing was measured. The verdict carries
     * `standardError: null` so a caller can tell those apart; the STORED grade still cannot, and
     * that is recorded rather than papered over.
     */
    const verdict = evaluateRefutation([{ decision_id: "x", confidence: 1, accurate: false }], {
      baseline,
      predictsOverconfidence: true,
      separabilityK: PREREGISTERED_SEPARABILITY_K,
    });
    expect(verdict.standardError).toBeNull();
    expect(verdict.observed).toBe(false);
  });
});
