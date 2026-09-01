/**
 * The evaluation instrument, beside the board it measures, in a real browser.
 *
 * WHAT SHIPPED, AND HOW IT WAS FOUND. `.board-assembly` declared `28px minmax(0, 1fr)` -- a width
 * that was right while column 1 held a 20px bar. The evaluation became a labelled instrument
 * (gauge, reading, engine, depth) with `min-inline-size: 6.75rem`, and a FIXED grid track does not
 * grow for an item's minimum size. So the instrument overflowed its own track by 80px into the
 * board's column, and stayed readable only where the board happened to be centred with slack to
 * spare. Measured at reveal, clearance between the instrument's right edge and the board:
 *
 *   1440x900   33px       1024x768   91px       844x390   68px
 *   1280x800    3px       390x844  -80px
 *
 * On the phone the board painted over the gauge and the reading spilled out below it. At 1280 the
 * margin was three pixels. A review bot on the pull request read the first defect off the
 * stylesheet before any of this pass's own measurements found it, which is the useful fact here:
 * every probe this pass ran measured ONE element -- contrast, size, rank, mass -- and none of them
 * asked whether two elements were in the same place.
 *
 * DEMONSTRATED RED ON THE SHIPPED SHAPE, then restored: `28px minmax(0, 1fr)` with the phone's
 * old `20px 1fr` reddens three of these eight -- 390x844, 320x700, and the axis assertion. The
 * four desktop viewports stay GREEN on the defect, and that is the finding rather than a gap in
 * the check: on a desktop the instrument really does clear the board, by 3px at 1280x800. What
 * this file asserts is disjointness, which is the invariant; the reserved track is what turns a
 * three-pixel margin into a forty-three-pixel one, and no test should be asked to have an opinion
 * about which margin is comfortable.
 *
 * SO THIS FILE ASKS THAT. Not the track width, which is a means: whether the instrument and the
 * board occupy disjoint boxes, at every viewport, in the state where both exist. And on the axis
 * the phone flipped, whether the gauge still reads as a PROPORTION -- because `height: 92%` of a
 * horizontal 16px track is 14.7px and `width: 100%`, which is a gauge that says "white is winning"
 * at every evaluation there has ever been.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, resolve } from "node:path";
import type { Browser, Page } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { launchChromium } from "./browser";

const DIST = resolve(__dirname, "../..", "dist/public");
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

/** `/play`, driven through one decision, so the engine has spoken and the instrument exists. */
async function openReveal(width: number, height: number): Promise<Page> {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(`${origin}/play`, { waitUntil: "networkidle" });
  await page.locator("[data-square]").first().waitFor({ timeout: 30_000 });
  await page.locator('[data-square="e2"]').click();
  await page.locator('[data-square="e4"]').click();
  await page.waitForTimeout(700);
  for (let i = 0; i < 4; i += 1) {
    const chip = page.locator(".read-chip:visible").first();
    if (await chip.count()) await chip.click();
    const confidence = page.locator(".confidence-row button:visible").nth(2);
    if (await confidence.count()) {
      await confidence.click();
      break;
    }
    const next = page.locator(".step-next:visible").first();
    if (await next.count()) await next.click();
    await page.waitForTimeout(250);
  }
  await page.locator(".commitment-submit").click();
  await page.waitForTimeout(2500);
  const probe = page.locator(".counterfactual-probe button").last();
  if (await probe.count()) await probe.click().catch(() => undefined);
  /*
   * WAIT FOR THE FILL, NOT FOR THE INSTRUMENT. `EvaluationBar` renders an `evaluation-empty`
   * instrument while the engine is still thinking -- same class, narrower box, no gauge fill --
   * so waiting on `.evaluation-instrument` measures the placeholder and calls it the instrument.
   */
  await page.locator(".evaluation-white").first().waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1200);
  return page;
}

const BOXES = `(() => {
  const box = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return {
      x: Math.round(b.x), right: Math.round(b.right), w: Math.round(b.width),
      y: Math.round(b.y), bottom: Math.round(b.bottom), h: Math.round(b.height),
    };
  };
  return {
    instrument: box(".evaluation-instrument"),
    board: box(".board-grid"),
    track: box(".evaluation-track"),
    white: box(".evaluation-white"),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
})()`;

type Box = { x: number; right: number; w: number; y: number; bottom: number; h: number };
type Boxes = {
  instrument: Box | null;
  board: Box | null;
  track: Box | null;
  white: Box | null;
  overflow: number;
};

/** True when two boxes share any pixel. Disjoint on EITHER axis is disjoint. */
const overlaps = (a: Box, b: Box) =>
  a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;

describe("the instrument and the board it measures", () => {
  for (const [w, h] of [
    [1440, 900],
    [1280, 800],
    [1024, 768],
    [844, 390],
    [390, 844],
    [320, 700],
  ] as [number, number][]) {
    it(`occupy disjoint boxes at ${w}x${h}`, async () => {
      const page = await openReveal(w, h);
      const seen = (await page.evaluate(BOXES)) as Boxes;
      await page.close();
      expect(seen.instrument, "no evaluation instrument at the reveal").not.toBeNull();
      expect(seen.board, "no board at the reveal").not.toBeNull();
      expect(
        overlaps(seen.instrument!, seen.board!),
        `the instrument and the board share pixels: ${JSON.stringify(seen)}`,
      ).toBe(false);
      expect(seen.overflow, `the page scrolls sideways: ${JSON.stringify(seen)}`).toBeLessThanOrEqual(0);
    }, 180_000);
  }

  it("keeps the gauge a proportion on the axis it runs along, on a phone", async () => {
    /*
     * THE ONE THAT CATCHES THE AXIS. The share arrives from `EvaluationBar.tsx` as a bare number
     * and the stylesheet decides which dimension it fills. On a phone the gauge is horizontal, so
     * the fill is an inline size; a build that still spent it on `height` would paint the whole
     * 16px track white and say white was winning at every evaluation ever recorded.
     */
    const page = await openReveal(390, 844);
    const seen = (await page.evaluate(BOXES)) as Boxes;
    await page.close();
    expect(seen.track, "no gauge").not.toBeNull();
    expect(seen.white, "no fill in the gauge").not.toBeNull();
    expect(seen.track!.w, "the phone's gauge is not horizontal").toBeGreaterThan(seen.track!.h);
    const share = seen.white!.w / seen.track!.w;
    expect(share, `the fill is ${(share * 100).toFixed(1)}% of the gauge`).toBeGreaterThan(0.05);
    expect(share, `the fill is ${(share * 100).toFixed(1)}% of the gauge`).toBeLessThan(0.95);
  }, 180_000);

  it("keeps the gauge a proportion on the axis it runs along, on a desktop", async () => {
    const page = await openReveal(1440, 900);
    const seen = (await page.evaluate(BOXES)) as Boxes;
    await page.close();
    expect(seen.track!.h, "the desktop gauge is not vertical").toBeGreaterThan(seen.track!.w);
    const share = seen.white!.h / seen.track!.h;
    expect(share, `the fill is ${(share * 100).toFixed(1)}% of the gauge`).toBeGreaterThan(0.05);
    expect(share, `the fill is ${(share * 100).toFixed(1)}% of the gauge`).toBeLessThan(0.95);
  }, 180_000);
});
