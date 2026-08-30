/**
 * The bridge from Layer A (the record) to the detector.
 *
 * Only decisions that have been REVEALED can be scored: accuracy comes from the engine's
 * verdict, and a decision with no reveal has no verdict. Counting an unrevealed decision as
 * anything would be the product inventing data, so they are excluded and COUNTED SEPARATELY --
 * "not enough decisions yet" and "not enough revealed decisions yet" are different states and
 * must not read the same (R2).
 */
import { LEGACY_CONFIDENCE_LEVELS, normaliseConfidence } from "./confidence.js";
import type { DecisionAtom } from "./decision-atom.js";
import { accurateDecision, type ScoredDecision } from "./detector.js";
import { readableInstrument } from "./evidence-policy.js";

export interface ScoringSummary {
  scored: ScoredDecision[];
  /** Decisions on the record in total. */
  total: number;
  /** Decisions the engine has not yet passed verdict on. */
  awaitingReveal: number;
  /**
   * Decisions taken where nothing measures a stated confidence, so none was asked for.
   *
   * NOT A WAIT, and that is the difference from `awaitingReveal` above. An unrevealed decision
   * becomes scoreable the moment the engine speaks; this one never will, by design, and telling a
   * player to keep going would describe a problem they do not have. Counted rather than dropped,
   * because a record of 200 decisions of which 40 carry a confidence is a different thing from a
   * record of 40, and only one of those is honest about what the player did.
   */
  withoutConfidence: number;
  /**
   * Decisions the engine HAS passed verdict on, where nothing recorded which engine that was.
   *
   * A FOURTH STATE, and it is none of the three above. The decision is on the record, a confidence
   * was stated, a `cp_loss` exists -- and the number cannot be read, because `engine_source` names
   * a family and not an instrument. `docs/ACTION_PLAN.md` B1 measured 13.61% of decisions flipping
   * verdict between two engines that would both have written `local_sf18`, so "accurate" is not
   * defined for a row that cannot say which of them spoke.
   *
   * COUNTED, NOT DROPPED, for the reason `withoutConfidence` is: a record of 200 revealed
   * decisions of which 0 name their engine is a different thing from a record of 0, and a screen
   * that silently showed the second would be telling the player they have not played.
   *
   * IT WILL BE EVERY PRE-EXISTING ROW, and that is the intended cost rather than an oversight.
   * `shared/evidence-policy.ts` made the same trade when it was written -- *"a source does not
   * become eligible because excluding it leaves too little data"* -- and the same sentence applies
   * to an instrument nobody wrote down. New decisions carry the build from the first one.
   */
  withoutInstrument: number;
}

export function scoreDecisions(atoms: DecisionAtom[], decisionIds: string[]): ScoringSummary {
  const scored: ScoredDecision[] = [];
  let awaitingReveal = 0;
  let withoutConfidence = 0;
  let withoutInstrument = 0;
  atoms.forEach((atom, index) => {
    if (!atom.result) {
      awaitingReveal += 1;
      return;
    }
    /*
     * THE ONE PLACE A MISSING CONFIDENCE IS HANDLED, and it is handled by exclusion.
     *
     * Every measurement in this product -- the gap, its three-way split, the discrimination area,
     * the effort correlation, the detector's six buckets, a drill's verdict -- reads
     * `ScoredDecision.confidence`, and every one of them gets there through this function. So one
     * guard here is the whole of it, and no downstream module ever sees a null it might quietly
     * read as zero, or as the middle of the scale, or as "not confident".
     */
    if (atom.bounded_action.confidence === null) {
      withoutConfidence += 1;
      return;
    }
    /*
     * AFTER THE CONFIDENCE CHECK AND NOT BEFORE IT, which decides what each number means.
     *
     * A decision nobody was asked about can never be scored whatever engine judged it, so counting
     * it here instead would move rows out of `withoutConfidence` -- a number already on screen --
     * into a new one, and change a sentence the player reads for a reason that has nothing to do
     * with them. In this order `withoutInstrument` is exactly the decisions that would otherwise
     * have been scored, which is the only reading of it anybody wants.
     */
    if (!readableInstrument(atom)) {
      withoutInstrument += 1;
      return;
    }
    scored.push({
      decision_id: decisionIds[index] ?? `decision-${index}`,
      fen: atom.entry_state.fen,
      /*
       * THE ONE PLACE THAT RESOLVES A MISSING SCALE, and it resolves it to a fact rather than a
       * default: `confidence_scale` was added when the scale moved to seven, so a row without one
       * was written while the scale had five levels. `normaliseConfidence` takes both arguments
       * required precisely so this decision cannot be made anywhere else by accident.
       */
      confidence: normaliseConfidence(
        atom.bounded_action.confidence,
        atom.bounded_action.confidence_scale ?? LEGACY_CONFIDENCE_LEVELS,
      ),
      /*
       * Judged on what the move COST, not on how many centipawns it shed. Thirty centipawns is
       * worth 2.76 points of winning chances at a level position and 0.28 at +10.00 -- a tenth of
       * the same "event" -- so the old rule made "accurate" mean something different depending on
       * how the game stood, and calibration against an event that is not one event is undefined.
       */
      accurate: accurateDecision(atom.result.engine_eval_cp, atom.result.cp_loss),
      phase: atom.entry_state.phase,
      secondsTaken: atom.bounded_action.seconds_taken,
      clockMsRemaining: atom.entry_state.clock_ms_remaining,
    });
  });
  return { scored, total: atoms.length, awaitingReveal, withoutConfidence, withoutInstrument };
}

/**
 * Why the product is currently silent, in the player's terms.
 *
 * Section 4.5: "Not enough decisions yet to say anything about your play" is a correct and
 * useful screen. It must not be filled with encouragement, a generic tip, or a pattern derived
 * from four data points.
 *
 * IT USED TO CARRY THE COUNTS, and that made it the second copy of a sentence already on screen.
 * The context ribbon at the top of the page renders `loopPosition()`, which says "עוד N החלטות
 * מדודות עד שאפשר לומר משהו", how many are awaiting reveal, and "{scored} נמדדו מתוך {recorded}
 * רשומות" as its basis. This returned the same four numbers in different words, five hundred
 * pixels lower. Two surfaces disagreeing would be a bug; two surfaces agreeing at length is a
 * dashboard, which is the thing this product exists not to be.
 *
 * SO THE SPLIT IS DISTANCE VERSUS RULE. The ribbon owns how far THIS record is from a claim --
 * it changes every time a decision is revealed, and it belongs above the fold where it is read.
 * This owns why the floor is where it is, which is the same for every player and every record,
 * and belongs beside the panel whose silence it explains. Nothing was lost from the screen: every
 * number removed here is rendered by the ribbon, and the test for that is that this string no
 * longer varies with the record at all.
 */
export function silenceReason(summary: ScoringSummary, minimumRequired: number): string | null {
  if (summary.scored.length >= minimumRequired) return null;
  /*
   * `minimumRequired / 2` rather than an imported MIN_BUCKET_N: the floor is twice the per-side
   * minimum by construction, and the caller decides which minimum applies. Deriving it from the
   * argument keeps the sentence true under the pre-registered thresholds as well as the default
   * ones, where an imported constant would quietly describe the wrong search.
   */
  const perSide = minimumRequired / 2;
  return (
    `דפוס הוא הפרש בין סוג אחד לשאר הרשומה, ולכן צריך ${perSide} החלטות מדודות בתוך הסוג ` +
    `ו-${perSide} מחוצה לו — ${minimumRequired} בסך הכול. ואפילו אז זו תהיה השערה, לא ממצא.`
  );
}
