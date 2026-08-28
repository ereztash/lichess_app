// @vitest-environment jsdom
/**
 * The Outcome Summary says what came out, and never more than the surface underneath it says.
 *
 * WHY THIS FILE IS ADVERSARIAL RATHER THAN DESCRIPTIVE. A summary is the single most dangerous
 * component in this product: its whole job is compression, and every failure mode of compression
 * here is an epistemic upgrade. A hypothesis that loses the word "השערה" becomes a finding. A
 * relative contrast that loses "ביחס ל...מאשר בשאר הרשומה" becomes "you are overconfident here". A
 * refuted claim that gets dropped for looking bad becomes a record with no failures in it. None of
 * those needs a wrong number -- each is a layout or a verb away.
 *
 * THE ACCEPTANCE RULE, MADE MACHINE-CHECKABLE. Every statement carries `source`, naming the module
 * entitled to say it, and one test below asserts no statement can be produced without one. That is
 * the difference between a projection and a second source of truth, and it is checkable rather
 * than aspirational.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { outcomeSummary, type OutcomeStatement } from "@/lib/outcome-summary";
import { OutcomeSummary } from "@/components/OutcomeSummary";
import { MIN_BUCKET_N } from "@shared/detector";
import { GRADE_WORD, type Claim, type ClaimGrade } from "@shared/claim";
import type { ClaimView } from "@shared/record-service";
import type { RecordReading } from "@shared/record-dashboard";

const FLOOR = MIN_BUCKET_N * 2;

/**
 * One drill that ran after the claim, with the decisions it was measured on.
 *
 * `decision_ids` carries real entries rather than a count, because that is what the claim carries
 * and the summary has to reduce over them. A fixture holding a bare number would let the code
 * under test read a field the repository does not have.
 */
const forwardTest = (decisions: number) =>
  ({
    kind: "prospective_drill_result",
    drill_id: `drill-${decisions}`,
    claim_id: "claim-phase-endgame",
    decision_ids: Array.from({ length: decisions }, (_, i) => `d${i}`),
    predicted: true,
    observed: true,
    recorded_at: "2026-01-01T00:00:00.000Z",
  }) as unknown as Claim["prospective_tests"][number];

const claimOf = (grade: ClaimGrade, tests: Claim["prospective_tests"] = []): Claim =>
  ({
    claim_id: "claim-phase-endgame",
    statement: "בהחלטות בסיום הביטחון המוצהר גבוה יותר ביחס לתוצאה מאשר בשאר הרשומה.",
    scope: "החלטות בסיום",
    supporting_decision_ids: [],
    n: 34,
    grade,
    refutation_condition: "אם לא יימצא פער כיול בסוג הזה — ההשערה הופרכה.",
    predicts_overconfidence: true,
    prospective_tests: tests,
  }) as unknown as Claim;

const view = (over: Partial<ClaimView> = {}): ClaimView => ({
  claim: null,
  othersWithheld: 0,
  reason: null,
  recorded: 0,
  scored: 0,
  prereg: null,
  preregScored: null,
  ...over,
});

/** Only the fields the summary reads. A whole reading would hide which ones those are. */
const reading = (over: Partial<RecordReading> = {}): RecordReading =>
  ({
    profile: { variables: { findings: [] }, crossing: { findings: [], tried: 0, measurable: 0 } },
    stability: { n: [0, 0], gap: [0, 0], difference: 0, standardError: null, spread: null },
    ...over,
  }) as unknown as RecordReading;

const finding = () => ({
  variable: { key: "phase", label: "שלב המשחק", levels: [] },
  strongest: {
    key: "phase-endgame",
    scope: "החלטות בסיום",
    gapDifference: 0.18,
    standardError: 0.05,
    inside: { n: 34 },
  },
  mirrored: [],
  alongside: [],
});

const textOf = (statements: OutcomeStatement[]) => statements.map((s) => s.text).join(" ");

