/**
 * Crossing the variables, which is what characterises a game profile -- and what it costs.
 *
 * WHY CROSS AT ALL. A record that reports "worse in the middlegame" and "worse when fast" as two
 * separate facts cannot say whether those are two weaknesses or one seen twice. The crossing is
 * where a profile lives: *worse in the middlegame, but only under time pressure* is a different
 * player from *worse in the middlegame regardless*, and the marginal panel cannot tell them apart.
 *
 * WHAT IT COSTS, MEASURED ON PERFECTLY CALIBRATED PLAYERS -- nothing to find anywhere, 500 runs
 * per size, seeded:
 *
 *                      marginal buckets only     with every phase x time crossing
 *     n = 120                0.6%                          0.0%
 *     n = 240                0.4%                          0.0%
 *     n = 480                0.2%                          0.0%
 *
 * CROSSING COSTS NOTHING IN FALSE POSITIVES, which is not luck and not a virtue of the crossing:
 * `MIN_BUCKET_N` is required on BOTH sides, so a crossed cell too small to be trusted is never
 * tested at all and cannot produce a false positive. The floor already in the product does the
 * work.
 *
 * WHAT IT COSTS INSTEAD IS SILENCE. Crossed cells with enough decisions to be measurable at all:
 *
 *     n = 120     0.1%        n = 240     17.1%        n = 480     65.1%
 *
 * So the profile is unreadable on a short record and mostly readable on a long one, and the
 * honest thing is to print that fraction rather than an empty panel. An absence with a
 * denominator is a state a player can act on; a blank one is indistinguishable from a bug.
 *
 * LEVELS OF ONE VARIABLE ARE NEVER CROSSED. "opening AND middlegame" is empty by construction and
 * "fast AND slow" likewise -- crossing them would spend the multiple-comparison budget on cells
 * that cannot contain anything. Only distinct variables cross.
 */
import { describe, expect, it } from "vitest";
import { CONFIDENCE_LEVELS, normaliseConfidence } from "@shared/confidence";
import { MIN_BUCKET_N, seededRandom, type ScoredDecision } from "@shared/detector";
import { crossVariables } from "@shared/crossing";

const FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/**
 * A player whose weakness lives in ONE CELL: the middlegame, and only when they moved fast.
 * A middlegame move made slowly is perfectly calibrated. No marginal bucket describes this.
 */
function weakInOneCell(n: number, rand: () => number): ScoredDecision[] {
  return Array.from({ length: n }, (_, i) => {
    const r = rand();
    const phase = (r < 0.25 ? "opening" : r < 0.75 ? "middlegame" : "endgame") as ScoredDecision["phase"];
    const fast = rand() < 0.5;
    const secondsTaken = fast ? 10 + rand() * 30 : 130 + rand() * 60;
    const stated = normaliseConfidence(1 + Math.floor(rand() * CONFIDENCE_LEVELS), CONFIDENCE_LEVELS);
    const weak = phase === "middlegame" && fast;
    return {
      decision_id: `d-${i}`,
      fen: FEN,
      confidence: stated,
      accurate: rand() < (weak ? Math.max(0, stated - 0.35) : stated),
      phase,
      secondsTaken,
      clockMsRemaining: null,
    };
  });
}

/**
 * A player weak in a cell that is LATE in the bucket list: slow endgame decisions.
 *
 * Built because the fixture above could not tell two rules apart. `fast-under-45s × middlegame`
 * is the first pair `pairs()` emits that can clear, so "take the strongest" and "take the first"
 * give the same answer there, and a mutation swapping them passed. A weakness in
 * `slow-over-2m × endgame` puts the real cell late and lets its mirrors clear ahead of it.
 */
function weakLateInTheList(n: number, rand: () => number): ScoredDecision[] {
  return Array.from({ length: n }, (_, i) => {
    const r = rand();
    const phase = (r < 0.25 ? "opening" : r < 0.55 ? "middlegame" : "endgame") as ScoredDecision["phase"];
    const slow = rand() < 0.55;
    const secondsTaken = slow ? 130 + rand() * 60 : 10 + rand() * 30;
    const stated = normaliseConfidence(1 + Math.floor(rand() * CONFIDENCE_LEVELS), CONFIDENCE_LEVELS);
    const weak = phase === "endgame" && slow;
    return {
      decision_id: `d-${i}`,
      fen: FEN,
      confidence: stated,
      accurate: rand() < (weak ? Math.max(0, stated - 0.4) : stated),
      phase,
      secondsTaken,
      clockMsRemaining: null,
    };
  });
}

