/**
 * Positive control for the rollback rehearsal: the SHA binding must go red on a mismatch.
 *
 * `docs/ROLLBACK.md` says a rollback is closed by a green L6 run with `DEPLOYED_SHA` set to the
 * commit that was rolled back TO. That sentence is only worth something if the run goes red when
 * the origin serves a different commit -- which is exactly what a rollback that did not take looks
 * like: the dashboard says "rolled back", the alias still points at the bad build.
 *
 * The predicate is pure, so this needs no origin. An identity naming one commit is checked
 * against another and MUST fail. EXPECTED TO FAIL. `vitest.controls.config.ts` collects it;
 * `npm test` does not.
 */
import { describe, expect, it } from "vitest";
import { servesExpectedBuild } from "../../deployment/origin";

describe("the SHA binding, handed an origin serving a different commit", () => {
  it("refuses an identity that does not name the commit the rollback was to", () => {
    const served = servesExpectedBuild(
      {
        gitSha: "c848f244d380e13a8622c590791b22a2bef7a39b",
        target: "production",
        protocolVersion: "1.0.0",
        builtAt: "2026-09-01T00:00:00.000Z",
      },
      "dd708a8d9c5e0f1a2b3c4d5e6f708192a3b4c5d6",
    );
    expect(
      served.ok ? "" : served.problem,
      "the SHA binding accepted a mismatch, so a failed rollback would report as a successful one",
    ).toBe("");
  });
});
