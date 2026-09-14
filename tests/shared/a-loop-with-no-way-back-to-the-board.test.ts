/**
 * EVERY STATE A PLAYER CAN REACH HAS A WAY BACK TO A REAL CHESS DECISION.
 *
 * THE PROPERTY NOTHING IN THIS REPOSITORY HELD, and the reason it is worth a file. The inertial
 * laws hold their properties per surface: one primary action, no reading while evidence is being
 * made, no cancellable pass. Every one of them is a statement about a screen. *"Does this branch
 * come back"* is a statement about the graph the screens form, and the only thing that had ever
 * found a break in it was a person pressing controls in Chromium --
 * `research/player-path/PRODUCT_STATE_WALK.md`, `B-1`, where a live game's opening reveal offered
 * no continuation at all and the finding was that the sentence *"ההחלטה הבאה תראה אם זה חוזר"* was
 * printed in a state with no next decision in it.
 *
 * WHAT THE SPINE ADDS OVER THAT WALK. The walk is an observation of one build at one commit. This
 * is the same question asked of the type system: every proposal names the phase it re-enters, every
 * phase names its arcs, and `PLAY` is reachable from all of them. A proposal added later with
 * nowhere to go stops the build.
 *
 * WHAT IT DOES NOT ESTABLISH, and the distinction matters as much as it does in `D22`. That an arc
 * EXISTS in the model is not that a screen renders a control for it. `test-claim` re-enters at
 * `CAPTURE` and the control that would take a player there lives behind a claim no shipped record
 * has yet reached. The model says the loop closes; a walk says whether the product does.
 */
import { describe, expect, it } from "vitest";
import { DECISION_STAGES, type DecisionStage } from "@shared/decision-stage";
import { CLAIM_STATE_KINDS, type ClaimStateKind } from "@shared/claim-state";
import { DISCOVERY_FLOOR } from "@shared/detector";
import {
  JOURNEY_STAGES,
  recordJourney,
  ruleJourney,
  type JourneyReading,
  type JourneyStage,
} from "@shared/learning-journey";
import { PRIMARY_ACTIONS } from "@shared/primary-action";
import {
  LOOP_PHASES,
  PHASE_ARCS,
  mayShowPostCommitInformation,
  phaseOfClaimState,
  phaseOfDecisionStage,
  reachesPlay,
  reentryOf,
  type LoopPhase,
} from "@shared/spine";
import { actFor, type NextActionKind } from "@shared/next-action";

/**
 * Every kind as a value.
 *
 * THE SAME CONSTRUCTION `a-proposal-with-no-control-to-name-it.test.ts` USES, and for the same
 * reason: a union cannot be enumerated at run time, so a hand-written array would silently miss the
 * kind somebody adds next -- which is the one case this file exists to catch.
 */
const EVERY_KIND: Record<NextActionKind, true> = {
  "wait-analysis": true,
  "play-first-decision": true,
  "play-blitz": true,
  "review-event": true,
  "collect-more-evidence": true,
  "test-hypothesis": true,
  "test-claim": true,
  "continue-drill": true,
  "continue-transfer": true,
  "return-record": true,
  none: true,
};
const KINDS = Object.keys(EVERY_KIND) as NextActionKind[];

describe("the loop closes", () => {
  it("reaches ordinary chess from every phase", () => {
    for (const phase of LOOP_PHASES) {
      expect(reachesPlay(phase), `${phase} is a room with no door back to the board`).toBe(true);
    }
  });

  it("puts every proposal back into a phase that reaches ordinary chess", () => {
    /*
     * THE ARROW THE BRIEF CALLS ESSENTIAL. Reveal is not the end of the product, a pattern is not
     * the end of the product and a drill is not the end of the product; a proposal that landed
     * somewhere with no arc on would be exactly the module-shaped failure the spine is against.
     */
    for (const kind of KINDS) {
      const phase = reentryOf(kind);
      expect(LOOP_PHASES, `${kind} re-enters at "${phase}", which is not a phase`).toContain(phase);
      expect(reachesPlay(phase), `${kind} re-enters at ${phase} and never gets back to play`).toBe(
        true,
      );
    }
  });

  it("gives every phase at least one arc, so no phase is a terminal", () => {
    for (const phase of LOOP_PHASES) {
      expect(PHASE_ARCS[phase].length, `${phase} has no arcs at all`).toBeGreaterThan(0);
      for (const to of PHASE_ARCS[phase]) {
        expect(LOOP_PHASES, `${phase} names an arc to "${to}", which is not a phase`).toContain(to);
      }
    }
  });

  it("lets a player stay in ordinary chess, which is what makes reflection optional", () => {
    /*
     * `PLAY -> PLAY` IS NOT A TIDINESS ARC. The confidence question is drawn at `ASK_RATE`, so the
     * ordinary case is a move nobody was asked about; and a player offered a reflection may decline
     * it. An architecture whose only arc out of `PLAY` went through `CAPTURE` would be one where
     * the packet is the price of every move, which is the product this one is deliberately not.
     */
    expect(PHASE_ARCS.PLAY).toContain("PLAY");
    expect(PHASE_ARCS.CAPTURE).toContain("PLAY");
  });
});

