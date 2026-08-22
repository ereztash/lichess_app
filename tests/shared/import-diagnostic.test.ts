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
  worstMeasurableBucket,
  type ImportedGameInput,
} from "../../shared/import-diagnostic";
import { ACCURATE_CP_LOSS, MIN_BUCKET_N } from "../../shared/detector";

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

  it("reports all six buckets whether or not they can be read", () => {
    const d = diagnoseImportedGames([game({ plies: 20, withClocks: true })]);
    expect(d.buckets).toHaveLength(6);
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
