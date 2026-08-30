/**
 * Reading a player's own games from Chess.com, with no credential of any kind.
 *
 * The same bargain as `lichess-public.ts`, from the other site: `api.chess.com/pub/...` is public
 * and sends `access-control-allow-origin: *`, so the browser reads it directly with no API token,
 * no sign-in and no settings. The only thing that leaves is a username the player typed.
 *
 * THREE THINGS THAT ARE NOT TRUE OF LICHESS, and each is a correctness requirement rather than a
 * detail of taste:
 *
 * 1. IT TAKES TWO REQUESTS, AT LEAST. There is no "last N games" endpoint. `/games/archives`
 *    returns one URL per month the player has ever played, oldest first, and each of those is a
 *    whole month. So this walks BACKWARDS from the newest month until it has enough games or
 *    reaches `MAX_MONTHS`. The cap is not silent: a player whose games are all older than that
 *    gets told so, rather than being told they have none.
 *
 * 2. THE ARCHIVE MIXES VARIANTS. `rules` is "chess" for the ordinary game and chess960,
 *    bughouse, crazyhouse, kingofthehill, threecheck or oddschess otherwise, all in the same
 *    month. Every layer downstream -- the phase rule, the engine, `decisionsFromGame` -- assumes
 *    standard chess from the standard start, so a variant is not a game with a caveat here, it is
 *    a game whose every number would be wrong. They are dropped before anything sees them.
 *
 * 3. THE TERMINAL STATUS IS PER SIDE. Lichess names the ending once; Chess.com gives each player
 *    a `result`, where the winner's is "win" and the loser's names the ending ("checkmated",
 *    "resigned", "timeout", "abandoned"), and a draw puts the SAME draw word on both. So the
 *    status is the result that is not "win", which reads identically for both cases.
 *
 * WHAT IT DOES NOT SUPPLY, AND WHY THAT COSTS NOTHING: an evaluation. Chess.com publishes no
 * `[%eval]` in the public PGN. The import scores every position with the local engine and never
 * reads those annotations from either site, so this is not a lesser source. It does carry
 * `[%clk]`, which is the only origin of `secondsTaken` and `clockMsRemaining` for an imported
 * game, and without which three of the six buckets could never be filled.
 *
 * NO `User-Agent` IS SET HERE. Chess.com blocks requests that arrive without one, and a browser
 * always sends its own; `User-Agent` is a forbidden header name for `fetch`, so setting it would
 * be silently dropped rather than honoured. A test drives this through an injected `fetch`.
 */
import {
  clampMax,
  SOURCE_ORIGIN,
  UNFINISHED,
  type ImportResult,
  type ImportedGame,
  type TimeControlMs,
} from "./game-source";
import { parseTimeControl, toTimeControlMs } from "@shared/pgn-clock";

const CHESSCOM_ORIGIN = SOURCE_ORIGIN.chesscom;

/**
 * How many monthly archives to walk back through before giving up.
 *
 * Every month is one request to a free API whose maintainers ask callers to be considerate, and a
 * dormant account would otherwise cost one request per month since they joined. Six covers a
 * player who has played at all recently; anyone quieter than that is told what happened.
 */
export const MAX_MONTHS = 6;

/** Standard chess only. Everything downstream assumes the standard start and standard rules. */
const STANDARD = "chess";

type RawSide = { username?: string; rating?: number; result?: string };
type RawGame = {
  url?: string;
  pgn?: string;
  time_class?: string;
  time_control?: string;
  rated?: boolean;
  rules?: string;
  end_time?: number;
  eco?: string;
  white?: RawSide;
  black?: RawSide;
};

/**
 * `time_control`, which this adapter already declared in its raw type and never read.
 *
 * Three grammars arrive under one key, and only two of them are a clock this product can use:
 *
 *   "180"       three minutes, no increment. The increment is nought, and nought is a MEASUREMENT.
 *   "180+2"     three minutes plus two. Same grammar as a PGN's `[TimeControl]`, which is why the
 *               parser is the one `shared/pgn-clock.ts` already owns rather than a second one here
 *               that could drift away from it.
 *   "1/259200"  daily correspondence -- one move per N seconds. There is no starting clock and no
 *               increment, so both are null. Reading the numerator as a base time would put a
 *               correspondence game in the "1 second" bucket.
 *
 * Anything else is a string nobody has seen, and it becomes null rather than a guess.
 */
