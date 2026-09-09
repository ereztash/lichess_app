/**
 * The words a stranger has to read before they can act, held to a ceiling that only comes down.
 *
 * THE RULE THIS HOLDS. A player's attention goes to the position or to the product, and every
 * sentence that explains the instrument is attention the position did not get. The owner's
 * standing instruction: the player plays, and learns something new when a need arises; the product
 * does not spend the player's resources on being learned. This file cannot see comprehension. What
 * it can see is the cost of each screen as text, and it refuses to let that cost grow back quietly
 * -- which is how it got where it was: every sentence was added for a reason, one at a time, and
 * the front door reached 187 words before a stranger had typed anything.
 *
 * WHAT IS MEASURED. `tests/layout/learning-cost.ts` walks the stranger's journey on the built app
 * -- front door, the handed-over position, the commitment, the reveal, the shared set's next
 * position -- and counts the visible words in `<main>` at each stage, board and move list excluded,
 * closed disclosures unread. The same walk deposits the full reading under
 * `docs/learning-cost/evidence/` via `npm run learning-cost`; this file holds only the ceilings.
 *
 * THE CEILINGS ARE THE READING AFTER THE PASS THAT CUT THEM, ROUNDED UP TO THE NEXT FIVE, and they
 * are ratchets in the same sense as `the-file-that-only-ever-grew`: a screen may say less, and
 * saying more is a decision somebody makes on purpose, in a diff that lowers nothing else. What the
 * numbers were before the pass is in `docs/learning-cost/README.md`, beside what was cut and why.
 * The readings that set them: front door 137, decide 97, commitment 107, reveal 199, the shared
 * set's commitment 172; before the act 63, 58, 68, 163, 131; a phone's first screen 44 and 151.
 *
 * NOT A GATE, deliberately. A gate is a source scan with a positive control; this is a walk of the
 * built app in a real browser, like the other layout tests, and a browser is what a word count on a
 * screen needs -- jsdom paints nothing and would count the hidden and the shown alike.
 */
import { existsSync } from "node:fs";
import type { Browser } from "@playwright/test";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { launchChromium } from "./browser";
import {
  dist,
  serveDist,
  STAGES,
  walkAsAStranger,
  type JourneyReading,
  type Stage,
} from "./learning-cost";

/** Visible words per stage, at the desktop viewport the other stranger walks use. */
const WORDS: Record<Stage, number> = {
  "front-door": 140,
  decide: 100,
  commitment: 110,
  reveal: 205,
  "anchor-commitment": 175,
};

/** Words in document order before the stage's one primary control. */
const BEFORE_THE_ACT: Record<Stage, number> = {
  "front-door": 65,
  decide: 60,
  commitment: 70,
  reveal: 165,
  "anchor-commitment": 135,
};

/**
 * On a phone, what is on screen before any scroll. The decide screen is where attention is the
 * measurement, and the reveal is the deliverable; these are the two a phone must not bury.
 */
const ABOVE_THE_FOLD_ON_A_PHONE: Partial<Record<Stage, number>> = {
  decide: 50,
  reveal: 155,
};

let browser: Browser;
let server: Server;
let origin: string;
let desktop: JourneyReading;
let phone: JourneyReading;

beforeAll(async () => {
  if (!existsSync(dist)) throw new Error(`no build at ${dist} -- run \`npm run build\``);
  browser = await launchChromium();
  ({ server, origin } = await serveDist());
  desktop = await walkAsAStranger(browser, origin, { width: 1440, height: 900 });
  phone = await walkAsAStranger(browser, origin, { width: 390, height: 844 });
}, 600_000);

afterAll(async () => {
  await browser?.close();
  server?.close();
});

describe("the words a stranger must read", () => {
  it.each(STAGES)("%s says no more than its ceiling", (stage) => {
    expect(
      desktop[stage].words,
      `${stage} grew past ${WORDS[stage]} words; lower the copy or raise the ceiling on purpose`,
    ).toBeLessThanOrEqual(WORDS[stage]);
  });

  it.each(STAGES)("%s puts no more than its ceiling before the one act", (stage) => {
    const before = desktop[stage].wordsBeforePrimary;
    expect(before, `${stage} rendered no primary control to measure against`).not.toBeNull();
    expect(before!).toBeLessThanOrEqual(BEFORE_THE_ACT[stage]);
  });

  it.each(Object.keys(ABOVE_THE_FOLD_ON_A_PHONE) as Stage[])(
    "%s keeps the first phone screen under its ceiling",
    (stage) => {
      expect(phone[stage].aboveTheFold).toBeLessThanOrEqual(ABOVE_THE_FOLD_ON_A_PHONE[stage]!);
    },
  );

  it("opens no disclosure for the reader on any stage", () => {
    /*
     * A closed disclosure is the product keeping an explanation where a need can find it. One that
     * arrives open is the product deciding the reader needs it now, on every visit.
     */
    for (const stage of STAGES) {
      expect(desktop[stage].openDisclosures, `${stage} opened a disclosure by default`).toBe(0);
    }
  });
});
