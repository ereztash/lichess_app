/**
 * When the engine is allowed to speak: after every decision, or after the whole game.
 *
 * WHY THIS IS A MEASUREMENT SETTING AND NOT A PACING PREFERENCE. Over one position, commit-then-
 * verdict IS the product. Over a forty-move game it is something else: by move twenty the player
 * has been told twenty times how their last move scored, so every decision after the first was
 * made by somebody being coached mid-game by a stronger engine. That is a good way to learn and
 * it is not a reading of how the player decides unaided.
 *
 * SO THE TWO ARE NOT POOLABLE, and every decision records which was in force. This is the
 * `confidence_scale` lesson in a second place: a stored number whose meaning depends on a setting
 * nothing recorded is a number nobody can read back afterwards.
 *
 * R3 IS UNCHANGED AND UNTOUCHED BY EITHER. The engine may never speak before a commitment. This
 * decides only how long AFTER the commitment it stays quiet -- one decision, or one game.
 */
export const REVEAL_TIMINGS = ["per-decision", "end-of-game"] as const;
export type RevealTiming = (typeof REVEAL_TIMINGS)[number];

/**
 * The whole rule, in one place, so the screen cannot make its own decision about it.
 *
 * A mid-game exception would be worse than not having the mode at all: the player would have
 * been shown a verdict while the record still said `end-of-game`, so the field would be WRONG
 * rather than merely absent, and a wrong condition is a confound that looks like a control.
 */
export const mayShowVerdictNow = (timing: RevealTiming): boolean => timing === "per-decision";

/**
 * What a decision runs under, which is not always what the player chose.
 *
 * A DRILL AND A TRANSFER RUN ARE NOT GAMES, and deferring them would not be a stricter version of
 * the same idea -- it would break what they are:
 *
 *   a drill reports a verdict against a refutation condition registered before it started (R5),
 *   and the report is the drill. Holding it back until "the end of the game" is meaningless when
 *   there is no game, only a set of positions;
 *
 *   a transfer observation is frozen per position, before the engine speaks, and the run advances
 *   on the strength of that verdict. A deferred run would advance on nothing.
 *
 * So the player's choice applies to the live game and to nothing else, and this function is where
 * that is decided -- once, rather than at each of the three call sites that would otherwise each
 * get to have an opinion.
 */
export type DecisionContext = "game" | "drill" | "transfer";

export function effectiveTiming(chosen: RevealTiming, context: DecisionContext): RevealTiming {
  return context === "game" ? chosen : "per-decision";
}