function timeControlFrom(raw: string | undefined): TimeControlMs {
  return toTimeControlMs(parseTimeControl(raw));
}

/** The trailing segment of the game URL, which is the only id Chess.com exposes for a live game. */
function gameId(url: string): string | null {
  const last = url.split("/").filter(Boolean).pop();
  return last && /^[0-9a-z-]+$/i.test(last) ? last : null;
}

/**
 * The opening's name, out of the ECO URL, which is the only place Chess.com puts one.
 *
 * The slug names the opening and then the exact move order that reached it, and the move order is
 * a different fact that nothing here reads. Dropping it takes THREE cuts, and the shape of them
 * was measured rather than guessed -- the first version split on "..." alone, which is how a live
 * run produced "Scandinavian Defense Mieses Kotrc Main Line 4.g3 Nf6 5.Bg2 c6 6.Nge2" on a screen
 * while every fixture in the test file passed.
 *
 * Measured over 832 distinct ECO URLs pulled from real archives:
 *
 * | cut | what it catches | example |
 * | --- | --- | --- |
 * | at "..." | 552 of 832 | `Fianchetto-Variation...6.exd5-exd5` |
 * | at the first `<n>.` segment | the rest | `Main-Line-4.g3-Nf6-5.Bg2` |
 * | a trailing bare number | what "..." leaves behind | `Defense-2...e5` -> a dangling "2" |
 *
 * After all three, 35 of 832 names still contain a digit AND ALL 35 ARE CORRECT: "Caro Kann
 * Defense Advance Short Variation with 4 Nf3" is the opening's name, move and all. So the rule
 * stops there rather than stripping digits, which would damage the names it is meant to preserve.
 *
 * One slug is Chess.com's own placeholder, "Undefined". That is the site saying it does not know,
 * and it becomes null rather than a screen reporting an opening called Undefined.
 */
export function openingFromEco(eco: string | undefined): string | null {
  if (!eco) return null;
  const slug = eco.split("/openings/")[1];
  if (!slug) return null;
  const parts: string[] = [];
  for (const token of slug.split("...")[0].split("-")) {
    if (/^\d+\./.test(token)) break;
    parts.push(token);
  }
  while (parts.length && /^\d+$/.test(parts[parts.length - 1])) parts.pop();
  const name = parts.join(" ").trim();
  return !name || name === "Undefined" ? null : name;
}

/**
 * The one word for how the game ended.
 *
 * The loser's `result` names it and the winner's is "win", so "the one that is not win" picks the
 * ending in a decisive game. In a draw both sides carry the same draw word and either answers.
 */
export function statusFrom(white: RawSide | undefined, black: RawSide | undefined): string {
  const w = white?.result;
  const b = black?.result;
  if (w && w !== "win") return w;
  if (b && b !== "win") return b;
  return "unknown";
}

function toGame(raw: RawGame): ImportedGame | null {
  const url = typeof raw.url === "string" ? raw.url : "";
  const pgn = typeof raw.pgn === "string" ? raw.pgn : "";
  const id = url ? gameId(url) : null;
  if (!id || !pgn) return null;
  // A variant is not a game with a caveat here; it is a game whose every number would be wrong.
  if ((raw.rules ?? STANDARD) !== STANDARD) return null;
  const status = statusFrom(raw.white, raw.black);
  if (UNFINISHED.has(status)) return null;
  return {
    id,
    white: raw.white?.username ?? "אלמוני",
    black: raw.black?.username ?? "אלמוני",
    whiteRating: typeof raw.white?.rating === "number" ? raw.white.rating : null,
    blackRating: typeof raw.black?.rating === "number" ? raw.black.rating : null,
    status,
    speed: typeof raw.time_class === "string" ? raw.time_class : "unknown",
    timeControl: timeControlFrom(raw.time_control),
    rated: raw.rated === true,
    // Seconds at the source; milliseconds everywhere in this app, as Lichess already hands them.
    playedAt: typeof raw.end_time === "number" ? raw.end_time * 1000 : 0,
    opening: openingFromEco(raw.eco),
    pgn,
    source: "chesscom",
  };
}

/** Every failure carries a named cause. "Could not load games" is not one of the outcomes. */
function fail(
  kind: "empty-username" | "no-such-user" | "rate-limited" | "no-games" | "blocked" | "source-error",
  message: string,
): ImportResult {
  return { ok: false, failure: { kind, message } };
}

