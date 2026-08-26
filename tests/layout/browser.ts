/**
 * A real layout engine for the tests that need one, and a loud failure when there isn't one.
 *
 * WHY THESE TESTS EXIST AT ALL. jsdom has no layout: every box it reports is 0x0. A component can
 * render as a column one glyph wide, twenty-three lines tall, and every jsdom assertion about it
 * passes. That is not hypothetical -- it is how `.bucket-scope` shipped collapsed past 1,012
 * green tests, and how a calibration gap of −30% shipped rendering as `30%-`.
 *
 * WHY IT THROWS RATHER THAN SKIPS. This repository has already been bitten by the other choice:
 * five database tests skipped silently on every run for months, and `DrizzleRecordStore` had
 * never executed a statement while its suite reported green. A test that passes because it did
 * not run is the exact failure the product is about. So a missing browser is an error naming its
 * own fix, not a quiet -1 in the count.
 */
import { existsSync } from "node:fs";
import { chromium, type Browser } from "@playwright/test";

/**
 * Where a usable Chromium might be, in the order worth trying.
 *
 * The pinned container build comes before Playwright's own download because the two version
 * numbers drift independently: `@playwright/test` asks for a build the image does not carry, and
 * launching without a path fails with a "run npx playwright install" message that is wrong advice
 * in an image that ships the browser already.
 *
 * PLAYWRIGHT_CHROMIUM REPLACES THE LIST, it does not join it. It was one candidate among several
 * at first, which meant pointing it at a path that does not exist silently ran a DIFFERENT
 * browser -- the opposite of what an override is for, and it hid the throw path from its own
 * test. An override that can be ignored is not an override.
 */
const OVERRIDE = process.env.PLAYWRIGHT_CHROMIUM;
const CANDIDATES = OVERRIDE ? [OVERRIDE] : ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome"];

export async function launchChromium(): Promise<Browser> {
  for (const executablePath of CANDIDATES) {
    if (existsSync(executablePath)) return chromium.launch({ executablePath });
  }
  try {
    // Playwright's own resolution, which is the path CI takes after `playwright install`.
    return await chromium.launch();
  } catch (cause) {
    throw new Error(
      "No Chromium available for the layout tests. These measure real boxes and cannot fall back " +
        "to jsdom, which reports every box as 0x0. Install one with `npx playwright install " +
        "chromium`, or point PLAYWRIGHT_CHROMIUM at an existing binary.",
      { cause },
    );
  }
}
