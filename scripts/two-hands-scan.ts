/**
 * THE MACHINE'S COLOUR IS NEVER SOMETHING YOU CAN PRESS, read off the stylesheet.
 *
 * WHAT THIS IS A GATE OVER. `client/src/index.css` declares a semantic layer whose whole content
 * is one rule: the engine may speak and it may not ask the player for anything. Measured on the
 * build this rule was written against, one hue was carrying nine jobs at once -- the engine's
 * arrow on the board, the player's own selected square and legal-move dots on the SAME board, the
 * primary action, selection, focus, progress, links, evidence authority and the brand mark. Two of
 * those nine are the two sides of the one distinction the product exists to make.
 *
 * IT RUNS IN BOTH DIRECTIONS, and that is the point. A check that only asked "does anything
 * interactive paint in the machine's colour" can be satisfied by deleting the colour: it cannot
 * fail in the direction the design actually fails, which is the engine's own output quietly
 * drifting into the page's material. `.evaluation-track` -- the machine's largest object, 16x584
 * -- was drawn in `--ink` when this was written, and no one-directional check would have said so.
 *
 * SOURCE RATHER THAN RENDER, deliberately. `tests/layout/` measures painted boxes and is the
 * stronger instrument for anything about size or contrast. This is a rule about which TOKEN a
 * declaration names, and a token survives a screenshot only as a resolved colour -- at which point
 * `--action` and `--focus` and `--ink` are the same three bytes and the rule is unreadable.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface CssBlock {
  selector: string;
  body: string;
  line: number;
}

/** Every top-level rule in a stylesheet, with the line its selector is on. */
export function blocksOf(css: string): CssBlock[] {
  const out: CssBlock[] = [];
  const lines = css.split("\n");
  let selector: string | null = null;
  let indent = "";
  let start = 0;
  let body: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (selector === null) {
      /*
       * INDENTED BLOCKS COUNT. The first version of this anchored on column zero, which made
       * every rule inside an `@media` invisible to it -- including the whole `forced-colors`
       * block and both breakpoints. A scanner with a blind spot is the shape of defect this
       * repository keeps finding in its own tests, so it does not get to ship one.
       */
      const m = /^(\s*)([^\s@}].*?)\{\s*$/.exec(line);
      if (m) {
        indent = m[1];
        selector = m[2].trim();
        start = i + 1;
        body = [];
      }
      continue;
    }
    if (line === `${indent}}` || /^\s*\}\s*$/.test(line)) {
      out.push({ selector, body: body.join("\n"), line: start });
      selector = null;
      continue;
    }
    body.push(line);
  }
  return out;
}

/**
 * THE MACHINE'S VOICE, which is a colour a mark is drawn IN.
 *
 * `--blue` is here as well as `--machine` because it is the primitive underneath it: a call site
 * that reaches past the semantic name gets the same colour and the same meaning, and a rule that
 * only knew the alias would be satisfied by spelling it the other way.
 *
 * `--surface-machine` IS DELIBERATELY NOT HERE, and the distinction was forced by a critic who
 * found the rule contradicting itself. The plane is a GROUND, not a voice: the engine's numbers
 * live on it, and the disclosure that opens the engine's numbers is a control that sits ON that
 * ground. Requiring `.reveal-secondary` to carry the plane (below) while forbidding any control
 * from carrying it made the gate demand and forbid the same declaration on the same selector.
 *
 * The rule the product actually holds, and the one asserted here:
 *
 *     the colour the machine SPEAKS IN is never something a player can press
 *     the ground the machine WRITES ON is never something the player made
 */
export const MACHINE_TOKENS = ["--machine", "--blue", "--blue-rgb"];

/** The ground the machine writes on. A surface, never a voice. */
export const MACHINE_GROUND = "--surface-machine";

/**
 * What counts as something a player can press.
 *
 * Element names, interaction pseudo-classes, the two ARIA state attributes this product uses for
 * toggles, and the naming conventions its controls already follow. Deliberately generous: a false
 * positive here is a five-second look at one selector, and a false negative is the defect.
 */
const INTERACTIVE =
  /(^|[\s,>+~])(button|a|input|textarea|select|summary|details)([\s.:[,]|$)|:hover|:focus|:focus-visible|:active|\[aria-pressed|\[aria-selected|\[role="button"\]|-control\b|-button\b|-chip\b|-toggle\b|-submit\b|-action\b|-tab\b|-next\b|-confirm\b|-again\b|-resign\b|-reload\b|-save\b|-abandon\b|\.selected\b|\.active\b|\breveal-secondary\b/;

export function isInteractive(selector: string): boolean {
  return INTERACTIVE.test(selector);
}

/** Rules a player can press that paint in the machine's colour. Must be empty. */
export function controlsSpeakingInTheMachinesColour(css: string): CssBlock[] {
  return blocksOf(css).filter(
    (b) =>
      isInteractive(b.selector) &&
      MACHINE_TOKENS.some((t) => b.body.includes(`var(${t})`)),
  );
}

/**
 * The other direction: the engine's own surfaces, named, each of which must carry a machine token.
 *
 * A LIST RATHER THAN A HEURISTIC. There is no way to tell from a selector whether the thing it
 * paints is the engine speaking; that is a fact about the product, so it is written down as one.
 * Adding a surface to the product means adding it here, which is the cost of the rule being real.
 */
export const MACHINE_SURFACES = [
  ".board-vectors line",
  ".board-vectors circle",
  ".evaluation-track",
  ".evaluation-instrument",
  ".analysis-column",
  ".reveal-secondary",
  ".cloud-score",
  ".opponent-thinking",
];

/** Named machine surfaces that do not paint in the machine's colour. Must be empty. */
export function machineSurfacesNotSpeakingInIt(css: string): string[] {
  const blocks = blocksOf(css);
  const missing: string[] = [];
  for (const selector of MACHINE_SURFACES) {
    const found = blocks.filter((b) => b.selector === selector);
    if (found.length === 0) {
      missing.push(`${selector} (no such rule)`);
      continue;
    }
    const speaks = [...MACHINE_TOKENS, MACHINE_GROUND];
    if (!found.some((b) => speaks.some((t) => b.body.includes(`var(${t})`)))) {
      missing.push(selector);
    }
  }
  return missing;
}

export function stylesheet(root = resolve(__dirname, "..")): string {
  return readFileSync(resolve(root, "client/src/index.css"), "utf8");
}
