/**
 * WHEN A FEATURE WAS KNOWN, and why "which column is it in" is not the same question.
 *
 * THE DEFECT THIS IS BUILT AGAINST. A search over features finds whatever separates the target
 * best. If any feature carries information that did not exist when the decision was made, the
 * search finds THAT, every time, and the result is a claim that predicts the past. It looks
 * exactly like a real finding -- large effect, tight interval, replicates on any split of the same
 * data -- and it fails the first time it is asked about a decision that has not happened yet.
 *
 * WHY A LABEL IS NOT ENOUGH. The obvious design is a field on each feature saying
 * `PRE_DECISION | COMMIT | POST_GAME`, and it fails on the feature that is most likely to be
 * added next: a value that is legitimately available at decision time but is RECOMPUTED later
 * from better information. `shared/blitz-features.ts` already names one --
 * `playerRelativeThinkPercentile` needs a distribution, and a distribution fitted on the same
 * decisions being read "is leakage wearing a percentile". A label on the column cannot see that.
 * A timestamp on the OBSERVATION can.
 *
 * SO THE UNIT IS AN OBSERVATION, NOT A COLUMN, and the same idea has an implementation outside
 * this repository: a feature store's point-in-time join, where every row carries an event time and
 * a created time and a read at time T returns what was on record at T. Feast is the reference; the
 * logic is adopted, the dependency is not, because what is needed here is thirty lines and a rule
 * about who may call them.
 *
 * WHAT THIS MODULE IS NOT. It does not compute a feature, name one, or decide which are worth
 * searching. It decides what a reader is ALLOWED TO SEE, given when it is reading. Everything
 * else is `shared/discovery/predicate.ts` and the registry a study declares.
 */

/**
 * What a feature is for, and the one thing this distinction exists to make unexpressible.
 *
 * A TARGET may never appear in a predicate. `cp_loss`, and the accuracy derived from it, arrive
 * after the engine has spoken -- so a subgroup described by them is a subgroup described by its
 * own outcome, and the effect it "finds" is arithmetic. There is no threshold at which that
 * becomes a finding, so it is refused at the type level and again at runtime rather than
 * discouraged.
 *
 * VALIDATION_ONLY is a third thing and not a weaker predictor: a feature that may be used to
 * decide whether a decision belongs in a holdout -- its protocol, its time control -- but never
 * to describe a subgroup. `shared/validation-protocol.ts` already reads exactly these.
 */
export const FEATURE_ROLES = ["PREDICTOR", "TARGET", "VALIDATION_ONLY"] as const;
export type FeatureRole = (typeof FEATURE_ROLES)[number];

/**
 * How a feature's value came to exist. The class is carried because the classes must not mix in
 * one study without saying so -- a retrieved value and a model-derived one have different failure
 * modes and different provenance obligations.
 */
export const FEATURE_SOURCE_CLASSES = [
  /** Computed from the record by a pure function. Reproducible from stored inputs alone. */
  "DETERMINISTIC",
  /** Fetched from outside, at a moment, from a source with its own version. */
  "RETRIEVED",
  /** The output of a model. Pinned to a model version or it is not reproducible. */
  "MODEL_DERIVED",
  /** A person's label. */
  "HUMAN_LABELED",
] as const;
export type FeatureSourceClass = (typeof FEATURE_SOURCE_CLASSES)[number];

/**
 * ONE OBSERVATION OF ONE FEATURE ABOUT ONE DECISION.
 *
 * THE THREE TIMES ARE NOT REDUNDANT, and collapsing any two of them is how a feature store leaks.
 *
 *   event_time    when the thing being described happened -- the moment in the game
 *   observed_at   the earliest moment this value could have been read. THE CUTOFF READS THIS.
 *   created_at    when this row was written. Two rows may describe the same instant and disagree;
 *                 the later-written one is the correction, and it wins only among rows that were
 *                 already observable.
 *
 * A recomputation is therefore a NEW OBSERVATION with a LATER `observed_at`, and a reader
 * positioned before it cannot see it. That is the whole mechanism, and it is why the percentile
 * case above becomes expressible rather than merely warned about.
 */
