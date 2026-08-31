/**
 * A FEATURE MAY NOT CARRY INFORMATION THAT DID NOT EXIST WHEN THE DECISION WAS MADE.
 *
 * THE FAILURE THIS PREVENTS IS INVISIBLE FROM THE INSIDE. A leaked feature produces a large
 * effect, a tight interval, and replication on every split of the same data. It fails only on a
 * decision that has not happened yet -- which is the one place a product like this makes its
 * promise. So the test cannot be "does the number look right"; it has to be "what was the reader
 * allowed to see, and when".
 *
 * THE MUTATION SECTION AT THE BOTTOM IS THE POINT OF THE FILE. `featureAsOf` is thirty lines and
 * one comparison, and a contract nothing would notice the breaking of is a comment. Those cases
 * apply the two mutations that matter -- widening the cutoff to the end of the game, and dropping
 * the observability filter entirely -- and assert that the visible answer changes. If a future
 * edit makes them pass, the guard has stopped guarding.
 */
import { describe, expect, it } from "vitest";
import {
  featureAsOf,
  materialise,
  searchableFeatures,
  type FeatureObservation,
  type FeatureSpec,
  type FeatureSubject,
} from "@shared/discovery/feature-contract";

const DECISION: FeatureSubject = {
  decision_id: "d1",
  commit_timestamp: "2026-08-30T12:10:00.000Z",
};

const observation = (over: Partial<FeatureObservation<number>> = {}): FeatureObservation<number> => ({
  feature_id: "clockShare",
  feature_version: 1,
  subject_decision_id: "d1",
  event_time: "2026-08-30T12:10:00.000Z",
  observed_at: "2026-08-30T12:10:00.000Z",
  created_at: "2026-08-30T12:10:00.000Z",
  source: "pgn-clock",
  source_version: "1",
  value: 0.42,
  ...over,
});

const spec = (over: Partial<FeatureSpec> = {}): FeatureSpec => ({
  id: "clockShare",
  version: 1,
  type: "number",
  role: "PREDICTOR",
  source_class: "DETERMINISTIC",
  missingness_policy: "exclude-decision",
  discovery_eligible: true,
  validation_eligible: false,
  semantic_confidence: "definitional",
  license_origin: "this repository",
  condition_kind: "ENVIRONMENT",
  ...over,
});

describe("what a decision was allowed to know about itself", () => {
  it("reads a value observable at the moment of commit", () => {
    expect(featureAsOf(DECISION, [observation()])?.value).toBe(0.42);
  });

  it("refuses a value that became observable one millisecond after commit", () => {
    const late = observation({ observed_at: "2026-08-30T12:10:00.001Z", value: 999 });
    expect(featureAsOf(DECISION, [late])).toBeNull();
  });

  it("returns null rather than a default when nothing was observable in time", () => {
    // A default here is the failure `shared/detector.ts` records: an imported first move with no
    // derivable think time was written out as 0 seconds, which satisfies `secondsTaken < 45`, so
    // every imported game contributed a fabricated decision to the bucket the product leads on.
    expect(featureAsOf(DECISION, [observation({ observed_at: "2026-08-30T13:00:00.000Z" })])).toBeNull();
  });

  it("prefers the most recently written of the observations that were observable", () => {
    const original = observation({ created_at: "2026-08-30T12:10:00.000Z", value: 0.42 });
    const correction = observation({ created_at: "2026-08-30T12:11:00.000Z", value: 0.44 });
    expect(featureAsOf(DECISION, [original, correction])?.value).toBe(0.44);
    // ...and the answer does not depend on the order the store happened to return them in.
    expect(featureAsOf(DECISION, [correction, original])?.value).toBe(0.44);
  });

  it("does not let a later correction smuggle in a later observation", () => {
    // The dangerous shape: a row WRITTEN later (so it wins the correction rule) that could only
    // have been OBSERVED later. The observability filter has to run first, and it does.
    const recomputed = observation({
      observed_at: "2026-08-30T20:00:00.000Z",
      created_at: "2026-08-30T20:00:00.000Z",
      value: 999,
    });
    expect(featureAsOf(DECISION, [observation(), recomputed])?.value).toBe(0.42);
  });

  it("ignores observations about a different decision", () => {
    expect(featureAsOf(DECISION, [observation({ subject_decision_id: "d2" })])).toBeNull();
  });

  it("keeps a feature out of the row when its formula version has moved on", () => {
    const registry = [spec({ version: 2 })];
    const row = materialise(DECISION, registry, [observation({ feature_version: 1 })]);
    expect(Object.prototype.hasOwnProperty.call(row, "clockShare")).toBe(false);
  });

  it("builds a row from the observable values only", () => {
    const registry = [spec(), spec({ id: "cpLoss", role: "TARGET", condition_kind: null })];
    const row = materialise(DECISION, registry, [
      observation(),
      observation({ feature_id: "cpLoss", observed_at: "2026-08-30T12:40:00.000Z", value: 130 }),
    ]);
    expect(row).toEqual({ clockShare: 0.42 });
  });
});

