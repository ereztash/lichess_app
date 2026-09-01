/**
 * A corpus of ONE NAMED ACCOUNT's real games, taken through the API the product itself calls.
 *
 * `build_import_corpus.ts` draws anonymous players out of the monthly open database, which is the
 * right instrument for "does the import path survive a real distribution" and the wrong one for the
 * question in `docs/research/ACCOUNT_BRIDGE_PREREG.md`: does the pre-registration bridge in
 * `shared/prereg.ts` register a hypothesis for A PARTICULAR PERSON, over the games that person
 * actually played, arriving the way the product would actually receive them. That needs a named
 * living account and there is no way to get one out of a dump.
 *
 * WHAT IT INHERITS RATHER THAN RESTATES. `admissible` and `playerId` are imported, not copied. The
 * admissibility rule is the thing the word "suitable" means in this study, and a second definition
 * of it here would be a second study wearing the first one's name.
 *
 * WHY `speed` COMES OFF THE JSON AND NOT OFF THE PGN. The API returns the time class as a
 * first-class field, and `speedOf` has now been wrong about that field twice for two different PGN
 * formats -- once for the open database's "Rated Blitz tournament", once for the API's "Hourly
 * SuperBlitz Arena", which cost half of one real account's corpus its class. Reading a display name
 * to recover a value the same response already carries is the defect, not the regex. So the field
 * is authoritative here, and `speedOf` is run beside it on every game purely as a CHECK: every
 * disagreement is counted into the manifest, where a future format change shows up as a number
 * instead of as a silently empty bucket.
 *
 * Usernames stay in the corpus file, which is gitignored, because `runImportDiagnostic` matches the
 * player's colour by name. Only the salted hash reaches the committed manifest.
 *
 * Needs LICHESS_API_TOKEN. Rated games are public, so the token only lifts the rate limit; nothing
 * here reads anything a logged-out request could not.
 *
 * Run: LICHESS_API_TOKEN=... npx tsx scripts/build_account_corpus.ts --user NAME [--games N] [--out DIR]
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { admissible, speedOf } from "./build_import_corpus.js";
import { playerId } from "./build_blitz_research_dataset.js";

const LICHESS = "https://lichess.org";

interface AccountGame {
  id: string;
  white: string;
  black: string;
  pgn: string;
  speed?: string;
}

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

/**
 * The whole rated history, newest first, in one streamed request.
 *
 * `pgnInJson` is what makes the cross-check in this file possible at all: one record carries both
 * the PGN the harness will parse and the `speed` the API assigned, so the two can be compared
 * without a second request that might not describe the same game.
 *
 * Cached on disk. A corpus rebuilt from a cache is reproducible; a corpus rebuilt from a second
 * fetch is whatever the account looked like the second time.
 */
async function fetchHistory(username: string, cachePath: string): Promise<string> {
  if (existsSync(cachePath)) return readFileSync(cachePath, "utf8");
  const token = process.env.LICHESS_API_TOKEN;
  if (!token) throw new Error("LICHESS_API_TOKEN is not set");
  const query = new URLSearchParams({
    rated: "true",
    clocks: "true",
    opening: "true",
    pgnInJson: "true",
    sort: "dateDesc",
  });
  const response = await fetch(`${LICHESS}/api/games/user/${encodeURIComponent(username)}?${query}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/x-ndjson" },
  });
  if (!response.ok) throw new Error(`lichess answered ${response.status} for ${username}`);
  const body = await response.text();
  writeFileSync(cachePath, body);
  return body;
}

async function main() {
  const username = arg("user", "");
  if (!username) throw new Error("--user is required");
  const outDir = arg("out", "research/harness-account");
  const wanted = Number(arg("games", "48"));
  mkdirSync(outDir, { recursive: true });

  const body = await fetchHistory(username, `${outDir}/history.ndjson`);
  const records = body
    .split("\n")
    .filter((line) => line.trim().startsWith("{"))
    .map((line) => JSON.parse(line) as { id: string; speed?: string; pgn?: string });

  const admitted: AccountGame[] = [];
  const rejected: Record<string, number> = {};
  /* The cross-check: what the PGN's Event tag implies, against what the API said it is. */
  let pgnSpeedAgreed = 0;
  let pgnSpeedMissing = 0;
  const pgnSpeedDisagreed: Array<{ id: string; api?: string; fromPgn?: string }> = [];

  for (const record of records) {
    if (!record.pgn) {
      rejected["no-pgn"] = (rejected["no-pgn"] ?? 0) + 1;
      continue;
    }
    const game = admissible(record.pgn);
    if (!game) {
      /* Named rather than pooled, so a corpus that shrinks says which rule shrank it. */
      const tag = (name: string) => record.pgn!.match(new RegExp(`\\[${name} "(.*?)"\\]`))?.[1] ?? "";
      const reason =
        tag("Termination") !== "Normal"
          ? `termination:${tag("Termination") || "none"}`
          : !record.pgn.includes("%clk")
            ? "no-clocks"
            : "under-20-plies";
      rejected[reason] = (rejected[reason] ?? 0) + 1;
      continue;
    }
    const fromPgn = speedOf(record.pgn);
    const api = record.speed?.toLowerCase();
    if (!fromPgn) pgnSpeedMissing += 1;
    else if (fromPgn === api) pgnSpeedAgreed += 1;
    else pgnSpeedDisagreed.push({ id: game.id, api, fromPgn });
    admitted.push({ ...game, speed: api ?? fromPgn });
  }

  /*
   * THE WINDOW, and it is the whole selection rule: the N most recent admissible games.
   *
   * `sort=dateDesc` on the request and no re-sorting here, so "most recent" is Lichess's ordering
   * and not a second opinion about it. Fixed in the preregistration before any position was scored,
   * because a window chosen after a reading is a window chosen for its reading.
   */
  const games = admitted.slice(0, wanted);
  const speeds = new Map<string, number>();
  for (const game of games) speeds.set(game.speed ?? "unknown", (speeds.get(game.speed ?? "unknown") ?? 0) + 1);

  const provenance = {
    source: `${LICHESS}/api/games/user/${username}?rated=true&clocks=true&opening=true&pgnInJson=true&sort=dateDesc`,
    fetchedAt: new Date().toISOString(),
    gamesReturned: records.length,
    gamesAdmissible: admitted.length,
    rejected,
    window: games.length,
    windowRule: "the N most recent admissible games, in the API's own dateDesc order -- fixed in ACCOUNT_BRIDGE_PREREG.md before anything was scored",
    speedsInWindow: Object.fromEntries([...speeds].sort((a, b) => b[1] - a[1])),
    /* The check, not the source. A number here means the PGN-only path would have been wrong. */
    pgnSpeedCheck: {
      agreed: pgnSpeedAgreed,
      missingFromPgn: pgnSpeedMissing,
      disagreed: pgnSpeedDisagreed.length,
      examples: pgnSpeedDisagreed.slice(0, 5),
    },
  };

  const players = [{ playerId: playerId(username), username, games }];
  const corpus = JSON.stringify({ players, provenance }, null, 2);
  writeFileSync(`${outDir}/corpus.json`, corpus);
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
        gameIds: games.map((g) => g.id),
        corpusSha256: createHash("sha256").update(corpus).digest("hex"),
      },
      null,
      2,
    ),
  );
  process.stderr.write(`${JSON.stringify(provenance, null, 2)}\n`);
}

if (process.argv[1]?.endsWith("build_account_corpus.ts")) {
  main().catch((error) => {
    process.stderr.write(`${String(error)}\n`);
    process.exit(1);
  });
}
