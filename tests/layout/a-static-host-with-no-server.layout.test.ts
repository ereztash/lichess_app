/**
 * The deployment a stranger could actually be given: files on a static host, and nothing else.
 *
 * WHAT THIS IS FOR. `a-stranger-with-no-server.layout.test.ts` proves the APP works with the server
 * switched off. This proves the DEPLOYMENT does -- that the configuration a static host reads is
 * present, correct, and says the same thing the Vercel configuration says.
 *
 * Three ways a static deployment of this particular app fails silently, and all three are here:
 *
 *   1. No SPA fallback. `/play` is a client route, not a file. Without a rewrite, a refresh on it
 *      or a pasted link to it is a 404 from the host -- the first thing a stranger would hit.
 *   2. A CSP without `wasm-unsafe-eval` or `worker-src`. The engine is 7.1 MB of WebAssembly
 *      running in a Worker; either omission leaves a board that never analyses anything, with no
 *      error a user could report.
 *   3. Drift. Vercel reads `vercel.json`; Netlify and Cloudflare Pages read `_headers`. Neither
 *      can read the other's format, so the policy exists twice -- and two copies of a security
 *      header are exactly the shape this repository has been bitten by before.
 */
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const dist = resolve(root, "dist/public");

/** The policy as each host would read it. */
const vercelCsp: string = JSON.parse(readFileSync(resolve(root, "vercel.json"), "utf8")).routes[0]
  .headers["Content-Security-Policy"];

function headersFileCsp(): string {
  const text = readFileSync(resolve(dist, "_headers"), "utf8");
  const line = text.split("\n").find((l) => l.trim().startsWith("Content-Security-Policy:"));
  if (!line) throw new Error("_headers carries no Content-Security-Policy");
  return line.slice(line.indexOf(":") + 1).trim();
}

describe("the configuration a static host reads", () => {
  it("ships both files into the build, where a host can see them", () => {
    expect(existsSync(resolve(dist, "_headers")), "no _headers in the build").toBe(true);
    expect(existsSync(resolve(dist, "_redirects")), "no _redirects in the build").toBe(true);
  });

  it("rewrites unknown paths to the app rather than 404ing them", () => {
    const redirects = readFileSync(resolve(dist, "_redirects"), "utf8");
    const rule = redirects.split("\n").find((l) => l.trim().startsWith("/*"));
    expect(rule, "no catch-all rule -- /play would 404 on a refresh").toBeTruthy();
    expect(rule).toContain("/index.html");
    /* 200 and not 301: the URL has to stay /play or the router never sees it. */
    expect(rule, "a redirect changes the URL; the router needs a rewrite").toContain("200");
  });

  it("keeps the two copies of the policy identical, because neither host reads the other's", () => {
    /*
     * The drift assertion. This repository has already been bitten twice by a fact stored in two
     * places -- the gate table against the gate runner, the harness manifest against the harness --
     * and a Content-Security-Policy is a worse thing to get wrong than either.
     */
    expect(headersFileCsp()).toBe(vercelCsp);
  });

  it("permits the two things without which the engine simply does not run", () => {
    for (const csp of [vercelCsp, headersFileCsp()]) {
      expect(csp, "WebAssembly will not instantiate without wasm-unsafe-eval").toContain(
        "wasm-unsafe-eval",
      );
      expect(csp, "the engine runs in a Worker").toContain("worker-src 'self'");
    }
  });

  it("still permits only the two game archives it reads, and no other origin", () => {
    /*
     * A static host removes the server, not the discipline. `connect-src` is what stops a page
     * that has the player's own words in it from talking to anywhere else.
     */
    const connect = vercelCsp.split(";").find((d) => d.trim().startsWith("connect-src"))!;
    expect(connect).toContain("https://lichess.org");
    expect(connect).toContain("https://api.chess.com");
    expect(connect.trim().split(/\s+/).slice(1).sort()).toEqual([
      "'self'",
      "https://api.chess.com",
      "https://lichess.org",
    ]);
  });

  it("carries the licence texts the GPL requires it to convey", () => {
    /*
     * GATE-NOTICE proves the notices file names what the build conveys. This proves the texts it
     * points at are actually IN the build -- a static host serves files, and a licence link that
     * 404s is a licence that did not travel.
     */
    for (const path of [
      "licenses/stockfish/COPYING.txt",
      "licenses/fonts/noto-sans-hebrew/OFL.txt",
      "licenses/fonts/dm-mono/OFL.txt",
    ]) {
      expect(existsSync(resolve(dist, path)), `${path} is not in the build`).toBe(true);
      expect(readFileSync(resolve(dist, path), "utf8").length).toBeGreaterThan(1000);
    }
  });
});

/** A host that obeys `_redirects`, so the fallback is exercised rather than assumed. */
let server: Server;
let origin: string;

beforeAll(async () => {
  const rewrite = readFileSync(resolve(dist, "_redirects"), "utf8").includes("/index.html");
  server = createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
    const path = join(dist, url);
    if (existsSync(path) && extname(path)) {
      const types: Record<string, string> = {
        ".js": "text/javascript",
        ".css": "text/css",
        ".wasm": "application/wasm",
        ".html": "text/html",
        ".txt": "text/plain",
      };
      res.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream" });
      createReadStream(path).pipe(res);
      return;
    }
    if (!rewrite) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "content-type": "text/html" });
    createReadStream(join(dist, "index.html")).pipe(res);
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", () => done()));
  const a = server.address();
  origin = `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}`;
});

afterAll(() => server?.close());

describe("a host obeying that configuration", () => {
  it("serves the app on a deep link, not a 404", async () => {
    const res = await fetch(`${origin}/play`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<div id=\"root\"");
  });

  it("serves the engine wasm with the content type it needs to stream-instantiate", async () => {
    const wasm = readFileSync(resolve(dist, "index.html"), "utf8");
    void wasm;
    const { readdirSync } = await import("node:fs");
    const file = readdirSync(join(dist, "assets")).find((f) => f.endsWith(".wasm"))!;
    const res = await fetch(`${origin}/assets/${file}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/wasm");
  });

  it("serves the GPL text at the path the notices point at", async () => {
    const res = await fetch(`${origin}/licenses/stockfish/COPYING.txt`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("GNU GENERAL PUBLIC LICENSE");
  });
});
