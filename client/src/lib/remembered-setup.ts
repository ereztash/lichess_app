/**
 * THE CONFIGURATION A PLAYER ALREADY CHOSE, SO THE PRODUCT STOPS ASKING FOR IT AGAIN.
 *
 * WHAT THIS IS FOR, AND WHAT IT IS CAREFULLY NOT. Re-asking a question whose answer has not changed
 * is friction that measures nothing: a player who has played six games at 3+0 is asked, a seventh
 * time, whether they would like 3+0. Removing that is the plain case in the inertial laws' own
 * scheduling rule -- *first remove friction with no measurement value.*
 *
 * IT REMEMBERS. IT DOES NOT DECIDE, AND IT NEVER HIDES. Every value here is a starting point for a
 * control the player can still see and still change: the blitz screen's remembered time control is
 * the loudest of three buttons rather than the only one, and `NewGameSetup` pre-fills its fields
 * rather than skipping itself. That distinction is not politeness.
 *
 * `reveal_timing` IS WHY IT MATTERS. It is one of the three axes of `StratumKey`: decisions taken
 * under `per-decision` and under `end-of-game` are not one population, and every decision records
 * which was in force. A remembered timing that was applied INVISIBLY would put a player in a regime
 * they did not know they were in -- and while the strata would still separate the rows correctly,
 * the player's own understanding of what they were doing would not. A pre-filled visible control
 * carries the choice; a silent default replaces it.
 *
 * IT CHANGES WHAT THE RECORD ACCUMULATES, WHICH IS WORTH SAYING OUT LOUD. A remembered default
 * concentrates a record in whichever regime a player first picked, so the OTHER arms will grow more
 * slowly than they would have. That is a change to the distribution, not to how any one decision is
 * produced -- `CURRENT_PROTOCOL_VERSION` is about the latter -- so it is not a protocol bump. It is
 * a thing to remember when an arm looks thin.
 *
 * ONE BROWSER, NO SERVER, AND A CORRUPT VALUE IS NO VALUE. Same shape as `last-seen.ts`: this is a
 * convenience about a device, it is never sent anywhere, and anything that does not parse into the
 * exact shape below is discarded rather than repaired. A repaired setup is a setting the player
 * never chose.
 */
import type { RequiredTimeControl } from "@shared/blitz-game-core";
import type { RevealTiming } from "@shared/reveal-timing";

const BLITZ_KEY = "decision-lab.setup.blitz";
const GAME_KEY = "decision-lab.setup.game";

/** The commitment loop's setup, as the three controls the player actually sees. */
export interface RememberedGameSetup {
  color: "w" | "b";
  depth: number;
  revealTiming: RevealTiming;
}

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    /* A private window, a cleared store, or a value that is not JSON. All mean "nothing chosen". */
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /*
     * A QUOTA OR A PRIVATE WINDOW, AND THE PRODUCT CARRIES ON. The cost of failing here is that the
     * player is asked the same question again, which is exactly the state before this file existed.
     * Nothing measured depends on it, so there is nothing to report and nobody to report it to.
     */
  }
}

/**
 * The last time control played, or null.
 *
 * VALIDATED FIELD BY FIELD RATHER THAN CAST. The stored value is whatever was in this browser's
 * `localStorage`, which includes a value written by an older build with a different shape. A cast
 * would put a `NaN` clock on the board.
 */
export function rememberedTimeControl(): RequiredTimeControl | null {
  const value = read(BLITZ_KEY);
  if (typeof value !== "object" || value === null) return null;
  const { initialMs, incrementMs } = value as Record<string, unknown>;
  if (!Number.isInteger(initialMs) || !Number.isInteger(incrementMs)) return null;
  if ((initialMs as number) <= 0 || (incrementMs as number) < 0) return null;
  return { initialMs: initialMs as number, incrementMs: incrementMs as number };
}

export function rememberTimeControl(tc: RequiredTimeControl): void {
  write(BLITZ_KEY, { initialMs: tc.initialMs, incrementMs: tc.incrementMs });
}

/** The last commitment-loop setup, or null. Same validation argument as above. */
export function rememberedGameSetup(): RememberedGameSetup | null {
  const value = read(GAME_KEY);
  if (typeof value !== "object" || value === null) return null;
  const { color, depth, revealTiming } = value as Record<string, unknown>;
  if (color !== "w" && color !== "b") return null;
  if (!Number.isInteger(depth) || (depth as number) <= 0) return null;
  if (revealTiming !== "per-decision" && revealTiming !== "end-of-game") return null;
  return { color, depth: depth as number, revealTiming };
}

export function rememberGameSetup(setup: RememberedGameSetup): void {
  write(GAME_KEY, setup);
}
