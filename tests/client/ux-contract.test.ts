/**
 * The UX regressions that were shipped, expressed as assertions.
 *
 * Every one of these was live in a build that passed `npm run verify`, because nothing in the
 * suite had ever read the stylesheet or the document head. They were found by driving a real
 * browser and measuring; this file holds the subset that can be checked without one, so the
 * cheap check runs on every commit and the expensive one stays a deliberate act.
 *
 * What this file CANNOT see, and what therefore still needs a browser: computed layout, contrast
 * against actually-painted backgrounds, and whether a scroll container scrolls. Those numbers are
 * in docs/FINDINGS.md with the measurements that produced them.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const css = readFileSync(resolve(root, "client/src/index.css"), "utf8");
const html = readFileSync(resolve(root, "client/index.html"), "utf8");
const timeline = readFileSync(resolve(root, "client/src/components/MoveTimeline.tsx"), "utf8");
/* Comments stripped: this file explains in prose why scrollIntoView is wrong here, and a raw
   grep matches that explanation as though it were the call. */
const timelineCode = timeline.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");

/** The declarations inside one selector's first block, comments stripped. */
function block(selector: string): string {
  const start = bare.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no ${selector} block in index.css`);
  return bare.slice(start, bare.indexOf("\n}", start));
}
function tokens(selector: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const [, k, v] of block(selector).matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) found.set(k, v.trim());
  return found;
}
const luminance = (rgb: number[]) => {
  const s = rgb.map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
};
const hex = (h: string) => {
  const m = h.trim().match(/^#([0-9a-f]{6})$/i);
  if (!m) throw new Error(`not a 6-digit hex colour: ${h}`);
  return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
};

describe("the board is sized by its container, not by its glyphs", () => {
  it("gives .board-stage an explicit width", () => {
    // .board-stage is a grid item with `margin-inline: auto`, and an auto inline margin cancels
    // the default `stretch`. Without a width it shrink-to-fits its content -- which for a chess
    // board means the piece FONT decides the board size. Measured 263px of an available 342px on
    // a 390px phone, and 504px of 826px on a desktop that allowed 632px.
    expect(block(".board-stage")).toMatch(/^\s*width:\s*100%;/m);
  });

  it("keeps the height bound that stops the board running off the bottom", () => {
    expect(block(".board-stage")).toMatch(/max-width:\s*min\(100%,\s*calc\(100vh - \d+px\)\)/);
  });
});

describe("colour tokens that flip together", () => {
  const light = tokens(":root");
  const dark = tokens(".dark");

  it("defines a foreground for anything painted on --blue, in both palettes", () => {
    // White over the dark theme's pale --blue measured 2.36:1 where 16px text needs 4.5:1.
    expect(light.get("--on-blue")).toBeTruthy();
    expect(dark.get("--on-blue")).toBeTruthy();
    expect(light.get("--on-blue")).not.toBe(dark.get("--on-blue"));
  });

  it("paints every blue-backed control with --on-blue rather than a literal white", () => {
    for (const sel of [".primary-control", ".rail-button.prominent", ".move-cell.active"]) {
      const b = block(sel);
      expect(b, `${sel} still hard-codes a foreground`).toMatch(/color:\s*var\(--on-blue\)/);
      expect(b, `${sel} still hard-codes white`).not.toMatch(/color:\s*white/);
    }
  });

  it("casts shadows with a colour that is dark in BOTH themes", () => {
    // --ink-rgb is near-white in the dark palette, so a shadow drawn from it rendered 87x
    // brighter than the page: a pale slab offset down and right from the board.
    const darkPaper = luminance(hex(dark.get("--paper")!));
    const darkShadow = luminance(dark.get("--shadow-rgb")!.split(",").map((n) => Number(n.trim())));
    expect(darkShadow).toBeLessThan(darkPaper);
    expect(block(".board-grid")).toMatch(/box-shadow:[^;]*var\(--shadow-rgb\)/);
    expect(block(".board-grid")).not.toMatch(/box-shadow:[^;]*var\(--ink-rgb\)/);
  });

  it("colours board coordinates by the square they sit on", () => {
    // Inheriting the page ink put a light label on a light square (1.70:1) in the dark theme.
    expect(light.get("--coord-on-light")).toBeTruthy();
    expect(light.get("--coord-on-dark")).toBeTruthy();
    expect(bare).toMatch(/\.light-square \.rank-label[\s\S]{0,80}var\(--coord-on-light\)/);
    expect(bare).toMatch(/\.dark-square \.rank-label[\s\S]{0,80}var\(--coord-on-dark\)/);
  });
});

describe("the mobile tool rail", () => {
  it("has one column per tool, so none is orphaned onto its own row", () => {
    const railButtons = (readFileSync(resolve(root, "client/src/pages/Home.tsx"), "utf8")
      .match(/className="rail-button[^"]*"/g) || []).length;
    const mobile = bare.slice(bare.indexOf("@media (max-width: 680px)"));
    const cols = mobile.match(/\.control-rail \{[\s\S]*?grid-template-columns:\s*repeat\((\d+),/);
    expect(cols, "no column count found for the mobile rail").toBeTruthy();
    expect(Number(cols![1])).toBe(railButtons);
  });
});

describe("readings keep their subject", () => {
  it("wraps the bucket scope instead of truncating it", () => {
    // nowrap + ellipsis cut every long bucket label at BOTH 390px and 1440px. The scope says what
    // the number is about; a reading whose subject is elided is not a reading.
    const b = block(".bucket-scope");
    expect(b).not.toMatch(/white-space:\s*nowrap/);
    expect(b).not.toMatch(/text-overflow:\s*ellipsis/);
  });
});

describe("the document head", () => {
  it("does not block pinch-zoom", () => {
    // maximum-scale=1 shipped, which is WCAG 1.4.4 -- and this is an app whose central object is
    // a board that is 342px wide on a phone.
    expect(html).not.toMatch(/maximum-scale/);
    expect(html).not.toMatch(/user-scalable\s*=\s*no/);
  });

  it("is titled for the product that exists", () => {
    expect(html).not.toMatch(/Chess Studio/);
    expect(html).toMatch(/<title>[^<]+<\/title>/);
  });
});

describe("icon-only controls have names", () => {
  it("labels the four navigation buttons in the move timeline", () => {
    // Only the icon-only ones: a move cell carries its SAN as its accessible name already.
    const ICONS = ["SkipBack", "ChevronLeft", "ChevronRight", "SkipForward"];
    const unlabelled: string[] = [];
    for (const icon of ICONS) {
      // The <button ...> that immediately wraps this icon.
      const at = timeline.indexOf(`<${icon} `);
      expect(at, `${icon} is not rendered any more`).toBeGreaterThan(-1);
      const openTag = timeline.lastIndexOf("<button", at);
      const tag = timeline.slice(openTag, timeline.indexOf(">", openTag) + 1);
      if (!/aria-label=/.test(tag)) unlabelled.push(icon);
    }
    expect(unlabelled, `icon-only buttons with no accessible name: ${unlabelled.join(", ")}`).toEqual([]);
  });
});

describe("keeping the active move in view does not move the page", () => {
  it("adjusts the rail's own scrollLeft", () => {
    expect(timelineCode).toMatch(/\.scrollLeft\s*\+?=/);
  });

  it("does not use scrollIntoView", () => {
    // scrollIntoView walks up EVERY scrollable ancestor, so bringing the active move into view
    // scrolled the document: measured 122px down on a desktop and 646px on a phone at load, which
    // opened the app below its own header with most of the board above the fold. This regression
    // was introduced while fixing the rail and caught by measuring, not by reading.
    expect(timelineCode).not.toMatch(/scrollIntoView/);
  });
});

describe("keyboard focus is visible", () => {
  it("declares a focus-visible ring", () => {
    // The browser default on this palette was a 1px auto outline, and every control in the
    // decision loop is reachable by keyboard.
    expect(bare).toMatch(/:focus-visible\s*\{[^}]*outline:\s*\d+px solid/);
  });
});
