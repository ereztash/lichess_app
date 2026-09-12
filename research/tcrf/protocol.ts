/**
 * THE TRIAL ORDERING, AS A MACHINE THAT REFUSES THE WRONG ORDER.
 *
 * §7.1 of the preregistration states the sequence and §7.4 states what may not precede what:
 *
 *     POSITION -> TIMER -> COMMIT -> TIMER FREEZES -> optional PROBE -> REVEAL
 *
 * A COMMENT COULD NOT ENFORCE THIS AND A TEST COULD ONLY CATCH IT AFTERWARDS. The ordering is the
 * measurement: a participant who has seen an engine evaluation is answering a different question,
 * and a probe that opens before the commit changes the decision it claims to observe. So the states
 * are a closed union, the transitions are a table, and there is no function anywhere that returns a
 * revealed state from an uncommitted one.
 *
 * THE ONE RULE WORTH STATING TWICE, inherited verbatim from `shared/blitz-instrument.ts`: the
 * decision time is frozen AT COMMIT and copied, never recomputed. `instrumentation_latency` is a
 * separate field and nothing sums them. A participant who took four seconds to move and thirty to
 * answer took four seconds to decide.
 *
 * RESEARCH-ONLY. Nothing here is imported by `client/src`, nothing renders, and no product surface
 * changes. §18: the experimental path stays separate and versioned.
 */
import type { ProbeAssignment } from "./trial.js";

export const TRIAL_STAGES = [
  "presented",
  "deciding",
  "committed",
  "probing",
  "probed",
  "revealed",
  "timed_out",
] as const;
export type TrialStage = (typeof TRIAL_STAGES)[number];

export type TrialEvent =
  | { kind: "start_timer"; at_ms: number }
  | { kind: "commit"; at_ms: number; move: string }
  | { kind: "timeout"; at_ms: number }
  | { kind: "open_probe"; at_ms: number }
  | { kind: "close_probe"; at_ms: number }
  | { kind: "reveal"; at_ms: number };

export interface TrialState {
  stage: TrialStage;
  probe_assignment: ProbeAssignment;
  presented_at_ms: number;
  timer_started_at_ms: number | null;
  /** Frozen at commit. Never recomputed, never the budget, null until a commit happens. */
  think_ms: number | null;
  move: string | null;
  probe_opened_at_ms: number | null;
  /** What the instrument cost. Its own field, with no function summing it into `think_ms`. */
  instrumentation_latency_ms: number | null;
  timed_out: boolean;
}

export const beginTrial = (
  probe_assignment: ProbeAssignment,
  presented_at_ms: number,
): TrialState => ({
  stage: "presented",
  probe_assignment,
  presented_at_ms,
  timer_started_at_ms: null,
  think_ms: null,
  move: null,
  probe_opened_at_ms: null,
  instrumentation_latency_ms: null,
  timed_out: false,
});

/**
 * What may be shown, derived from the stage rather than asked of the caller.
 *
 * A SINGLE PREDICATE, because `shared/blitz-instrument.ts` already learned this lesson: computing
 * the opponent's reply early is free and SHOWING it early is not. The research surface may prepare
 * whatever it likes; it may paint nothing the participant has not earned by committing.
 */
export const mayRevealEngineOutput = (state: TrialState): boolean => state.stage === "revealed";

/**
 * §7.4: reveal may not happen until every assigned question is completed or skipped.
 *
 * PHRASED AS "WHAT REVEAL REQUIRES" RATHER THAN "WHEN REVEAL IS ALLOWED", so the probe arm and the
 * no-probe arm are one rule. An unprobed trial reaches `probed` immediately at commit, which is
 * what makes the two arms differ in what was asked and not in what was ordered.
 */
export const revealIsDue = (state: TrialState): boolean =>
  state.stage === "probed" || state.stage === "timed_out";

