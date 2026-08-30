/**
 * INV-10: a claim about the decision environment is validated on future timed games, never on a
 * static position.
 *
 * THE FAILURE THIS PREVENTS LOOKS LIKE EVIDENCE, which is what makes it worth a module. "Your
 * calibration slips under time pressure" tested by showing somebody a position with no clock
 * running removes the one condition the claim is about and then reports a verdict on it. The drill
 * runs, the numbers come out, the screen says confirmed or refuted -- and nothing was tested.
 */
import { describe, expect, it } from "vitest";
import {
  eligible,
  evaluateHoldout,
  excludedBecause,
  exclusionsFor,
  protocolFor,
  type HoldoutCandidate,
  type TimedHoldout,
} from "@shared/validation-protocol";

const THREE_ZERO = { initialMs: 180_000, incrementMs: 0 };

const HOLDOUT: TimedHoldout = {
  holdoutId: "h1",
  claimId: "c1",
  claimFrozenAt: "2026-08-30T12:00:00.000Z",
  eligibleProtocol: "instrumented-blitz",
  eligibleTimeControl: THREE_ZERO,
  targetN: 3,
  confirmAtOrAbove: 0.7,
  refuteAtOrBelow: 0.4,
};

const decision = (over: Partial<HoldoutCandidate> = {}): HoldoutCandidate => ({
  createdAt: "2026-08-30T13:00:00.000Z",
  measurementProtocol: "instrumented-blitz",
  timeControl: THREE_ZERO,
  inBucket: true,
  accurate: true,
  ...over,
});

describe("a clock claim a drill cannot test", () => {
  it("sends position claims to a drill and clock claims to a holdout", () => {
    for (const key of ["phase-opening", "phase-middlegame", "phase-endgame"]) {
      expect(protocolFor(key)).toBe("position-drill");
    }
    for (const key of ["standing-winning", "standing-level", "standing-losing"]) {
      expect(protocolFor(key), "a standing is the engine's verdict on a board, so it re-presents").toBe(
        "position-drill",
      );
    }
    for (const key of ["fast-under-45s", "slow-over-2m", "clock-under-1m"]) {
      expect(protocolFor(key), `${key} names a clock, and a clock is not a property of a board`).toBe(
        "timed-holdout",
      );
    }
  });

  it("refuses to guess for a bucket nobody has classified", () => {
    /*
     * A new bucket added without deciding how it can be validated is a bucket whose claims cannot
     * be validated. Saying so beats quietly testing a clock with a chessboard.
     */
    expect(protocolFor("phase-opening-but-only-on-tuesdays")).toBeNull();
  });

  describe("the boundary, which is a timestamp and not a decision count", () => {
    it("excludes a decision taken before the claim was frozen", () => {
      expect(excludedBecause(decision({ createdAt: "2026-08-30T11:59:59.999Z" }), HOLDOUT)).toBe(
        "before-the-claim-was-frozen",
      );
    });

    it("excludes a decision taken at the exact instant of the freeze", () => {
      /*
       * The strict inequality. A decision at the same millisecond is one of the decisions that
       * SUGGESTED the claim, and a claim tested on those is not a claim that was tested.
       */
      expect(excludedBecause(decision({ createdAt: HOLDOUT.claimFrozenAt }), HOLDOUT)).toBe(
        "before-the-claim-was-frozen",
      );
    });

    it("admits the very next millisecond", () => {
      expect(eligible(decision({ createdAt: "2026-08-30T12:00:00.001Z" }), HOLDOUT)).toBe(true);
    });

    it("is not moved by importing five hundred games", () => {
      /*
       * WHY A TIMESTAMP AND NOT A COUNT, in one assertion. The existing prospective machinery
       * slices by `decisions_before` -- rows as they stood at registration -- which is right for a
       * claim about positions and wrong for one about time: a player who imports five hundred games
       * moves a count-based boundary by five hundred without a second passing. These imports are
       * all dated BEFORE the freeze, and none of them counts.
       */
      const imported = Array.from({ length: 500 }, () =>
        decision({ createdAt: "2026-08-29T09:00:00.000Z", measurementProtocol: "historical-passive" }),
      );
      const future = [decision(), decision(), decision()];
      const verdict = evaluateHoldout([...imported, ...future], HOLDOUT);
      expect(verdict.n).toBe(3);
    });
  });

  it("refuses an imported game outright, whatever its date", () => {
    // A historical import carries no stated confidence and never can. It cannot satisfy any holdout.
    expect(excludedBecause(decision({ measurementProtocol: "historical-passive" }), HOLDOUT)).toBe(
      "wrong-protocol",
    );
    expect(excludedBecause(decision({ measurementProtocol: null }), HOLDOUT)).toBe("wrong-protocol");
  });

  it("refuses a different clock, because 3+0 and 5+5 are different environments", () => {
    expect(
      excludedBecause(decision({ timeControl: { initialMs: 300_000, incrementMs: 5_000 } }), HOLDOUT),
    ).toBe("wrong-time-control");
    // Even the same base with a different increment: at 3+2 a five-second move costs three seconds.
    expect(
      excludedBecause(decision({ timeControl: { initialMs: 180_000, incrementMs: 2_000 } }), HOLDOUT),
    ).toBe("wrong-time-control");
  });

  describe("the verdict, by the rule written down in advance", () => {
    it("refuses to answer below the target it promised", () => {
      /*
       * Reporting a rate on two decisions when three were promised is the stopping rule being
       * chosen after the fact, which is what a preregistered target exists to prevent.
       */
      const verdict = evaluateHoldout([decision(), decision()], HOLDOUT);
      expect(verdict).toEqual({ kind: "not-yet", n: 2, needed: 1 });
    });

    it("confirms, refutes and stays inconclusive at the boundaries it was given", () => {
      const acc = (n: number, ok: number) =>
        Array.from({ length: n }, (_, i) => decision({ accurate: i < ok }));
      expect(evaluateHoldout(acc(10, 7), HOLDOUT).kind).toBe("confirmed"); // 0.7, at the bound
      expect(evaluateHoldout(acc(10, 4), HOLDOUT).kind).toBe("refuted"); // 0.4, at the bound
      expect(evaluateHoldout(acc(10, 5), HOLDOUT).kind).toBe("inconclusive"); // between
    });

    it("has a real inconclusive verdict rather than collapsing to a coin flip", () => {
      // The control for the test above: if the two thresholds met, nothing could ever be
      // inconclusive, and every holdout would answer even when its evidence did not.
      expect(HOLDOUT.refuteAtOrBelow).toBeLessThan(HOLDOUT.confirmAtOrAbove);
    });
  });

  it("explains a shrinking denominator instead of only reporting it", () => {
    const mixed = [
      decision({ createdAt: "2026-01-01T00:00:00.000Z" }),
      decision({ measurementProtocol: "instrumented-standard" }),
      decision({ timeControl: { initialMs: 300_000, incrementMs: 0 } }),
      decision({ inBucket: false }),
      decision(),
    ];
    expect(exclusionsFor(mixed, HOLDOUT)).toEqual(
      expect.arrayContaining([
        { reason: "before-the-claim-was-frozen", n: 1 },
        { reason: "wrong-protocol", n: 1 },
        { reason: "wrong-time-control", n: 1 },
        { reason: "outside-the-bucket", n: 1 },
      ]),
    );
    expect(evaluateHoldout(mixed, HOLDOUT).n).toBe(1);
  });
});
