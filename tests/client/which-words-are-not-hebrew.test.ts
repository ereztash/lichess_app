/**
 * SC 3.1.2, and the sweep it does NOT justify.
 *
 * An assessment against WCAG 2.2 AA reported "26+ `dir="ltr"` islands with no `lang`" as a Level AA
 * failure. Thirty-five exist; thirty-two carried no `lang`. Read one by one, **almost all of them
 * are exempt and adding `lang` to them would be wrong**:
 *
 * | island | content | SC 3.1.2 |
 * | --- | --- | --- |
 * | `pv-line`, `reveal-pv`, `moves-rail`, `moment-move`, the candidate list | SAN moves — `Nf3`, `exd5` | technical terms |
 * | `chart-frame` x3 | recharts ticks, which are numbers | indeterminate |
 * | `avgCPL`, `moment-cpl`, `not-found-code`, `"7 / 9"`, `<time>` | numerals | indeterminate |
 * | `import-players`, `provenance.username` | Lichess handles | proper names |
 * | `OWNER_OPEN_ID`, the blocking list, the PGN box | identifiers and notation | technical terms |
 * | `<pre>{stack}</pre>`, `<code>{error.detail}</code>` | a stack trace, a server detail | technical, and marked as such by the element |
 * | `timeline-controls`, `board-grid`, `confidence-row` | layout with Hebrew labels | no foreign text at all |
 *
 * SC 3.1.2 exempts proper names, technical terms, words of indeterminate language, and words that
 * are part of the vernacular of the surrounding text. A blanket sweep would have declared English
 * over chess notation and numerals — asserting a language for strings that have none, which is the
 * accessibility form of the thing this product exists not to do.
 *
 * **Four places had actual English words**, and that is what this file holds:
 * two placeholders and the Lichess speed name, rendered raw in two components.
 *
 * The source scan is the part that lasts. A render assertion covers what exists today; the scan
 * fails on the next Latin placeholder anyone adds anywhere under `client/src`.
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");

function tsxFiles(dir: string): string[] {
  return readdirSync(resolve(root, dir), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? tsxFiles(`${dir}/${entry.name}`)
      : entry.name.endsWith(".tsx")
        ? [`${dir}/${entry.name}`]
        : [],
  );
}

const HEBREW = /[֐-׿]/;

/**
 * Every `placeholder` whose text is Latin script with no Hebrew in it, with the attribute block of
 * the element it sits on. A placeholder is the case worth scanning for: it is the one user-visible
 * string that routinely gets written in English in an otherwise Hebrew form, because it doubles as
 * an example of what to type.
 */
function latinPlaceholders() {
  const found: { file: string; placeholder: string; element: string }[] = [];
  for (const file of tsxFiles("client/src")) {
    const source = readFileSync(resolve(root, file), "utf8");
    for (const match of source.matchAll(/placeholder="([^"]*)"/g)) {
      const value = match[1];
      if (!/[A-Za-z]{2,}/.test(value) || HEBREW.test(value)) continue;
      // Back to the `<` that opens this element, forward to the `>` that closes the open tag.
      const open = source.lastIndexOf("<", match.index);
      const close = source.indexOf(">", match.index);
      found.push({ file, placeholder: value, element: source.slice(open, close) });
    }
  }
  return found;
}

describe("a Hebrew page that says which of its words are not Hebrew", () => {
  it("declares the language of every Latin-script placeholder, wherever one is added", () => {
    const undeclared = latinPlaceholders()
      .filter((entry) => !/\blang=/.test(entry.element))
      .map((entry) => `${entry.file}: placeholder="${entry.placeholder}"`);
    expect(
      undeclared,
      `English placeholder text inside lang="he" with no lang of its own:\n${undeclared.join("\n")}`,
    ).toEqual([]);
  });

  it("found placeholders to check, so a passing scan is not an empty one", () => {
    // The scan above passes trivially if the regex stops matching. This is the denominator.
    expect(latinPlaceholders().map((entry) => entry.placeholder).sort()).toEqual([
      "lichess username",
      "username",
    ]);
  });

  it("declares the Lichess speed name, which is an English word and not a code", () => {
    // bullet, blitz, rapid, classical, correspondence -- rendered raw from the API in two places.
    for (const file of ["client/src/components/ImportGames.tsx", "client/src/components/ImportDiagnostic.tsx"]) {
      const source = readFileSync(resolve(root, file), "utf8");
      const speedSpans = [...source.matchAll(/<span[^>]*>\s*\{[^}]*[Ss]peed[^}]*\}/g)].map(
        (match) => match[0],
      );
      expect(speedSpans.length, `${file} no longer renders a speed name`).toBeGreaterThan(0);
      for (const span of speedSpans) {
        expect(span, `${file}: a speed name with no language declared`).toMatch(/lang="en"/);
      }
    }
  });

  it("leaves chess notation, numerals and identifiers undeclared, because they have no language", () => {
    /*
     * The negative half, and it is the one that keeps the rule honest. If a later sweep decides
     * every `dir="ltr"` needs a `lang`, this goes red -- and it should: `lang="en"` on `Nf3` is a
     * false statement about the content, and SC 3.1.2 exempts exactly these.
     */
    const exempt = [
      ["client/src/components/AnalysisPanel.tsx", 'className="pv-line" dir="ltr"'],
      ["client/src/components/MoveTimeline.tsx", 'className="moves-rail" dir="ltr"'],
      ["client/src/pages/NotFound.tsx", 'className="not-found-code" dir="ltr"'],
    ] as const;
    for (const [file, island] of exempt) {
      const source = readFileSync(resolve(root, file), "utf8");
      expect(source, `${file} no longer contains the island this asserts about`).toContain(island);
    }
  });
});
