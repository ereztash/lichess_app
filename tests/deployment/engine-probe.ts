/**
 * DOES THE SHIPPED ENGINE START UNDER THE HEADERS AN ORIGIN ACTUALLY SERVES?
 *
 * `R-27`. The `L6` suite asserted the CSP **string** contains `worker-src 'self'`, which is strong
 * evidence and is not the fact. The fact is a worker that starts under the served policy, and the
 * one defect `L6` exists for -- `R-09`, a CSP that broke the worker -- was held only by that string.
 *
 * WHY IT IS SHARED CODE. The same probe runs against the deployed origin, where it must be GREEN,
 * and against two deliberately broken policies, where it must be RED. A control that ran a
 * different probe from the check would prove nothing about the check.
 *
 * IT REPLICATES `client/src/lib/stockfish.ts` `createWorker()` EXACTLY:
 *
 *     new Worker(`${ENGINE_JS}#${encodeURIComponent(ENGINE_WASM)}`)
 *
 * The fragment carries the wasm path and nothing else. Appending `,worker` to it sends the loader
 * down a branch where nothing happens at all -- no fetch, no message, not even an error -- which is
 * how the engine once shipped silent, so the URL is built here the way the product builds it rather
 * than the way a test would find convenient.
 *
 * THE SILENT FAILURE IS THE ONE THAT MATTERS. A policy that blocks the worker throws in 4 ms. A
 * policy missing `'wasm-unsafe-eval'` lets the worker start and the wasm never compiles: no error,
 * no message, an app that looks alive and produces an empty reveal for every visitor. Both are
 * controls below; only the second could be mistaken for a slow network.
 *
 * READ-ONLY, which is what lets it live in the `L6` suite: it fetches the origin's own assets and
 * starts a worker in a throwaway page. It writes nothing, anywhere.
 */
import type { Browser } from "@playwright/test";

export type ProbeVerdict = "UCIOK" | "WORKER_BLOCKED" | "WORKER_ERROR" | "TIMEOUT" | "NO_ASSETS";

export interface ProbeResult {
  verdict: ProbeVerdict;
  detail: string;
  /** What the worker said before the verdict, for a failure that needs reading. */
  lines: string[];
  /** Anything the page refused, so a red result names its own cause. */
  refusals: string[];
  ms: number;
}

/**
 * The engine assets, found in the bundle the origin actually serves rather than assumed.
 *
 * THREE THINGS THIS HAD TO LEARN, each from a run that found the wrong thing or nothing:
 *
 *   1. The bundle references chunks THREE WAYS -- `/assets/x.js`, `assets/x.js` and `./x.js` --
 *      and a crawler matching only the first walks past the chunk it is looking for. That is what
 *      `NO_ASSETS` meant the first time this ran.
 *   2. The engine JS is TWO HOPS deep. Vite's `?url` import emits a 77-byte shim whose only job is
 *      to export the real loader's URL, and the 21 kB loader is referenced from inside it. A
 *      crawler that stopped at the first match would build a Worker out of the shim.
 *   3. So the loader is chosen BY SIZE, which is the property that actually distinguishes them and
 *      does not depend on either file's hashed name.
 */
async function findEngineAssets(page: import("@playwright/test").Page) {
  return page.evaluate(async () => {
    const seen = new Set<string>();
    const candidates: string[] = [];
    let wasm: string | null = null;
    const queue = [...document.querySelectorAll<HTMLScriptElement>("script[src]")].map((s) => s.src);
    while (queue.length && seen.size < 80) {
      const url = queue.shift() as string;
      if (seen.has(url)) continue;
      seen.add(url);
      let text: string;
      try {
        text = await (await fetch(url)).text();
      } catch {
        continue;
      }
      for (const m of text.matchAll(/["'`](\.?\/?assets\/[A-Za-z0-9._-]+|\.\/[A-Za-z0-9._-]+\.js)["'`]/g)) {
        const href = new URL(m[1], url).href;
        if (/stockfish[^/]*\.wasm$/.test(href)) wasm ??= href;
        else if (/stockfish[^/]*\.js$/.test(href)) {
          if (!candidates.includes(href)) candidates.push(href);
          queue.push(href);
        } else if (href.endsWith(".js")) queue.push(href);
      }
    }
    /*
     * The loader, not the shim. Vite's `?url` import emits a module that exports the URL and
     * nothing else; it is two orders of magnitude smaller than the engine it points at.
     */
    let js: string | null = null;
    let largest = 0;
    for (const href of candidates) {
      try {
        const size = (await (await fetch(href)).text()).length;
        if (size > largest) {
          largest = size;
          js = href;
        }
      } catch {
        /* a candidate that will not fetch is not the loader */
      }
    }
    return { js, wasm };
  });
}

export async function probeEngineAt(
  browser: Browser,
  origin: string,
  timeoutMs = 90_000,
): Promise<ProbeResult> {
  const started = Date.now();
  const context = await browser.newContext();
  const page = await context.newPage();
  const refusals: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) refusals.push(m.text().slice(0, 160));
  });
  try {
    await page.goto(`${origin.replace(/\/$/, "")}/`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const assets = await findEngineAssets(page);
    if (!assets.js || !assets.wasm) {
      return {
        verdict: "NO_ASSETS",
        detail: `js=${assets.js} wasm=${assets.wasm}`,
        lines: [],
        refusals,
        ms: Date.now() - started,
      };
    }
    const result = await page.evaluate(
      ({ js, wasm, timeout }) =>
        new Promise<{ verdict: string; detail: string; lines: string[] }>((resolve) => {
          let worker: Worker | undefined;
          const lines: string[] = [];
          const done = (verdict: string, detail: string) => {
            try {
              worker?.terminate();
            } catch {
              /* a worker that never started has nothing to terminate */
            }
            resolve({ verdict, detail, lines });
          };
          const timer = setTimeout(() => done("TIMEOUT", `no uciok within ${timeout} ms`), timeout);
          try {
            worker = new Worker(`${js}#${encodeURIComponent(wasm)}`);
          } catch (e) {
            clearTimeout(timer);
            return done("WORKER_BLOCKED", String(e));
          }
          worker.onerror = (e) => {
            clearTimeout(timer);
            done("WORKER_ERROR", (e as ErrorEvent).message || "worker error");
          };
          worker.onmessage = (event: MessageEvent) => {
            const line = typeof event.data === "string" ? event.data : JSON.stringify(event.data);
            if (lines.length < 10) lines.push(line);
            if (/uciok/.test(line)) {
              clearTimeout(timer);
              done("UCIOK", `after ${lines.length} lines`);
            }
          };
          worker.postMessage("uci");
        }),
      { js: assets.js, wasm: assets.wasm, timeout: timeoutMs },
    );
    return { ...(result as { verdict: ProbeVerdict; detail: string; lines: string[] }), refusals, ms: Date.now() - started };
  } finally {
    await context.close();
  }
}
