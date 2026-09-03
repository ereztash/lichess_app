/**
 * The board's authority, held against the two contracts it must not contradict.
 *
 * WHY IT IS CHECKED AGAINST THEM RATHER THAN DERIVED FROM THEM. `interaction-mode.ts` answers a
 * different question -- what may be CENTRAL and what may be ON SCREEN -- and one table that
 * answered both would be one authority for two questions. So the map stands on its own and this
 * file is where the two are made to agree, in the same shape
 * `tests/shared/ten-modes-and-what-each-permits.test.ts` already uses for the mode contract.
 */
import { describe, expect, it } from "vitest";
import { DECISION_STAGES, type DecisionStage } from "@shared/decision-stage";
import {
  BOARD_AUTHORITIES,
  BOARD_AUTHORITY_OF_STAGE,
  boardAccepts,
  boardAuthorityOf,
} from "@shared/board-authority";
import { MODE_CONTRACT, deriveInteractionMode } from "@shared/interaction-mode";
import { engineMayRun, makingEvidence } from "@/lib/decision-session";

const modeOf = (stage: DecisionStage) =>
  deriveInteractionMode({
    stage,
    instrumentOpen: false,
    run: null,
    reviewingEvent: false,
    blockedOnWork: false,
    exploring: false,
    everDecided: true,
  });

describe("every stage has exactly one board authority", () => {
  it("covers the union rather than being asserted to", () => {
    expect(Object.keys(BOARD_AUTHORITY_OF_STAGE).sort()).toEqual([...DECISION_STAGES].sort());
  });

  it("only ever names an authority from the closed vocabulary", () => {
    for (const stage of DECISION_STAGES) {
      expect(BOARD_AUTHORITIES).toContain(boardAuthorityOf(stage));
    }
  });
});

describe("the authority agrees with the two functions the product already runs on", () => {
  /*
   * THE ENGINE AND THE BOARD CANNOT BOTH BE LIVE. `engineMayRun` is true in exactly one stage, and
   * that is the stage whose whole subject is a decision already taken. A board that still accepted
   * a move there would be offering to change the position the engine just answered about.
   */
  it("grants nothing in the one stage the engine may speak in", () => {
    for (const stage of DECISION_STAGES) {
      if (engineMayRun(stage)) expect(boardAuthorityOf(stage)).toBe("none");
    }
  });

  /*
   * THE CONVERSE IS NOT TRUE AND MUST NOT BE ASSERTED. `committing` is mid-evidence and grants
   * nothing, because the move is already chosen and the write is in flight.
   */
  it("grants a gesture only while the player is still producing evidence", () => {
    for (const stage of DECISION_STAGES) {
      if (boardAccepts(boardAuthorityOf(stage))) expect(makingEvidence(stage)).toBe(true);
    }
  });
});

describe("the authority agrees with the mode contract", () => {
  it("never lets the board act in a mode that permits engine output", () => {
    for (const stage of DECISION_STAGES) {
      const contract = MODE_CONTRACT[modeOf(stage)];
      if (contract.engineOutput) expect(boardAuthorityOf(stage)).toBe("none");
    }
  });

  it("names the alternative in exactly the stage the counterfactual probe is asked in", () => {
    const naming = DECISION_STAGES.filter((s) => boardAuthorityOf(s) === "name-alternative");
    expect(naming).toEqual(["committed"]);
  });

  it("proposes in exactly the stages whose mode is DECIDE and whose write has not started", () => {
    const proposing = DECISION_STAGES.filter((s) => boardAuthorityOf(s) === "propose");
    expect(proposing).toEqual(["deciding", "blocked"]);
    for (const stage of proposing) expect(modeOf(stage)).toBe("DECIDE");
  });
});
