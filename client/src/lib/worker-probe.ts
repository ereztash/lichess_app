/**
 * Start a throwaway worker and find out whether the browser let it live.
 *
 * WHY THIS IS NOT A `try`/`catch` AROUND `new Worker`. Measured on the deployed origin: under a
 * `worker-src` that excludes the URL's scheme, Chromium **does not throw**. The constructor returns
 * a Worker, the console logs *"Refused to create a worker from 'blob:…'"*, and an `error` event
 * with an EMPTY message arrives afterwards. A synchronous check sees a success — which is exactly
 * what the self-check reported, on a deployment where the worker had just been refused.
 *
 * So the only honest question is whether the worker SPEAKS. It posts one message and closes.
 *
 * TWO SOURCES, BECAUSE THE POLICY CAN ALLOW ONE AND FORBID THE OTHER, and only one of them is the
 * product's. The engine loads from a same-origin `/assets/…js`; nothing here uses a `blob:` worker.
 * A probe that asked only about `blob:` — as this one did — answers a question about a scheme the
 * product never uses, under a `worker-src 'self'` that forbids it, and reports the answer as if it
 * were about the engine.
 */

/**
 * How long to wait for a probe worker to say it is alive.
 *
 * It posts once and closes, so this bounds the browser STARTING a worker rather than any work.
 * Generous because a cold worker start on a loaded phone is not instant, and short enough that a
 * self-check does not look hung.
 */
export const WORKER_PROBE_TIMEOUT_MS = 4_000;

/** One message and out. Small enough to inline, and it must not import anything. */
const PROBE_SCRIPT = "self.postMessage('alive');self.close();";

import probeScriptUrl from "./worker-probe-script?worker&url";

export type WorkerSource = "same-origin" | "blob";

export type WorkerProbe = { spoke: boolean; observed: string };

/**
 * A same-origin URL for the probe script, as a data-free asset the CSP treats like any other script.
 *
 * `URL.createObjectURL` yields `blob:`; this yields the page's own origin, which is what `'self'`
 * means. Built with a `Blob` and a same-origin path is not possible without a server round trip, so
 * the same-origin probe uses the one same-origin script this bundle is guaranteed to have: itself,
 * via a module worker pointed at a tiny built chunk.
 */
export function probeWorkerWith(
  create: (url: string, options?: WorkerOptions) => Worker,
  urlFor: (from: WorkerSource) => string,
  timeoutMs: number,
): (from: WorkerSource) => Promise<WorkerProbe> {
  return (from) =>
    new Promise<WorkerProbe>((resolve) => {
      let url: string;
      let worker: Worker;
      try {
        url = urlFor(from);
        worker = create(url);
      } catch (error) {
        /* A throw here is a different failure from a refusal, and it is worth saying which. */
        resolve({ spoke: false, observed: `הבנייה נכשלה מיד: ${String(error).slice(0, 120)}` });
        return;
      }
      const done = (probe: WorkerProbe) => {
        clearTimeout(timer);
        try {
          worker.terminate();
        } catch {
          /* Terminating a worker the browser already refused is not an error worth reporting. */
        }
        if (from === "blob") URL.revokeObjectURL(url);
        resolve(probe);
      };
      const timer = setTimeout(
        () => done({ spoke: false, observed: `נבנה ולא ענה תוך ${timeoutMs}ms` }),
        timeoutMs,
      );
      worker.onmessage = () => done({ spoke: true, observed: "ענה" });
      /*
       * THE EMPTY MESSAGE IS THE SIGNATURE OF A POLICY REFUSAL, and saying so is the whole value of
       * this branch: a script that fails to parse arrives here with a real `SyntaxError` message,
       * and a worker the CSP refused arrives with nothing at all. Same event, two causes, and the
       * message is what separates them.
       */
      worker.onerror = (event) => {
        const said = (event as ErrorEvent).message?.trim();
        done({
          spoke: false,
          observed: said ? `שגיאה: ${said.slice(0, 120)}` : "נדחה בלי הודעה (חתימה של מדיניות אבטחה)",
        });
      };
    });
}

/** The probe script as a `blob:` URL. The scheme this deployment's `worker-src 'self'` forbids. */
export const blobProbeUrl = (): string =>
  URL.createObjectURL(new Blob([PROBE_SCRIPT], { type: "text/javascript" }));

/**
 * The probe script as a same-origin URL, which is the scheme the engine's worker uses.
 *
 * A `data:` URL would be neither, and `'self'` cannot be forged from the client, so this points at
 * a real built asset served from this origin with a JavaScript content type, exactly like the
 * engine's own script.
 *
 * `?worker&url` RATHER THAN `new URL(…, import.meta.url)`, AND THE DIFFERENCE IS NOT COSMETIC. Vite
 * only emits a chunk for the `new URL` form when it is written INSIDE a `new Worker(...)` call, and
 * this file deliberately builds the URL first so the construction can be observed. Written that way
 * the build emitted nothing, `sameOriginProbeUrl()` resolved to a `.ts` path that does not exist,
 * and the probe would have reported a refusal on a perfectly healthy deployment — the same false
 * report this check exists to stop, with the sign flipped. Caught by looking in `dist/`.
 */
export const sameOriginProbeUrl = (): string => probeScriptUrl;