export interface FeatureObservation<T = unknown> {
  feature_id: string;
  /** Which version of the formula produced this. A formula change is a different feature. */
  feature_version: number;
  subject_decision_id: string;
  /** ISO-8601. When the described thing happened. */
  event_time: string;
  /** ISO-8601. The earliest moment this value could have been read. */
  observed_at: string;
  /** ISO-8601. When this row was written. */
  created_at: string;
  source: string;
  source_version: string;
  value: T;
}

/** The decision a read is positioned at. Only the two fields a point-in-time read may consult. */
export interface FeatureSubject {
  decision_id: string;
  /**
   * The instant the decision was committed. THE CUTOFF, and it is the commit rather than the
   * reveal on purpose: everything between them -- the engine's verdict most of all -- is exactly
   * what a predictor may not contain.
   */
  commit_timestamp: string;
}

/**
 * THE POINT-IN-TIME READ. The only sanctioned way to get a feature's value for a decision.
 *
 * Returns null where nothing was observable in time, and null is a real answer: "this feature was
 * not available for this decision" is a fact about the decision, and a caller that substitutes a
 * default has invented a measurement. `shared/detector.ts` records what that costs -- an imported
 * first move with no derivable think time was written out as `0`, and every imported game then
 * contributed at least one fabricated decision to the bucket this product cares most about.
 *
 * LATEST BY `created_at` AMONG THE OBSERVABLE, which is the correction rule: of the rows that
 * could have been read by the cutoff, the most recently written one is the best available value.
 * Ties break on `observed_at` and then on the source, so the answer does not depend on array
 * order -- a read whose result depends on how a list happened to be assembled is not a read.
 */
export function featureAsOf<T>(
  subject: FeatureSubject,
  observations: readonly FeatureObservation<T>[],
): FeatureObservation<T> | null {
  let best: FeatureObservation<T> | null = null;
  for (const observation of observations) {
    if (observation.subject_decision_id !== subject.decision_id) continue;
    /*
     * THE INEQUALITY THAT IS THE WHOLE FILE. `<=` against the COMMIT timestamp.
     *
     * Widening it to the end of the game, or to the reveal, admits the engine's verdict and every
     * value recomputed from it. `tests/discovery/no-feature-from-the-future.test.ts` mutates this
     * one comparison and asserts the suite goes red; a contract nothing would notice the breaking
     * of is a comment.
     */
    if (observation.observed_at > subject.commit_timestamp) continue;
    if (best === null || wins(observation, best)) best = observation;
  }
  return best;
}

function wins(candidate: FeatureObservation, incumbent: FeatureObservation): boolean {
  if (candidate.created_at !== incumbent.created_at) return candidate.created_at > incumbent.created_at;
  if (candidate.observed_at !== incumbent.observed_at) return candidate.observed_at > incumbent.observed_at;
  if (candidate.source !== incumbent.source) return candidate.source > incumbent.source;
  return candidate.source_version > incumbent.source_version;
}

/**
 * What a feature is, declared once, before anything may search on it.
 *
 * THREE LAYERS, AND A FEATURE MAY SIT IN THE FIRST WITHOUT REACHING THE SECOND. Measured is what
 * the record carries. Discovery-eligible is what a search may READ. Validation-eligible is what a
 * holdout may CONDITION on. They are not nested by accident: `measurement_protocol` is
 * validation-eligible and must never be discovery-eligible, because a subgroup described by the
 * protocol it was collected under is a subgroup of one regime, which `shared/evidence-policy.ts`
 * already refuses to pool.
 *
 * BOTH FLAGS ARE REQUIRED RATHER THAN OPTIONAL, and that is the point of the type. A feature added
 * to the record must ANSWER the question "may this be searched on?" -- it cannot arrive at a
 * default and silently widen the search space, which is the failure `docs/blitz/ADR-002.md`
 * describes for a different axis: the recording happened, the wall did not exist.
 */
