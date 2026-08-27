/**
 * Three levels of one variable are one finding, not three -- and the third is often the mirror of
 * the first.
 *
 * WHAT WAS MEASURED, and it is the reason this file exists. Four hundred simulated players, each
 * with EXACTLY ONE weakness: overconfident in the middlegame, perfectly calibrated everywhere
 * else. Two hundred and forty decisions each, seeded, no RNG luck to appeal to.
 *
 *   phase-middlegame fires on   85.5%   -- correct, and it is the real effect
 *   phase-opening fires on      19.5%   -- a phase where nothing whatever is wrong
 *   phase-endgame fires on      17.8%   -- likewise
 *   told they have MORE THAN ONE pattern:  35.0%
 *
 * And with a correlation real games actually have -- middlegame moves being quicker --
 * `fast-under-45s` joins at 20.8% and the figure rises to 43.0%.
 *
 * THE MECHANISM, WHICH IS ARITHMETIC RATHER THAN CHANCE. Every bucket is measured against "the
 * rest", and the rest CONTAINS the real weakness. If the middlegame is bad and it is half the
 * record, then "opening versus the rest" is good by construction -- so the product reports the
 * opening as a finding, in the opposite direction. Measured over the same runs: of the 78 times
 * `phase-opening` fired, it fired as UNDERCONFIDENT 78 times out of 78. The product tells a
 * player to trust themselves more in a phase they are already calibrated in.
 *
 * WHAT SURVIVES, and this file does not overstate the damage. Candidates are ordered by `inside.n`
 * and the screen leads on the first, so the headline claim was right on 85.5% of these players and
 * wrong on 0.8%. The defect is in the COUNT and in the secondary claims, not in the headline.
 *
 * THE FIX IS NOT A THRESHOLD. Raising the bar would suppress the mirror and the real finding
 * together, because they are the same measurement seen from two sides. The fix is to stop
 * treating levels of one variable as separate questions.
 */
import { describe, expect, it } from "vitest";
import { CONFIDENCE_LEVELS, normaliseConfidence } from "@shared/confidence";
import { BUCKETINGS, detect, seededRandom, type ScoredDecision } from "@shared/detector";
import { VARIABLES, variableOf, readVariables } from "@shared/bucket-variable";

const FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** A player miscalibrated in ONE phase and nowhere else. See the module note. */
function oneWeakness(
  n: number,
  rand: () => number,
  weakPhase: ScoredDecision["phase"] = "middlegame",
): ScoredDecision[] {
  return Array.from({ length: n }, (_, i) => {
    const r = rand();
    const phase = (r < 0.25 ? "opening" : r < 0.75 ? "middlegame" : "endgame") as ScoredDecision["phase"];
    const stated = normaliseConfidence(1 + Math.floor(rand() * CONFIDENCE_LEVELS), CONFIDENCE_LEVELS);
    return {
      decision_id: `d-${i}`,
      fen: FEN,
      confidence: stated,
      // The ONLY departure from perfect calibration anywhere in this record.
      accurate: rand() < (phase === weakPhase ? Math.max(0, stated - 0.3) : stated),
      phase,
      secondsTaken: 60 + rand() * 60,
      clockMsRemaining: null,
    };
  });
}

describe("every bucket belongs to a variable, and the map is complete", () => {
  it("assigns every bucketing the detector may look at", () => {
    /*
     * THE VACUITY GUARD. A bucketing with no variable would fall back to being its own finding,
     * which is the behaviour this file exists to remove -- and it would do so silently.
     */
    const unassigned = BUCKETINGS.filter((b) => variableOf(b.key) === null);
    expect(unassigned.map((b) => b.key), "a bucket belongs to no variable").toEqual([]);
  });

  it("groups the three phases under one variable", () => {
    const phases = BUCKETINGS.filter((b) => variableOf(b.key)?.key === "phase").map((b) => b.key);
    expect(new Set(phases)).toEqual(
      new Set(["phase-opening", "phase-middlegame", "phase-endgame"]),
    );
  });

  it("keeps time-taken and clock apart, because they are different questions", () => {
    /*
     * How long the player CHOSE to spend and how much time they had LEFT are not the same
     * variable, and merging them would collapse a finding about deliberation into one about
     * pressure. Crossing them is meaningful precisely because they are separate.
     */
    expect(variableOf("fast-under-45s")?.key).toBe("time-taken");
    expect(variableOf("slow-over-2m")?.key).toBe("time-taken");
    expect(variableOf("clock-under-1m")?.key).toBe("clock");
  });

  it("names a variable for a key that is not a bucket at all as nothing", () => {
    expect(variableOf("not-a-bucket")).toBeNull();
  });
});

