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
  /\{[^{}]*\b(?:scoreCp|engine_eval_cp)\s*:\s*-?\d+[^{}]*\bdepth\s*:\s*\d+[^{}]*\}/g;

export function findFakeValues(files: string[]): Finding[] {
  const findings: Finding[] = [];
  for (const file of files) {
    const source = read(file);
    // The engine client's own INITIAL_LINE is a zeroed sentinel, not a rendered placeholder;
    // it never reaches a render path without provenance. Everything else is suspect.
    if (file.endsWith("lib/stockfish.ts")) continue;
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
 */
const HAND_ROLLED_PERCENT = /`\$\{[^`]*\}%`|\)\s*\*\s*100\s*\)\s*\}%|toFixed\([^)]*\)\s*\}?%/g;

export function findDenominatorlessPercents(files: string[]): Finding[] {
  const findings: Finding[] = [];
  for (const file of files) {
    if (file.endsWith("components/Value.tsx")) continue; // the one place allowed to format a %
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
