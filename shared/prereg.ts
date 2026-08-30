/**
 * THE BRIDGE: a bucket named by the imported games, before the live loop has recorded anything.
 *
 * The two halves of this product never touched. The import scores hundreds of real moves and can
 * say where accuracy falls off; the live loop measures a calibration gap and needs roughly 65
 * decisions before it may speak. The import's reading was a terminal screen -- it led nowhere --
 * and the live loop started from zero every time, with six buckets to search and no idea which
 * one mattered.
 *
 * A hypothesis registered here is the connection, and it is worth exactly one thing: the live
 * detector may search ONE bucket instead of six. That restriction is what lets it run at
 * PREREGISTERED_THRESHOLDS (n = 20 rather than 30) while holding the same shuffled-label
 * false-positive ceiling. Measured: median first claim 65 decisions -> 45.
 *
 * WHAT THIS IS NOT ALLOWED TO DO, and each of these is load-bearing:
 *
 *   - It does not predict a direction. The import has no confidence data -- nobody was asked
 *     during a game already played -- so it cannot know whether the player is over- or
 *     under-confident there. It names WHERE to look. What is found there is the live loop's to
 *     measure, and `predicts_overconfidence` on the resulting claim still comes from the live
 *     decisions alone.
 *   - It does not lower the gap. See PREREGISTERED_MIN_BUCKET_N: the measurement refuted that.
 *   - It does not count decisions recorded before it was registered. A hypothesis tested on the
 *     data that suggested it is not a hypothesis, and `decisionsAfter` is the whole reason this
 *     module stores a count.
 *   - It does not survive a bucket that stopped existing. `detect` throws on an unknown key
 *     rather than returning the ordinary "no patterns" answer.
 */
import { BUCKETINGS } from "./detector.js";
import { collectibleInLiveLoop } from "./live-acquisition.js";
import { worstBucketVerdict, type ImportDiagnostic } from "./import-diagnostic.js";

/**
 * A bucket named in advance, with everything needed to tell later whether naming it was fair.
 *
 * Every field except `bucket_key` exists so a reader can audit the registration rather than
 * trust it: which games it came from, what the import actually saw, and how many decisions the
 * record already held at the moment it was written.
 */
export interface PreregisteredHypothesis {
  /** One of the six shared BUCKETINGS keys. Import-only buckets cannot be registered. */
  bucket_key: string;
  /** The bucket in the player's terms, copied so a stored hypothesis reads without the table. */
  scope: string;
  registered_at: string;
  /**
   * How many decisions the record already held. Only decisions after this index are tested,
   * which is what makes the word "pre-registered" true rather than decorative.
   */
  decisions_before: number;
  /** What the import measured, kept so the registration can be judged and not just believed. */
  evidence: {
    /** Accuracy inside the bucket, over the imported games. */
    accurate_rate: number;
    n: number;
    /** The next-worst bucket it was separable from, and by how much. */
    runner_up_key: string;
    separation: number;
    threshold: number;
    games: number;
  };
  /** R5: written before anything is tested, in the same shape a drill's condition takes. */
  refutation_condition: string;
}

/**
 * Whether a hypothesis about this bucket can be registered -- which means whether it can be TESTED.
 *
 * TWO CONDITIONS, AND THE SECOND WAS MISSING. Being one of the six shared bucketings is necessary:
 * the import's own standing buckets have no live twin and were already refused here. It is not
 * sufficient. Registration promises a test at a relaxed threshold on decisions recorded from here
 * on, and a bucket the live loop cannot fill turns that promise into a countdown that never
 * finishes -- `clock-under-1m` against a board that writes `clockMsRemaining: null` on every
 * decision it will ever record. See shared/live-acquisition.ts, which holds that fact and the
 * measurement behind it.
 *
 * REFUSING IS ALREADY A HANDLED OUTCOME, which is what makes this a one-line fix rather than a
 * feature: `not-registrable` exists, and `PreregisterBridge` already renders it in words that fit
 * this case exactly -- the lowest bucket is one that is only read out of finished games and has no
 * counterpart in the live loop. The screen could say the true thing all along; the predicate never
 * routed here.
 */
export function isRegistrableBucket(key: string): boolean {
  const bucketing = BUCKETINGS.find((candidate) => candidate.key === key);
  if (!bucketing) return false;
  return collectibleInLiveLoop(bucketing);
}

/**
 * Why an import produced no hypothesis. Four distinct outcomes, and they must not read alike --
 * "we could not tell your buckets apart" is a finding, and "you have not imported enough" is a
 * wait. Section 4.5.
 */
export type PreregOutcome =
  | { kind: "registered"; hypothesis: PreregisteredHypothesis }
  | { kind: "nothing-readable" }
  /**
   * ONE READABLE BUCKET IS A RATE, NOT A COMPARISON, and it needed its own outcome.
   *
   * `worstBucketVerdict` says exactly this in its own comment and returns
   * `separation: 0, threshold: 0, separable: false` to express it. Those are SENTINELS, and they
   * were reaching the screen through `not-separable`, which renders them: "the accuracy difference
   * between the lowest and the next is 0 percentage points, and their sampling error is 0" — a
   * comparison against a bucket that does not exist, printed as two measurements, contradicting
   * the panel above it that shows one readable bucket.
   *
   * The type's own doc says these outcomes "must not read alike". This is the fifth.
   */
  | { kind: "only-one-readable"; worstKey: string }
  | { kind: "not-separable"; worstKey: string; separation: number; threshold: number }
  | { kind: "not-registrable"; worstKey: string };

/**
 * Derive a hypothesis from an import, or say precisely why not.
 *
 * The bar is `worstBucketVerdict`'s, unchanged: the worst bucket has to be separable from the
 * next-worst by two standard errors of the difference. A bucket that is merely the lowest of six
 * numbers is not a finding, and registering it would launder a coin flip into a pre-registration
 * -- which is worse than no bridge at all, because it would carry the authority of one.
 */
