/**
 * The player's own sentence about why they are here, kept in this browser.
 *
 * LOCAL AND NOT ON THE RECORD, ON PURPOSE. Every append-only atom in the record is evidence -- a
 * decision, a confidence, an engine verdict, a result -- and each one is something a measurement
 * may later read. A goal is none of those: it is context the player wrote for themselves, nothing
 * computes over it, and putting it in the evidence stream would make it look like an input to
 * something. `localStorage` is where a per-browser convenience belongs, and the product behaves
 * correctly when it comes back empty.
 */
import { normaliseGoal } from "@shared/goal";
import { STORAGE_KEYS } from "./storage-keys";

const KEY = STORAGE_KEYS.goal.key;

export function readGoal(): string | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw === null ? null : normaliseGoal(raw);
  } catch {
    /*
     * A PRIVATE WINDOW, BLOCKED SITE DATA OR A THUMBNAIL CAPTURE ALL THROW HERE, and none of them
     * is a failure the player should hear about: the screen renders without the goal, which is the
     * same screen every player sees before they write one.
     */
    return null;
  }
}

export function writeGoal(statement: string): string | null {
  const value = normaliseGoal(statement);
  try {
    if (value === null) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, value);
  } catch {
    // Same reasoning as above. The value is returned either way, so the screen is consistent
    // within this session even when nothing could be stored for the next one.
  }
  return value;
}
