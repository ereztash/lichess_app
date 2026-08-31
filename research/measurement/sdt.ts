/**
 * SIGNAL DETECTION THEORY IN TYPESCRIPT, PORTED AFTER EQUIVALENCE.
 *
 * `research/measurement/sdt.py` is the implementation every corpus number in
 * `docs/measurement/FALSIFICATION_REGISTER.md` was produced by. This is the same arithmetic in
 * the language the negative controls and their tests run in, and it exists for one reason: the
 * controls have to run inside `npm test`, on every build, with no Python in the loop. A control
 * that only runs when somebody remembers to run it is not a control.
 *
 * THIS IS `PORT_AFTER_EQUIVALENCE` IN THE SENSE `docs/decisions/README.md` DEFINES. The port is
 * differenced against the original before it is used: `equivalence/sdt_grid.json` is generated
 * BY the Python and `tests/research/measurement-sdt.test.ts` asserts this file reproduces every
 * row of it. If the two ever disagree the build goes red, which is the only thing that makes two
 * implementations of one formula safe to have.
 *
 * FORMULAE: Stanislaw, H., & Todorov, N. (1999), Behavior Research Methods, Instruments, &
 * Computers 31(1), 137-149. Loglinear correction: Hautus, M. J. (1995), BRMIC 27(1), 46-51.
 *
 * NOT IN THE PRODUCT BUNDLE. This file lives under `research/` and nothing in `client/`,
 * `server/` or `shared/` imports it. Whether any of it earns its way into the product is a
 * question `docs/measurement/GO_NO_GO.md` answers, and the answer there is not yet.
 */

export interface Counts {
  readonly hits: number;
  readonly misses: number;
  readonly falseAlarms: number;
  readonly correctRejections: number;
}

export interface SdtResult {
  readonly hitRate: number;
  readonly falseAlarmRate: number;
  readonly dPrime: number;
  readonly criterionC: number;
  readonly beta: number;
  readonly aPrime: number;
  readonly bDoublePrimeD: number;
  readonly correction: "loglinear" | "none";
  readonly signalTrials: number;
  readonly noiseTrials: number;
}

/**
 * The inverse standard normal CDF.
 *
 * Acklam's rational approximation, whose stated relative error is below 1.15e-9 over the whole
 * open interval. NO REFINEMENT STEP, and the reason is worth stating: a Halley step needs an
 * `erfc` of its own, a second approximation with its own error, and the honest way to describe
 * the result would then be "two approximations, one tolerance". The equivalence fixture is
 * asserted at 1e-8 absolute, which this clears and which is four orders of magnitude finer than
 * any d' this program will ever interpret.
 */
export function normalQuantile(p: number): number {
  if (!(p > 0 && p < 1)) {
    throw new RangeError(
      `normalQuantile needs 0 < p < 1, got ${p}. An extreme rate reached this function, ` +
        `which means a correction was skipped upstream.`,
    );
  }
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p > pHigh) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return (
      -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  const q = p - 0.5;
  const r = q * q;
  return (
    ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  );
}

/**
 * Hits+0.5 over signal trials+1, false alarms+0.5 over noise trials+1.
 *
 * APPLIED TO EVERY TABLE, not only to the degenerate ones, because a correction whose
 * application depends on the data biases the corrected estimate by an amount that varies with
 * the true rate. This is what Hautus's recommendation actually is, and the alternative --
 * correcting only zeros and ones -- is the version that is easy to write and wrong.
 */
export function loglinearRates(counts: Counts): { hitRate: number; falseAlarmRate: number } {
  const signal = counts.hits + counts.misses;
  const noise = counts.falseAlarms + counts.correctRejections;
  return {
    hitRate: (counts.hits + 0.5) / (signal + 1),
    falseAlarmRate: (counts.falseAlarms + 0.5) / (noise + 1),
  };
}

export function computeSdt(counts: Counts, correction: "loglinear" | "none" = "loglinear"): SdtResult {
  const signalTrials = counts.hits + counts.misses;
  const noiseTrials = counts.falseAlarms + counts.correctRejections;

  let hitRate: number;
  let falseAlarmRate: number;
  if (correction === "loglinear") {
    ({ hitRate, falseAlarmRate } = loglinearRates(counts));
  } else {
    if (signalTrials === 0 || noiseTrials === 0) {
      throw new RangeError("no trials of one type; d' is undefined, not infinite");
    }
    hitRate = counts.hits / signalTrials;
    falseAlarmRate = counts.falseAlarms / noiseTrials;
  }

  const zh = normalQuantile(hitRate);
  const zf = normalQuantile(falseAlarmRate);
  const dPrime = zh - zf;
  const criterionC = -0.5 * (zh + zf);
  const beta = Math.exp((zf * zf - zh * zh) / 2);

  const h = hitRate;
  const f = falseAlarmRate;
  const aPrime =
    h >= f
      ? 0.5 + ((h - f) * (1 + h - f)) / (4 * h * (1 - f))
      : 0.5 - ((f - h) * (1 + f - h)) / (4 * f * (1 - h));

  const num = h * (1 - h) - f * (1 - f);
  const den = h * (1 - h) + f * (1 - f);
  const bDoublePrimeD = den === 0 ? 0 : num / den;

  return {
    hitRate,
    falseAlarmRate,
    dPrime,
    criterionC,
    beta,
    aPrime,
    bDoublePrimeD,
    correction,
    signalTrials,
    noiseTrials,
  };
}

export type TriggerState = "positive" | "negative" | "unknown";

export interface Trial {
  readonly triggerState: TriggerState;
  readonly behaviour: 0 | 1;
}

/**
 * Fold trials into a 2x2 table.
 *
 * AN `unknown` ITEM THROWS. It does not shrink a denominator quietly. The item bank is what
 * excludes UNKNOWNs; a scorer that tolerated them would let an exclusion rule be decided by
 * whichever items happened to arrive.
 */
export function tabulate(trials: readonly Trial[]): Counts {
  let hits = 0;
  let misses = 0;
  let falseAlarms = 0;
  let correctRejections = 0;
  for (const t of trials) {
    if (t.triggerState === "positive") {
      if (t.behaviour === 1) hits += 1;
      else misses += 1;
    } else if (t.triggerState === "negative") {
      if (t.behaviour === 1) falseAlarms += 1;
      else correctRejections += 1;
    } else {
      throw new RangeError(
        "an UNKNOWN item reached the scorer; UNKNOWNs are excluded by the item bank, " +
          "never by the scoring function",
      );
    }
  }
  return { hits, misses, falseAlarms, correctRejections };
}

/** Wilson score interval. Wald is not used: these rates sit near 0 and 1 by design. */
export function wilsonInterval(successes: number, trials: number, z = 1.96): [number, number] {
  if (trials === 0) return [Number.NaN, Number.NaN];
  const p = successes / trials;
  const denom = 1 + (z * z) / trials;
  const centre = (p + (z * z) / (2 * trials)) / denom;
  const half =
    (z * Math.sqrt((p * (1 - p)) / trials + (z * z) / (4 * trials * trials))) / denom;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}
