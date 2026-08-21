/**
 * The bridge from Layer A (the record) to the detector.
 *
 * Only decisions that have been REVEALED can be scored: accuracy comes from the engine's
 * verdict, and a decision with no reveal has no verdict. Counting an unrevealed decision as
 * anything would be the product inventing data, so they are excluded and COUNTED SEPARATELY --
 * "not enough decisions yet" and "not enough revealed decisions yet" are different states and
 * must not read the same (R2).
 */
import type { DecisionAtom } from "./decision-atom.js";
import { ACCURATE_CP_LOSS, normaliseConfidence, type ScoredDecision } from "./detector.js";

export interface ScoringSummary {
  scored: ScoredDecision[];
  /** Decisions on the record in total. */
  total: number;
  /** Decisions the engine has not yet passed verdict on. */
  awaitingReveal: number;
}

export function scoreDecisions(atoms: DecisionAtom[], decisionIds: string[]): ScoringSummary {
  const scored: ScoredDecision[] = [];
  let awaitingReveal = 0;
  atoms.forEach((atom, index) => {
    if (!atom.result) {
      awaitingReveal += 1;
      return;
    }
    scored.push({
      decision_id: decisionIds[index] ?? `decision-${index}`,
      confidence: normaliseConfidence(atom.bounded_action.confidence),
      accurate: atom.result.cp_loss <= ACCURATE_CP_LOSS,
      phase: atom.entry_state.phase,
      secondsTaken: atom.bounded_action.seconds_taken,
      clockMsRemaining: atom.entry_state.clock_ms_remaining,
    });
  });
  return { scored, total: atoms.length, awaitingReveal };
}

/**
 * Why the product is currently silent, in the player's terms.
 *
 * Section 4.5: "Not enough decisions yet to say anything about your play" is a correct and
 * useful screen. It must not be filled with encouragement, a generic tip, or a pattern derived
 * from four data points. It should, however, say WHICH kind of not-enough this is.
 */
export function silenceReason(summary: ScoringSummary, minimumRequired: number): string | null {
  if (summary.scored.length >= minimumRequired) return null;
  const short = minimumRequired - summary.scored.length;
  if (summary.awaitingReveal > 0) {
    return `נרשמו ${summary.total} החלטות, מתוכן ${summary.scored.length} נחשפו. צריך עוד ${short} החלטות חשופות לפני שאפשר לומר משהו — ו-${summary.awaitingReveal} ממתינות לחשיפה.`;
  }
  return `נרשמו ${summary.scored.length} החלטות. צריך לפחות ${minimumRequired} לפני שאפשר לומר משהו על הדפוסים שלך, ואפילו אז זו תהיה השערה.`;
}
