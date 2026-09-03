/**
 * The README's gate table, held against the gates that actually run.
 *
 * WHAT WENT WRONG. The table listed ten gates for a while, and the build had twelve. Nobody
 * noticed, because a table in a markdown file is the one artefact in this repository that no
 * command reads. Every other claim here is either executed (`npm run gates`), measured
 * (`bundle:budget`), or asserted by a test. The gate table -- the single place a reader goes to
 * find out what this build refuses to ship -- was the exception, and it drifted for two gates.
 *
 * WHY THIS IS NOT A DOCUMENTATION NIT. The table is the argument. A reader who wants to know
 * whether the epistemic claims in this repository are enforced or merely stated reads that list.
 * A list that is two gates behind under-sells the build; a list that is two gates AHEAD -- which
 * is the same defect with the sign flipped -- claims enforcement that does not exist. The second
 * is the dangerous one, and it is exactly what happens when a gate is deleted and the table is
 * not.
 *
 * SO IT IS CHECKED IN BOTH DIRECTIONS. Every id in `run_gates.ts` must appear in the table, and
 * every id in the table must exist in `run_gates.ts`. Neither half alone is enough: the first
 * catches a gate added without a row, the second catches a row that outlived its gate.
 *
 * WHAT THIS DELIBERATELY DOES NOT CHECK. The prose in the `rule` and `control` columns. Those are
 * descriptions, and a test that pinned them to a string would be asserting that a sentence equals
 * itself while teaching whoever edits it to edit the test too. The ids are the part that carries
 * meaning across the two files, and the ids are what is held.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const readme = readFileSync(resolve(root, "README.md"), "utf8");
const runner = readFileSync(resolve(root, "scripts/run_gates.ts"), "utf8");

/** The gates the runner actually declares, in declaration order. */
const declared = [...runner.matchAll(/\bid:\s*"(GATE-[A-Z0-9-]+)"/g)].map((m) => m[1]);

/**
 * The ids the README's table names.
 *
 * Read from the first column of markdown rows rather than from the whole file, so a gate merely
 * MENTIONED in prose -- which several are, in the sections that explain what they found -- cannot
 * stand in for a row in the table.
 */
const tabulated = [...readme.matchAll(/^\|\s*(GATE-[A-Z0-9-]+)\s*\|/gm)].map((m) => m[1]);

describe("the README's gate table cannot fall behind the gates", () => {
  it("finds gates in both files at all, so an empty match cannot pass vacuously", () => {
    expect(declared.length, "no gate ids found in scripts/run_gates.ts").toBeGreaterThan(0);
    expect(tabulated.length, "no gate rows found in README.md").toBeGreaterThan(0);
  });

  it("names every gate the runner declares", () => {
    const missing = declared.filter((id) => !tabulated.includes(id));
    expect(missing, `gates that run but have no row in the README: ${missing.join(", ")}`).toEqual(
      [],
    );
  });

  it("names no gate the runner does not declare", () => {
    const phantom = tabulated.filter((id) => !declared.includes(id));
    expect(
      phantom,
      `rows in the README for gates that do not exist: ${phantom.join(", ")}`,
    ).toEqual([]);
  });

  it("counts them the same, and says the count in words that match", () => {
    expect(new Set(tabulated).size, "the table repeats a gate id").toBe(tabulated.length);
    expect(new Set(declared).size, "the runner declares a gate id twice").toBe(declared.length);
    expect(tabulated.length).toBe(declared.length);

    /*
     * The prose says the number too -- "ארבעה-עשר שערים" -- and a table that is right above a
     * sentence that is wrong is not a fixed README. The numeral is spelled out in Hebrew, so the
     * check is against the spelling for the count the two files agree on.
     */
    const hebrewNumeral: Record<number, string> = {
      11: "אחד-עשר",
      12: "שנים-עשר",
      13: "שלושה-עשר",
      14: "ארבעה-עשר",
      15: "חמישה-עשר",
      16: "שישה-עשר",
      17: "שבעה-עשר",
      18: "שמונה-עשר",
      19: "תשעה-עשר",
      20: "עשרים",
      21: "עשרים ואחד",
      22: "עשרים ושניים",
      23: "עשרים ושלושה",
      24: "עשרים וארבעה",
      25: "עשרים וחמישה",
      26: "עשרים ושישה",
      27: "עשרים ושבעה",
      28: "עשרים ושמונה",
      29: "עשרים ותשעה",
      30: "שלושים",
      31: "שלושים ואחד",
      32: "שלושים ושניים",
      33: "שלושים ושלושה",
      34: "שלושים וארבעה",
      35: "שלושים וחמישה",
    };
    const word = hebrewNumeral[declared.length];
    expect(
      word,
      `no Hebrew numeral registered for ${declared.length} gates -- add one above`,
    ).toBeDefined();
    expect(readme, `the README's prose does not say "${word} שערים"`).toContain(`${word} שערים`);
  });
});
