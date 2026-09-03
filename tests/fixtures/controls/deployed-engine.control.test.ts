/**
 * POSITIVE CONTROL for `the-engine-that-speaks.deployment.test.ts` (`R-27`).
 *
 * WHY THE FIXTURE IS A POLICY AND NOT A WRONG ORIGIN. The wrong-origin control already exists and
 * it answers a different question: *"is this even our application"*. The claim here is narrower and
 * its failure mode is specific -- **the application is served correctly and its engine cannot
 * start** -- which is exactly what `R-09` was. The honest fixture is therefore the real build,
 * served from a real HTTP origin, under a policy that breaks it.
 *
 * TWO BREAKS, BECAUSE THEY FAIL DIFFERENTLY AND ONLY ONE IS OBVIOUS:
 *
 *   A. `worker-src 'none'` -- the constructor throws in about 4 ms. This is the `R-09` class:
 *      loud, immediate, and the one a human would notice.
 *
 *   B. `script-src 'self'` with no `'wasm-unsafe-eval'` -- the worker STARTS and the wasm never
 *      compiles. No throw, no message, no error event. The app looks alive, every reveal is empty,
 *      and a field participant would report that the product told them nothing. A probe that only
 *      caught A would go green on the failure that actually contaminates a trial.
 *
 * BOTH MUST BE RED. `vitest.controls.config.ts` collects this file; `npm test` does not. The
 * workflow runs it and treats a PASS as the error, because a probe that reaches `uciok` under a
 * policy forbidding workers is a probe that is not reading the policy.
 *
 * IT SERVES `dist/public` ITSELF rather than pointing at the deployment, so it needs no network and
 * cannot be confused with a real outage. The bytes are the shipped build; only the header differs.
 */
import { createReadStream, existsSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, resolve } from "node:path";
import type { Browser } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { launchChromium } from "../../layout/browser";
import { probeEngineAt } from "../../deployment/engine-probe";

const dist = resolve(__dirname, "../../../dist/public");

const TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".wasm": "application/wasm",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

/** The shipped build, served under whatever policy the caller wants to test. */
function serveUnder(csp: string): Promise<{ server: Server; origin: string }> {
  return new Promise((done) => {
    const server = createServer((req, res) => {
      const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
      let path = join(dist, url);
      if (!extname(path) || !existsSync(path)) path = join(dist, "index.html");
      res.writeHead(200, {
        "content-type": TYPES[extname(path)] ?? "application/octet-stream",
        "content-security-policy": csp,
      });
      createReadStream(path).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => {
      const a = server.address();
      done({ server, origin: `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}` });
    });
  });
}

let browser: Browser;
const servers: Server[] = [];

beforeAll(async () => {
  if (!existsSync(dist)) throw new Error(`no build at ${dist} -- run \`npm run build\``);
  browser = await launchChromium();
}, 180_000);

afterAll(async () => {
  await browser?.close();
  for (const server of servers) server.close();
});

describe("the engine probe must go red on a policy that breaks the engine", () => {
  it("A: worker-src 'none' -- the R-09 class, loud and immediate", async () => {
    const { server, origin } = await serveUnder(
      "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'none'; connect-src 'self'",
    );
    servers.push(server);
    const result = await probeEngineAt(browser, origin, 20_000);
    expect(
      result.verdict,
      "the probe reached uciok under a policy that forbids workers -- it is not reading the policy",
    ).toBe("UCIOK");
  }, 300_000);

  it("B: no 'wasm-unsafe-eval' -- the silent one, which looks like a slow network", async () => {
    const { server, origin } = await serveUnder(
      "default-src 'self'; script-src 'self'; worker-src 'self'; connect-src 'self'",
    );
    servers.push(server);
    const result = await probeEngineAt(browser, origin, 20_000);
    expect(
      result.verdict,
      "the probe reached uciok with no wasm permission -- the silent failure would ship",
    ).toBe("UCIOK");
  }, 300_000);
});
