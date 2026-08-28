// @vitest-environment jsdom
/**
 * The reveal's order was right and its weight was upside down.
 *
 * MEASURED, NOT ASSERTED FROM TASTE. Built app, Chromium, 390x844, first reveal from an empty
 * profile. The page came to 3315px. Inside it:
 *
 *   .reveal-panel        436px   13%   everything this product says that no engine would
 *     limits block       180px          first, and the largest thing in the panel
 *     the finding         92px          the sentence the screen exists to say
 *     next question       92px
 *   .analysis-column     531px   16%   ordinary engine analysis
 *     .analysis-hero     186px          the evaluation digit alone, at --panel-display
 *   .learning-composer   877px   26%   nine fields, open, on decision number one
 *
 * So the disclaimer was twice the finding, the engine's number was twice the finding, and the
 * biggest thing on the page was a form asking a player to state a falsifiable rule -- seven
 * hundred pixels below this same panel saying "זו החלטה אחת שנרשמה. שום דבר כאן אינו דפוס".
 *
 * WHAT WAS NOT DONE ABOUT IT. Nothing moved and no sentence changed. The limits still come first,
 * because the epistemic order is a claim about what the reader is entitled to believe and it is
 * correct. Only weight changed -- which is the one lever that cannot quietly strengthen a
 * statement, and the reason this file asserts sizes rather than wording.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
/* Comments stripped: this stylesheet explains its own history in prose, and a raw search for a
   declaration matches the paragraph describing the one that was replaced. */
const css = readFileSync(resolve(root, "client/src/index.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/** The declarations of one rule, by exact selector. */
function block(selector: string): string {
  const at = css.indexOf(`${selector} {`);
  expect(at, `no ${selector} rule in index.css`).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf("\n}", at));
}

/**
 * The type scale, in pixels, read off `:root`.
 *
 * Resolved rather than restated. The sizes are a document-level fact declared in one place, and a
 * test that hard-coded "26" would go green the day somebody changed the token and left every
 * relationship below it wrong.
 */
const SCALE: Record<string, number> = Object.fromEntries(
  [...block(":root").matchAll(/(--panel-[a-z]+):\s*(\d+)px/g)].map((m) => [m[1], Number(m[2])]),
);

/** The px size a rule sets, following `var(--panel-…)` back to the scale. */
function sizeOf(selector: string): number {
  const body = block(selector);
  const token = body.match(/var\((--panel-[a-z]+)\)/)?.[1];
  expect(token, `${selector} sets no size from the scale`).toBeTruthy();
  const px = SCALE[token!];
  expect(px, `${token} is not declared in :root`).toBeGreaterThan(0);
  return px;
}

describe("on a screen carrying a reveal, the largest thing is the reveal's own sentence", () => {
  it("gives the finding the step the scale reserves for exactly that", () => {
    /*
     * `--panel-display` is documented in :root as "the one largest thing on a screen, and there
     * is one". On a reveal, this is that thing. It used to be `--panel-data`, which the same
     * block describes as "things that are readings: the move, the confidence digit".
     */
    expect(sizeOf(".one-thing-text")).toBe(SCALE["--panel-display"]);
  });

  it("keeps the engine's evaluation below it, so there is still only one largest thing", () => {
    /*
     * THE HALF THAT MAKES THE OTHER HALF TRUE. Raising the finding to `--panel-display` while
     * `.score-number` also sat there would have produced two things at the top of the scale,
     * which is the same as none: the sentence would still not have been harder to miss than the
     * number every other chess tool shows. It steps down one rank and stays the largest element
     * in the analysis column, which is the job it actually has.
     */
    const engine = sizeOf(".score-number");
    expect(engine).toBeLessThan(SCALE["--panel-display"]);
    expect(sizeOf(".one-thing-text")).toBeGreaterThan(engine);
  });

  it("puts the disclaimer first and smallest, which are two different claims", () => {
    const limits = sizeOf(".reveal-limits li");
    expect(limits, "the block about what cannot be said outweighs what can").toBeLessThan(
      sizeOf(".one-thing-text"),
    );
    // And the ordering is untouched: limits, then the finding, then the question.
    const order = readFileSync(resolve(root, "client/src/components/RevealPanel.tsx"), "utf8");
    expect(order.indexOf("reveal-limits")).toBeLessThan(order.indexOf("reveal-one-thing"));
    expect(order.indexOf("reveal-one-thing")).toBeLessThan(order.indexOf("reveal-question"));
  });

  it("keeps the reading quieter than the event, which the rewrite must not have flattened", () => {
    // `.one-thing-note` is what the event may be about; equal weight would let the interpretation
    // borrow the certainty of the fact. It stays below the sentence it follows.
    expect(sizeOf(".one-thing-note")).toBeLessThan(sizeOf(".one-thing-text"));
  });
});
