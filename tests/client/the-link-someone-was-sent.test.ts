/**
 * Stage zero of the acquisition path: the link, before anybody has opened it.
 *
 * WHAT WAS MISSING, AND WHY IT COUNTS AS A FUNNEL STAGE. `client/index.html` carried a title, a
 * description and nothing else -- no Open Graph, no Twitter card, no image. A link pasted into a
 * DM, a group or a post therefore rendered as a bare URL on most surfaces, and on the rest as a
 * line of text with no picture. For a trial whose entry vector is a message containing a link,
 * that unfurl IS the first screen, and it was empty.
 *
 * THE SECOND DEFECT WAS WORSE THAN THE FIRST. The description promised "אתם מחליטים וכותבים את
 * הקריאה שלכם" -- and the two read fields stopped being asked on every decision when the ask rule
 * became a sample. So the one piece of acquisition copy that existed described a protocol the
 * build no longer runs, which is the failure mode the whole acquisition experiment is meant to be
 * able to detect: the promise and the product drifting apart.
 *
 * WHAT THIS FILE IS NOT. It does not check that the card looks good. It checks that the card
 * exists, that it is the size every unfurl expects, and -- the part that matters -- that its
 * words claim no more than the instrument can deliver.
 */
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../..");
const html = readFileSync(resolve(root, "client/index.html"), "utf8");
const CARD = resolve(root, "client/public/share-card.png");

/** `content` of one meta tag, by either `property` or `name`. */
function meta(key: string): string | null {
  const pattern = new RegExp(
    `<meta[^>]*(?:property|name)=["']${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`,
    "i",
  );
  const tag = html.match(pattern)?.[0];
  if (!tag) return null;
  return tag.match(/content=["']([\s\S]*?)["']/i)?.[1]?.replace(/\s+/g, " ").trim() ?? null;
}

describe("a link to this product unfurls into something", () => {
  it("carries the tags every surface reads, not just a title", () => {
    for (const key of [
      "og:type",
      "og:title",
      "og:description",
      "og:image",
      "og:image:width",
      "og:image:height",
      "og:image:alt",
      "twitter:card",
      "twitter:title",
      "twitter:description",
      "twitter:image",
    ]) {
      expect(meta(key), `${key} is missing; the unfurl falls back to a bare URL`).toBeTruthy();
    }
    expect(meta("twitter:card")).toBe("summary_large_image");
  });

  it("ships the image the tags point at, at the size the tags declare", () => {
    /*
     * The file, not a URL that resolves at runtime. A card referenced and not shipped is worse
     * than no card: the crawler asks once, gets a 404, caches the miss, and the link renders bare
     * for as long as that cache lives.
     */
    const src = meta("og:image");
    expect(src).toBe("/share-card.png");
    expect(() => statSync(CARD), "og:image points at a file that is not in the build").not.toThrow();

    // PNG header: width and height are big-endian 32-bit at byte 16 and 20 of the IHDR chunk.
    const bytes = readFileSync(CARD);
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    expect([width, height], "the declared dimensions and the file disagree").toEqual([1200, 630]);
    expect(Number(meta("og:image:width"))).toBe(width);
    expect(Number(meta("og:image:height"))).toBe(height);
  });
});

describe("the acquisition copy claims only what the instrument can do", () => {
  const shareText = [
    meta("description"),
    meta("og:title"),
    meta("og:description"),
    meta("og:image:alt"),
    meta("twitter:description"),
  ].join(" ");

  it("no longer promises a step the build asks for on a minority of decisions", () => {
    /*
     * "כותבים את הקריאה שלכם" was true when the two read fields were required on every decision.
     * They are now asked on the same decisions the confidence question is, which on ordinary play
     * is a sample. What survived unchanged is the ORDERING -- commit, then engine -- and that is
     * what the copy is allowed to lead with.
     */
    expect(shareText, "the share copy still promises the read fields").not.toMatch(
      /כותבים את הקריאה|תכתבו את הקריאה/,
    );
    expect(shareText).toMatch(/ורק אז המנוע/);
  });

  it("promises a distinction rather than a diagnosis", () => {
    /*
     * THE VALIDITY RULE FOR THE WHOLE TRIAL. `chose-past-it` is the finding no other tool can
     * make and it fires only when the engine's move was actually among the ones placed on the
     * board. Acquisition copy that promises it -- "we will show you the move you saw and rejected"
     * -- brings every arrival an expectation the instrument cannot guarantee, and then no
     * continuation measurement means anything: everyone who did not get that branch was
     * disappointed by the copy rather than by the product.
     *
     * A promise about the player's MIND is out for the same reason it is out of the reveal: the
     * record holds moves placed on a board, not what anyone saw.
     */
    expect(shareText, "the card promises a reveal branch that may never fire").not.toMatch(
      /ראית|ראיתם|שקלת|שקלתם|פספסת|פספסתם|נראה לך שידעת/,
    );
    expect(shareText, "the card promises a diagnosis").not.toMatch(/נגלה לך|נראה לך בדיוק|נאבחן/);
  });

  it("says the differentiator, so the unfurl is not interchangeable with any engine", () => {
    // The front door's own sentence. If the two ever disagree, the page is right and this is stale.
    const front = readFileSync(resolve(root, "client/src/pages/Record.tsx"), "utf8");
    expect(front).toContain("מודד מתי לא ידעתם שאתם לא יודעים");
    expect(shareText).toContain("מודד מתי לא ידעתם שאתם לא יודעים");
  });
});
