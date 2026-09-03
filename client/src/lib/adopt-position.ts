/**
 * HOW A STORED POSITION BECOMES THE BOARD.
 *
 * WHY IT IS OUT HERE. It had one caller and lived inline in the mount-restore effect. `O-1` gave
 * it a second: the reveal's direct route writes a NEW position while `Home` is already mounted, so
 * the same nine assignments had to run without a remount. Two copies of nine assignments is how a
 * resumed game and a served position start disagreeing about which fields a handoff carries --
 * which already happened once to `revealTiming`, and cost a record that held one game played under
 * two experimental conditions.
 *
 * A ROUTE IS NOT A WAY TO LOAD A BOARD YOU ARE ALREADY STANDING ON. Measured in Chromium: from the
 * reveal, `navigate("/play")` wrote the handoff store, left the url unchanged, never remounted
 * `Home`, and left the player on the old reveal over a board that refused every move. That is the
 * defect this module exists to make impossible to reintroduce by transcription.
 *
 * IT TAKES SETTERS RATHER THAN OWNING STATE, because the board's state belongs to the component
 * that renders it and moving it here would be a rewrite rather than an extraction. What is shared
 * is the ORDER and the COMPLETENESS of the assignment, and that is exactly what drifted.
 */
import type { GameSnapshot } from "@/lib/game-data";
import type { StoredPosition } from "@/lib/session-position";
import type { RevealTiming } from "@shared/reveal-timing";
import type { AnalysisSource } from "@shared/analysis-source";

/** Everything a stored position sets. One object so a new field cannot be added to only one path. */
export interface BoardSetters {
  setHistory: (h: GameSnapshot[]) => void;
  setCurrentPly: (p: number) => void;
  setSource: (s: AnalysisSource) => void;
  setFirstDecisionPly: (p: number | null) => void;
  setOrientation: (o: "w" | "b") => void;
  setOpponent: (o: StoredPosition["opponent"]) => void;
  setRevealTiming: (t: RevealTiming) => void;
  setGameId: (id: string) => void;
  setNotice: (message: string) => void;
}

/**
 * Replay a stored position onto the board.
 *
 * Returns whether it could be replayed. `false` leaves the board untouched: an unreplayable
 * handoff is a stored value this build cannot honour, and the opening position it falls back to is
 * where a fresh visit starts anyway.
 */
export function adoptStoredPosition(
  saved: StoredPosition,
  set: BoardSetters,
  buildHistory: (movetext: string) => GameSnapshot[],
  notice: (loaded: GameSnapshot[]) => string,
): boolean {
  try {
    const loaded = saved.sans.length ? buildHistory(saved.sans.join(" ")) : [];
    // A ply past the end of what replayed is a stored value this build cannot honour.
    set.setHistory(loaded);
    set.setCurrentPly(Math.min(saved.ply, loaded.length - 1));
    set.setSource(saved.source);
    set.setFirstDecisionPly(saved.firstDecisionPly);
    set.setOrientation(saved.orientation);
    set.setOpponent(saved.opponent);
    /*
     * The arm, restored like everything else. This was the one field the handoff did not carry,
     * so a resumed deferred game silently continued as a coached one and the record ended up
     * holding a single game played under two conditions.
     */
    set.setRevealTiming(saved.revealTiming);
    set.setGameId(saved.gameId);
    set.setNotice(notice(loaded));
    return true;
  } catch {
    return false;
  }
}
