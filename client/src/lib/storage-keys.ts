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
 */
export type StorageArea = "localStorage" | "sessionStorage";

export interface StorageKeyEntry {
  key: string;
  area: StorageArea;
  /** What a player would recognise it as. */
  holds: string;
  /** Whether the key may carry the player's own words or positions. */
  content: "record" | "preference" | "bookkeeping";
}

export const STORAGE_KEYS = {
  record: {
    key: "decision-lab.record.v1",
    area: "localStorage",
    holds: "the decision record: positions, moves, your written reads, confidences, blitz games, imports. Suffixed `:<account>` once signed in",
    content: "record",
  },
  progress: {
    key: "decision-lab.progress",
    area: "localStorage",
    holds: "the trial ledger: which steps were completed and when, failure names, and the one free-text value answer if you gave one",
    content: "bookkeeping",
  },
  position: {
    key: "decision-lab.position.v1",
    area: "localStorage",
    holds: "the position on the board, so a reload does not lose it",
    content: "record",
  },
  lastSeen: {
    key: "decision-lab.last-seen.v1",
    area: "localStorage",
    holds: "when you were last here, for the returning-player notice",
    content: "bookkeeping",
  },
  blitzSetup: {
    key: "decision-lab.setup.blitz",
    area: "localStorage",
    holds: "the blitz clock and opponent depth you chose last",
    content: "preference",
  },
  gameSetup: {
    key: "decision-lab.setup.game",
    area: "localStorage",
    holds: "the free-play opponent settings you chose last",
    content: "preference",
  },
  gameSource: {
    key: "decision-lab.game-source",
    area: "localStorage",
    holds: "whether you import from Lichess or Chess.com",
    content: "preference",
  },
  usage: {
    key: "decision-lab-usage-v1",
    area: "localStorage",
    holds: "how many visits, and the last one, for the presentation context",
    content: "bookkeeping",
  },
  chunkReload: {
    key: "decision-lab.chunk-reload",
    area: "sessionStorage",
    holds: "a mark that this tab already reloaded once after a stale build, so it does not loop",
    content: "bookkeeping",
  },
  theme: {
    key: "theme",
    area: "localStorage",
    holds: "light or dark",
    content: "preference",
  },
} as const satisfies Record<string, StorageKeyEntry>;

export type StorageKeyName = keyof typeof STORAGE_KEYS;

/** Every registered key, for a test that walks the source. */
export function registeredKeys(): string[] {
  return Object.values(STORAGE_KEYS).map((entry) => entry.key);
}
