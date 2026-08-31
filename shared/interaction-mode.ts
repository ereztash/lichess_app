/**
 * WHAT THE PLAYER IS DOING RIGHT NOW, AND WHAT THAT PERMITS ON SCREEN.
 *
 * THE PROBLEM THIS IS THE FIRST HALF OF. Decision Lab's visual architecture is its code
 * architecture -- Record, Home, Blitz, Claim, Drill, Learning, Game Review -- so a player has to
 * know that map to get anywhere. A surface is a place in the repository. A MODE is a thing the
 * player is in the middle of, and there are ten of them, and they do not correspond to routes:
 * `DECIDE`, `ANSWER_INSTRUMENT` and `REVEAL` all happen at the same URL, and `REFLECT` happens at
 * three different ones.
 *
 * WHAT MAKES THIS MORE THAN A LABEL. Each mode carries a CONTRACT -- what may be central, whether
 * prior evidence may be on screen, whether the engine may speak, whether the player is producing
 * evidence. Those are LAW 1, LAW 2 and R3 as a table rather than as conditions spread across a
 * 2,400-line component, and `tests/shared/ten-modes-and-what-each-permits.test.ts` checks the table
 * against the two functions that already enforce those rules for the commitment loop
 * (`makingEvidence`, `engineMayRun`). A table that agreed with nothing would be decoration.
 *
 * IT DECIDES NOTHING YET. Nothing renders from this module; `Home.tsx` and `Blitz.tsx` still hold
 * their own conditions. That is deliberate and it is the plan's own sequencing: the derivation is
 * written and tested first, run in shadow second, and given ownership of the screen third. A pure
 * function that is wrong is a failing test; a screen that is wrong is a player who cannot find
 * anything.
 *
 * WHAT A MODE IS NOT. It is not a recommendation and it does not rank anything. `next-action.ts`
 * beside it answers "what now", and it answers it from what the RECORD is missing rather than from
 * anything predicted about the player -- see the note at the top of that file, which is the line
 * this whole pair has to stay on the near side of.
 */
import { DECISION_STAGES, type DecisionStage } from "./decision-stage.js";

/**
 * The ten modes.
 *
 * ORDERED BY WHERE THEY SIT IN A SESSION, not alphabetically and not by importance: arrival,
 * then the loop that produces evidence, then the ones that read it back. A reader who does not
 * know the product should be able to read the list downward and recognise a session.
 */
export const INTERACTION_MODES = [
  /** A record with nothing on it. The one mode where there is nothing to resume. */
  "ARRIVE",
  /** A record with something on it, opened again. Three questions: what changed, what is known, what now. */
  "RESUME",
  /** A position is up and nothing is committed. The evidence is being produced. */
  "DECIDE",
  /** An instrument question is open: the confidence, the reads, the counterfactual. */
  "ANSWER_INSTRUMENT",
  /** The product is working and the player is not. An analysis, a scan, a game review. */
  "WAIT",
  /** The verdict on the decision just committed. The first moment the engine may speak. */
  "REVEAL",
  /** One stored event, opened. A move from a finished game, with what was measured about it. */
  "REVIEW_EVENT",
  /** Reading the record: what it holds, what it can say, what it cannot say yet. */
  "REFLECT",
  /** A drill or a transfer run. A pre-registered set of positions being worked through. */
  "TEST",
  /** Moving around a finished game with nothing being measured and nothing at stake. */
  "EXPLORE",
] as const;

export type InteractionMode = (typeof INTERACTION_MODES)[number];

/**
 * WHAT A MODE PERMITS. Four booleans, and every one of them is a rule this repository already has.
 *
 * `central` IS THE ONE THAT IS NOT A BOOLEAN, and it is the one LAW 2 is about: every mode has
 * exactly one thing that may be central, named here so a screen cannot quietly grow a second.
 */
export interface ModeContract {
  /**
   * The one thing that may be central in this mode. Named, not counted: "exactly one primary
   * action" is satisfied by any single button, and what makes a mode inertial is that the single
   * button is the RIGHT one.
   */
  central: string;
  /**
   * May a reading of the record be on screen? (LAW 1)
   *
   * A reading is a finding, verdict, rate or recommendation about the player's OWN past decisions.
   * Where in the loop the record is -- how many decisions exist, what is blocking a claim -- is not
   * one: it says nothing about the decision being made.
   */
  priorEvidence: boolean;
  /** May the engine's output be on screen? (R3) */
  engineOutput: boolean;
  /** Is the player producing evidence right now, such that showing them any of the above changes it? */
  producingEvidence: boolean;
}

/**
 * The table.
 *
 * THE THREE `producingEvidence: true` ROWS ARE THE WHOLE POINT, and all three forbid prior evidence
 * and engine output for the same reason: a confidence stated in front of a panel describing that
 * player's calibration is not a measurement of what they believed. `TEST` is the fourth mode where
 * a decision is taken, and it is the interesting one -- a drill decision IS evidence, so it is
 * produced under the same silence, and the run's own progress is not a reading of the record.
 *
 * `EXPLORE` PERMITS EVERYTHING AND MEASURES NOTHING, which is what makes it safe. It is the mode a
 * player is in when they move around a finished game: the decisions in it are already committed,
 * already revealed and already stored, so nothing on screen can change what any of them said.
 */
