/**
 * The population baseline: how accurate everybody is, in each bucket the detector can look at.
 *
 * WHY THIS EXISTS. The repo's own measurement, on 380,310 real moves, found that the blunder rate
 * rises MONOTONICALLY with think time -- 1.55% under a second, 7.92% over thirty. That is not
 * thinking hurting. It is reverse causation: people think longer BECAUSE the position is hard, and
 * hard positions produce worse moves. The same confound sits inside "clock remaining", where the
 * apparent time-pressure effect is substantially "openings are easy and happen when the clock is
 * full".
 *
 * So a bucket's accuracy is mostly a property of the bucket. Telling a player "you are 8 points
 * less accurate when you think longer" is telling them a fact about chess, in the second person.
 * The baseline is what makes the sentence about them: their rate against everyone's rate, in the
 * same bucket, under the same rule.
 *
 * IT USES THE PRODUCT'S OWN DEFINITIONS AND NOT A PARALLEL SET, which is the whole point. Same
 * `classifyPhase`, same `BUCKETINGS` predicates, same `ACCURATE_WIN_PROBABILITY_LOSS`. A baseline
 * computed with its own idea of "accurate" would be a number from a different instrument, and
 * subtracting it would be arithmetic between two different measurements.
 *
 * WHAT IT IS NOT. It carries no stated confidence, because no imported game has one and none ever
 * will -- Lichess players were never asked. So this baselines the ACCURACY half of the gap and
 * nothing else. The confidence half has no population anywhere, which is the reference-class hole
 * the specification is explicit about.
 *
 * Corpus: the Lichess open database (CC0 -- "use them for research, commercial purpose,
 * publication, anything you like"), games carrying [%eval] and [%clk], terminating normally,
 * base time 180s or more. Positions past the opening book are kept; Regan's exclusion drops any
 * position already decided (|eval| > 300cp), because there every legal move "loses" almost
 * nothing and an accuracy rate measures the position rather than the player.
 *
 * Run: npx tsx scripts/build_population_baseline.ts <slice.pgn>
 */
import { closeSync, openSync, readSync, writeFileSync } from "node:fs";
import { Chess } from "chess.js";
import { classifyPhase } from "../shared/phase.js";
import {
  ACCURATE_WIN_PROBABILITY_LOSS,
  BUCKETINGS,
  type BucketableDecision,
} from "../shared/detector.js";
import { winProbabilityLoss } from "../shared/win-probability.js";

/** Regan's exclusion. Past this the position is decided and a move choice measures nothing. */
const DECIDED_CP = 300;
const MIN_BASE_SECONDS = 180;
/**
 * The smallest bucket this will publish a baseline for.
 *
 * The same discipline the rest of the instrument applies to a player's record, applied to the
 * corpus: a baseline computed from forty moves is a description of those forty. It matters here
 * because one bucket really is thin -- `slow-over-2m` barely occurs at these time controls, and
 * came in at 1,189 moves against 679,036 for `fast-under-45s`. Publishing a number from below
 * this floor would hand the detector a comparison that looks like a population and is a handful.
 */
const MIN_BASELINE_N = 500;
/** A mate score is an ordering, not a magnitude; clamp it to the edge of the decided window. */
const MATE_CP = 10_000;

interface Move extends BucketableDecision {
  accurate: boolean;
}