describe("one weakness is reported once", () => {
  const run = (seed: number) => readVariables(detect(oneWeakness(240, seededRandom(seed))));

  it("collapses the mirror into the finding it is a mirror of", () => {
    /*
     * THE ASSERTION THE FILE EXISTS FOR, measured over the same 400 seeded players the module
     * note reports. Before: 35% were told they had more than one pattern. A variable-level
     * reading may name at most one finding per variable, so a phase effect is one finding no
     * matter how many of its three levels cleared the bar.
     */
    let severalFindings = 0;
    for (let seed = 1000; seed < 1400; seed += 1) {
      if (run(seed).findings.length > 1) severalFindings += 1;
    }
    expect(severalFindings, "a player with one weakness was told about several").toBe(0);
  });

  it("still names the middlegame, and does not lose it in the collapse", () => {
    /*
     * The other half, and the reason this is not just a suppression. Collapsing must keep the
     * real finding -- a fix that reported nothing would also score zero above.
     */
    let named = 0;
    for (let seed = 1000; seed < 1400; seed += 1) {
      const reading = run(seed);
      if (reading.findings[0]?.strongest.key === "phase-middlegame") named += 1;
    }
    expect(named / 400).toBeGreaterThan(0.8);
  });

  it("keeps the mirrored level, as a consequence rather than as a finding", () => {
    /*
     * NOT DISCARDED, and this is the discipline this session has been applying throughout: a
     * distinction that was measured must not be thrown away before it reaches anyone. That the
     * opening reads high BECAUSE the middlegame reads low is a true and useful thing about the
     * record. It is carried on the finding as `mirrored`, and it is not a second claim.
     */
    const withMirror = Array.from({ length: 400 }, (_, i) => run(1000 + i)).find(
      (r) => r.findings[0]?.mirrored.length > 0,
    );
    expect(withMirror, "no run produced a mirrored level at all").toBeTruthy();
    const finding = withMirror!.findings[0];
    expect(finding.strongest.key).toBe("phase-middlegame");
    // A mirror sits on the opposite side of the record's own average from the finding.
    for (const level of finding.mirrored) {
      expect(Math.sign(level.gapDifference)).toBe(-Math.sign(finding.strongest.gapDifference));
    }
  });

  it("says how many levels of the variable cleared, so the collapse is not silent", () => {
    // R1 in its usual form: the reading carries what it was computed from.
    const reading = Array.from({ length: 400 }, (_, i) => run(1000 + i)).find(
      (r) => r.findings.length > 0,
    )!;
    expect(reading.findings[0].levelsCleared).toBeGreaterThanOrEqual(1);
    expect(reading.findings[0].levelsTested).toBeGreaterThanOrEqual(
      reading.findings[0].levelsCleared,
    );
  });
});

describe("the level that is furthest, not the level that is largest", () => {
  /*
   * THE FIXTURE WHERE THE TWO RULES DISAGREE, and it had to be built on purpose.
   *
   * The first version of this file only simulated a bad MIDDLEGAME -- which is both the largest
   * level (half the record) and the furthest from the rest, so ranking by size and ranking by
   * distance give the same answer and a mutation swapping one for the other PASSED everything
   * above. An assertion satisfied by the fixture rather than by the code is the shape this
   * session has now found eleven times.
   *
   * A bad ENDGAME separates them: the endgame is a quarter of the record, so the clean middlegame
   * is the larger level and clears as the endgame's mirror. Measured over 400 seeded players at
   * 240 decisions, leading on the phase that is actually weak:
   *
   *                     ranked by support   ranked by distance
   *     weak endgame          89.0%               99.0%
   *     weak opening          88.7%               99.0%
   *     weak middlegame       98.9%               97.2%
   *
   * DISTANCE IS NOT UNIFORMLY BETTER AND THIS FILE DOES NOT PRETEND IT IS. It costs 1.7 points
   * when the weakness IS the largest level, and buys ten when it is not. Ranking by support is
   * biased toward whichever level the record happens to contain most of, which is the failure
   * that matters: it is exactly when the weakness sits in a small level that a player most needs
   * to be told about it.
   *
   * A THIRD RULE WAS TRIED AND WAS WORSE. Ranking by each level's own gap against the median of
   * the other levels' gaps -- the natural "which one is the outlier" -- scored 89.0% on the weak
   * endgame, no better than support. It is recorded here so it is not re-proposed as an
   * improvement.
   */
  const runEndgame = (seed: number) =>
    readVariables(detect(oneWeakness(240, seededRandom(seed), "endgame")));

  it("leads on the endgame when the endgame is what is wrong", () => {
    let runs = 0;
    let named = 0;
    let mirrorWasLarger = 0;
    for (let seed = 2000; seed < 2400; seed += 1) {
      const finding = runEndgame(seed).findings[0];
      if (!finding) continue;
      runs += 1;
      if (finding.strongest.key === "phase-endgame") named += 1;
      // The case the ranking rule is about: a mirror with more decisions behind it.
      if (finding.mirrored.some((m) => m.inside.n > finding.strongest.inside.n)) mirrorWasLarger += 1;
    }
    expect(mirrorWasLarger, "the fixture never produced a larger mirror, so it proves nothing")
      .toBeGreaterThan(0);
    // Measured at 99.0%. The floor is set below it rather than at it: this is a rate, and a test
    // pinned to its own point estimate fails on the next seed that happens to differ.
    expect(named / runs).toBeGreaterThan(0.95);
  });

  it("leads on a phase that is fine only rarely, and the rate is the claim", () => {
    /*
     * NOT "NEVER". The first version of this asserted the mirror never leads, and it failed --
     * correctly. It leads on about 1% of these players, because a mirror estimated from twice as
     * many decisions can sit further out in standard errors than the real effect does. That is a
     * property of the estimator, not a bug to be asserted away, and a test demanding zero would
     * have to be satisfied by suppressing real findings too.
     */
    let runs = 0;
    let ledOnClean = 0;
    for (let seed = 2000; seed < 2400; seed += 1) {
      const finding = runEndgame(seed).findings[0];
      if (!finding) continue;
      runs += 1;
      if (finding.strongest.key !== "phase-endgame") ledOnClean += 1;
    }
    expect(ledOnClean / runs, "leading on a clean phase became common").toBeLessThan(0.05);
  });
});

describe("a record with nothing in it says nothing", () => {
  it("reports no findings when the detector found none", () => {
    expect(readVariables([]).findings).toEqual([]);
  });
});

describe("the variable list is closed, like the bucket list it groups", () => {
  it("has fewer variables than buckets, which is the entire point", () => {
    /*
     * If every bucket were its own variable the reading would be exactly what it replaces. The
     * inequality is the mechanism, asserted rather than assumed.
     */
    expect(VARIABLES.length).toBeLessThan(BUCKETINGS.length);
  });
});
