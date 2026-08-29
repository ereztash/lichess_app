/**
 * A frozen corpus of REAL games, per real player, in the shape the import screen consumes.
 *
 * The import path has only ever met synthetic games. This is the other half of that fix: not a
 * different pipeline, just real input for the existing one -- whole games from whole players, with
 * the clock annotations, the mixed time classes and the openings that a person actually produces.
 *
 * WHY THE OPEN DATABASE AND NOT THE LICHESS API. The games-export endpoint answers 404 through this
 * environment's proxy. The open database (CC0) is the same games from the same players, and it has
 * one advantage for a harness: it is a fixed file, so a corpus built from it is reproducible from
 * the manifest rather than from whatever the account looked like that day.
 *
 * Usernames stay in the corpus file, which is gitignored, because `runImportDiagnostic` matches the
 * player's colour by name. Only the salted hash reaches the committed manifest.
 *
 * Run: npx tsx scripts/build_import_corpus.ts [--players N] [--games N] [--bytes N]
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { fetchPrefix, pgnGames, playerId } from "./build_blitz_research_dataset.js";

const MONTH = "2026-02";
const MIN_PLIES = 20;

interface HarnessGame {
  id: string;
  white: string;
  black: string;
  pgn: string;
  speed?: string;
}

const tagOf = (chunk: string, name: string) =>
  chunk.match(new RegExp(`\\[${name} "(.*?)"\\]`))?.[1] ?? "";

/**
 * Lichess's own time class, off the Event tag: "Rated Blitz game" -> "blitz".
 *
 * Tournament games are tagged "Rated Blitz tournament https://..." rather than "... game", and a
 * pattern anchored on "game" returned undefined for every one of them. A player whose window
 * happened to be tournament games then arrived with NO speed at all, which switches the product's
 * clock buckets from "the dominant class" to "every class at once" -- the exact averaging the
 * restriction exists to prevent, produced by the corpus rather than by the product.
 */
export function speedOf(chunk: string): string | undefined {
  const match = /Rated\s+(\w+)\s+(?:game|tournament|swiss)/i.exec(tagOf(chunk, "Event"));
  return match ? match[1].toLowerCase() : undefined;
}

/**
 * Whether a real game is one an import would have received.
 *
 * Deliberately looser than the blitz study's rule: an account import takes what the player played.
 * Clocks are required because three of the six buckets read them, and an abandoned game is dropped
 * because the product's own import filter drops it.
 */
export function admissible(chunk: string): HarnessGame | null {
  if (tagOf(chunk, "Termination") !== "Normal") return null;
  if (!chunk.includes("%clk")) return null;
  const white = tagOf(chunk, "White");
  const black = tagOf(chunk, "Black");
  const id = tagOf(chunk, "Site").split("/").pop() ?? "";
  if (!white || !black || !id) return null;
  const blank = chunk.indexOf("\n\n");
  if (blank < 0) return null;
  if ((chunk.slice(blank).match(/%clk/g)?.length ?? 0) < MIN_PLIES) return null;
  return { id, white, black, pgn: chunk, speed: speedOf(chunk) };
}

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : fallback;
}

async function main() {
  const outDir = process.argv.includes("--out")
    ? process.argv[process.argv.indexOf("--out") + 1]
    : "research/harness";
  const cacheDir = process.argv.includes("--cache")
    ? process.argv[process.argv.indexOf("--cache") + 1]
    : outDir;
  mkdirSync(outDir, { recursive: true });
  mkdirSync(cacheDir, { recursive: true });
  const wantedPlayers = arg("players", 5);
  const wantedGames = arg("games", 12);
  const prefixBytes = arg("bytes", 24_000_000);

  const path = await fetchPrefix(MONTH, prefixBytes, cacheDir);
  const byPlayer = new Map<string, HarnessGame[]>();
  let read = 0;
  let admitted = 0;
  for await (const chunk of pgnGames(path)) {
    read += 1;
    const game = admissible(chunk);
    if (!game) continue;
    admitted += 1;
    for (const name of [game.white, game.black]) {
      const list = byPlayer.get(name) ?? [];
      if (list.length < wantedGames) list.push(game);
      byPlayer.set(name, list);
    }
  }

  /*
   * Sorted by name rather than by "most games", so the selection cannot be read as picking the
   * players whose readings looked most interesting. The first N with a full window is a rule that
   * was fixed before anything was scored.
   */
  const chosen = [...byPlayer.entries()]
    .filter(([, games]) => games.length >= wantedGames)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(0, wantedPlayers);

  const players = chosen.map(([username, games]) => ({
    playerId: playerId(username),
    username,
    games,
  }));
  const provenance = {
    source: `https://database.lichess.org/standard/lichess_db_standard_rated_${MONTH}.pgn.zst`,
    month: MONTH,
    prefixBytes,
    gamesRead: read,
    gamesAdmissible: admitted,
    distinctPlayers: byPlayer.size,
    playersWithFullWindow: [...byPlayer.values()].filter((g) => g.length >= wantedGames).length,
    playersChosen: players.length,
    gamesPerPlayer: wantedGames,
    selection: "first N by username, fixed before anything was scored",
  };
  const body = JSON.stringify({ players, provenance }, null, 2);
  writeFileSync(`${outDir}/corpus.json`, body);
  writeFileSync(
    `${outDir}/corpus_manifest.json`,
    JSON.stringify(
      {
        ...provenance,
        players: players.map((p) => ({
          playerId: p.playerId,
          games: p.games.length,
          speeds: [...new Set(p.games.map((g) => g.speed))].sort(),
        })),
        corpusSha256: createHash("sha256").update(body).digest("hex"),
      },
      null,
      2,
    ),
  );
  process.stderr.write(`${JSON.stringify(provenance, null, 2)}\n`);
}

if (process.argv[1]?.endsWith("build_import_corpus.ts")) {
  main().catch((error) => {
    process.stderr.write(`${String(error)}\n`);
    process.exit(1);
  });
}
