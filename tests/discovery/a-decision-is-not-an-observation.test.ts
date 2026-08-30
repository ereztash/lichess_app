/**
 * WHETHER A DECISION IS AN OBSERVATION -- the measurement, not the answer.
 *
 * `shared/detector.ts` divides a bucket's gap variance by the number of DECISIONS. That is right
 * if decisions are independent draws, and moves from one game are not obviously independent
 * draws: they share an opponent, an opening, a clock and a player who was in one state of mind
 * for all of them. `research/discovery-oracle/q1_units.py` measured what that costs in simulated
 * worlds, and measured that the obvious repair -- a cluster-robust standard error -- is WORSE
 * calibrated at twenty games than the formula it would replace. So nothing in the detector moved.
 *
 * What was missing was a number: the intraclass correlation of a real player's gap, which cannot
 * be read off any screen because `scoreDecisions` drops `game_id` before the detector sees it.
 * These tests hold the estimator that supplies it -- against records whose answer is known by
 * construction, because an estimator checked only against data whose truth is unknown is a
 * function nobody can contradict.
 */
import { describe, expect, it } from "vitest";
import {
  gameIdLookup,
  gapsByGame,
  intraclassCorrelation,
  moultonFactor,
  readClustering,
} from "@shared/discovery/clustering";
import type { ScoredDecision } from "@shared/detector";

const decision = (id: string, confidence: number, accurate: boolean): ScoredDecision => ({
  decision_id: id,
  fen: "-",
  confidence,
  accurate,
  phase: "middlegame",
  secondsTaken: 30,
  clockMsRemaining: 120_000,
});

/** A record where every game behaves identically: all the variance is WITHIN games. */
function noGameEffect(games: number, perGame: number): {
  scored: ScoredDecision[];
  gameOf: (d: ScoredDecision) => string | null;
} {
  const scored: ScoredDecision[] = [];
  const byId = new Map<string, string>();
  for (let g = 0; g < games; g += 1) {
    for (let i = 0; i < perGame; i += 1) {
      const id = `g${g}-d${i}`;
      // The same alternating pattern in every game: identical game means, differing decisions.
      scored.push(decision(id, 0.65, i % 2 === 0));
      byId.set(id, `game-${g}`);
    }
  }
  return { scored, gameOf: (d) => byId.get(d.decision_id) ?? null };
}

/** A record where every game is internally uniform and games differ: all variance is BETWEEN. */
function allGameEffect(games: number, perGame: number): {
  scored: ScoredDecision[];
  gameOf: (d: ScoredDecision) => string | null;
} {
  const scored: ScoredDecision[] = [];
  const byId = new Map<string, string>();
  for (let g = 0; g < games; g += 1) {
    for (let i = 0; i < perGame; i += 1) {
      const id = `g${g}-d${i}`;
      scored.push(decision(id, 0.65, g % 2 === 0));
      byId.set(id, `game-${g}`);
    }
  }
  return { scored, gameOf: (d) => byId.get(d.decision_id) ?? null };
}

describe("the share of the gap that belongs to the game", () => {
  it("sits at the estimator's own floor when every game behaves the same way", () => {
    // NOT ZERO, AND THE DIFFERENCE IS THE TEST. With no game effect the ANOVA estimator's value
    // is -1/(n0 - 1) -- here -1/19 -- because the between-game mean square is then an unbiased
    // estimate of the within-game one. An implementation that clamped at zero would pass a
    // weaker assertion and would make every no-effect record look faintly clustered.
    const { scored, gameOf } = noGameEffect(10, 20);
    expect(readClustering(scored, gameOf).intraclassCorrelation).toBeCloseTo(-1 / 19, 6);
  });

  it("never lets that floor become an inflation below one", () => {
    const { scored, gameOf } = noGameEffect(10, 20);
    expect(readClustering(scored, gameOf).worstCaseInflation).toBe(1);
  });

  it("is one when every game is internally uniform and games differ", () => {
    const { scored, gameOf } = allGameEffect(10, 20);
    expect(readClustering(scored, gameOf).intraclassCorrelation).toBeCloseTo(1, 2);
  });

  it("is between the two when both components are present", () => {
    const scored: ScoredDecision[] = [];
    const byId = new Map<string, string>();
    for (let g = 0; g < 20; g += 1) {
      for (let i = 0; i < 20; i += 1) {
        const id = `g${g}-d${i}`;
        // Half the accuracy pattern is the game's, half is the decision's.
        scored.push(decision(id, 0.65, g % 2 === 0 ? i % 4 !== 0 : i % 4 === 0));
        byId.set(id, `game-${g}`);
      }
    }
    const icc = readClustering(scored, (d) => byId.get(d.decision_id) ?? null).intraclassCorrelation;
    expect(icc).toBeGreaterThan(0.05);
    expect(icc).toBeLessThan(0.95);
  });

  it("says it cannot answer rather than answering zero, on one game", () => {
    const { scored, gameOf } = noGameEffect(1, 20);
    expect(readClustering(scored, gameOf).intraclassCorrelation).toBeNaN();
  });

  it("survives games of wildly different lengths", () => {
    // The unbalanced correction is the reason this passes: without `n0` the estimate is biased by
    // exactly the property -- a three-minute game and a thirty-minute one are not the same number
    // of decisions -- that made the question worth asking.
    const scored: ScoredDecision[] = [];
    const byId = new Map<string, string>();
    const lengths = [4, 60, 7, 90, 12, 120, 5, 45];
    lengths.forEach((length, g) => {
      for (let i = 0; i < length; i += 1) {
        const id = `g${g}-d${i}`;
        scored.push(decision(id, 0.65, i % 2 === 0));
        byId.set(id, `game-${g}`);
      }
    });
    const reading = readClustering(scored, (d) => byId.get(d.decision_id) ?? null);
    expect(reading.games).toBe(lengths.length);
    // The unbalanced `n0` is about 37 here, so the no-effect floor is about -0.027. WITHOUT the
    // correction the divisor would be the plain mean length of 43, and the estimate would move --
    // which is the bias this record shape exists to catch.
    expect(reading.intraclassCorrelation).toBeGreaterThan(-0.04);
    expect(reading.intraclassCorrelation).toBeLessThan(0.0);
    expect(reading.worstCaseInflation).toBe(1);
  });
});

