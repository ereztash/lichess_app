/**
 * How many times you press Tab to get past the board, measured in a real browser.
 *
 * WHY THIS CANNOT BE A jsdom TEST. jsdom does not implement sequential focus navigation at all:
 * `Tab` is an event you can dispatch and nothing moves. Every jsdom assertion about a roving
 * tabindex therefore checks the ATTRIBUTE and infers the behaviour, and the inference is the part
 * worth doubting -- `tabindex="-1"` removing an element from the sequential order is a browser
 * behaviour, not a DOM property. The sibling suite says "jsdom does not run Tab" and works around
 * it. This one does not have to.
 *
 * WHAT IT MEASURES, IN BOTH DIRECTIONS. The board as shipped, against the board as changed, with
 * the count of Tab presses it takes to cross it. A claim that a fix removed sixty-three tab stops
 * is worth exactly as much as the two numbers behind it.
 *
 * WHAT IT DELIBERATELY DOES NOT MEASURE. The arrow keys. Driving them needs React alive in the
 * page, which needs a bundle step, and unlike focus traversal and layout, keyboard event dispatch
 * to a handler is something jsdom implements faithfully. That half stays in
 * `tests/client/a-board-nobody-could-hear.test.tsx`, where it is measured rather than inferred.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { Chess } from "chess.js";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "@playwright/test";

import { launchChromium } from "./browser";
import { ChessBoard } from "@/components/ChessBoard";

let browser: Browser;

beforeAll(async () => {
  browser = await launchChromium();
}, 60_000);

afterAll(async () => {
  await browser?.close();
});

const board = new Chess().board();

/**
 * Press Tab until focus leaves the board, and report how many presses that took.
 *
 * The sentinels either side are what makes the count meaningful: focus starts on the one before
 * the board and the walk ends when it reaches the one after, so the number returned is exactly
 * the number of stops the board itself contributes.
 */
async function tabPressesToCross(markup: string): Promise<number> {
  const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
  await page.setContent(
    `<!doctype html><html lang="he"><body>
       <button id="before">before</button>
       <div id="board">${markup}</div>
       <button id="after">after</button>
     </body></html>`,
  );
  await page.locator("#before").focus();
  let presses = 0;
  // A board cannot contribute more stops than it has squares; the cap turns a runaway into a
  // failed assertion rather than a hung test.
  while (presses <= 70) {
    await page.keyboard.press("Tab");
    presses += 1;
    if (await page.evaluate(() => document.activeElement?.id === "after")) break;
  }
  await page.close();
  return presses;
}

/** The board exactly as it shipped: no tabIndex, so every square is a natural tab stop. */
function asShipped(markup: string): string {
  return markup.replace(/tabindex="(0|-1)"/g, "");
}

describe("crossing the board with the Tab key", () => {
  const markup = renderToStaticMarkup(
    <ChessBoard
      board={board}
      orientation="w"
      legalTargets={[]}
      onSelect={() => undefined}
      onMove={() => undefined}
    />,
  );

  it("cost sixty-four presses before, because a button is a tab stop with or without tabIndex", async () => {
    /*
     * This is the finding restated as a measurement. The squares were always REACHABLE -- the
     * external review said a keyboard user could not select a square, and that was wrong. What
     * was true is the number below: a player who wanted h1 pressed Tab sixty-four times, on a
     * container announcing `role="grid"` and therefore promising arrow keys instead.
     */
    expect(await tabPressesToCross(asShipped(markup))).toBe(65); // 64 squares, then #after
  }, 60_000);

  it("costs one now", async () => {
    expect(await tabPressesToCross(markup)).toBe(2); // the single roving square, then #after
  }, 60_000);

  it("puts that one stop on a square, not on the grid container", async () => {
    const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
    await page.setContent(
      `<!doctype html><html lang="he"><body><button id="before">b</button>
       <div id="board">${markup}</div></body></html>`,
    );
    await page.locator("#before").focus();
    await page.keyboard.press("Tab");
    const landed = await page.evaluate(() => ({
      role: document.activeElement?.getAttribute("role"),
      square: document.activeElement?.getAttribute("data-square"),
    }));
    await page.close();
    expect(landed).toEqual({ role: "gridcell", square: "a8" });
  }, 60_000);
});

/**
 * The live region is hidden from the EYE and not from the accessibility tree, and those are
 * different hidings that look identical in a test.
 *
 * THE SILENT FAILURE THIS EXISTS TO CATCH. Every announcement assertion in the sibling suite
 * reads `textContent`, which is present whatever the CSS does. If `.sr-only` were ever
 * "simplified" to `display: none` or `visibility: hidden`, the board would go mute for every
 * screen reader on earth and all six of those tests would still be green -- because a node
 * removed from the accessibility tree still has text in it.
 *
 * It has to be measured in a browser: this is a COMPUTED style, produced by a stylesheet, and the
 * whole point is which of several visually-identical hidings the class actually uses.
 */
describe("what the board says out loud is hidden from the eye only", () => {
  it("keeps the announcer in the accessibility tree while giving it no visual footprint", async () => {
    const css = readFileSync(resolve(__dirname, "../../client/src/index.css"), "utf8");
    const markup = renderToStaticMarkup(
      <ChessBoard
        board={board}
        orientation="w"
        legalTargets={[]}
        onSelect={() => undefined}
        onMove={() => undefined}
      />,
    );
    const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
    await page.setContent(
      `<!doctype html><html lang="he"><head><style>${css}</style></head>
       <body>${markup}<p class="board-announcer-probe sr-only">על הלוח: e2 אל e4.</p></body></html>`,
    );
    const seen = await page.locator(".board-announcer-probe").evaluate((node) => {
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      return {
        display: style.display,
        visibility: style.visibility,
        width: box.width,
        height: box.height,
      };
    });
    await page.close();

    // Present to a reader: neither of the two hidings that remove a node from the tree.
    expect(seen.display).not.toBe("none");
    expect(seen.visibility).not.toBe("hidden");
    // Absent to the eye: the clip-path pattern leaves a 1px box, not a line of text.
    expect(seen.width).toBeLessThanOrEqual(2);
    expect(seen.height).toBeLessThanOrEqual(2);
  }, 60_000);

  it("puts the region on the board itself, polite, with the sr-only class", async () => {
    const markup = renderToStaticMarkup(
      <ChessBoard
        board={board}
        orientation="w"
        legalTargets={[]}
        onSelect={() => undefined}
        onMove={() => undefined}
      />,
    );
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain("sr-only board-announcer");
  });
});
