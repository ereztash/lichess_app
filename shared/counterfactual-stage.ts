/**
 * The one stage the counterfactual question may be asked in.
 *
 * A CONSTANT IN ITS OWN MODULE, AND NOT A LITERAL IN THE SCREEN, so that the rule can be stated
 * as a fact about two modules rather than as a comment somebody has to keep reading. The window
 * has a hard edge on both sides:
 *
 *   before the commitment -- naming an alternative IS choosing one. A player who says "I'd have
 *   played Nf3" while their move can still change has been handed a second candidate, and the
 *   decision the record stores is no longer the decision they were going to make.
 *
 *   after the reveal -- the alternative is a reading of the engine's line rather than the
 *   player's own, and storage cannot tell the two apart afterwards. This is R3 from the side it
 *   is not usually written on.
 *
 * `engineMayRun` is already false here, and `tests/client/the-question-in-the-window.test.tsx`
 * asserts exactly that. Moving the probe to any other stage fails that assertion, which is the
 * only way such a move can happen without somebody noticing.
 *
 * Lives in `shared/` rather than beside `SessionStage` because the rule is about the measurement
 * and not about the screen; the string is deliberately one of `SessionStage`'s own members.
 */
export const PROBE_STAGE = "committed" as const;
