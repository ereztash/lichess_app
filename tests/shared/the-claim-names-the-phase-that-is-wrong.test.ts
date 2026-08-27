/**
 * The claim the record stores, and how often it named a phase the player was fine in.
 *
 * WHY THIS IS WORSE THAN A WRONG SENTENCE ON A PANEL. A claim is the most durable thing this
 * product makes. It is written to the record, it accumulates prospective drill results, and it is
 * what the player is asked to go and TEST -- so a claim naming the wrong phase does not merely
 * misinform, it spends the player's decisions running a drill on a phase where there was never
 * anything to find.
 *
 * MEASURED, 400 simulated players per condition, each with exactly one weakness, 240 decisions:
 *
 *                       claim names a phase that is FINE
 *     weakness in         before        after         of the wrong ones, INVERTED
 *     endgame             14.7%         1.6%          44 of 45
 *     opening             14.7%         1.0%          44 of 46
 *     middlegame           0.0%         0.8%          --
 *
 * ONE IN SEVEN, and forty-four times in forty-five the claim was the MIRROR: it told a player they
 * were underconfident in a phase they were calibrated in, and then offered them a drill to prove
 * it.
 *
 * WHY IT HAPPENED. `selectClaim` took `patterns[0]`, and `detect` sorts by support -- the number of
 * decisions behind a bucket. That is the right rule for choosing between unrelated claims and the
 * wrong one for choosing among levels of one variable, because the biggest level is whichever the
 * record happens to contain most of. When the weakness sits in a small level, its mirror in a
 * large one is both larger and, being estimated from more decisions, often further out in standard
 * errors.
 *
 * THE COST IS STATED. The middlegame case gets very slightly worse -- 0.0% to 0.8% -- because
 * distance ranking gives up the guarantee that the biggest level always wins. Fourteen points
 * bought for eight tenths of one.
 *
 * WHAT DOES NOT CHANGE. `BUCKETINGS` keeps every key, so a claim id is still derived from the same
 * bucket and a stored claim still resolves. This changes which candidate is selected, not what the
 * detector may look at nor how a claim is identified.
 */
import { describe, expect, it } from "vitest";
import { CONFIDENCE_LEVELS, normaliseConfidence } from "@shared/confidence";
import { detect, seededRandom, type ScoredDecision } from "@shared/detector";
import { claimIdFor, selectClaim } from "@shared/claim-derivation";
import type { CandidatePattern } from "@shared/detector";

const FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
/** Keyed by bucket key, for the id-matches-statement assertion below. */
const SCOPE_BY_KEY: Record<string, string> = {
  "phase-opening": "החלטות בפתיחה",
  "phase-middlegame": "החלטות באמצע המשחק",
  "phase-endgame": "החלטות בסיום",
  "fast-under-45s": "החלטות תחת פחות מ-45 שניות",
  "slow-over-2m": "החלטות אחרי יותר משתי דקות",
  "clock-under-1m": "החלטות עם פחות מדקה על השעון",
};

const SCOPE: Record<string, string> = {
  opening: "החלטות בפתיחה",
  middlegame: "החלטות באמצע המשחק",
  endgame: "החלטות בסיום",
};

function oneWeakPhase(n: number, rand: () => number, weak: string): ScoredDecision[] {
  return Array.from({ length: n }, (_, i) => {
    const r = rand();
    const phase = (r < 0.25 ? "opening" : r < 0.75 ? "middlegame" : "endgame") as ScoredDecision["phase"];
    const stated = normaliseConfidence(1 + Math.floor(rand() * CONFIDENCE_LEVELS), CONFIDENCE_LEVELS);
    return {
      decision_id: `d-${i}`,
      fen: FEN,
      confidence: stated,
      accurate: rand() < (phase === weak ? Math.max(0, stated - 0.3) : stated),
      phase,
      secondsTaken: 60 + rand() * 60,
      clockMsRemaining: null,
    };
  });
}

const rate = (weak: string) => {
  let runs = 0;
  let namedACleanPhase = 0;
  for (let seed = 5000; seed < 5400; seed += 1) {
    const selection = selectClaim(detect(oneWeakPhase(240, seededRandom(seed), weak)), { created_at: "2026-01-01T00:00:00.000Z" });
    if (!selection) continue;
    runs += 1;
    if (selection.claim.scope !== SCOPE[weak]) namedACleanPhase += 1;
  }
  return { runs, share: namedACleanPhase / runs };
};

describe("the stored claim names the phase that is actually wrong", () => {
  it("does so when the weakness is in the endgame", () => {
    /*
     * The condition that was worst: 14.7% before. The floor is set above the measured 1.6% rather
     * than at it, because this is a rate and a test pinned to its own point estimate fails on the
     * next seed that differs.
     */
    const { runs, share } = rate("endgame");
    expect(runs).toBeGreaterThan(200);
    expect(share, "the claim named a clean phase too often").toBeLessThan(0.05);
  }, 120_000);

  it("does so when the weakness is in the opening", () => {
    const { runs, share } = rate("opening");
    expect(runs).toBeGreaterThan(200);
    expect(share).toBeLessThan(0.05);
  }, 120_000);

  it("still does so when the weakness is in the largest phase", () => {
    /*
     * The side of the trade. Ranking by distance gives up the guarantee that the biggest level
     * wins, and this is the case where that guarantee was doing the work. Measured at 0.8%, up
     * from 0.0% -- the cost, and it is asserted so it cannot grow unnoticed.
     */
    const { share } = rate("middlegame");
    expect(share, "the trade against the largest phase got worse").toBeLessThan(0.03);
  }, 120_000);
});

