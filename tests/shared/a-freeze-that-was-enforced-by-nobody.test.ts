/**
 * The rule that decides when a moved stimulus stops being bookkeeping.
 *
 * `FIELD_RUN_CURRENT.md` stated it in prose and nothing read it: *"Zero participants have run,
 * which is what makes this bookkeeping rather than a protocol violation. After the first session it
 * would be one, and the same change would have to wait."* Two re-freezes happened under that
 * sentence and both were legitimate. The third would not have been, had anybody run a session, and
 * the only thing standing between those two cases was somebody remembering the sentence.
 *
 * These tests hold `stimulusVerdict` to the escalation, to the three readings that are red in every
 * state, and to the one trap this host makes easy: a build with no manifest answers `200
 * text/html`, so "the request succeeded" is not evidence of anything.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  escalationNote,
  isRegisteredStimulus,
  registrationProblem,
  stimulusVerdict,
  REGISTERED_STIMULUS_PATH,
  type ObservedOrigin,
  type RegisteredStimulus,
} from "../../scripts/field-stimulus";

const hex = (seed: string, length: number): string => seed.repeat(length).slice(0, length);
const REGISTERED = hex("a", 64);
const MOVED = hex("c", 64);

const OPEN: RegisteredStimulus = {
  registrationVersion: 1,
  state: "open",
  participantsRun: 0,
  origin: "https://lichessapp.vercel.app",
  stimulus_sha256: REGISTERED,
  gitSha: hex("b", 40),
  files: 40,
  bytes: 8865024,
  storage: "not-configured",
  registeredAt: "2026-09-14T06:12:00Z",
  protocol: "research/player-path/FIELD_RUN_CURRENT.md",
};

/** Everything correct. Each test moves exactly one reading, so the verdict names one cause. */
const GOOD: ObservedOrigin = {
  reachable: true,
  manifestDigest: REGISTERED,
  manifestProblem: null,
  storage: "not-configured",
  gitSha: OPEN.gitSha,
};

describe("a stimulus that moved", () => {
  it("is a warning while the run is open and no participant has run", () => {
    const verdict = stimulusVerdict(OPEN, { ...GOOD, manifestDigest: MOVED });
    expect(verdict.severity).toBe("warn");
    expect(verdict.lines.join("\n")).toContain("re-point");
  });

  it("is a failure once a participant has run against the registered digest", () => {
    const frozen = { ...OPEN, state: "frozen" as const, participantsRun: 1 };
    expect(stimulusVerdict(frozen, { ...GOOD, manifestDigest: MOVED }).severity).toBe("fail");
  });

  it("is a failure on a frozen run even before the first participant", () => {
    // FREEZING EARLY IS ALLOWED AND MEANS WHAT IT SAYS. The count is the fact that FORCES `frozen`;
    // declaring it sooner is the owner choosing to stop re-pointing, and the check obeys the
    // declaration rather than second-guessing it from the count.
    const frozen = { ...OPEN, state: "frozen" as const, participantsRun: 0 };
    expect(stimulusVerdict(frozen, { ...GOOD, manifestDigest: MOVED }).severity).toBe("fail");
  });

  it("passes when the origin serves exactly the registered digest", () => {
    expect(stimulusVerdict(OPEN, GOOD).severity).toBe("pass");
  });

  it("does not compare the whole digest by its first characters", () => {
    // THE BY-EYE FAILURE MODE, WRITTEN DOWN. A moderator comparing two 64-character strings checks
    // the ends and trusts the middle. A digest agreeing on both ends must still fail.
    const nearly = `${REGISTERED.slice(0, 20)}${hex("9", 24)}${REGISTERED.slice(44)}`;
    expect(nearly).not.toBe(REGISTERED);
    expect(nearly.slice(0, 12)).toBe(REGISTERED.slice(0, 12));
    const frozen = { ...OPEN, state: "frozen" as const, participantsRun: 1 };
    expect(stimulusVerdict(frozen, { ...GOOD, manifestDigest: nearly }).severity).toBe("fail");
  });
});

describe("what is red in every state, because none of it is ever bookkeeping", () => {
  it("fails when a build carries no manifest, even with the run wide open", () => {
    const verdict = stimulusVerdict(OPEN, {
      ...GOOD,
      manifestDigest: null,
      manifestProblem: "answered 200 as `text/html`, which is the SPA fallback",
    });
    expect(verdict.severity).toBe("fail");
    // The reported cause has to survive into the message: "no manifest" and "unreachable" have
    // different repairs, and the first version of the moderator's step conflated them.
    expect(verdict.lines.join("\n")).toContain("SPA fallback");
  });

  it("fails when the origin does not answer a signed-out visitor", () => {
    expect(stimulusVerdict(OPEN, { ...GOOD, reachable: false }).severity).toBe("fail");
  });

  it("fails when the storage model is not the one every walk was performed against", () => {
    const verdict = stimulusVerdict(OPEN, { ...GOOD, storage: "configured" });
    expect(verdict.severity).toBe("fail");
    expect(verdict.lines.join("\n")).toContain("no deployment");
  });

  it("fails when health reports no storage at all", () => {
    expect(stimulusVerdict(OPEN, { ...GOOD, storage: null }).severity).toBe("fail");
  });
});

describe("the git sha beside the digest", () => {
  it("is reported and never asserted, because a docs-only commit moves it and not the build", () => {
    const verdict = stimulusVerdict(OPEN, { ...GOOD, gitSha: hex("e", 40) });
    expect(verdict.severity).toBe("pass");
    expect(verdict.lines.join("\n")).toContain("Reported, not asserted");
  });
});

describe("a registration that contradicts itself", () => {
  it("is refused when it claims to be open with participants already run", () => {
    const contradictory = { ...OPEN, participantsRun: 2 };
    expect(registrationProblem(contradictory) ?? "").not.toBe("");
    expect(stimulusVerdict(contradictory, GOOD).severity).toBe("fail");
  });

  it("is accepted in every combination the protocol permits", () => {
    expect(registrationProblem(OPEN)).toBeNull();
    expect(registrationProblem({ ...OPEN, state: "frozen", participantsRun: 0 })).toBeNull();
    expect(registrationProblem({ ...OPEN, state: "frozen", participantsRun: 3 })).toBeNull();
  });
});

describe("the registration in the tree", () => {
  const registration: unknown = JSON.parse(
    readFileSync(resolve(__dirname, "../..", REGISTERED_STIMULUS_PATH), "utf8"),
  );

  it("is a registration this code can read", () => {
    expect(isRegisteredStimulus(registration)).toBe(true);
  });

  it("is internally coherent", () => {
    expect(isRegisteredStimulus(registration)).toBe(true);
    expect(registrationProblem(registration as RegisteredStimulus) ?? "").toBe("");
  });

  it("says in one sentence what a moved stimulus would currently do", () => {
    // THE OUTPUT IS THE INTERFACE. A moderator reading a WARN has to be able to tell, without
    // opening this file, whether the leniency applies to their session.
    expect(escalationNote(registration as RegisteredStimulus)).toContain("participant");
  });
});
