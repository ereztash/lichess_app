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