/** Perfectly calibrated everywhere. Nothing to find in any cell. */
function nothingToFind(n: number, rand: () => number): ScoredDecision[] {
  return Array.from({ length: n }, (_, i) => {
    const r = rand();
    const phase = (r < 0.25 ? "opening" : r < 0.75 ? "middlegame" : "endgame") as ScoredDecision["phase"];
    const stated = normaliseConfidence(1 + Math.floor(rand() * CONFIDENCE_LEVELS), CONFIDENCE_LEVELS);
    return {
      decision_id: `d-${i}`,
      fen: FEN,
      confidence: stated,
      accurate: rand() < stated,
      phase,
      secondsTaken: 10 + rand() * 180,
      clockMsRemaining: null,
    };
  });
}

describe("what is crossed, and what is refused", () => {
  it("never crosses two levels of the same variable", () => {
    /*
     * "opening AND middlegame" is empty by construction. Testing it would spend a comparison on a
     * cell that cannot contain a decision, and would put an unreadable row on the screen.
     */
    const cells = crossVariables(nothingToFind(600, seededRandom(1))).cells;
    for (const cell of cells) {
      expect(cell.left.variable, `${cell.key} crosses one variable with itself`).not.toBe(
        cell.right.variable,
      );
    }
  });

  it("crosses every distinct pair of variables that has levels", () => {
    // A crossing that quietly covered fewer pairs than it claims is the shape this session has
    // found repeatedly; the count is asserted rather than assumed.
    const cells = crossVariables(nothingToFind(600, seededRandom(2))).cells;
    const pairs = new Set(cells.map((c) => [c.left.variable, c.right.variable].sort().join("×")));
    expect(pairs.size).toBeGreaterThanOrEqual(3);
  });

  it("holds a cell that can never fill apart from one that is merely short", () => {
    /*
     * R2, and the same distinction the marginal panel already draws. A record with no clock can
     * never fill a `clock` cell however long the player keeps playing, and folding that into
     * "not enough decisions yet" tells them to keep going toward something unreachable.
     */
    const noClock = crossVariables(nothingToFind(600, seededRandom(4)));
    expect(noClock.impossible).toBeGreaterThan(0);
    for (const cell of noClock.cells) {
      if (cell.silence === "no-clock-data") {
        expect([cell.left.variable, cell.right.variable]).toContain("clock");
      }
    }
    expect(noClock.measurable + noClock.impossible).toBeLessThanOrEqual(noClock.tried);
  });

  it("says how many cells it could read, out of how many it tried", () => {
    /*
     * R1. Silence with a denominator is a state a player can act on; a blank panel is
     * indistinguishable from a broken one. On a short record almost nothing is readable, and
     * that is the honest thing to print.
     */
    const short = crossVariables(nothingToFind(120, seededRandom(3)));
    const long = crossVariables(nothingToFind(600, seededRandom(3)));
    expect(short.tried).toBe(long.tried);
    expect(short.measurable).toBeLessThan(long.measurable);
    expect(long.measurable).toBeGreaterThan(0);
  });
});

describe("a weakness that lives in one cell", () => {
  it("is found by the crossing", () => {
    /*
     * THE READING THE MARGINAL PANEL CANNOT PRODUCE. This player is fine in slow middlegame
     * positions and miscalibrated in fast ones. "middlegame" dilutes it with the slow half and
     * "fast" dilutes it with the opening and endgame; only the cell holds it undiluted.
     */
    let found = 0;
    let runs = 0;
    for (let seed = 500; seed < 700; seed += 1) {
      const reading = crossVariables(weakInOneCell(700, seededRandom(seed)));
      if (reading.measurable === 0) continue;
      runs += 1;
      if (reading.findings[0]?.strongest.key === "fast-under-45s×phase-middlegame") found += 1;
    }
    expect(runs, "no run had a measurable cell at all").toBeGreaterThan(0);
    // Measured at 200/200 for the cell itself; the floor is set below the point estimate.
    expect(found / runs).toBeGreaterThan(0.9);
  });

  it("reports one finding for the pair, not the real cell and its mirror", () => {
    /*
     * THE DEFECT THE CROSSING INHERITED. A cell is measured against everything outside it, and
     * the outside contains the weakness -- so on this player `slow-over-2m×phase-middlegame`
     * separated on 35 of 200 runs, a claim about a cell that is perfectly calibrated. Six cells
     * of one variable pair are six levels of one composite variable and get one finding between
     * them, exactly as the three phases do.
     */
    let severalPerPair = 0;
    let runs = 0;
    for (let seed = 500; seed < 700; seed += 1) {
      const reading = crossVariables(weakInOneCell(700, seededRandom(seed)));
      if (reading.findings.length === 0) continue;
      runs += 1;
      const pairs = reading.findings.map((f) => f.pair);
      if (new Set(pairs).size !== pairs.length) severalPerPair += 1;
    }
    expect(runs).toBeGreaterThan(0);
    expect(severalPerPair, "a variable pair produced more than one finding").toBe(0);
  });

  it("keeps the mirrored cell as a consequence rather than discarding it", () => {
    const withMirror = Array.from({ length: 200 }, (_, i) =>
      crossVariables(weakInOneCell(700, seededRandom(500 + i))),
    ).find((r) => r.findings[0]?.mirrored.length > 0);
    expect(withMirror, "no run produced a mirrored cell at all").toBeTruthy();
    const finding = withMirror!.findings[0];
    for (const cell of finding.mirrored) {
      expect(Math.sign(cell.gapDifference)).toBe(-Math.sign(finding.strongest.gapDifference));
    }
  });

  it("reports the cell with its own error, not a bare difference", () => {
    const reading = crossVariables(weakInOneCell(700, seededRandom(500)));
    for (const cell of reading.separated) {
      expect(cell.standardError).toBeGreaterThan(0);
      expect(Math.abs(cell.gapDifference)).toBeGreaterThan(cell.standardError);
    }
  });
});

