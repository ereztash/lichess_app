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
import { CONFIDENCE_LEVELS, normaliseConfidence } from "@shared/confidence";
import { MIN_BUCKET_N, type ScoredDecision } from "@shared/detector";
import { readRecord } from "@shared/record-dashboard";
import { RecordDashboard } from "@/components/RecordDashboard";
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


/**
 * EVERY signed figure on the dashboard, not one class of them.
 *
 * The first version of this file tested `SignedProportion` alone, and the fix it drove --
 * `unicode-bidi: plaintext` on `.value-triple .value-number` -- was applied to exactly the element
 * the test rendered. An adversarial review then found two more signed figures on the same screen,
 * rendered through different markup, both still reordered:
 *
 *   `.split-row dd`    the effort coefficient, `-0.99` shown as `0.99-`
 *   `.bucket-versus`   the population comparison, the sign 62px from its digits
 *
 * The effort one is the worse of the two. NEGATIVE IS THE HEALTHY DIRECTION for that figure -- it
 * means the player spent longer where they were less sure -- so the broken case is the ordinary
 * one, not an edge.
 *
 * So this sweeps the rendered component and checks every text node that starts with a sign,
 * whatever element it is in. A fix applied to one selector cannot satisfy it.
 */
const NON_ANCHOR = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/**
 * A record that puts a sign on every figure at once: enough of both outcomes for discrimination,
 * both phases populated for a bucket comparison, and time anti-correlated with confidence so the
 * effort coefficient is strongly negative rather than near zero.
 */
const signedEverywhere = (): ScoredDecision[] =>
  Array.from({ length: 4 * MIN_BUCKET_N }, (_, i) => ({
    decision_id: `d-${i}`,
    fen: NON_ANCHOR,
    confidence: normaliseConfidence((i % 7) + 1, CONFIDENCE_LEVELS),
    accurate: i % 3 !== 0,
    phase: i % 2 === 0 ? ("middlegame" as const) : ("opening" as const),
    // Longer on the decisions stated with LESS confidence: the healthy pattern, negative rho.
    secondsTaken: 120 - (i % 7) * 15,
    clockMsRemaining: 120_000,
  }));

describe("every signed figure on the dashboard, whatever markup it uses", () => {
  it("keeps the sign left of its digits, in all of them", async () => {
    const reading = readRecord(signedEverywhere());
    const css = readFileSync(resolve(root, "client/src/index.css"), "utf8");
    const html = renderToStaticMarkup(<RecordDashboard reading={reading} />);
    const page = await browser.newPage({ viewport: { width: 390, height: 1600 } });
    await page.setContent(
      `<!doctype html><html dir="rtl" lang="he"><head><style>${css}</style></head><body>${html}</body></html>`,
    );

    const wrong = await page.evaluate(() => {
      const bad: { text: string; where: string }[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node as Text;
        // A signed figure: a sign, then a digit. `−` is U+2212, which `.bucket-versus` uses.
        if (!/^[-+\u2212]\d/.test(text.data.trim())) continue;
        const offset = text.data.indexOf(text.data.trim()[0]);
        const range = document.createRange();
        range.setStart(text, offset);
        range.setEnd(text, offset + 1);
        const sign = range.getBoundingClientRect();
        range.setStart(text, offset + 1);
        range.setEnd(text, offset + 2);
        const digit = range.getBoundingClientRect();
        if (sign.left >= digit.left) {
          bad.push({
            text: text.data.trim().slice(0, 30),
            where: (text.parentElement?.className || text.parentElement?.tagName) ?? "?",
          });
        }
      }
      return bad;
    });
    await page.close();

    expect(wrong, "these render their sign on the far side of the number").toEqual([]);
  }, 60_000);

  it("finds signed figures at all, so an empty sweep cannot pass", async () => {
    /*
     * The control the sweep needs. A selector that matched nothing -- a renamed class, a reading
     * with no measurable bucket -- would report zero wrong figures and read as a clean bill.
     */
    const reading = readRecord(signedEverywhere());
    const css = readFileSync(resolve(root, "client/src/index.css"), "utf8");
    const html = renderToStaticMarkup(<RecordDashboard reading={reading} />);
    const page = await browser.newPage({ viewport: { width: 390, height: 1600 } });
    await page.setContent(
      `<!doctype html><html dir="rtl" lang="he"><head><style>${css}</style></head><body>${html}</body></html>`,
    );
    const found = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const out: string[] = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const trimmed = (node as Text).data.trim();
        if (/^[-+\u2212]\d/.test(trimmed)) out.push(trimmed.slice(0, 20));
      }
      return out;
    });
    await page.close();
    expect(found.length, "the sweep found no signed figures to check").toBeGreaterThanOrEqual(2);
  }, 60_000);
});
