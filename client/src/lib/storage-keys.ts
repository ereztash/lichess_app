/**
 * Every key this application writes to a browser's storage, in one place, with what it is for.
 *
 * WHY A REGISTRY. "The record stays in your browser" was true and unverifiable: nine keys across
 * eight modules, no list, and a player asking "what does this site keep about me?" had to read the
 * source. `docs/RETENTION.md` is the answer for a person; this file is the answer for a test, and
 * `tests/client/a-record-the-player-can-take-and-erase.test.tsx` holds the two together by asserting
 * that no `decision-lab` literal exists in `client/src` outside this file.
 *
 * `deleteLocalRecord` in `local-record-store.ts` removes the record; the rest are preferences and
 * trial bookkeeping, each with its own clear where one exists. Nothing here is sent anywhere.
 *
 * WHAT SHIPS AND WHAT DOES NOT. `STORAGE_KEYS` is imported by every module that touches storage, so
 * it is in the entry chunk a player downloads; it carries the key, the area and the content class
 * and nothing else. The sentences saying what each key holds are in `STORAGE_KEY_NOTES`, imported
 * by the test and by nobody the bundle serves, because a description for a reader is not payload
 * for a player (the bundle budget noticed the difference).
 */
export type StorageArea = "localStorage" | "sessionStorage";

export interface StorageKeyEntry {
  key: string;
  area: StorageArea;
  /** Whether the key may carry the player's own words or positions. */
  content: "record" | "preference" | "bookkeeping";
}

export const STORAGE_KEYS = {
  record: { key: "decision-lab.record.v1", area: "localStorage", content: "record" },
  progress: { key: "decision-lab.progress", area: "localStorage", content: "bookkeeping" },
  position: { key: "decision-lab.position.v1", area: "localStorage", content: "record" },
  lastSeen: { key: "decision-lab.last-seen.v1", area: "localStorage", content: "bookkeeping" },
  blitzSetup: { key: "decision-lab.setup.blitz", area: "localStorage", content: "preference" },
  gameSetup: { key: "decision-lab.setup.game", area: "localStorage", content: "preference" },
  gameSource: { key: "decision-lab.game-source", area: "localStorage", content: "preference" },
  usage: { key: "decision-lab-usage-v1", area: "localStorage", content: "bookkeeping" },
  chunkReload: { key: "decision-lab.chunk-reload", area: "sessionStorage", content: "bookkeeping" },
  theme: { key: "theme", area: "localStorage", content: "preference" },
  /*
   * `record` RATHER THAN `preference`, because it holds the player's own words. Nothing computes
   * over it and nothing is measured against it -- that is the whole design of `shared/goal.ts` --
   * but the content class is about what a key CAN carry, not about what reads it, and a sentence a
   * person wrote about themselves is not a theme setting.
   */
  goal: { key: "decision-lab:goal", area: "localStorage", content: "record" },
  /*
   * WHICH RUN A SURFACE ASKED THE BOARD TO REOPEN. An id and nothing else.
   *
   * `sessionStorage` AND NOT `localStorage`, and the two reasons point the same way. This is a
   * one-press handoff between a screen and the route it is navigating to, so it is spent within
   * seconds and has nothing to say to tomorrow's visit -- `session-position.ts` persists because a
   * board is worth coming back to, and a request to reopen a run is not. And the commitment itself
   * lives in the RECORD: if this key is lost, the drill is still open and every surface still says
   * so. Losing it costs one press, never a run.
   *
   * `bookkeeping` RATHER THAN `record`, because an opaque run id is not the player's words and not
   * a position. What the run contains is in the record, under the key above.
   */
  resumeRun: {
    key: "decision-lab.resume-run.v1",
    area: "sessionStorage",
    content: "bookkeeping",
  },
} as const satisfies Record<string, StorageKeyEntry>;

export type StorageKeyName = keyof typeof STORAGE_KEYS;

/** What a player would recognise each key as. For `docs/RETENTION.md` and the test; not bundled. */
export const STORAGE_KEY_NOTES: Record<StorageKeyName, string> = {
  record: "the decision record: positions, moves, your written reads, confidences, blitz games, imports. Suffixed `:<account>` once signed in",
  progress: "the trial ledger: which steps were completed and when, failure names, and the one free-text value answer if you gave one",
  position: "the position on the board, so a reload does not lose it",
  lastSeen: "when you were last here, for the returning-player notice",
  blitzSetup: "the blitz clock and opponent depth you chose last",
  gameSetup: "the free-play opponent settings you chose last",
  gameSource: "whether you import from Lichess or Chess.com",
  usage: "how many visits, and the last one, for the presentation context",
  chunkReload: "a mark that this tab already reloaded once after a stale build, so it does not loop",
  theme: "light or dark",
  goal: "one sentence you wrote about why you are here. Nothing in the app measures distance to it",
  resumeRun: "which test you asked to carry on with, for the moment between pressing and arriving. Cleared on arrival, and never kept past this tab",
};

/** Every registered key, for a test that walks the source. */
export function registeredKeys(): string[] {
  return Object.values(STORAGE_KEYS).map((entry) => entry.key);
}
