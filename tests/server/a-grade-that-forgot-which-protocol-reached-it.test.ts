/**
 * Every field a fold may change is a field its upsert has to write.
 *
 * THE DEFECT, WHICH IS ONE FIELD IN A `SET` CLAUSE. `evaluateClaim` changes three things about a
 * claim -- `grade`, `graded_under` and `last_evaluated_at` -- and `saveClaim`'s
 * `onDuplicateKeyUpdate` wrote two of them. `graded_under` therefore kept whatever the INSERT had
 * put there, and for every claim in the product that is `null`: `currentClaim` writes a fresh
 * hypothesis, and every write after it is an update. So on MySQL, and only on MySQL, no claim ever
 * recorded which protocol graded it.
 *
 * WHY THAT IS AN EVIDENCE DEFECT AND NOT A MISSING COLUMN. `getClaim` maps a null `graded_under` on
 * a graded row to `LEGACY_VALIDATION` -- correctly, because a claim graded before protocols existed
 * genuinely has none -- and `decidesClaim(LEGACY_VALIDATION, …)` returns **true** unconditionally,
 * because a legacy grade cannot be re-litigated. Put those together and `gradeIsSettled` came back
 * true for every graded claim on the server deployment, including one graded by a drill whose
 * protocol cannot decide it. That is the sentence `gradeIsSettled`'s own docblock is written
 * against: a screen printing the same word for a verdict and for a drill that could not reach the
 * question.
 *
 * WHY NOTHING SAW IT. Every test in this repository but the database ones runs against
 * `MemoryRecordStore`, whose `saveClaim` replaces the whole row and therefore keeps all three
 * fields. It is the third defect of exactly this shape in this one function -- the two timestamps
 * above it in `server/record.ts` carry the same note -- and the first two were found by probing a
 * real MariaDB side by side, which needs a database nobody has in a unit run.
 *
 * SO THIS TEST NEEDS NO DATABASE. The rule is not "MySQL returns the right row"; it is "the SET
 * clause names every field the fold may change", and both halves of that are readable here: the
 * fold is run, its changed fields are collected from its actual output, and the clause is read from
 * the source. A field added to the fold later fails this without anyone remembering to.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateClaim } from "@shared/claim";
import type { Claim, ProspectiveDrillResult } from "@shared/claim";

const source = readFileSync(resolve(__dirname, "../../server/record.ts"), "utf8");

const CLAIM: Claim = {
  claim_id: "claim-1",
  statement: "בעמדות מהירות אתם בטוחים יותר משאתם מדויקים",
  scope: "fast-under-45s",
  supporting_decision_ids: ["d1", "d2"],
  n: 30,
  grade: "hypothesis",
  graded_under: null,
  refutation_condition: "אם הפער בתרגול לא יעלה על הבסיס — ההשערה הופרכה.",
  predicts_overconfidence: true,
  created_at: "2026-01-01T00:00:00.000Z",
  last_evaluated_at: "2026-01-01T00:00:00.000Z",
  prospective_tests: [],
};

const RESULT: ProspectiveDrillResult = {
  kind: "prospective_drill_result",
  drill_id: "drill-1",
  claim_id: "claim-1",
  decision_ids: ["d9", "d10", "d11"],
  predicted: true,
  observed: true,
  protocol: "timed-holdout",
  recorded_at: "2026-02-01T00:00:00.000Z",
};

/**
 * The fields the fold actually moved, measured rather than listed.
 *
 * A hand-written list would be the same kind of artefact as the `SET` clause it is checking, and
 * would go stale the same way and at the same moment.
 */
function foldedFields(): string[] {
  const graded = evaluateClaim(CLAIM, [RESULT]) as unknown as Record<string, unknown>;
  const before = CLAIM as unknown as Record<string, unknown>;
  return Object.keys(graded).filter(
    (key) => JSON.stringify(graded[key]) !== JSON.stringify(before[key]),
  );
}

/**
 * `prospective_tests` is not a column and must not be one.
 *
 * Both `getClaim` implementations build it by reading the `drill_results` rows, which is what makes
 * the grade a function of the record rather than of a cached copy -- and is the whole reason a lost
 * claim write is repairable by a retry instead of frozen by one. Writing it onto the claim would
 * create a second source for the same fact.
 */
const DERIVED = new Set(["prospective_tests"]);

/** Atom field name -> the drizzle column name the store writes it under. */
const COLUMN: Record<string, string> = {
  grade: "grade",
  graded_under: "gradedUnder",
  last_evaluated_at: "lastEvaluatedAt",
};

describe("a grade that forgot which protocol reached it", () => {
  it("the fold really does change three stored fields, or this test proves nothing", () => {
    const changed = foldedFields();
    expect(changed, "the fold changed nothing -- the fixture no longer grades").not.toHaveLength(0);
    expect(new Set(changed)).toEqual(
      new Set(["grade", "graded_under", "last_evaluated_at", "prospective_tests"]),
    );
  });

  it("names every one of them in the claim upsert's SET clause", () => {
    /*
     * READ FROM THE CLAUSE, not from the file. `gradedUnder` appears in `saveClaim`'s INSERT row
     * and in `getClaim`'s mapping either way, so a scan of the whole file would have been green
     * throughout the defect.
     */
    const clause = /\.onDuplicateKeyUpdate\(\{\s*set:\s*\{([\s\S]*?)\}\s*,?\s*\}\)/.exec(
      source.slice(source.indexOf("async saveClaim")),
    )?.[1];
    expect(clause, "saveClaim no longer upserts -- read the new shape before deleting this").toBeTruthy();

    for (const field of foldedFields()) {
      if (DERIVED.has(field)) continue;
      const column = COLUMN[field];
      expect(column, `${field} is new to the fold and has no column mapped here`).toBeTruthy();
      expect(
        clause,
        `evaluateClaim changes ${field} and the upsert does not write ${column}, so a graded ` +
          `claim keeps whatever the INSERT put there`,
      ).toContain(column);
    }
  });

  it("the learning-rule upsert, which is the model this one should have followed", () => {
    /*
     * NOT DECORATION. The same file, twenty lines down, gets this right: `saveLearningRule`'s SET
     * clause names exactly the four fields `sameLearningRule` compares. That is what makes the
     * claim's omission a slip rather than a design, and pinning it keeps the pair in step.
     */
    const clause = /\.onDuplicateKeyUpdate\(\{\s*set:\s*\{([\s\S]*?)\}\s*,?\s*\}\)/.exec(
      source.slice(source.indexOf("async saveLearningRule")),
    )?.[1];
    for (const column of ["grade", "retrievalStep", "nextDueAt", "lastEvaluatedAt"]) {
      expect(clause, `the rule upsert stopped writing ${column}`).toContain(column);
    }
  });
});
