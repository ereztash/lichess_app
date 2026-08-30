/**
 * A book measured from real games, rather than a list of openings somebody asserted.
 *
 * WHAT IT IS FOR. The import diagnostic's accuracy rate counts nearly every move a player made,
 * and this repository's own ledger calls that "a known defect in a number currently on screen":
 * `phase-opening` is `ply <= 20`, mostly theory, so it measures recall rather than decisions.
 * Excluding positions with exactly one legal move removes a handful of moves a game and leaves the
 * bulk of the inflation untouched.
 *
 * THE RULE, FIXED BEFORE ANY EFFECT WAS LOOKED AT: a position is book when at least **0.1% of the
 * reference games -- one in a thousand -- reached it**, among positions at ply <= 30. Frequency is
 * a property of the POSITION and is measured on a corpus the player is not in, so nothing here
 * conditions on what the player did or on how well they did it. Sensitivity at half and at double
 * that rate is reported beside it, so a reader can see how much the cut point carries.
 *
 * WHY NOT "the move played was the common reply". Because that conditions on the player's move,
 * and a player who leaves theory in a book position has made a decision, not avoided one. The
 * question the denominator asks is whether the POSITION was one a player arrives at prepared.
 *
 * Reuses `positionKey`: two knights out and back are the same position with different counters,
 * and a book keyed on whole FENs would miss every transposition into it.
 *
 * Run: npx tsx scripts/build_opening_book.ts [--bytes N]
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { Chess } from "chess.js";
import { fetchPrefix, pgnGames } from "./build_blitz_research_dataset.js";
import { bookKey } from "../shared/opening-book.js";

const MONTH = "2026-03";
/** Book is an opening phenomenon; past this the counting is wasted work. */
export const MAX_BOOK_PLY = 30;
/** One game in a thousand. Frozen before any effect on any rate was computed. */
export const BOOK_SHARE = 0.001;
/** Reported beside it so the reader can see how much the cut point carries. */
const SENSITIVITY = [0.0005, 0.002];

