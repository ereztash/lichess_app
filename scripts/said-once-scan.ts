/**
 * A SENTENCE THE PRODUCT SAYS ONCE PER ROW OF A LIST, WHICH IS A SENTENCE IT SAYS NOTHING WITH.
 *
 * THE DEFECT, AS IT SHIPPED. A three-minute game with six expensive moves rendered a post-game
 * disclosure whose every row read "במהלך X המהלך היה מחיר גדול" with "המהלך: מחיר גדול" beneath it.
 * Thirteen statements of one fact, and nothing on screen to choose between the six -- which is what
 * a reader opening a disclosure is there to do. It was found by a person looking at a screenshot,
 * not by 2,700 green tests, and the same shape was then found on three more screens:
 *
 *   `WhatIsUnclear`   one item per bucket, three possible causes, the cause sentence in EVERY row --
 *                     so a small record printed the same sentence six times.
 *   `LearningQueue`   "הכלל עצמו מוסתר" on every rule in the queue. It is a statement about the
 *                     PROTOCOL and identical for every rule in the list.
 *   `ProfilePanel`    the mirror explanation on every finding that had one, word for word.
 *
 * WHAT THE PREDICATE IS. A JSX element inside a `.map()` callback whose children are text ONLY --
 * no `{expression}` at all -- carrying at least `MIN_SENTENCE` characters. No expression means no
 * per-row datum, and no per-row datum means every row renders that element identically.
 *
 * WHAT IT IS NOT. A row that interpolates one of its own values is a row saying something about
 * itself, however similar it looks to its neighbours: `"— ההפרש קטן ממה ש-{b.inside.n} החלטות
 * יכולות להבחין בו"` is four different true statements on four buckets, and a scanner that could
 * not tell those apart would be demanding the product delete facts to look tidier.
 *
 * IT CATCHES TWO OF THE FOUR, MEASURED, AND THAT IS SAID HERE RATHER THAN LEFT TO BE ASSUMED. Run
 * against the tree as it stood before the fixes, this predicate finds `LearningQueue` and
 * `ProfilePanel` and misses `PostGame` and `WhatIsUnclear` -- because those two render
 * `{eventHeadline(event)}` and `{UNCLEAR_SENTENCE[item.because]}`, and whether a function call
 * varies between rows is a fact about the function rather than about the JSX. A scanner reading
 * markup cannot know it. Those two are held by render assertions in
 * `tests/client/six-rows-that-said-one-thing.test.tsx`, which compare what actually came out.
 *
 * So this is one instrument of two and it is the weaker one. It is worth having because it is the
 * half that runs on every build over every screen, including the ones nobody thought to render.
 *
 * A RATCHET AND NOT A BAR, for the reason `GATE-CLAIM-ANCHOR` started as one: there is one
 * occurrence left and it is not a defect -- `RecordDashboard`'s no-clock sentence renders on a
 * bucket that requires a clock, and `clock-under-1m` is the only one of the six that does, so it
 * appears at most once per render. A gate that is red on the day it is written gets deleted rather
 * than met, and a ceiling of one with the exception named is the honest shape.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

/** Shorter than this is a label or a unit, not a sentence. */
export const MIN_SENTENCE = 25;

/**
 * What the tree holds today, and every one of them accounted for.
 *
 * ONE, AND IT IS `RecordDashboard`'s no-clock line. See the docblock above for why it is not a
 * defect. Anything that raises this number is a new list repeating itself, and the commit that
 * raises it has to say which list and why the repetition is information.
 */
export const CONSTANT_IN_ROW_CEILING = 1;

export interface SaidTwice {
  file: string;
  line: number;
  text: string;
}

const HEBREW = /[֐-׿]/;

/** Every `.tsx` under a root, in a stable order so a report does not reshuffle between runs. */
export function sources(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root).sort()) {
    const full = join(root, entry);
    if (statSync(full).isDirectory()) out.push(...sources(full));
    else if (extname(full) === ".tsx") out.push(full);
  }
  return out;
}

/** The body of each `.map(...)` callback, with its offset, by brace depth from the arrow. */
function mapBodies(source: string): { body: string; at: number }[] {
  const out: { body: string; at: number }[] = [];
  for (const match of source.matchAll(/\.map\(\s*\(?[^)]*\)?\s*=>/g)) {
    const start = match.index! + match[0].length;
    let depth = 0;
    let i = start;
    while (i < source.length) {
      const c = source[i];
      if (c === "(" || c === "{" || c === "[") depth += 1;
      else if (c === ")" || c === "}" || c === "]") {
        depth -= 1;
        if (depth <= 0) break;
      }
      i += 1;
    }
    out.push({ body: source.slice(start, i), at: start });
  }
  return out;
}

/**
 * Elements whose children are text only, inside a `.map()` body.
 *
 * COMMENTS ARE STRIPPED FIRST, and that is not tidiness: this repository's comments are long and
 * in two languages, and a note explaining why a row says something would otherwise be read as the
 * row saying it -- the same "a mention is not a rendering" failure `GATE-CLAIM-ANCHOR` hit on its
 * own docblock.
 */
export function constantSentencesInRows(source: string, file: string): SaidTwice[] {
  const found: SaidTwice[] = [];
  for (const { body, at } of mapBodies(source)) {
    const clean = body.replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length));
    for (const element of clean.matchAll(/<([a-z][\w.]*)\b[^>]*>([^<>{}]+)<\/\1>/g)) {
      const text = element[2].replace(/\s+/g, " ").trim();
      if (text.length < MIN_SENTENCE || !HEBREW.test(text)) continue;
      found.push({
        file,
        line: source.slice(0, at + element.index!).split("\n").length,
        text,
      });
    }
  }
  return found;
}

/** Every constant row sentence under a root, as the gate reads them. */
export function findConstantRowSentences(root: string): SaidTwice[] {
  return sources(join(root, "client/src")).flatMap((file) =>
    constantSentencesInRows(readFileSync(file, "utf8"), relative(root, file).replaceAll("\\", "/")),
  );
}