describe("the id and the statement are about the same bucket", () => {
  /*
   * A BUG I INTRODUCED AND CAUGHT BY READING MY OWN WIRING, WORSE THAN THE ONE ABOVE IT.
   *
   * `selectClaim` was changed to choose the pattern by distance, and the caller went on building
   * the id as `claim-${patterns[0].key}` from the detector's own ordering. Two independent
   * answers to one question, and the moment they disagreed the record stored a claim carrying one
   * bucket's id and another bucket's statement.
   *
   * That is not a cosmetic mismatch. `recordClaim` reads back by id before deriving: it would
   * find a stored claim about a DIFFERENT phase and return that instead, so the player would be
   * shown a stale claim about the wrong part of their game -- and a prospective drill result
   * would attach to the wrong hypothesis, which is the one thing in this product that is supposed
   * to be unfalsifiable-proof.
   *
   * The id is now derived inside `selectClaim` from the pattern it selected, so the two cannot
   * diverge. This asserts the property rather than the implementation.
   */
  it("derives the id from the pattern it actually spoke about", () => {
    let checked = 0;
    for (let seed = 5000; seed < 5200; seed += 1) {
      const selection = selectClaim(detect(oneWeakPhase(240, seededRandom(seed), "endgame")), {
        created_at: "2026-01-01T00:00:00.000Z",
      });
      if (!selection) continue;
      checked += 1;
      expect(selection.claim.claim_id).toBe(claimIdFor(selection.key));
      expect(selection.claim.scope, "the id and the statement name different buckets").toBe(
        SCOPE_BY_KEY[selection.key],
      );
    }
    expect(checked, "no selection was produced, so nothing was checked").toBeGreaterThan(100);
  }, 120_000);

  it("cannot be made to disagree by the detector's ordering", () => {
    /*
     * The case that produced the bug: the level the detector ranks first is NOT the one the claim
     * speaks about. Built by hand so it is guaranteed rather than left to a seed.
     */
    const biggest: CandidatePattern = {
      key: "phase-middlegame",
      scope: "החלטות באמצע המשחק",
      inside: { n: 200, meanConfidence: 0.6, accuracyRate: 0.58, gap: 0.02, gapVariance: 0.2 },
      outside: { n: 100, meanConfidence: 0.6, accuracyRate: 0.35, gap: 0.25, gapVariance: 0.2 },
      gapDifference: -0.23,
      standardError: 0.09,
      supporting_decision_ids: [],
      predicts_overconfidence: false,
    };
    const furthest: CandidatePattern = {
      key: "phase-endgame",
      scope: "החלטות בסיום",
      inside: { n: 60, meanConfidence: 0.8, accuracyRate: 0.3, gap: 0.5, gapVariance: 0.2 },
      outside: { n: 240, meanConfidence: 0.6, accuracyRate: 0.58, gap: 0.02, gapVariance: 0.2 },
      gapDifference: 0.48,
      standardError: 0.05,
      supporting_decision_ids: [],
      predicts_overconfidence: true,
    };
    // `detect` would return the larger first; the claim must still be the endgame, id and all.
    const selection = selectClaim([biggest, furthest], {
      created_at: "2026-01-01T00:00:00.000Z",
    })!;
    expect(selection.key).toBe("phase-endgame");
    expect(selection.claim.claim_id).toBe("claim-phase-endgame");
    expect(selection.claim.scope).toBe("החלטות בסיום");
  });
});

describe("what the claim still is", () => {
  it("carries the scope and the n it was derived from", () => {
    const selection = selectClaim(detect(oneWeakPhase(240, seededRandom(5000), "endgame")), { created_at: "2026-01-01T00:00:00.000Z" })!;
    expect(selection.claim.scope).toBe(SCOPE.endgame);
    expect(selection.claim.statement).toMatch(/\d+ החלטות/);
  });

  it("counts what it withheld as findings rather than as levels", () => {
    /*
     * `othersWithheld` used to count every candidate the detector returned, so a single weakness
     * reported as three levels said "and 2 more" -- which is the same overcount, printed. It now
     * counts the other VARIABLES that separated.
     */
    const selection = selectClaim(detect(oneWeakPhase(240, seededRandom(5000), "endgame")), { created_at: "2026-01-01T00:00:00.000Z" })!;
    expect(selection.othersWithheld).toBe(0);
  });

  it("says nothing when nothing separated", () => {
    expect(selectClaim([], { created_at: "2026-01-01T00:00:00.000Z" })).toBeNull();
  });
});
