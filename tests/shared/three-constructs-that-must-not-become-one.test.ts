/**
 * The three separations the learning journey exists to hold, held from both sides.
 *
 * Each of these has a plausible, tidy, wrong version that a reasonable person would ship, and each
 * test names it. A design whose only defence is a comment is a design that loses the argument the
 * first time somebody wants a single number that goes up.
 */
import { describe, expect, it } from "vitest";
import {
  JOURNEY_STAGES,
  UNPROMPTED_FLOOR,
  recordJourney,
  ruleJourney,
  type RuleJourneyInputs,
} from "@shared/learning-journey";
import { MIN_BUCKET_N } from "@shared/detector";
import { TRANSFER_POSITION_COUNT } from "@shared/learning-record";
import { GOAL_MAX_LENGTH, normaliseGoal } from "@shared/goal";

const RULE = (over: Partial<RuleJourneyInputs> = {}): RuleJourneyInputs => ({
  rule: { grade: "hypothesis", retrieval_step: 0, created_at: "2026-09-01T00:00:00.000Z" },
  drill: null,
  promptedSittings: null,
  inScope: null,
  ...over,
});

describe("guided practice, prompted recall and unprompted play are three constructs", () => {
  it("gives each stage a different construct, and no two stages share a number", () => {
    const practised = ruleJourney(RULE({ drill: { completed: 8, total: 8 } }));
    const prompted = ruleJourney(RULE({ promptedSittings: 2 }));
    const watched = ruleJourney(
      RULE({ promptedSittings: 2, inScope: { before: 40, after: 40 } }),
    );

    expect(practised.stage).toBe("PRACTISED");
    expect(prompted.stage).toBe("PROMPTED_CHECK");
    expect(watched.stage).toBe("WATCHED_IN_PLAY");

    const constructs = [practised, prompted, watched].map((r) => r.count.construct);
    expect(new Set(constructs).size, "two stages describe their number the same way").toBe(3);
  });

  it("ranks unprompted play above a prompted pass, because it is the harder question", () => {
    /*
     * THE ORDER IS THE CLAIM. A rule that passed its retrieval test AND has been watched in
     * ordinary play is further along than one that only passed the test: the test says what the
     * player CAN do when reminded, ordinary play says what they DO when nobody reminds them.
     * Reading them the other way round lets a prompted pass stand as the last word, which is
     * exactly what every product in this category does.
     */
    const both = ruleJourney(
      RULE({ promptedSittings: 3, inScope: { before: 50, after: 50 } }),
    );
    expect(both.stage).toBe("WATCHED_IN_PLAY");
  });

  it("says the prompted check does not speak for ordinary play", () => {
    const prompted = ruleJourney(RULE({ promptedSittings: 1 }));
    expect(prompted.notEstablished).toContain("לא מה קורה במשחק רגיל");
  });

  it("counts prompted SITTINGS, never positions passed", () => {
    /*
     * THE CONSTRUCT ERROR THIS TEST EXISTS FOR, and it was made once in this file's own adapter.
     * `retrieval_step` is an index into the retrieval schedule -- `gradeLearningRule` advances it on
     * every completed sitting, pass or fail -- so rendering it as "2 of 3 positions passed" is a
     * number about the calendar wearing the label of a number about performance.
     */
    const prompted = ruleJourney(RULE({ promptedSittings: 2 }));
    expect(prompted.count.n).toBe(2);
    expect(
      prompted.count.of,
      "a denominator here would make the sittings look like a score out of something",
    ).toBeNull();
    expect(prompted.count.construct).toContain("בדיקות");
    expect(prompted.count.construct).toContain(String(TRANSFER_POSITION_COUNT));
    expect(prompted.notEstablished).toContain("לא כמה מהן עברו");
  });

  it("will not read unprompted play until both sides of the line clear the floor", () => {
    const shallow = ruleJourney(
      RULE({ promptedSittings: 1, inScope: { before: UNPROMPTED_FLOOR - 1, after: 500 } }),
    );
    expect(shallow.stage, "a huge 'after' cannot buy a missing 'before'").toBe("PROMPTED_CHECK");
    expect(shallow.next).toContain("בצד הדל");
  });

  it("reuses the record's own floor rather than inventing a second one", () => {
    expect(UNPROMPTED_FLOOR).toBe(MIN_BUCKET_N);
  });

  it("refuses to attribute any before/after difference to the rule", () => {
    const watched = ruleJourney(RULE({ inScope: { before: 60, after: 60 } }));
    expect(watched.notEstablished).toContain("לא מיוחס לכלל");
  });
});

