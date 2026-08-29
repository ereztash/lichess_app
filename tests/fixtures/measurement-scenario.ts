/**
 * The scenario GATE-MEASURE runs, and the verdict it reads -- shared so the gate and its positive
 * control assert the identical thing about two different splits.
 *
 * THE INVARIANT: a decision whose measurement is MISSING must not change any bucket. Not the
 * bucket's own membership, and not the membership of the rest of the record the bucket is compared
 * against. "We do not know how long this took" is not "this took more than 45 seconds", and a
 * baseline that absorbs unmeasured decisions moves the difference the detector tests.
 */
import { BUCKETINGS, type BucketableDecision, type Bucketing } from "../../shared/detector";

export interface Split<T> {
  inside: T[];
  outside: T[];
}
export type SplitFn = <T extends BucketableDecision>(
  bucketing: Bucketing,
  decisions: readonly T[],
) => Split<T>;

/** A decision carrying only what a bucket is allowed to look at. */
export const decision = (over: Partial<BucketableDecision> = {}): BucketableDecision => ({
  phase: "middlegame",
  secondsTaken: 60,
  clockMsRemaining: 120_000,
  ...over,
});

/**
 * Twenty measured decisions, and ten with NOTHING measured on them.
 *
 * The measured half deliberately straddles every threshold -- some under 45 seconds, some over two
 * minutes, some under a minute on the clock -- so that a split which absorbs the unmeasured ten
 * changes a count no matter which side it puts them on.
 *
 * The unmeasured ten are missing both fields at once, because the two halves of the invariant below
 * need the same decisions: a bucket that reads a missing field must not see them, and a bucket that
 * reads neither must.
 */
export function unmeasuredScenario(): {
  measured: BucketableDecision[];
  unmeasured: BucketableDecision[];
} {
  const measured = [
    ...Array.from({ length: 7 }, () => decision({ secondsTaken: 10, clockMsRemaining: 30_000 })),
    ...Array.from({ length: 7 }, () => decision({ secondsTaken: 200, clockMsRemaining: 400_000 })),
    ...Array.from({ length: 6 }, () => decision({ secondsTaken: 60, clockMsRemaining: 90_000 })),
  ];
  const unmeasured = Array.from({ length: 10 }, () =>
    decision({ secondsTaken: null, clockMsRemaining: null }),
  );
  return { measured, unmeasured };
}

export interface MembershipVerdict {
  ok: boolean;
  detail: string;
}

/**
 * Run the invariant against a split. BOTH DIRECTIONS, and the second one is what makes this a gate
 * rather than a licence.
 *
 * 1. A bucket that READS a missing field must not see the decision at all -- not in the bucket, and
 *    not in the comparison set the bucket is tested against.
 * 2. A bucket that reads NEITHER missing field must still see it. Phase is a fact about the
 *    position; it does not stop being knowable because nobody timed the move. Without this half,
 *    "drop every decision with any null anywhere" would pass -- and would quietly delete real
 *    decisions from the three phase buckets, which is the same defect pointing the other way.
 */
export function membershipVerdict(split: SplitFn): MembershipVerdict {
  const { measured, unmeasured } = unmeasuredScenario();
  const withGaps = [...measured, ...unmeasured];
  for (const bucketing of BUCKETINGS) {
    const before = split(bucketing, measured);
    const after = split(bucketing, withGaps);
    const reads = bucketing.requiresTime === true || bucketing.requiresClock === true;
    const grew = after.inside.length + after.outside.length - (before.inside.length + before.outside.length);

    if (reads) {
      if (before.inside.length !== after.inside.length) {
        return {
          ok: false,
          detail:
            `${bucketing.key} reads a field these decisions do not carry, yet the bucket moved ` +
            `from ${before.inside.length} to ${after.inside.length}`,
        };
      }
      if (before.outside.length !== after.outside.length) {
        return {
          ok: false,
          detail:
            `${bucketing.key} reads a field these decisions do not carry, yet its comparison set ` +
            `moved from ${before.outside.length} to ${after.outside.length}`,
        };
      }
      continue;
    }

    if (grew !== unmeasured.length) {
      return {
        ok: false,
        detail:
          `${bucketing.key} reads neither field, so all ${unmeasured.length} decisions belong to ` +
          `it; only ${grew} were kept`,
      };
    }
  }
  return { ok: true, detail: "every bucket saw exactly the decisions it can read" };
}

/**
 * The split as it shipped: no eligibility step, and a missing time read as zero.
 *
 * `?? 0` is where the import path wrote it (`shared/import-diagnostic.ts`), and the missing
 * `bucketable` filter is what put a null clock into the comparison set. Both are reproduced here
 * so the positive control fails for the reasons the gate exists to catch.
 */
export const legacySplit: SplitFn = <T extends BucketableDecision>(
  bucketing: Bucketing,
  decisions: readonly T[],
) => {
  const coerced = decisions.map((d) => ({ ...d, secondsTaken: d.secondsTaken ?? 0 }) as T);
  return {
    inside: coerced.filter(bucketing.predicate),
    outside: coerced.filter((d) => !bucketing.predicate(d)),
  };
};
