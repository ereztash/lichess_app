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

  it("still declares the rows, which is correct whenever the height IS definite", () => {
    expect(block(".board-grid")).toMatch(/grid-template-rows:\s*repeat\(8,\s*1fr\)/);
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
