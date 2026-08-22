/**
 * The board's squares must be square on their own.
 *
 * Twice now a rank with no pieces on it has collapsed to zero height in a browser this project
 * cannot drive, rendering the starting position as four ranks. Both times the board's height came
 * from `.board-grid { aspect-ratio: 1 }` feeding `grid-template-rows: repeat(8, 1fr)`. Where that
 * chain does not hold, `1fr` rows fall back to max-content and empty ranks vanish.
 *
 * jsdom does not lay out, so this cannot be asserted by measuring. What it asserts instead is that
 * the structural guarantee is present in the stylesheet: a square sized by its own aspect-ratio
 * does not care how the container resolved its height.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../../client/src/index.css", import.meta.url), "utf8");

function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`${selector} is not in index.css -- this test lost its subject`);
  const end = css.indexOf("}", start);
  return css.slice(start, end);
}

describe("the board cannot collapse a rank", () => {
  it("sizes each square by its own aspect-ratio, not by the container's height", () => {
    expect(block(".board-square")).toMatch(/aspect-ratio:\s*1/);
  });

  it("still declares eight explicit rows, so no rank can collapse", () => {
    /*
     * This used to pin the exact track function -- `repeat(8, 1fr)` -- and that turned out to
     * be the wrong thing to hold onto. `1fr` means `minmax(auto, 1fr)`, whose `auto` MINIMUM is
     * min-content: the glyph. On a short viewport the tracks then refused to shrink and the
     * squares overflowed the board's own box (measured 154px of spill at 1280x600, with the
     * board 332x493 instead of square). The rows are now minmax(0, 1fr).
     *
     * What this test actually cares about is unchanged and still enforced: EIGHT rows, declared
     * explicitly. Implicit rows size to their content, so a rank with no pieces on it collapses
     * to zero height -- the starting position once rendered as four ranks stacked at the top.
     * The track function is free to change; the count and the explicitness are not.
     */
    const rows = block(".board-grid").match(/grid-template-rows:\s*repeat\(\s*8\s*,[^;]+;/);
    expect(rows, "the board grid no longer declares its rows explicitly").toBeTruthy();
    // And it must not be the bare `1fr` that caused the overflow.
    expect(rows![0]).not.toMatch(/repeat\(\s*8\s*,\s*1fr\s*\)/);
  });

  it("bounds the board's width with vh, not only with the newer svh", () => {
    // A browser that does not understand svh drops the whole declaration and gets no bound at
    // all. The minifier keeps only the last of two same-property declarations in one block, so
    // the fallback has to live in its own rule to survive the build.
    const stage = block(".board-stage");
    expect(stage).toMatch(/max-width:\s*min\(100%,\s*calc\(100vh/);
    expect(stage).not.toMatch(/100svh/);
    expect(css).toMatch(/@supports \(height: 100svh\)/);
  });
});
