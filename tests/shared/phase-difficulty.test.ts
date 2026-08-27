/**
 * What the phase of a game says about how hard a position is FOR A PERSON: almost nothing.
 *
 * THE CLAIM BEING CHECKED IS THE PRODUCT'S OWN. The dashboard splits a record by phase and reports
 * each bucket against a baseline built from this product's accuracy rule. On 693,130 real Lichess
 * moves that rule says the middlegame is 12.6 points harder than everything else and the ENDGAME
 * IS THE EASIEST PHASE OF THE GAME -- 78.4% accurate against 70.3% in the opening.
 *
 * That is a statement about the rule. Whether it is also a statement about people had never been
 * checked against anything outside this repository, and there is a corpus that can: the Lichess
 * puzzle database (CC0) carries a Glicko rating per position derived from real human solve
 * attempts. Item difficulty measured on humans, not inferred from an engine.
 *
 * WHAT CAME BACK, on 4,416,361 well-estimated positions:
 *
 *   opening     median 1355   (easiest)
 *   endgame     median 1390
 *   middlegame  median 1475   (hardest)
 *
 * The middlegame agrees -- hardest in both corpora, which is the product's headline claim and it
 * survives. The endgame INVERTS: the product calls it the easiest phase by a wide margin and
 * humans find it harder than the opening.
 *
 * AND THE NUMBER THAT MATTERS MORE THAN EITHER: eta-squared = 0.0035. The phase label explains
 * about a third of one percent of the variance in human difficulty. Checked at three filter
 * levels -- 0.0020, 0.0035, 0.0053 -- and the BEST-measured items give the SMALLEST value, so it
 * is not an effect being hidden by noise.
 *
 * WHAT MAY AND MAY NOT BE CONCLUDED. A puzzle rating measures finding a unique winning move in a
 * SELECTED tactical position; the product's accuracy rate measures not losing 30 centipawns on an
 * ORDINARY move. The two magnitudes are not commensurable and this file never subtracts them. Two
 * things survive the gap: the ORDER of the phases, and how much the phase label explains at all --
 * the second being a statement made entirely inside the puzzle corpus.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PHASES } from "@shared/decision-atom";
import { populationBucket } from "@shared/population-baseline";
import {
  PHASE_DIFFICULTY,
  PHASE_DIFFICULTY_N,
  PHASE_DIFFICULTY_VERSION,
  PHASE_VARIANCE_EXPLAINED,
  phaseDifficulty,
} from "@shared/phase-difficulty";

const root = resolve(__dirname, "../..");

describe("the reference is a real measurement over a real denominator", () => {
  it("covers every phase the product buckets by", () => {
    // A phase with no external reading would leave one bucket's caveat quietly unsupported.
    for (const phase of PHASES) expect(phaseDifficulty(phase), phase).not.toBeNull();
  });

  it("rests on millions of human-rated positions, not a sample", () => {
    expect(PHASE_DIFFICULTY_N).toBeGreaterThan(1_000_000);
    expect(PHASE_DIFFICULTY.reduce((total, row) => total + row.n, 0)).toBe(PHASE_DIFFICULTY_N);
  });

  it("holds ratings inside the range a Glicko scale can produce", () => {
    for (const row of PHASE_DIFFICULTY) {
      expect(row.median, row.phase).toBeGreaterThan(400);
      expect(row.median, row.phase).toBeLessThan(3500);
      expect(row.sd, row.phase).toBeGreaterThan(0);
    }
  });

  it("says nothing for a phase nobody rated", () => {
    expect(phaseDifficulty("not-a-phase")).toBeNull();
    expect(phaseDifficulty("")).toBeNull();
  });

  it("is versioned, because a reading from another corpus is another number", () => {
    expect(Number.isInteger(PHASE_DIFFICULTY_VERSION)).toBe(true);
    expect(PHASE_DIFFICULTY_VERSION).toBeGreaterThanOrEqual(1);
  });
});

describe("the finding the whole file exists for", () => {
  it("shows the phase label explains almost none of human difficulty", () => {
    /*
     * THE ASSERTION THAT CARRIES THE CAVEAT ON SCREEN. If this ever stopped holding -- if phase
     * turned out to explain a real share of human difficulty -- the dashboard's phase buckets
     * would become interpretable as difficulty and the caveat would have to go.
     */
    expect(PHASE_VARIANCE_EXPLAINED).toBeGreaterThan(0);
    expect(PHASE_VARIANCE_EXPLAINED).toBeLessThan(0.02);
  });

  it("is not zero either, which would mean the corpus was not read", () => {
    // A value of exactly 0 is what an empty or single-group computation returns.
    expect(PHASE_VARIANCE_EXPLAINED).toBeGreaterThan(0.0001);
    expect(PHASE_DIFFICULTY.length).toBeGreaterThan(1);
  });

  it("agrees with the product's own corpus that the middlegame is hardest", () => {
    /*
     * THE HALF THAT SURVIVES EXTERNAL VALIDATION, and it is the product's headline claim.
     * Comparing ORDER rather than magnitude: the two corpora measure different constructs, and
     * their numbers may never be subtracted from one another.
     */
    const hardestForPeople = [...PHASE_DIFFICULTY].sort((a, b) => b.median - a.median)[0];
    expect(hardestForPeople.phase).toBe("middlegame");

    const byRule = PHASES.map((phase) => ({
      phase,
      accuracy: populationBucket(`phase-${phase}`)?.accuracy ?? NaN,
    })).sort((a, b) => a.accuracy - b.accuracy);
    expect(byRule[0].phase, "the product's own corpus no longer agrees").toBe("middlegame");
  });

  it("records that the endgame inverts, so a tidy-up cannot quietly drop it", () => {
    /*
     * The half that does NOT survive. The product's rule calls the endgame the easiest phase by
     * eight points over the opening; humans find it harder than the opening. Pinned as a fact
     * about the two corpora, with no claim here about which is right -- the likeliest reading is
     * that a 30-centipawn budget is cheap in a simplified position, which would make the
     * product's endgame figure a property of the rule rather than of people.
     */
    const people = Object.fromEntries(PHASE_DIFFICULTY.map((r) => [r.phase, r.median]));
    expect(people.endgame, "the endgame no longer reads as harder than the opening for people")
      .toBeGreaterThan(people.opening);

    const rule = (phase: string) => populationBucket(`phase-${phase}`)!.accuracy;
    expect(rule("endgame"), "the product's rule no longer calls the endgame easier").toBeGreaterThan(
      rule("opening"),
    );
  });
});

