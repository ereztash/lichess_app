/**
 * THE PRESS THAT REOPENS A RUN, CARRIED THE ONE HOP FROM A SURFACE TO THE BOARD.
 *
 * WHY A HANDOFF AND NOT A ROUTE PARAMETER. `/play` is one route with one component, and `Home.tsx`
 * already restores a game from `session-position.ts` on mount by exactly this mechanism. A second
 * mechanism for the same hop -- a query string, a router state object -- would mean two places that
 * decide what `Home` wakes up holding, and the existing one is the one that has been walked in a
 * browser. This adds a key beside it, not a second way in.
 *
 * WHAT IS STORED IS AN ID AND NOTHING ELSE, and that is the whole safety argument. The terms of the
 * run -- which positions, in what order, against which refutation condition -- are read back from
 * the record by `restoreDrillRun`, on the other side, every time. A handoff that carried the spec
 * would be a pre-registered test travelling through `sessionStorage`, where a stale tab could hand
 * the board a set that no longer matches what the record says was registered.
 *
 * LOSING IT COSTS ONE PRESS. The commitment is in the record: if this key is missing, cleared, or
 * from another tab, the drill is still open, every surface still says so, and the player presses
 * again. Nothing here is load-bearing for the run's survival, which is why it may live in the
 * cheapest storage there is.
 */
import { STORAGE_KEYS } from "./storage-keys";

const KEY = STORAGE_KEYS.resumeRun.key;

/** Which kind of run to reopen. The board restores each one by its own path. */
export interface ResumeRequest {
  readonly kind: "drill" | "transfer";
  /** The drill id, or -- for a transfer -- the RULE id, which is what resuming one takes. */
  readonly id: string;
}

/**
 * A transfer is resumed by its rule and a drill by its own id, and the asymmetry is the record's.
 *
 * `startLearningTransfer` takes a `rule_id` and hands back whichever transfer is open over it,
 * together with how many positions have been answered -- so the rule is the handle the resume path
 * already has. A drill has no such owner: `getDrill` takes the drill's own id and there is no
 * "the open drill of claim X" read, because a claim may be drilled more than once.
 */
export function writeResumeRequest(request: ResumeRequest): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(request));
  } catch {
    /* A browser refusing session storage costs the player a press, not a run. */
  }
}

/**
 * Take the pending request, and take it exactly once.
 *
 * READ-AND-CLEAR IN ONE CALL, because the failure of leaving it is specific: `Home` would restore
 * the run, the player would finish and report it, and the next arrival at `/play` -- a reload, a
 * back button -- would ask to reopen a drill that no longer exists. `restoreDrillRun` refuses that
 * honestly, but the honest refusal is an error message shown to somebody who did nothing wrong.
 */
export function takeResumeRequest(): ResumeRequest | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(KEY);
    if (raw !== null) sessionStorage.removeItem(KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { kind, id } = parsed as Partial<ResumeRequest>;
    if ((kind !== "drill" && kind !== "transfer") || typeof id !== "string" || !id) return null;
    return { kind, id };
  } catch {
    /* Written by an older build, or by hand. Unreadable is not a run to open. */
    return null;
  }
}
