/**
 * IS THE BUCKET THE ANSWER, OR MERELY A CONTAINER FOR IT?
 *
 * WHAT M0 MEASURED, and why this file exists. `docs/discovery-v2/M0_AUDIT.md` §Q4 ran the shipped
 * chain over 11,600 simulated records. Against "nothing is there" it is close to perfect: **0
 * validated false claims in 8,000 null records**, upper 95% CI 0.00048 against a 0.02 ceiling. But
 * on a world whose true effect lives in a region no bucket can express -- `fast AND endgame` -- it
 * **validated a claim naming the wrong subgroup on 11% of records**.
 *
 * THE JUDGE CANNOT CATCH THAT, AND IT IS NOT A BUG IN THE JUDGE. Validation asks whether the frozen
 * bucket separates on games that did not suggest it. `fast-under-45s` genuinely does separate,
 * because the true region is a SUBSET of it: the endgame half carries the whole effect and drags
 * the bucket's mean with it. Every step behaves correctly and the sentence the player reads is
 * still wrong -- they are told to distrust themselves when they play fast, and they will apply that
 * to fast middlegame moves where nothing is wrong.
 *
 * SO THE QUESTION IS DIFFERENT FROM SEPARABILITY. Separability asks *does this bucket differ from
 * the rest of the record*. Attribution asks *is the difference a property of this bucket, or of
 * something inside it* -- and no amount of tightening the first answers the second.
 *
 * THE TEST: HOMOGENEITY WITHIN THE CLAIMED BUCKET. Split the bucket's own decisions by each of the
 * other bucketings and ask whether the gap differs across that split by more than sampling error.
 * If it does, the claimed name is too wide: something narrower is carrying it.
 *
 * IT WITHHOLDS; IT DOES NOT RENAME. Naming the narrower region would be choosing a region after
 * seeing the outcome, on the data the claim is being judged against -- exactly the post-hoc choice
 * R5 forbids, and the reason `freeze` exists. The honest output is "this claim is not attributable
 * to the bucket it names", plus which split broke it, so a LATER pre-registration can name that
 * region in advance and test it properly.
 *
 * WHICH DECISIONS IT MAY READ. The same ones the judge reads: the validation games, which did not
 * suggest the claim. Run on the derivation games it would be asking whether the search that chose
 * this bucket could have chosen a narrower one, which is a question about the search rather than
 * about the player, and it would inherit the search's selection.
 *
 * THE FAILURE DIRECTION IS DELIBERATE. A false "not attributable" withholds a claim that was true
 * as named; a false "attributed" lets a misattributed claim through. The first costs silence, the
 * second costs a player acting on a sentence about the wrong half of their play. `k` is chosen
 * against the first and measured against the second -- see `research/discovery-oracle`.
 */
import {
  BUCKETINGS,
  bucketable,
  gapDifferenceStandardError,
  splitByBucket,
  summarise,
  type Bucketing,
  type ScoredDecision,
} from "../detector.js";

/**
 * One split of the claimed bucket, and what it said.
 *
 * `z` IS NULL RATHER THAN INFINITE when the standard error cannot be estimated.
 * `gapDifferenceStandardError` refuses a side with fewer than two decisions or with zero sample
 * variance, for the reason it states at length: a sample that cannot estimate its own error is not
 * a sample that knows its gap exactly.
 */
export interface AttributionSplit {
  /** The bucketing the claimed bucket was split BY -- never the claimed bucket itself. */
  key: string;
  scope: string;
  /** Decisions inside the claim's bucket that are also inside this split. */
  nInside: number;
  /** Decisions inside the claim's bucket that this split excludes. */
  nOutside: number;
  /** Gap of the two halves, and their difference. Positive = the split's inside is more overconfident. */
  gapInside: number;
  gapOutside: number;
  gapDifference: number;
  standardError: number | null;
  z: number | null;
  /** Whether this split alone shows the claimed bucket is not homogeneous. */
  breaks: boolean;
  /** Why this split could not be read, when it could not. */
  unreadable: "too-few-either-side" | "no-standard-error" | null;
}

export type AttributionVerdict =
  /** Every readable split agreed: the gap is a property of the bucket as named. */
  | { kind: "attributed" }
  /** A sub-region carries it. The claim is not validated AS NAMED. */
  | { kind: "not-attributable"; splitBy: string; scope: string; z: number }
  /** Nothing could be read, which is not evidence either way. */
  | { kind: "unreadable"; because: "no-readable-split" | "bucket-too-small" };

export interface AttributionReport {
  verdict: AttributionVerdict;
  /** Every split that was attempted, readable or not, so a reader can see what was asked. */
  splits: AttributionSplit[];
  /** How many decisions of the claimed bucket the test had to work with. */
  n: number;
}

/**
 * How many decisions each side of a split needs before it is read at all.
 *
 * SMALLER THAN `MIN_BUCKET_N`, AND THAT IS THE POINT OF STATING IT SEPARATELY. The detector's floor
 * governs whether a bucket may become a claim; this governs whether a split inside an existing
 * claim may VETO one. A veto that needs as much evidence as the claim itself would almost never be
 * available at the sizes this product sees -- the bucket is already a fraction of the record, and
 * each split halves it again -- so the test would report `unreadable` on every real record and the
 * misattribution would pass exactly as before, now with a reassuring "we checked" beside it.
 *
 * 15 IS A FLOOR ON READABILITY, NOT ON EVIDENCE. The standard error still has to be estimable and
 * the difference still has to clear `k` of them; this only refuses a split so thin that its
 * variance estimate is noise. A veto from a genuinely thin split is what `k` is for.
 */
export const MIN_SPLIT_N = 15;

