/**
 * WHICH CONTROL IS THE PRIMARY ONE, SAID IN THE MARKUP RATHER THAN INFERRED FROM IT.
 *
 * WHY THIS EXISTS. Three of the inertial laws' gates could not be written --
 * `GATE-ONE-PRIMARY-ACTION`, `GATE-NO-DUPLICATE-ACTION`, `GATE-TOOLBOX-OUTSIDE-FOCUS` -- because
 * nothing could answer "is this control the primary action" from the source. The only signal was
 * CSS weight, and a gate that reads a colour is a gate that goes red when a designer changes a
 * palette and stays green when somebody adds a second loud button in a different colour.
 *
 * SO THE CONTROL DECLARES ITS ACT. Not "I am primary" -- `data-primary-action="next-decision"` --
 * because the interesting question is not how many loud buttons there are, it is how many DIFFERENT
 * THINGS a state asks the player to choose between. Two controls naming the same act are one action
 * rendered twice, which is a different defect from two controls naming two acts, and a boolean
 * cannot tell them apart.
 *
 * BOTH DEFECTS WERE LIVE WHEN THIS WAS WRITTEN, and a walk through the built app in Chromium is
 * what found them -- not a test:
 *
 *   - THE REVEAL OFFERED `CONTINUATION_CTA` TWICE. The header's control and `RevealPanel`'s foot
 *     both carried `className="primary-control"`, both called `nextDecision`, and their render
 *     conditions were character-for-character identical -- so whenever one appeared, so did the
 *     other. Same act, same words, two buttons.
 *
 *   - THE RETURNING FRONT DOOR OFFERED TWO DIFFERENT PRODUCTS. `ResumeScreen` said "play a short
 *     game" (blitz) and `FirstDecision` said "take me to a position" (the untimed loop), at the
 *     same weight, on the same screen, to a player whose record answered neither question.
 *
 * THE VOCABULARY IS CLOSED, and it is the same vocabulary `shared/next-action.ts` derives over. A
 * screen that offers an act the derivation cannot name is a screen the derivation could never own,
 * which is the whole of what P0.5's shadow is for.
 */

/**
 * Every act a primary control may name.
 *
 * MAPPED ONTO `NextActionKind` WHERE ONE EXISTS, and only there. `answer-instrument` and
 * `commit-decision` have no `NextAction` because they are not things a player is ROUTED to -- they
 * are what the player is already doing -- and inventing kinds for them would put states into a
 * derivation that has nothing to say about them.
 */
export const PRIMARY_ACTIONS = [
  /** Record the decision that is open. The commitment panel's submit. */
  "commit-decision",
  /** Answer the instrument question that is open: the confidence, the counterfactual. */
  "answer-instrument",
  /** Take another decision after a reveal. `CONTINUATION_CTA`. */
  "next-decision",
  /** Start a timed game. */
  "play-blitz",
  /** Take the first decision of a record that has none. */
  "play-first-decision",
  /** Open the one stored event worth looking at. */
  "review-event",
  /** Continue a drill or a transfer that is already under way. */
  "continue-run",
  /** Start the forward test of a rule that is due. */
  "test-hypothesis",
  /** Go to the record. */
  "return-record",
] as const;

export type PrimaryAction = (typeof PRIMARY_ACTIONS)[number];

/** The attribute, named once so a gate and a component cannot disagree about its spelling. */
export const PRIMARY_ACTION_ATTR = "data-primary-action";

/**
 * The props a primary control spreads onto its element.
 *
 * A SPREAD RATHER THAN A WRAPPER COMPONENT, because the controls that need it are already
 * heterogeneous -- a header button, a panel's foot, a finding card's action, a form's submit -- and
 * a wrapper would have to be threaded through four component APIs to reach them. What matters is
 * that the attribute is present and its value is one of the nine above, and a helper that returns
 * the object gets that from the type system at every call site.
 */
export const primaryAction = (act: PrimaryAction) => ({ [PRIMARY_ACTION_ATTR]: act });