describe("it was built the product's own way", () => {
  it("takes the phase names from the shared module rather than its own copy", () => {
    /*
     * The same discipline the population baseline is held to. A generator with its own idea of
     * what "endgame" means would produce a table that looks identical and answers a different
     * question from the one the dashboard asks.
     */
    const script = readFileSync(resolve(root, "scripts/build_phase_difficulty_reference.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(script).toMatch(/import \{ PHASES \} from "\.\.\/shared\/decision-atom/);
    expect(script, "the generator defines its own phase list").not.toMatch(
      /const\s+PHASES\s*=|\["opening"\s*,\s*"middlegame"/,
    );
  });

  it("records the filter it applied, so the cut is part of the record", () => {
    const generated = readFileSync(resolve(root, "shared/phase-difficulty.ts"), "utf8");
    expect(generated).toMatch(/RatingDeviation <= \d+/);
    expect(generated).toMatch(/NbPlays >= \d+/);
    expect(generated, "the file does not say how many rows it read").toMatch(/rows read/);
  });
});

/*
 * The "does it reach the screen" half lives in tests/client/population-on-screen.test.tsx, as a
 * RENDER. It was here first, as a grep for the two identifier names in RecordDashboard.tsx, and a
 * control that rewrote the caveat's opening sentence PASSED IT -- the interpolations were still in
 * the source, so the grep was satisfied while the sentence no longer said what the figures meant.
 * Source-grepping a rendered claim is the sixth instance of that shape today.
 */
