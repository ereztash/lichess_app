/**
 * The bridge over the cold start, and the line it must not cross.
 *
 * shared/detector.ts puts the first real pattern at roughly 60-90 recorded decisions -- weeks for
 * a casual player, and docs/MEASUREMENTS.md says to expect longer against a real effect. A new
 * user's first session otherwise ends on a dashboard reporting six unmeasurable buckets.
 *
 * Imported games close that, but only halfway, and the half they cannot close is the point of the
 * product. They carry phase, time and clock; they cannot carry a confidence stated before the
 * engine spoke, because nobody was asked. Most of this file is about keeping that line visible.
 */
import { describe, expect, it } from "vitest";
import {
  decisionsFromGame,
  diagnoseImportedGames,
  worstBucketVerdict,
  worstMeasurableBucket,
  type ImportDiagnostic,
  type ImportedBucketReading,
  type ImportedGameInput,
} from "../../shared/import-diagnostic";
import { ACCURATE_CP_LOSS, BUCKETINGS, MIN_BUCKET_N } from "../../shared/detector";

const FULL = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/**
 * A game of `plies` half-moves. `lossEvery` controls how often White's move loses ground, which
 * is what moves the accuracy rate off 100%.
 */
function game(opts: {
  plies: number;
  withClocks: boolean;
  lossEvery?: number;
  timeControl?: string;
  playerColor?: "w" | "b";
  /** Seconds burned per move, before the increment is added back. */
  secondsPerMove?: number;
}): ImportedGameInput {
  const { plies, withClocks, lossEvery = 0, secondsPerMove = 20 } = opts;
  const fens = Array.from({ length: plies + 1 }, () => FULL);
  // White-relative. A drop after an odd ply is a loss for White.
  const evalScores = [0];
  for (let ply = 1; ply <= plies; ply++) {
    const previous = evalScores[ply - 1];
    const isWhiteMove = ply % 2 === 1;
    const loses = lossEvery > 0 && ply % lossEvery === 0;
    evalScores.push(previous + (loses ? (isWhiteMove ? -200 : 200) : 0));
  }
  const clockTimes = withClocks
    ? Array.from({ length: plies + 1 }, (_, i) => 600 - Math.floor(i / 2) * secondsPerMove)
    : [];
  return {
    fens,
    evalScores,
    clockTimes,
    timeControl: opts.timeControl,
    playerColor: opts.playerColor ?? "w",
  };
}

describe("it reads the player's own decisions, and only those", () => {
  it("takes White's moves for a White player and Black's for a Black one", () => {
    const white = decisionsFromGame(game({ plies: 10, withClocks: true }));
    const black = decisionsFromGame(game({ plies: 10, withClocks: true, playerColor: "b" }));
    expect(white.every((d) => d.ply % 2 === 1)).toBe(true);
    expect(black.every((d) => d.ply % 2 === 0)).toBe(true);
  });

  it("scores accuracy by the detector's rule, not by an exponential score", () => {
    // A 200cp drop is inaccurate; anything at or under ACCURATE_CP_LOSS is accurate. There is no
    // partial credit here, which is exactly the difference from eval-analysis's 0-100 score.
    const decisions = decisionsFromGame(game({ plies: 20, withClocks: true, lossEvery: 3 }));
    for (const d of decisions) {
      expect(d.accurate).toBe(d.cpLoss <= ACCURATE_CP_LOSS);
    }
    expect(decisions.some((d) => !d.accurate)).toBe(true);
  });
});

describe("the increment is added back", () => {
  it("does not report a 3-second move in a 300+3 game as instant", () => {
    /*
     * The bug this exists to prevent. The clock goes UP by the increment after each move, so
     * `previous - current` alone reports 0 for a move that genuinely took the increment's worth
     * of thinking -- and at this app's own 45-second threshold that sorts real thinking into
     * "under 45 seconds", the bucket the product cares most about.
     */
    const withIncrement = decisionsFromGame(
      game({ plies: 10, withClocks: true, timeControl: "300+3", secondsPerMove: 20 }),
    );
    const without = decisionsFromGame(
      game({ plies: 10, withClocks: true, timeControl: "300", secondsPerMove: 20 }),
    );
    expect(withIncrement[1].secondsTaken).toBe(without[1].secondsTaken + 3);
  });

  it("treats a time control it cannot parse as no increment rather than guessing", () => {
    const unknown = decisionsFromGame(
      game({ plies: 10, withClocks: true, timeControl: "-", secondsPerMove: 20 }),
    );
    expect(unknown[1].secondsTaken).toBe(20);
  });
});

