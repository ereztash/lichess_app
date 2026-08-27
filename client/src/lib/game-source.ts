/**
 * Where a player's own games come from, when they arrive by username.
 *
 * Lichess was the only door, and a door only some people have. The import is the bridge over a
 * cold start of 60-90 decisions -- it is the difference between a first session that ends on six
 * unmeasurable buckets and one that has something to read -- so which site a player happens to
 * use decides whether the product works for them at all. That is not a measurement question and
 * it should not have been a product one.
 *
 * WHAT A SOURCE MUST BE, and why both qualify. Public, readable straight from the browser, and
 * reachable with nothing but a name the player types: no API token, no sign-in, no settings. Both
 * `lichess.org/api/games/user/{u}` and `api.chess.com/pub/player/{u}/games/*` send
 * `access-control-allow-origin: *`. Nothing from the decision record is involved either way; the
 * only thing that leaves is the username.
 *
 * WHAT A SOURCE MAY NOT DO. Return a game that is still being played -- the fair-play guard
 * depends on a live game never reaching the analysis layers -- and return "could not load games".
 * Every failure is a named cause, because an unexplained refusal is the failure mode this product
 * exists to argue against.
 *
 * WHAT NEITHER SOURCE HAS TO SUPPLY: an evaluation. The import scores every position with the
 * LOCAL engine and never reads `[%eval]` annotations, so a site that publishes none is not a
 * lesser source here. What a source does have to carry is the CLOCK, which is the only origin of
 * `secondsTaken` and `clockMsRemaining` for an imported game, and without which three of the six
 * buckets are structurally dead. Both carry it.
 */

/** The sites a game can arrive from. Extending this list is the only place a third one is added. */
export const GAME_SOURCES = ["lichess", "chesscom"] as const;
export type GameSource = (typeof GAME_SOURCES)[number];

/** What the screen calls each one, and what it puts in the field. */
export const SOURCE_LABEL: Record<GameSource, string> = {
  lichess: "Lichess",
  chesscom: "Chess.com",
};
export const SOURCE_PLACEHOLDER: Record<GameSource, string> = {
  lichess: "lichess username",
  chesscom: "chess.com username",
};

export type ImportedGame = {
  id: string;
  white: string;
  black: string;
  whiteRating: number | null;
  blackRating: number | null;
  /** The site's own terminal status: "draw", "mate", "resign", "outoftime", "timeout", ... */
  status: string;
  speed: string;
  rated: boolean;
  playedAt: number;
  opening: string | null;
  pgn: string;
  /** Which site it came from. Carried so a screen can say so rather than imply Lichess. */
  source: GameSource;
};

export type ImportFailure = {
  /**
   * Named so the screen can say which of these happened rather than "something went wrong".
   *
   * `source-error` replaced `lichess-error` when the second site arrived: the message names the
   * site, the kind names the shape of the failure, and a kind that carries a site name would have
   * needed a new member per source forever.
   */
  kind:
    | "empty-username"
    | "no-such-user"
    | "rate-limited"
    | "no-games"
    | "blocked"
    | "source-error";
  message: string;
};

export type ImportResult =
  | { ok: true; games: ImportedGame[] }
  | { ok: false; failure: ImportFailure };

/** Games still in progress must never reach the analysis layers -- the fair-play guard is why. */
export const UNFINISHED = new Set(["created", "started"]);

/**
 * How many games a username lookup asks for.
 *
 * Capped because this screen shows a list a person reads, not a dataset. Pulling a thousand games
 * to render ten is rude to a free API that asks callers to be considerate, and both of these are
 * free APIs run by people who asked.
 */
export const clampMax = (max: number) => Math.min(Math.max(max, 1), 50);

/**
 * Which site this browser used last.
 *
 * A player is on one site, not both, and making them re-pick every visit would put the cost of
 * the second source on the people it was added for. Per-browser and nothing else: it is a
 * convenience, no measurement reads it, and a browser that refuses storage simply starts on the
 * default -- which is why every access is wrapped rather than assumed.
 */
const PREFERENCE_KEY = "decision-lab.game-source";

export function preferredSource(): GameSource {
  try {
    const stored = localStorage.getItem(PREFERENCE_KEY);
    return GAME_SOURCES.includes(stored as GameSource) ? (stored as GameSource) : "lichess";
  } catch {
    return "lichess";
  }
}

export function rememberSource(source: GameSource): void {
  try {
    localStorage.setItem(PREFERENCE_KEY, source);
  } catch {
    // A browser that will not store a preference still gets to use the picker for this visit.
  }
}
