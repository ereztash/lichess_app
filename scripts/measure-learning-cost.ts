/**
 * Deposit what the product costs a stranger. `npm run learning-cost -- --label after`
 *
 * A SCRIPT, NOT A TEST. The test beside it (`tests/layout/the-words-a-stranger-must-read`) holds
 * ceilings and says nothing else; this writes the whole reading down, so a change can be shown
 * against the build before it rather than asserted. The two share one walk and one definition
 * (`tests/layout/learning-cost.ts`), which is what makes the deposit and the ceiling comparable.
 *
 * IT PRICES, IT DOES NOT GRADE. There is no external benchmark this product can be scored against,
 * and inventing one would be the numeric confidence theater the repository forbids everywhere else.
 * What a price list can do is compare the product to itself across builds, on axes a machine can
 * read without a person: words to read, controls to choose between, presses, routes, seconds. What
 * it cannot see is whether any of it was understood. That belongs to `FIELD` and to Arm B of
 * `docs/VALUE_CLARITY_FIELD_PROTOCOL.md`.
 *
 * BOTH DOORS, because the front door offers two. A decision and a blitz game are reached from the
 * same screen and priced here in the same units, so the difference between them is a fact rather
 * than an impression.
 *
 * Needs a build: `npm run build` first. The engine is the shipped one, not intercepted.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launchChromium } from "../tests/layout/browser";

const here = fileURLToPath(new URL(".", import.meta.url));
import {
  BLITZ_STAGES,
  serveDist,
  STAGES,
  VIEWPORTS,
  viewportKey,
  walkAsAStranger,
  walkToABlitzGame,
  type BlitzJourneyReading,
  type JourneyReading,
  type StagePrice,
} from "../tests/layout/learning-cost";

const label = process.argv.includes("--label")
  ? process.argv[process.argv.indexOf("--label") + 1]
  : new Date().toISOString().slice(0, 10);

function row(name: string, r: StagePrice): string {
  return [
    name.padEnd(18),
    String(r.words).padStart(6),
    String(r.wordsBeforePrimary ?? "none").padStart(7),
    String(r.controls).padStart(9),
    String(r.taps).padStart(5),
    String(r.screens).padStart(8),
    String(r.seconds).padStart(6),
    (r.board ? "yes" : "no").padStart(6),
  ].join(" ");
}

function header(): string {
  return [
    "stage".padEnd(18),
    "words".padStart(6),
    "before".padStart(7),
    "controls".padStart(9),
    "taps".padStart(5),
    "screens".padStart(8),
    "secs".padStart(6),
    "board".padStart(6),
  ].join(" ");
}

async function main(): Promise<void> {
  const browser = await launchChromium();
  const { server, origin } = await serveDist();
  try {
    const readings: Record<string, JourneyReading> = {};
    const blitz: Record<string, BlitzJourneyReading> = {};
    for (const viewport of VIEWPORTS) {
      const key = viewportKey(viewport);
      readings[key] = await walkAsAStranger(browser, origin, viewport);
      blitz[key] = await walkToABlitzGame(browser, origin, viewport);
    }

    const deposit = {
      label,
      measuredAt: new Date().toISOString(),
      /* One definition of each number, named so a reader of the JSON knows what was not counted. */
      counts: {
        words: "visible words in <main>, the board and the move list excluded; a closed disclosure is not read",
        before: "words in document order ahead of the stage's one primary control; `none` where the stage declares no primary act",
        controls: "visible pressable elements in <main>, the board and the move list excluded",
        taps: "presses so far in this walk, a move counting as its two",
        screens: "distinct routes reached so far",
        secs: "seconds from the front door's first paint",
        board: "whether a board is painted on this stage",
      },
      readings,
      blitz,
    };
    const dir = resolve(here, "../docs/learning-cost/evidence");
    mkdirSync(dir, { recursive: true });
    const file = resolve(dir, `${label}.json`);
    writeFileSync(file, `${JSON.stringify(deposit, null, 2)}\n`);

    for (const viewport of Object.keys(readings)) {
      console.log(`\n=== ${viewport} · the decision door ===`);
      console.log(header());
      for (const stage of STAGES) console.log(row(stage, readings[viewport][stage]));

      console.log(`\n=== ${viewport} · the blitz door ===`);
      console.log(header());
      for (const stage of BLITZ_STAGES) console.log(row(stage, blitz[viewport][stage]));

      const reveal = readings[viewport].reveal;
      const board = blitz[viewport]["blitz-board"];
      console.log(
        `\nprice of the first reveal: ${reveal.taps} taps, ${reveal.screens} screens, ${reveal.seconds}s`,
      );
      console.log(
        `price of a blitz board:    ${board.taps} taps, ${board.screens} screens, ${board.seconds}s`,
      );
      const gates = BLITZ_STAGES.filter((s) => s !== "front-door" && !blitz[viewport][s].board);
      if (gates.length) {
        const named = gates
          .map((s) => `${s} (${blitz[viewport][s].words}w, ${blitz[viewport][s].controls} controls)`)
          .join(", ");
        console.log(`screens between asking for a blitz game and seeing a board: ${named}`);
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
