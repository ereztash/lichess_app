/**
 * What the counterfactual probe has actually said, read back off the record.
 *
 * WHY THIS MODULE HAD TO EXIST BEFORE THE FEATURE COULD BE CALLED FINISHED. This session's
 * recurring defect, found nine times, is a distinction that gets measured and then discarded
 * before display. The probe stored an arm on every decision, an answer on the probed ones and a
 * score on the answered ones -- and until this, nothing read any of it back. That is the same
 * defect with the expensive half already paid for.
 *
 * WHAT IT MAY SAY, AND IT IS LESS THAN IT LOOKS. Counts with the denominators they came out of,
 * and nothing more until `MIN_BUCKET_N` scored answers exist. A rate from nine answers has a very
 * confident-looking provenance and no content.
 *
 * THREE DENOMINATORS THAT A SINGLE "probed" NUMBER WOULD FUSE:
 *
 *   asked        the probed arm -- the randomisation's own denominator
 *   answered     the player responded, with a move or with "nothing else"
 *   scored       a move was named AND the engine priced it
 *
 * Only `scored` can carry a reading. Dividing the four readings by `asked` would divide by
 * decisions that never produced one, which is the shape R1 exists to forbid.
 */
import { classifyCounterfactual, type CounterfactualReading } from "./counterfactual.js";
import { ACCURATE_WIN_PROBABILITY_LOSS, MIN_BUCKET_N } from "./detector.js";
import { winProbabilityLoss } from "./win-probability.js";
import { PROBE_ASSIGNMENTS, type DecisionAtom, type ProbeAssignment } from "./decision-atom.js";

/** The three arms, plus the decisions that were never randomised into any of them. */
export type ArmCounts = Record<ProbeAssignment | "no-arm", number>;

export interface ArmAccuracy {
  accurate: number;
  n: number;
}

export interface CounterfactualRecordReading {
  arms: ArmCounts;
  /** Decisions in the probed arm. The randomisation's denominator. */
  asked: number;
  /** Of those, the ones the player answered at all. */
  answered: number;
  /** Of those, the ones answered with no move -- a real answer, and not a gap. */
  namedNothing: number;
  /** Of those, the ones whose named move the engine priced. The readings' denominator. */
  scored: number;
  readings: Record<CounterfactualReading, number>;
  /**
   * THE NEGATIVE CONTROL, and the most useful number here.
   *
   * The arm is drawn at commit -- after the decision is complete and before the question is put --
   * so being probed CANNOT have changed the accuracy of the decision it is attached to. There is
   * no causal path. Both arms should therefore read the same, and a difference is either chance
   * or a broken randomisation. It is the one comparison in this product whose expected answer is
   * known before it is run, and everything else the probe reports rests on it.
   */
  accuracyByArm: Record<"probed" | "not-probed", ArmAccuracy>;
  measurable: boolean;
  /** How many more scored answers before a rate may be stated. Zero once `measurable`. */
  shortBy: number;
}

export function readCounterfactuals(atoms: DecisionAtom[]): CounterfactualRecordReading {
  const arms: ArmCounts = { probed: 0, "not-probed": 0, ineligible: 0, "no-arm": 0 };
  const readings: Record<CounterfactualReading, number> = {
    "both-good": 0,
    narrow: 0,
    reachable: 0,
    neither: 0,
  };
  const accuracyByArm: Record<"probed" | "not-probed", ArmAccuracy> = {
    probed: { accurate: 0, n: 0 },
    "not-probed": { accurate: 0, n: 0 },
  };
  let asked = 0;
  let answered = 0;
  let namedNothing = 0;
  let scored = 0;

  for (const atom of atoms) {
    const probe = atom.probe;
    arms[probe ? probe.assignment : "no-arm"] += 1;
    if (!probe) continue;

    if (probe.assignment === "probed" || probe.assignment === "not-probed") {
      /*
       * Accuracy is only defined once the engine has spoken, so an unrevealed decision is counted
       * in its arm above and NOT in the arm's accuracy denominator below. Counting it as
       * inaccurate would charge the player for a search that has not finished.
       */
      if (atom.result) {
        const cell = accuracyByArm[probe.assignment];
        cell.n += 1;
        if (isAccurate(atom)) cell.accurate += 1;
      }
    }

    if (probe.assignment !== "probed") continue;
    asked += 1;
    if (!probe.answered) continue;
    answered += 1;
    if (probe.alternative === null) {
      namedNothing += 1;
      continue;
    }
    const reading = classifyCounterfactual({
      evalCp: atom.result?.engine_eval_cp ?? null,
      chosenCpLoss: atom.result?.cp_loss ?? null,
      alternativeCpLoss: probe.alternative_cp_loss,
    });
    // Null is not a fifth reading: it means the pair was never priced, which is not a finding.
    if (reading === null) continue;
    scored += 1;
    readings[reading] += 1;
  }

  return {
    arms,
    asked,
    answered,
    namedNothing,
    scored,
    readings,
    accuracyByArm,
    measurable: scored >= MIN_BUCKET_N,
    shortBy: Math.max(0, MIN_BUCKET_N - scored),
  };
}

/**
 * The product's own accuracy rule, applied here rather than re-derived.
 *
 * Imported from the scorer would be better still; it takes a `ScoredDecision`, and this module
 * reads atoms because the probe lives on the atom and not on the scored row. The rule itself is
 * one expression and it is the one `shared/scoring.ts` uses, character for character.
 */
function isAccurate(atom: DecisionAtom): boolean {
  if (!atom.result) return false;
  return (
    winProbabilityLoss(atom.result.engine_eval_cp, atom.result.cp_loss) <=
    ACCURATE_WIN_PROBABILITY_LOSS
  );
}


/** Runtime witness that the arm list has not grown without this reading noticing. */
export const COUNTED_ARMS = [...PROBE_ASSIGNMENTS, "no-arm"] as const;
