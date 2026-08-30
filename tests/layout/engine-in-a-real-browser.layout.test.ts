/**
 * How long the shipped engine actually takes, in a browser, on a real position.
 *
 * WHY THIS IS THE MOST IMPORTANT MISSING NUMBER. Every performance figure this repository has ever
 * quoted was produced under Node: the harness, the parity run, the re-measurement, all of it.
 * `docs/MEASUREMENTS.md` has said so in its own words -- "the runtime is not real". The product
 * ships 7.1 MB of WebAssembly to a browser tab and asks it to search 1,587 positions, and nobody
 * had ever timed one of those searches where it happens.
 *
 * That is not a detail. An import that takes ninety seconds on a laptop and eight minutes on a
 * phone is two different products, and the second one is abandoned before it finishes.
 *
 * WHAT THIS MEASURES, AND HOW FAITHFULLY. The worker is constructed exactly as
 * `client/src/lib/stockfish.ts` constructs it -- `new Worker(js#encodeURIComponent(wasm))` -- from
 * the BUILT assets in `dist/public`, served over HTTP by a real server, in real Chromium. Not a
 * replica of the engine path: the engine path.
 *
 * WHAT IT IS NOT, twice over.
 *
 * One browser, on one machine, with no CPU throttling. A floor, not a prediction about a handset,
 * and the assertions below are deliberately loose because a tight bound on a number that varies
 * with the host is a test that fails for the wrong reason. What the numbers are FOR is the record:
 * `docs/MEASUREMENTS.md` can stop saying the runtime is unmeasured.
 *
 * And it measures the shipped ASSETS, not the app's wiring to them. The worker URL is built here
 * from what is in `dist/public/assets` rather than imported from `client/src/lib/stockfish.ts`,
 * because importing the client module into a Node test would pull in the whole render path. A
 * control confirmed the consequence honestly: breaking the engine constant in `stockfish.ts` does
 * NOT redden this file. That the app reaches the engine at all is `GATE-COMMIT`'s job -- it proves
 * the engine module is absent from the initial graph and present behind a dynamic import. This
 * file's job is what the engine DOES once reached, and deleting the wasm from the build does
 * redden it.
 */
import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, resolve } from "node:path";
import type { Browser } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { launchChromium } from "./browser";

const dist = resolve(__dirname, "../../dist/public");

const TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".wasm": "application/wasm",
  ".json": "application/json",
};

/**
 * A real static server, because the engine is a Worker fetching a `.wasm`.
 *
 * `page.setContent` cannot host either: a Worker needs a same-origin URL, and the wasm needs an
 * `application/wasm` content type or `instantiateStreaming` refuses it. Serving the built output
 * is the only way to exercise the path the product uses.
 */
function serve(): Promise<{ server: Server; origin: string }> {
  return new Promise((done) => {
    const server = createServer((req, res) => {
      const path = join(dist, decodeURIComponent((req.url ?? "/").split("?")[0]));
      if (!existsSync(path) || !path.startsWith(dist)) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, {
        "content-type": TYPES[extname(path)] ?? "application/octet-stream",
        // The engine build wants these to use threads; harmless single-threaded and closer to prod.
        "cross-origin-opener-policy": "same-origin",
        "cross-origin-embedder-policy": "require-corp",
      });
      createReadStream(path).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      done({ server, origin: `http://127.0.0.1:${port}` });
    });
  });
}

/** Six real middlegame positions from the corpus's own games, so this is not startpos six times. */
const POSITIONS = [
  "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
  "r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 8",
  "r2q1rk1/pp1bbppp/2n1pn2/3p4/3P4/2NBPN2/PP3PPP/R1BQ1RK1 w - - 4 10",
  "2rq1rk1/pb2bppp/1pn1pn2/3p4/2PP4/1PN1PN2/PB3PPP/R2Q1RK1 w - - 2 12",
  "r4rk1/1bq1bppp/p1n1pn2/1p6/3P4/P1NBPN2/1PQ2PPP/R1B2RK1 w - - 0 14",
  "3r1rk1/1bq1bppp/p1n1pn2/1p6/3P4/P1NBPN2/1PQ2PPP/R1BR2K1 w - - 2 15",
];

/** The depth `analyzePositions` defaults to, which is what a real import searches at. */
const IMPORT_DEPTH = 12;
/** Decisions in the canonical record, so the extrapolation is against a real import. */
const IMPORT_POSITIONS = 1587;

let browser: Browser;
let server: Server;
let origin: string;

