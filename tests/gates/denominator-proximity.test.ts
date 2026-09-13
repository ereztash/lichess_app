// @vitest-environment node
/**
 * A percentage is honest when the reader sees what it was computed over, and the gate had no way
 * to tell.
 *
 * WHAT THE GATE DID. `findDenominatorlessPercents` matched any hand-rolled percentage in a
 * render-path file and reported it. There was no notion of proximity, so the only compliant path
 * was `Value.tsx` -- and sentences that print a figure beside their own `n` were failing a check
 * that exists to require exactly that.
 *
 * AND THE FALSE POSITIVE AND THE FALSE NEGATIVE WERE ONE BUG. `RecordDashboard` renders
 * `אצלכם 62%, אצל כולם 58% — ההפרש קטן ממה ש-30 החלטות יכולות להבחין בו`. The denominator is in
 * the sentence. The gate was silent about it only because prettier happened to split `)}` from
 * `%` onto separate lines; indenting that block two spaces let prettier re-fit the expression and
 * the gate fired on a line nobody had touched. A verdict that depends on where the formatter broke
 * a line is not checking the thing it names.
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findDenominatorlessPercents } from "../../scripts/gate-scan";

const write = (name: string, body: string) => {
  const file = join(mkdtempSync(join(tmpdir(), "denom-")), name);
  writeFileSync(file, body, "utf8");
  return file;
};

describe("the denominator has to be near the percentage, not merely computed", () => {
  it("still refuses a percentage with nothing rendered beside it", () => {
    const file = write("Bare.tsx", `export const x = () => <span>{Math.round((a - b) * 100)}%</span>;\n`);
    expect(findDenominatorlessPercents([file])).toHaveLength(1);
  });

  it("refuses one whose denominator was divided by and never shown", () => {
    /*
     * THE DISTINCTION THE POSITIVE CONTROL TURNS ON. `(v / t) * 100` divides; it says nothing
     * about whether the reader is shown what it was divided by, and R1 is about the reader.
     */
    const file = write("Divided.tsx", `const rate = (v: number, t: number) => \`\${Math.round((v / t) * 100)}%\`;\n`);
    expect(findDenominatorlessPercents([file])).toHaveLength(1);
  });

  it("accepts one whose n is rendered in the same paragraph", () => {
    const file = write("WithN.tsx", `export const x = () => (\n  <span>\n    {Math.round((a - b) * 100)}% — ההפרש קטן ממה ש-{b.inside.n} החלטות יכולות להבחין בו\n  </span>\n);\n`);
    expect(findDenominatorlessPercents([file])).toHaveLength(0);
  });

  it("does not let a denominator two paragraphs away vouch for it", () => {
    /*
     * The window is the run between blank lines, which is where this codebase and its formatter
     * separate one rendered element from the next. A count in a different element is a count the
     * reader of this sentence does not see.
     */
    const file = write("FarAway.tsx", `export const x = () => (\n  <div>\n    <span>{Math.round((a - b) * 100)}%</span>\n\n    <span>n={total}</span>\n  </div>\n);\n`);
    expect(findDenominatorlessPercents([file])).toHaveLength(1);
  });

  it("is not decided by where the formatter broke the line", () => {
    // The same sentence, wrapped two ways. A gate whose answer changes here is checking the
    // formatter rather than the claim, which is what it was doing before this rule.
    const oneLine = write("OneLine.tsx", `export const x = () => (\n  <span>{Math.round((a - b) * 100)}% על {n.count} החלטות</span>\n);\n`);
    const wrapped = write("Wrapped.tsx", `export const x = () => (\n  <span>\n    {Math.round(\n      (a - b) * 100,\n    )}\n    % על {n.count} החלטות\n  </span>\n);\n`);
    expect(findDenominatorlessPercents([oneLine])).toHaveLength(0);
    expect(findDenominatorlessPercents([wrapped])).toHaveLength(0);
  });
});
