/**
 * Static scanners for GATE-NO-FAKE and GATE-DENOM.
 *
 * These read render-path source and look for the two shapes that made the old interface lie:
 * an engine-shaped literal used as if it were a measurement, and a percentage built by hand
 * without its denominator. Both are expressed as predicates so the gate and its positive
 * control run identical logic over different files.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";

export interface Finding {
  file: string;
  line: number;
  text: string;
}

export function sourceFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root)) {
    const full = join(root, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if ([".ts", ".tsx"].includes(extname(full))) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Blank out comments while preserving line and column positions, so a reported location points
 * at the real line. Collapsing comments shifts every line number after them.
 */
export function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, " "))
    .replace(
      /(^|[^:"'`\\])\/\/[^\n]*/g,
      (match, prefix: string) => prefix + " ".repeat(match.length - prefix.length),
    );
}

const read = (file: string) => stripComments(readFileSync(file, "utf8"));

/**
 * A placeholder evaluation: an object literal carrying engine-line fields with hard-coded
 * numbers. This is the shape of the FALLBACK constant that made the app open on a fabricated
 * +0.42 at depth 14, rendered identically to a real evaluation.
 */
const FAKE_EVAL =
  /\{[^{}]*\b(?:scoreCp|engine_eval_cp)\s*:\s*-?\d+[^{}]*\bdepth\s*:\s*[1-9]\d*[^{}]*\}/g;

export function findFakeValues(files: string[]): Finding[] {
  const findings: Finding[] = [];
  for (const file of files) {
    const source = read(file);
    for (const match of source.matchAll(FAKE_EVAL)) {
      const line = source.slice(0, match.index).split("\n").length;
      findings.push({ file, line, text: match[0].replace(/\s+/g, " ").slice(0, 90) });
    }
  }
  return findings;
}

/**
 * A percentage built by hand. Any template literal or concatenation producing "%" from a
 * computed number, outside the Rate component that is required to render a denominator.
 *
 * The fourth alternative is JSX interpolation -- `<b>{analysis.accuracy}%</b>` -- which the first
 * three do not match. GameReview.tsx renders exactly that shape. It is honest there (its n is on
 * the next line), but the gate could not see it either way, so a regression on that line was
 * invisible to the check that exists to catch it.
 */
const HAND_ROLLED_PERCENT =
  /`\$\{[^`]*\}%`|\)\s*\*\s*100\s*\)\s*\}%|toFixed\([^)]*\)\s*\}?%|\{[A-Za-z_$][\w.$?![\]]*\}\s*%/g;

export function findDenominatorlessPercents(files: string[]): Finding[] {
  const findings: Finding[] = [];
  for (const file of files) {
    const portableFile = file.replaceAll("\\", "/");
    if (portableFile.endsWith("components/Value.tsx")) continue; // the one place allowed to format a %
    /*
     * Exempt for a stated reason, not for convenience. `pct()` here formats numbers that
     * `statementFor` prints in the same sentence as `inside.n` and `outside.n`, and that pairing
     * is itself gated -- GATE-GRADE fails if a claim renders without its n. Two gates asserting
     * the same thing on the same lines would make this one fire on honest code forever.
     */
    if (portableFile.endsWith("shared/claim-derivation.ts")) continue;
    const source = read(file);
    for (const match of source.matchAll(HAND_ROLLED_PERCENT)) {
      const before = source.slice(0, match.index);
      // A width/height style percentage is layout, not a claim about data.
      const context = before.slice(-120);
      if (/\b(width|height|top|left|right|bottom|transform|translate)\b/i.test(context)) continue;
      const line = before.split("\n").length;
      findings.push({ file, line, text: match[0].replace(/\s+/g, " ").slice(0, 90) });
    }
  }
  return findings;
}

/**
 * A static VALUE import of the engine implementation from a render path.
 *
 * stockfish.ts imports the engine JS and the 7MB wasm via `?url`, so any value import of it puts
 * the engine into the initial module graph -- it then appears in the network tab while the
 * commitment screen is still up, which R3 forbids exactly as much as rendering its output.
 *
 * `import type` is fine: type imports are erased. This is a real regression that happened:
 * importing `isStale` from stockfish.ts silently undid the dynamic-import guarantee, which is
 * why the pure predicates now live in engine-line.ts.
 */
const STATIC_ENGINE_IMPORT = /^\s*import\s+(?!type\s)[^;]*?from\s+["'][^"']*lib\/stockfish["']/gm;

export function findStaticEngineImports(files: string[]): Finding[] {
  const findings: Finding[] = [];
  for (const file of files) {
    const portableFile = file.replaceAll("\\", "/");
    if (portableFile.endsWith("lib/stockfish.ts")) continue; // the module itself
    const source = read(file);
    for (const match of source.matchAll(STATIC_ENGINE_IMPORT)) {
      const line = source.slice(0, match.index).split("\n").length;
      findings.push({ file, line, text: match[0].replace(/\s+/g, " ").trim().slice(0, 90) });
    }
  }
  return findings;
}

/**
 * Flow content nested inside a `<p>`, which the HTML parser will not accept.
 *
 * `<p>` may hold PHRASING content only. When a parser meets `<details>` or a `<div>` inside one,
 * it closes the paragraph first and re-parents the child -- so the DOM the browser builds is not
 * the tree React rendered, and React reports a hydration mismatch on a screen that is already
 * telling the player something went wrong.
 *
 * FOUND IN `.commitment-error`, which wrapped a `<details>` holding the technical detail of a
 * failed commit. That is the worst place for it: the error panel is the one surface whose entire
 * job is to be trustworthy when everything else has failed, and it was the surface producing a
 * console error of its own.
 *
 * A SCAN RATHER THAN A TEST OF ONE COMPONENT, because the next occurrence will be somewhere else.
 * Nesting is not parsed -- a `<p>` inside a `<p>` would confuse the span match -- but that case is
 * itself invalid, so being flagged is the correct outcome rather than a false positive.
 */
const FLOW_IN_PARAGRAPH =
  /<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/g;
const FLOW_ONLY = /<(details|div|section|article|aside|ul|ol|dl|table|form|figure|blockquote|pre|h[1-6]|p)\b/;

export function findInvalidParagraphs(files: string[]): Finding[] {
  const findings: Finding[] = [];
  for (const file of files) {
    const source = read(file);
    for (const match of source.matchAll(FLOW_IN_PARAGRAPH)) {
      const inner = match[1].match(FLOW_ONLY);
      if (!inner) continue;
      const line = source.slice(0, match.index).split("\n").length;
      findings.push({ file, line, text: `<p> contains <${inner[1]}>` });
    }
  }
  return findings;
}
