/**
 * The static document and the module cannot disagree about which way this interface runs.
 *
 * THE SAME SHAPE AS `the-link-someone-was-sent`, and for the same reason. `client/index.html` is
 * read by crawlers and by the first paint before any script runs, so it has to carry `lang` and
 * `dir` as literals; every other surface derives them from `shared/interface-language.ts`. Two
 * copies of one fact, one of which no compiler can see, is exactly the drift that module was
 * written to make impossible -- so the copy that cannot import is held here instead.
 *
 * AND THE DIRECTION IS HELD AGAINST THE LANGUAGE, not just against itself. A build that said
 * `lang="en" dir="rtl"` would pass a check that only compared two strings to two strings.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DIRECTION_OF,
  INTERFACE_DIRECTION,
  INTERFACE_LANGUAGE,
  readingStartsOnTheRight,
} from "@shared/interface-language";

const root = resolve(__dirname, "../..");
const html = readFileSync(resolve(root, "client/index.html"), "utf8");
const app = readFileSync(resolve(root, "client/src/App.tsx"), "utf8");
const css = readFileSync(resolve(root, "client/src/index.css"), "utf8");

describe("one language, one direction, in both copies", () => {
  it("derives the direction from the language rather than declaring it twice", () => {
    expect(INTERFACE_DIRECTION).toBe(DIRECTION_OF[INTERFACE_LANGUAGE]);
  });

  it("says the same thing in the static document as in the module", () => {
    const tag = /<html\s+lang="([^"]+)"\s+dir="([^"]+)"/.exec(html);
    expect(tag, "client/index.html has no <html lang= dir=> to compare").not.toBeNull();
    expect(tag![1], "index.html's lang disagrees with INTERFACE_LANGUAGE").toBe(INTERFACE_LANGUAGE);
    expect(tag![2], "index.html's dir disagrees with INTERFACE_DIRECTION").toBe(
      INTERFACE_DIRECTION,
    );
  });

  it("has the running app set both from the module, so the module is the source", () => {
    expect(app).toMatch(/document\.documentElement\.lang = INTERFACE_LANGUAGE/);
    expect(app).toMatch(/document\.documentElement\.dir = INTERFACE_DIRECTION/);
  });

  it("knows which side the reading starts on, for the layout rule to be written against", () => {
    expect(readingStartsOnTheRight("rtl")).toBe(true);
    expect(readingStartsOnTheRight("ltr")).toBe(false);
  });
});

/*
 * A DERIVED DIRECTION IS ONLY DERIVED IF THE STYLESHEET NEVER ARGUES WITH IT.
 *
 * One `border-left` is enough to make a layout correct in exactly one language, which is the
 * defect that produced this module: `.control-rail` carried one, correct while the rail was track
 * 1 on a right-to-left page and wrong the moment either of those two facts changed. Both changed
 * in the same commit.
 *
 * DEMONSTRATED RED, four shapes, one at a time, then reverted: `.ctl { border-left: 1px solid red }`
 * on one line, `margin-right` on its own line inside a block, `text-align: right`, and
 * `float: left`. A check nobody has seen fail is a check nobody knows the scope of.
 *
 * TWO EXEMPTIONS, AND THEY ARE THE BOARD'S. `.rank-label` and `.file-label` are placed physically
 * on purpose: a1 is bottom-left for White in every language, and a board that mirrored itself with
 * the interface would be stating a different position. They are named here rather than allowed by
 * a pattern, so a third exemption has to be argued for in this file.
 */
/*
 * COMMENTS ARE STRIPPED FIRST, and that is not tidiness. This file's own comments SAY
 * `border-left` -- they explain which physical declarations were converted and why -- so a scan
 * of the raw text would find the explanation and call it the offence.
 */
const DECLARATIONS = css.replace(/\/\*[\s\S]*?\*\//g, "");
const PHYSICAL =
  /(?:^|[{;\s])(?:(?:border|margin|padding|inset|scroll-margin|scroll-padding)-(?:left|right)|left|right|float|clear)\s*:|text-align\s*:\s*(?:left|right)\b/g;
const BOARD_COORDINATES = ["left: 4px", "right: 4px"];

describe("nothing in the stylesheet names a physical side", () => {
  it("leaves only the board's own coordinates physical", () => {
    const offenders = [...DECLARATIONS.matchAll(PHYSICAL)]
      .map((m) =>
        DECLARATIONS.slice(m.index!, DECLARATIONS.indexOf(";", m.index!))
          .replace(/^[{;\s]+/, "")
          .trim(),
      )
      .filter((line) => !BOARD_COORDINATES.includes(line));
    expect(
      offenders,
      `physical side declarations in index.css: ${offenders.join(" | ")}. Use the logical ` +
        `property (border-inline-start, margin-inline-end, text-align: start/end) so the rule is ` +
        `true in both directions.`,
    ).toEqual([]);
  });

  it("still has the two board coordinates it exempts, so the exemption is not vacuous", () => {
    for (const line of BOARD_COORDINATES) expect(DECLARATIONS).toContain(line);
  });
});
