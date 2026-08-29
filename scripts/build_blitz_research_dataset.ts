/**
 * Decision events for the blitz-computation study, from the Lichess open database.
 *
 * WHAT THIS DOES NOT DO: it does not invent a second definition of think time, of the clock a
 * player faced, or of what phase a position is in. All three come from the modules the product
 * itself uses -- `shared/pgn-clock.ts` and `shared/phase.ts` -- because a research corpus computed
 * with its own idea of "seconds spent" would be measuring a different thing from the product it is
 * supposed to inform. See docs/research/BLITZ_COMPUTATION_PREREG.md §2.
 *
 * The unit is the position the player was deciding IN (`fenBefore`) and the clock they SAW
 * (`clockMsRemainingAt`, the reading before the move). Both are stated in the preregistration and
 * both are easy to get backwards.
 *
 * Corpus: https://database.lichess.org/ (CC0). Byte-range prefixes of two monthly files are
 * streamed and decompressed; nothing is downloaded whole.
 *
 * Run: npx tsx scripts/build_blitz_research_dataset.ts [--out DIR] [--bytes N] [--games N]
 */
import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { writeFileSync } from "node:fs";
import { zstdDecompressSync } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Chess } from "chess.js";
import {
  clockMsRemainingAt,
  clockSecondsFromPgn,
  parseTimeControl,
  secondsSpentAt,
  timeControlHeader,
} from "../shared/pgn-clock.js";
import { classifyPhase, nonPawnMaterial } from "../shared/phase.js";

// ---------------------------------------------------------------------------------------------
// Frozen configuration. Every number here is in the preregistration; none may be tuned to a result.
// ---------------------------------------------------------------------------------------------

export const SEED = 20260829;
/** Salt for the player pseudonym. Public and fixed: the point is grouping, not secrecy. */
export const PLAYER_SALT = "blitz-computation-2026";
const MONTHS = { dev: "2026-01", holdout: "2026-04" } as const;
const BASE_URL = "https://database.lichess.org/standard";
/** Blitz on Lichess. The prereg fixes base and increment rather than trusting the Event tag alone. */
const ALLOWED_BASE = new Set([180, 300]);
const MAX_INCREMENT = 3;
const MIN_PLIES = 20;
/** Seconds of slack allowed on the clock-monotonicity check, for PGN rounding. */
const CLOCK_TOLERANCE = 1;
/** Decisions sampled per game. */
const PLIES_PER_GAME = 6;
/** Recurring players used for the within-player temporal holdout. */
const MAX_RECURRING_PLAYERS = 300;
const GAMES_PER_PLAYER_PER_MONTH = 2;

export interface DecisionEvent {
  gameId: string;
  playerId: string;
  opponentId: string;
  month: string;
  stratum: "recurring" | "general";
  fenBefore: string;
  actualMoveSan: string;
  actualMoveUci: string;
  ply: number;
  elo: number;
  opponentElo: number;
  timeControl: string;
  baseSeconds: number;
  incrementSeconds: number;
  thinkTimeSeconds: number;
  clockBeforeSeconds: number;
  phase: "opening" | "middlegame" | "endgame";
  moverIsWhite: boolean;
  legalMoveCount: number;
  nonPawnMaterial: number;
  inCheck: boolean;
}

/** Deterministic PRNG. A research corpus that cannot be rebuilt byte-for-byte is not a corpus. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function playerId(username: string): string {
  return createHash("sha1")
    .update(`${PLAYER_SALT}:${username.toLowerCase()}`)
    .digest("hex")
    .slice(0, 16);
}

const tagOf = (chunk: string, name: string) =>
  chunk.match(new RegExp(`\\[${name} "(.*?)"\\]`))?.[1] ?? "";

export interface GameHeader {
  gameId: string;
  white: string;
  black: string;
  whiteElo: number;
  blackElo: number;
  timeControl: string;
  baseSeconds: number;
  incrementSeconds: number;
  plies: number;
}

export type Rejection =
  | "not-rated-blitz"
  | "termination"
  | "time-control"
  | "missing-elo"
  | "no-clocks"
  | "too-short"
  | "clock-not-monotone"
  | "unplayable";

/**
 * Game-level admission. Returns the header, or the single rule that rejected the game.
 *
 * Exported so a test can drive it on a fixture rather than on the network.
 */
