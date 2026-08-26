/**
 * The probe panel, measured in a real layout engine.
 *
 * WHY NOT jsdom. jsdom has no layout: every box it reports is 0x0, so a panel can be structurally
 * perfect and still lay a sentence 456px wide inside a 292px box. That happened on this codebase
 * once already, on a different panel, and it pushed the document to 525px at a 390px viewport --
 * which on a phone is a page that scrolls sideways.
 *
 * WHY IT MATTERS MORE HERE THAN ON MOST PANELS. This one interrupts. It appears mid-loop, after
 * the player has committed and before they see anything, and every second it costs is a second
 * charged against a question the player did not ask for. A panel that needs a horizontal scroll
 * to read is a panel that gets answered at random, and a probed arm answered at random is worse
 * than no probed arm.
 *
 * The markup is the component's own and the stylesheet is the shipped one -- a hand-copied
 * fragment would drift and start passing for the wrong reason.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "@playwright/test";
import { launchChromium } from "./browser";
import { CounterfactualProbe } from "@/components/CounterfactualProbe";

const root = resolve(__dirname, "../..");

let browser: Browser;

beforeAll(async () => {
  browser = await launchChromium();
}, 60_000);

afterAll(async () => {
  await browser?.close();
});

/**
 * THE CONTAINER IS 330px BECAUSE THE APP'S IS.
 *
 * `.decision-grid` lays out `132px minmax(480px, 1fr) 330px`, and the probe renders in the third
 * track -- the analysis column -- alongside the commitment screen. Measuring the panel at the
 * full viewport width is measuring a box the product never gives it, and the first version of
 * this file did exactly that: three mutations that broke the CSS outright (nowrap on the
 * question, no wrap on the actions row, buttons free to collapse) ALL PASSED, because at 390px
 * of unconstrained width nothing had to wrap in the first place.
 *
 * Inside 330px the panel's own 1.15rem padding leaves about 293px of content -- which is within
 * a pixel of the 292px box the earlier `nowrap` regression on a neighbouring panel overflowed.
 */
const ANALYSIS_COLUMN = 330;

async function measure(container: number, alternative: string | null) {
  const css = readFileSync(resolve(root, "client/src/index.css"), "utf8");
  const html = renderToStaticMarkup(
    <CounterfactualProbe
      chosenMove="e2e4"
      alternative={alternative}
      pending={false}
      onAnswer={() => {}}
    />,
  );
  const page = await browser.newPage({ viewport: { width: container + 24, height: 900 } });
  await page.setContent(
    `<!doctype html><html dir="rtl" lang="he"><head><style>${css}</style>
     <style>body{margin:0;padding:12px}
       #column{width:${container}px;min-width:0;overflow:hidden}</style></head>
     <body><div id="column">${html}</div></body></html>`,
  );
  /*
   * `scrollWidth` on the COLUMN, not the document. The column clips (`overflow:hidden`), exactly
   * as a grid track does, so a document measurement would report a page that fits while the
   * panel inside it is cut off -- which is what the reader actually sees.
   */
  const columnScroll = await page.locator("#column").evaluate((node) => node.scrollWidth);
  const panel = await page.locator(".counterfactual-probe").evaluate((node) => node.scrollWidth);
  const question = await page.locator(".counterfactual-probe__question").evaluate((node) => {
    const box = node.getBoundingClientRect();
    return {
      width: box.width,
      scroll: node.scrollWidth,
      height: box.height,
      line: parseFloat(getComputedStyle(node).lineHeight) || 16,
    };
  });
  const buttons = await page.locator(".counterfactual-probe__actions button").evaluateAll((nodes) =>
    nodes.map((node) => {
      const box = node.getBoundingClientRect();
      return { text: node.textContent ?? "", width: box.width, height: box.height };
    }),
  );
  await page.close();
  return { columnScroll, panel, container, question, buttons };
}

describe.each([
  { label: "the analysis column", width: ANALYSIS_COLUMN },
  { label: "a phone in one column", width: 366 },
])("the panel fits $label", ({ width }) => {
  it("does not lay out wider than the column it is given", async () => {
    // The regression this file is modelled on: a sentence that inherited `nowrap`.
    const { columnScroll, panel, container } = await measure(width, "g1f3");
    expect(panel, `panel laid out at ${panel}px inside ${container}px`).toBeLessThanOrEqual(
      container,
    );
    expect(columnScroll).toBeLessThanOrEqual(container);
  }, 60_000);

  it("wraps the question instead of running it off the edge", async () => {
    const { question, container } = await measure(width, null);
    expect(
      question.scroll,
      `the question needs ${question.scroll}px inside ${container}px`,
    ).toBeLessThanOrEqual(Math.ceil(question.width));
    // Two or three lines is expected at this width; twenty would mean a one-word column.
    expect(Math.round(question.height / question.line)).toBeLessThanOrEqual(4);
  }, 60_000);

  it("keeps both answers as real tap targets", async () => {
    /*
     * HEIGHT ONLY, AND THE MISSING ASSERTION IS DELIBERATE.
     *
     * The obvious companion claim -- that neither button is squeezed to a sliver by the other --
     * was written, and then measured, and it is not a live property at this width. Inside the
     * 330px column, with the longest label the panel can produce (a promotion, `e7e8q`):
     *
     *   flex-wrap: wrap     each button 291px, content 289px
     *   flex-wrap: nowrap   each button 141px, content 139px
     *
     * Both fit their content with room to spare, so `flex-wrap: nowrap` and zero horizontal
     * padding both PASSED a width assertion written to catch them. An assertion no mutation can
     * turn red is not evidence, and leaving it in would say this panel is protected against a
     * squeeze it is simply not currently exposed to. Height is a different matter: it is the tap
     * target, and removing the padding does collapse it.
     */
    const { buttons } = await measure(width, "g1f3");
    expect(buttons.length).toBe(2);
    for (const button of buttons) {
      expect(
        button.height,
        `"${button.text}" laid out ${Math.round(button.height)}px tall`,
      ).toBeGreaterThanOrEqual(36);
    }
  }, 60_000);

});
