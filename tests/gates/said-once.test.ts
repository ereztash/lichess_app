/**
 * GATE-SAID-ONCE: a sentence identical in every row of a list belongs above the list, not in it.
 *
 * FOUND BY A PERSON LOOKING AT A SCREENSHOT, and by none of 2,712 green tests. Six rows in a
 * post-game disclosure each read "במהלך X המהלך היה מחיר גדול" with "המהלך: מחיר גדול" beneath;
 * thirteen statements of one fact. Three more screens had the same shape.
 *
 * THE SCAN IS THE WEAKER OF THE TWO INSTRUMENTS and `scripts/said-once-scan.ts` says so with a
 * measurement: it catches two of the four, because the other two render a function call and
 * whether that varies is not visible in the markup. The render assertions in
 * `tests/client/six-rows-that-said-one-thing.test.tsx` hold those.
 */
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONSTANT_IN_ROW_CEILING,
  MIN_SENTENCE,
  constantSentencesInRows,
  findConstantRowSentences,
} from "../../scripts/said-once-scan";

const root = resolve(__dirname, "../..");

describe("a sentence that is the same in every row", () => {
  it("stays at or under the ceiling, with every occurrence accounted for", () => {
    const found = findConstantRowSentences(root);
    expect(
      found.length,
      `constant row sentences: ${found.map((f) => `${f.file}:${f.line} ${f.text}`).join(" | ")}`,
    ).toBeLessThanOrEqual(CONSTANT_IN_ROW_CEILING);
  });

  it("the one that remains is the one the ceiling is for", () => {
    /*
     * NAMED, NOT COUNTED. A ceiling of one that did not say WHICH one would be satisfied by any
     * other list repeating itself the day this one was fixed.
     */
    const found = findConstantRowSentences(root);
    expect(found.map((f) => f.file)).toEqual(
      found.length === 0 ? [] : ["client/src/components/RecordDashboard.tsx"],
    );
  });
});

describe("what the predicate does and does not call a repetition", () => {
  const scan = (source: string) => constantSentencesInRows(source, "fixture.tsx");

  it("sees a constant sentence rendered once per row", () => {
    expect(
      scan(`{rules.map((rule) => (<li><small>הכלל עצמו מוסתר — הבדיקה היא על שליפה מהזיכרון</small></li>))}`),
    ).toHaveLength(1);
  });

  it("leaves a row that interpolates one of its own values alone", () => {
    /*
     * FOUR BUCKETS SAYING "the difference is smaller than N decisions can distinguish" are four
     * different true statements, and a scanner that could not tell those from a repetition would be
     * demanding the product delete facts to look tidier.
     */
    expect(
      scan(`{buckets.map((b) => (<span>ההפרש קטן ממה ש-{b.inside.n} החלטות יכולות להבחין בו כאן</span>))}`),
    ).toEqual([]);
  });

  it("ignores a label, which is not a sentence", () => {
    expect(scan(`{tabs.map((t) => (<span>סקירה</span>))}`)).toEqual([]);
    expect(MIN_SENTENCE).toBeGreaterThan(10);
  });

  it("does not read a comment as a rendering", () => {
    /*
     * THE FAILURE `GATE-CLAIM-ANCHOR` HIT ON ITS OWN DOCBLOCK. A note explaining why a row says
     * something is not the row saying it, and a gate that cannot tell them apart is one people
     * work around by not writing the note.
     */
    expect(
      scan(`{rows.map((r) => (<div>{/* <b>סתם הערה ארוכה בעברית שמסבירה משהו על השורה</b> */}{r.what}</div>))}`),
    ).toEqual([]);
  });

  it("ignores text outside any list", () => {
    expect(scan(`<p>הכלל עצמו מוסתר — הבדיקה היא על שליפה מהזיכרון של השחקן</p>`)).toEqual([]);
  });
});