describe("the clock a decision was made under", () => {
  it("reports the reading the player faced, not what was left after the move", () => {
    // 600 at the start, 20 seconds a move. At ply 3 White faced the clock as it stood after
    // ply 1 -- 600 -- not what remained after ply 3.
    const decisions = decisionsFromGame(game({ plies: 10, withClocks: true, secondsPerMove: 20 }));
    const atPly3 = decisions.find((d) => d.ply === 3)!;
    expect(atPly3.clockMsRemaining).toBe(600_000);
  });
});

describe("a PGN with no clocks", () => {
  const noClocks = [game({ plies: 200, withClocks: false, lossEvery: 3 })];

  it("says so, and says it about the source rather than the sample size", () => {
    /*
     * The common case, not the edge case: a 591-game Lichess export downloaded from the site's
     * own export page contains zero [%clk], because Lichess omits them unless the user ticks the
     * option. Telling that player to import more games is advice that cannot work.
     */
    const d = diagnoseImportedGames(noClocks);
    expect(d.missingClockData).toBe(true);
    for (const key of ["fast-under-45s", "slow-over-2m", "clock-under-1m"]) {
      const bucket = d.buckets.find((b) => b.key === key)!;
      expect(bucket.unmeasurableReason, `${key} blamed the sample size`).toBe("no-clock-data");
      expect(bucket.measurable).toBe(false);
    }
  });

  it("reports no n for a bucket it could not really place anything in", () => {
    // Without clocks `secondsTaken` is 0, and a 0 would drop every decision into "under 45
    // seconds". Reporting a count there would be reporting an artefact of the missing data.
    const d = diagnoseImportedGames(noClocks);
    expect(d.buckets.find((b) => b.key === "fast-under-45s")!.n).toBe(0);
  });

  it("still measures the phase buckets, which need no clock", () => {
    const d = diagnoseImportedGames(noClocks);
    const opening = d.buckets.find((b) => b.key === "phase-opening")!;
    expect(opening.n).toBeGreaterThan(0);
    expect(opening.unmeasurableReason).not.toBe("no-clock-data");
  });
});

