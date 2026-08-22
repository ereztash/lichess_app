/**
 * Where in the loop, and what moves it.
 *
 * The ordering is the substance here. A drill in progress outranks a claim, a claim outranks the
 * distance to one, and "enough decisions, no pattern" must never render as "not enough
 * decisions" -- those are different answers and section 4.5 is about exactly that difference.
 */
import { describe, expect, it } from "vitest";
import { LOOP_STEPS, loopPosition, stepStates, type LoopInputs } from "@/lib/loop-position";

const inputs = (overrides: Partial<LoopInputs> = {}): LoopInputs => ({
  drill: null,
  recorded: 0,
  scored: 0,
  claimGrade: null,
  scoredStillNeeded: 60,
  ...overrides,
});

describe("a drill in progress outranks everything", () => {
  it("reports the drill even when a claim is on offer", () => {
    const at = loopPosition(
      inputs({ drill: { completed: 2, total: 6 }, claimGrade: "hypothesis", scored: 80 }),
    );
    expect(at.step).toBe("drill");
    expect(at.headline).toContain("2 מתוך 6");
  });

  it("says the drill is done rather than counting past its own total", () => {
    const at = loopPosition(inputs({ drill: { completed: 6, total: 6 } }));
    expect(at.headline).not.toContain("6 מתוך 6");
    expect(at.headline).toContain("הושלם");
  });
});

describe("a claim, and what can move it", () => {
  it("names the drill as the only thing that can grade a hypothesis", () => {
    const at = loopPosition(inputs({ claimGrade: "hypothesis", scored: 80, scoredStillNeeded: 0 }));
    expect(at.step).toBe("drill");
    expect(at.headline).toContain("דריל");
  });

  it("says a refuted claim is not re-tested", () => {
    const at = loopPosition(inputs({ claimGrade: "refuted", scored: 80, scoredStillNeeded: 0 }));
    expect(at.step).toBe("grade");
    expect(at.headline).toContain("לא נבדקת שוב");
  });

  it("does not treat a replicated claim as an end state", () => {
    const at = loopPosition(inputs({ claimGrade: "replicated", scored: 80, scoredStillNeeded: 0 }));
    expect(at.step).toBe("grade");
    expect(at.headline).toContain("עוד החלטות");
  });
});

describe("no claim: three different answers, never one", () => {
  it("states the distance, and what is already waiting to be revealed", () => {
    const at = loopPosition(inputs({ recorded: 20, scored: 12, scoredStillNeeded: 48 }));
    expect(at.step).toBe("record");
    expect(at.headline).toContain("עוד 48 החלטות חשופות");
    // Matched with its clause, not as a bare "8": the "48" above contains an 8, so a loose
    // assertion here passes whether or not the awaiting-reveal count is rendered at all.
    expect(at.headline).toContain("8 כבר רשומות");
  });

  it("omits the awaiting-reveal clause when nothing is waiting", () => {
    const at = loopPosition(inputs({ recorded: 12, scored: 12, scoredStillNeeded: 48 }));
    expect(at.headline).toContain("48");
    expect(at.headline).not.toContain("ממתינות");
  });

  it("distinguishes 'enough decisions, no pattern' from 'not enough decisions'", () => {
    // The whole credibility of the product is in this distinction. A threshold that found
    // nothing is an answer; too few decisions is not.
    const enough = loopPosition(inputs({ recorded: 80, scored: 80, scoredStillNeeded: 0 }));
    expect(enough.step).toBe("detect");
    expect(enough.headline).toContain("זו תשובה");

    const notEnough = loopPosition(inputs({ recorded: 10, scored: 10, scoredStillNeeded: 50 }));
    expect(notEnough.step).toBe("record");
    expect(notEnough.headline).not.toContain("זו תשובה");
  });

  it("says the record is unreadable rather than reporting distance zero", () => {
    // R2: a record that could not be READ must not render as a record with nothing in it.
    const at = loopPosition(inputs({ scoredStillNeeded: null }));
    expect(at.headline).toContain("לא ניתן לקרוא");
    expect(at.headline).not.toMatch(/עוד \d+/);
  });
});

describe("every position carries its basis", () => {
  it("never returns a headline without one", () => {
    const cases: LoopInputs[] = [
      inputs({ drill: { completed: 1, total: 5 } }),
      inputs({ claimGrade: "hypothesis", scoredStillNeeded: 0 }),
      inputs({ claimGrade: "refuted", scoredStillNeeded: 0 }),
      inputs({ recorded: 20, scored: 12, scoredStillNeeded: 48 }),
      inputs({ scored: 80, scoredStillNeeded: 0 }),
      inputs({ scoredStillNeeded: null }),
    ];
    for (const one of cases) {
      const at = loopPosition(one);
      expect(at.basis.trim(), `${at.step} has no basis`).not.toBe("");
    }
  });
});

describe("the rail draws the whole loop", () => {
  it("always returns every step, not only the reached ones", () => {
    // A rail that renders only what you have reached hides how far the loop actually goes,
    // which is the one thing a new player most needs to see.
    for (const step of LOOP_STEPS) {
      const states = stepStates(step);
      expect(states.map((s) => s.step)).toEqual([...LOOP_STEPS]);
      expect(states.filter((s) => s.state === "live")).toHaveLength(1);
    }
  });

  it("marks everything before the live step as done and everything after as ahead", () => {
    const states = stepStates("drill");
    expect(states.map((s) => s.state)).toEqual(["done", "done", "live", "ahead"]);
  });
});