describe("the instrument's silence is not the player's flatness", () => {
  it("scopes 'nothing was found' to the detector, and says how many things it looked at", () => {
    const nothing = recordJourney({ scored: MIN_BUCKET_N * 2, hasClaim: false, othersWithheld: 0, readElsewhere: 0 });
    expect(nothing.stage).toBe("NOTHING_SEPARATED");
    expect(nothing.question, "the question is about the instrument").toContain("המכשיר");
    expect(nothing.notEstablished).toContain("לא אומר שאין מה למצוא בכם");
  });

  it("separates 'below the floor' from 'above it and nothing separated'", () => {
    const below = recordJourney({ scored: 10, hasClaim: false, othersWithheld: 0, readElsewhere: 0 });
    expect(below.stage).toBe("ACCUMULATING");
    expect(below.count.of, "the accumulating stage is the one stage with a real whole").toBe(
      MIN_BUCKET_N * 2,
    );
    expect(below.stage).not.toBe(
      recordJourney({ scored: MIN_BUCKET_N * 2, hasClaim: false, othersWithheld: 0, readElsewhere: 0 }).stage,
    );
  });

  it("names its count in the search's register, not the dashboard's", () => {
    /*
     * FOUND BY LOOKING AT A PHONE FRAME, NOT BY A TEST. The ledger read "0 of 60 measured
     * decisions" directly under a dashboard reading `n=1`, on a record holding one decision. Both
     * numbers were right and the two sentences shared a word. `scored` is what THIS SEARCH counts;
     * a bank answer is measured and is read elsewhere with its own denominator.
     */
    const split = recordJourney({ scored: 0, hasClaim: false, othersWithheld: 0, readElsewhere: 1 });
    expect(split.count.construct).toContain("שהחיפוש הזה סופר");
    expect(split.count.construct, "shares the dashboard's word for a different number").not.toContain(
      "מדודות",
    );
    expect(split.next, "the decision the search does not count is unaccounted for").toContain(
      "החלטה אחת",
    );
    expect(split.next).toContain("מכנה משלה");
  });

  it("agrees in number, because one decision is the first record every player has", () => {
    /* "1 החלטות" is not a sentence in Hebrew, and the one-decision case is the common one. */
    const one = recordJourney({ scored: 0, hasClaim: false, othersWithheld: 0, readElsewhere: 1 });
    const many = recordJourney({ scored: 0, hasClaim: false, othersWithheld: 0, readElsewhere: 4 });
    expect(one.next).toContain("החלטה אחת נמדדה");
    expect(one.next).not.toMatch(/\b1 החלטות/);
    expect(many.next).toContain("4 החלטות נמדדו");
  });

  it("says nothing about decisions read elsewhere when there are none", () => {
    const clean = recordJourney({ scored: 4, hasClaim: false, othersWithheld: 0, readElsewhere: 0 });
    expect(clean.next).not.toContain("בחלק אחר");
  });

  it("does not let a found claim claim to be about the player rather than the record", () => {
    const found = recordJourney({ scored: 120, hasClaim: true, othersWithheld: 2, readElsewhere: 0 });
    expect(found.stage).toBe("CANDIDATE");
    expect(found.notEstablished).toContain("לא אומרת שזה מה שמייחד אתכם");
    expect(found.next, "withheld candidates are counted rather than dropped").toContain("2");
  });
});

describe("a goal is not a state and not a denominator", () => {
  it("is absent from the stage vocabulary entirely", () => {
    expect(JOURNEY_STAGES).not.toContain("GOAL");
    expect(JOURNEY_STAGES).not.toContain("OUTCOME");
  });

  it("keeps the player's own words and never parses a number out of them", () => {
    expect(normaliseGoal("  אני 1500   ורוצה 1800 ")).toBe("אני 1500 ורוצה 1800");
    expect(normaliseGoal("   ")).toBeNull();
    expect(normaliseGoal("x".repeat(GOAL_MAX_LENGTH + 50))).toHaveLength(GOAL_MAX_LENGTH);
  });
});

describe("terminals are results, not failures to advance", () => {
  it("keeps a refuted rule and says the refutation was of the wording", () => {
    const refuted = ruleJourney(
      RULE({ rule: { grade: "refuted", retrieval_step: 2, created_at: "2026-09-01T00:00:00.000Z" } }),
    );
    expect(refuted.stage).toBe("REFUTED");
    expect(refuted.notEstablished).toContain("לא אומרת שהתיאור של הבעיה היה שגוי");
  });

  it("marks a retired rule as the player's act and not a measurement", () => {
    const retired = ruleJourney(
      RULE({
        rule: { grade: "retired", retrieval_step: 4, created_at: "2026-09-01T00:00:00.000Z" },
        inScope: { before: 90, after: 90 },
      }),
    );
    expect(retired.stage, "a retired rule is closed whatever else the record holds").toBe("RETIRED");
    expect(retired.notEstablished).toContain("החלטה שלכם");
  });
});

describe("every reading carries what it does not establish", () => {
  it("never returns a stage with an empty limit or an unnamed construct", () => {
    const readings = [
      recordJourney({ scored: 0, hasClaim: false, othersWithheld: 0, readElsewhere: 0 }),
      recordJourney({ scored: 200, hasClaim: false, othersWithheld: 0, readElsewhere: 0 }),
      recordJourney({ scored: 200, hasClaim: true, othersWithheld: 0, readElsewhere: 0 }),
      ruleJourney(RULE()),
      ruleJourney(RULE({ drill: { completed: 1, total: 8 } })),
      ruleJourney(RULE({ promptedSittings: 1 })),
      ruleJourney(RULE({ inScope: { before: 40, after: 40 } })),
    ];
    for (const reading of readings) {
      expect(reading.notEstablished.length, `${reading.stage} has no stated limit`).toBeGreaterThan(0);
      expect(reading.count.construct.length, `${reading.stage} has a bare number`).toBeGreaterThan(0);
      expect(reading.next.length, `${reading.stage} says nothing about what happens next`).toBeGreaterThan(0);
    }
  });
});