describe("which features a search may read at all", () => {
  it("refuses a target even when the registry declares it discovery-eligible", () => {
    const registry = [spec({ id: "cpLoss", role: "TARGET", discovery_eligible: true, condition_kind: null })];
    const { searchable, refusals } = searchableFeatures(registry);
    expect(searchable).toEqual([]);
    expect(refusals[0].because).toContain("target");
  });

  it("refuses a validation-only feature, which decides eligibility and never membership", () => {
    const registry = [spec({ id: "measurementProtocol", role: "VALIDATION_ONLY", discovery_eligible: true })];
    expect(searchableFeatures(registry).searchable).toEqual([]);
  });

  it("refuses a measured feature that was never declared discovery-eligible", () => {
    // The point of the flag: adding a column to the record must not widen the search space by
    // doing nothing. `docs/blitz/ADR-002.md` records the same failure on a different axis --
    // the recording happened, the wall did not exist.
    expect(searchableFeatures([spec({ discovery_eligible: false })]).searchable).toEqual([]);
  });

  it("names every refusal, so a search space that shrank can explain itself", () => {
    const registry = [spec(), spec({ id: "cpLoss", role: "TARGET", condition_kind: null })];
    const { searchable, refusals } = searchableFeatures(registry);
    expect(searchable.map((s) => s.id)).toEqual(["clockShare"]);
    expect(refusals.map((r) => r.id)).toEqual(["cpLoss"]);
  });
});

describe("the mutations this contract must not survive", () => {
  /*
   * Each case re-implements `featureAsOf` with ONE line changed, and asserts the answer is
   * different from the real one. That is what makes the real comparison load-bearing rather than
   * decorative: if a mutant ever agreed with the original, the original would be checking nothing.
   */
  const original = observation({ value: 0.42 });
  const afterCommit = observation({
    observed_at: "2026-08-30T12:40:00.000Z",
    created_at: "2026-08-30T12:40:00.000Z",
    value: 999,
  });
  const pool = [original, afterCommit];

  it("goes wrong if the cutoff moves from commit to the end of the game", () => {
    const END_OF_GAME = "2026-08-30T13:00:00.000Z";
    const mutant = pool
      .filter((o) => o.subject_decision_id === DECISION.decision_id && o.observed_at <= END_OF_GAME)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
    expect(mutant.value).toBe(999);
    expect(featureAsOf(DECISION, pool)?.value).toBe(0.42);
    expect(featureAsOf(DECISION, pool)?.value).not.toBe(mutant.value);
  });

  it("goes wrong if the observability filter is dropped entirely", () => {
    const mutant = pool
      .filter((o) => o.subject_decision_id === DECISION.decision_id)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
    expect(mutant.value).toBe(999);
    expect(featureAsOf(DECISION, pool)?.value).not.toBe(mutant.value);
  });

  it("goes wrong if `<=` becomes `<`, which would drop a value observed at the instant of commit", () => {
    const mutant = pool.filter(
      (o) => o.subject_decision_id === DECISION.decision_id && o.observed_at < DECISION.commit_timestamp,
    );
    // The exact-instant observation is the ordinary case -- the clock as the player faced it is
    // read at the moment they commit -- so a strict inequality loses nearly every real feature.
    expect(mutant).toEqual([]);
    expect(featureAsOf(DECISION, pool)).not.toBeNull();
  });
});
