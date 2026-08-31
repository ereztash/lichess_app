/**
 * Why the engine did not run, as a closed list rather than a sentence.
 *
 * WHAT THIS REPLACES, AND WHY A SENTENCE WAS NOT ENOUGH. R-09 was reported as *"the scan fails"*,
 * and the screen behind that report said one thing — a fallback with the raw text tucked behind a
 * disclosure. Six different causes reach that screen, and the fixes for them have nothing in common:
 * a browser without Workers is a browser that cannot run this at all; a CSP that forbids the worker
 * source is a deployment header; a mistyped asset is a CDN setting; a timeout is a slow link. A
 * reader given one sentence for all six has been told that something is wrong, which they knew.
 *
 * EACH CODE IS A DIFFERENT OBSERVATION, NOT A DIFFERENT WORDING. The test for whether two failures
 * deserve two codes is whether the same person would do the same thing about them. `worker-refused`
 * and `wasm-refused` are both usually a CSP and are still two codes, because one is fixed by
 * `worker-src` and the other by `'wasm-unsafe-eval'` and nothing in the message can tell you which
 * unless the code did.
 *
 * THERE IS NO `unknown`, DELIBERATELY. A generic code is a generic message with more ceremony, and
 * it would collect exactly the cases this list exists to separate. A failure that fits none of these
 * is a failure this list has not learned yet, and it surfaces as the raw error with the fact that it
 * was unclassified stated plainly — which is a smaller lie than filing it under a name.
 */

export const ENGINE_FAILURES = [
  /** The browser has no `Worker` constructor. Nothing here can run; this is not a configuration. */
  "worker-unsupported",
  /**
   * A worker was constructed and the browser then refused it.
   *
   * MEASURED ON THE DEPLOYED ORIGIN, because the shape of this failure is the reason it went unseen:
   * `new Worker(url)` under a `worker-src` that excludes the URL's scheme **does not throw**. The
   * constructor returns a Worker, and an `error` event with an EMPTY message arrives afterwards. A
   * synchronous `try`/`catch` sees a success.
   */
  "worker-refused",
  /** No `WebAssembly` at all. */
  "wasm-unsupported",
  /** `WebAssembly` exists and instantiation was refused — a CSP without `'wasm-unsafe-eval'` does this. */
  "wasm-refused",
  /** An engine file did not come back 200: a bad path, a failed deploy, a proxy in the way. */
  "asset-missing",
  /**
   * An engine file came back with a content type the browser will not execute.
   *
   * Its own code because it is invisible from the app's side: the bytes arrive, the status is 200,
   * and the browser refuses them anyway. `application/wasm` and a JavaScript type are the two that
   * matter, and `nosniff` makes both mandatory rather than advisory.
   */
  "asset-mistyped",
  /** The worker was created, the files arrived, and the engine never greeted. */
  "engine-silent",
  /** The engine greeted and then did not answer within the budget. Usually the link, not the engine. */
  "engine-timeout",
  /** A game or position the scan could not read. About the input, not the engine. */
  "position-unreadable",
] as const;

export type EngineFailure = (typeof ENGINE_FAILURES)[number];

/**
 * What a reader should do about each, in the player's language.
 *
 * ONE SENTENCE, AND IT NAMES AN ACT. "An error occurred" is not a remedy; neither is "check your
 * configuration". Where the act belongs to whoever deployed this rather than to the player, the
 * sentence says so, because a player told to fix a CSP will correctly conclude the message is not
 * for them.
 */
export const ENGINE_REMEDY: Readonly<Record<EngineFailure, string>> = {
  "worker-unsupported": "הדפדפן הזה לא תומך ב-Web Workers, והמנוע רץ באחד. אפשר לנסות דפדפן אחר.",
  "worker-refused":
    "הדפדפן סירב להפעיל את המנוע. זו מדיניות אבטחה של האתר (worker-src) — לתקן בפריסה, לא בדפדפן.",
  "wasm-unsupported": "הדפדפן הזה לא תומך ב-WebAssembly, ובלעדיו המנוע לא ירוץ. אפשר לנסות דפדפן אחר.",
  "wasm-refused":
    "הדפדפן סירב להריץ WebAssembly. זו מדיניות אבטחה של האתר (חסר 'wasm-unsafe-eval') — לתקן בפריסה.",
  "asset-missing": "קובץ של המנוע לא הגיע מהשרת. שווה לנסות שוב; אם זה חוזר, זו תקלה בפריסה.",
  "asset-mistyped":
    "קובץ של המנוע הגיע עם סוג תוכן שהדפדפן לא מריץ. זו הגדרת שרת — לתקן בפריסה, לא בדפדפן.",
  "engine-silent": "המנוע נטען ולא ענה. אפשר לנסות שוב; אם זה חוזר, שלחו את הדוח מהבדיקה העצמית.",
  "engine-timeout":
    "המנוע לא הספיק לענות בזמן. הקובץ שלו שוקל 7MB, ובחיבור איטי ההורדה לבדה לוקחת דקה ויותר — אפשר לנסות שוב.",
  "position-unreadable": "אחד המשחקים לא נקרא. הסריקה ממשיכה לשאר, והמשחק הזה לא נכנס לקריאה.",
};

/**
 * An error that knows which of the nine it is.
 *
 * `Error` rather than a plain object so every existing `catch` keeps working unchanged — the code is
 * additive, and a caller that has not learned to read it behaves exactly as it did.
 */
export class EngineFailureError extends Error {
  constructor(
    readonly code: EngineFailure,
    /** What was observed. Not the remedy: this is the evidence, and it goes in the report. */
    readonly observed: string,
  ) {
    super(`${code}: ${observed}`);
    this.name = "EngineFailureError";
  }
}

/** The code behind an error, or null when nothing classified it. Never a default. */
export function failureCode(error: unknown): EngineFailure | null {
  return error instanceof EngineFailureError ? error.code : null;
}
