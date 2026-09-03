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

/**
 * A DECLARED ARIA PATTERN THAT NOTHING IMPLEMENTS.
 *
 * WHAT THIS CATCHES, from the case that produced it. `.board-grid` carried `role="grid"` and the
 * component handled no key at all. That role is a PROMISE: assistive technology switches into grid
 * mode on the strength of it and offers the reader arrow-key navigation, which then does nothing.
 * A declared pattern with no implementation is worse than no pattern, because the reader has been
 * told the wrong thing about how to drive the page. The same shape was live on `Overlay`, where
 * `aria-modal="true"` told a reader the rest of the document was not there while Tab walked
 * straight out into it.
 *
 * Neither was caught by anything. Every other gate here reads code for a claim about MEASUREMENT;
 * this one reads it for a claim about INTERACTION, and the two failures look nothing alike.
 *
 * WHY IT SCANS FOR A HANDLER RATHER THAN CHECKING BEHAVIOUR. A gate cannot press a key. What it can
 * do is refuse the specific state both defects were in: the role present, and no keyboard handling
 * anywhere in the file that declares it. That is a weak test of a strong rule, and it is deliberate
 * -- the behaviour is held by `tests/client/a-board-nobody-could-hear.test.tsx`,
 * `tests/client/a-dialog-that-gives-focus-back.test.tsx` and the real-browser Tab count in
 * `tests/layout/board-tab-order.layout.test.tsx`. This gate exists so the NEXT interactive surface
 * cannot ship the same way without someone writing those.
 *
 * THE ROLE LIST IS THE APG'S, NOT A GUESS. Every role below is one the WAI-ARIA Authoring Practices
 * specify keyboard navigation for. Roles that carry no such expectation -- `status`, `note`,
 * `gridcell` on its own -- are absent on purpose: a gate that fires on honest code is a gate people
 * learn to route around.
 */
const KEYBOARD_ROLES = [
  "grid",
  "treegrid",
  "listbox",
  "tree",
  "menu",
  "menubar",
  "tablist",
  "radiogroup",
  "toolbar",
];

