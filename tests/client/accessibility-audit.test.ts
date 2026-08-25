/**
 * The five findings from a Lighthouse 13.4.1 run, each held shut.
 *
 * The audit ran against the production bundle at the deployed commit and scored Accessibility 81
 * and SEO 91. Every failure below was real, and none of them was visible from reading the source
 * alone -- three needed the page painted, one needed a crawler's parser, and one needed the
 * contrast maths done. Assertions here are the cheap half: they cannot repaint the page, so each
 * one guards the SHAPE of the fix and names the measurement that established it.
 *
 * Re-measured after the fixes with axe-core 4 (the engine Lighthouse embeds) at Lighthouse's own
 * desktop viewport, 1350x940: all five rules pass, zero violations.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const css = strip(read("client/src/index.css"));
const board = strip(read("client/src/components/ChessBoard.tsx"));
const commitment = strip(read("client/src/components/CommitmentScreen.tsx"));

/** The block a selector opens, up to its closing brace. */
function block(selector: string): string {
  const at = css.indexOf(`${selector} {`);
  expect(at, `no ${selector} rule in index.css`).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf("\n}", at));
}

/* ---- WCAG 1.4.3 contrast, computed rather than eyeballed ---------------------------------- */

const channel = (c: number) => (c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
/** What `opacity` actually does to text: composite it into whatever is behind. */
function composite(fg: string, bg: string, alpha: number): string {
  const at = (hex: string, i: number) => parseInt(hex.replace("#", "").slice(i, i + 2), 16);
  const mix = (i: number) => Math.round(at(fg, i) * alpha + at(bg, i) * (1 - alpha));
  return `#${[0, 2, 4].map((i) => mix(i).toString(16).padStart(2, "0")).join("")}`;
}

/** A token's value in the light block and in `.dark`, in that order. */
function themed(name: string): [string, string] {
  const all = [...css.matchAll(new RegExp(`${name}:\\s*([^;]+);`, "g"))].map((m) => m[1].trim());
  expect(all.length, `${name} is not declared in both themes`).toBeGreaterThanOrEqual(2);
  return [all[0], all[1]];
}

describe("the placeholder move is readable in both themes", () => {
  it("colours it with a token instead of dissolving it into the background", () => {
    /*
     * The finding: `.commitment-move.unset` used `opacity: 0.5`. Opacity is not a colour -- it
     * averages the ink INTO the surface and the result is whatever falls out. Lighthouse measured
     * #81827e on #1b2124, 4.21:1, against the 4.5:1 that WCAG 1.4.3 asks of body text.
     */
    const rule = block(".commitment-move.unset");
    expect(rule, "opacity is back on the unset placeholder").not.toMatch(/opacity\s*:/);
    expect(rule, "no colour is declared, so it inherits and dissolves again").toMatch(
      /color:\s*var\(--muted\)/,
    );
  });

  it("clears 4.5:1 with the token it now uses, in the light theme AND the dark one", () => {
    const [lightMuted, darkMuted] = themed("--muted");
    const [lightSurface, darkSurface] = themed("--surface");
    expect(contrast(lightMuted, lightSurface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(darkMuted, darkSurface)).toBeGreaterThanOrEqual(4.5);
  });

  it("shows the old opacity really did fail, and failed worse where nobody looked", () => {
    /*
     * The control, kept as an assertion rather than a memory. Lighthouse audits one theme; it ran
     * in dark and reported 4.21. The light theme was 3.13 and no automated run had ever seen it.
     */
    const [lightSurface, darkSurface] = themed("--surface");
    const [lightInk, darkInk] = ["#17221f", "#e7e3d8"]; // --ink-rgb per theme, as rgb() triples
    expect(contrast(composite(darkInk, darkSurface, 0.5), darkSurface)).toBeLessThan(4.5);
    expect(contrast(composite(lightInk, lightSurface, 0.5), lightSurface)).toBeLessThan(4.5);
  });
});

describe("the board is a grid that a screen reader can navigate", () => {
  it("puts rows between the grid and its cells", () => {
    // `role="grid"` requires rows. 64 gridcells hanging off the grid is what axe reported as
    // aria-required-children on the grid and aria-required-parent on all 64 squares.
    expect(board).toMatch(/role="grid"/);
    expect(board, "no row between grid and gridcell").toMatch(/role="row"/);
    expect(board.indexOf('role="row"')).toBeGreaterThan(board.indexOf('role="grid"'));
    expect(board.indexOf('role="gridcell"')).toBeGreaterThan(board.indexOf('role="row"'));
  });

  it("keeps the eight-column layout by giving the rows no boxes", () => {
    // Without `display: contents` the rows would become grid items and the board would collapse
    // to a single column of eight rows.
    expect(block(".board-row")).toMatch(/display:\s*contents/);
  });
});

describe("what a control is called matches what it says", () => {
  it("names a square the way the square is written", () => {
    /*
     * a1 is the only square carrying both coordinate labels. With the rank first its visible text
     * read "1a" while its name read "a1" -- a real failure for anyone driving the board by voice,
     * who says what they see. Both labels are absolutely positioned, so the order is free.
     */
    expect(board.indexOf('className="file-label"')).toBeLessThan(
      board.indexOf('className="rank-label"'),
    );
  });

  it("puts the visible confidence text inside the accessible name", () => {
    // The button shows "1" over "ניחוש". An em dash used to sit between them in the label only,
    // so the name did not contain the text: WCAG 2.5.3, axe label-content-name-mismatch.
    /*
     * Asserted by comparing the two EXPRESSIONS rather than by matching one spelling of the
     * index. The contract is "the name contains the visible text", and when the scale moved to
     * seven the lookup changed from `[level]` to `[level - 1]` -- a hard-coded regex failed on a
     * change that could not break the contract, while a genuine mismatch between the two lookups
     * would have slipped past it just as easily.
     */
    const named = commitment.match(/aria-label=\{`ביטחון \$\{level\} \$\{([^}]+)\}`\}/);
    const shown = commitment.match(/<small>\{([^}]+)\}<\/small>/);
    expect(named, "the confidence button lost its accessible name").not.toBeNull();
    expect(shown, "the confidence button lost its visible word").not.toBeNull();
    expect(named![1].trim(), "the accessible name reads a different word than the button shows").toBe(
      shown![1].trim(),
    );
    expect(commitment, "the separator between the number and the word is gone").toMatch(
      /<b>\{level\}<\/b>\{" "\}/,
    );
  });
});

describe("the one finding that was not fixed", () => {
  /*
   * target-size on the last read chip, and it is still failing. Recorded here rather than left
   * as an absence, because an audit finding with no test looks the same as one nobody found.
   *
   * Two measured requirements collide. The sticky submit is defended by a contract in
   * ux-contract.test.ts: without it the button sat at y=1302 on a 390x844 phone, below the fold,
   * and a player who had chosen a move could not tell it existed. Removing it during this work
   * measured y=1750. Capping the card and scrolling its fields cleared axe but put the submit at
   * y=921 in an 844 viewport, because on a phone the card starts below the board -- a covered
   * control traded for an invisible one.
   *
   * What keeps it from being a trap: the button moves against the content as the page scrolls,
   * so a chip it covers at one position is clear at another.
   */
  it("still pins the submit, and the conflict is written down where the next reader will look", () => {
    const submit = block(".commitment-submit");
    expect(submit, "the sticky was removed without resolving the contract that defends it")
      .toMatch(/position:\s*sticky/);
    /*
     * The note above the rule is the deliverable here: a future reader who deletes the sticky to
     * clear the audit needs to meet the two measurements BEFORE they do it.
     *
     * Read from the RAW file, not the stripped `css` above -- the note is a comment, and `css`
     * has had every comment removed. An earlier version of this assertion indexed the stripped
     * text and sliced the raw file with that offset, which lands somewhere else entirely.
     *
     * Take the comment block IMMEDIATELY above the rule rather than a fixed window of characters.
     * The window was 1800 and this assertion failed the moment the note grew past it, which is a
     * test breaking on a change that made the thing it guards better. Anchoring to the block also
     * says something the window could not: the note has to be adjacent to the rule, not merely
     * somewhere nearby.
     */
    const raw = read("client/src/index.css");
    const rule = raw.indexOf(".commitment-submit {");
    expect(rule, "no .commitment-submit rule at all").toBeGreaterThan(-1);
    const noteAbove = raw.slice(raw.lastIndexOf("/*", rule), rule);
    expect(noteAbove, "the unresolved conflict is no longer documented above the rule").toMatch(
      /KNOWN, UNRESOLVED CONFLICT/,
    );
  });
});

describe("robots.txt is a file, not the app", () => {
  it("exists and parses as directives rather than markup", () => {
    // vercel.json rewrites unmatched paths to index.html, so /robots.txt answered 200 with the
    // SPA's HTML and a crawler read three lines of markup as three malformed directives.
    const robots = read("client/public/robots.txt");
    expect(robots, "robots.txt is serving markup").not.toMatch(/<!doctype|<html|<script/i);
    expect(robots).toMatch(/^User-agent:\s*\*/m);
    expect(robots).toMatch(/^Allow:\s*\//m);
  });

  it("points at no sitemap, because there is no sitemap", () => {
    // A Sitemap line that 404s is the same defect one line further down.
    expect(read("client/public/robots.txt")).not.toMatch(/^Sitemap:/m);
  });
});

describe("an alpha is not a colour, and the second place it was one", () => {
  /*
   * The audit fixed `.commitment-move.unset`, which was `opacity: 0.5`. The same pattern was
   * still in the stylesheet one rule away -- `.import-progress-note` at `rgba(var(--ink-rgb), 0.6)`
   * -- and Lighthouse never reported it because that audit ran in DARK, where it passes at 5.41:1.
   * Measured light theme: #717670 over #f7f3e9, 4.19:1, under the 4.5:1 WCAG 1.4.3 asks.
   *
   * So this asserts the rule the fix generalised to, not just the one selector: the small notes
   * under the import controls carry a DECLARED colour. A future note that reaches for an alpha
   * again fails here rather than shipping and waiting for an audit that runs in the right theme.
   */
  it("gives the import notes a declared colour rather than a composited one", () => {
    const rule = block(".import-progress-note,\n.import-cost,\n.import-buys");
    expect(rule, "the import notes lost their shared rule").toBeTruthy();
    expect(rule).toMatch(/color:\s*var\(--muted\)/);
    expect(rule, "an alpha over the surface is not a colour -- see the note above the rule").not.toMatch(
      /rgba\(var\(--ink-rgb\)/,
    );
  });

  it("shows the alpha it replaced really was failing, and only in the light theme", () => {
    /*
     * Why this one survived the audit: at 0.6 over the dark surface it is 5.41:1 and passes, and
     * the Lighthouse run was in dark. The light theme is 4.19:1. An automated pass in one theme
     * is not a pass, and this asserts both halves so the reason cannot be lost.
     */
    const [lightSurface, darkSurface] = themed("--surface");
    const [lightInk, darkInk] = ["#17221f", "#e7e3d8"];
    expect(contrast(composite(darkInk, darkSurface, 0.6), darkSurface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(composite(lightInk, lightSurface, 0.6), lightSurface)).toBeLessThan(4.5);
  });
});
