// @vitest-environment jsdom
/**
 * The screen's primary heading, and why this is a class rather than a rule on `h1`.
 *
 * THE OWNER'S LICENCE WAS NARROW: "primary screen heading only → 600; do not globally change
 * h1/h2/h3." Measured on the built app before anything was written, that turns out not to be a
 * statement about tags at all:
 *
 *     /      front door   h1  28px  "מה קרה בהחלטה, לפני שהמנוע דיבר"   <- the primary heading
 *     /play  decide       h2  22px  "מה העמדה הזו דורשת?"                <- the primary heading
 *     /play  either       h1  16px  "11. O-O-O"                          <- a move label
 *     /play  decide       h3  16px  ".step-heading" x4
 *
 * On the deciding screen the `h1` is `11. O-O-O` in `.workspace-meta`, at 16px, smaller than the
 * `h2` above it and equal to four `h3`s below it. A rule on the tag would have put weight 600 on a
 * move label and left both real headings at 400 -- the opposite of what the licence was for. So
 * the weight goes on a class, applied to exactly two named elements.
 *
 * THE REVEAL GETS NOTHING, AND THAT IS THE FINDING. That screen has no primary heading: three
 * `h2`s tied at 18px, one per block. Promoting one inverts the order `RevealPanel`'s docblock
 * calls not negotiable -- the limits block is first, always. Promoting all three is restyling `h2`
 * globally, which the licence excludes. Recorded rather than resolved by taste.
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const css = readFileSync(resolve(root, "client/src/index.css"), "utf8");
const sources = readdirSync(resolve(root, "client/src"), { recursive: true, encoding: "utf8" })
  .filter((name) => /\.tsx?$/.test(name))
  .map((name) => [name, readFileSync(resolve(root, "client/src", name), "utf8")] as const);

/** Rules only: a mention inside a comment is not a selector. */
const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");

describe("the weight goes on one element per screen, by name", () => {
  it("defines the class, at a weight the stylesheet already uses", () => {
    expect(rules, "the class is not defined").toMatch(/\.screen-heading\s*\{[^}]*font-weight:\s*600/);
    /*
     * NOT A NEW VALUE IN THE SYSTEM. `systemInventory` counts weights across the built app and the
     * product already paints 600 in thirty places; a heading at 650 or 700 would be one more value
     * for a screen to be inconsistent in.
     */
    expect(rules.match(/font-weight:\s*600/g)?.length ?? 0).toBeGreaterThan(5);
  });

  it("is worn by exactly two elements in the product", () => {
    const wearers = sources
      .filter(([, text]) => /className="screen-heading"/.test(text))
      .map(([name]) => name)
      .sort();
    expect(wearers, "the class spread beyond the two screens it was licensed for").toEqual([
      "components/CommitmentScreen.tsx",
      "pages/Record.tsx",
    ]);
    for (const [, text] of sources) {
      expect((text.match(/className="screen-heading"/g) ?? []).length).toBeLessThanOrEqual(1);
    }
  });

  it("is worn by the heading each screen is actually about", () => {
    const record = sources.find(([n]) => n === "pages/Record.tsx")![1];
    const commit = sources.find(([n]) => n === "components/CommitmentScreen.tsx")![1];
    expect(record).toContain('<h1 className="screen-heading">מה קרה בהחלטה, לפני שהמנוע דיבר</h1>');
    expect(commit).toContain('<h2 className="screen-heading">מה העמדה הזו דורשת?</h2>');
  });

  /*
   * THE POSITIVE CONTROL FOR THE WHOLE CHANGE. Without it, "the primary heading is 600" is
   * satisfied just as well by a stylesheet that bolds every heading -- which is the one thing the
   * licence ruled out, and the reason the measurement above was taken at all.
   */
  it("leaves h1, h2 and h3 unstyled as tags, so nothing was made bold globally", () => {
    for (const selector of [/(^|\})\s*h1\s*[,{]/, /(^|\})\s*h2\s*[,{]/, /(^|\})\s*h3\s*[,{]/]) {
      expect(rules, `a bare tag rule appeared: ${selector}`).not.toMatch(selector);
    }
  });

  /*
   * AND THE MOVE LABEL IS THE ELEMENT THIS TEST EXISTS TO PROTECT. It is an `h1`; if a later
   * change reaches for the tag instead of the class, this is what goes bold.
   */
  it("does not put the weight on the move label, which is the h1 on the deciding screen", () => {
    const home = sources.find(([n]) => n === "pages/Home.tsx")![1];
    const label = home.slice(home.indexOf("workspace-meta"), home.indexOf("workspace-meta") + 900);
    expect(label, "the move label was given the screen-heading class").not.toContain("screen-heading");
  });

  it("gives the reveal no primary heading, which is a finding and not an omission", () => {
    const reveal = readFileSync(resolve(root, "client/src/components/RevealPanel.tsx"), "utf8");
    expect(reveal, "a reveal block was promoted above the limits block").not.toContain(
      "screen-heading",
    );
  });
});

describe("the disclosure names what is behind it", () => {
  const home = sources.find(([n]) => n === "pages/Home.tsx")![1];
  /* Comments stripped: the note explaining the rename is not a second label. */
  const rendered = home.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

  it("says the record, not the act of looking", () => {
    expect(rendered, "the control opens the record dashboard and does not say so").toMatch(/רשומה/);
    expect(rendered, "the label that named no record is back").not.toContain("מה עוד יש כאן");
  });

  /*
   * POSITIVE CONTROL: the control still exists and still toggles. A rename that deleted the
   * disclosure would pass the assertion above and lose the full record, which the owner's licence
   * says to keep behind exactly this control.
   */
  it("still toggles, and the record is still behind it", () => {
    expect(rendered).toContain("explore-toggle");
    expect(rendered).toContain("חזרה לתוצאה");
    expect(rendered, "the record dashboard is no longer what opens").toContain("RecordExplorer");
  });
});
