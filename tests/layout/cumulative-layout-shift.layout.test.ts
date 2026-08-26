/**
 * What moves under the player's cursor after the page has already been painted.
 *
 * CLS is invisible to every other test in this repository. jsdom reports no boxes at all, and a
 * green build says nothing about whether the thing you were about to click stayed where it was.
 * So it is measured: the built app is served, loaded in Chromium behind a `layout-shift`
 * observer, and the score is read off both routes at a phone width and a desktop width.
 *
 * WHAT IT FOUND, and one of the two was this branch's own doing:
 *
 * | | before | after |
 * | --- | --- | --- |
 * | `/play` at 1280 | 0.06584 | 0.00000 |
 * | `/play` at 390 | 0.067 | 0.00000 |
 * | `/` at 390 | 0.07811 | 0.00015 |
 *
 * `/play` was the `ContextRibbon`: absent while `useClaimView` loads, then appearing above the
 * board and dropping `section.workbench` 98 pixels. The ribbon now holds its slot -- see
 * `ContextRibbon.tsx`, and the measured heights in `index.css`.
 *
 * `/` was the licence footer added three commits earlier. It is the last element on the page, and
 * when the record layers replaced "קורא את הרשומה…" it was pushed 289 pixels down. A shift of the
 * last element is still a shift. It now renders after the record has answered, so it is inserted
 * at its final position instead of being moved to it.
 *
 * The budget is 0.02: a hundred times the 0.00015 that remains, a fifth of Google's 0.1 threshold
 * for "good", and well under the 0.066 this caught. It is deliberately not 0 -- a threshold at the
 * noise floor fails on a day nothing changed, and a test that cries wolf gets deleted.
 */
import { readFileSync, existsSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, resolve } from "node:path";
import type { Browser } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { launchChromium } from "./browser";

const DIST = resolve(__dirname, "../..", "dist/public");
const BUDGET = 0.02;

const TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
};

let browser: Browser;
let server: Server;
let origin: string;

beforeAll(async () => {
  if (!existsSync(join(DIST, "index.html"))) {
    throw new Error("dist/public is not built. Run `npm run build` before the layout tests.");
  }
  server = createServer((req, res) => {
    const url = (req.url ?? "/").split("?")[0];
    let file = join(DIST, url);
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, "index.html");
    res.setHeader("Content-Type", TYPES[extname(file)] ?? "application/octet-stream");
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

async function score(route: string, width: number) {
  const page = await browser.newPage({ viewport: { width, height: 844 } });
  await page.addInitScript(() => {
    const state = window as unknown as { __cls: number; __shifts: string[] };
    state.__cls = 0;
    state.__shifts = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as {
        value: number;
        hadRecentInput: boolean;
        sources?: { node?: Element | null; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }[];
      }[]) {
        // Shifts within 500ms of an input are expected -- the player caused them.
        if (entry.hadRecentInput) continue;
        state.__cls += entry.value;
        const moved = (entry.sources ?? []).map((source) => {
          const node = source.node as Element | null | undefined;
          const name = node ? node.nodeName.toLowerCase() : "(node gone)";
          const className =
            node && typeof (node as HTMLElement).className === "string"
              ? `.${(node as HTMLElement).className.split(" ")[0]}`
              : "";
          return `${name}${className} y ${Math.round(source.previousRect.y)}->${Math.round(source.currentRect.y)}`;
        });
        state.__shifts.push(`${entry.value.toFixed(5)} ${moved.join(" | ") || "(no source reported)"}`);
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto(`${origin}${route}`, { waitUntil: "networkidle" });
  // Past the point where the queries have settled and anything they render has painted.
  await page.waitForTimeout(2000);
  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  const shifts = await page.evaluate(() => (window as unknown as { __shifts: string[] }).__shifts);
  await page.close();
  return { cls, shifts };
}

describe.each([
  { label: "a phone", width: 390 },
  { label: "a desktop", width: 1280 },
])("nothing moves after paint on $label", ({ width }) => {
  it.each(["/", "/play"])("holds %s within the shift budget", async (route) => {
    const { cls, shifts } = await score(route, width);
    expect(
      cls,
      `${route} at ${width}px scored ${cls.toFixed(5)} against a budget of ${BUDGET}:\n${shifts.join("\n")}`,
    ).toBeLessThan(BUDGET);
  }, 60_000);
});