function statusFailure(status: number, name: string): ImportResult | null {
  if (status === 404) return fail("no-such-user", `אין משתמש בשם "${name}" ב-Chess.com.`);
  if (status === 429)
    return fail("rate-limited", "Chess.com הגביל את קצב הבקשות. המתינו דקה ונסו שוב.");
  if (status === 403)
    return fail(
      "blocked",
      "Chess.com דחה את הבקשה. לרוב זה תוסף או רשת שחוסמים אותה — אפשר להדביק PGN ידנית במקום.",
    );
  return null;
}

const BLOCKED = () =>
  fail(
    "blocked",
    "הדפדפן לא הצליח להגיע ל-Chess.com. ייתכן שאין חיבור, או שתוסף/רשת חוסמים את הבקשה. " +
      "אפשר להדביק PGN ידנית במקום.",
  );

/**
 * Fetch a player's most recent finished standard games.
 *
 * Newest first, which is the order Lichess already returns and the order every screen here
 * assumes; the archives themselves are oldest-first at both levels, so both are reversed.
 */
export async function fetchChesscomGames(
  username: string,
  max = 20,
  fetchImpl: typeof fetch = fetch,
): Promise<ImportResult> {
  const name = username.trim();
  if (!name) return fail("empty-username", "הזינו שם משתמש ב-Chess.com.");

  const wanted = clampMax(max);
  const base = `${CHESSCOM_ORIGIN}/pub/player/${encodeURIComponent(name.toLowerCase())}`;

  let listing: Response;
  try {
    listing = await fetchImpl(`${base}/games/archives`, { headers: { Accept: "application/json" } });
  } catch {
    return BLOCKED();
  }
  const listingFailure = statusFailure(listing.status, name);
  if (listingFailure) return listingFailure;
  if (!listing.ok) return fail("source-error", `Chess.com החזיר שגיאה ${listing.status}.`);

  let archives: string[];
  try {
    const body = (await listing.json()) as { archives?: unknown };
    archives = Array.isArray(body.archives)
      ? body.archives.filter((url): url is string => typeof url === "string")
      : [];
  } catch {
    return fail("source-error", "Chess.com החזיר תשובה שאי אפשר לקרוא.");
  }

  if (archives.length === 0) {
    return fail("no-games", `ל-"${name}" אין משחקים ב-Chess.com.`);
  }

  const newestFirst = [...archives].reverse();
  const months = newestFirst.slice(0, MAX_MONTHS);
  const games: ImportedGame[] = [];

  for (const month of months) {
    let response: Response;
    try {
      response = await fetchImpl(month, { headers: { Accept: "application/json" } });
    } catch {
      // One unreachable month with games already in hand is not a failed import.
      if (games.length) break;
      return BLOCKED();
    }
    const monthFailure = statusFailure(response.status, name);
    if (monthFailure) {
      if (games.length) break;
      return monthFailure;
    }
    if (!response.ok) {
      if (games.length) break;
      return fail("source-error", `Chess.com החזיר שגיאה ${response.status}.`);
    }
    try {
      const body = (await response.json()) as { games?: unknown };
      const raw = Array.isArray(body.games) ? (body.games as RawGame[]) : [];
      for (const entry of [...raw].reverse()) {
        const game = toGame(entry);
        if (game) games.push(game);
        if (games.length >= wanted) break;
      }
    } catch {
      if (games.length) break;
      return fail("source-error", "Chess.com החזיר תשובה שאי אפשר לקרוא.");
    }
    if (games.length >= wanted) break;
  }

  if (!games.length) {
    /*
     * THE CAP, SAID OUT LOUD. A player whose games are all older than the months walked has games;
     * telling them they have none would be this screen reporting its own bound as a fact about
     * them, which is the exact shape of every defect this product is built against.
     */
    const capped = newestFirst.length > MAX_MONTHS;
    return fail(
      "no-games",
      capped
        ? `ל-"${name}" לא נמצאו משחקי שחמט רגיל ב-${MAX_MONTHS} החודשים האחרונים שיש בהם משחקים. ` +
            `יש משחקים ישנים יותר, והייבוא הזה לא מגיע אליהם — אפשר להדביק PGN ידנית.`
        : `ל-"${name}" אין משחקי שחמט רגיל שהסתיימו שאפשר לייבא.`,
    );
  }
  return { ok: true, games };
}
