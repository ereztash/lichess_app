/**
 * Three relations the stylesheet cannot state about itself, measured on the painted page.
 *
 * NONE OF THESE IS A COUNT AND NONE OF THEM IS A TASTE. `expect(borders).toBeLessThan(7)` is the
 * shape `what-the-eye-ranks-first` already refuses, and so is "blue must be #1e5b72". What is
 * asserted here is that a fill means ONE thing at a time, that a board still has squares when the
 * reader supplies the palette, and that a sentence ends where its language ends.
 *
 * WHY A BROWSER. All three are invisible to a stylesheet reader by construction:
 *
 *   - whether two roles share a fill depends on which controls are on screen TOGETHER, which is a
 *     render, not a rule;
 *   - `forced-colors` replaces computed values after the cascade, so the declaration is untouched
 *     and only the paint changes;
 *   - the position of a bidi-neutral character is decided by the Unicode algorithm at layout time
 *     from the direction it INHERITED, and no property on the element records it.
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
  ".png": "image/png",
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
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await new Promise<void>((done) => (server ? server.close(() => done()) : done()));
});

/**
 * ONE FILL, ONE ROLE, PER SCREEN.
 *
 * MEASURED BEFORE THE CHANGE, on the built front door at 1440x900 with the username filled so the
 * primary action is live: `--blue` was on `.primary-control` (6,128px2, "קחו אותי לעמדה") AND on
 * `.import-source[aria-pressed="true"]` (3,729px2, "Lichess"). The same probe on a READY `DECIDE`
 * found `--blue` on exactly one control, the submit -- so the convention holds inside the loop and
 * broke on the first screen a stranger sees, where the learned rule "the blue one is the thing to
 * press" pointed at a source toggle.
 *
 * THE ASSERTION IS THE RELATION, NOT THE HUE, and the hue has since moved. It reads the token the
 * semantic layer names for the primary act -- `--action` -- off the document at run time, so
 * repainting the palette changes nothing here; what fails is a second role picking up whatever the
 * primary action is wearing. It read `--blue` until that token stopped meaning "act" and started
 * meaning "the engine is speaking"; see `GATE-TWO-HANDS`.
 */
describe("the primary action's fill belongs to the primary action", () => {
  it("is worn by exactly one control on the front door, with the field filled", async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${origin}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    const input = page.locator(".first-decision-form input").first();
    if (await input.count()) await input.fill("erez");
    await page.waitForTimeout(400);

    const wearers = await page.evaluate(() => {
      const raw = getComputedStyle(document.documentElement).getPropertyValue("--action").trim();
      /* Resolve the token to the rgb() a computed style reports, via a throwaway element. */
      const probe = document.createElement("span");
      probe.style.color = raw;
      document.body.append(probe);
      const primaryFill = getComputedStyle(probe).color;
      probe.remove();
      return Array.from(document.querySelectorAll("button, a[href], input, [role=button]"))
        .filter((el) => {
          const b = el.getBoundingClientRect();
          return b.width > 2 && b.height > 2 && getComputedStyle(el).backgroundColor === primaryFill;
        })
        .map((el) => `${(el.className as string) || el.tagName}: ${(el.textContent ?? "").trim().slice(0, 24)}`);
    });

    expect(
      wearers,
      "more than one role is wearing the primary action's fill on one screen",
    ).toHaveLength(1);
    expect(wearers[0]).toMatch(/primary-control/);
    await page.close();
  }, 120_000);
});

/**
 * A BOARD KEEPS ITS SQUARES WHEN THE READER SUPPLIES THE PALETTE.
 *
 * MEASURED BEFORE THE CHANGE, in Chromium with `forced-colors: active` on `/play`: all 64 squares
 * computed `rgb(255, 255, 255)` and every piece computed `rgb(0, 0, 0)`. Not low contrast -- an
 * ERASURE. Light and dark squares painted identically, and black and white pieces painted
 * identically, which leaves a grid of 64 identical cells where the position used to be. There was
 * no `forced-colors` block anywhere in the stylesheet.
 *
 * TWO DISTINCTIONS, ASSERTED SEPARATELY, because the fix for one does not imply the other and the
 * original defect broke both.
 */