export function qualifyGame(chunk: string): GameHeader | Rejection {
  if (!tagOf(chunk, "Event").includes("Rated Blitz")) return "not-rated-blitz";
  if (tagOf(chunk, "Termination") !== "Normal") return "termination";
  const control = parseTimeControl(timeControlHeader(chunk));
  if (
    !control ||
    !ALLOWED_BASE.has(control.baseSeconds) ||
    control.incrementSeconds > MAX_INCREMENT
  )
    return "time-control";
  const whiteElo = Number(tagOf(chunk, "WhiteElo"));
  const blackElo = Number(tagOf(chunk, "BlackElo"));
  if (!Number.isFinite(whiteElo) || !Number.isFinite(blackElo) || !whiteElo || !blackElo)
    return "missing-elo";

  const clocks = clockSecondsFromPgn(chunk);
  if (clocks.length < 2) return "no-clocks";
  const plies = clocks.length - 1;
  if (plies < MIN_PLIES) return "too-short";

  /*
   * A clock that gains more than the increment allows is a corrupted stream, and it corrupts the
   * one variable this study is about. Dropped whole rather than per-ply: a game whose clock lies
   * once has no claim to be believed on the plies where it happens to look fine.
   */
  for (let ply = 2; ply <= plies; ply += 1) {
    const spent = secondsSpentAt(clocks, ply, control.incrementSeconds);
    if (spent === null) continue;
    if (spent > control.baseSeconds + control.incrementSeconds + CLOCK_TOLERANCE)
      return "clock-not-monotone";
    const before = clocks[ply - 2];
    if (clocks[ply] > before + control.incrementSeconds + CLOCK_TOLERANCE)
      return "clock-not-monotone";
  }

  const white = tagOf(chunk, "White");
  const black = tagOf(chunk, "Black");
  const site = tagOf(chunk, "Site");
  const gameId = site.split("/").pop() ?? "";
  if (!white || !black || !gameId) return "unplayable";

  return {
    gameId,
    white,
    black,
    whiteElo,
    blackElo,
    timeControl: `${control.baseSeconds}+${control.incrementSeconds}`,
    baseSeconds: control.baseSeconds,
    incrementSeconds: control.incrementSeconds,
    plies,
  };
}

