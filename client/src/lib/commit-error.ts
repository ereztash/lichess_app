/**
 * What a failed commit is allowed to say to the player.
 *
 * Home.tsx put `error.message` on screen unchanged. On the default path -- not signed in -- the
 * commit runs through LocalRecordStore, whose invariant violations read "append-only: decision_id
 * already exists". That is English technical text in a Hebrew RTL app, on the one screen whose
 * job is to say a decision was NOT recorded. Found by enumerating user-reachable strings, which
 * is the only way it could be found: nothing renders this path in a test, and the messages are
 * correct as messages.
 *
 * The fix is the one ErrorBoundary already uses. Say what happened in the app's language, keep
 * the original text, and demote it behind a closed disclosure -- because deleting it produces a
 * bug report nobody can act on, and the self-check panel exists precisely to produce reports.
 *
 * Not translated one by one, deliberately. These are invariant violations, not user mistakes;
 * a Hebrew rendering of "append-only: already revealed" reads as something the player did wrong
 * and could fix, which is the opposite of true.
 */

/** Any Hebrew letter. A message that has one was written for the player. */
const HEBREW = /[֐-׿]/;

import { ENGINE_REMEDY, failureCode } from "@shared/engine-failure";

export interface CommitFailureText {
  /** Always Hebrew, always says the decision was not recorded. */
  message: string;
  /** The original text, when it was not written for the player. Rendered behind a disclosure. */
  detail?: string;
}

/**
 * The general form. `fallback` is the Hebrew sentence for this particular failure -- each call
 * site already had one, and it is more specific than anything this module could invent.
 */
export function readableFailure(error: unknown, fallback: string): CommitFailureText {
  const raw = error instanceof Error ? error.message.trim() : "";

  // Messages the record layer wrote for the player pass through: they already say the right
  // thing in the right language, and wrapping them would bury the specific in the generic.
  if (raw && HEBREW.test(raw)) return { message: raw };

  return { message: fallback, detail: raw || undefined };
}

export function commitFailureText(error: unknown): CommitFailureText {
  return readableFailure(error, "ההחלטה לא נרשמה, ולכן לא נמשיך לחשיפה. אפשר לנסות שוב.");
}

/**
 * The same boundary for the screens that render a bare string.
 *
 * Six other call sites put `error.message` straight into a `<p>`, and the same store throws the
 * same English at them -- "append-only: drill already started" reaches the drill screen exactly
 * as it reached the commit screen. They render a string rather than a structure, so the technical
 * text cannot go behind a disclosure there without rebuilding six screens.
 *
 * THE TRADE, stated rather than hidden: the raw text is sent to `console.error` instead of the
 * page. It stays recoverable for a bug report and stops being the first thing a Hebrew reader
 * sees. The commit path, which is the one the decision loop runs through, keeps the fuller
 * treatment with the disclosure.
 */
export function readableFailureText(error: unknown, fallback: string): string {
  const { message, detail } = readableFailure(error, fallback);
  if (detail) console.error("[failure]", detail);
  return message;
}

/**
 * The scan's failure, said by cause rather than by symptom.
 *
 * WHY THE ORDINARY `readableFailure` WAS NOT ENOUGH HERE, AND R-09 IS THE EVIDENCE. That function
 * has exactly two answers: pass a Hebrew message through, or show one fallback sentence with the
 * raw text behind a disclosure. Six different causes reach the scan's catch, the fixes for them
 * have nothing in common, and the reporter's screen showed the fallback — so the one thing the
 * report could not say was which of the six it was.
 *
 * A CODE IS NOT A PREFIX. The remedy sentence differs per code and names an act, and the code
 * itself is carried in the detail so a pasted report is greppable. Where nothing classified the
 * error, that is stated rather than filed under a name: `readableFailure`'s behaviour is kept
 * exactly, because inventing a seventh cause is worse than admitting to none.
 */
export function scanFailureText(error: unknown, fallback: string): CommitFailureText {
  const code = failureCode(error);
  if (!code) return readableFailure(error, fallback);
  const raw = error instanceof Error ? error.message.trim() : String(error);
  return { message: ENGINE_REMEDY[code], detail: `[${code}] ${raw}` };
}
