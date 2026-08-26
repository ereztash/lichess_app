/**
 * How much the phase of a game says about how hard a position is for a person.
 *
 * WHY THIS EXISTS. The dashboard splits a record by phase and reports each bucket against a
 * population baseline built from this product's own accuracy rule -- a move is accurate when it
 * costs at most `ACCURATE_WIN_PROBABILITY_LOSS`. On 693,130 real Lichess moves that rule says the
 * middlegame is 12.6 points harder than everything else and the ENDGAME IS THE EASIEST PHASE OF
 * THE GAME by a wide margin (78.4% accurate against 70.3% in the opening).
 *
 * That is a statement about the rule. Whether it is also a statement about PEOPLE is a different
 * question, and it has an external answer that this product had never consulted.
 *
 * THE CORPUS. The Lichess puzzle database (CC0), which carries a Glicko rating per position
 * derived from how many real players solved it -- item difficulty measured on humans rather than
 * inferred from an engine. It also tags each position `opening`, `middlegame` or `endgame` with
 * Lichess's own definitions.
 *
 * WHAT IT IS AND IS NOT COMPARABLE TO. A puzzle rating is the difficulty of finding a unique
 * winning move in a SELECTED tactical position. The product's accuracy rate is the difficulty of
 * not losing 30 centipawns on an ORDINARY move. Those are different constructs and their
 * magnitudes must never be subtracted from one another. Two things survive that gap:
 *
 *   1. the ORDER of the phases, which either agrees or does not;
 *   2. how much of the variance in human difficulty the phase label explains AT ALL, which is a
 *      statement made entirely inside the puzzle corpus and needs no bridge to the other one.
 *
 * The second is what reaches a screen. The first goes in docs/RESEARCH_EVIDENCE.md with its
 * caveat attached, because it compares two corpora.
 *
 * Run once, output committed. Takes the PLAIN csv -- decompressed outside this script rather than
 * by adding a zstd dependency to the product for a generator that runs once:
 *   curl -O https://database.lichess.org/lichess_db_puzzle.csv.zst
 *   python3 -c "import zstandard,sys;zstandard.ZstdDecompressor().copy_stream(open('lichess_db_puzzle.csv.zst','rb'),open('puzzles.csv','wb'))"
 *   npx tsx scripts/build_phase_difficulty_reference.ts puzzles.csv
 */