const MOVE_STEP = /([A-Za-z][\w+#=-]{1,6})[?!]*\s*\{([^}]*)\}/g;

/**
 * Every ply of a game that could carry a decision, with the position the player faced.
 *
 * Not sampled here -- sampling is the caller's, so the eligibility rule and the sampling rule stay
 * separable and separately testable.
 */
export function eligiblePlies(chunk: string, header: GameHeader): DecisionEvent[] {
  const clocks = clockSecondsFromPgn(chunk);
  const blank = chunk.indexOf("\n\n");
  if (blank < 0) return [];
  const movetext = chunk.slice(blank + 2);
  const board = new Chess();
  const out: DecisionEvent[] = [];
  const step = new RegExp(MOVE_STEP.source, "g");
  let match: RegExpExecArray | null;
  let ply = 0;

  while ((match = step.exec(movetext))) {
    ply += 1;
    const fenBefore = board.fen();
    const moverIsWhite = board.turn() === "w";
    const legalMoves = board.moves();
    const inCheck = board.isCheck();
    const material = nonPawnMaterial(fenBefore);
    let made;
    try {
      made = board.move(match[1]);
    } catch {
      break;
    }
    if (!made) break;

    if (ply < 2) continue;
    if (legalMoves.length < 2) continue;
    const thinkTime = secondsSpentAt(clocks, ply, header.incrementSeconds);
    const clockBeforeMs = clockMsRemainingAt(clocks, ply);
    if (thinkTime === null || clockBeforeMs === null) continue;
    if (thinkTime > header.baseSeconds + header.incrementSeconds) continue;

    const white = playerId(header.white);
    const black = playerId(header.black);
    out.push({
      gameId: header.gameId,
      playerId: moverIsWhite ? white : black,
      opponentId: moverIsWhite ? black : white,
      month: "",
      stratum: "general",
      fenBefore,
      actualMoveSan: made.san,
      actualMoveUci: `${made.from}${made.to}${made.promotion ?? ""}`,
      ply,
      elo: moverIsWhite ? header.whiteElo : header.blackElo,
      opponentElo: moverIsWhite ? header.blackElo : header.whiteElo,
      timeControl: header.timeControl,
      baseSeconds: header.baseSeconds,
      incrementSeconds: header.incrementSeconds,
      thinkTimeSeconds: thinkTime,
      clockBeforeSeconds: clockBeforeMs / 1000,
      phase: classifyPhase(fenBefore, ply),
      moverIsWhite,
      legalMoveCount: legalMoves.length,
      nonPawnMaterial: material,
      inCheck,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Streaming
// ---------------------------------------------------------------------------------------------

export async function fetchPrefix(month: string, bytes: number, dir: string): Promise<string> {
  const path = `${dir}/lichess_${month}.prefix.zst`;
  if (existsSync(path) && statSync(path).size >= bytes) return path;
  const url = `${BASE_URL}/lichess_db_standard_rated_${month}.pgn.zst`;
  process.stderr.write(`fetching ${url} bytes=0-${bytes - 1}\n`);
  const response = await fetch(url, { headers: { Range: `bytes=0-${bytes - 1}` } });
  if (!response.ok || !response.body) throw new Error(`fetch ${month}: HTTP ${response.status}`);
  await pipeline(response.body as unknown as NodeJS.ReadableStream, createWriteStream(path));
  return path;
}

/**
 * The compressed frames of a Lichess archive, in order.
 *
 * THE DEFECT THIS EXISTS FOR, and it is silent. These files are not one zstd stream: they are a
 * sequence of [skippable frame][zstd frame] pairs, each frame decompressing to exactly 32 MiB.
 * Node's `createZstdDecompress` decodes the first frame, meets the next skippable frame's header
 * and fails with `Unknown frame descriptor` -- after emitting 33,554,432 bytes. A 4 MB prefix and
 * a 48 MB prefix therefore yielded almost the same number of games (12,448 and 14,472), and
 * nothing about either figure looked wrong. `zstd` and Python's `zstandard` walk past skippable
 * frames, which is why the format was not obvious from a probe.
 *
 * Frames are located by their 16-byte boundary signature: skippable magic, a payload length of
 * exactly 4, four bytes of payload, then the zstd magic. A false positive would need those twelve
 * fixed bytes to occur inside compressed data.
 */
export function zstdFrameOffsets(buf: Buffer): number[] {
  const SKIPPABLE = 0x184d2a50;
  const ZSTD = 0xfd2fb528;
  const offsets: number[] = [];
  const magic = Buffer.from([0x50, 0x2a, 0x4d, 0x18]);
  for (
    let at = buf.indexOf(magic);
    at >= 0 && at + 16 <= buf.length;
    at = buf.indexOf(magic, at + 1)
  ) {
    if (buf.readUInt32LE(at) !== SKIPPABLE) continue;
    if (buf.readUInt32LE(at + 4) !== 4) continue;
    if (buf.readUInt32LE(at + 12) !== ZSTD) continue;
    offsets.push(at + 12);
  }
  return offsets;
}

/**
 * Yields one PGN game chunk at a time from a zstd prefix, tolerating the truncated tail.
 *
 * A game straddles a frame boundary about once per frame, so the leftover text is carried across
 * rather than discarded -- otherwise one game in every 32 MiB would be silently corrupted, and the
 * corruption would land on whichever game happened to be there.
 */
export async function* pgnGames(path: string): AsyncGenerator<string> {
  const buf = readFileSync(path);
  const offsets = zstdFrameOffsets(buf);
  let carry = "";
  for (let i = 0; i < offsets.length; i += 1) {
    const end = i + 1 < offsets.length ? offsets[i + 1] - 12 : buf.length;
    let text: string;
    try {
      text = zstdDecompressSync(buf.subarray(offsets[i], end)).toString("utf8");
    } catch {
      break; // the prefix ends mid-frame by construction
    }
    const parts = (carry + text).split(/\n\n(?=\[Event )/);
    carry = parts.pop() ?? "";
    for (const part of parts) yield part;
    // Yield to the event loop so a long scan does not starve the fetch of the next month.
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  // The final carry is dropped: a prefix cuts a game in half, and half a game is not a game.
}

interface Counters {
  read: number;
  qualified: number;
  rejected: Record<string, number>;
}

async function indexMonth(path: string, counters: Counters) {
  const byPlayer = new Map<string, string[]>();
  const headers = new Map<string, GameHeader>();
  for await (const chunk of pgnGames(path)) {
    counters.read += 1;
    const result = qualifyGame(chunk);
    if (typeof result === "string") {
      counters.rejected[result] = (counters.rejected[result] ?? 0) + 1;
      continue;
    }
    counters.qualified += 1;
    headers.set(result.gameId, result);
    for (const name of [result.white, result.black]) {
      const id = playerId(name);
      const list = byPlayer.get(id) ?? [];
      list.push(result.gameId);
      byPlayer.set(id, list);
    }
  }
  return { byPlayer, headers };
}

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : fallback;
}

async function main() {
  const outDir = process.argv.includes("--out")
    ? process.argv[process.argv.indexOf("--out") + 1]
    : "research/blitz/data";
  const cacheDir = process.argv.includes("--cache")
    ? process.argv[process.argv.indexOf("--cache") + 1]
    : outDir;
  mkdirSync(outDir, { recursive: true });
  mkdirSync(cacheDir, { recursive: true });
  const prefixBytes = arg("bytes", 48_000_000);
  const targetGames = arg("games", 1400);

  const counters: Record<string, Counters> = {};
  const paths: Record<string, string> = {};
  const index: Record<string, Awaited<ReturnType<typeof indexMonth>>> = {};
  for (const month of Object.values(MONTHS)) {
    paths[month] = await fetchPrefix(month, prefixBytes, cacheDir);
    counters[month] = { read: 0, qualified: 0, rejected: {} };
    index[month] = await indexMonth(paths[month], counters[month]);
    process.stderr.write(
      `${month}: read ${counters[month].read} qualified ${counters[month].qualified} players ${index[month].byPlayer.size}\n`,
    );
  }

  const random = mulberry32(SEED);
  const dev = MONTHS.dev;
  const hold = MONTHS.holdout;

  // Stratum R: players present in both months, so a within-player temporal split exists at all.
  const recurring = [...index[dev].byPlayer.keys()]
    .filter(
      (id) =>
        (index[dev].byPlayer.get(id)?.length ?? 0) >= GAMES_PER_PLAYER_PER_MONTH &&
        (index[hold].byPlayer.get(id)?.length ?? 0) >= GAMES_PER_PLAYER_PER_MONTH,
    )
    .sort();
  // Shuffled with the seeded generator so the selection is reproducible and not alphabetical.
  for (let i = recurring.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [recurring[i], recurring[j]] = [recurring[j], recurring[i]];
  }
  const chosenPlayers = recurring.slice(0, MAX_RECURRING_PLAYERS);

  const selected = new Map<string, { month: string; stratum: "recurring" | "general" }>();
  for (const id of chosenPlayers) {
    for (const month of [dev, hold]) {
      for (const gameId of (index[month].byPlayer.get(id) ?? []).slice(
        0,
        GAMES_PER_PLAYER_PER_MONTH,
      ))
        selected.set(gameId, { month, stratum: "recurring" });
    }
  }
  const generalPool = [...index[dev].headers.keys()].filter((id) => !selected.has(id)).sort();
  for (let i = generalPool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [generalPool[i], generalPool[j]] = [generalPool[j], generalPool[i]];
  }
  for (const gameId of generalPool) {
    if (selected.size >= targetGames) break;
    selected.set(gameId, { month: dev, stratum: "general" });
  }

  const events: DecisionEvent[] = [];
  const perGame = mulberry32(SEED ^ 0x5eed);
  for (const month of [dev, hold]) {
    for await (const chunk of pgnGames(paths[month])) {
      const header = qualifyGame(chunk);
      if (typeof header === "string") continue;
      const pick = selected.get(header.gameId);
      if (!pick || pick.month !== month) continue;
      const eligible = eligiblePlies(chunk, header);
      // Uniform without replacement, seeded: a fixed stride would correlate with game phase.
      const order = eligible.map((_, i) => i);
      for (let i = order.length - 1; i > 0; i -= 1) {
        const j = Math.floor(perGame() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      for (const i of order.slice(0, PLIES_PER_GAME))
        events.push({ ...eligible[i], month, stratum: pick.stratum });
    }
  }

  events.sort((a, b) => (a.gameId === b.gameId ? a.ply - b.ply : a.gameId < b.gameId ? -1 : 1));
  const jsonl = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
  const hash = createHash("sha256").update(jsonl).digest("hex");
  writeFileSync(`${outDir}/decision_events.jsonl`, jsonl);

  const manifest = {
    generatedAt: new Date().toISOString(),
    seed: SEED,
    playerSalt: PLAYER_SALT,
    months: MONTHS,
    prefixBytes,
    targetGames,
    pliesPerGame: PLIES_PER_GAME,
    maxRecurringPlayers: MAX_RECURRING_PLAYERS,
    counters,
    recurringCandidates: recurring.length,
    recurringChosen: chosenPlayers.length,
    gamesSelected: selected.size,
    events: events.length,
    distinctGames: new Set(events.map((e) => e.gameId)).size,
    distinctPlayers: new Set(events.map((e) => e.playerId)).size,
    datasetSha256: hash,
  };
  writeFileSync(`${outDir}/dataset_manifest.json`, JSON.stringify(manifest, null, 2));
  process.stderr.write(`${JSON.stringify(manifest, null, 2)}\n`);
}

if (process.argv[1]?.endsWith("build_blitz_research_dataset.ts")) {
  main().catch((error) => {
    process.stderr.write(`${String(error)}\n`);
    process.exit(1);
  });
}
