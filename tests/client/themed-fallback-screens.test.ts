/**
 * The two screens a visitor reaches when something is wrong.
 *
 * Both shipped outside the design system. `NotFound.tsx` rendered "Page Not Found" / "Go Home"
 * on `bg-gradient-to-br from-slate-50 to-slate-100`, and `vercel.json` rewrites every unmatched
 * path to index.html -- so any mistyped URL landed on a light English page inside a Hebrew RTL
 * themed app. `ErrorBoundary.tsx` rendered "An unexpected error occurred." with the raw stack
 * trace as the second element on the page.
 *
 * Neither was reachable by any existing test, because nothing read these files. This holds three
 * properties that the fix depends on: the copy is Hebrew, no colour is pinned to one palette,
 * and the stack trace is kept but demoted behind a closed disclosure.
 *
 * Written in the style of theme-tokens.test.ts, which is the file that first read the stylesheet.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const notFound = strip(read("client/src/pages/NotFound.tsx"));
const boundary = strip(read("client/src/components/ErrorBoundary.tsx"));
const css = strip(read("client/src/index.css"));

const SCREENS: Array<[string, string]> = [
  ["NotFound.tsx", notFound],
  ["ErrorBoundary.tsx", boundary],
];

/** A Tailwind palette utility: bg-slate-100, text-red-500, from-slate-50, bg-white/80. */
const TAILWIND_PALETTE =
  /\b(?:bg|text|from|to|via|border|ring|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)\b/;
const HEX = /#[0-9a-f]{3,8}\b/i;

describe("the fallback screens are inside the design system", () => {
  it("pins no palette in the markup", () => {
    for (const [name, source] of SCREENS) {
      expect(source, `${name} uses a Tailwind palette colour`).not.toMatch(TAILWIND_PALETTE);
      expect(source, `${name} hard-codes a hex colour`).not.toMatch(HEX);
    }
  });

  it("colours both screens from tokens only", () => {
    /*
     * Read from the stylesheet rather than the markup: the classes carry no colour themselves,
     * so the assertion has to follow them to where the colour is actually declared.
     */
    for (const selector of [".not-found,\n.boundary", ".not-found-card,\n.boundary-card"]) {
      const at = css.indexOf(selector);
      expect(at, `no rule for ${selector.replace(/\n/g, " ")} in index.css`).toBeGreaterThan(-1);
      const block = css.slice(at, css.indexOf("\n}", at));
      for (const [, property, value] of block.matchAll(
        /\b(color|background|background-color|border-color)\s*:\s*([^;]+);/g,
      )) {
        expect(value, `${selector.split(",")[0]} sets ${property} to a literal`).toMatch(/var\(--/);
      }
    }
  });
});

describe("the copy is in the language of the app", () => {
  const HEBREW = /[֐-׿]/;

  it("says what happened in Hebrew on both screens", () => {
    for (const [name, source] of SCREENS) {
      expect(source, `${name} has no Hebrew copy`).toMatch(HEBREW);
    }
  });

  it("drops the English strings that shipped", () => {
    // The exact strings a visitor saw. Named so a revert is caught rather than merely diffed.
    for (const gone of [
      "Page Not Found",
      "Go Home",
      "An unexpected error occurred",
      "Reload Page",
    ]) {
      expect(`${notFound}\n${boundary}`, `"${gone}" is still rendered`).not.toContain(gone);
    }
  });
});

describe("the stack trace is kept, and demoted", () => {
  it("still renders the stack", () => {
    // Removing it would be the other failure: a bug report nobody can act on. The self-check
    // panel exists precisely to produce reports, so the trace has to survive.
    expect(boundary).toMatch(/error\?\.stack|\bstack\b/);
    expect(boundary).toMatch(/<pre/);
  });

  it("puts it behind a disclosure that is closed by default", () => {
    expect(boundary, "the trace is not inside a <details>").toMatch(/<details/);
    // `<details open>` would defeat the point; the element must carry no open attribute.
    expect(boundary, "the disclosure ships open").not.toMatch(/<details[^>]*\bopen\b/);
    const detailsAt = boundary.indexOf("<details");
    const preAt = boundary.indexOf("<pre");
    expect(preAt, "the <pre> is not inside the <details>").toBeGreaterThan(detailsAt);
  });
});
