/**
 * A signed number must read as signed, in a right-to-left page.
 *
 * THE DEFECT, seen in a screenshot before any test could see it: a gap of −30% rendered as
 * `30%-`, and a population comparison of −20 rendered as `20–`. The sign had been moved to the
 * far side of the digits by the bidirectional algorithm -- `-` is a neutral character, and in an
 * RTL paragraph a neutral between Hebrew text and a number resolves to the paragraph's own
 * direction, which puts it after the digits visually.
 *
 * WHY THIS IS NOT COSMETIC. The calibration gap is the product's central figure and its SIGN is
 * its meaning: negative is overconfidence, positive is underconfidence. A reader skimming `30%-`
 * has no reliable way to tell which they are looking at, and the most likely misreading is the
 * flattering one.
 *
 * ASSERTED ON VISUAL ORDER, not on a CSS property. `unicode-bidi`, `direction`, `<bdi>` and a
 * U+2066 isolate would all satisfy a rule-based check while any one of them could still be
 * applied to the wrong element. What matters is where the glyphs land, so that is what is
 * measured: the sign's box must sit to the LEFT of the digits' box.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "@playwright/test";
import { launchChromium } from "./browser";
import { SignedProportion } from "@/components/Value";

const root = resolve(__dirname, "../..");

let browser: Browser;
beforeAll(async () => {
  browser = await launchChromium();
}, 60_000);
afterAll(async () => {
  await browser?.close();
});

/**
 * Where the first glyph sits relative to the rest, inside a Hebrew RTL paragraph.
 *
 * The surrounding Hebrew is load-bearing: a number alone in an otherwise empty RTL box can lay
 * out correctly and still flip once there is Hebrew text beside it, which is the situation on
 * every screen this component appears on.
 */
async function glyphOrder(markup: string, selector: string) {
  const css = readFileSync(resolve(root, "client/src/index.css"), "utf8");
  const page = await browser.newPage({ viewport: { width: 390, height: 700 } });
  await page.setContent(
    `<!doctype html><html dir="rtl" lang="he"><head><style>${css}</style></head>
     <body><p>החלטות באמצע המשחק ${markup} מתוך הרשומה</p></body></html>`,
  );
  const result = await page.locator(selector).evaluate((node) => {
    node.normalize();
    const text = node.textContent ?? "";
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const first = walker.nextNode() as Text | null;
    if (!first || first.length < 2) return { text, ok: null as boolean | null };
    const range = document.createRange();
    range.setStart(first, 0);
    range.setEnd(first, 1);
    const sign = range.getBoundingClientRect();
    range.setStart(first, 1);
    range.setEnd(first, first.length);
    const rest = range.getBoundingClientRect();
    return { text, signLeft: sign.left, restLeft: rest.left, ok: sign.left < rest.left };
  });
  await page.close();
  return result;
}

describe("a signed figure keeps its sign on the reading side", () => {
  it("puts the minus to the LEFT of the digits, not after them", async () => {
    const markup = renderToStaticMarkup(<SignedProportion value={-0.3} n={40} />);
    const order = await glyphOrder(markup, ".value-number");
    expect(order.text, "the figure lost its sign entirely").toContain("-");
    expect(
      order.ok,
      `"${order.text}" rendered with the sign at x=${order.signLeft} and the digits at x=${order.restLeft}`,
    ).toBe(true);
  }, 60_000);

  it("puts the plus to the LEFT of the digits too", async () => {
    // Both directions, because a fix that isolates only one is a fix that reverses the confusion
    // rather than removing it.
    const markup = renderToStaticMarkup(<SignedProportion value={0.3} n={40} />);
    const order = await glyphOrder(markup, ".value-number");
    expect(order.text).toContain("+");
    expect(order.ok, `"${order.text}" put the plus on the wrong side`).toBe(true);
  }, 60_000);

  it("leaves an unmeasured figure alone", async () => {
    // The em dash is not a signed number and must not be dragged into an LTR run: it is the
    // product's "nothing was measured" mark and it sits inside Hebrew.
    const markup = renderToStaticMarkup(<SignedProportion value={0} n={0} />);
    const order = await glyphOrder(markup, ".value-number");
    expect(order.text).toBe("—");
  }, 60_000);
});