describe("a thin record is given no conclusion", () => {
  it("renders nothing at all rather than an empty shell", () => {
    const { container } = render(<OutcomeSummary statements={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("produces no statements before the claim view has loaded", () => {
    expect(outcomeSummary({ claim: undefined, reading: undefined, claimUnreadable: false,
      readingUnreadable: false })).toEqual([]);
  });

  it("says what is missing, with the existing reason and the real distance", () => {
    const statements = outcomeSummary({
      claim: view({ scored: 12, reason: "הסף קיים כדי שלא נדווח על רעש." }),
      reading: reading(),
      claimUnreadable: false,
      readingUnreadable: false,
    });
    expect(statements[0].kind).toBe("insufficient");
    expect(statements[0].text).toContain("הסף קיים");
    // The distance comes from remainingBeforeClaim, not from a denominator invented here.
    expect(statements[0].basis).toContain(String(FLOOR - 12));
  });

  it("never calls a thin record a finding", () => {
    const statements = outcomeSummary({
      claim: view({ scored: 3, reason: "עוד אין מספיק." }),
      reading: reading(),
      claimUnreadable: false,
      readingUnreadable: false,
    });
    expect(statements.every((s) => s.gradeWord === null)).toBe(true);
    expect(textOf(statements)).not.toContain(GRADE_WORD.replicated.he);
  });
});

describe("a search that found nothing is an outcome, not an empty state", () => {
  const searched = () =>
    outcomeSummary({
      claim: view({
        scored: FLOOR + 5,
        reason: "הסף קיים כדי שלא נדווח על רעש: פער שנראה גדול בסוג קטן מצטמצם לאפס.",
      }),
      reading: reading(),
      claimUnreadable: false,
      readingUnreadable: false,
    });

  it("is told apart from still-waiting by the floor being met", () => {
    expect(searched()[0].kind).toBe("no-pattern");
  });

  it("does not turn absence of detection into proof of absence", () => {
    /*
     * "No pattern cleared the threshold" and "there is no pattern" are different claims, and the
     * second is not available from a threshold test. The wording must stay about the SEARCH.
     */
    const text = searched()[0].text + (searched()[0].basis ?? "");
    expect(text).toContain("סף");
    expect(text).not.toContain("אין לך");
    expect(text).not.toContain("אתה מכויל");
  });
});

describe("a hypothesis is never dressed as a finding", () => {
  const hypothesis = () =>
    outcomeSummary({
      claim: view({ claim: claimOf("hypothesis"), scored: FLOOR }),
      reading: reading(),
      claimUnreadable: false,
      readingUnreadable: false,
    });

  it("carries the hypothesis word and not the finding word", () => {
    expect(hypothesis()[0].kind).toBe("hypothesis");
    expect(hypothesis()[0].gradeWord).toBe(GRADE_WORD.hypothesis.he);
    expect(hypothesis()[0].gradeWord).not.toBe(GRADE_WORD.replicated.he);
  });

  it("renders as a different kind of thing from a tested claim, not merely different words", () => {
    /*
     * A badge that reads "השערה" inside markup identical to a replicated finding has been promoted
     * by layout. The kind reaches the DOM so the two can be styled and asserted apart.
     */
    const { container } = render(<OutcomeSummary statements={hypothesis()} />);
    expect(container.querySelector('[data-kind="hypothesis"]')).toBeTruthy();
    expect(container.querySelector('[data-kind="tested-claim"]')).toBeNull();
    expect(container.textContent).toContain(GRADE_WORD.hypothesis.he);
    expect(container.textContent).not.toContain(GRADE_WORD.replicated.he);
  });
});

describe("an existing grade is preserved exactly", () => {
  it("says replicated when the repository says replicated, and no more", () => {
    const statements = outcomeSummary({
      claim: view({ claim: claimOf("replicated", [forwardTest(8)]), scored: FLOOR }),
      reading: reading(),
      claimUnreadable: false,
      readingUnreadable: false,
    });
    expect(statements[0].kind).toBe("tested-claim");
    expect(statements[0].gradeWord).toBe(GRADE_WORD.replicated.he);
    // Not upgraded into a causal or absolute reading.
    expect(statements[0].text).not.toContain("הוכח");
    expect(statements[0].text).not.toContain("תמיד");
  });

  it("shows a refuted claim rather than quietly dropping it", () => {
    /*
     * THE FAILURE THIS EXISTS TO CATCH. A summary that surfaces "the strongest thing" has an
     * obvious incentive to skip the claim that failed -- and a record whose failures are invisible
     * is exactly the product this repository refuses to be. A refutation is a result.
     */
    const statements = outcomeSummary({
      claim: view({ claim: claimOf("refuted", [forwardTest(8)]), scored: FLOOR }),
      reading: reading(),
      claimUnreadable: false,
      readingUnreadable: false,
    });
    expect(statements[0].kind).toBe("tested-claim");
    expect(statements[0].gradeWord).toBe(GRADE_WORD.refuted.he);
    const { container } = render(<OutcomeSummary statements={statements} />);
    expect(container.textContent).toContain(GRADE_WORD.refuted.he);
  });

  it("takes the sentence from the claim rather than composing one", () => {
    const claim = claimOf("replicated", [forwardTest(8)]);
    const statements = outcomeSummary({
      claim: view({ claim, scored: FLOOR }),
      reading: reading(),
      claimUnreadable: false,
      readingUnreadable: false,
    });
    expect(statements[0].text).toBe(claim.statement);
  });
});

describe("a descriptive finding stays a description", () => {
  const described = () =>
    outcomeSummary({
      claim: view({ scored: FLOOR + 2, reason: "אין דפוס מעל הסף." }),
      reading: reading({
        profile: {
          variables: { findings: [finding()] },
          crossing: { findings: [], tried: 0, measurable: 0 },
        },
      } as unknown as Partial<RecordReading>),
      claimUnreadable: false,
      readingUnreadable: false,
    });

  it("is marked as a description of this record and carries no grade", () => {
    const description = described().find((s) => s.kind === "record-description");
    expect(description, "the profile finding never reached the summary").toBeTruthy();
    expect(description!.gradeWord).toBeNull();
    expect(description!.text).toContain("תיאור של הרשומה, לא טענה שנבדקה");
  });

  it("never outranks the claim state", () => {
    // Outcome first means the search result leads, and a description cannot be promoted past it.
    expect(described()[0].kind).not.toBe("record-description");
  });

  it("does not restate the contrast as an absolute diagnosis", () => {
    /*
     * The detector's quantity is `inside gap - outside gap`. "Your confidence sits higher relative
     * to the outcome here than elsewhere in your own record" is what that supports. "You are
     * overconfident in the endgame" is a different, stronger, unmeasured claim -- and so is every
     * label that implies it.
     */
    const text = described()
      .filter((s) => s.kind === "record-description")
      .map((s) => `${s.text} ${s.basis ?? ""}`)
      .join(" ");
    for (const forbidden of ["נקודה עיוורת", "חולשה", "בעיה", "אתה בטוח מדי", "ביטחון יתר"]) {
      expect(text, `the description reached for "${forbidden}"`).not.toContain(forbidden);
    }
  });
});

describe("stability is reported without a verdict", () => {
  const stable = () =>
    outcomeSummary({
      claim: view({ scored: FLOOR + 2, reason: "אין דפוס מעל הסף." }),
      reading: reading({
        stability: { n: [20, 20], gap: [0.1, 0.12], difference: 0.02, standardError: 0.04, spread: 0.5 },
      } as unknown as Partial<RecordReading>),
      claimUnreadable: false,
      readingUnreadable: false,
    });

  it("manufactures no pass, fail, stable or unstable", () => {
    const text = stable()
      .filter((s) => s.kind === "same-twice")
      .map((s) => s.text)
      .join(" ");
    expect(text).toBeTruthy();
    for (const forbidden of ["יציב", "לא יציב", "עבר", "נכשל", "אמין"]) {
      expect(text, `stability was given a verdict: "${forbidden}"`).not.toContain(forbidden);
    }
  });

  it("keeps the caveat that this is not a test across time", () => {
    const statement = stable().find((s) => s.kind === "same-twice")!;
    expect(statement.text).toContain("מבחן חוזר");
  });

  it("says nothing when the spread could not be computed", () => {
    const statements = outcomeSummary({
      claim: view({ scored: FLOOR + 2, reason: "אין דפוס מעל הסף." }),
      reading: reading(),
      claimUnreadable: false,
      readingUnreadable: false,
    });
    expect(statements.some((s) => s.kind === "same-twice")).toBe(false);
  });
});

describe("the summary is a projection and not a source of truth", () => {
  it("gives every statement the repository object entitled to say it", () => {
    /*
     * THE ACCEPTANCE RULE. If a sentence cannot name its author, the summary inferred it, and the
     * implementation is wrong. Asserted over every state rather than a sampled one.
     */
    const cases = [
      view({ scored: 5, reason: "עוד אין מספיק." }),
      view({ scored: FLOOR + 1, reason: "אין דפוס מעל הסף." }),
      view({ claim: claimOf("hypothesis"), scored: FLOOR }),
      view({ claim: claimOf("replicated"), scored: FLOOR }),
      view({ claim: claimOf("refuted"), scored: FLOOR }),
    ];
    for (const claim of cases) {
      const statements = outcomeSummary({
        claim,
        reading: reading({
          profile: {
            variables: { findings: [finding()] },
            crossing: { findings: [], tried: 0, measurable: 0 },
          },
          stability: { n: [20, 20], gap: [0.1, 0.12], difference: 0.02, standardError: 0.04, spread: 0.5 },
        } as unknown as Partial<RecordReading>),
        claimUnreadable: false,
      readingUnreadable: false,
      });
      expect(statements.length).toBeGreaterThan(0);
      for (const statement of statements) {
        expect(statement.source, `a statement with no author: "${statement.text}"`).toBeTruthy();
      }
    }
  });

  it("never exceeds three statements", () => {
    const statements = outcomeSummary({
      claim: view({ claim: claimOf("replicated"), scored: FLOOR }),
      reading: reading({
        profile: {
          variables: { findings: [finding(), finding()] },
          crossing: { findings: [], tried: 0, measurable: 0 },
        },
        stability: { n: [20, 20], gap: [0.1, 0.12], difference: 0.02, standardError: 0.04, spread: 0.5 },
      } as unknown as Partial<RecordReading>),
      claimUnreadable: false,
      readingUnreadable: false,
    });
    expect(statements.length).toBeLessThanOrEqual(3);
  });

  it("reports an unreadable record instead of rendering it as an empty one", () => {
    // R2: a record that could not be READ must not render as a record with nothing in it.
    const statements = outcomeSummary({
      claim: view({ scored: 0 }),
      reading: undefined,
      claimUnreadable: true,
      readingUnreadable: true,
    });
    expect(statements[0].kind).toBe("unreadable");
    expect(statements).toHaveLength(1);
  });
});

/**
 * THE STATE A FAILED QUERY IS ACTUALLY IN, which the test above never entered.
 *
 * It passed `unreadable: true` beside a `ClaimView` that existed -- a shape no failed query
 * produces. A query that errors has no `data`, so the real input is `claim: undefined` with the
 * error flag set, and against that input the summary returned nothing at all: it checked the
 * missing view first and never reached the flag. A broken record layer rendered exactly like a
 * brand-new one, which is the confusion the "unreadable" kind exists to prevent, produced by the
 * code meant to prevent it.
 */
describe("a query that failed is not a record with nothing in it", () => {
  it("says so when the claim query errored and left no data behind", () => {
    const statements = outcomeSummary({
      claim: undefined,
      reading: undefined,
      claimUnreadable: true,
      readingUnreadable: true,
    });
    expect(statements, "a failed claim query produced an empty summary").toHaveLength(1);
    expect(statements[0].kind).toBe("unreadable");
  });

  it("still says so when only the claim query failed and the reading loaded", () => {
    const statements = outcomeSummary({
      claim: undefined,
      reading: reading(),
      claimUnreadable: true,
      readingUnreadable: false,
    });
    expect(statements.map((s) => s.kind)).toEqual(["unreadable"]);
  });

  it("keeps a claim that loaded when it was the READING that failed", () => {
    /*
     * The other half of the split, and the regression a single folded flag would have caused. The
     * claim query succeeded; a failed reading says nothing about it, and silencing a graded claim
     * because a second query fell over would hide a result the record genuinely holds.
     */
    const statements = outcomeSummary({
      claim: view({ claim: claimOf("replicated", [forwardTest(8)]), scored: FLOOR }),
      reading: undefined,
      claimUnreadable: false,
      readingUnreadable: true,
    });
    expect(statements.map((s) => s.kind)).toEqual(["tested-claim"]);
    expect(statements[0].gradeWord).toBe(GRADE_WORD.replicated.he);
  });

  it("says nothing while the claim query is merely still loading", () => {
    // Not an error. A summary of a pending record is a guess, and R2 separates the two states.
    expect(
      outcomeSummary({
        claim: undefined,
        reading: undefined,
        claimUnreadable: false,
        readingUnreadable: false,
      }),
    ).toEqual([]);
  });
});

/**
 * WHAT BOUGHT THE GRADE, beneath the word that depends on it.
 *
 * `Claim.n` is the retrospective support the hypothesis was BUILT from. A grade moves only on a
 * `ProspectiveDrillResult` -- that is the repository's own rule, stated on the type -- so printing
 * `n` alone under "שוחזר" credits the word to evidence that could never have earned it. Neither
 * number is wrong; the compression is.
 */
describe("the basis names the evidence that actually bought the grade", () => {
  const basisOf = (grade: ClaimGrade, tests: Claim["prospective_tests"]) =>
    outcomeSummary({
      claim: view({ claim: claimOf(grade, tests), scored: FLOOR }),
      reading: reading(),
      claimUnreadable: false,
      readingUnreadable: true,
    })[0].basis;

  it("counts the forward tests and the decisions they were measured on", () => {
    const basis = basisOf("replicated", [forwardTest(8)]);
    expect(basis).toContain("34");
    expect(basis, "the forward test that earned the grade is missing").toContain("פעם אחת");
    expect(basis).toContain("8");
  });

  it("adds the decisions up across more than one drill", () => {
    const basis = basisOf("refuted", [forwardTest(8), forwardTest(5)]);
    expect(basis).toContain("2 פעמים");
    expect(basis, "the drills were counted but their decisions were not").toContain("13");
  });

  it("says only where a hypothesis came from, because nothing has tested it", () => {
    const basis = basisOf("hypothesis", []);
    expect(basis).toContain("34");
    expect(basis, "an untested hypothesis was given a forward-test line").not.toContain("נבדק קדימה");
  });

  it("does not read the retrospective count as the forward one", () => {
    /*
     * The compression this whole group exists to catch. With 34 supporting decisions and 8 drill
     * decisions, a basis that says "34" where it means the test would still look plausible.
     */
    const basis = basisOf("replicated", [forwardTest(8)]);
    const forward = basis!.slice(basis!.indexOf("נבדק קדימה"));
    expect(forward).not.toContain("34");
  });

  it("names the absence rather than printing a forward test that is not there", () => {
    // Unreachable through `evaluateClaim`, and R2 says a state that should not exist is named.
    const basis = basisOf("replicated", []);
    expect(basis).not.toContain("0 פעמים");
    expect(basis).toContain("לא נמצאת");
  });
});

/**
 * A REFUTATION AND A CONFIRMATION SHARE A KIND AND MUST NOT SHARE A WEIGHT.
 *
 * `tested-claim` covers both on purpose -- both are claims a forward test has graded -- but the
 * stylesheet had only `kind` to key on, so the rule whose own comment read "only a survived
 * forward test carries the strongest colour" applied to a refutation as well. The words differed
 * and the weight did not, which is promotion by layout with nobody writing a stronger sentence.
 */
describe("the grade reaches the styling, not only the wording", () => {
  const badge = (grade: ClaimGrade) => {
    const { container } = render(
      <OutcomeSummary
        statements={outcomeSummary({
          claim: view({ claim: claimOf(grade, [forwardTest(8)]), scored: FLOOR }),
          reading: reading(),
          claimUnreadable: false,
          readingUnreadable: true,
        })}
      />,
    );
    return container.querySelector(".outcome-summary__badge");
  };

  it("carries the repository's grade on the element, beside the shared kind", () => {
    expect(badge("replicated")?.getAttribute("data-kind")).toBe("tested-claim");
    expect(
      badge("replicated")?.getAttribute("data-grade"),
      "the two grades are indistinguishable to the stylesheet",
    ).toBe("replicated");
    expect(badge("refuted")?.getAttribute("data-grade")).toBe("refuted");
  });

  it("keeps the grade out of the statements that have none", () => {
    /*
     * A neutral grade word on a description would give it a badge it did not earn, and `null` is
     * what says the state has no grade rather than a quiet one.
     */
    const statements = outcomeSummary({
      claim: view({ scored: 4, reason: "עוד אין מספיק." }),
      reading: reading(),
      claimUnreadable: false,
      readingUnreadable: true,
    });
    expect(statements.every((s) => s.grade === null)).toBe(true);
    const { container } = render(<OutcomeSummary statements={statements} />);
    expect(container.querySelector(".outcome-summary__badge")?.hasAttribute("data-grade")).toBe(
      false,
    );
  });

  it("does not hand the strongest colour to a refutation", () => {
    /*
     * READ OFF THE STYLESHEET, because the defect was IN the stylesheet and nothing rendering the
     * component could see it. The rule's own comment said "only a survived forward test carries
     * the strongest colour", and the selector beside it was `[data-kind="tested-claim"]`, which
     * both grades carry. The comment was the specification and the selector contradicted it, so
     * the check has to be against the selector.
     */
    const css = readFileSync(resolve(__dirname, "../../client/src/index.css"), "utf8").replace(
      /\/\*[\s\S]*?\*\//g,
      "",
    );
    const rules = [...css.matchAll(/(\.outcome-summary__badge[^{]*)\{([^}]*)\}/g)].map(
      ([, selector, body]) => ({ selector: selector.trim(), body }),
    );
    const strongest = rules.filter((rule) => rule.body.includes("var(--chosen)"));
    expect(strongest.length, "nothing carries the strongest colour any more").toBeGreaterThan(0);
    for (const rule of strongest) {
      expect(rule.selector, "the strongest colour is not tied to a grade").toContain(
        '[data-grade="replicated"]',
      );
    }
    const refuted = rules.find((rule) => rule.selector.includes('[data-grade="refuted"]'));
    expect(refuted, "a refuted claim has no styling of its own").toBeDefined();
    expect(refuted!.body).not.toContain("var(--chosen)");
  });

  it("takes the grade from the claim rather than deriving it from the word", () => {
    const claim = claimOf("refuted", [forwardTest(8)]);
    const statements = outcomeSummary({
      claim: view({ claim, scored: FLOOR }),
      reading: reading(),
      claimUnreadable: false,
      readingUnreadable: true,
    });
    expect(statements[0].grade).toBe(claim.grade);
    expect(statements[0].gradeWord).toBe(GRADE_WORD[claim.grade].he);
  });
});

describe("the two evidence layers stay apart, and no action is duplicated", () => {
  it("takes no imported-game input at all", () => {
    /*
     * The wall is structural rather than stylistic: imported accuracy cannot appear beside
     * calibration language here because the function has no parameter through which it could
     * arrive. `OutcomeSummaryInput` is claim + reading + the two failure flags, and the reading is
     * the confidence-bearing one.
     */
    const input = {
      claim: view({ scored: 4, reason: "עוד אין מספיק." }),
      reading: reading(),
      claimUnreadable: false,
      readingUnreadable: false,
    };
    expect(Object.keys(input).sort()).toEqual([
      "claim",
      "claimUnreadable",
      "reading",
      "readingUnreadable",
    ]);
  });

  it("renders no button, link or control of its own", () => {
    /*
     * One door per question. `AnchorRunControl` owns the bank, `ClaimPanel` owns starting a drill,
     * the board owns recording. A summary that grew its own CTA because it would look decisive
     * there would be a second implementation of an action that already has an owner.
     */
    const { container } = render(
      <OutcomeSummary
        statements={outcomeSummary({
          claim: view({ claim: claimOf("hypothesis"), scored: FLOOR }),
          reading: reading(),
          claimUnreadable: false,
      readingUnreadable: false,
        })}
      />,
    );
    expect(container.querySelectorAll("button")).toHaveLength(0);
    expect(container.querySelectorAll("a")).toHaveLength(0);
    expect(container.querySelectorAll("input")).toHaveLength(0);
  });
});
