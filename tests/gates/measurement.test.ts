/**
 * GATE-MEASURE: a measurement that was never made must not change any number.
 *
 * The defect this exists for shipped in one line. `secondsSpentAt` returns null when a think time
 * cannot be derived -- the player's first move has no previous reading of their own clock -- and
 * the import path wrote `seconds ?? 0`. Zero is a measurement, and `0 < 45`, so every imported game
 * contributed at least one invented decision to "under 45 seconds": the bucket this product cares
 * most about, and the one it pre-registers a player's weakness from.
 *
 * The half that is easier to miss is the other side. `outside` is everything the predicate
 * rejected, so guarding the predicate alone moves the unmeasured decision into the COMPARISON SET
 * -- and the detector tests a bucket against exactly that set. `clock-under-1m` had that shape from
 * the beginning: its predicate always checked for null, so a decision with no clock was counted as
 * a decision made with over a minute left.
 *
 * Asserted against the production split, not a copy of it.
 */
import { describe, expect, it } from "vitest";
import { splitByBucket } from "@shared/detector";
import { membershipVerdict } from "../fixtures/measurement-scenario";

describe("GATE-MEASURE: an absent measurement changes no bucket", () => {
  it("leaves both the bucket and its comparison set untouched", () => {
    const verdict = membershipVerdict(splitByBucket);
    expect(verdict.ok, verdict.detail).toBe(true);
  });
});