function movesFromGame(chunk: string, out: Move[]): void {
  {
    if (!chunk.includes("%eval") || !chunk.includes("%clk")) return;
    const tag = (name: string) => chunk.match(new RegExp(`\\[${name} "(.*?)"\\]`))?.[1] ?? "";
    if (tag("Termination") !== "Normal") return;
    const control = tag("TimeControl").split("+");
    const base = Number(control[0]);
    const increment = Number(control[1] ?? 0);
    if (!Number.isFinite(base) || base < MIN_BASE_SECONDS) return;

    const blank = chunk.indexOf("\n\n");
    if (blank < 0) return;
    const board = new Chess();
    /*
     * THE ANNOTATION SUFFIX IS OUTSIDE THE CAPTURE, and leaving it out was the bug that made the
     * first run of this script look plausible and be wrong. Lichess writes `2. f4?! { ... }`, and
     * a token pattern that stopped at `f4` left `?!` to fail the next match -- so `board.move()`
     * threw, the loop broke, and the REST OF THE GAME was discarded. Games break at their first
     * annotated move, which is usually early, so the survivors were overwhelmingly opening moves:
     * 9,106 of 10,112 scored moves landed in `phase-opening`, and the endgame bucket reported
     * 98.89% accuracy off ninety of them.
     *
     * Nothing about the resulting table looked alarming. What caught it was the denominator --
     * 10,112 scored moves out of 14,340 games is under one move per game.
     */
    const step = /([A-Za-z][\w+#=-]{1,6})[?!]*\s*\{([^}]*)\}/g;
    const clockOf: [number | null, number | null] = [null, null];
    let previousEval: number | null = null;
    let match: RegExpExecArray | null;
    let ply = 0;

    while ((match = step.exec(chunk.slice(blank + 2)))) {
      const white = board.turn() === "w";
      const fenBefore = board.fen();
      try {
        if (!board.move(match[1])) break;
      } catch {
        break;
      }
      ply += 1;

      const raw = match[2].match(/%eval (-?[\d.]+|#-?\d+)/)?.[1];
      const clock = match[2].match(/%clk (\d+):(\d+):([\d.]+)/);
      /* Lichess reports the evaluation from White's side; the mover's side is what matters. */
      const afterWhite =
        raw === undefined
          ? null
          : raw.startsWith("#")
            ? Number(raw.slice(1)) >= 0
              ? MATE_CP
              : -MATE_CP
            : Math.round(Number(raw) * 100);
      const after = afterWhite === null ? null : white ? afterWhite : -afterWhite;

      const seconds = clock
        ? Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3])
        : null;
      const side = white ? 0 : 1;
      const spent =
        seconds !== null && clockOf[side] !== null ? clockOf[side]! - seconds + increment : null;
      const remaining = seconds;
      if (seconds !== null) clockOf[side] = seconds;

      const before = previousEval;
      previousEval = after === null ? null : -after; // next mover's side
      if (before === null || after === null || spent === null || spent < 0) continue;
      if (Math.abs(before) > DECIDED_CP) continue;

      /*
       * `before` and `after` are both from the MOVER's side, so the loss is the drop between
       * them. Negative losses happen -- the opponent's reply can improve the position from the
       * mover's side once the engine looks deeper -- and are clamped to zero rather than counted
       * as credit.
       */
      const cpLoss = Math.max(0, before - after);
      out.push({
        phase: classifyPhase(fenBefore, ply - 1),
        secondsTaken: spent,
        clockMsRemaining: remaining === null ? null : Math.round(remaining * 1000),
        accurate: winProbabilityLoss(before, cpLoss) <= ACCURATE_WIN_PROBABILITY_LOSS,
      });
    }
  }
}

/*
 * STREAMED, NOT READ WHOLE. A useful corpus is hundreds of megabytes and Node cannot hold one as
 * a single string -- `readFileSync` on 645MB throws ERR_STRING_TOO_LONG. Games are split off a
 * rolling buffer and processed as they complete; the tail carries over to the next chunk.
 */
const moves: Move[] = [];
{
  const handle = openSync(process.argv[2], "r");
  const buffer = Buffer.allocUnsafe(1 << 22);
  let carry = "";
  for (;;) {
    const read = readSync(handle, buffer, 0, buffer.length, null);
    if (read === 0) break;
    const text = carry + buffer.toString("utf8", 0, read);
    const parts = text.split(/\n(?=\[Event )/);
    carry = parts.pop() ?? "";
    for (const game of parts) movesFromGame(game, moves);
  }
  if (carry) movesFromGame(carry, moves);
  closeSync(handle);
}
if (moves.length === 0) throw new Error("no scorable moves in the slice");

const rate = (rows: Move[]) => rows.filter((m) => m.accurate).length / rows.length;
const rows = BUCKETINGS.map((bucketing) => {
  const inside = moves.filter((m) => bucketing.predicate(m));
  const outside = moves.filter((m) => !bucketing.predicate(m));
  const enough = inside.length >= MIN_BASELINE_N && outside.length >= MIN_BASELINE_N;
  return {
    key: bucketing.key,
    n: inside.length,
    accuracy: enough ? rate(inside) : null,
    outsideN: outside.length,
    outsideAccuracy: enough ? rate(outside) : null,
  };
});

writeFileSync(
  "shared/population-baseline.ts",
  `/**
 * How accurate everybody is, per bucket. GENERATED by scripts/build_population_baseline.ts.
 *
 * WHAT IT IS FOR. A bucket's accuracy is mostly a property of the bucket. Measured here: people
 * think longer because the position is hard, so the slow bucket is less accurate for EVERYONE,
 * and telling a player that is telling them a fact about chess in the second person. Against this
 * baseline the same figure becomes a statement about them.
 *
 * Built with the product's own definitions -- \`classifyPhase\`, \`BUCKETINGS\`,
 * \`ACCURATE_WIN_PROBABILITY_LOSS\` -- because a baseline computed with its own idea of "accurate"
 * would be a number from a different instrument.
 *
 * NO CONFIDENCE HALF, and there never can be one from imported games: nobody asked those players
 * how sure they were. This baselines accuracy and nothing else.
 *
 * Corpus: Lichess open database (CC0), games with [%eval] and [%clk], terminating normally, base
 * time ${MIN_BASE_SECONDS}s or more, positions not already decided (|eval| <= ${DECIDED_CP}cp).
 * ${moves.length.toLocaleString("en-US")} scored moves.
 *
 * A BUCKET THE CORPUS CANNOT SUPPORT IS ABSENT, not zero and not guessed. ${MIN_BASELINE_N} moves
 * on each side is the floor, and buckets below it are left out entirely -- \`populationBucket\`
 * returns null for them and a caller must render that as "no baseline" rather than as a
 * comparison. Which buckets those are is a property of the corpus and is expected to change.
 */

/** Bump when the corpus or the rules change. Readings across versions are not comparable. */
export const POPULATION_BASELINE_VERSION = 1;

/** How many moves the baseline was built from. Carried so a caller can report its denominator. */
export const POPULATION_BASELINE_N = ${moves.length};

export interface PopulationBucket {
  key: string;
  /** Share of moves in this bucket the population played accurately. */
  accuracy: number;
  n: number;
  /** The same, for everything OUTSIDE the bucket -- the comparison the detector actually makes. */
  outsideAccuracy: number;
  outsideN: number;
}

export const POPULATION_BASELINE: readonly PopulationBucket[] = [
${rows
  .filter((r) => r.accuracy !== null && r.outsideAccuracy !== null)
  .map(
    (r) =>
      `  { key: ${JSON.stringify(r.key)}, accuracy: ${r.accuracy!.toFixed(5)}, n: ${r.n}, outsideAccuracy: ${r.outsideAccuracy!.toFixed(5)}, outsideN: ${r.outsideN} },`,
  )
  .join("\n")}
];

const BY_KEY = new Map(POPULATION_BASELINE.map((bucket) => [bucket.key, bucket]));

/**
 * The population's rates for one bucket, or null when the corpus has none.
 *
 * Null is a real answer, and callers must render it as "no baseline" rather than as a comparison
 * against zero. Every bucket the detector uses cleared the floor in THIS corpus, so nothing
 * returns null today -- but which buckets a corpus can support is a property of the corpus, and
 * a bucket that thins out in the next one must go absent rather than be filled in.
 */
export function populationBucket(key: string): PopulationBucket | null {
  return BY_KEY.get(key) ?? null;
}
`,
);

console.log(`scored moves: ${moves.length}`);
console.log(`overall accuracy: ${(rate(moves) * 100).toFixed(2)}%`);
for (const r of rows) {
  const inside = r.accuracy === null ? "  n/a" : `${(r.accuracy * 100).toFixed(2)}%`;
  const outside = r.outsideAccuracy === null ? "  n/a" : `${(r.outsideAccuracy * 100).toFixed(2)}%`;
  const delta =
    r.accuracy === null || r.outsideAccuracy === null
      ? ""
      : `  gap ${((r.accuracy - r.outsideAccuracy) * 100 >= 0 ? "+" : "") + ((r.accuracy - r.outsideAccuracy) * 100).toFixed(2)}pp`;
  console.log(`  ${r.key.padEnd(18)} in ${inside} (n=${String(r.n).padStart(6)})  out ${outside}${delta}`);
}