describe("decisions whose game is not known", () => {
  it("are excluded and counted, never pooled into a group of their own", () => {
    // One bag of decisions from unknown games would look like one enormous cluster and would
    // dominate every quantity here.
    const { scored, gameOf } = noGameEffect(5, 10);
    const orphan = decision("orphan", 0.5, true);
    const reading = readClustering([...scored, orphan], (d) =>
      d.decision_id === "orphan" ? null : gameOf(d),
    );
    expect(reading.withoutGame).toBe(1);
    expect(reading.decisions).toBe(50);
    expect(reading.games).toBe(5);
  });

  it("are what a lookup returns for a decision id nothing mapped", () => {
    const lookup = gameIdLookup([], []);
    expect(lookup(decision("d1", 0.5, true))).toBeNull();
  });
});

describe("what a clustered residual costs a standard error", () => {
  it("costs nothing when there is no game-level component", () => {
    expect(moultonFactor(0, 26)).toBeCloseTo(1, 6);
  });

  it("costs nothing when the subgroup varies freely inside every game", () => {
    // The phase buckets: all three are present in every game, so `regressorIcc` is near zero and
    // the inflation is near one however correlated the residual is. The oracle measured exactly
    // this -- the phase buckets are the ones the shipped error gets right.
    expect(moultonFactor(0.06, 26, 0)).toBeCloseTo(1, 6);
  });

  it("costs the most when a game is wholly inside the subgroup or wholly outside it", () => {
    // The clock buckets: a three-minute game is entirely inside `fast-under-45s`, a thirty-minute
    // one is mostly outside. At the oracle's measured ICC and game size this is the bound.
    expect(moultonFactor(0.016, 26, 1)).toBeGreaterThan(1.15);
    expect(moultonFactor(0.058, 26, 1)).toBeGreaterThan(1.5);
  });

  it("grows with the size of a game, which is why the unit matters at all", () => {
    expect(moultonFactor(0.03, 60)).toBeGreaterThan(moultonFactor(0.03, 26));
  });

  it("reports the worst case rather than a prediction, and says which it is", () => {
    const { scored, gameOf } = allGameEffect(10, 20);
    const reading = readClustering(scored, gameOf);
    // ICC ~1 and mean game size 20: the bound is sqrt(1 + 19) ~ 4.47. No real bucket reaches it.
    expect(reading.worstCaseInflation).toBeGreaterThan(4);
  });

  it("refuses to invent a number when the correlation could not be estimated", () => {
    expect(moultonFactor(Number.NaN, 26)).toBeNaN();
  });
});

describe("grouping the gaps", () => {
  it("puts each decision's gap in its own game", () => {
    const { scored, gameOf } = noGameEffect(3, 4);
    const { groups } = gapsByGame(scored, gameOf);
    expect(groups.size).toBe(3);
    for (const values of groups.values()) expect(values).toHaveLength(4);
  });

  it("computes the same per-decision gap the detector does", () => {
    const { groups } = gapsByGame([decision("d", 0.8, false)], () => "g");
    // `decisionGap` is confidence minus one-if-accurate, and this module reuses it rather than
    // restating it: the confidence scale has already moved once.
    expect(groups.get("g")).toEqual([0.8]);
  });

  it("returns an empty grouping rather than throwing on an empty record", () => {
    expect(intraclassCorrelation(new Map())).toBeNaN();
  });
});
