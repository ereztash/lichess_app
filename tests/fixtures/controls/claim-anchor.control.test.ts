/**
 * POSITIVE CONTROL for GATE-CLAIM-ANCHOR. Expected to FAIL.
 *
 * The predicate is the gate's own, run over `tests/fixtures/anchors` -- a repository in miniature
 * holding a P0 row proven at L1 and a level asserted with no reason behind it.
 */
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import {
  claimAnchors,
  findUnderAnchoredClaims,
  findUnreasonedOverrides,
  scanTests,
} from "../../../scripts/test-level-scan";

const root = resolve(__dirname, "../anchors");

describe("GATE-CLAIM-ANCHOR control", () => {
  it("notices a P0 claim whose proof never met a runtime", () => {
    const under = findUnderAnchoredClaims(claimAnchors(root, scanTests(root)));
    expect(
      under.length,
      `under-anchored: ${under.map((u) => `${u.id}(${u.severity}, ${u.anchor})`).join(", ")}`,
    ).toBe(0);
  });

  it("notices a level asserted with no reason", () => {
    expect(findUnreasonedOverrides(root)).toEqual([]);
  });
});