beforeAll(async () => {
  if (!existsSync(dist)) {
    throw new Error(
      `no build at ${dist} -- run \`npm run build\` first. This test measures the SHIPPED assets, ` +
        `so there is nothing honest to measure without them.`,
    );
  }
  browser = await launchChromium();
  ({ server, origin } = await serve());
}, 120_000);

afterAll(async () => {
  await browser?.close();
  server?.close();
});

interface Timing {
  loadMs: number;
  searches: number[];
  /** From the engine's own `info ... nps`, so a reader on another device can divide. */
  nps: number[];
  heapMb: number | null;
  name: string;
}

/**
 * WHY THERE IS NO PHONE NUMBER HERE, and it is not for want of trying.
 *
 * The obvious move is `Emulation.setCPUThrottlingRate` at Lighthouse's 4x mobile multiplier. It
 * was tried, and it is a TRAP for this particular measurement: CDP throttles the page's MAIN
 * thread, and the engine runs in a Worker on a thread of its own. The first version of this file
 * duly reported 46 / 44 / 45 ms at 1x / 4x / 6x -- three numbers that look like a finding
 * ("the engine is CPU-insensitive!") and are an artefact of throttling a thread the work is not on.
 * Engine LOAD moved, 443 -> 522 ms, because that part is main-thread. The searches did not move
 * because nothing had been slowed.
 *
 * Throttling the worker itself is not reachable from here: Playwright's `newCDPSession` accepts a
 * Page or a Frame and refuses a Worker, and the flattened `Target` route is not exposed by its
 * CDPSession.
 *
 * So this file measures 1x precisely, reports NODES PER SECOND so a reader on any device can
 * divide, and leaves the handset figure recorded as UNMEASURED. A wrong number about a phone is
 * worse than no number, because someone would plan around it.
 */
const THROTTLES = [1];

async function measure(cpuThrottle = 1): Promise<Timing> {
  /*
   * THE LARGEST OF THE THREE, and the size is the discriminator on purpose. The build emits three
   * `stockfish-18-lite-single-*.js` assets: the ~21 kB loader the product actually constructs a
   * Worker from, and two 80-byte stubs the loader references internally. Picking by name alone
   * gets a stub, and a stub answers no handshake -- which would fail this test for a reason that
   * has nothing to do with the engine.
   */
  const assetDir = join(dist, "assets");
  const candidates = readdirSync(assetDir)
    .filter((f) => /^stockfish-18-lite-single-.*\.js$/.test(f))
    .map((f) => ({ f, size: statSync(join(assetDir, f)).size }))
    .sort((a, b) => b.size - a.size);
  const js = candidates[0]?.f;
  const wasm = readdirSync(assetDir).find((f) => f.endsWith(".wasm"));
  expect(js, "no built stockfish js in dist/public/assets").toBeTruthy();
  expect(wasm, "no built stockfish wasm in dist/public/assets").toBeTruthy();

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  if (cpuThrottle > 1) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpuThrottle });
  }
  await page.goto(`${origin}/index.html`);

  const result = await page.evaluate(
    async ({ js, wasm, positions, depth }) => {
      /*
       * Constructed exactly as client/src/lib/stockfish.ts does it, fragment and all. The loader
       * reads the wasm path out of `location.hash`, so the shape of this URL is load-bearing.
       */
      const started = performance.now();
      const worker = new Worker(`/assets/${js}#${encodeURIComponent(`/assets/${wasm}`)}`);
      const lines: string[] = [];
      worker.onmessage = (e: MessageEvent) => lines.push(String(e.data));

      const waitFor = (test: (line: string) => boolean, timeoutMs = 120_000) =>
        new Promise<void>((resolve, reject) => {
          const startedAt = performance.now();
          const tick = () => {
            if (lines.some(test)) return resolve();
            if (performance.now() - startedAt > timeoutMs) return reject(new Error("engine timeout"));
            setTimeout(tick, 5);
          };
          tick();
        });

      worker.postMessage("uci");
      await waitFor((l) => l === "uciok");
      const name = lines.find((l) => l.startsWith("id name "))?.slice(8) ?? "unknown";
      worker.postMessage("setoption name Threads value 1");
      worker.postMessage("setoption name Hash value 16");
      worker.postMessage("isready");
      await waitFor((l) => l === "readyok");
      const loadMs = performance.now() - started;

      const searches: number[] = [];
      const nps: number[] = [];
      for (const fen of positions) {
        lines.length = 0;
        // `ucinewgame` before every search, exactly as StockfishClient does on every path.
        worker.postMessage("ucinewgame");
        worker.postMessage("isready");
        await waitFor((l) => l === "readyok");
        lines.length = 0;
        const at = performance.now();
        worker.postMessage(`position fen ${fen}`);
        worker.postMessage(`go depth ${depth}`);
        await waitFor((l) => l.startsWith("bestmove"));
        searches.push(performance.now() - at);
        /* The engine's own throughput, from the deepest info line it emitted for this position. */
        const deepest = [...lines].reverse().find((l) => l.includes(" nps "));
        const match = deepest?.match(/ nps (\d+)/);
        if (match) nps.push(Number(match[1]));
      }
      worker.postMessage("quit");
      const memory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      return { loadMs, searches, nps, name, heapMb: memory ? memory.usedJSHeapSize / 1e6 : null };
    },
    { js: js!, wasm: wasm!, positions: POSITIONS, depth: IMPORT_DEPTH },
  );
  await page.close();
  return result;
}

