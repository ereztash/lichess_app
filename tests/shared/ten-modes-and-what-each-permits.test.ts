/**
 * THE MODE TABLE, CHECKED AGAINST THE RULES IT CLAIMS TO RESTATE.
 *
 * A table of ten modes and four booleans is decoration unless something holds it to the code that
 * already enforces those rules. Two functions do, for the commitment loop:
 * `makingEvidence(stage)` (LAW 1) and `engineMayRun(stage)` (R3). Every stage maps to a mode, so
 * the contract of that mode must agree with both -- and where it does not, the table is wrong,
 * because those two are what the product actually runs on.
 *
 * WHY THIS EXISTS BEFORE ANYTHING RENDERS FROM IT. The plan's sequencing is derivation, then
 * shadow, then ownership. A pure function that is wrong is a failing test; a screen that is wrong
 * is a player who cannot find anything. This file is the first of those three.
 */
import { describe, expect, it } from "vitest";
import {
  INTERACTION_MODES,
  MODE_CONTRACT,
  STAGE_COUNT,
  deriveInteractionMode,
  type InteractionMode,
  type InteractionState,
} from "@shared/interaction-mode";
import { DECISION_STAGES, type DecisionStage } from "@shared/decision-stage";
import { PROBE_STAGE } from "@shared/counterfactual-stage";
import { engineMayRun, makingEvidence } from "@/lib/decision-session";

const IDLE: InteractionState = {
  stage: null,
  instrumentOpen: false,
  run: null,
  reviewingEvent: false,
  blockedOnWork: false,
  exploring: false,
  everDecided: false,
};

const at = (over: Partial<InteractionState>): InteractionMode =>
  deriveInteractionMode({ ...IDLE, ...over });

describe("the table covers what it claims to", () => {
  it("names all ten modes and gives every one a contract", () => {
    expect(INTERACTION_MODES).toHaveLength(10);
    expect(new Set(INTERACTION_MODES).size, "a mode is named twice").toBe(10);
    for (const mode of INTERACTION_MODES) {
      expect(MODE_CONTRACT[mode], `${mode} has no contract`).toBeTruthy();
      expect(MODE_CONTRACT[mode].central.length, `${mode} names nothing central`).toBeGreaterThan(0);
    }
  });

  it("maps every declared stage to a mode, at run time and not only in the type", () => {
    /*
     * `Record<DecisionStage, ...>` is exhaustive to the compiler and says nothing about a stage
     * added to the array and left out of the map by a merge. Both counts come from the data.
     */
    expect(STAGE_COUNT).toBe(DECISION_STAGES.length);
    for (const stage of DECISION_STAGES) {
      expect(INTERACTION_MODES, `${stage} maps to no mode`).toContain(at({ stage }));
    }
  });

  it("gives every mode a different central thing, because that is what makes it a mode", () => {
    /*
     * Two modes with the same centre are one mode wearing two names, and the cost of that is a
     * screen that switches between them and looks identical -- §4.5's rule from the other side.
     */
    const centres = INTERACTION_MODES.map((m) => MODE_CONTRACT[m].central);
    expect(new Set(centres).size, JSON.stringify(centres)).toBe(centres.length);
  });
});

describe("the contract agrees with the rules the product already runs on", () => {
  it.each(DECISION_STAGES)("matches LAW 1 at %s", (stage: DecisionStage) => {
    const contract = MODE_CONTRACT[at({ stage })];
    expect(contract.producingEvidence, `${stage}`).toBe(makingEvidence(stage));
    /*
     * AND THE CONSEQUENCE, not just the flag: a mode that is producing evidence may not show a
     * reading of the record. Asserting both is what stops the table from carrying a true boolean
     * beside a permission that contradicts it.
     */
    if (contract.producingEvidence) expect(contract.priorEvidence, `${stage}`).toBe(false);
  });

  it.each(DECISION_STAGES)("matches R3 at %s", (stage: DecisionStage) => {
    expect(MODE_CONTRACT[at({ stage })].engineOutput, `${stage}`).toBe(engineMayRun(stage));
  });

  it("says the counterfactual stage is not a reveal, which is where the screen went wrong", () => {
    /*
     * THE DEFECT THIS TABLE WOULD HAVE CAUGHT. `Home.tsx` branched on `deciding || committing`, so
     * at `committed` -- the one stage the probe may be asked in -- it fell through to the reveal
     * column and rendered the record dashboard beside the question.
     */
    expect(at({ stage: PROBE_STAGE })).toBe("DECIDE");
    expect(MODE_CONTRACT.DECIDE.priorEvidence).toBe(false);
    expect(MODE_CONTRACT.DECIDE.engineOutput).toBe(false);
  });

  it("permits the engine in exactly the modes that are not producing evidence", () => {
    /*
     * NOT A TAUTOLOGY: the converse is false and deliberately so. `ARRIVE` and `WAIT` produce no
     * evidence and still show no engine output, because there is nothing for it to say. What may
     * never happen is the other direction.
     */
    for (const mode of INTERACTION_MODES) {
      const c = MODE_CONTRACT[mode];
      if (c.engineOutput) expect(c.producingEvidence, mode).toBe(false);
      if (c.priorEvidence) expect(c.producingEvidence, mode).toBe(false);
    }
  });
});

describe("what the player is in the middle of wins", () => {
  it("puts an open question above the stage it was asked in", () => {
    /*
     * THE ONE ORDERING THAT COULD GO EITHER WAY. The confidence question is open at `deciding` and
     * the counterfactual at `committed`; checking the stage first would render `DECIDE` over an
     * open question and put the board back in front of somebody who had been asked something.
     */
    expect(at({ stage: "deciding", instrumentOpen: true })).toBe("ANSWER_INSTRUMENT");
    expect(at({ stage: PROBE_STAGE, instrumentOpen: true })).toBe("ANSWER_INSTRUMENT");
    expect(at({ stage: "revealed", instrumentOpen: true })).toBe("ANSWER_INSTRUMENT");
  });

  it("puts an open decision above a run, a wait and an event", () => {
    expect(at({ stage: "deciding", run: "drill", blockedOnWork: true, reviewingEvent: true })).toBe(
      "DECIDE",
    );
  });

  it("puts a run above a wait, because the run is a set somebody agreed to finish", () => {
    expect(at({ run: "drill", blockedOnWork: true })).toBe("TEST");
    expect(at({ run: "transfer" })).toBe("TEST");
  });

  it("separates a first arrival from a return by the one fact that separates them", () => {
    expect(at({ everDecided: false })).toBe("ARRIVE");
    expect(at({ everDecided: true })).toBe("RESUME");
  });

  it("does not let exploring outrank anything that is still being measured", () => {
    /*
     * EXPLORE is the one mode with nothing at stake, and that is exactly why it must lose every
     * tie: a state that is both "moving around a finished game" and "a decision is open" is the
     * second one, and treating it as the first would permit the engine over an open decision.
     */
    expect(at({ exploring: true, stage: "deciding" })).toBe("DECIDE");
    expect(at({ exploring: true, run: "drill" })).toBe("TEST");
    expect(at({ exploring: true })).toBe("EXPLORE");
    expect(MODE_CONTRACT.EXPLORE.producingEvidence).toBe(false);
  });
});
