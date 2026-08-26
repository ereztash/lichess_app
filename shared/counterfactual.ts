/**
 * The road not taken: what the player would have played instead, asked before the engine speaks.
 *
 * WHY THIS IS NOT `candidate_moves_considered` UNDER A NEW NAME. That field asks "what did you
 * consider?" -- a recall question about one's own process, and the class of self-report this
 * project removed on published evidence (Reed et al. 1974; Craig et al. 2020, r = 0.22 [0.14,
 * 0.31]). This asks the player to PRODUCE an alternative. The answer is a chess move, the engine
 * can score it, and the reading below is a fact about two moves rather than a belief about a mind.
 *
 * WHAT IT MEASURES THAT NOTHING ELSE HERE DOES. de Groot (1946), replicated at 70 years by
 * Connors, Burns & Campitelli (2011): masters do not search deeper or wider than weaker players --
 * they SELECT better candidates and evaluate them better. The accuracy rate sees only which move
 * was played. The quality of the alternative is a reading on the other half.
 *
 * `reachable` is the reason the module exists: the better move was in the player's own hand and
 * did not get played. Bilalic, McLeod & Gobet (PLoS ONE 2013) found masters' eyes still on the
 * squares of a familiar solution while they reported searching for a new one -- the Einstellung
 * effect. That gap between what a player did and what they believe they did is this product's
 * whole subject, and it has never been measurable here without an eye tracker. This is the same
 * gap in a form a chess app can record.
 *
 * WHERE IT SITS IN THE CYCLE. After the move is locked and BEFORE the engine speaks. Earlier and
 * naming the alternative could turn into choosing it; later and the engine's opinion is in the
 * room. R3 already defines exactly that window.
 *
 * WHAT IT IS NOT. One self-generated alternative is not the player's candidate set, and nothing
 * in this file calls it that.
 */
import { Chess } from "chess.js";
import type { Probe, ProbeAssignment } from "./decision-atom.js";
import { ACCURATE_WIN_PROBABILITY_LOSS } from "./detector.js";
import { winProbabilityLoss } from "./win-probability.js";

/**
 * The eligibility rule, and it is DEFINITIONAL rather than chosen.
 *
 * "What would you have done instead" has no answer where there was nothing else to do, so a
 * position with fewer than two legal moves cannot carry the question. It would have been easy to
 * set a higher floor -- "at least eight legal moves" -- to make the probed arm look richer, and
 * that would be a threshold picked to shape a result. The count is carried as a covariate on
 * every assignment instead, so an analysis can condition on it without the instrument having
 * decided in advance which positions count.
 */
export const MIN_LEGAL_MOVES_TO_ASK = 2;

/**
 * How often an eligible decision is asked. A BURDEN parameter, not a measurement threshold.
 *
 * It changes how much data the probed arm collects and how often the player is interrupted. It
 * never changes whether a finding is real -- that is what the arm assignment is for. Probing
 * everything would make a game unplayable and maximise reactivity; probing almost nothing gives
 * no n. One question in five is roughly four interruptions in a forty-move game.
 */
export const PROBE_PROBABILITY = 0.2;

export interface ProbeEligibility {
  /** Legal moves in the position. Carried on every assignment as the covariate above. */
  legalMoves: number;
  eligible: boolean;
}

/** Never throws. A malformed position is ineligible; the game loop is not the place to find out. */
export function probeEligibility(fen: string): ProbeEligibility {
  let legalMoves = 0;
  try {
    legalMoves = new Chess(fen).moves().length;
  } catch {
    return { legalMoves: 0, eligible: false };
  }
  return { legalMoves, eligible: legalMoves >= MIN_LEGAL_MOVES_TO_ASK };
}

/**
 * `ineligible` is a third value and not a synonym for the control arm -- see `PROBE_ASSIGNMENTS`
 * in shared/decision-atom.ts, which is the canonical list because the database enum is built from
 * it. Folding unaskable positions into "not-probed" would make the control group a mixture of
 * "eligible and not drawn" and "never askable", and every comparison between arms would silently
 * become a comparison between kinds of position.
 */
export interface ProbeAssignmentResult {
  assignment: ProbeAssignment;
  legalMoves: number;
}

