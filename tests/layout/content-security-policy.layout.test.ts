/**
 * The policy the deployment sends, run against the app the deployment serves.
 *
 * A CSP is the one header that can silently break a product. Written by reading the code, it is a
 * guess; the failures it causes are invisible in every jsdom test and in every build. So it is
 * measured: the built `dist/public` is served with **the exact policy string from `vercel.json`**,
 * both routes are loaded in a real Chromium, and every `securitypolicyviolation` the page raises
 * is collected. The policy and the deployment cannot drift, because the test reads the deployment.
 *
 * TWO THINGS IT FOUND, neither of which was visible in the source:
 *
 * 1. `script-src <- eval` on **both** routes at load. Zod 4 JIT-compiles its parsers and probes
 *    for permission with `new Function("")`. It handles the refusal and falls back, so nothing was
 *    broken -- but the page reached for `new Function` on every load, and every load reported a
 *    violation. See `client/src/zod-jitless.ts`, including why the fix had to be its own module.
 * 2. The engine does not start under `script-src 'self'` alone: `WebAssembly.instantiateStreaming`
 *    is refused. `'wasm-unsafe-eval'` is enough -- `'unsafe-eval'`, which the browser's own message
 *    suggests, is not needed and would re-open eval to the whole page.
 *
 * The engine is constructed here rather than reached through the UI. It loads only on a reveal, so
 * a page-load sweep would have reported a clean policy and the first player to ask for an
 * evaluation would have met a dead worker.
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, resolve } from "node:path";
import type { Browser } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { launchChromium } from "./browser";

const root = resolve(__dirname, "../..");
const DIST = resolve(root, "dist/public");

/** The policy as deployed. Read, never restated -- a copy here could pass while production fails. */
function deployedPolicy(): string {
  const config = JSON.parse(readFileSync(resolve(root, "vercel.json"), "utf8")) as {
    routes: { headers?: Record<string, string> }[];
  };
  const header = config.routes.find((route) => route.headers?.["Content-Security-Policy"]);
  if (!header) throw new Error("vercel.json sends no Content-Security-Policy");
  return header.headers!["Content-Security-Policy"];
}

const TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
};

let browser: Browser;
let server: Server;
let origin: string;

beforeAll(async () => {
  if (!existsSync(join(DIST, "index.html"))) {
    // Same reason `browser.ts` throws rather than skips: a test that passes because it did not
    // run is the failure this product is about.
    throw new Error("dist/public is not built. Run `npm run build` before the layout tests.");
  }
  const policy = deployedPolicy();
  server = createServer((req, res) => {
    const url = (req.url ?? "/").split("?")[0];
    let file = join(DIST, url);
    // The SPA fallback the deployment performs, so /play resolves the way it does in production.
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, "index.html");
    res.setHeader("Content-Type", TYPES[extname(file)] ?? "application/octet-stream");
    res.setHeader("Content-Security-Policy", policy);
    res.end(readFileSync(file));
  });
  await new Promise<void>((done) => server.listen(0, done));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  browser = await launchChromium();
}, 90_000);

afterAll(async () => {
  await browser?.close();
  await new Promise<void>((done) => (server ? server.close(() => done()) : done()));
});

async function load(route: string) {
  const page = await browser.newPage();
  const violations: string[] = [];
  await page.addInitScript(() => {
    (window as unknown as { __violations: string[] }).__violations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      const e = event as SecurityPolicyViolationEvent;
      (window as unknown as { __violations: string[] }).__violations.push(
        `${e.violatedDirective} blocked ${e.blockedURI} at ${e.sourceFile}:${e.lineNumber}`,
      );
    });
  });
  await page.goto(`${origin}${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  violations.push(...(await page.evaluate(() => (window as unknown as { __violations: string[] }).__violations)));
  return { page, violations };
}

describe("the deployed policy, against the deployed build", () => {
  it.each(["/", "/play"])("loads %s with no policy violation", async (route) => {
    const { page, violations } = await load(route);
    await page.close();
    expect(violations, `${route} raised:\n${violations.join("\n")}`).toEqual([]);
  }, 60_000);

  it("starts the engine, which needs a wasm compile the default policy refuses", async () => {
    const assets = readdirSync(join(DIST, "assets"));
    const engineJs = assets.find(
      (name) =>
        /^stockfish-18-lite-single-.*\.js$/.test(name) &&
        statSync(join(DIST, "assets", name)).size > 1000,
    );
    const engineWasm = assets.find((name) => name.endsWith(".wasm"));
    expect(engineJs, "the built engine loader is not where this expects it").toBeDefined();
    expect(engineWasm, "the built engine wasm is not where this expects it").toBeDefined();

    const { page, violations } = await load("/play");
    // The same URL shape `defaultWorkerFactory` builds: the hash carries the wasm path.
    const answer = await page.evaluate(
      ([js, wasm]) =>
        new Promise<string>((done) => {
          const timer = setTimeout(() => done("TIMEOUT: the engine never said uciok"), 20_000);
          try {
            const worker = new Worker(`${js}#${encodeURIComponent(wasm)}`);
            worker.onmessage = (event: MessageEvent) => {
              if (String(event.data).includes("uciok")) {
                clearTimeout(timer);
                worker.terminate();
                done("uciok");
              }
            };
            worker.onerror = (event) => {
              clearTimeout(timer);
              done(`worker error: ${(event as ErrorEvent).message}`);
            };
            worker.postMessage("uci");
          } catch (error) {
            clearTimeout(timer);
            done(`threw: ${String(error)}`);
          }
        }),
      [`/assets/${engineJs}`, `/assets/${engineWasm}`],
    );
    const engineViolations = await page.evaluate(
      () => (window as unknown as { __violations: string[] }).__violations,
    );
    await page.close();
    expect(answer).toBe("uciok");
    expect([...violations, ...engineViolations]).toEqual([]);
  }, 90_000);

  it("grants the wasm compile and nothing wider", () => {
    const policy = deployedPolicy();
    expect(policy).toContain("'wasm-unsafe-eval'");
    // The browser's own error message names 'unsafe-eval'. Taking that advice would hand every
    // script on the page the ability the engine needs for one compile.
    expect(policy, "the policy allows eval on the whole page").not.toMatch(/'unsafe-eval'/);
    // Inline styles are granted for React's `style={{}}` attributes -- measured: without it a
    // style attribute does not apply at all. `style-src-elem 'self'` withdraws the half that is
    // not needed, on browsers that understand it, while older ones fall back to `style-src`.
    expect(policy).toContain("style-src-elem 'self'");
    expect(policy).toContain("style-src-attr 'unsafe-inline'");
  });
});