export class ProtocolViolation extends Error {
  constructor(
    readonly from: TrialStage,
    readonly event: TrialEvent["kind"],
    detail: string,
  ) {
    super(`${event} is not admissible from ${from}: ${detail}`);
    this.name = "ProtocolViolation";
  }
}

/**
 * The transition table. Anything not listed here throws.
 *
 * THROWING RATHER THAN RETURNING THE OLD STATE. A research instrument that silently ignores an
 * out-of-order event produces a dataset whose rows look ordinary and whose ordering was not what
 * the preregistration says. §7.4 asks for early reveal to be "mechanically detectable"; a throw at
 * the moment it is attempted is the earliest that detection can happen.
 */
export function advance(state: TrialState, event: TrialEvent): TrialState {
  const refuse = (detail: string): never => {
    throw new ProtocolViolation(state.stage, event.kind, detail);
  };
  switch (event.kind) {
    case "start_timer":
      if (state.stage !== "presented") return refuse("the timer starts once, on presentation");
      return { ...state, stage: "deciding", timer_started_at_ms: event.at_ms };

    case "commit": {
      if (state.stage !== "deciding") return refuse("a move may only be committed while deciding");
      const started = state.timer_started_at_ms;
      if (started === null) return refuse("no timer to freeze");
      if (event.at_ms < started) return refuse("a commit before the timer started");
      /*
       * THE FREEZE, AND THE ONLY PLACE `think_ms` IS EVER WRITTEN. Every later transition copies
       * it. There is no branch below that recomputes it, which is what makes it impossible for a
       * slow probe to lengthen a decision.
       */
      return {
        ...state,
        stage: state.probe_assignment === "probed" ? "committed" : "probed",
        move: event.move,
        think_ms: event.at_ms - started,
      };
    }

    case "timeout":
      if (state.stage !== "deciding") return refuse("only a running decision can time out");
      /*
       * `think_ms` STAYS NULL. The budget is known and is deliberately not written here: a timeout
       * is not a decision that took the whole budget, it is the absence of a decision, and writing
       * the budget would put a protocol constant into a behavioural column.
       */
      return { ...state, stage: "timed_out", timed_out: true };

    case "open_probe":
      if (state.stage !== "committed") {
        return refuse("§7.1: the probe opens after the commit and after nothing else");
      }
      return { ...state, stage: "probing", probe_opened_at_ms: event.at_ms };

    case "close_probe": {
      if (state.stage !== "probing") return refuse("no probe is open");
      const opened = state.probe_opened_at_ms;
      if (opened === null) return refuse("a probe closed that was never opened");
      return {
        ...state,
        stage: "probed",
        instrumentation_latency_ms: Math.max(0, event.at_ms - opened),
      };
    }

    case "reveal":
      if (!revealIsDue(state)) {
        return refuse(
          "§7.4: nothing from the engine may appear until every assigned question is completed or skipped",
        );
      }
      return { ...state, stage: "revealed" };
  }
}

/**
 * What may be painted before a commit, as a list rather than as a rule to remember.
 *
 * §7.1's five forbidden things, named. A test asserts that the research surface's pre-commit
 * payload carries none of these keys, which is the same shape as GATE-COMMIT's check on the
 * product's reveal payload and is there for the same reason.
 */
export const FORBIDDEN_BEFORE_COMMIT = [
  "engine_eval",
  "engine_eval_cp",
  "best_move",
  "opponent_reply",
  "resource_label",
  "target_relation",
  "target_affordance",
  "topology_condition",
] as const;

/** Whether a payload intended for a pre-commit screen leaks any of the above. */
export function preCommitLeaks(payload: unknown): string[] {
  const found: string[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    for (const [key, value] of Object.entries(node)) {
      if ((FORBIDDEN_BEFORE_COMMIT as readonly string[]).includes(key)) found.push(key);
      walk(value);
    }
  };
  walk(payload);
  return [...new Set(found)].sort();
}
