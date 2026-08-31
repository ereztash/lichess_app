/**
 * EIGHT FALSE CLAIMS, AND THE REQUIREMENT THAT EACH FAILS FOR ITS OWN REASON.
 *
 * A control suite where every case fails the same way is one control copied eight times. These
 * are written so that a single defect cannot turn them all green: the shuffle control is broken
 * by a scorer that reads item identity, the leak control by a scorer that reads an oracle field,
 * the always/never agents by a scorer that reports accuracy instead of the two rates, the
 * confound control by anyone who believes d' repairs a bad item set, and the practice control by
 * anyone who compares post with pre.
 *
 * TWO OF THESE ASSERT THAT THE CURRENT DESIGN FAILS. `itemDifficultyConfound` and
 * `measurementOnlyImprovement` are not bugs waiting to be fixed in code; they are properties of
 * the paradigm, and pinning them means a later reader cannot rediscover them as a surprise.
 */
import { describe, expect, it } from "vitest";
import {
  alwaysCapture,
  itemDifficultyConfound,
  labelShuffleControl,
  makeItems,
  measurementOnlyImprovement,
  neverCapture,
  oracleAgent,
  outcomeLeakControl,
  randomAgent,
  run,
  score,
} from "../../research/measurement/negative-controls.js";
import { computeSdt } from "../../research/measurement/sdt.js";

const SEED = 20260831;
const flat = () => 0.4;

describe("label-shuffle: the measurement must collapse when T is scrambled", () => {
  it("a real discrimination survives its own data and does not survive a shuffle", () => {
    const items = makeItems(400, 400, flat);
    const trials = run(
      items,
      (item, rng) =>
        item.triggerState === "positive" ? (rng() < 0.85 ? 1 : 0) : rng() < 0.2 ? 1 : 0,
      SEED,
    );
    const control = labelShuffleControl(trials, SEED, 200);
    expect(control.observed.dPrime).toBeGreaterThan(1.5);
    expect(Math.abs(control.shuffledMeanDPrime)).toBeLessThan(0.05);
    /*
     * The MAX over 200 shuffles, not just the mean. A mean near zero is compatible with wild
     * per-shuffle values cancelling out, and it is the largest shuffled d' that says how big an
     * observed d' has to be before it is distinguishable from a permutation of the labels.
     */
    expect(control.shuffledMaxAbsDPrime).toBeLessThan(control.observed.dPrime / 3);
  });

  it("an agent that ignores T is already at the shuffle floor before shuffling", () => {
    const items = makeItems(400, 400, flat);
    const trials = run(items, randomAgent(0.4), SEED);
    const control = labelShuffleControl(trials, SEED, 100);
    expect(Math.abs(control.observed.dPrime)).toBeLessThan(0.25);
    expect(control.shuffledMaxAbsDPrime).toBeGreaterThan(Math.abs(control.observed.dPrime) / 3);
  });
});

describe("outcome-leak: scoring reads T and B, and nothing else", () => {
  it("stripping every engine, SEE and theme field changes the table by exactly nothing", () => {
    const rich = [
      { triggerState: "positive" as const, behaviour: 1 as const, engineCp: 210, see: 330, themes: ["hangingPiece"] },
      { triggerState: "positive" as const, behaviour: 0 as const, engineCp: -40, see: 500, themes: [] },
      { triggerState: "negative" as const, behaviour: 1 as const, engineCp: -180, see: -220, themes: ["fork"] },
      { triggerState: "negative" as const, behaviour: 0 as const, engineCp: 15, see: -10, themes: [] },
    ];
    const control = outcomeLeakControl(rich);
    expect(control.identical).toBe(true);
    expect(control.withoutOracles).toEqual({
      hits: 1,
      misses: 1,
      falseAlarms: 1,
      correctRejections: 1,
    });
  });
});

