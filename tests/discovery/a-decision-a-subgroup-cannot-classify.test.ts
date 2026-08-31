/**
 * A DECISION MISSING THE FIELD A SUBGROUP READS BELONGS TO NEITHER SIDE OF THE COMPARISON.
 *
 * THIS IS NOT A NEW IDEA IN THIS REPOSITORY, IT IS AN INHERITED ONE. `bucketable` in
 * `shared/detector.ts` exists because putting an unreadable decision OUTSIDE the bucket turns
 * "we could not measure how long this took" into "this took more than 45 seconds" -- the same
 * fabrication pointing the other way, and it moves the baseline the subgroup is judged against.
 * `clock-under-1m` had exactly that shape from the start.
 *
 * A predicate a search produced has the same hazard with more surface: a conjunction can be false
 * on its first atom and unreadable on its second, and the tempting shortcut -- stop at the first
 * false -- files that decision in the comparison group. These tests are what stop that shortcut
 * from being taken by a later edit.
 */
import { describe, expect, it } from "vitest";
import {
  MAX_PREDICATE_DEPTH,
  canonicalPredicate,
  evaluatePredicate,
  predicateProblems,
  predicateText,
  splitByPredicate,
  type Predicate,
} from "@shared/discovery/predicate";

const fast: Predicate = { atoms: [{ feature_id: "secondsTaken", op: "lt", value: 45 }] };
const fastAndLowClock: Predicate = {
  atoms: [
    { feature_id: "secondsTaken", op: "lt", value: 45 },
    { feature_id: "clockMsRemaining", op: "lt", value: 60_000 },
  ],
};

describe("inside, outside, and cannot be read", () => {
  it("puts a decision inside when every atom holds", () => {
    expect(evaluatePredicate(fastAndLowClock, { secondsTaken: 12, clockMsRemaining: 30_000 })).toBe("inside");
  });

  it("puts a decision outside when an atom it CAN read is false", () => {
    expect(evaluatePredicate(fast, { secondsTaken: 90 })).toBe("outside");
  });

  it("refuses to classify a decision whose feature is absent", () => {
    expect(evaluatePredicate(fast, {})).toBe("unreadable");
  });

  it("refuses even when an earlier atom is already false -- unreadable wins over outside", () => {
    // The shortcut this forbids: `secondsTaken >= 45` is enough to answer "not inside", and a
    // short-circuit would return outside. But this decision could never have been inside OR
    // outside: nothing recorded its clock, so it is not part of this comparison at all.
    expect(evaluatePredicate(fastAndLowClock, { secondsTaken: 90 })).toBe("unreadable");
  });

  it("refuses a value of the wrong type rather than calling it false", () => {
    // A broken registry must not silently file every decision in the comparison group and let a
    // study run to a verdict on a column it never read.
    expect(evaluatePredicate(fast, { secondsTaken: "twelve" })).toBe("unreadable");
    expect(evaluatePredicate(fast, { secondsTaken: Number.NaN })).toBe("unreadable");
  });

  it("refuses a type mismatch on EQUALITY too, in both directions", () => {
    /*
     * The narrower version of the same defect, and it hid behind the numeric branch. `eq` returned
     * `value === bound` and `neq` its negation, so a numeric feature holding the STRING "12"
     * answered false to `= 12` and TRUE to `!= 12` -- landing outside an equality subgroup and
     * INSIDE an inequality one. Broken data contaminating both sides of the comparison, which is
     * exactly what the unreadable state exists to prevent.
     */
    const isTwelve: Predicate = { atoms: [{ feature_id: "secondsTaken", op: "eq", value: 12 }] };
    const isNotTwelve: Predicate = { atoms: [{ feature_id: "secondsTaken", op: "neq", value: 12 }] };
    expect(evaluatePredicate(isTwelve, { secondsTaken: "12" })).toBe("unreadable");
    expect(evaluatePredicate(isNotTwelve, { secondsTaken: "12" })).toBe("unreadable");
  });

  it("still compares two values of the same type, which is what a category feature needs", () => {
    // The type check cannot demand a number: `phase = "endgame"` is the ordinary use of `eq`.
    const endgame: Predicate = { atoms: [{ feature_id: "phase", op: "eq", value: "endgame" }] };
    expect(evaluatePredicate(endgame, { phase: "endgame" })).toBe("inside");
    expect(evaluatePredicate(endgame, { phase: "opening" })).toBe("outside");
    const notEndgame: Predicate = { atoms: [{ feature_id: "phase", op: "neq", value: "endgame" }] };
    expect(evaluatePredicate(notEndgame, { phase: "opening" })).toBe("inside");
    expect(evaluatePredicate(notEndgame, { phase: "endgame" })).toBe("outside");
  });

  it("lets absence itself be the subgroup", () => {
    const noClock: Predicate = { atoms: [{ feature_id: "clockMsRemaining", op: "is-null" }] };
    expect(evaluatePredicate(noClock, {})).toBe("inside");
    expect(evaluatePredicate(noClock, { clockMsRemaining: 1 })).toBe("outside");
  });

  it("returns the unreadable decisions rather than dropping them", () => {
    const rows = [
      { row: { secondsTaken: 12 }, subject: "in" },
      { row: { secondsTaken: 90 }, subject: "out" },
      { row: {}, subject: "unknown" },
    ];
    const split = splitByPredicate(fast, rows);
    expect(split).toEqual({ inside: ["in"], outside: ["out"], unreadable: ["unknown"] });
  });
});

