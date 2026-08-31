/**
 * THE STAGES OF ONE DECISION, in the layer that both halves of the product can see.
 *
 * WHY IT MOVED HERE. `SessionStage` was declared in `client/src/lib/decision-session.ts`, and
 * `shared/counterfactual-stage.ts` -- which exists to pin the one stage the probe may be asked in
 * -- had to say so in a comment instead of in the type:
 *
 *   Lives in `shared/` rather than beside `SessionStage` because the rule is about the measurement
 *   and not about the screen; the string is deliberately one of `SessionStage`'s own members.
 *
 * "Deliberately one of its members" is a fact a compiler can check, and it was not checking it. A
 * rename on the client would have left `PROBE_STAGE` naming a stage that no longer existed, and
 * nothing would have failed until a player reached it.
 *
 * THE LIST IS ALSO DATA, not only a type. `interaction-mode.ts` maps every stage to a mode and its
 * contract, and a map over a union is only exhaustive if something can enumerate the union at run
 * time -- otherwise "every stage is covered" is an assertion nobody can make.
 */

/**
 * Every stage a decision passes through, in the order it passes through them.
 *
 * `blocked` IS DECLARED AND UNREACHED, and it stays. It is the state a decision that could not be
 * written would be in, and removing it would not remove the state -- it would remove the name for
 * it, which is how a screen ends up rendering a stage it has no branch for.
 */
export const DECISION_STAGES = [
  /** The position is up, nothing is committed, a board click PROPOSES rather than plays. */
  "deciding",
  /** The write is in flight. Not a completed write: the engine still may not run. */
  "committing",
  /** On the record, engine still silent. The one stage the counterfactual may be asked in. */
  "committed",
  /** The verdict exists and the player has been shown it. The only stage the engine may speak in. */
  "revealed",
  /** A decision that could not be written. Nothing sets it today; the name is kept anyway. */
  "blocked",
] as const;

export type DecisionStage = (typeof DECISION_STAGES)[number];