export const MODE_CONTRACT: Readonly<Record<InteractionMode, ModeContract>> = {
  ARRIVE: {
    central: "the first decision",
    priorEvidence: false,
    engineOutput: false,
    producingEvidence: false,
  },
  RESUME: {
    central: "the next action",
    /* The record is exactly what a returning player came for, and no decision is open. */
    priorEvidence: true,
    engineOutput: false,
    producingEvidence: false,
  },
  DECIDE: {
    central: "the commitment",
    priorEvidence: false,
    engineOutput: false,
    producingEvidence: true,
  },
  ANSWER_INSTRUMENT: {
    central: "the question",
    priorEvidence: false,
    engineOutput: false,
    producingEvidence: true,
  },
  WAIT: {
    /*
     * WHAT IS BEING WORKED ON, AND NOT A SPINNER. A wait whose subject is unnamed is
     * indistinguishable from a hang, and this product's longest wait -- the blitz analysis -- is
     * one a player is explicitly told they may walk away from.
     */
    central: "what is being worked on",
    priorEvidence: false,
    engineOutput: false,
    producingEvidence: false,
  },
  REVEAL: {
    central: "the one thing this decision showed",
    priorEvidence: true,
    engineOutput: true,
    producingEvidence: false,
  },
  REVIEW_EVENT: {
    central: "the position and what was measured about it",
    priorEvidence: true,
    engineOutput: true,
    producingEvidence: false,
  },
  REFLECT: {
    central: "what the record can and cannot say",
    priorEvidence: true,
    engineOutput: true,
    producingEvidence: false,
  },
  TEST: {
    /*
     * A DRILL DECISION IS A DECISION, so it is produced under the same silence as any other. The
     * run's own progress -- position 3 of 8 -- is not a reading of the record: it says nothing
     * about how the player decides.
     */
    central: "the position under test",
    priorEvidence: false,
    engineOutput: false,
    producingEvidence: true,
  },
  EXPLORE: {
    central: "the position being looked at",
    priorEvidence: true,
    engineOutput: true,
    producingEvidence: false,
  },
};

/**
 * Where the player is, as facts the product already holds.
 *
 * EVERY FIELD IS SOMETHING A SCREEN ALREADY KNOWS. Nothing here is new state and nothing has to be
 * stored: this is a projection of conditions `Home.tsx` and `Blitz.tsx` already branch on, gathered
 * so the branching can be decided in one place instead of eleven.
 */
export interface InteractionState {
  /**
   * The stage of the open decision, or null when no decision is open.
   *
   * NULL IS NOT `deciding`. "No decision is open" is a different fact from "a decision is open and
   * nothing is committed yet", and the record screen is in the first while the board is in the
   * second.
   */
  stage: DecisionStage | null;
  /** An instrument question is open and unanswered: the confidence, the reads, the counterfactual. */
  instrumentOpen: boolean;
  /** A pre-registered run is in progress. */
  run: "drill" | "transfer" | null;
  /** The player opened one stored event to look at it. */
  reviewingEvent: boolean;
  /**
   * The product is working on something the player is waiting for AND cannot proceed without.
   *
   * NOT "SOMETHING IS RUNNING". The blitz analysis runs on every page load and a player is
   * explicitly told they may leave; that is not a wait, it is a background job with a progress
   * line. This is true only when there is nothing else to do until it finishes.
   */
  blockedOnWork: boolean;
  /** Moving around a finished game, with no decision open and nothing being measured. */
  exploring: boolean;
  /** Has this record ever held a decision? The only thing separating a first arrival from a return. */
  everDecided: boolean;
}

/**
 * THE MODE, DERIVED. One state in, one mode out, no branching anywhere else.
 *
 * THE ORDER IS THE ARGUMENT. Each test below wins over everything under it, and the reason is
 * always the same shape: a thing the player is in the middle of outranks a thing they could start.
 *
 *   1. an open instrument question, because it is the narrowest thing they are inside;
 *   2. an open decision, by its stage;
 *   3. a run, which is a set of decisions they agreed to work through;
 *   4. a wait they cannot proceed past;
 *   5. an event they opened;
 *   6. exploring, which is the one mode with nothing at stake;
 *   7. and only then arrival or return, which are the two ways of having nothing open at all.
 *
 * THE INSTRUMENT BEATS THE STAGE, and that is the one that could go either way. A confidence
 * question is open at `deciding` and the counterfactual at `committed`, so an implementation that
 * checked the stage first would render `DECIDE` over an open question and put the board back in
 * front of somebody who had been asked something. The question is narrower, so it wins.
 */
export function deriveInteractionMode(state: InteractionState): InteractionMode {
  if (state.instrumentOpen) return "ANSWER_INSTRUMENT";
  if (state.stage !== null) return MODE_OF_STAGE[state.stage];
  if (state.run !== null) return "TEST";
  if (state.blockedOnWork) return "WAIT";
  if (state.reviewingEvent) return "REVIEW_EVENT";
  if (state.exploring) return "EXPLORE";
  return state.everDecided ? "RESUME" : "ARRIVE";
}

/**
 * Every stage's mode, and the two that are not `DECIDE` carry the whole of R3.
 *
 * `committed` IS `DECIDE` AND NOT `REVEAL`, which is the mapping the screen got wrong: the analysis
 * column branched on `deciding || committing`, so at `committed` -- where the counterfactual probe
 * asks its question -- it fell through to the reveal column and rendered all of it. The player was
 * asked what they would have played instead with a dashboard of their own accuracy rates beside
 * the question. Nothing about `committed` is a reveal; the engine has not run.
 *
 * `blocked` IS `DECIDE` TOO. A decision that could not be written is still an open decision, and
 * the one thing that must not happen is the product treating a failed write as a finished one.
 */
const MODE_OF_STAGE: Readonly<Record<DecisionStage, InteractionMode>> = {
  deciding: "DECIDE",
  committing: "DECIDE",
  committed: "DECIDE",
  revealed: "REVEAL",
  blocked: "DECIDE",
};

/** Exported so a test can assert the map above covers the union rather than trusting the type. */
export const STAGE_COUNT = DECISION_STAGES.length;