const medianOf = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

describe("the engine the product ships, in the browser it ships to", () => {
  let timing: Timing;
  const byThrottle = new Map<number, Timing>();

  beforeAll(async () => {
    for (const rate of THROTTLES) byThrottle.set(rate, await measure(rate));
    timing = byThrottle.get(1)!;
    /* eslint-disable no-console */
    console.log(
      [
        "",
        `  engine   ${timing.name}`,
        "",
        `  engine load + handshake      ${Math.round(timing.loadMs)} ms`,
        `  depth-${IMPORT_DEPTH} search, median      ${Math.round(medianOf(timing.searches))} ms  ` +
          `(${Math.round(Math.min(...timing.searches))}-${Math.round(Math.max(...timing.searches))})`,
        `  nodes per second, median     ${medianOf(timing.nps).toLocaleString("en-US")}`,
        `  a ${IMPORT_POSITIONS}-position import       ` +
          `${((medianOf(timing.searches) * IMPORT_POSITIONS) / 1000 / 60).toFixed(1)} minutes of engine time`,
        timing.heapMb === null ? "" : `  JS heap after the run        ${timing.heapMb.toFixed(1)} MB`,
        "",
        "  ON THIS MACHINE, UNTHROTTLED. A handset figure is NOT measured here -- see the comment",
        "  on THROTTLES. Divide the nps above by a device's own to scale the import time.",
        "",
      ].join("\n"),
    );
  }, 900_000);

  it("reports its own throughput, so another device can be compared without re-running this", () => {
    /*
     * The honest substitute for a handset measurement. Search TIME is a fact about this machine;
     * nodes per second is a fact about this machine that another machine can be divided into.
     */
    expect(timing.nps.length, "the engine emitted no nps at all").toBeGreaterThan(0);
    expect(medianOf(timing.nps)).toBeGreaterThan(10_000);
  });

  it("keeps a whole import inside the time a person might sit through, here", () => {
    /*
     * Loose, and pointed at the cliff rather than at the number. What this refuses is the
     * configuration where an import becomes an hour: a lost wasm falling back to asm.js, a depth
     * that stopped being honoured, a build that shipped the wrong engine.
     */
    const minutes = (medianOf(timing.searches) * IMPORT_POSITIONS) / 1000 / 60;
    expect(minutes, `a ${IMPORT_POSITIONS}-position import would take ${minutes.toFixed(1)} minutes here`).
      toBeLessThan(10);
  });

  it("loads and answers a handshake at all", () => {
    expect(timing.name, "the browser got a different engine than the one we ship").toContain(
      "Stockfish",
    );
    expect(timing.loadMs).toBeGreaterThan(0);
  });

  it("returns a bestmove for every position at the import's own depth", () => {
    expect(timing.searches).toHaveLength(POSITIONS.length);
    for (const ms of timing.searches) expect(ms).toBeGreaterThan(0);
  });

  it("is inside an order of magnitude of what the product assumes", () => {
    /*
     * DELIBERATELY LOOSE. This runs on whatever machine CI gave us, with no throttling, so a tight
     * bound would fail for the wrong reason and teach everyone to skip it. What it catches is the
     * failure that matters: the engine falling off a cliff -- a build that lost its wasm and fell
     * back to asm.js, threads that stopped being available, a depth that stopped being honoured.
     * Ten seconds per position at depth 12 is not a slow machine, it is a broken configuration.
     */
    const median = [...timing.searches].sort((a, b) => a - b)[Math.floor(timing.searches.length / 2)];
    expect(median, `median depth-${IMPORT_DEPTH} search was ${Math.round(median)} ms`).toBeLessThan(
      10_000,
    );
  });

  it("loads the engine in a time a person would wait through", () => {
    expect(timing.loadMs, `engine load took ${Math.round(timing.loadMs)} ms`).toBeLessThan(60_000);
  });
});