describe("the strongest cell, not the first one the list happens to reach", () => {
  it("leads on the cell that is actually weak, wherever it sits in the list", () => {
    /*
     * The ordering rule, on a fixture where order and strength disagree. `pairs()` walks
     * `BUCKETINGS` in its declared order, so a cell late in that order is reached last -- and its
     * own mirrors are reached first. Taking `cleared[0]` would name one of them.
     */
    let runs = 0;
    let right = 0;
    let firstWasWrong = 0;
    for (let seed = 3000; seed < 3200; seed += 1) {
      const reading = crossVariables(weakLateInTheList(800, seededRandom(seed)));
      const finding = reading.findings[0];
      if (!finding) continue;
      runs += 1;
      if (finding.strongest.key === "slow-over-2m×phase-endgame") right += 1;
      // The case that makes the rule matter at all: something else cleared earlier in the list.
      if (reading.separated[0]?.key !== "slow-over-2m×phase-endgame") firstWasWrong += 1;
    }
    expect(runs, "no run produced a finding").toBeGreaterThan(0);
    expect(firstWasWrong, "the fixture never put another cell first, so it proves nothing")
      .toBeGreaterThan(0);
    expect(right / runs).toBeGreaterThan(0.9);
  });

  /*
   * RANKING BY DISTANCE RATHER THAN BY SIZE IS BARELY LOAD-BEARING HERE, AND THAT IS RECORDED
   * RATHER THAN DRESSED UP AS AN ASSERTION.
   *
   * For the marginal panel the choice mattered a great deal -- ranking by support named the wrong
   * phase on 11% of players whose weakness sat in a small level. For the crossing it very nearly
   * does not. Measured on a player weak in a deliberately SMALL cell (fast opening decisions, 8%
   * of the record) against mirrors three times its size, 200 seeded runs at n = 1000:
   *
   *     by distance   100.0%        by size   98.0%
   *
   * Two points, on 200 runs. A mutation swapping the two does not go red on any fixture built
   * from these buckets, and inventing one that forced it would be building a fixture to satisfy
   * an assertion rather than to test the code. Distance is kept for consistency with
   * `readVariables`, where it IS measured to matter -- one rule for both collapses beats two
   * rules justified separately -- and this note exists so that consistency is not later mistaken
   * for a measured superiority it does not have here.
   */
});

describe("the price of asking more questions", () => {
  it("finds nothing in a record with nothing in it", () => {
    /*
     * THE CONTROL THAT DECIDES WHETHER CROSSING IS AFFORDABLE AT ALL. Measured at 0.0% across
     * 500 perfectly-calibrated players at each of three record sizes. It is not a virtue of the
     * crossing -- the `MIN_BUCKET_N` floor on both sides means an untrustworthy cell is never
     * tested -- but it is the number that makes the feature safe to ship.
     */
    let falsePositives = 0;
    const RUNS = 200;
    for (let seed = 9000; seed < 9000 + RUNS; seed += 1) {
      if (crossVariables(nothingToFind(480, seededRandom(seed))).separated.length > 0) {
        falsePositives += 1;
      }
    }
    expect(falsePositives / RUNS, "crossing started reporting noise").toBeLessThan(0.02);
  }, 120_000);

  it("refuses a cell whose inside is under the floor", () => {
    /*
     * The floor is what makes the control above hold, so it is asserted directly rather than
     * inferred from the rate.
     *
     * ONLY THE INSIDE IS ASSERTED, AND THE ASYMMETRY IS DELIBERATE. A crossed cell is an AND of
     * two predicates, so it can never be larger than either -- which means `outside` cannot fall
     * under the floor unless a cell covers nearly the whole record, and with these variables it
     * cannot. Removing the outside check does not go red here and no fixture built from these
     * buckets could make it. It is inherited from the marginal path and kept as a guard against a
     * future variable that is not this shape, not because anything measures it. Recorded rather
     * than asserted, for the same reason the layout file records a width claim it deleted: an
     * assertion no mutation can redden is not evidence.
     */
    const reading = crossVariables(nothingToFind(600, seededRandom(11)));
    for (const cell of reading.readable) {
      expect(cell.inside.n).toBeGreaterThanOrEqual(MIN_BUCKET_N);
    }
  });
});