describe("the four reference agents, each of which must look like what it is", () => {
  const items = makeItems(300, 300, flat);

  it("always-capture produces a false-alarm ceiling, not skill", () => {
    const s = score(run(items, alwaysCapture, SEED));
    expect(s.hitRate).toBeGreaterThan(0.99);
    expect(s.falseAlarmRate).toBeGreaterThan(0.99);
    expect(Math.abs(s.dPrime)).toBeLessThan(1e-9);
    /*
     * AND ITS ACCURACY IS 50%, which is the whole point. An agent that answers "capture" to
     * everything is right on every T+ item; a report that led with accuracy on signal trials
     * would call this agent perfect.
     */
    expect(s.criterionC).toBeLessThan(-2);
  });

  it("never-capture produces a hit floor, not caution", () => {
    const s = score(run(items, neverCapture, SEED));
    expect(s.hitRate).toBeLessThan(0.01);
    expect(s.falseAlarmRate).toBeLessThan(0.01);
    expect(Math.abs(s.dPrime)).toBeLessThan(1e-9);
    expect(s.criterionC).toBeGreaterThan(2);
  });

  it("the random agent converges toward chance discrimination", () => {
    const big = makeItems(4000, 4000, flat);
    const s = score(run(big, randomAgent(0.35), SEED));
    expect(Math.abs(s.dPrime)).toBeLessThan(0.1);
    /* Its criterion is NOT zero: a 35% capture rate is a conservative criterion honestly held. */
    expect(s.criterionC).toBeGreaterThan(0.2);
  });

  it("the oracle agent approaches ceiling, which is how we know the scoring is wired up", () => {
    const s = score(run(items, oracleAgent, SEED));
    expect(s.dPrime).toBeGreaterThan(5);
    expect(Number.isFinite(s.dPrime)).toBe(true);
  });
});

describe("item-difficulty confound: the control the current design DOES NOT pass", () => {
  it("an agent with zero discrimination ability produces a large positive d'", () => {
    /*
     * The pull values are not invented for the demonstration. The corpus audit measured T+ items
     * in real games as materially different from T- items on attacker count, material balance and
     * legal-move count, and measured T+ PUZZLES as ~125 rating points easier than T- puzzles.
     * This is what that asymmetry does to a d' when the participant contributes nothing.
     */
    const c = itemDifficultyConfound(0.78, 0.22, 2000, SEED);
    expect(c.trueDiscriminationAbility).toBe(0);
    expect(c.sdt.dPrime).toBeGreaterThan(1.5);
    expect(c.naiveClaim).toMatch(/therefore the participant discriminates/);
  });

  it("and the shuffle control does NOT catch it, which is why matching is a design act", () => {
    const items = makeItems(2000, 2000, (s) => (s === "positive" ? 0.78 : 0.22));
    const trials = run(items, (item, rng) => (rng() < item.pull ? 1 : 0), SEED);
    const control = labelShuffleControl(trials, SEED, 100);
    expect(control.observed.dPrime).toBeGreaterThan(1.5);
    /*
     * The shuffle collapses here too -- and that is exactly the trap. Passing the shuffle control
     * says the labels are doing work; it does not say the WORK IS THE PARTICIPANT'S. Only a
     * matched or counterfactual item design separates those two.
     */
    expect(Math.abs(control.shuffledMeanDPrime)).toBeLessThan(0.05);
  });
});

describe("measurement-only improvement: pre/post claims an effect that does not exist", () => {
  const c = measurementOnlyImprovement(8, 300, 1.0, 0.12, 4, SEED);

  it("the truth is that the intervention did nothing", () => {
    expect(c.truthEffectOfIntervention).toBe(0);
  });

  it("post minus pre on the treated arm reports an effect anyway", () => {
    expect(c.naivePrePost).toBeGreaterThan(0.2);
  });

  it("the between-arm contrast on the same data does not", () => {
    expect(Math.abs(c.differenceInDifferences)).toBeLessThan(c.naivePrePost);
    expect(Math.abs(c.differenceInDifferences)).toBeLessThan(0.35);
  });

  it("the treated arm's own baseline is already trending before anything is introduced", () => {
    /*
     * THE PART A SINGLE PRE-TEST CANNOT SEE. WWC single-case standards ask for repeated
     * baseline measurement precisely so that a trend like this is visible before a phase change;
     * one pre-test point cannot distinguish a flat baseline from a rising one.
     */
    const early = c.interventionArm.slice(0, 4).map((s) => s.dPrime);
    expect(early[3] - early[0]).toBeGreaterThan(0.1);
  });
});

describe("the scorer cannot be talked into a number it has no data for", () => {
  it("an empty table is refused rather than returned as zero", () => {
    expect(() =>
      computeSdt({ hits: 0, misses: 0, falseAlarms: 0, correctRejections: 0 }, "none"),
    ).toThrow();
  });
});
