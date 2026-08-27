// @vitest-environment jsdom
/**
 * A reload moved a deferred game into the coached arm, mid-game.
 *
 * `revealTiming` is an EXPERIMENTAL CONDITION, not a preference. The product's own note says why
 * the deferred game exists: "over forty moves the coached loop measures a player who has been
 * coached mid-game -- a different condition, and the record stores which was in force."
 *
 * `writePosition` stored the moves, the ply, the source, the orientation, the opponent and the
 * game id. It did not store the arm. So a player who chose the deferred game, played fifteen
 * moves and reloaded carried on in `per-decision` — because that is the `useState` default — and
 * the record then held one game whose first fifteen decisions say `end-of-game` and whose rest say
 * `per-decision`. Every row internally consistent, nothing anywhere saying the game changed arms.
 *
 * A POSITION THAT CANNOT SAY WHICH ARM IT WAS IN IS NOT RESTORED. That is this file's existing
 * rule -- "a stored shape that changed is not a position", and `parse` already returns null for
 * every missing field -- applied to the field that matters most. The cost is that a game in flight
 * across this change is forgotten; the decisions are on the record either way, and forgetting a
 * board is better than continuing it in the wrong condition.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { readPosition, writePosition, type StoredPosition } from "../../client/src/lib/session-position";

const KEY = "decision-lab.position.v1";

const POSITION: Omit<StoredPosition, "savedAt"> = {
  sans: ["e4", "e5", "Nf3"],
  ply: 2,
  source: "live",
  orientation: "w",
  opponent: { playerColor: "w", depth: 8 },
  gameId: "game-1",
  revealTiming: "end-of-game",
      firstDecisionPly: null,
};

beforeEach(() => localStorage.clear());

describe("the arm a reload used to change", () => {
  it("remembers which condition the game was being played under", () => {
    writePosition(POSITION);
    expect(readPosition()?.revealTiming).toBe("end-of-game");
  });

  it("keeps the coached arm distinct, so this is a stored value and not a constant", () => {
    writePosition({ ...POSITION, revealTiming: "per-decision" });
    expect(readPosition()?.revealTiming).toBe("per-decision");
  });

  it("refuses a stored position that cannot say which arm it was in", () => {
    /*
     * A position written before the arm was stored. Restoring it would put a possibly-deferred
     * game into the coached arm silently, which is the defect. Null is what every other unreadable
     * shape returns here, and the caller has one thing to do about all of them: start fresh.
     */
    const { revealTiming, ...withoutTheArm } = POSITION;
    void revealTiming;
    localStorage.setItem(KEY, JSON.stringify({ ...withoutTheArm, savedAt: new Date().toISOString() }));
    expect(readPosition()).toBeNull();
  });

  it("refuses an arm this build does not know, rather than falling back to one", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ ...POSITION, revealTiming: "whenever", savedAt: new Date().toISOString() }),
    );
    expect(readPosition()).toBeNull();
  });
});
