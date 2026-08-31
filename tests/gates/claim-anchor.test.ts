/**
 * GATE-CLAIM-ANCHOR -- a debt row may not claim more reality than its proof ever ran against.
 *
 * WHERE THIS CAME FROM. One wave shipped five defects that 246 green tests did not see, and not one
 * of the five was a wrong test: each was a test that looked at a faithful shadow of the thing and
 * was read as evidence about the thing. `tests/LEVELS.md` is the ladder and the five worked
 * examples; this is the part of it that runs.
 *
 * WHY A RATCHET. Seven rows are under-anchored today, four of them P0. A gate that failed on all
 * seven would be red the day it was written, with seven pieces of unplanned work between it and
 * green -- which is how a check gets deleted rather than met. So the count is held and may only go
 * down: a NEW P0 row proven only in jsdom fails this, and every gap closed lowers the number.
 */
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import {
  claimAnchors,
  findUnderAnchoredClaims,
  findUnreasonedOverrides,
  scanTests,
  UNDER_ANCHORED_CEILING,
} from "../../scripts/test-level-scan";

const root = resolve(__dirname, "../..");
const files = scanTests(root);

describe("GATE-CLAIM-ANCHOR", () => {
  it("has a suite to measure, so nothing here can pass vacuously", () => {
    expect(files.length).toBeGreaterThan(200);
    expect(new Set(files.map((f) => f.level)).size).toBeGreaterThan(3);
  });

  it("does not let the number of under-anchored claims grow", () => {
    const under = findUnderAnchoredClaims(claimAnchors(root, files));
    expect(
      under.length,
      `${under.length} rows claim more than their gate ran against: ` +
        `${under.map((u) => `${u.id}(${u.severity}, ${u.anchor ?? "none"})`).join(", ")}. ` +
        "Do not raise the ceiling -- anchor the claim, or argue the severity down.",
    ).toBeLessThanOrEqual(UNDER_ANCHORED_CEILING);
  });

  it("refuses a level override that states no reason", () => {
    /*
     * `@level L2` alone is a number pretending to be an argument, and the whole value of deriving
     * the level from a file's imports is lost the moment anyone may overrule it by asserting.
     */
    const bare = findUnreasonedOverrides(root);
    expect(
      bare,
      `these files claim a level with no reason: ${bare.map((b) => `${b.file}:${b.line}`).join(", ")}`,
    ).toEqual([]);
  });

  it("still finds every rung the repository actually has", () => {
    /*
     * THE DERIVATION'S OWN FAILURE MODE, pinned. Its first version missed all eleven browser tests,
     * because `tests/layout/browser.ts` owns the launch and no test file names playwright directly
     * -- so it reported zero L5 tests and a comfortable story. A derivation that silently stops
     * recognising a rung reports the same comfortable story again.
     */
    const counts = new Map<string, number>();
    for (const f of files) counts.set(f.level, (counts.get(f.level) ?? 0) + 1);
    expect(counts.get("L4") ?? 0, "no test runs against the real store any more").toBeGreaterThan(0);
    expect(counts.get("L5") ?? 0, "no test runs in a real browser any more").toBeGreaterThan(0);
  });
});
