/**
 * HOW A CLAIM GETS TESTED, and why one answer does not fit every claim.
 *
 * The product has had one validation protocol: present the position again and see what the player
 * does. That is right for a claim about a POSITION -- "your calibration slips in the endgame" names
 * something a drill can reproduce faithfully, because an endgame is a board.
 *
 * IT IS WRONG FOR A CLAIM ABOUT THE DECISION ENVIRONMENT, and wrong in a way that looks like
 * evidence. "Your calibration slips under time pressure" cannot be tested by showing somebody a
 * position with no clock running: the drill removes the one condition the claim is about, and then
 * reports a verdict on it. INV-10 forbids exactly this.
 *
 * SO THE PROTOCOL FOLLOWS FROM WHAT THE CLAIM IS ABOUT, and it is derived from the bucket rather
 * than chosen by whoever is writing the screen. Three of the product's six buckets are properties
 * of a position and three are properties of a clock, and no amount of care in a drill can make the
 * second group testable by the first.
 */
import type { RequiredTimeControl } from "./blitz-game-core.js";
import { classifyBucketKey, type ClaimClass } from "./discovery/claim-class.js";
import type { MeasurementProtocol } from "./measurement-protocol.js";

export type ProtocolKind = "position-drill" | "timed-holdout";

/**
 * The protocol a claim about this bucket requires.
 *
 * THE TWO KEY LISTS THAT USED TO LIVE HERE HAVE MOVED, and the move is the point rather than
 * tidiness. They said which of the six shipped buckets name a board and which name a clock; the
 * moment a subgroup is a predicate a search produced rather than one of six names, that question
 * has to be answered from what the subgroup READS. `shared/discovery/claim-class.ts` answers it
 * for both shapes from one table, so "a clock is not a property of a board" is written down once.
 *
 * THIS FUNCTION'S ANSWERS ARE UNCHANGED, deliberately: the same nine keys map to the same two
 * protocols, and anything else still returns null. `tests/shared/a-clock-claim-a-drill-cannot-
 * test.test.ts` is what says so.
 *
 * RETURNS NULL FOR A BUCKET NOBODY HAS CLASSIFIED, rather than guessing at a drill. A new bucket
 * added without deciding how it can be validated is a bucket whose claims cannot be validated, and
 * saying so is better than quietly testing a clock with a chessboard.
 */
export function protocolFor(bucketKey: string): ProtocolKind | null {
  const claimClass: ClaimClass = classifyBucketKey(bucketKey);
  if (claimClass === "POSITION") return "position-drill";
  if (claimClass === "ENVIRONMENT") return "timed-holdout";
  /*
   * EVERY OTHER CLASS IS NULL HERE, INCLUDING THE ONES THAT ARE NOT `UNKNOWN`. A sequence claim or
   * a model-derived one needs a protocol this module does not implement, and returning the nearest
   * one it does implement would be the substitution INV-10 forbids. `protocolForClass` in
   * `claim-class.ts` names what each of them actually needs.
   */
  return null;
}

/**
 * A holdout, frozen before any evidence is collected.
 *
 * EVERY FIELD IS A COMMITMENT MADE IN ADVANCE. A holdout whose target N is decided once the numbers
 * are in is not a holdout, it is a search with a stopping rule chosen to suit the answer.
 */
export interface TimedHoldout {
  holdoutId: string;
  claimId: string;
  /**
   * The boundary, AS A TIMESTAMP AND NOT A DECISION COUNT.
   *
   * The existing prospective machinery slices by `decisions_before` -- a count of rows as they
   * stood at registration -- and that is correct for a claim about positions. It is wrong for one
   * about time: two records with the same decision count span different amounts of clock, and a
   * player who imports fifty games moves the boundary by fifty without a second passing.
   */
  claimFrozenAt: string;
  /** Which protocol's decisions count. A historical import can never satisfy a clock claim. */
  eligibleProtocol: MeasurementProtocol;
  /** Which clock. 3+0 and 5+5 are different environments, so a holdout names one. */
  eligibleTimeControl: RequiredTimeControl;
  /** How many decisions before a verdict, decided now. */
  targetN: number;
  /** The share of decisions inside the bucket that must be accurate to confirm. */
  confirmAtOrAbove: number;
  /** ...and the share at or below which the claim is refuted. Between the two is inconclusive. */
  refuteAtOrBelow: number;
}

/** One decision, reduced to what a holdout may look at. */
export interface HoldoutCandidate {
  createdAt: string;
  measurementProtocol: MeasurementProtocol | null;
  timeControl: { initialMs: number | null; incrementMs: number | null };
  inBucket: boolean;
  accurate: boolean;
}

/** Why a decision was not counted. Named, because a shrinking denominator has to explain itself. */
export type Exclusion =
  | "before-the-claim-was-frozen"
  | "wrong-protocol"
  | "wrong-time-control"
  | "outside-the-bucket";

export function excludedBecause(
  candidate: HoldoutCandidate,
  holdout: TimedHoldout,
): Exclusion | null {
  /*
   * THE STRICT INEQUALITY IS THE POINT. A decision taken at the same millisecond the claim was
   * frozen is not evidence FOR it -- it is one of the decisions that suggested it, and a claim
   * tested on the decisions that suggested it is not a claim that was tested.
   */
  if (!(candidate.createdAt > holdout.claimFrozenAt)) return "before-the-claim-was-frozen";
  if (candidate.measurementProtocol !== holdout.eligibleProtocol) return "wrong-protocol";
  if (
    candidate.timeControl.initialMs !== holdout.eligibleTimeControl.initialMs ||
    candidate.timeControl.incrementMs !== holdout.eligibleTimeControl.incrementMs
  ) {
    return "wrong-time-control";
  }
  if (!candidate.inBucket) return "outside-the-bucket";
  return null;
}

export const eligible = (c: HoldoutCandidate, h: TimedHoldout): boolean =>
  excludedBecause(c, h) === null;

export type HoldoutVerdict =
  | { kind: "confirmed"; n: number; accurateRate: number }
  | { kind: "refuted"; n: number; accurateRate: number }
  | { kind: "inconclusive"; n: number; accurateRate: number }
  | { kind: "not-yet"; n: number; needed: number };

/**
 * The verdict, by the rule written down when the holdout was frozen.
 *
 * BELOW TARGET N IT REFUSES TO ANSWER. Reporting a rate on nine decisions when twenty were
 * promised is the stopping rule being chosen after the fact, which is the whole thing a
 * preregistered target exists to prevent.
 */
export function evaluateHoldout(
  candidates: readonly HoldoutCandidate[],
  holdout: TimedHoldout,
): HoldoutVerdict {
  const counted = candidates.filter((c) => eligible(c, holdout));
  const n = counted.length;
  if (n < holdout.targetN) return { kind: "not-yet", n, needed: holdout.targetN - n };
  const accurateRate = counted.filter((c) => c.accurate).length / n;
  if (accurateRate >= holdout.confirmAtOrAbove) return { kind: "confirmed", n, accurateRate };
  if (accurateRate <= holdout.refuteAtOrBelow) return { kind: "refuted", n, accurateRate };
  return { kind: "inconclusive", n, accurateRate };
}

/** What was left out and why, so a population can explain itself rather than only be a number. */
export function exclusionsFor(
  candidates: readonly HoldoutCandidate[],
  holdout: TimedHoldout,
): { reason: Exclusion; n: number }[] {
  const counts = new Map<Exclusion, number>();
  for (const candidate of candidates) {
    const reason = excludedBecause(candidate, holdout);
    if (reason) counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  return [...counts.entries()].map(([reason, n]) => ({ reason, n }));
}
