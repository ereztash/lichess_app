/**
 * Deposit a reading of the words a stranger has to read. `npm run learning-cost -- --label after`
 *
 * A SCRIPT, NOT A TEST. The test beside it (`tests/layout/the-words-a-stranger-must-read`) holds
 * ceilings and says nothing else; this writes the whole reading down, so a change to the copy can
 * be shown against the build before it rather than asserted. The two share one walk and one
 * definition of a word (`tests/layout/learning-cost.ts`), which is what makes the deposit and the
 * ceiling comparable.
 *
 * Needs a build: `npm run build` first. The engine is the shipped one, not intercepted.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launchChromium } from "../tests/layout/browser";

const here = fileURLToPath(new URL(".", import.meta.url));
import {
  serveDist,
  STAGES,
  VIEWPORTS,
  viewportKey,
  walkAsAStranger,
  type JourneyReading,
} from "../tests/layout/learning-cost";

const label = process.argv.includes("--label")
  ? process.argv[process.argv.indexOf("--label") + 1]
  : new Date().toISOString().slice(0, 10);

async function main(): Promise<void> {
  const browser = await launchChromium();
  const { server, origin } = await serveDist();
  try {
    const readings: Record<string, JourneyReading> = {};
    for (const viewport of VIEWPORTS) {
      readings[viewportKey(viewport)] = await walkAsAStranger(browser, origin, viewport);
    }
    const deposit = {
      label,
      measuredAt: new Date().toISOString(),
      /* One definition of the number, named so a reader of the JSON knows what was not counted. */
      counts: "visible words in <main>, the board and the move list excluded; a closed disclosure is not read",
      readings,
    };
    const dir = resolve(here, "../docs/learning-cost/evidence");
    mkdirSync(dir, { recursive: true });
    const file = resolve(dir, `${label}.json`);
    writeFileSync(file, `${JSON.stringify(deposit, null, 2)}\n`);

    for (const [viewport, journey] of Object.entries(readings)) {
      console.log(`\n=== ${viewport} ===`);
      console.log("stage".padEnd(20), "words".padStart(6), "sent.".padStart(6), "before".padStart(7), "longest".padStart(8), "fold".padStart(6), "open".padStart(5));
      for (const stage of STAGES) {
        const r = journey[stage];
        console.log(
          stage.padEnd(20),
          String(r.words).padStart(6),
          String(r.sentences).padStart(6),
          String(r.wordsBeforePrimary ?? "-").padStart(7),
          String(r.longestBlock).padStart(8),
          String(r.aboveTheFold).padStart(6),
          String(r.openDisclosures).padStart(5),
        );
      }
    }
    console.log(`\nwritten: ${file}`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
