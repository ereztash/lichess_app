/**
 * What a person who is not the owner can actually reach.
 *
 * THE QUESTION. This deployment is single-tenant on purpose: every Lichess endpoint is gated on one
 * `OWNER_OPEN_ID`, and the repository has no `LICENSE`. Both are the owner's decisions and neither
 * is a defect. But they are decisions about DISTRIBUTION, and they were being read as though they
 * were decisions about the product -- as if nobody but the owner could use the thing at all.
 *
 * The code says otherwise. `server/_core/configuration.ts` puts it plainly about a deployment with
 * no owner configured: *"the record stays in the browser and the database is never written to.
 * Nothing fails, it just doesn't happen."* `LocalRecordStore` implements the same `RecordStore`
 * interface the server one does, and the game imports read Lichess and Chess.com's public APIs
 * straight from the browser with no token.
 *
 * So the claim to be tested is: **a stranger, on a static host, with no account and no server,
 * gets a working product.** That had never been checked, and "the code implies it" is exactly the
 * kind of reasoning this repository does not accept anywhere else.
 *
 * HOW IT IS TESTED. The built assets, served statically, with every `/api/*` request answered 503
 * -- which is what a static host does, and is harsher than reality. `GATE-REACHABILITY` already
 * proves a newcomer reaches a measurement, but it proves it in jsdom against modules. This proves
 * it against the shipped bundle in a real browser with the server switched off.
 */
import { createReadStream, existsSync, readdirSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, resolve } from "node:path";
import type { Browser, Page } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { launchChromium } from "./browser";

const dist = resolve(__dirname, "../../dist/public");
const TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".wasm": "application/wasm",
  ".json": "application/json",
  ".woff2": "font/woff2",
};

/** A static host: files, and a 503 for anything that looks like an API. */
function serve(): Promise<{ server: Server; origin: string }> {
  return new Promise((done) => {
    const server = createServer((req, res) => {
      const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
      if (url.startsWith("/api")) {
        res.writeHead(503, { "content-type": "text/plain" }).end("no server here");
        return;
      }
      let path = join(dist, url);
      if (!extname(path) || !existsSync(path)) path = join(dist, "index.html");
      res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
      createReadStream(path).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => {
      const a = server.address();
      done({ server, origin: `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}` });
    });
  });
}

let browser: Browser;
let server: Server;
let origin: string;
let page: Page;
let crashes: string[];
let wasmUrl: string;

beforeAll(async () => {
  if (!existsSync(dist)) throw new Error(`no build at ${dist} -- run \`npm run build\``);
  browser = await launchChromium();
  ({ server, origin } = await serve());
  crashes = [];
  page = await browser.newPage({ viewport: { width: 1350, height: 940 } });
  page.on("pageerror", (e) => crashes.push(String(e)));
  await page.goto(`${origin}/play`, { waitUntil: "networkidle" });
  await page.waitForSelector(".board-square", { timeout: 30_000 }).catch(() => undefined);
  const wasm = readdirSync(join(dist, "assets")).find((f) => f.endsWith(".wasm"));
  if (!wasm) throw new Error("no engine wasm in the build -- nothing to prove reachable");
  wasmUrl = `/assets/${wasm}`;
}, 180_000);

afterAll(async () => {
  await page?.close();
  await browser?.close();
  server?.close();
});

describe("a stranger, on a static host, with no account", () => {
  it("gets a board", async () => {
    expect(await page.locator(".board-square").count()).toBe(64);
  });

  it("gets the STARTING position, not an empty or half-drawn one", async () => {
    /*
     * 32 pieces. A board that renders sixty-four squares and no pieces is a board that failed to
     * load its game state, and it would pass the assertion above.
     */
    expect(await page.locator(".piece").count()).toBe(32);
  });

  it("does not show a crash screen when every API call fails", async () => {
    /*
     * The failure this is really about. Five lazy boundaries and a tRPC client all reach for a
     * server that is not there. If any of them escapes to `ErrorBoundary`, the stranger's first
     * screen is "something broke" -- about a deployment that is working exactly as designed.
     */
    const boundary = await page.locator(".boundary-reload, .error-boundary").count();
    expect(boundary, "an error boundary rendered on a healthy static deployment").toBe(0);
    expect(await page.locator("body").innerText()).not.toContain("משהו נשבר במסך הזה");
  });

  it("says which record it is keeping, rather than pretending it has a server", async () => {
    /*
     * R1's shape applied to provenance: a record that will vanish with the tab must not look like
     * one that persists. The screen has to say which of the two is in force.
     */
    const text = await page.locator("body").innerText();
    expect(
      /דפדפן|מקומי|בלי חשבון/.test(text),
      "nothing on screen tells the stranger their record is local",
    ).toBe(true);
  });

  it("throws no unhandled error at all while doing it", () => {
    expect(crashes, "unhandled errors on a static deployment").toEqual([]);
  });

  it("can fetch the engine's own wasm over the same static host", async () => {
    /*
     * The whole decision loop is client-side: the board, the record, and 7.1 MB of WebAssembly
     * arriving over the host that just answered 503 to every API call. If the wasm is reachable
     * here, everything the product measures is reachable without a backend.
     *
     * The first version of this asserted `[...document.querySelectorAll("script")].length >= 0`,
     * which is true of every document that has ever existed. It is replaced by a fetch of the real
     * engine asset, checked for an ok status AND for the seven megabytes that distinguish the
     * engine from a 404 page served with a 200.
     */
    const wasm = await page.evaluate(async (url) => {
      const r = await fetch(url).catch(() => null);
      if (!r?.ok) return { ok: false, bytes: 0, type: "" };
      const buf = await r.arrayBuffer();
      return { ok: true, bytes: buf.byteLength, type: r.headers.get("content-type") ?? "" };
    }, wasmUrl);
    expect(wasm.ok, "the engine wasm is not reachable on a static host").toBe(true);
    expect(wasm.bytes, "something answered, but it was not seven megabytes of engine").
      toBeGreaterThan(5_000_000);
  });
});
