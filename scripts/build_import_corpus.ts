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
   * STRATIFIED BY TIME CLASS, and the first version of this was not -- which is the whole reason
   * the stratification is here.
   *
   * "The first N players by username with a full window" sounds neutral and is not: a player with
   * a dozen games inside a short slice of one month is a player who finishes games quickly, so
   * every one of the first five was a bullet or ultrabullet player. In the corpus that produced,
   * 100% of decisions took under 45 seconds -- so `fast-under-45s` held everything, its comparison
   * set was empty, and `slow-over-2m` could never fill. A control built on that corpus would have
   * been validating the detector on a world where two of its six buckets do not exist.
   *
   * Within a class the rule is still the neutral one: sorted by username, first N. The order the
   * classes are drawn in is fixed here rather than by how many players each turned out to have.
   */
  const CLASS_ORDER = ["classical", "rapid", "blitz", "bullet", "ultrabullet"];
  const dominant = (games: HarnessGame[]) => {
    const counts = new Map<string, number>();
    for (const g of games) counts.set(g.speed ?? "unknown", (counts.get(g.speed ?? "unknown") ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  };
  const eligible = [...byPlayer.entries()]
    .filter(([, games]) => games.length >= wantedGames)
    .sort(([a], [b]) => (a < b ? -1 : 1));
  const byClass = new Map<string, Array<[string, HarnessGame[]]>>();
  for (const entry of eligible) {
    const key = dominant(entry[1]);
    (byClass.get(key) ?? byClass.set(key, []).get(key)!).push(entry);
  }
  const chosen: Array<[string, HarnessGame[]]> = [];
  for (let round = 0; chosen.length < wantedPlayers; round += 1) {
    let added = 0;
    for (const key of [...CLASS_ORDER, ...[...byClass.keys()].filter((k) => !CLASS_ORDER.includes(k))]) {
      const pool = byClass.get(key);
      if (pool && round < pool.length && chosen.length < wantedPlayers) {
        chosen.push(pool[round]);
        added += 1;
      }
    }
    if (!added) break;
  }

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
    selection:
      "stratified by the player's dominant time class, then first N by username within each -- " +
      "both rules fixed before anything was scored",
    classesAvailable: Object.fromEntries(
      [...byClass.entries()].map(([k, v]) => [k, v.length]),
    ),
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
