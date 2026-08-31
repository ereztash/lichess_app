/**
 * CONTROL for GATE-REUSE-CONFIG and GATE-PENDING-WORK-LIVENESS. Not shipped.
 *
 * NAMED `Blitz.tsx` ON PURPOSE. Both predicates key on the surfaces that own configuration and
 * analysis, and a control that renamed itself would be testing that the scanner ignores files it
 * has never heard of -- which is not the property either gate is about.
 *
 * It asks for the time control every time, keeps nothing, and runs the post-game analysis inside a
 * cancellable effect -- which is what this screen did before the queue.
 */
import { useEffect, useState } from "react";
import { analyseFinishedGame } from "@shared/blitz-post-game";

export function Blitz() {
  const [game, setGame] = useState<unknown>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const scored = await analyseFinishedGame(game as never, async () => null);
      if (!cancelled) setGame(scored);
    })();
    return () => {
      cancelled = true;
    };
  }, [game]);
  return <button onClick={() => setGame({ initialMs: 180_000, incrementMs: 0 })}>3+0</button>;
}
