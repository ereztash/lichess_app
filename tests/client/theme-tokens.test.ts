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
    const used = new Set([...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]));
    const undeclared = [...used].filter((name) => !light.has(name) && !dark.has(name));
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
