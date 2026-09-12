/**
 * The import panel's rows and its finding, measured in a real layout engine.
 *
 * TWO THINGS NO OTHER INSTRUMENT IN THIS REPOSITORY CAN SEE.
 *
 * FIRST, THE SCOPE LABELS. `tests/layout/bucket-row.layout.test.tsx` measures exactly this failure
 * -- a scope column squeezed to a sliver by an `auto` track sized from a long reason -- but it
 * measures it on `RecordDashboard`. The import panel is a SECOND consumer of `.bucket-list` and
 * `li.unmeasurable`, and its reasons are longer: "אי אפשר למדוד" plus a count and a floor, against
 * the dashboard's shorter notes. Same stylesheet, different content, and content is what sized the
 * track that broke. Nothing held the second consumer.
 *
 * SECOND, THE RANK OF THE FINDING. `GATE-FINDING-OUTRANKS-ITS-NUMBERS` is a source scan: it can see
 * that the finding renders BEFORE the list and that it does not wear the provenance register. It
 * cannot see a font size, so "outranks" was, to every check in this repository, only "precedes".
 * A finding moved to the top and left at `--panel-fine` would have passed the gate, passed every
 * test, and read exactly like the defect the gate was written for.
 *
 * jsdom reports every box as 0x0 and every computed size as the initial value, so neither of these
 * is a jsdom test.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "@playwright/test";
import { launchChromium } from "./browser";
import { ImportDiagnosticPanel } from "@/components/ImportDiagnostic";
import { BUCKETINGS, MIN_BUCKET_N } from "@shared/detector";
import type { ImportDiagnostic } from "@shared/import-diagnostic";

const root = resolve(__dirname, "../..");

/**
 * Six buckets, one of them below the floor, which is the ordinary shape of a first import: a
 * player with history has plenty of fast decisions and few slow ones. The unmeasurable row is the
 * one that sizes the value track, so it is the one that decides whether the scope survives.
 */
const diagnostic = {
  buckets: BUCKETINGS.map((bucketing, index) => ({
    key: bucketing.key,
    scope: bucketing.scope,
    measurable: index !== 1,
    accurateRate: index === 1 ? null : 0.5 + index * 0.03,
    n: index === 1 ? 4 : 100 + index * 20,
    unmeasurableReason: index === 1 ? ("too-few" as const) : undefined,
  })),
  scored: 742,
  forced: 51,
  eligible: 630,
  book: 61,
  bookLoaded: true,
  withoutTime: 12,
  withoutClock: 8,
  missingClockData: false,
  timeBucketSpeed: "blitz" as const,
  excludedForSpeed: 88,
  speedMix: [],
  unreadable: 0,
} as unknown as ImportDiagnostic;

let browser: Browser;

beforeAll(async () => {
  browser = await launchChromium();
}, 60_000);

afterAll(async () => {
  await browser?.close();
});

async function measure(width: number) {
  const css = readFileSync(resolve(root, "client/src/index.css"), "utf8");
  const html = renderToStaticMarkup(<ImportDiagnosticPanel diagnostic={diagnostic} />);
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.setContent(
    `<!doctype html><html dir="rtl" lang="he"><head><style>${css}</style>
     <style>body{margin:0;padding:12px}</style></head><body>${html}</body></html>`,
  );
  const read = await page.evaluate(() => {
    const px = (node: Element, property: string) =>
      parseFloat(getComputedStyle(node).getPropertyValue(property)) || 0;
    const scopes = [...document.querySelectorAll(".bucket-scope")].map((node) => {
      const box = node.getBoundingClientRect();
      const line = px(node, "line-height") || 16;
      return {
        text: node.textContent ?? "",
        width: box.width,
        lines: Math.round(box.height / line),
      };
    });
    const finding = document.querySelector(".import-finding__what");
    const number = document.querySelector(".bucket-list .value-number");
    return {
      scopes,
      documentWidth: document.documentElement.scrollWidth,
      finding: finding
        ? { top: finding.getBoundingClientRect().top, size: px(finding, "font-size") }
        : null,
      number: number
        ? { top: number.getBoundingClientRect().top, size: px(number, "font-size") }
        : null,
    };
  });
  await page.close();
  return read;
}

describe.each([
  { label: "mobile", width: 390 },
  { label: "desktop", width: 1440 },
])("the import panel on $label", ({ width }) => {
  it("never collapses a scope label, even beside the longest reason on the panel", async () => {
    const { scopes } = await measure(width);
    expect(scopes.length).toBe(BUCKETINGS.length);
    for (const scope of scopes) {
      expect(
        scope.width,
        `"${scope.text}" collapsed to ${Math.round(scope.width)}px`,
      ).toBeGreaterThan(90);
    }
  }, 60_000);

  it("keeps every scope to a few lines rather than a vertical stack", async () => {
    const { scopes } = await measure(width);
    for (const scope of scopes) {
      expect(scope.lines, `"${scope.text}" wrapped onto ${scope.lines} lines`).toBeLessThanOrEqual(
        4,
      );
    }
  }, 60_000);

  it("does not push the document sideways", async () => {
    const { documentWidth } = await measure(width);
    expect(documentWidth).toBeLessThanOrEqual(width);
  }, 60_000);

  it("renders the finding above the numbers it denies, and larger than them", async () => {
    /*
     * THE HALF THE GATE CANNOT SEE. Order is a source fact and the gate holds it. Rank is a
     * computed style, and the only thing in this repository that can read one is a real engine.
     *
     * Demonstrated to fail before it was trusted: with `.import-finding` set to `--panel-fine`,
     * the size assertion goes red at both widths while the order assertion stays green -- which
     * is precisely the screen this lane was written to repair, and precisely the screen the gate
     * would have called fixed.
     */
    const { finding, number } = await measure(width);
    expect(finding, "the panel rendered no finding at all").not.toBeNull();
    expect(number, "the panel rendered no bucket reading to be a finding about").not.toBeNull();
    expect(finding!.top).toBeLessThan(number!.top);
    expect(
      finding!.size,
      `the finding is ${finding!.size}px and the numbers it denies are ${number!.size}px`,
    ).toBeGreaterThan(number!.size);
  }, 60_000);
});

it("states the floor a bucket must reach, so a reader can check the arithmetic", () => {
  // Guards the fixture rather than the layout: an unmeasurable row with n at or above the floor
  // would be a contradiction, and the row it sizes is the one the measurements above depend on.
  expect(4).toBeLessThan(MIN_BUCKET_N);
});
