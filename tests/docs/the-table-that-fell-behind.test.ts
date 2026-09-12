/**
 * The human-readable gate catalog, held against the gates that actually run.
 *
 * WHAT WENT WRONG. The catalog once lived in README.md, listed ten gates for a while, and the
 * build had twelve. Nobody noticed, because a markdown table was the one artefact no command read.
 * A list that is behind under-sells enforcement; a list that is ahead claims enforcement that does
 * not exist.
 *
 * README.md is now deliberately the repository's orientation layer, so keeping the detailed gate
 * inventory there would recreate the document-role collision that the README rewrite removes.
 * The inventory therefore lives in docs/GATES.md and this test preserves the original contract at
 * its new authority location.
 *
 * SO IT IS CHECKED IN BOTH DIRECTIONS. Every id in `run_gates.ts` must appear in the catalog, and
 * every id in the catalog must exist in `run_gates.ts`. Neither half alone is enough.
 *
 * WHAT THIS DELIBERATELY DOES NOT CHECK. The prose in the `rule` and `control` columns. Those are
 * descriptions. The ids are the part that carries meaning across the two files, and the ids are
 * what is held.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const catalog = readFileSync(resolve(root, "docs/GATES.md"), "utf8");
const runner = readFileSync(resolve(root, "scripts/run_gates.ts"), "utf8");

/** The gates the runner actually declares, in declaration order. */
const declared = [...runner.matchAll(/\bid:\s*"(GATE-[A-Z0-9-]+)"/g)].map((m) => m[1]);

/**
 * The ids the gate catalog names.
 *
 * Read from the first column of markdown rows rather than from the whole file, so a gate merely
 * mentioned in prose cannot stand in for a row in the catalog.
 */
const tabulated = [...catalog.matchAll(/^\|\s*(GATE-[A-Z0-9-]+)\s*\|/gm)].map((m) => m[1]);

describe("the gate catalog cannot fall behind the gates", () => {
  it("finds gates in both files at all, so an empty match cannot pass vacuously", () => {
    expect(declared.length, "no gate ids found in scripts/run_gates.ts").toBeGreaterThan(0);
    expect(tabulated.length, "no gate rows found in docs/GATES.md").toBeGreaterThan(0);
  });

  it("names every gate the runner declares", () => {
    const missing = declared.filter((id) => !tabulated.includes(id));
    expect(missing, `gates that run but have no row in docs/GATES.md: ${missing.join(", ")}`).toEqual(
      [],
    );
  });

  it("names no gate the runner does not declare", () => {
    const phantom = tabulated.filter((id) => !declared.includes(id));
    expect(
      phantom,
      `rows in docs/GATES.md for gates that do not exist: ${phantom.join(", ")}`,
    ).toEqual([]);
  });

  it("counts them the same, and says the count in words that match", () => {
    expect(new Set(tabulated).size, "the catalog repeats a gate id").toBe(tabulated.length);
    expect(new Set(declared).size, "the runner declares a gate id twice").toBe(declared.length);
    expect(tabulated.length).toBe(declared.length);

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
      36: "שלושים ושישה",
      37: "שלושים ושבעה",
      38: "שלושים ושמונה",
    };
    const word = hebrewNumeral[declared.length];
    expect(
      word,
      `no Hebrew numeral registered for ${declared.length} gates -- add one above`,
    ).toBeDefined();
    expect(catalog, `docs/GATES.md does not say "${word} שערים"`).toContain(`${word} שערים`);
  });
});
