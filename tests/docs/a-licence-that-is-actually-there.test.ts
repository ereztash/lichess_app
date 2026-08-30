/**
 * The project's own licence, held against every place that states it.
 *
 * WHAT THIS EXISTS TO STOP. Until this file, three documents and a manifest all described a
 * repository with NO licence -- which was true, and stopped being true, and would have gone on
 * saying so. That is the same defect this repository has now been bitten by four times: a fact
 * kept in more than one place, and nothing checking that the copies agree. The gate table went two
 * gates stale, the harness manifest carried a superseded derivation, the README carried an order
 * effect no artifact supported, and the harness published a run that had stopped describing the
 * product.
 *
 * A licence is the worst of them to get wrong. A README that says "all rights reserved" beside a
 * LICENSE that says GPL is not untidy: it is two contradictory grants to whoever reads one and not
 * the other.
 *
 * WHY GPL AND NOT SOMETHING ELSE is argued in `LICENSE` itself and is not this file's business.
 * What is asserted here is only that the answer is stated once and stated everywhere.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

const licence = read("LICENSE");
const SPDX = "GPL-3.0-or-later";

describe("the project says what it is licensed under", () => {
  it("has a LICENSE containing the full GPL text, not just a reference to one", () => {
    /*
     * GPL-3.0 s.4 requires the licence to be conveyed WITH the work. A file that links to
     * gnu.org has not conveyed it.
     */
    expect(licence).toContain("GNU GENERAL PUBLIC LICENSE");
    expect(licence).toContain("Version 3, 29 June 2007");
    expect(licence.split("\n").length, "the LICENSE is too short to be the full text").
      toBeGreaterThan(600);
  });

  it("carries an applied copyright notice that is not the FSF's own", () => {
    /*
     * THE FIRST VERSION OF THIS WAS VACUOUS, and a control caught it. It asserted
     * `/Copyright \(C\) \d{4}/` -- which matches "Copyright (C) 2007 Free Software Foundation"
     * inside the GPL text itself. Replacing the applied notice with "[your name here]" left the
     * test green, so it was checking that the GPL is the GPL.
     *
     * What matters is the notice the GPL's own instructions ask for and everyone skips: the
     * licence text says what the terms are, the notice says WHOSE WORK they cover. A LICENSE
     * without one grants nothing about anything.
     */
    const applied = licence
      .split("\n")
      .filter((l) => /Copyright \(C\) \d{4}/.test(l))
      .filter((l) => !/Free Software Foundation/.test(l));
    expect(applied.length, "the only copyright line is the FSF's -- no notice was applied").
      toBeGreaterThan(0);
    expect(applied[0], "the applied notice names nobody").toMatch(/Copyright \(C\) \d{4}\s+\S+/);
    /* And the notice has to appear before the licence text, or a reader meets terms with no owner. */
    expect(licence.indexOf(applied[0])).toBeLessThan(licence.indexOf("GNU GENERAL PUBLIC LICENSE"));
    expect(licence).toContain("either version 3 of the License, or (at your option) any later");
  });

  it("declares the same licence in the manifest", () => {
    expect(JSON.parse(read("package.json")).license).toBe(SPDX);
  });

  it("is not contradicted by any document that used to say there was no licence", () => {
    for (const doc of ["README.md", "THIRD_PARTY_NOTICES.md", "docs/PRODUCTION_READINESS_LEDGER.md"]) {
      const text = read(doc);
      expect(text, `${doc} still says the project has no LICENSE`).not.toMatch(
        /no `LICENSE` file at all|has no `LICENSE` file|There is no `LICENSE` file/,
      );
      expect(text, `${doc} still says the project is all rights reserved`).not.toMatch(
        /own code is all rights reserved(?!.{0,400}(now|used to|Before that|previously))/s,
      );
    }
  });

  it("keeps the engine's own licence conveyed as well, which is a different obligation", () => {
    /*
     * Licensing this project GPL does not discharge the duty to convey Stockfish's copy of the
     * GPL and point at its source. GATE-NOTICE checks that; this checks the two have not been
     * confused for each other.
     */
    const notices = read("THIRD_PARTY_NOTICES.md");
    expect(notices).toContain("Stockfish");
    expect(notices).toContain("GPL-3.0-or-later");
    expect(notices).toContain("/licenses/stockfish/COPYING.txt");
  });
});