/**
 * How many standard errors a split has to move before it vetoes the claim's name.
 *
 * NOT `SEPARABILITY_K`, AND NOT FOR THE SAME REASON. That multiplier is set against a false-positive
 * ceiling: it decides whether a difference becomes a claim at all, and the cost of getting it wrong
 * is telling a player something untrue. This one decides whether an EXISTING claim is withheld, and
 * the two errors are not symmetric -- a veto that fires too easily costs silence about something
 * real, a veto that fires too rarely lets the misattribution through unchanged.
 *
 * MULTIPLICITY IS REAL HERE. Five other bucketings are tried against every claim, so under a truly
 * homogeneous bucket there are five chances to veto it. That inflation is in the conservative
 * direction, and it is measured rather than assumed: the false-veto rate on the clean plants and
 * the caught-misattribution rate on the interaction plant are both in
 * `research/discovery-oracle/results/`, and this constant is set from them.
 */
export const ATTRIBUTION_K = 3.0;

/**
 * The decisions of the claimed bucket, or null when the bucketing does not exist.
 *
 * Looked up by key rather than taken as an object, because a claim carries its bucket's KEY and
 * re-deriving the predicate from the key is what stops a caller passing a predicate the claim was
 * never frozen against.
 */
export function bucketingFor(key: string): Bucketing | null {
  return BUCKETINGS.find((b) => b.key === key) ?? null;
}

/**
 * Is this claim's gap a property of the bucket it names?
 *
 * `decisions` MUST BE THE VALIDATION SET. See the module note: run on the games that suggested the
 * claim, this measures the search rather than the player.
 */
export function attribution(
  claimedKey: string,
  decisions: readonly ScoredDecision[],
  k: number = ATTRIBUTION_K,
  minSplitN: number = MIN_SPLIT_N,
): AttributionReport {
  const claimed = bucketingFor(claimedKey);
  if (!claimed) {
    return { verdict: { kind: "unreadable", because: "bucket-too-small" }, splits: [], n: 0 };
  }
  const { inside } = splitByBucket(claimed, decisions);
  if (inside.length < minSplitN * 2) {
    return { verdict: { kind: "unreadable", because: "bucket-too-small" }, splits: [], n: inside.length };
  }

  const splits: AttributionSplit[] = [];
  for (const by of BUCKETINGS) {
    /*
     * A BUCKET SPLIT BY ITSELF IS NOT A SPLIT. Its `outside` inside its own decisions is empty by
     * construction, and reporting that as "too few either side" would file a tautology as a
     * measurement that merely came up short.
     */
    if (by.key === claimed.key) continue;
    /*
     * SPLIT ONLY THE DECISIONS THIS BUCKETING CAN READ. A decision with no clock is not "over a
     * minute" -- `bucketable` exists for that -- and dropping it from both sides is what keeps the
     * two halves comparable rather than one of them padded with unmeasured rows.
     */
    const readable = inside.filter((d) => bucketable(by, d));
    const half = readable.filter(by.predicate);
    const rest = readable.filter((d) => !by.predicate(d));
    const base = {
      key: by.key,
      scope: by.scope,
      nInside: half.length,
      nOutside: rest.length,
    };
    if (half.length < minSplitN || rest.length < minSplitN) {
      splits.push({
        ...base,
        gapInside: 0,
        gapOutside: 0,
        gapDifference: 0,
        standardError: null,
        z: null,
        breaks: false,
        unreadable: "too-few-either-side",
      });
      continue;
    }
    const a = summarise(half);
    const b = summarise(rest);
    const standardError = gapDifferenceStandardError(a, b);
    const gapDifference = a.gap - b.gap;
    if (standardError === null) {
      splits.push({
        ...base,
        gapInside: a.gap,
        gapOutside: b.gap,
        gapDifference,
        standardError: null,
        z: null,
        breaks: false,
        unreadable: "no-standard-error",
      });
      continue;
    }
    const z = gapDifference / standardError;
    splits.push({
      ...base,
      gapInside: a.gap,
      gapOutside: b.gap,
      gapDifference,
      standardError,
      z,
      breaks: Math.abs(z) >= k,
      unreadable: null,
    });
  }

  const readableSplits = splits.filter((s) => s.unreadable === null);
  if (readableSplits.length === 0) {
    return { verdict: { kind: "unreadable", because: "no-readable-split" }, splits, n: inside.length };
  }
  /*
   * THE LARGEST |z| NAMES THE VETO, and only the name comes from it. The verdict is already decided
   * by whether ANY split broke; picking the strongest is so the report says which division of the
   * bucket a later pre-registration should be written about, rather than whichever happened to be
   * first in the list.
   *
   * TIES ARE BROKEN TOWARDS THE HALF THAT CARRIES THE EXCESS, and the tie is not exotic -- it is
   * the ordinary case. `phase-endgame` and `phase-middlegame` split a bucket holding only those two
   * phases into the same two halves, so their `z` differs only in sign and both break together.
   * Either name is equally true and only one is useful: "the endgame part of this bucket carries
   * it" points at the decisions to pre-register next, while "the middlegame part is different"
   * describes the same division by the half where nothing is wrong. Positive `gapDifference` means
   * the split's own inside is the more overconfident half, so that is the one named.
   */
  const broken = readableSplits
    .filter((s) => s.breaks)
    .sort(
      (a, b) =>
        Math.abs(b.z ?? 0) - Math.abs(a.z ?? 0) ||
        Number(b.gapDifference > 0) - Number(a.gapDifference > 0),
    );
  if (broken.length > 0) {
    const worst = broken[0];
    return {
      verdict: { kind: "not-attributable", splitBy: worst.key, scope: worst.scope, z: worst.z ?? 0 },
      splits,
      n: inside.length,
    };
  }
  return { verdict: { kind: "attributed" }, splits, n: inside.length };
}