/** Anything that would let a key reach the component. */
const HANDLES_KEYS = /\bonKeyDown\b|\bonKeyUp\b|["']keydown["']|["']keyup["']/;

export function findUnimplementedAriaPatterns(files: string[]): Finding[] {
  const findings: Finding[] = [];
  const roleAttr = new RegExp(`role=["'](${KEYBOARD_ROLES.join("|")})["']`, "g");
  for (const file of files) {
    const source = read(file);
    if (HANDLES_KEYS.test(source)) continue;
    for (const match of source.matchAll(roleAttr)) {
      const line = source.slice(0, match.index).split("\n").length;
      findings.push({
        file,
        line,
        text: `${match[1]} declared, no keyboard handler in this file`,
      });
    }
    /*
     * A modal dialog is the other half. `aria-modal="true"` asserts the rest of the document is
     * gone; without a key handler nothing keeps Tab inside, so the assertion is false the moment
     * the reader acts on it.
     */
    for (const match of source.matchAll(/aria-modal=\{?["']?true["']?\}?/g)) {
      const line = source.slice(0, match.index).split("\n").length;
      findings.push({
        file,
        line,
        text: "aria-modal declared, no keyboard handler to keep focus inside",
      });
    }
  }
  return findings;
}

/**
 * CONTINUATION IS A MOVE, AND THE DEFINITION IS NOT A COMMENT.
 *
 * Owner decision `O-2` fixes `next_decision_started` to one behaviour: after a prior reveal, the
 * player is shown a legal position in which it is their turn, and places a legal move in it. Five
 * things are named as NOT continuation -- a route change, a press of the way-on control, a render
 * of a position, entry to a screen, and selecting a game.
 *
 * `O-1` gave the reveal a one-press route to the next position. That removes navigation friction
 * from what the trial measures, and it puts a new button one line away from the event: a change
 * that recorded continuation on that press would turn the product's own control into the
 * player's behaviour, and every continuation rate in the funnel would then be about the button.
 *
 * WHAT THIS READS, AND WHY EACH CLAUSE IS SEPARATE FROM THE UNIT TESTS. The tests fix the
 * predicate's truth table. They cannot see a caller that stops consulting it, passes a literal
 * for a clause, or records the event from somewhere else entirely -- and those are the three ways
 * this definition actually decays.
 *
 *   1. The event is recorded in exactly ONE place.
 *   2. That place consults `continuationStarted`.
 *   3. No clause is supplied as a literal `true` at the call site.
 *   4. The predicate still requires all four clauses.
 */
const CONTINUATION_EVENT = "next_decision_started";
const CONTINUATION_CLAUSES = [
  "movePlaced",
  "positionWasActionable",
  "revealsPresented",
  "alreadyRecorded",
] as const;

export function findContinuationDefinitionDrift(roots: string[]): Finding[] {
  const out: Finding[] = [];
  const files = roots.flatMap((root) => sourceFiles(root));
  const recorders: { file: string; line: number; consults: boolean; literals: string[] }[] = [];
  let predicate: { file: string; line: number; missing: string[] } | null = null;

  for (const file of files) {
    const source = read(file);
    const lines = source.split("\n");

    /*
     * WHERE THE EVENT IS WRITTEN, found from the WRITE and not from the name.
     *
     * The first version of this matched any line carrying the string, and went red on the union
     * member in `TrialEvent` that declares the event's own shape. A type is not a writer. So the
     * scan starts at `recordTrialEvent(` and asks what that call names.
     */
    const writer = /recordTrialEvent\s*\(\s*\{([\s\S]*?)\}\s*\)/g;
    for (let m = writer.exec(source); m; m = writer.exec(source)) {
      if (!new RegExp(`name:\\s*["'\`]${CONTINUATION_EVENT}["'\`]`).test(m[1])) continue;
      const i = source.slice(0, m.index).split("\n").length - 1;
      const window = lines.slice(Math.max(0, i - 30), i + 5).join("\n");
      const call = /continuationStarted\s*\(\s*\{([\s\S]*?)\}\s*\)/.exec(window);
      recorders.push({
        file,
        line: i + 1,
        consults: Boolean(call),
        literals: call
          ? CONTINUATION_CLAUSES.filter((c) =>
              new RegExp(`${c}\\s*:\\s*(?:true|1)\\b`).test(call[1]),
            )
          : [],
      });
    }

    /* And where the definition lives. */
    /*
     * FROM THE RETURN, NOT FROM THE SIGNATURE. Matching to the first `\n}` stopped at the closing
     * brace of the inline parameter TYPE, so the scan read a list of clause names and concluded
     * every clause was missing. What has to be read is what the function does with them.
     */
    const body =
      /export function continuationStarted[\s\S]*?\)\s*:\s*boolean\s*\{([\s\S]*?)\n\}/.exec(source);
    if (body) {
      const at = source.slice(0, body.index).split("\n").length;
      predicate = {
        file,
        line: at,
        missing: CONTINUATION_CLAUSES.filter((c) => !new RegExp(`input\\.${c}\\b`).test(body[1])),
      };
    }
  }

  if (recorders.length === 0) {
    out.push({ file: roots.join(", "), line: 1, text: `nothing records ${CONTINUATION_EVENT}` });
  }
  if (recorders.length > 1) {
    out.push({
      file: recorders[1].file,
      line: recorders[1].line,
      text: `${CONTINUATION_EVENT} is recorded in ${recorders.length} places; one definition means one writer`,
    });
  }
  for (const r of recorders) {
    if (!r.consults) {
      out.push({
        file: r.file,
        line: r.line,
        text: `records ${CONTINUATION_EVENT} without consulting continuationStarted`,
      });
    }
    for (const literal of r.literals) {
      out.push({
        file: r.file,
        line: r.line,
        text: `passes ${literal}: true as a literal; a clause that is always true is not a clause`,
      });
    }
  }
  if (!predicate) {
    out.push({ file: roots.join(", "), line: 1, text: "continuationStarted is not defined" });
  } else {
    for (const clause of predicate.missing) {
      out.push({
        file: predicate.file,
        line: predicate.line,
        text: `continuationStarted ignores ${clause}, which O-2 requires`,
      });
    }
  }
  return out;
}
