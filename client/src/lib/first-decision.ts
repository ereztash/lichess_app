/**
 * The first decision, taken on a position the player actually reached.
 *
 * WHY A GAME THEY PLAYED, and not a neutral puzzle. What this product measures cannot be shown
 * to a new player at all: the calibration gap needs a confidence stated BEFORE the engine speaks,
 * and no import, no rating and no past game carries one. So the fastest honest route from "opened
 * the app" to "felt what this measures" is not a reading -- it is one decision. A position from
 * their own game makes that decision theirs rather than a demo's, and it costs one fetch.
 *
 * THE SELECTION MUST NOT LOOK AT HOW WELL THEY PLAYED IT, and this is the whole discipline of the
 * file. Picking the position where they blundered would stage the result: the player says "I am
 * confident", turns out to be wrong, and the app has manufactured the impression rather than
 * measured it. Nothing here runs an engine, reads a centipawn loss, or consults an outcome. The
 * only filters are properties of the POSITION -- whose move it is, and how far into the game.
 *
 * THE OPENING IS EXCLUDED, for a measured reason and not a stylistic one. `OPENING_MAX_PLY = 20`,
 * and accuracy inside that window approaches 100% for everyone, because book moves are book moves
 * -- the repo's own import diagnostic says so out loud. A demonstration on move three would show
 * the player agreeing with the engine and would demonstrate nothing about calibration.
 *
 * DETERMINISTIC, so that reloading does not deal a new hand. A player who could reshuffle until
 * the position looked easy would be choosing their own result, which is the same defect as
 * letting the app choose it.
 *
 * WHAT THIS IS NOT: a drill, a recommendation, or a claim. The decision it sets up is an ordinary
 * one and it is recorded like any other -- the first of the sixty. Nothing here says the position
 * is instructive, weak, or worth studying; it says only that the player was once there.
 */
import { OPENING_MAX_PLY } from "@shared/phase";
import { buildHistory, type GameSnapshot } from "@/lib/game-data";

/** Only the fields the picker reads, so a test need not build a whole ImportedGame. */
export interface PickableGame {
  id: string;
  white: string;
  black: string;
  pgn: string;
}

export interface FirstDecision {
  /** The game it came from, so the screen can name it without inventing provenance. */
  gameId: string;
  /** Moves up to and including the ply before the decision. Replayed by `buildHistory`. */
  sans: string[];
  /**
   * The half-move the board shows -- the position BEFORE the player's move.
   *
   * `Home` renders `currentPly` as "the last move played", so the decision is taken on the
   * position that follows it. `sans` is trimmed to match, so nothing after it can leak.
   */
  ply: number;
  /** Whose move it is at that position, which is the side the player had. */
  orientation: "w" | "b";
  /**
   * What they actually played from here, in SAN.
   *
   * A fact copied out of their own PGN, not a measurement: no engine has looked at it and no
   * verdict is attached. It is carried so the reveal can show it beside the engine's answer
   * once that surface exists.
   */
  playedSan: string;
}

/**
 * A stable number from a string.
 *
 * Deliberately not `Math.random`: the same game must always yield the same position. djb2, for
 * no reason beyond it being short and well spread over short ASCII ids.
 */
function seedOf(id: string): number {
  let hash = 5381;
  for (let index = 0; index < id.length; index += 1) {
    hash = ((hash << 5) + hash + id.charCodeAt(index)) >>> 0;
  }
  return hash;
}

/** Which side the named player had, or null when the game is not theirs to decide for. */
export function sideOf(game: PickableGame, username: string): "w" | "b" | null {
  const name = username.trim().toLowerCase();
  if (!name) return null;
  if (game.white.toLowerCase() === name) return "w";
  if (game.black.toLowerCase() === name) return "b";
  return null;
}

/**
 * Positions in one game that the player could be asked to decide again.
 *
 * Exported for the test that matters most here: that nothing in the eligible set depends on the
 * quality of the move that was played from it.
 */
export function eligiblePositions(history: GameSnapshot[], side: "w" | "b"): GameSnapshot[] {
  return history.filter(
    (snapshot) =>
      snapshot.color === side &&
      snapshot.ply > OPENING_MAX_PLY &&
      // The last move of a game is often forced or a resignation's final gesture, and a decision
      // with one legal answer measures nothing -- the import diagnostic excludes those too.
      snapshot.ply < history.length - 1,
  );
}

/**
 * One position from the player's own games, or null when none of them can supply one.
 *
 * Null is a real answer and the caller must be able to render it: a player whose games are all
 * bullet miniatures under twenty plies has no eligible position, and telling them to play more
 * would be advice rather than a measurement.
 */
export function pickFirstDecision(
  games: readonly PickableGame[],
  username: string,
): FirstDecision | null {
  for (const game of games) {
    const side = sideOf(game, username);
    if (!side) continue;
    let history: GameSnapshot[];
    try {
      history = buildHistory(game.pgn);
    } catch {
      // A PGN this build cannot replay is not a position. Try the next game rather than failing
      // the whole screen on one bad export.
      continue;
    }
    const eligible = eligiblePositions(history, side);
    if (!eligible.length) continue;
    const chosen = eligible[seedOf(game.id) % eligible.length];
    return {
      gameId: game.id,
      /*
       * Trimmed to BEFORE the chosen move. The board must not hold a single ply the player has
       * not been asked about -- `MoveTimeline` renders the whole history, so leaving the rest in
       * would put the answer on screen next to the question.
       */
      sans: history.slice(0, chosen.ply).map((snapshot) => snapshot.san),
      ply: chosen.ply - 1,
      orientation: side,
      playedSan: chosen.san,
    };
  }
  return null;
}
