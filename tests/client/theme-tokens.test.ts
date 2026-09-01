/**
 * Design tokens that actually have values in both themes.
 *
 * Five did not. `--edge`, `--edge-soft`, `--hairline` and `--hairline-strong` were each declared
 * in :root as a var() reference to THEMSELVES --
 *
 *   --edge: var(--edge);
 *
 * -- which is a cycle. A custom property whose value depends on itself is invalid at
 * computed-value time, so the declaration is thrown away and the property resolves to nothing.
 * `--last-move` was simpler: never declared outside `.dark` at all. Only the dark palette gave
 * any of them values, so in the light theme every border, hairline and last-move highlight drawn
 * from them rendered with no colour. Measured in Chromium: getPropertyValue returned the empty
 * string for all five with `.dark` removed, and real colours with it.
 *
 * That is what "the light presentation is depressing" was, and no test could see it, because
 * nothing here had ever read the stylesheet.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * Comments are stripped first, and that is not tidiness. A comment in this file mentions
 * `--blue:` in prose, and the declaration pattern below matched it and then ran greedily to the
 * next semicolon -- swallowing the real declaration that followed. The parser reported a token
 * as missing that was sitting three lines above it.
 */
const css = readFileSync(resolve(__dirname, "../../client/src/index.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/** Declarations inside a given selector's first block. */
function tokensIn(selector: string): Map<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no ${selector} block in index.css`);
  const block = css.slice(start, css.indexOf("\n}", start));
  const found = new Map<string, string>();
  for (const [, name, value] of block.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) {
    found.set(name, value.trim());
  }
  return found;
}

const light = tokensIn(":root");
const dark = tokensIn(".dark");

describe("theme tokens", () => {
  it("declares no custom property in terms of itself", () => {
    const cycles = [...light, ...dark]
      .filter(([name, value]) => value.includes(`var(${name})`))
      .map(([name]) => name);
    expect(cycles).toEqual([]);
  });

  it("gives the light theme every token the dark theme overrides", () => {
    // A token the dark palette bothers to redefine is one the design depends on. If light does
    // not declare it, light is the theme running without it.
    const missing = [...dark.keys()].filter((name) => !light.has(name));
    expect(missing).toEqual([]);
  });

  it("resolves every var() used in the stylesheet to a declared token", () => {
    /*
     * A `var()` THAT CARRIES A FALLBACK CANNOT RESOLVE TO NOTHING, which is the whole failure this
     * test exists for. `var(--white-share, 0.5)` is a value a COMPONENT supplies at runtime --
     * `EvaluationBar.tsx` writes it as an inline style so the gauge's share can be spent on
     * whichever axis the viewport gives it -- and declaring it in `:root` would put a number that
     * is not a theme decision into the theme palette, where the two tests above would then hold
     * it. The fallback is what makes the omission safe, so the fallback is what exempts it.
     *
     * WITHOUT the fallback it is still caught: drop the `, 0.5` and this test names it again.
     */
    const withFallback = new Set(
      [...css.matchAll(/var\((--[a-z0-9-]+)\s*,/g)].map((m) => m[1]),
    );
    const used = new Set([...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]));
    const undeclared = [...used].filter(
      (name) => !light.has(name) && !dark.has(name) && !withFallback.has(name),
    );
    expect(undeclared).toEqual([]);
  });

  it("names the five that were broken, so a revert is caught by name", () => {
    for (const token of [
      "--edge",
      "--edge-soft",
      "--hairline",
      "--hairline-strong",
      "--last-move",
    ]) {
      expect(light.get(token), `${token} missing from the light palette`).toBeTruthy();
      expect(light.get(token)).not.toContain(`var(${token})`);
    }
  });

  it("keeps the player's mark and the engine's blue apart", () => {
    // One colour meaning both "your guess" and "the machine's answer" is the same erasure the
    // board-marks test guards in the DOM, one layer down.
    expect(light.get("--chosen")).toBeTruthy();
    expect(dark.get("--chosen")).toBeTruthy();
    expect(light.get("--chosen")).not.toBe(light.get("--blue"));
    expect(dark.get("--chosen")).not.toBe(dark.get("--blue"));
  });
});

/**
 * A reason that is a sentence must be allowed to be a sentence.
 *
 * `.bucket-short` carries two kinds of text: "12 decisions, 30 needed", and the no-clock reason,
 * which has to name a fix that actually exists and so runs to a full sentence. It shipped as
 * `white-space: nowrap`, which suits the first and breaks the second.
 *
 * Measured in Chromium at a 390px viewport with the record dashboard's own no-clock copy: the
 * text laid out 628px wide inside a 340px column and pushed the document to 679px, so the page
 * scrolled sideways. Not an edge case -- a local game against Stockfish carries no clock at all,
 * and a Lichess export carries none unless the exporter ticked the box.
 */
describe("a reason long enough to be useful still fits", () => {
  it("lets .bucket-short wrap", () => {
    const css = readFileSync(resolve(__dirname, "../../client/src/index.css"), "utf8");
    const at = css.indexOf(".bucket-short {");
    expect(at, "no .bucket-short rule in index.css").toBeGreaterThan(-1);
    const block = css.slice(at, css.indexOf("}", at));
    expect(block, ".bucket-short is nowrap again").not.toMatch(/white-space\s*:\s*nowrap/);
    expect(block, ".bucket-short has no wrapping rule").toMatch(/overflow-wrap\s*:\s*anywhere/);
  });
});
