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

/**
 * THE MEDIAN OF THREE LOADS, NOT ONE -- AND THE BUDGET IS UNCHANGED.
 *
 * This measured a single page load, and a single load is not a property of the page: it is a
 * property of the page AND of how busy the machine was. CI failed on `/` at 390px with 0.02228
 * against 0.02, on a commit whose only change was one markdown file -- and the same source had
 * passed three times in the preceding hour. What it reported was
 *
 *     0.01163 section.first-decision y 172->191 | footer.record-notices y 536->554
 *             | button.ghost-control y 95->114
 *     0.01065 section.first-decision y 191->172 | footer.record-notices y 554->537
 *             | button.ghost-control y 114->95
 *
 * down nineteen pixels and back up: `p.record-page-claim` in the header gaining a line and losing
 * it while the record layers settled. A transient that nets to zero, not a layout that ended up
 * wrong.
 *
 * WHAT WAS RULED OUT, BY MEASUREMENT RATHER THAN BY ARGUMENT. Twenty-four loads in the pinned
 * Chromium scored 0.00015 every time; with the CPU throttled 20x, still 0.00015; with the webfonts
 * held back 800ms past first paint, 0.00026 -- the 3px `#text` swap this budget already tolerates.
 * The scrollbar was the obvious suspect, because 19px is exactly one line of that paragraph and a
 * classic bar takes ~15px out of the content box. It is not the cause here: measured at 390px, the
 * content width is 366px whether or not the page overflows, because this Chromium draws an overlay
 * scrollbar. `scrollbar-gutter: stable` was tried and reverted -- it makes the width 351px and the
 * paragraph three lines PERMANENTLY, which is a visible change for every reader in exchange for a
 * benefit that could not be shown.
 *
 * The one local reproduction came while a dozen other Chromium and vitest processes were running
 * on this machine: 0.03762, once, under load that nothing else here reproduces on demand.
 *
 * SO THE GATE IS RIGHT AND THE STATISTIC WAS FRAGILE. Three independent loads, and the median is
 * what must clear the budget. A real shift -- the 0.066 ribbon and the 0.078 footer this file was
 * written for -- happens on every load and moves the median. A scheduling spike happens on one and
 * does not.
 *
 * THE COST, STATED. This halves sensitivity to a shift that only fires about half the time; such a
 * defect now needs two of three loads to show it. That is the trade being made, and it is made
 * knowingly: the budget stays at 0.02, because answering a gate by moving it is the thing this
 * file exists to prevent. Every load's score is printed on failure, so a future failure says
 * whether it was one load or three.
 */
const LOADS = 3;

describe.each([
  { label: "a phone", width: 390 },
  { label: "a desktop", width: 1280 },
])("nothing moves after paint on $label", ({ width }) => {
  it.each(["/", "/play"])("holds %s within the shift budget", async (route) => {
    const runs: { cls: number; shifts: string[] }[] = [];
    for (let load = 0; load < LOADS; load += 1) runs.push(await score(route, width));
    const median = [...runs].sort((a, b) => a.cls - b.cls)[Math.floor(LOADS / 2)].cls;
    const detail = runs
      .map((run, index) => `  load ${index + 1}: ${run.cls.toFixed(5)}\n${run.shifts.map((s) => `    ${s}`).join("\n")}`)
      .join("\n");
    expect(
      median,
      `${route} at ${width}px scored a median of ${median.toFixed(5)} over ${LOADS} loads against a budget of ${BUDGET}:\n${detail}`,
    ).toBeLessThan(BUDGET);
  }, 120_000);
});