describe("it never computes the thing it has no data for", () => {
  it("exposes no gap and no confidence anywhere in the reading", async () => {
    /*
     * Asserted against the source, not the object: the failure this guards is someone adding the
     * field later, and a shape assertion only sees today's fields. A gap needs a stated
     * confidence, and nobody was ever asked for one in a game already played.
     */
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const source = readFileSync(resolve(process.cwd(), "shared/import-diagnostic.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    for (const f of ["gap", "confidence", "meanConfidence"]) {
      expect(source, `import-diagnostic reaches for "${f}"`).not.toMatch(
        new RegExp(`\\b${f}\\b`),
      );
    }
  });
});

describe("silence has a reason, and every reading has its n", () => {
  it("withholds a rate under the threshold and says how it is short", () => {
    const thin = diagnoseImportedGames([game({ plies: 20, withClocks: true })]);
    const opening = thin.buckets.find((b) => b.key === "phase-opening")!;
    expect(opening.n).toBeLessThan(MIN_BUCKET_N);
    expect(opening.accurateRate).toBeNull();
    expect(opening.unmeasurableReason).toBe("too-few");
  });

  it("reports every shared bucket whether or not it can be read", () => {
    // By key, not by count: the count now also carries the import-only standing buckets, and a
    // bare number would pass while a shared bucket had quietly gone missing.
    const d = diagnoseImportedGames([game({ plies: 20, withClocks: true })]);
    for (const bucketing of BUCKETINGS) {
      expect(d.buckets.some((b) => b.key === bucketing.key), `${bucketing.key} missing`).toBe(true);
    }
  });

  it("adds the position buckets the live record cannot have", () => {
    const d = diagnoseImportedGames([game({ plies: 20, withClocks: true })]);
    for (const key of ["standing-winning", "standing-level", "standing-losing"]) {
      expect(d.buckets.some((b) => b.key === key), `${key} missing`).toBe(true);
    }
  });

  it("names no worst bucket when none is measurable", () => {
    // Null is the answer, and the screen has to render it as one rather than reach into an
    // unmeasurable bucket for something to say.
    const thin = diagnoseImportedGames([game({ plies: 10, withClocks: true })]);
    expect(worstMeasurableBucket(thin)).toBeNull();
  });

  it("names the lowest-accuracy measurable bucket when there is one", () => {
    const many = diagnoseImportedGames([game({ plies: 400, withClocks: true, lossEvery: 3 })]);
    const worst = worstMeasurableBucket(many);
    expect(worst).not.toBeNull();
    for (const b of many.buckets) {
      if (b.measurable && b.accurateRate !== null) {
        expect(worst!.accurateRate).toBeLessThanOrEqual(b.accurateRate);
      }
    }
  });
});

describe("the lowest number is not automatically a finding", () => {
  /** A diagnostic assembled directly, so the rates and n are exactly what the test means. */
  const withRates = (rates: Array<[number, number]>): ImportDiagnostic => ({
    buckets: rates.map(([accurateRate, n], i): ImportedBucketReading => ({
      key: `b${i}`,
      scope: `bucket ${i}`,
      n,
      accurateRate,
      measurable: true,
      unmeasurableReason: null,
    })),
    scored: rates.reduce((sum, [, n]) => sum + n, 0),
    forced: 0,
    missingClockData: false,
    timeBucketSpeed: null,
    excludedForSpeed: 0,
    speedMix: [],
  });

  it("refuses to name a weakest bucket when the rates are all within noise", () => {
    /*
     * Six rates spread over two points, each read over 40 decisions. There is a minimum -- there
     * is always a minimum -- and calling it the player's weakness is calling the sampling error a
     * finding. This is the state Section 4.5 separates from "not enough decisions": the decisions
     * are there, and they say nothing.
     */
    const verdict = worstBucketVerdict(
      withRates([[0.62, 40], [0.61, 40], [0.63, 40], [0.62, 40], [0.61, 40], [0.62, 40]]),
    )!;
    expect(verdict.separable).toBe(false);
    expect(verdict.separation).toBeLessThan(verdict.threshold);
  });

  it("names it when the gap is large enough to clear two standard errors", () => {
    const verdict = worstBucketVerdict(withRates([[0.30, 120], [0.75, 120], [0.78, 120]]))!;
    expect(verdict.separable).toBe(true);
    expect(verdict.worst.accurateRate).toBe(0.30);
    expect(verdict.runnerUp?.accurateRate).toBe(0.75);
  });

  it("gets stricter as the sample gets smaller, not looser", () => {
    // The same eight-point spread: unreadable at n=30, a finding at n=600. If this inverted, the
    // screen would be most confident exactly where it knows least.
    const spread: Array<[number, number]> = [[0.55, 30], [0.63, 30]];
    const wide: Array<[number, number]> = [[0.55, 600], [0.63, 600]];
    expect(worstBucketVerdict(withRates(spread))!.separable).toBe(false);
    expect(worstBucketVerdict(withRates(wide))!.separable).toBe(true);
  });

  it("will not call a lone bucket the worst, having nothing to compare it to", () => {
    const verdict = worstBucketVerdict(withRates([[0.4, 100]]))!;
    expect(verdict.runnerUp).toBeNull();
    expect(verdict.separable).toBe(false);
  });

  it("returns null when nothing is measurable at all", () => {
    expect(worstBucketVerdict(diagnoseImportedGames([]))).toBeNull();
  });

  it("agrees with worstMeasurableBucket about which one is lowest", () => {
    // Two functions, one ordering. If they drift the screen names one bucket and explains another.
    const d = withRates([[0.7, 50], [0.3, 50], [0.5, 50]]);
    expect(worstBucketVerdict(d)!.worst.key).toBe(worstMeasurableBucket(d)!.key);
  });
});

describe("pulling the clocks out of a real PGN", () => {
  it("indexes the readings so that index 0 is the starting clock", async () => {
    const { clockSecondsFromPgn } = await import("../../shared/pgn-clock");
    const pgn =
      '[TimeControl "300+3"]\n\n1. e4 { [%clk 0:04:58] } e5 { [%clk 0:04:57] } 2. Nf3 { [%clk 0:04:50] } *';
    // secondsSpentAt reads clockTimes[ply - 2], so index 0 has to be the clock before ply 2.
    expect(clockSecondsFromPgn(pgn)).toEqual([300, 298, 297, 290]);
  });

  it("reads h:mm:ss and m:ss alike", async () => {
    const { clockSecondsFromPgn } = await import("../../shared/pgn-clock");
    expect(clockSecondsFromPgn('[TimeControl "60"]\n\n1. e4 { [%clk 1:00:30] } *')[1]).toBe(3630);
    expect(clockSecondsFromPgn('[TimeControl "60"]\n\n1. e4 { [%clk 0:30] } *')[1]).toBe(30);
  });

  it("leaves the starting clock unknown rather than guessing it", async () => {
    /*
     * The tempting fill is the first [%clk] value, which is wrong by exactly one move's thinking
     * time -- and in a bucket named "under 45 seconds", one move's thinking time is the entire
     * measurement. NaN costs the readings for plies 2 and 3 and nothing else.
     */
    const { clockSecondsFromPgn, secondsSpentAt } = await import("../../shared/pgn-clock");
    const times = clockSecondsFromPgn("1. e4 { [%clk 0:04:58] } e5 { [%clk 0:04:57] } *");
    expect(Number.isNaN(times[0])).toBe(true);
    expect(secondsSpentAt(times, 2, 0)).toBeNull();
  });

  it("returns nothing at all for a PGN with no clock comments", async () => {
    const { clockSecondsFromPgn, hasClockData } = await import("../../shared/pgn-clock");
    const times = clockSecondsFromPgn('[TimeControl "300+3"]\n\n1. e4 e5 2. Nf3 *');
    expect(times).toEqual([]);
    expect(hasClockData(times)).toBe(false);
  });
});

describe("what the position looked like when the player decided", () => {
  /** A game where White is a rook up throughout, so every White decision is from a win. */
  function lopsided(cp: number, plies = 200): ImportedGameInput {
    return {
      fens: Array.from({ length: plies + 1 }, () => FULL),
      evalScores: Array.from({ length: plies + 1 }, () => cp),
      clockTimes: [],
      playerColor: "w",
    };
  }

  it("reads the eval the player faced, flipped to their side", async () => {
    const { standingFrom, decisionsFromGame: from } = await import("../../shared/import-diagnostic");
    // White-relative +200 is a win for White and a loss for Black. Reading it unflipped would
    // report Black as winning while two pawns down -- the same sign trap as cpLoss.
    expect(standingFrom(200)).toBe("winning");
    const asBlack = from({ ...lopsided(200, 10), playerColor: "b" });
    expect(asBlack.every((d) => d.standing === "losing")).toBe(true);
  });

  it("calls anything inside a pawn level rather than an edge", async () => {
    const { standingFrom, CLEAR_EDGE_CP } = await import("../../shared/import-diagnostic");
    expect(standingFrom(CLEAR_EDGE_CP - 1)).toBe("level");
    expect(standingFrom(-(CLEAR_EDGE_CP - 1))).toBe("level");
    expect(standingFrom(CLEAR_EDGE_CP)).toBe("winning");
    expect(standingFrom(-CLEAR_EDGE_CP)).toBe("losing");
  });

  it("costs no extra search: it reads a number already in the array", async () => {
    /*
     * Asserted against the source. The value is evalScores[ply - 1], which analyzePositions
     * already produced; anything that started searching for it would have turned a free reading
     * into a second pass over every position.
     */
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const src = readFileSync(resolve(process.cwd(), "shared/import-diagnostic.ts"), "utf8");
    expect(src).toMatch(/const evalBefore = game\.evalScores\[ply - 1\]/);
  });

  it("separates the buckets, so a policy difference can show up at all", () => {
    const winning = diagnoseImportedGames([lopsided(500)]);
    const w = winning.buckets.find((b) => b.key === "standing-winning")!;
    const l = winning.buckets.find((b) => b.key === "standing-losing")!;
    expect(w.n).toBeGreaterThan(0);
    expect(l.n).toBe(0);
  });
});

describe("a 45-second move is not one thing across time classes", () => {
  const withSpeed = (speed: string, plies: number): ImportedGameInput => ({
    fens: Array.from({ length: plies + 1 }, () => FULL),
    evalScores: Array.from({ length: plies + 1 }, () => 0),
    clockTimes: Array.from({ length: plies + 1 }, (_, i) => 600 - Math.floor(i / 2) * 20),
    playerColor: "w",
    speed,
  });

  it("reads the clock buckets on the dominant class only, and says how many it left out", () => {
    const d = diagnoseImportedGames([withSpeed("blitz", 200), withSpeed("rapid", 40)]);
    expect(d.timeBucketSpeed).toBe("blitz");
    expect(d.excludedForSpeed).toBe(20);
  });

  it("actually shrinks the clock bucket, not just the sentence about it", () => {
    /*
     * The control that caught this: asserting timeBucketSpeed and excludedForSpeed only checks
     * what the reading SAYS. Removing the filter left both fields correct while the bucket
     * quietly went on averaging blitz and rapid together -- a screen announcing a restriction it
     * had not applied.
     *
     * 200 blitz plies is 100 White decisions; the 40 rapid plies add 20 more. Every move here
     * takes 20 seconds, so all of them land in "under 45 seconds".
     */
    const d = diagnoseImportedGames([withSpeed("blitz", 200), withSpeed("rapid", 40)]);
    const fast = d.buckets.find((b) => b.key === "fast-under-45s")!;
    expect(fast.n).toBe(100);
    expect(d.scored).toBe(120);
  });

  it("leaves the phase and position buckets reading every game", () => {
    // Neither a phase nor the engine's verdict on a position means anything different in blitz.
    const d = diagnoseImportedGames([withSpeed("blitz", 200), withSpeed("rapid", 40)]);
    const opening = d.buckets.find((b) => b.key === "phase-opening")!;
    const level = d.buckets.find((b) => b.key === "standing-level")!;
    expect(level.n).toBe(d.scored);
    expect(opening.n).toBeGreaterThan(0);
  });

  it("reports the whole mix, largest first, rather than only the winner", () => {
    const d = diagnoseImportedGames([withSpeed("blitz", 200), withSpeed("rapid", 40)]);
    expect(d.speedMix.map((m) => m.speed)).toEqual(["blitz", "rapid"]);
    expect(d.speedMix[0].n).toBeGreaterThan(d.speedMix[1].n);
  });

  it("restricts nothing when the import carries no time class", () => {
    const d = diagnoseImportedGames([game({ plies: 100, withClocks: true })]);
    expect(d.timeBucketSpeed).toBeNull();
    expect(d.excludedForSpeed).toBe(0);
  });
});

describe("a position with one legal move is not a decision", () => {
  /** Black to move, king on h8, White queen h7 giving check: Kxh7 is the only legal reply. */
  const ONLY_MOVE = "7k/6Q1/8/8/8/8/8/K7 b - - 0 1";
  const FREE = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  const twoPly = (fenBefore: string, playerColor: "w" | "b"): ImportedGameInput => ({
    // One player decision at the ply whose preceding position is fenBefore.
    fens: playerColor === "w" ? [fenBefore, FREE] : [FREE, fenBefore, FREE],
    evalScores: playerColor === "w" ? [0, 0] : [0, 0, 0],
    clockTimes: [],
    playerColor,
  });

  it("marks the move as forced when only one is legal", () => {
    const [decision] = decisionsFromGame(twoPly(ONLY_MOVE, "b"));
    expect(decision.forced).toBe(true);
  });

  it("marks an ordinary position as a real choice", () => {
    const [decision] = decisionsFromGame(twoPly(FREE, "w"));
    expect(decision.forced).toBe(false);
  });

  it("keeps a forced move out of every bucket, and counts it", () => {
    /*
     * The whole point. cpLoss on a move with no alternative is whatever the engine's line was,
     * so it scores as accurate and credits the player for something they did not do.
     */
    const d = diagnoseImportedGames([twoPly(ONLY_MOVE, "b")]);
    expect(d.scored).toBe(1);
    expect(d.forced).toBe(1);
    for (const bucket of d.buckets) expect(bucket.n, `${bucket.key} counted a forced move`).toBe(0);
  });

  it("leaves `scored` as everything read, so the exclusion stays visible", () => {
    // Netting them off silently would drop every n with nothing on screen explaining why.
    const d = diagnoseImportedGames([twoPly(ONLY_MOVE, "b")]);
    expect(d.scored).toBeGreaterThan(d.scored - d.forced);
  });

  it("claims nothing about a position it cannot load", () => {
    const broken: ImportedGameInput = {
      fens: ["not a fen at all", FREE],
      evalScores: [0, 0],
      clockTimes: [],
      playerColor: "w",
    };
    expect(decisionsFromGame(broken)[0].forced).toBe(false);
  });
});
