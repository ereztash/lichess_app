/**
 * WHICH ARM OF THE QUIET-WINDOW EXPERIMENT A DECISION WAS PRODUCED UNDER.
 *
 * THE HOLE THIS CLOSES, and it is a lineage hole rather than a behaviour one. The arm is a build
 * flag, `VITE_QUIET_EVIDENCE_WINDOW_ENABLED` in `client/src/lib/features.ts`. A build flag can move
 * without a commit, so two deployments of the SAME source -- same `CURRENT_PROTOCOL_VERSION`, same
 * `gitSha` -- can put two different screens in front of two players. `features.ts` says in a comment
 * that turning the arm on requires a protocol bump. A comment is not an invariant, and a protocol
 * version cannot express this one anyway: it is a source constant in `shared/`, the flag is an
 * `import.meta.env` value in `client/`, and `shared/` may not read `client/`. So the version cannot
 * be derived from the arm even in principle.
 *
 * That leaves the answer this repository already reached for the same problem. `reveal_timing` is an
 * experimental condition stored PER DECISION, and `session-position.ts` records what happened before
 * it was: a reload dropped the arm back to its `useState` default and produced *"ONE GAME whose
 * first half says `end-of-game` and whose second half says `per-decision`, every row internally
 * consistent and nothing saying the condition changed underneath it."* That is this hole exactly,
 * and per-row storage is what closed it.
 *
 * ONE FUNCTION, TWO CONSUMERS, AND THAT IS THE WHOLE DESIGN. `ContextRibbon` decides whether to
 * render from `quietWindowExposure`, and `buildCommitEvent` stamps what `quietWindowExposure`
 * returns. They are not two implementations that agree; they are one expression read twice. So
 * "the ribbon was suppressed but the row says visible" is not a bug that could be introduced -- it
 * is unrepresentable, because there is no second place where the answer is decided.
 *
 * DERIVED FROM WHAT WAS RENDERED, NOT FROM THE EXPERIMENT'S INTENT. The value is a function of the
 * condition on screen: the arm, and whether the player was producing evidence at the time. It is
 * not the flag copied into a column, and it is not "which arm we meant to assign". If the arm later
 * becomes a per-decision draw rather than a build flag, the caller changes and this does not.
 */

/**
 * What the player's screen actually did, in the words of the surface it happened to.
 *
 * NAMED FOR THE SURFACE RATHER THAN FOR THE ARM. `treatment` and `control` are labels for a trial
 * design; a row that outlives the trial should still say what was on the screen. If a second surface
 * ever joins the arm, this list grows a value rather than changing the meaning of these two.
 */
export const QUIET_WINDOW_EXPOSURES = [
  /**
   * The context ribbon was on screen while this decision was produced. The shipped default, and
   * what every row written by a build that leaves the flag alone will say.
   */
  "context-ribbon-visible",
  /** The arm was on: the ribbon rendered nothing for the whole of this decision's evidence window. */
  "context-ribbon-suppressed",
] as const;

export type QuietWindowExposure = (typeof QUIET_WINDOW_EXPOSURES)[number];

/** What decides the exposure. Both fields are facts the caller already holds. */
export interface QuietWindowInputs {
  /** `QUIET_EVIDENCE_WINDOW_ENABLED`, passed in because `shared/` may not read a client build flag. */
  armEnabled: boolean;
  /**
   * Is the player producing evidence right now? `makingEvidence(stage)`.
   *
   * IT IS AN INPUT RATHER THAN AN ASSUMPTION, even though at a commit it is always true. The arm
   * only suppresses inside the evidence window, so a row's exposure is only "suppressed" if the
   * window is what the ribbon was hidden for. Threading it keeps the render and the stamp reading
   * the same two facts instead of the stamp reading one and trusting the other.
   */
  producingEvidence: boolean;
}

/**
 * The condition on screen. One expression, and the only definition of the arm there is.
 *
 * The ribbon renders nothing exactly when this returns `context-ribbon-suppressed`, and the row
 * carries exactly what this returns. `GATE-QUIET-WINDOW-LINEAGE` holds both of those against the
 * source so a later edit cannot give either consumer its own opinion.
 */
export function quietWindowExposure(inputs: QuietWindowInputs): QuietWindowExposure {
  return inputs.armEnabled && inputs.producingEvidence
    ? "context-ribbon-suppressed"
    : "context-ribbon-visible";
}

/**
 * True when this row was produced under the arm.
 *
 * NULL IS NOT FALSE, and that is the whole reason this is a function rather than a comparison at
 * each call site. A row from before this field existed recorded no condition, which is a different
 * fact from having recorded the control condition -- the same distinction `protocolOf` draws with
 * `legacy`, and the same one `measurement-protocol.ts` refuses to backfill away. An analysis that
 * treats `null` as `visible` would silently pool unrecorded rows into the control arm, which is the
 * failure this file exists to prevent, arriving from the other direction.
 */
export function producedUnderQuietWindow(exposure: QuietWindowExposure | null): boolean | null {
  return exposure === null ? null : exposure === "context-ribbon-suppressed";
}
