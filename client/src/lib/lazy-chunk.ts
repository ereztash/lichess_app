/**
 * A code-split boundary that survives the app being redeployed underneath it.
 *
 * THE FAILURE, REPRODUCED. A build gives every chunk a content hash. The moment a new build goes
 * out, the old hashes stop existing -- and a tab that was already open still holds the old
 * `index.html`, still pointing at them. The next lazily-imported chunk 404s, `React.lazy` rejects,
 * and the rejection reaches `ErrorBoundary`:
 *
 *   TypeError: Failed to fetch dynamically imported module: /assets/RecordDashboard-BdDAKmeV.js
 *
 * The player sees "משהו נשבר במסך הזה" for a build that is perfectly healthy, on a screen where
 * nothing they did was wrong, and the only thing between them and a working app is the reload
 * button they have no reason to trust. Driven in Chromium by serving 404 for every non-entry
 * chunk under an open page: the crash screen came up on the record dashboard.
 *
 * IT IS NOT HYPOTHETICAL AND IT IS NOT RARE. Every push to a preview or to production does it to
 * everyone who has the app open, and this app now has five of these boundaries -- the dashboard,
 * the game review and its progress bar, the value question, and the bank's move lists.
 *
 * WHY A RELOAD IS THE RIGHT ANSWER HERE, and why it is safe. A missing chunk cannot be recovered
 * from in place: the code the screen needs is gone from the server. What fixes it is a fresh
 * `index.html`, which is exactly what a reload fetches. It is safe because of a property this
 * product already has and already tells the player about on this very screen -- "הרשומה נכתבת
 * בכל החלטה, לא בסוף המשחק" -- plus `session-position`, which puts the board back where it was.
 *
 * ONCE, AND THE BOUND IS THE WHOLE DESIGN. If the chunk is missing for any other reason -- a
 * broken deploy, a proxy eating it, an extension -- reloading on every failure is an infinite
 * refresh loop, which is worse than the crash screen it replaces because the player cannot even
 * read the error. So: one retry (a transient network blip costs nothing to retry), then one
 * reload, and if it fails again after that the error is passed through to the boundary, which is
 * now telling the truth.
 */
import { lazy, type ComponentType } from "react";

/** Set for exactly one page load, between deciding to reload and the load that follows. */
const RELOAD_MARK = "decision-lab.chunk-reload";

/**
 * Whether a failure is a missing chunk rather than a fault in the module itself.
 *
 * MATCHED ON THE MESSAGE BECAUSE THERE IS NOTHING ELSE. Browsers throw a plain `TypeError` here
 * with no code and no cause; the three forms below are Chromium's, Firefox's and Safari's. A
 * module that throws while EVALUATING -- a real bug in the component -- produces its own error
 * and must not be swallowed into a reload, because reloading would hide it and then hit it again.
 */
export function isChunkLoadError(error: unknown): boolean {
  /*
   * Written as a function rather than the usual ternary on purpose. `commit-error.test.ts` scans
   * every file under `client/src` for the shape that puts a thrown message on screen, and the
   * ternary form matches it -- correctly, as a shape. This one classifies an error and renders
   * nothing, so the fix is to not have the shape rather than to carve an exception into a scan
   * whose whole value is having none.
   */
  function messageOf(value: unknown): string {
    if (value instanceof Error) return value.message;
    return String(value);
  }
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(
    messageOf(error),
  );
}

function alreadyReloaded(): boolean {
  try {
    return sessionStorage.getItem(RELOAD_MARK) !== null;
  } catch {
    /*
     * A private window or a blocked origin. Refusing to reload is the safe side of this branch:
     * without a place to remember that we already tried, a reload here could loop forever.
     */
    return true;
  }
}

function rememberReload(): void {
  try {
    sessionStorage.setItem(RELOAD_MARK, new Date().toISOString());
  } catch {
    /* Cannot remember it; `alreadyReloaded` returns true in the same conditions, so we never get
       here with storage unavailable. Kept as a no-op rather than a throw on the way out. */
  }
}

function clearReloadMark(): void {
  try {
    sessionStorage.removeItem(RELOAD_MARK);
  } catch {
    /* Nothing to clear in a backing that never took the write. */
  }
}

/**
 * `React.lazy`, with the deploy boundary handled.
 *
 * The signature is `lazy`'s, so a call site changes by one word and keeps its `<Suspense>`.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function lazyChunk<T extends ComponentType<any>>(
  load: () => Promise<{ default: T }>,
  reload: () => void = () => window.location.reload(),
) {
  return lazy(async () => {
    try {
      const loaded = await load();
      /*
       * A chunk arrived, so whatever went wrong before is over. Clearing here rather than on
       * mount means the next genuine failure gets its own reload rather than inheriting a mark
       * from an unrelated one earlier in the session.
       */
      clearReloadMark();
      return loaded;
    } catch (first) {
      if (!isChunkLoadError(first)) throw first;
      try {
        const loaded = await load();
        clearReloadMark();
        return loaded;
      } catch (second) {
        if (!isChunkLoadError(second) || alreadyReloaded()) throw second;
        rememberReload();
        reload();
        /*
         * Never resolves, on purpose. The page is on its way out; resolving with anything would
         * paint a component for the instant before it goes, and rejecting would put the crash
         * screen up underneath a reload that is about to fix it.
         */
        return await new Promise<never>(() => {});
      }
    }
  });
}
