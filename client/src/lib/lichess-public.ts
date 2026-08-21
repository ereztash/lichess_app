/**
 * Reading a player's own games from Lichess, with no credential of any kind.
 *
 * `/api/games/user/{username}` is public and sends `access-control-allow-origin: *`, so the
 * browser can read it directly. That matters more than it sounds: it removes the API token, the
 * sign-in, and the single-tenant gate from the path between a player and their own games. None
 * of the decision record is involved -- the only thing that leaves is a username the player typed.
 *
 * Every failure here returns a named cause. "Could not load games" is the failure mode this
 * product exists to argue against, so it is not one of the possible outcomes.
 */

const LICHESS_ORIGIN = "https://lichess.org";

export type ImportedGame = {
  id: string;
  white: string;
  black: string;
  whiteRating: number | null;
  blackRating: number | null;
  /** Lichess's own terminal status: "draw", "mate", "resign", "outoftime", ... */
  status: string;
  speed: string;
  rated: boolean;
  playedAt: number;
  opening: string | null;
  pgn: string;
};

export type ImportFailure = {
  /** Named so the screen can say which of these happened rather than "something went wrong". */
  kind: "empty-username" | "no-such-user" | "rate-limited" | "no-games" | "blocked" | "lichess-error";
  message: string;
};

export type ImportResult =
  | { ok: true; games: ImportedGame[] }
  | { ok: false; failure: ImportFailure };

/** Games still in progress must never reach the analysis layers -- the fair-play guard is why. */
const UNFINISHED = new Set(["created", "started"]);

function playerName(side: { user?: { name?: string }; aiLevel?: number } | undefined): string {
  if (side?.user?.name) return side.user.name;
  if (typeof side?.aiLevel === "number") return `Stockfish level ${side.aiLevel}`;
  return "אלמוני";
}

function toGame(raw: Record<string, unknown>): ImportedGame | null {
  const id = typeof raw.id === "string" ? raw.id : null;
  const pgn = typeof raw.pgn === "string" ? raw.pgn : "";
  const status = typeof raw.status === "string" ? raw.status : "unknown";
  if (!id || !pgn) return null;
  if (UNFINISHED.has(status)) return null;
  const players = (raw.players ?? {}) as {
    white?: { user?: { name?: string }; rating?: number; aiLevel?: number };
    black?: { user?: { name?: string }; rating?: number; aiLevel?: number };
  };
  const opening = raw.opening as { name?: string } | undefined;
  return {
    id,
    white: playerName(players.white),
    black: playerName(players.black),
    whiteRating: typeof players.white?.rating === "number" ? players.white.rating : null,
    blackRating: typeof players.black?.rating === "number" ? players.black.rating : null,
    status,
    speed: typeof raw.speed === "string" ? raw.speed : "unknown",
    rated: raw.rated === true,
    playedAt: typeof raw.createdAt === "number" ? raw.createdAt : 0,
    opening: opening?.name ?? null,
    pgn,
  };
}

/**
 * Fetch a player's most recent finished games.
 *
 * `max` is capped because this screen shows a list a person reads, not a dataset. Pulling a
 * thousand games to render ten is rude to a free API that asks callers to be considerate.
 */
export async function fetchUserGames(
  username: string,
  max = 20,
  fetchImpl: typeof fetch = fetch,
): Promise<ImportResult> {
  const name = username.trim();
  if (!name) {
    return { ok: false, failure: { kind: "empty-username", message: "הזינו שם משתמש בליצ'ס." } };
  }

  const query = new URLSearchParams({
    max: String(Math.min(Math.max(max, 1), 50)),
    pgnInJson: "true",
    opening: "true",
    clocks: "false",
    evals: "false",
  });
  const url = `${LICHESS_ORIGIN}/api/games/user/${encodeURIComponent(name)}?${query}`;

  let response: Response;
  try {
    response = await fetchImpl(url, { headers: { Accept: "application/x-ndjson" } });
  } catch {
    // A network-level rejection. Most often the browser refusing the cross-origin read, or the
    // player being offline. Both are outside the app, and neither is "no games found".
    return {
      ok: false,
      failure: {
        kind: "blocked",
        message:
          "הדפדפן לא הצליח להגיע ללי'צס. ייתכן שאין חיבור, או שתוסף/רשת חוסמים את הבקשה. " +
          "אפשר להדביק PGN ידנית במקום.",
      },
    };
  }

  if (response.status === 404) {
    return {
      ok: false,
      failure: { kind: "no-such-user", message: `אין משתמש בשם "${name}" בליצ'ס.` },
    };
  }
  if (response.status === 429) {
    return {
      ok: false,
      failure: {
        kind: "rate-limited",
        message: "ליצ'ס הגביל את קצב הבקשות. המתינו דקה ונסו שוב.",
      },
    };
  }
  if (!response.ok) {
    return {
      ok: false,
      failure: { kind: "lichess-error", message: `ליצ'ס החזיר שגיאה ${response.status}.` },
    };
  }

  const body = await response.text();
  const games = body
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return toGame(JSON.parse(line) as Record<string, unknown>);
      } catch {
        return null;
      }
    })
    .filter((game): game is ImportedGame => game !== null);

  if (!games.length) {
    return {
      ok: false,
      failure: {
        kind: "no-games",
        message: `ל־"${name}" אין משחקים שהסתיימו שאפשר לייבא.`,
      },
    };
  }
  return { ok: true, games };
}