export function hypothesisFromImport(
  diagnostic: ImportDiagnostic,
  context: { registered_at: string; decisions_before: number; games: number },
): PreregOutcome {
  const verdict = worstBucketVerdict(diagnostic);
  if (!verdict) return { kind: "nothing-readable" };
  if (!verdict.runnerUp) {
    // Nothing to be worse than. Reported as its own thing rather than as a separation of zero.
    return { kind: "only-one-readable", worstKey: verdict.worst.key };
  }
  if (!verdict.separable) {
    return {
      kind: "not-separable",
      worstKey: verdict.worst.key,
      separation: verdict.separation,
      threshold: verdict.threshold,
    };
  }
  if (!isRegistrableBucket(verdict.worst.key)) {
    return { kind: "not-registrable", worstKey: verdict.worst.key };
  }

  return {
    kind: "registered",
    hypothesis: {
      bucket_key: verdict.worst.key,
      scope: verdict.worst.scope,
      registered_at: context.registered_at,
      decisions_before: context.decisions_before,
      evidence: {
        accurate_rate: verdict.worst.accurateRate,
        n: verdict.worst.n,
        runner_up_key: verdict.runnerUp.key,
        separation: verdict.separation,
        threshold: verdict.threshold,
        games: context.games,
      },
      refutation_condition: refutationFor(verdict.worst.scope),
    },
  };
}

/**
 * What would refute the registration itself, as opposed to the claim it may later produce.
 *
 * Deliberately about the SEARCH and not about the player: the import said this is where to look,
 * and it is refuted if looking there finds nothing once enough live decisions exist. Saying
 * anything about direction here would be the import claiming knowledge of a confidence nobody
 * ever stated.
 */
export function refutationFor(scope: string): string {
  return (
    `המשחקים המיובאים הצביעו על ${scope} כמקום לבדוק בו — לא על מה שיימצא שם. ` +
    `אם ייאספו מספיק החלטות חיות בסוג הזה ולא יימצא בו פער כיול שחורג מהסף, ההשערה הופרכה, ` +
    `והחיפוש חוזר לשישה הסוגים.`
  );
}

/**
 * Is this hypothesis eligible to narrow the search right now?
 *
 * False when the record has not grown since registration. A hypothesis with nothing recorded
 * after it is not yet wrong -- it is untested -- and letting it narrow the search on the very
 * decisions that produced it is the failure this module exists to prevent.
 */
export function isTestable(
  hypothesis: PreregisteredHypothesis,
  totalDecisionsNow: number,
): boolean {
  return (
    isRegistrableBucket(hypothesis.bucket_key) && totalDecisionsNow > hypothesis.decisions_before
  );
}

/**
 * The path an imported reading is allowed to travel, and how far it has actually come.
 *
 * WHY THIS IS A TYPE AND NOT A SENTENCE ON A SCREEN. An import measures accuracy over games that
 * are already over. It cannot measure a calibration gap -- nobody was asked how sure they were --
 * so it can never produce a finding about the player. What it can do is NAME A PLACE TO LOOK, and
 * everything that makes that naming worth anything happens afterwards and elsewhere: registering
 * it before the data exist, collecting decisions that carry a stated confidence, and testing the
 * bucket on those and not on the ones that suggested it.
 *
 * A screen that shows the reading and stops invites the reading to be the answer. This makes the
 * remaining stages part of what is on screen, including the ones this screen cannot reach.
 */
export const IMPORT_PIPELINE = [
  { key: "measured", label: "המשחקים נמדדו" },
  { key: "candidate", label: "נמצא מועמד לבדיקה" },
  { key: "registered", label: "נרשם מראש" },
  { key: "collecting", label: "נאספות החלטות חדשות עם ביטחון מוצהר" },
  { key: "tested", label: "ההשערה שוחזרה, הופרכה או לא הוכרעה" },
] as const;

export type ImportStageKey = (typeof IMPORT_PIPELINE)[number]["key"];

export interface ImportProgress {
  /** The last stage actually reached. */
  reached: ImportStageKey;
  /**
   * The stage this reading cannot get past, and why -- or null when nothing is blocking it.
   *
   * A blocked pipeline is not a pipeline waiting. `not-separable` is a finding: these games cannot
   * tell the buckets apart, and more of the same games is the remedy only if the gap is real.
   */
  blockedReason: string | null;
}

/**
 * How far this import got, from the outcome the bridge already computed.
 *
 * `registered` is the caller's: the bridge knows whether a hypothesis is on record, and this module
 * must not guess it from an outcome that describes only what the import saw.
 */
export function importProgress(outcome: PreregOutcome, registered: boolean): ImportProgress {
  if (registered) return { reached: "collecting", blockedReason: null };
  switch (outcome.kind) {
    case "registered":
      return { reached: "candidate", blockedReason: null };
    case "nothing-readable":
      return {
        reached: "measured",
        blockedReason: "אף סוג לא הגיע למספר ההחלטות שנדרש כדי לקרוא אותו.",
      };
    case "only-one-readable":
      return {
        reached: "measured",
        blockedReason: "רק סוג אחד נקרא, ושיעור לבדו אינו השוואה.",
      };
    case "not-separable":
      return {
        reached: "measured",
        blockedReason: "הסוגים קרובים זה לזה יותר מטעות הדגימה שלהם, ולכן אין מועמד לבחור בו.",
      };
    case "not-registrable":
      return {
        reached: "candidate",
        blockedReason: "הסוג הנמוך ביותר נקרא רק ממשחקים שנגמרו, ואין לו מקבילה בלולאה החיה.",
      };
  }
}