/**
 * Assign the arm. Recorded on EVERY decision, which is what makes the control group real.
 *
 * THE VALIDITY PROPERTY: the position is used to decide whether the question *can* be asked, and
 * never to decide whether it *is*. If a rich position were likelier to be probed, the probed arm
 * would be harder by construction and any difference between arms would be position difficulty
 * wearing an experiment's clothes.
 *
 * `draw` is taken as an argument rather than read from `Math.random` so a caller can seed it and
 * so the property above is testable as a property of the function. It is consumed only on
 * eligible positions: the randomisation stream is then exactly the sequence of real assignments,
 * with nothing spent on decisions that were never in the experiment.
 */
export function assignProbe(fen: string, draw: () => number): ProbeAssignmentResult {
  const { legalMoves, eligible } = probeEligibility(fen);
  if (!eligible) return { assignment: "ineligible", legalMoves };
  return { assignment: draw() < PROBE_PROBABILITY ? "probed" : "not-probed", legalMoves };
}

/**
 * The four readings.
 *
 *   both-good   chosen accurate, alternative accurate    -- more than one way was available
 *   narrow      chosen accurate, alternative inaccurate  -- right answer, nothing behind it
 *   reachable   chosen INACCURATE, alternative ACCURATE  -- the better move was named, not chosen
 *   neither     both inaccurate                          -- the position was out of reach
 */
export type CounterfactualReading = "both-good" | "narrow" | "reachable" | "neither";

export interface CounterfactualInput {
  /** The position's evaluation before the move, from the mover's side. Null until the engine ran. */
  evalCp: number | null;
  chosenCpLoss: number | null;
  /** Null when the player was asked and could not name one -- a real answer, and not a reading. */
  alternativeCpLoss: number | null;
}

/**
 * Scored by the rule the rest of the record is scored by, not a copy of it.
 *
 * `winProbabilityLoss` at the position's own evaluation rather than a flat centipawn cut: thirty
 * centipawns is 2.76 points of winning chances at level and 0.28 at +10.00, so a flat threshold
 * would make "accurate" mean two different things inside one classification and this reading would
 * not be comparable to the accuracy rate printed beside it.
 */
const isAccurate = (evalCp: number, cpLoss: number): boolean =>
  winProbabilityLoss(evalCp, cpLoss) <= ACCURATE_WIN_PROBABILITY_LOSS;

/**
 * Null rather than a default, in both directions. No engine evaluation yet means no reading exists
 * (R3 from the other side); no alternative named means there is only one move to read, and a
 * reading about two moves may not be produced from one.
 */
export function classifyCounterfactual({
  evalCp,
  chosenCpLoss,
  alternativeCpLoss,
}: CounterfactualInput): CounterfactualReading | null {
  if (evalCp === null || chosenCpLoss === null || alternativeCpLoss === null) return null;
  if (!Number.isFinite(evalCp) || !Number.isFinite(chosenCpLoss)) return null;
  if (!Number.isFinite(alternativeCpLoss)) return null;

  const chosen = isAccurate(evalCp, chosenCpLoss);
  const alternative = isAccurate(evalCp, alternativeCpLoss);
  if (chosen) return alternative ? "both-good" : "narrow";
  return alternative ? "reachable" : "neither";
}

/**
 * The arm, and the answer if there is one, in the atom's shape.
 *
 * NULL WHEN THERE IS NO ARM, and that is a fourth state rather than a default. A decision
 * committed before the probe existed was never randomised into anything, and giving it an arm on
 * read would enrol it retrospectively into a group it was never part of.
 *
 * `answered` is the presence of the answer row, NOT `alternative !== null`. A player who was
 * asked and could not name a move has said something real; one who was never asked has said
 * nothing. Both carry a null move.
 */
export function assembleProbe(
  row: { probeAssignment: ProbeAssignment | null; legalMoves: number | null },
  answer: { alternative: string | null; cpLoss: number | null } | undefined,
): Probe | null {
  if (row.probeAssignment === null || row.legalMoves === null) return null;
  return {
    assignment: row.probeAssignment,
    legal_moves: row.legalMoves,
    alternative: answer?.alternative ?? null,
    answered: answer !== undefined,
    alternative_cp_loss: answer?.cpLoss ?? null,
  };
}