describe("forced colours do not erase the position", () => {
  it("keeps light and dark squares apart, and white and black pieces apart", async () => {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      forcedColors: "active",
    });
    await page.goto(`${origin}/play`, { waitUntil: "networkidle" });
    await page.locator("[data-square]").first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(900);

    const seen = await page.evaluate(() => {
      const bg = (sel: string) =>
        Array.from(new Set(
          Array.from(document.querySelectorAll(sel)).map((e) => getComputedStyle(e).backgroundColor),
        ));
      const fg = (sel: string) =>
        Array.from(new Set(
          Array.from(document.querySelectorAll(sel)).map((e) => getComputedStyle(e).color),
        ));
      return {
        light: bg(".board-square.light-square"),
        dark: bg(".board-square.dark-square"),
        blackPiece: fg(".piece:not(.piece-w)"),
        whitePiece: fg(".piece.piece-w"),
        squares: document.querySelectorAll("[data-square]").length,
      };
    });

    expect(seen.squares, "no board rendered, so this asserted nothing").toBe(64);
    expect(seen.light, "light squares paint more than one colour").toHaveLength(1);
    expect(seen.dark, "dark squares paint more than one colour").toHaveLength(1);
    expect(
      seen.light[0],
      "light and dark squares paint the same colour under forced colours",
    ).not.toBe(seen.dark[0]);
    expect(
      seen.whitePiece[0],
      "white and black pieces paint the same colour under forced colours",
    ).not.toBe(seen.blackPiece[0]);
    await page.close();
  }, 120_000);
});

/**
 * A HEBREW SENTENCE ENDS WHERE HEBREW ENDS.
 *
 * `.moves-rail` is `dir="ltr"` and must stay that way: it holds SAN, which is a left-to-right
 * notation. Its empty state is a Hebrew sentence, and it inherited that direction. A full stop is
 * bidi-NEUTRAL, so it resolves to the paragraph direction and lands at the far right -- which in a
 * right-to-left sentence is the beginning.
 *
 * MEASURED BEFORE THE CHANGE, on the built app at 1440x900 with Range rects on the glyphs
 * themselves: first character `ה` at x=273, final period at x=283. Ten pixels in front of the first
 * word.
 *
 * ASSERTED ON GLYPH POSITIONS, NOT ON `dir`, for the reason `signed-number-reads-as-signed`
 * already gives about the same class of bug: a property can be set and still be overridden, and the
 * question is where the character landed.
 */
describe("a bidi-neutral character resolves to its own sentence", () => {
  it("puts the full stop at the reading end of the move rail's empty state", async () => {
    const page: Page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${origin}/play`, { waitUntil: "networkidle" });
    await page.locator("[data-square]").first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(700);

    const measured = await page.evaluate(() => {
      const el = document.querySelector(".empty-moves");
      const node = el?.firstChild;
      if (!el || !node || node.nodeType !== 3) return null;
      const text = node.textContent ?? "";
      const at = (i: number) => {
        const r = document.createRange();
        r.setStart(node, i);
        r.setEnd(node, i + 1);
        return r.getBoundingClientRect().x;
      };
      return { text, firstX: at(0), lastX: at(text.length - 1) };
    });

    expect(measured, "the move rail's empty state was not on screen").not.toBeNull();
    expect(measured!.text.trim().endsWith("."), "the sentence no longer ends in a full stop").toBe(
      true,
    );
    expect(
      measured!.lastX,
      "the full stop paints to the right of the first character, so it reads before the sentence",
    ).toBeLessThan(measured!.firstX);
    await page.close();
  }, 120_000);
});
