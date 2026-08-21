/**
 * Regression guard for section 1: "Do not add a single new procedure until there is one router."
 *
 * api/[...path].ts previously carried its own initTRPC instance, its own router, and its own
 * copy of every Lichess helper. Nothing stopped the two from drifting, and they did.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const apiEntry = readFileSync(resolve(repoRoot, "api/[...path].ts"), "utf8");

describe("there is exactly one router", () => {
  it("the serverless entry defines no tRPC primitives of its own", () => {
    for (const forbidden of ["initTRPC", "t.router", "publicProcedure", "protectedProcedure"]) {
      expect(apiEntry, `api entry must not define ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("the serverless entry defines no Lichess helpers of its own", () => {
    for (const forbidden of ["lichess.org", "explorer.lichess.org", "LICHESS_API_TOKEN"]) {
      expect(apiEntry, `api entry must not re-implement ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("the serverless entry is a thin re-export of the shared app", () => {
    expect(apiEntry).toContain("../server/app");
    // It was 250 lines. A thin entry has no room to drift.
    expect(apiEntry.trim().split("\n").length).toBeLessThanOrEqual(5);
  });
});
