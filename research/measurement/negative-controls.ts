/**
 * THE POSITIVE CONTROLS FOR THE MEASUREMENT SYSTEM.
 *
 * A control here is a situation where the measurement MUST NOT report a discrimination, or must
 * report one for a reason the analysis is obliged to notice. Each one is a specific false claim,
 * and the test beside this file asserts that the false claim fails FOR ITS OWN REASON -- not that
 * some number came out small. A suite of controls that all fail the same way is one control
 * copied eight times.
 *
 * The eight are the ones `DECISION LAB -- REQUIRED NEGATIVE CONTROLS` names, in that order.
 * Two of them are the interesting ones:
 *
 *   `itemDifficultyConfound` is a control the current design DOES NOT PASS, and it is written
 *   here so that failure is a committed, executable fact rather than a caveat in prose. An agent
 *   with literally zero discrimination ability produces a large positive d' when T+ items are
 *   easier than T- items. d' does not repair a confounded item set and was never going to.
 *
 *   `measurementOnlyImprovement` shows that a pre/post contrast claims an intervention effect
 *   from practice alone, and that the same data under a between-arm contrast does not. This is
 *   why F8 exists and why `post > pre` is refused as a design.
 *
 * DETERMINISTIC. Every control takes a seed and uses `mulberry32`; no control depends on the
 * ambient random number generator, and re-running one gives the same numbers on any machine.
 */

import { computeSdt, tabulate, type Counts, type SdtResult, type Trial } from "./sdt.js";

/** mulberry32: a small, well-known, fully specified 32-bit PRNG. Seeded, portable, disposable. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ControlItem {
  readonly itemId: string;
  readonly triggerState: "positive" | "negative";
  /**
   * The probability a participant WITH NO DISCRIMINATION AT ALL takes the designated capture on
   * this item. It is a property of the item -- how inviting the capture looks -- and it is the
   * whole mechanism of the item-difficulty confound.
   */
  readonly pull: number;
}

export type Agent = (item: ControlItem, rng: () => number) => 0 | 1;

export function makeItems(nPositive: number, nNegative: number, pull: (s: "positive" | "negative") => number): ControlItem[] {
  const items: ControlItem[] = [];
  for (let i = 0; i < nPositive; i += 1) {
    items.push({ itemId: `P${i}`, triggerState: "positive", pull: pull("positive") });
  }
  for (let i = 0; i < nNegative; i += 1) {
    items.push({ itemId: `N${i}`, triggerState: "negative", pull: pull("negative") });
  }
  return items;
}

export function run(items: readonly ControlItem[], agent: Agent, seed: number): Trial[] {
  const rng = mulberry32(seed);
  return items.map((item) => ({ triggerState: item.triggerState, behaviour: agent(item, rng) }));
}

export function score(trials: readonly Trial[]): SdtResult {
  return computeSdt(tabulate(trials));
}

/* ------------------------------------------------------------------ the agents */

/** Captures whenever a capture is available. Should look RECKLESS, never skilled. */
export const alwaysCapture: Agent = () => 1;

/** Never captures. Should look INERT, never cautious-and-accurate. */
export const neverCapture: Agent = () => 0;

/** Captures at a fixed rate that ignores the item entirely. Should converge to chance. */
export function randomAgent(p: number): Agent {
  return (_item, rng) => (rng() < p ? 1 : 0);
}

/** Told the truth and acts on it. Should approach ceiling; anything less is a scoring bug. */
export const oracleAgent: Agent = (item) => (item.triggerState === "positive" ? 1 : 0);

/**
 * Responds ONLY to how inviting the item looks. Has no access to the trigger state and no
 * discrimination ability whatsoever. When T+ items are more inviting than T- items -- which is
 * exactly what the corpus audit found -- this agent produces a large d'.
 */
export const pullOnlyAgent: Agent = (item, rng) => (rng() < item.pull ? 1 : 0);

/* ------------------------------------------------------------------ the controls */

export interface ShuffleControl {
  readonly observed: SdtResult;
  readonly shuffled: readonly SdtResult[];
  readonly shuffledMeanDPrime: number;
  readonly shuffledMaxAbsDPrime: number;
}

/**
 * LABEL-SHUFFLE. Permute which items were T+ and which were T-, keeping behaviour fixed.
 *
 * The measurement must collapse. If it does not, d' is reading something about the items or the
 * order rather than about the relationship between the trigger and the act.
 */
