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
/**
 * The origin each source is read from, and the reason this is DATA rather than a private const
 * inside each client.
 *
 * The deployment's `connect-src` names the origins the browser is allowed to reach. Adding
 * Chess.com without adding it there shipped a build where every test passed -- tests inject their
 * own `fetch` -- and the real app failed on a phone with "the browser could not reach Chess.com",
 * which is this app's own wording for a network refusal. A CSP violation surfaces to `fetch` as a
 * plain TypeError, so the code could not tell "blocked by policy" from "you are offline", and the
 * message named the second.
 *
 * Two places asserted the same fact and one of them moved. `tests/client/every-source-the-page-may-reach.test.ts`
 * holds them together now, reading this list against `vercel.json`.
 */
export const SOURCE_ORIGIN: Record<GameSource, string> = {
  lichess: "https://lichess.org",
  chesscom: "https://api.chess.com",
};

export const SOURCE_PLACEHOLDER: Record<GameSource, string> = {
  lichess: "lichess username",
  chesscom: "chess.com username",
};

/**
 * The clock the game was played on, in milliseconds, with "the source did not say" expressible.
 *
 * SEPARATE FROM `speed`, AND NOT DERIVABLE FROM IT. Both sites label 3+0, 3+2, 5+0 and 5+5 as
 * "blitz", and those are four different environments: at 5+5 a player who spends five seconds a
 * move never loses time at all, and at 3+0 the same player has burned two thirds of their clock by
 * move twenty. An analysis that pools them is pooling four experiments, and `speed` is the field
 * that lets it happen without anyone noticing.
 *
 * MILLISECONDS BECAUSE EVERY OTHER CLOCK FIELD IN THIS APP IS MILLISECONDS -- `clockMsRemaining`
 * already is -- and a record carrying one clock in seconds and another in milliseconds is a
 * subtraction waiting to be wrong by a factor of a thousand.
 *
 * NULL IS NOT ZERO. A correspondence game has no increment in the sense this field means, and a
 * source that omitted the value said nothing. `incrementMs: 0` is a real 3+0 game; `null` is a
 * game whose increment nobody recorded. Storing the second as the first would make a `3+0` bucket
 * that quietly contains every game the parser could not read.
 */
export type TimeControlMs = {
  /** Starting clock per player. Null when the source did not supply a usable one. */
  initialMs: number | null;
  /** Added after each move. Zero for 3+0; null when nothing said. */
  incrementMs: number | null;
};

/** Nothing known about the clock. Named so the two adapters cannot each invent their own empty. */
export const NO_TIME_CONTROL: TimeControlMs = { initialMs: null, incrementMs: null };

export type ImportedGame = {
  id: string;
  white: string;
  black: string;
  whiteRating: number | null;
  blackRating: number | null;
  /** The site's own terminal status: "draw", "mate", "resign", "outoftime", "timeout", ... */
  status: string;
  /** The site's own coarse label: "blitz", "rapid", "bullet". Metadata, not a unit of analysis. */
  speed: string;
  /** Base and increment, which `speed` does not determine. Required so an adapter cannot omit it. */
  timeControl: TimeControlMs;
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
