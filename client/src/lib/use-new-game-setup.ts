/**
 * THE THREE ANSWERS A NEW GAME NEEDS, AND THE MEMORY OF THE LAST ONES.
 *
 * WHY A HOOK RATHER THAN THREE `useState` CALLS IN THE PAGE. `Home.tsx` is under a ratchet whose
 * number is fifty-five pieces of state in one scope, and the file's own note says why that number
 * is the one pinned: *"line count is a symptom; fifty-five pieces of state in one scope is the
 * cause."* These three belong together -- they are answered together, remembered together, and read
 * in exactly one place -- so they are one thing, not three.
 *
 * READ ONCE, BEFORE THE FIRST PAINT. Lazy initialisers rather than an effect: an effect would
 * render the defaults and then swap them, which on a form the player may already be reading is the
 * product changing its own answer under their hand.
 *
 * PRE-FILLED, NEVER APPLIED SILENTLY. `revealTiming` is one of the three axes of `StratumKey` --
 * `per-decision` and `end-of-game` are not one population -- so a remembered value applied without
 * showing it would put a player in a regime they did not know they were in. `NewGameSetup` renders
 * all three; what this removes is the re-deciding, not the seeing.
 */
import { useCallback, useState } from "react";
import {
  DEFAULT_OPPONENT_DEPTH,
  OPPONENT_DEPTHS,
  type OpponentDepth,
} from "@/lib/opponent";
import type { RevealTiming } from "@shared/reveal-timing";
import { rememberGameSetup, rememberedGameSetup } from "@/lib/remembered-setup";

export interface NewGameSetupState {
  color: "w" | "b";
  depth: OpponentDepth;
  revealTiming: RevealTiming;
  setColor: (color: "w" | "b") => void;
  setDepth: (depth: OpponentDepth) => void;
  setRevealTiming: (timing: RevealTiming) => void;
  /**
   * Keep these answers for next time.
   *
   * CALLED ON START AND NOT ON EVERY CHANGE, so a setup panel opened, fiddled with and cancelled
   * leaves the remembered answers exactly as they were. What is remembered is what was played.
   */
  remember: () => void;
}

export function useNewGameSetup(): NewGameSetupState {
  const [color, setColor] = useState<"w" | "b">(() => rememberedGameSetup()?.color ?? "w");
  const [depth, setDepth] = useState<OpponentDepth>(() => {
    const stored = rememberedGameSetup()?.depth;
    /* The stored value is validated as a positive integer; only THIS list makes it a depth. */
    return OPPONENT_DEPTHS.find((d) => d === stored) ?? DEFAULT_OPPONENT_DEPTH;
  });
  const [revealTiming, setRevealTiming] = useState<RevealTiming>(
    () => rememberedGameSetup()?.revealTiming ?? "per-decision",
  );

  const remember = useCallback(
    () => rememberGameSetup({ color, depth, revealTiming }),
    [color, depth, revealTiming],
  );

  return { color, depth, revealTiming, setColor, setDepth, setRevealTiming, remember };
}