export function labelShuffleControl(trials: readonly Trial[], seed: number, reps = 200): ShuffleControl {
  const observed = score(trials);
  const behaviours = trials.map((t) => t.behaviour);
  const states = trials.map((t) => t.triggerState);
  const rng = mulberry32(seed);
  const shuffled: SdtResult[] = [];
  for (let r = 0; r < reps; r += 1) {
    const perm = states.slice();
    for (let i = perm.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    shuffled.push(score(perm.map((s, i) => ({ triggerState: s, behaviour: behaviours[i] }))));
  }
  const ds = shuffled.map((s) => s.dPrime);
  return {
    observed,
    shuffled,
    shuffledMeanDPrime: ds.reduce((a, b) => a + b, 0) / ds.length,
    shuffledMaxAbsDPrime: Math.max(...ds.map(Math.abs)),
  };
}

/**
 * OUTCOME-LEAK. Strip every engine, SEE, theme and result field and re-score.
 *
 * The number must be IDENTICAL, not merely close. Scoring reads the preregistered trigger state
 * and the recorded act, and nothing else; if removing an oracle field changes a score then an
 * oracle is inside the score, which is F4's failure mode arriving through the back door.
 */
export function outcomeLeakControl<T extends Trial>(
  rich: readonly (T & Record<string, unknown>)[],
): { withOracles: Counts; withoutOracles: Counts; identical: boolean } {
  const withOracles = tabulate(rich);
  const stripped: Trial[] = rich.map((r) => ({
    triggerState: r.triggerState,
    behaviour: r.behaviour,
  }));
  const withoutOracles = tabulate(stripped);
  const identical =
    withOracles.hits === withoutOracles.hits &&
    withOracles.misses === withoutOracles.misses &&
    withOracles.falseAlarms === withoutOracles.falseAlarms &&
    withOracles.correctRejections === withoutOracles.correctRejections;
  return { withOracles, withoutOracles, identical };
}

export interface ConfoundControl {
  readonly sdt: SdtResult;
  readonly trueDiscriminationAbility: 0;
  readonly positivePull: number;
  readonly negativePull: number;
  /** What a naive reader would conclude, stated so a test can assert it is WRONG. */
  readonly naiveClaim: string;
}

/**
 * ITEM-DIFFICULTY CONFOUND. T+ items are more inviting than T- items; the participant has no
 * discrimination ability at all.
 *
 * The measurement MUST NOT be able to tell this apart from real discrimination on its own, and
 * the control's job is to make that limitation executable. What separates the two is not a
 * better statistic -- it is matching the item sets, which is a design act and not an analysis
 * act.
 */
export function itemDifficultyConfound(
  positivePull: number,
  negativePull: number,
  n: number,
  seed: number,
): ConfoundControl {
  const items = makeItems(n, n, (s) => (s === "positive" ? positivePull : negativePull));
  const sdt = score(run(items, pullOnlyAgent, seed));
  return {
    sdt,
    trueDiscriminationAbility: 0,
    positivePull,
    negativePull,
    naiveClaim: `d' = ${sdt.dPrime.toFixed(2)} > 0, therefore the participant discriminates`,
  };
}

export interface PracticeControl {
  readonly interventionArm: readonly SdtResult[];
  readonly controlArm: readonly SdtResult[];
  readonly naivePrePost: number;
  readonly differenceInDifferences: number;
  readonly truthEffectOfIntervention: number;
}

/**
 * MEASUREMENT-ONLY IMPROVEMENT. Repeated testing raises sensitivity; the intervention does
 * nothing. A pre/post contrast on the treated arm claims an effect anyway.
 *
 * `truthEffectOfIntervention` is 0 BY CONSTRUCTION. Any analysis that reports a positive effect
 * here is reporting practice, and the only thing in this function that gets the right answer is
 * the between-arm contrast -- which is the argument for F8 in nine lines of simulation.
 */
export function measurementOnlyImprovement(
  sessions: number,
  perSession: number,
  baselineD: number,
  practicePerSession: number,
  interventionAtSession: number,
  seed: number,
): PracticeControl {
  const rng = mulberry32(seed);

  const armFor = (): SdtResult[] =>
    Array.from({ length: sessions }, (_unused, s) => {
      // A participant whose sensitivity is baselineD + practice*s, expressed as an equal-variance
      // pair of rates: hit rate Phi(d/2 - c) and false alarm Phi(-d/2 - c) at c = 0.
      const d = baselineD + practicePerSession * s;
      const h = 1 / (1 + Math.exp(-1.702 * (d / 2)));
      const f = 1 / (1 + Math.exp(-1.702 * (-d / 2)));
      let hits = 0;
      let fas = 0;
      for (let i = 0; i < perSession; i += 1) {
        if (rng() < h) hits += 1;
        if (rng() < f) fas += 1;
      }
      return computeSdt({
        hits,
        misses: perSession - hits,
        falseAlarms: fas,
        correctRejections: perSession - fas,
      });
    });

  const interventionArm = armFor();
  const controlArm = armFor();

  const pre = interventionArm[interventionAtSession - 1].dPrime;
  const post = interventionArm[sessions - 1].dPrime;
  const cPre = controlArm[interventionAtSession - 1].dPrime;
  const cPost = controlArm[sessions - 1].dPrime;

  return {
    interventionArm,
    controlArm,
    naivePrePost: post - pre,
    differenceInDifferences: post - pre - (cPost - cPre),
    truthEffectOfIntervention: 0,
  };
}