export interface FeatureSpec {
  id: string;
  version: number;
  type: "number" | "boolean" | "category";
  role: FeatureRole;
  source_class: FeatureSourceClass;
  /** How this feature's absence is to be read. Never "treat as zero". */
  missingness_policy: "exclude-decision" | "own-category" | "propagate-null";
  /** May a candidate search read this? */
  discovery_eligible: boolean;
  /** May a validation protocol condition on this? */
  validation_eligible: boolean;
  /**
   * How sure we are the name means what it says -- a property of the DEFINITION, not of the data.
   * `phase` is a documented heuristic over material and ply; "aggression index" is a construct.
   */
  semantic_confidence: "definitional" | "documented-heuristic" | "construct";
  /** Where the definition came from, and under what licence, when it came from outside. */
  license_origin: string;
  /**
   * What KIND of condition this feature names -- see `shared/discovery/claim-class.ts`.
   *
   * REQUIRED, AND NULLABLE RATHER THAN OPTIONAL. A feature whose kind nobody has decided makes
   * every claim that reads it `UNKNOWN`, and an `UNKNOWN` claim gets no verdict. That is the
   * intended consequence: the alternative is a claim about a condition this product cannot
   * reproduce, tested by the only protocol on the shelf, and graded terminally.
   */
  condition_kind: import("./claim-class.js").ConditionKind | null;
}

/**
 * The features a candidate search may read, and the two rules that are not the flag.
 *
 * A TARGET IS REFUSED EVEN WHEN THE FLAG SAYS OTHERWISE. The flag is a judgement somebody made;
 * the role is what the feature IS. A row that sets `discovery_eligible: true` on a target is a
 * mistake, and this returns the safe answer rather than the declared one. `refusals` says which
 * were dropped and why, because a search space that shrinks without explaining itself is how a
 * study stops being reproducible.
 */
export function searchableFeatures(registry: readonly FeatureSpec[]): {
  searchable: FeatureSpec[];
  refusals: { id: string; because: string }[];
} {
  const searchable: FeatureSpec[] = [];
  const refusals: { id: string; because: string }[] = [];
  for (const spec of registry) {
    if (spec.role === "TARGET") {
      refusals.push({ id: spec.id, because: "a target may never describe a subgroup" });
      continue;
    }
    if (spec.role === "VALIDATION_ONLY") {
      refusals.push({ id: spec.id, because: "validation-only: it decides eligibility, not membership" });
      continue;
    }
    if (!spec.discovery_eligible) {
      refusals.push({ id: spec.id, because: "measured, but not declared discovery-eligible" });
      continue;
    }
    searchable.push(spec);
  }
  return { searchable, refusals };
}

/** One decision's features, as of its own commit. The row a predicate is evaluated against. */
export type MaterialisedRow = Record<string, unknown>;

/**
 * Build the row for one decision, reading every feature at that decision's own cutoff.
 *
 * A MISSING FEATURE IS ABSENT FROM THE ROW, not present as null, and the difference is load
 * bearing: `evaluatePredicate` returns UNREADABLE for a feature the row does not carry, and
 * UNREADABLE keeps the decision out of BOTH sides of a comparison. A null in the row would be a
 * value, and a comparison against a value puts the decision on one side of the contrast.
 */
export function materialise(
  subject: FeatureSubject,
  registry: readonly FeatureSpec[],
  observations: readonly FeatureObservation[],
): MaterialisedRow {
  const row: MaterialisedRow = {};
  for (const spec of registry) {
    const observation = featureAsOf(subject, observations.filter((o) => o.feature_id === spec.id));
    if (observation === null) continue;
    /*
     * THE VERSION IS PART OF THE FEATURE'S IDENTITY. An observation written by an older formula
     * describes something with the same name and different arithmetic, and admitting it would
     * pool two quantities under one column -- the same failure `EVIDENCE_POLICY_VERSION` exists
     * to prevent one level up.
     */
    if (observation.feature_version !== spec.version) continue;
    row[spec.id] = observation.value;
  }
  return row;
}