const MOVE_STEP = /([A-Za-z][\w+#=-]{1,6})[?!]*\s*(?:\{[^}]*\})?/g;

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : fallback;
}

/*
 * Keys are 32-bit FNV-1a over `positionKey`, computed by `shared/opening-book.ts` so the build and
 * the runtime cannot drift. A cryptographic hash would have been the obvious choice and is the
 * wrong one here: it is not available synchronously in a browser, and this is a membership test in
 * a set of a few hundred, not a security boundary. The collision rate is MEASURED below against
 * every position the corpus produced rather than argued from the birthday bound.
 */

async function main() {
  const outDir = process.argv.includes("--out")
    ? process.argv[process.argv.indexOf("--out") + 1]
    : "shared";
  const cacheDir = process.argv.includes("--cache")
    ? process.argv[process.argv.indexOf("--cache") + 1]
    : "research/harness";
  mkdirSync(cacheDir, { recursive: true });
  const prefixBytes = arg("bytes", 48_000_000);
  const path = await fetchPrefix(MONTH, prefixBytes, cacheDir);

  const counts = new Map<number, number>();
  let games = 0;
  for await (const chunk of pgnGames(path)) {
    const blank = chunk.indexOf("\n\n");
    if (blank < 0) continue;
    games += 1;
    const board = new Chess();
    const step = new RegExp(MOVE_STEP.source, "g");
    const movetext = chunk.slice(blank + 2);
    let match: RegExpExecArray | null;
    let ply = 0;
    /* The starting position is book by construction and is counted like any other. */
    const seen = new Set<number>([bookKey(board.fen())]);
    while (ply < MAX_BOOK_PLY && (match = step.exec(movetext))) {
      try {
        if (!board.move(match[1])) break;
      } catch {
        break;
      }
      ply += 1;
      seen.add(bookKey(board.fen()));
    }
    /* Once per game, so a repetition inside one game cannot make a position look popular. */
    for (const key of seen) counts.set(key, (counts.get(key) ?? 0) + 1);
    if (games % 20_000 === 0) process.stderr.write(`  ${games} games, ${counts.size} positions\n`);
  }

  const at = (share: number) =>
    [...counts.entries()].filter(([, n]) => n >= share * games).map(([k]) => k);
  const book = at(BOOK_SHARE).sort((a, b) => a - b);
  /*
   * How often the key collides on the corpus that produced it: how many DISTINCT positions outside
   * the book share a key with one inside it. Each such position would be mistaken for book, so
   * this is the structure's false-positive rate, measured rather than bounded.
   */
  const bookSet = new Set(book);
  const collisions = [...counts.keys()].filter((k) => bookSet.has(k)).length - book.length;
  const provenance = {
    source: `https://database.lichess.org/standard/lichess_db_standard_rated_${MONTH}.pgn.zst`,
    month: MONTH,
    prefixBytes,
    games,
    distinctPositions: counts.size,
    maxBookPly: MAX_BOOK_PLY,
    bookShare: BOOK_SHARE,
    bookPositions: book.length,
    keyCollisionsOnCorpus: collisions,
    sensitivity: Object.fromEntries(SENSITIVITY.map((s) => [s, at(s).length])),
  };
  process.stderr.write(`${JSON.stringify(provenance, null, 2)}\n`);

  const body = `/**
 * Positions a player arrives at prepared, measured rather than asserted.
 *
 * GENERATED by scripts/build_opening_book.ts. Do not edit by hand.
 *
 * A position is here when at least ${(BOOK_SHARE * 100).toFixed(2)}% of ${games.toLocaleString("en-US")} real Lichess games -- one in
 * ${Math.round(1 / BOOK_SHARE).toLocaleString("en-US")} -- reached it within the first ${MAX_BOOK_PLY} plies. The rule was fixed before its effect on any
 * accuracy rate was computed, and the effect is reported in docs/MEASUREMENTS.md.
 *
 * WHAT IT IS NOT. Not a claim that these positions are easy, and not a claim about the move the
 * player chose: a player who leaves theory here has made a decision. It is a claim about the
 * POSITION -- that reaching it is common enough that arriving prepared is the norm -- which is
 * what the accuracy rate's denominator needs, because conditioning on the player's move would
 * condition on the outcome.
 *
 * Keys are 32-bit FNV-1a over \`positionKey\`, so a transposition into a book position is the same
 * entry and the two FEN fields that are a record of the GAME are dropped. Measured on the
 * \${counts.size.toLocaleString("en-US")} distinct positions this corpus produced: \${collisions} collisions with a book key.
 *
 * At half this rate the book would hold ${at(0.0005).length.toLocaleString("en-US")} positions; at double it, ${at(0.002).length.toLocaleString("en-US")}.
 */
export const BOOK_PROVENANCE = ${JSON.stringify(provenance, null, 2)} as const;
`;
  writeFileSync(`${outDir}/opening-book-provenance.ts`, body);
  writeFileSync(
    `${outDir}/opening-book-keys.ts`,
    `/**
 * GENERATED by scripts/build_opening_book.ts. Do not edit by hand. See opening-book.ts.
 *
 * Kept in its own module so it can be loaded on demand: ${book.length} keys is roughly ${Math.round((book.length * 11) / 1024)} kB, and the
 * entry chunk's budget has about 2 kB of headroom. The import path pulls this in when a player
 * asks for a scan, the way the engine's wasm is held out of the initial graph.
 */
export const BOOK_KEYS: ReadonlySet<number> = new Set(${JSON.stringify(book)});
`,
  );
  writeFileSync(
    `${cacheDir}/opening_book_manifest.json`,
    JSON.stringify({ ...provenance, sha256: createHash("sha256").update(book.join(",")).digest("hex") }, null, 2),
  );
}

if (process.argv[1]?.endsWith("build_opening_book.ts")) {
  main().catch((error) => {
    process.stderr.write(`${String(error)}\n`);
    process.exit(1);
  });
}
