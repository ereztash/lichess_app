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
 * Lives in `shared/` rather than beside the screen because the rule is about the measurement and
 * not about the screen. It used to say here that the string is "deliberately one of
 * `SessionStage`'s own members" -- which was true, and was a comment where it should have been a
 * type. `DecisionStage` moved to `shared/decision-stage.ts` so the annotation below checks it: a
 * rename that left this naming a stage nothing reaches is now a compile error rather than a screen
 * a player finds.
 */
import type { DecisionStage } from "./decision-stage.js";

export const PROBE_STAGE: DecisionStage = "committed";
