/**
 * One call for "this player's own games", whichever site they are on.
 *
 * A separate file rather than a function inside `game-source.ts`, because the two clients import
 * their shared shapes from there and a dispatcher living beside those shapes would close a cycle.
 * Types may point in circles; functions run at load time and may not.
 *
 * Adding a third site is this switch, one entry in `GAME_SOURCES`, and its own client. Nothing
 * upstream of here learns a site's name.
 */
import { fetchChesscomGames } from "./chesscom-public";
import { fetchUserGames } from "./lichess-public";
import type { GameSource, ImportResult } from "./game-source";

export function fetchGames(
  source: GameSource,
  username: string,
  max = 20,
  fetchImpl: typeof fetch = fetch,
): Promise<ImportResult> {
  switch (source) {
    case "chesscom":
      return fetchChesscomGames(username, max, fetchImpl);
    case "lichess":
      return fetchUserGames(username, max, fetchImpl);
  }
}
