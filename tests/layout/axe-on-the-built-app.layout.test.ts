/**
 * axe-core against the built app, in a real browser, every run.
 *
 * WHY THIS EXISTS. `tests/client/accessibility-audit.test.ts` holds the five findings a Lighthouse
 * run produced -- and it holds them by asserting the SHAPE of each fix in the source, because that
 * is all jsdom can do. Its own header says so: "Assertions here are the cheap half: they cannot
 * repaint the page." The audit that found those five was a person running Lighthouse once. Nothing
 * has re-run it since, so every accessibility regression after that day would have shipped.
 *
 * This is the other half. The real engine (axe-core, which is what Lighthouse embeds), on the real
 * built assets, in real Chromium, on every `npm test`.
 *
 * WHAT IT CHECKS AND WHAT IT CANNOT. axe finds roughly a third of WCAG failures -- the machine-
 * checkable third. It cannot tell you whether a label is a good label, whether an announcement
 * arrives at a useful moment, or whether the board is navigable in a way a person would call
 * navigable. **No screen reader has been run against this product.** That remains true and is
 * recorded as true; this narrows the gap rather than closing it.
 *
 * THE RULE SET IS THE DEFAULT ONE, deliberately. Picking rules is picking results, and a suite
 * tuned until it passes is a suite that has stopped being able to fail.
 */
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, resolve } from "node:path";
import type { Browser } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { launchChromium } from "./browser";

const dist = resolve(__dirname, "../../dist/public");
const axeSource = readFileSync(
  resolve(__dirname, "../../node_modules/axe-core/axe.min.js"),
  "utf8",
);

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

function serve(): Promise<{ server: Server; origin: string }> {
  return new Promise((done) => {
    const server = createServer((req, res) => {
      const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
      let path = join(dist, url);
      // A single-page app: anything without an extension is the shell.
      if (!extname(path) || !existsSync(path)) path = join(dist, "index.html");
      res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
      createReadStream(path).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      done({ server, origin: `http://127.0.0.1:${port}` });
    });
  });
}

interface Violation {
  id: string;
  impact: string | null;
  help: string;
  nodes: number;
  target: string;
}

interface Audit {
  violations: Violation[];
  /** Rules axe actually evaluated, and how much page it found. The floor against a vacuous pass. */
  rulesRun: number;
  squares: number;
  title: string;
}

let browser: Browser;
let server: Server;
let origin: string;

beforeAll(async () => {
  if (!existsSync(dist)) {
    throw new Error(`no build at ${dist} -- run \`npm run build\`. This audits the SHIPPED assets.`);
  }
  browser = await launchChromium();
  ({ server, origin } = await serve());
}, 120_000);

afterAll(async () => {
  await browser?.close();
  server?.close();
});

/** Lighthouse's own desktop viewport, so this and the recorded audit describe the same page. */
const VIEWPORT = { width: 1350, height: 940 };

async function audit(path: string): Promise<Audit> {
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.goto(`${origin}${path}`, { waitUntil: "networkidle" });
  // The board is the point of this audit and it renders after hydration.
  await page.waitForSelector(".board-square", { timeout: 30_000 }).catch(() => undefined);
  await page.addScriptTag({ content: axeSource });
  const result = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (ctx: unknown) => Promise<unknown> } }).axe;
    const run = (await axe.run(document)) as {
      violations: Array<{
        id: string;
        impact: string | null;
        help: string;
        nodes: Array<{ target: string[] }>;
      }>;
      passes: unknown[];
      incomplete: unknown[];
    };
    return {
      violations: run.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.length,
        target: v.nodes[0]?.target?.join(" ") ?? "",
      })),
      /* Rules that found something to look at. Zero here means axe audited an empty document. */
      rulesRun: run.passes.length + run.violations.length + run.incomplete.length,
      squares: document.querySelectorAll(".board-square").length,
      title: document.title,
    };
  });
  await page.close();
  return result;
}

/**
 * BOTH ROUTES, and auditing only one was the first version's mistake.
 *
 * `/` is `Record` -- the front door, the promise, the record. `/play` is `Home`, which is where the
 * board is. The first draft audited `/` alone, reported zero violations, and was auditing a page
 * with no board on it: the floor below caught `0 board squares on screen`. The board is the surface
 * this audit most exists for, so a run that never renders one has audited the wrong thing.
 */
const ROUTES = ["/", "/play"];

describe("the built app, audited by the engine Lighthouse uses", () => {
  const audits = new Map<string, Audit>();
  let result: Audit;
  let violations: Violation[];

  beforeAll(async () => {
    for (const route of ROUTES) audits.set(route, await audit(route));
    result = audits.get("/play")!;
    violations = [...audits.values()].flatMap((a) => a.violations);
    /* eslint-disable no-console */
    console.log(
      violations.length === 0
        ? "\n  axe-core 4: zero violations on the front door\n"
        : `\n  axe-core 4 violations:\n${violations
            .map((v) => `    ${v.impact ?? "?"}  ${v.id}  x${v.nodes}  ${v.target}`)
            .join("\n")}\n`,
    );
    for (const [route, a] of audits)
      console.log(
        `  ${route.padEnd(7)} ${a.rulesRun} rules evaluated, ${a.squares} board squares, ` +
          `${a.violations.length} violations`,
      );
    console.log("");
  }, 600_000);

  it("has no critical or serious violations", () => {
    /*
     * Split from the total on purpose. "critical" and "serious" are axe's own words for failures
     * that block a person, and those get a hard floor. Moderate and minor are reported below with
     * a ceiling that can move, because a suite that fails on a colour-contrast nit nobody has
     * triaged is a suite people learn to skip.
     */
    const blocking = violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(
      blocking.map((v) => `${v.id} x${v.nodes} (${v.target})`),
      "axe found blocking accessibility violations on the built front door",
    ).toEqual([]);
  });

  it("has not grown a backlog of the lesser ones either", () => {
    const rest = violations.filter((v) => v.impact !== "critical" && v.impact !== "serious");
    expect(
      rest.map((v) => `${v.id} x${v.nodes}`),
      "new non-blocking axe violations -- triage them, do not raise this",
    ).toEqual([]);
  });

  it("actually audited the app, so a green result cannot mean a broken harness", () => {
    /*
     * THE FLOOR, AND THE FIRST VERSION OF IT WAS ITSELF VACUOUS. It asserted the byte length of
     * axe.min.js -- which is true whether or not the page ever loaded. If the server 404s, or
     * hydration throws, `violations` is an empty array and both assertions above pass while
     * nothing has been audited.
     *
     * What is asserted now is that the subject was on screen: axe evaluated a real rule set, and
     * the board -- sixty-four squares, the surface this audit most exists for -- was rendered when
     * it did.
     */
    for (const [route, a] of audits) {
      expect(a.rulesRun, `axe evaluated no rules on ${route} -- it audited an empty document`).
        toBeGreaterThan(20);
      expect(a.title.length, `the page shell did not load on ${route}`).toBeGreaterThan(0);
    }
    expect(result.squares, "the board had not rendered when axe ran on /play").toBe(64);
  });
});
