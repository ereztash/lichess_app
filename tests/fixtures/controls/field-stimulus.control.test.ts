/**
 * Positive control for the FIELD freeze: once participants have run, a moved stimulus must go red.
 *
 * THE WHOLE VALUE OF THE ESCALATION IS THAT IT ESCALATES. `scripts/field-stimulus.ts` downgrades a
 * moved digest to a WARN while the run is `open` with zero participants, because production tracks
 * `main` and a check that is red on every merge is a check the moderator learns to override. That
 * leniency is worth having only if the same reading is a FAIL the moment a session has run against
 * the registered digest -- otherwise the protocol's *"after the first session it would be one, and
 * the same change would have to wait"* is enforced by nothing, exactly as it was before.
 *
 * So: a frozen registration, one participant run, and an origin serving a different stimulus. The
 * verdict MUST be `fail`. If it ever answers `warn` here, a session runs against a build nobody
 * registered and the record does not say so. EXPECTED TO FAIL. `vitest.controls.config.ts`
 * collects it; `npm test` does not.
 */
import { describe, expect, it } from "vitest";
import { stimulusVerdict, type RegisteredStimulus } from "../../../scripts/field-stimulus";

const hex = (seed: string, length: number): string => seed.repeat(length).slice(0, length);

const FROZEN: RegisteredStimulus = {
  registrationVersion: 1,
  state: "frozen",
  participantsRun: 1,
  origin: "https://lichessapp.vercel.app",
  stimulus_sha256: hex("a", 64),
  gitSha: hex("b", 40),
  files: 40,
  bytes: 8865024,
  storage: "not-configured",
  registeredAt: "2026-09-14T06:12:00Z",
  protocol: "research/player-path/FIELD_RUN_CURRENT.md",
};

describe("the freeze, after a participant has run against it", () => {
  it("refuses an origin serving a stimulus that is not the registered one", () => {
    const verdict = stimulusVerdict(FROZEN, {
      reachable: true,
      // Everything a lenient reading would call fine: the page loads, the manifest is well formed,
      // storage is the registered model. Only the digest moved, which is the whole subject.
      manifestDigest: hex("c", 64),
      manifestProblem: null,
      storage: "not-configured",
      gitSha: hex("d", 40),
    });

    expect(
      verdict.severity,
      "a moved stimulus was downgraded to a warning after a participant had already run against " +
        "the registered one, so the freeze is enforced by nobody",
    ).not.toBe("fail");
  });
});