describe("one subgroup, one canonical form", () => {
  it("orders the atoms of a conjunction the same way whichever order they arrive in", () => {
    const forwards = canonicalPredicate(fastAndLowClock);
    const backwards = canonicalPredicate({ atoms: [...fastAndLowClock.atoms].reverse() });
    expect(backwards).toEqual(forwards);
  });

  it("drops an exact duplicate atom, which is not a second condition", () => {
    const doubled: Predicate = { atoms: [...fast.atoms, ...fast.atoms] };
    expect(canonicalPredicate(doubled).atoms).toHaveLength(1);
  });

  it("keeps two atoms on one feature, which is a band and IS a second condition", () => {
    const band: Predicate = {
      atoms: [
        { feature_id: "clockShare", op: "gt", value: 0.2 },
        { feature_id: "clockShare", op: "lt", value: 0.4 },
      ],
    };
    expect(canonicalPredicate(band).atoms).toHaveLength(2);
    expect(predicateProblems(band)).toEqual([]);
  });

  it("does not merge comparisons that describe the same integers but different numbers", () => {
    const strict: Predicate = { atoms: [{ feature_id: "n", op: "lt", value: 5 }] };
    const loose: Predicate = { atoms: [{ feature_id: "n", op: "lte", value: 4.999 }] };
    expect(canonicalPredicate(strict)).not.toEqual(canonicalPredicate(loose));
  });

  it("reads back as words a person can check", () => {
    expect(predicateText(fastAndLowClock)).toBe("clockMsRemaining < 60000 AND secondsTaken < 45");
  });
});

describe("predicates this project will not accept", () => {
  it("refuses a predicate with no atoms, which describes every decision", () => {
    expect(predicateProblems({ atoms: [] })).toContainEqual(expect.stringContaining("no atoms"));
  });

  it("refuses a conjunction deeper than the declared maximum", () => {
    const deep: Predicate = {
      atoms: [
        { feature_id: "a", op: "lt", value: 1 },
        { feature_id: "b", op: "lt", value: 1 },
        { feature_id: "c", op: "lt", value: 1 },
      ],
    };
    expect(deep.atoms.length).toBeGreaterThan(MAX_PREDICATE_DEPTH);
    expect(predicateProblems(deep)).toContainEqual(expect.stringContaining("exceeds the maximum"));
  });

  it("refuses a comparison with nothing to compare against", () => {
    expect(predicateProblems({ atoms: [{ feature_id: "a", op: "lt" }] })).toContainEqual(
      expect.stringContaining("needs a value"),
    );
  });

  it("refuses a null check that carries a value it cannot use", () => {
    expect(
      predicateProblems({ atoms: [{ feature_id: "a", op: "is-null", value: 1 }] }),
    ).toContainEqual(expect.stringContaining("takes no value"));
  });
});
