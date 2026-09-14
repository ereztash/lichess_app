/**
 * THE PRESS FROM ANOTHER SCREEN, TAKEN ONCE AND HONOURED ONCE.
 *
 * WHY A HOOK RATHER THAN A REF AND AN EFFECT IN THE PAGE. Two things in `Home.tsx` need this one
 * fact at two different depths: the effect that restores the saved GAME has to know to stand down,
 * and the effect that reopens the RUN is declared several hundred lines lower because the callbacks
 * it calls are. A ref read at the top and consumed at the bottom is correct and is exactly the
 * shape a later edit reorders by accident. `Home.tsx` is also under a ratchet whose number is
 * pieces of state in one scope, and its own note says the ceilings only go down.
 *
 * READ DURING THE FIRST RENDER, NOT IN AN EFFECT, and the reason is the standing down. The
 * game-restore effect runs before any effect this hook could schedule, so an answer that arrived
 * later would arrive after the board had already adopted a game -- and the player would watch a
 * position appear and be replaced. `ResumeScreen` reads its visit stamp the same way and for the
 * same reason.
 *
 * `takeResumeRequest` CLEARS AS IT READS. The ref is what keeps a second render from finding the
 * key already spent and concluding there was never a request.
 */
import { useRef } from "react";

import { takeResumeRequest, type ResumeRequest } from "@/lib/commitment-handoff";

export interface PendingResume {
  /** The request, or null when this arrival was not sent by a continuation control. */
  readonly current: ResumeRequest | null;
  /**
   * Start the run, at most once for the life of this board.
   *
   * THE TWO KINDS TAKE DIFFERENT PATHS AND BOTH ARE THE RECORD'S. A drill is reopened by a read
   * that reconstructs the registered positions and the decisions bound to them. A transfer is
   * reopened by the path that already resumed correctly: `startLearningTransfer` hands back the
   * open transfer together with its observation count, and that was repaired one cycle before this
   * one. Nothing about it changes here; what changes is that a screen other than the board can now
   * reach it.
   */
  honour: (open: {
    drill: (id: string) => void | Promise<void>;
    transfer: (id: string, options: { resuming: boolean }) => void | Promise<void>;
  }) => void;
}

export function useResumeRequest(): PendingResume {
  const request = useRef<ResumeRequest | null | undefined>(undefined);
  if (request.current === undefined) request.current = takeResumeRequest();
  const started = useRef(false);
  const handle = useRef<PendingResume | null>(null);
  if (!handle.current) {
    handle.current = {
      get current() {
        return request.current ?? null;
      },
      honour(open) {
        const pending = request.current;
        if (!pending || started.current) return;
        started.current = true;
        if (pending.kind === "drill") void open.drill(pending.id);
        else void open.transfer(pending.id, { resuming: true });
      },
    };
  }
  /* Stable across renders, so the page's effect may list it as a dependency without re-firing. */
  return handle.current;
}