describe("the commit boundary, in the layer both halves can see", () => {
  it("places every stage of a decision, and only the reveal after the boundary", () => {
    for (const stage of DECISION_STAGES) {
      const phase = phaseOfDecisionStage(stage);
      expect(LOOP_PHASES, `${stage} maps to "${phase}"`).toContain(phase);
    }
    const afterBoundary = DECISION_STAGES.filter((stage: DecisionStage) =>
      mayShowPostCommitInformation(phaseOfDecisionStage(stage)),
    );
    expect(afterBoundary).toEqual(["revealed"]);
  });

  it("keeps the counterfactual stage on the near side of it", () => {
    /*
     * `committed` IS THE ONE STAGE THE PROBE MAY BE ASKED IN, and it is the stage where the row is
     * already written and the engine has not spoken. A spine that placed it in `REVEAL` would make
     * the probe a post-feedback question and the answer would no longer be the player's own.
     */
    expect(phaseOfDecisionStage("committed")).toBe("CAPTURE");
    expect(mayShowPostCommitInformation("CAPTURE")).toBe(false);
  });

  it("places a decision that could not be written where the player actually is", () => {
    expect(phaseOfDecisionStage("blocked")).toBe("CAPTURE");
  });

  it("produces every claim state in the one phase a reading of the record may exist in", () => {
    /*
     * LAW 1 AS A PLACEMENT RATHER THAN A RULE TO REMEMBER. A claim state is a reading of the
     * record; a reading of the record on screen while evidence is being made is the contamination
     * the whole instrument is built against.
     */
    for (const kind of CLAIM_STATE_KINDS as readonly ClaimStateKind[]) {
      const phase: LoopPhase = phaseOfClaimState(kind);
      expect(phase).toBe("UPDATE");
      expect(mayShowPostCommitInformation(phase)).toBe(true);
    }
  });
});

const RULE = (grade: "hypothesis" | "replicated" | "refuted" | "retired", over = {}) =>
  ruleJourney({
    rule: { grade, retrieval_step: 0, created_at: "2026-09-01T00:00:00.000Z" },
    drill: null,
    promptedSittings: null,
    inScope: null,
    ...over,
  });

/** One reading per stage, so "every stage says what happens next" is a claim over all nine. */
const READINGS: Record<JourneyStage, JourneyReading> = {
  ACCUMULATING: recordJourney({ scored: 1, hasClaim: false, othersWithheld: 0, readElsewhere: 0 }),
  NOTHING_SEPARATED: recordJourney({
    scored: DISCOVERY_FLOOR,
    hasClaim: false,
    othersWithheld: 0,
    readElsewhere: 0,
  }),
  CANDIDATE: recordJourney({
    scored: DISCOVERY_FLOOR,
    hasClaim: true,
    othersWithheld: 0,
    readElsewhere: 0,
  }),
  CONTEXT_CHECKED: RULE("hypothesis"),
  PRACTISED: RULE("hypothesis", { drill: { completed: 3, total: 8 } }),
  PROMPTED_CHECK: RULE("hypothesis", { promptedSittings: 1 }),
  WATCHED_IN_PLAY: RULE("hypothesis", {
    inScope: { before: DISCOVERY_FLOOR, after: DISCOVERY_FLOOR },
  }),
  REFUTED: RULE("refuted"),
  RETIRED: RULE("retired"),
};

describe("no stage of the journey is a dead end", () => {
  it("produces the stage each case was built to produce", () => {
    for (const stage of JOURNEY_STAGES) {
      expect(READINGS[stage].stage, `the fixture for ${stage} produced something else`).toBe(stage);
    }
  });

  it("says what happens next in every stage, and says something different in each", () => {
    /*
     * DISTINCT AND NOT MERELY NON-EMPTY. Two stages sharing one sentence about what happens next
     * are two states with one way on, which is the collapse this whole family exists to prevent:
     * a drill score, a prompted-retrieval score and a count of unprompted decisions are three
     * constructs, and the way out of each is three different things.
     */
    const nexts = JOURNEY_STAGES.map((stage) => READINGS[stage].next);
    for (const [index, stage] of JOURNEY_STAGES.entries()) {
      expect(nexts[index]?.trim().length ?? 0, `${stage} says nothing about what follows`)
        .toBeGreaterThan(20);
    }
    expect(new Set(nexts).size, "two stages share one sentence about what follows").toBe(
      JOURNEY_STAGES.length,
    );
  });

  it("gives the refuted stage a way on, because being wrong is where the product stopped", () => {
    /*
     * THE ONE TERMINAL THAT NAMED NO CONTINUATION, AND IT WAS THE NEGATIVE ONE. It read
     * *"הכלל נשמר כמו שהוא ולא נבדק שוב. מה שנלמד כאן הוא שהניסוח לא החזיק"* -- true, and with
     * nothing after it -- while `RETIRED`, a rule the player chose to close, already said a new one
     * could be written. So the stage a player reaches by being wrong was the only stage with no
     * sentence about what happens next.
     *
     * WHAT WAS ADDED IS A SAVING AND A CONTINUATION, NOT A GAIN. Practice on the wording stops,
     * which is worth something and is not an improvement in play; the decisions go on being counted
     * in ordinary games whether or not a rule describes them. The limit below is untouched.
     */
    const refuted = READINGS.REFUTED;
    expect(refuted.next).toContain("ממשיכות להיספר");
    expect(refuted.next).toContain("כלל אחר");
    expect(refuted.notEstablished).toContain("לא אומרת שהתיאור של הבעיה היה שגוי");
    expect(refuted.next, "a refutation must not be dressed up as progress").not.toContain("השתפר");
  });
});

describe("what the spine may not quietly become", () => {
  it("names no act the closed vocabulary does not carry", () => {
    /*
     * THE SPINE IS A MODEL OF THE LOOP AND NOT A SECOND ROUTER. If a phase could imply a control,
     * there would be two places deciding what a player is offered. It cannot: the only thing that
     * names an act is `actFor`, and this is the assertion that adding a phase did not add one.
     */
    for (const kind of KINDS) {
      const act = actFor(kind);
      if (act === null) continue;
      expect(PRIMARY_ACTIONS).toContain(act);
    }
    expect(LOOP_PHASES.filter((phase) => (PRIMARY_ACTIONS as readonly string[]).includes(phase)))
      .toEqual([]);
  });
});
