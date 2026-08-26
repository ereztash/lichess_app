/**
 * The bucket rows, measured in a real layout engine.
 *
 * WHY THIS FILE EXISTS AND WHY IT IS NOT A jsdom TEST. jsdom has no layout: every box it reports
 * is 0x0, so a component can be structurally perfect and render as a column one character wide
 * and jsdom will agree it is fine. That is exactly what happened -- the no-clock bucket's scope
 * label collapsed to a single glyph per line, twenty lines tall, and 1,012 passing tests said
 * nothing because not one of them could see a width.
 *
 * THE CAUSE, for whoever reads this next: `.bucket-list li.unmeasurable` set
 * `grid-template-columns: minmax(0, 1fr) auto`. An `auto` track is sized from its content, and
 * the no-clock reason is a two-line sentence, so it claimed the row; `minmax(0, 1fr)` permits
 * its track to shrink to zero, so the scope did. The label naming what a figure is ABOUT is the
 * one thing on this panel that must never be squeezed out -- the panel exists to say what a
 * number can and cannot be read to mean.
 *
 * The markup here is the component's own, server-rendered, and the stylesheet is the shipped
 * one. A hand-copied fragment would drift from the component and start passing for the wrong
 * reason.
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

const root = resolve(__dirname, "../..");
const NON_ANCHOR_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/**
 * A record with NO clock on any decision, which is the common path rather than an edge case: a
 * local game against Stockfish has no clock at all, and a Lichess export carries none unless the
 * player ticked the option. It is the record that produced the collapsed column.
 */
const run = (count: number, accurate: boolean, seed: number): ScoredDecision[] =>
  Array.from({ length: count }, (_, i) => ({
    decision_id: `d-${seed + i}`,
    fen: NON_ANCHOR_FEN,
    confidence: normaliseConfidence(i % 2 === 0 ? 6 : 2, CONFIDENCE_LEVELS),
    accurate,
    phase: i % 2 === 0 ? ("middlegame" as const) : ("opening" as const),
    secondsTaken: 30,
    clockMsRemaining: null,
  }));

const reading = readRecord([
  ...run(MIN_BUCKET_N + 10, true, 0),
  ...run(MIN_BUCKET_N + 10, false, 500),
]);

let browser: Browser;

beforeAll(async () => {
  browser = await launchChromium();
}, 60_000);

afterAll(async () => {
  await browser?.close();
});

async function measure(width: number) {
  const css = readFileSync(resolve(root, "client/src/index.css"), "utf8");
  const html = renderToStaticMarkup(<RecordDashboard reading={reading} />);
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.setContent(
    `<!doctype html><html dir="rtl" lang="he"><head><style>${css}</style>
     <style>body{margin:0;padding:12px}</style></head><body>${html}</body></html>`,
  );
  const scopes = await page.locator(".bucket-scope").evaluateAll((nodes) =>
    nodes.map((node) => {
      const box = node.getBoundingClientRect();
      const line = parseFloat(getComputedStyle(node).lineHeight) || 16;
      return { text: node.textContent ?? "", width: box.width, height: box.height, line };
    }),
  );
  const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  await page.close();
  return { scopes, documentWidth };
}

describe.each([
  { label: "mobile", width: 390 },
  { label: "desktop", width: 1440 },
])("the bucket label survives its own row on $label", ({ width }) => {
  it("never collapses the scope to a sliver", async () => {
    /*
     * The direct assertion. A one-glyph column is roughly 14px wide; the shortest scope in the
     * set is "החלטות בסיום" and needs far more than that to be a label rather than a stack.
     */
    const { scopes } = await measure(width);
    expect(scopes.length).toBe(6);
    for (const scope of scopes) {
      expect(scope.width, `"${scope.text}" collapsed to ${Math.round(scope.width)}px`).toBeGreaterThan(90);
    }
  }, 60_000);

  it("keeps every label to a few lines rather than a vertical stack", async () => {
    /*
     * The assertion that actually caught the shape of the bug. Width alone can be satisfied by a
     * column that is narrow-but-not-tiny; what a reader SEES is the height. The collapsed row ran
     * past twenty lines. Four is generous for the longest label in the set at 390px.
     */
    const { scopes } = await measure(width);
    for (const scope of scopes) {
      const lines = Math.round(scope.height / scope.line);
      expect(lines, `"${scope.text}" wrapped onto ${lines} lines`).toBeLessThanOrEqual(4);
    }
  }, 60_000);

  it("does not push the document sideways", async () => {
    // The panel's own history: `white-space: nowrap` on the reason once laid out 628px of text
    // inside a 340px column and scrolled the page. Fixing a collapse by overflowing is not a fix.
    const { documentWidth } = await measure(width);
    expect(documentWidth).toBeLessThanOrEqual(width);
  }, 60_000);
});