import { createReadStream, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { resolve } from "node:path";
import { PHASES } from "../shared/decision-atom.js";

/**
 * A Glicko rating with a large deviation, or one nobody has attempted, is not a measurement of
 * difficulty -- it is the prior. Both cuts are reported in the output so the filter is part of
 * the record rather than a choice hidden inside it.
 */
const MAX_RATING_DEVIATION = 100;
const MIN_PLAYS = 100;

type Bucket = { phase: string; ratings: number[] };

async function main() {
  const source = process.argv[2];
  if (!source) throw new Error("usage: build_phase_difficulty_reference.ts <puzzles.csv>");

  const buckets = new Map<string, Bucket>(PHASES.map((p) => [p, { phase: p, ratings: [] }]));
  let read = 0;
  let kept = 0;

  const lines = createInterface({
    input: createReadStream(source),
    crlfDelay: Infinity,
  });
  let header: string[] | null = null;
  for await (const line of lines) {
    if (!header) {
      header = line.split(",");
      continue;
    }
    read += 1;
    const cells = line.split(",");
    const at = (name: string) => cells[header!.indexOf(name)];
    const rating = Number(at("Rating"));
    const deviation = Number(at("RatingDeviation"));
    const plays = Number(at("NbPlays"));
    if (!Number.isFinite(rating) || deviation > MAX_RATING_DEVIATION || plays < MIN_PLAYS) continue;
    /*
     * EXACTLY ONE PHASE TAG. Lichess tags a handful of positions with two, and a position counted
     * in both buckets would make the between-group term partly a comparison of a set with itself.
     */
    const themes = (at("Themes") ?? "").split(" ");
    const tagged = PHASES.filter((phase) => themes.includes(phase));
    if (tagged.length !== 1) continue;
    buckets.get(tagged[0])!.ratings.push(rating);
    kept += 1;
  }

  const groups = [...buckets.values()].filter((b) => b.ratings.length > 0);
  const all = groups.flatMap((b) => b.ratings);
  const mean = (xs: number[]) => xs.reduce((t, x) => t + x, 0) / xs.length;
  const grand = mean(all);
  const between = groups.reduce((t, b) => t + b.ratings.length * (mean(b.ratings) - grand) ** 2, 0);
  const total = all.reduce((t, x) => t + (x - grand) ** 2, 0);
  const varianceExplained = between / total;

  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  };
  const sd = (xs: number[]) => Math.sqrt(mean(xs.map((x) => (x - mean(xs)) ** 2)));

  const rows = groups
    .map((b) => ({
      phase: b.phase,
      n: b.ratings.length,
      median: Math.round(median(b.ratings)),
      sd: Math.round(sd(b.ratings)),
    }))
    .sort((a, b) => a.median - b.median);

  const out = `/**
 * How much a game's phase says about how hard a position is FOR A PERSON.
 *
 * GENERATED by scripts/build_phase_difficulty_reference.ts from the Lichess puzzle database
 * (CC0), which carries a Glicko rating per position derived from real human solve attempts. Do
 * not edit by hand.
 *
 * THE NUMBER THAT MATTERS IS THE LAST ONE. Across ${kept.toLocaleString("en-US")} human-rated
 * positions, the phase label explains ${(varianceExplained * 100).toFixed(2)}% of the variance in
 * difficulty. The product's own corpus finds a real and large difference between phases on its
 * accuracy rule -- and that difference turns out to be almost entirely a property of the rule,
 * not of how hard the positions are for people.
 *
 * WHAT THIS IS NOT. A puzzle rating measures finding a unique winning move in a SELECTED tactical
 * position; the product's accuracy rate measures not losing 30 centipawns on an ORDINARY move.
 * The two magnitudes are not commensurable and must never be subtracted. What is carried here is
 * a statement made entirely inside the puzzle corpus: how much the phase label explains.
 *
 * Filter: RatingDeviation <= ${MAX_RATING_DEVIATION}, NbPlays >= ${MIN_PLAYS}, exactly one phase
 * tag. ${read.toLocaleString("en-US")} rows read.
 */

/** Bump when the corpus or the filter changes. Readings across versions are not comparable. */
export const PHASE_DIFFICULTY_VERSION = 1;

/** Human-rated positions behind the figure below. */
export const PHASE_DIFFICULTY_N = ${kept};

/**
 * eta-squared: the share of variance in human-measured difficulty explained by the phase label.
 *
 * Reported to four places because the whole point is how SMALL it is, and rounding it to two
 * would print 0.00 and read as "not measured" rather than "measured, and nearly nothing".
 */
export const PHASE_VARIANCE_EXPLAINED = ${varianceExplained.toFixed(4)};

export interface PhaseDifficulty {
  phase: string;
  /** Human solve difficulty, in Glicko rating points. Higher is harder. */
  median: number;
  sd: number;
  n: number;
}

/** Easiest first, by median. */
export const PHASE_DIFFICULTY: readonly PhaseDifficulty[] = ${JSON.stringify(rows, null, 2)};

/** Null rather than a default: a phase the corpus does not rate is not a phase rated zero. */
export function phaseDifficulty(phase: string): PhaseDifficulty | null {
  return PHASE_DIFFICULTY.find((row) => row.phase === phase) ?? null;
}
`;
  writeFileSync(resolve(import.meta.dirname, "../shared/phase-difficulty.ts"), out);
  console.log(`read ${read}, kept ${kept}, eta^2 ${varianceExplained.toFixed(4)}`);
  for (const row of rows) console.log(`  ${row.phase.padEnd(11)} n=${row.n} median=${row.median}`);
}

void main();
