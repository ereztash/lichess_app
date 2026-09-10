/**
 * A CONTACT SHEET OF THE PRODUCT, for a human eye. `npm run contact-sheet`
 *
 * WHY THIS EXISTS. Every instrument in this repository reads text. `tests/layout/learning-cost.ts`
 * opens with a selector that excludes `.board-assembly` and `.move-timeline`, which means the whole
 * measurement apparatus deletes the board -- the object that is most of the screen and all of the
 * reason anybody is here -- before it counts anything. Craft, contrast, square size under a thumb,
 * and what the screen does while the engine thinks are invisible to every number this repo holds.
 *
 * SO THIS PRODUCES NO NUMBER. It drives the same journey at a real phone's size and pixel density,
 * with touch on, and writes what a player would actually be looking at, including the three frames
 * of the wait between committing a decision and being judged for it. The judgement is a person's.
 *
 * Needs a build: `npm run build` first. The engine is the shipped one, not intercepted.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { launchChromium } from "../tests/layout/browser";
import { LICHESS_BODY, serveDist, USERNAME } from "../tests/layout/learning-cost";
import type { Page, Route } from "@playwright/test";

const OUT =
  process.argv.includes("--out")
    ? process.argv[process.argv.indexOf("--out") + 1]
    : resolve(process.cwd(), "ui-contact-sheet");

/** A phone, not a narrow desktop window: device pixel ratio and touch change layout and hit area. */
const PHONE = { width: 390, height: 844 };

const shots: { file: string; label: string }[] = [];

async function shoot(page: Page, name: string, label: string, fullPage = false): Promise<void> {
  const file = resolve(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage });
  shots.push({ file, label });
  console.log(`  ${name.padEnd(24)} ${label}`);
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const browser = await launchChromium();
  const { server, origin } = await serveDist();
  const context = await browser.newContext({
    viewport: PHONE,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.route("https://lichess.org/api/games/user/**", (route: Route) =>
    route.fulfill({ status: 200, contentType: "application/x-ndjson", body: LICHESS_BODY }),
  );

  try {
    await page.goto(`${origin}/`, { waitUntil: "networkidle" });
    await page.locator("#first-decision-username").waitFor({ timeout: 30_000 });
    await shoot(page, "01-front-door", "the front door, first screen");
    await shoot(page, "02-front-door-whole", "the front door, whole page", true);

    await page.locator("#first-decision-username").fill(USERNAME);
    await shoot(page, "03-front-door-typed", "a username typed, before the press");

    await page.getByRole("button", { name: "קחו אותי לעמדה" }).click();
    await page.waitForURL(/\/play$/, { timeout: 30_000 });
    await page.locator("[data-square]").first().waitFor({ timeout: 30_000 });
    await page.locator(".commitment-submit").waitFor({ timeout: 30_000 });
    await page.waitForTimeout(700);
    await shoot(page, "04-decide", "the position handed over, before a move");
    await shoot(page, "05-decide-whole", "the same screen, whole page", true);

    /* A move, pressed the way a thumb presses: a square, then a square. */
    const squares = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("[data-square]")]
        .filter((el) => el.querySelector(".piece.piece-w"))
        .map((el) => el.getAttribute("data-square") as string),
    );
    let placed = false;
    for (const square of squares) {
      await page.locator(`[data-square="${square}"]`).click();
      await page.waitForTimeout(120);
      const target = await page.evaluate(
        () => document.querySelector(".legal-square")?.getAttribute("data-square") ?? null,
      );
      if (!target) continue;
      await shoot(page, "06-piece-lifted", "a piece picked up, legal squares offered");
      await page.locator(`[data-square="${target}"]`).click();
      placed = true;
      break;
    }
    if (!placed) throw new Error("the handed-over position offered no move");
    await page.waitForTimeout(500);
    await shoot(page, "07-move-placed", "the move on the board, the commitment open");
    await shoot(page, "08-move-placed-whole", "the same screen, whole page", true);

    /* Answer the commitment the way a finger does. */
    for (let i = 0; i < 6; i += 1) {
      const chip = page.locator(".read-chip:visible").first();
      if (await chip.count()) await chip.click();
      const confidence = page.locator(".confidence-row button:visible").nth(2);
      if (await confidence.count()) {
        await shoot(page, "09-confidence-asked", "the confidence question, before answering");
        await confidence.click();
        break;
      }
      const next = page.locator(".step-next:visible").first();
      if (await next.count()) await next.click();
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(400);
    await shoot(page, "10-ready-to-commit", "every step answered, the record not yet taken");

    /*
     * THE WAIT. This is the window nothing in this repository has ever looked at: the decision is
     * recorded, the engine is thinking, and the player is waiting to be judged. Three frames.
     */
    await page.locator(".commitment-submit").click();
    await page.waitForTimeout(150);
    await shoot(page, "11-wait-150ms", "150ms after committing");
    await page.waitForTimeout(850);
    await shoot(page, "12-wait-1s", "one second after committing");
    await page.waitForTimeout(2000);
    await shoot(page, "13-wait-3s", "three seconds after committing");

    const probe = page.locator(".counterfactual-probe__none");
    if (await probe.count()) {
      await shoot(page, "14-probe", "the counterfactual probe, if it fired");
      await probe.click();
    }
    await page.locator(".reveal-panel, .reveal-failure").first().waitFor({ timeout: 180_000 });
    await page.waitForTimeout(900);
    await shoot(page, "15-reveal", "the reveal, first screen");
    await shoot(page, "16-reveal-whole", "the reveal, whole page", true);

    await page.locator('[data-primary-action="next-decision"]:visible').click();
    await page.waitForTimeout(1500);
    await page.locator("[data-square]").first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(700);
    await shoot(page, "17-next-position", "the shared set's next position");

    /*
     * THE FRONT DOOR ON THE WAY BACK, which the first run of this script discovered by failing:
     * the cold door's blitz button was not there any more. A player who has made one decision does
     * not meet the screen this product was designed around, and no walk in this repository had ever
     * come back to look.
     */
    await page.goto(`${origin}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    await shoot(page, "18-returning-front-door", "the front door after one decision");
    await shoot(page, "19-returning-front-door-whole", "the same, whole page", true);

    /* The other door, from a browser that has never been here. */
    const cold = await browser.newContext({
      viewport: PHONE,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const blitz = await cold.newPage();
    await blitz.goto(`${origin}/`, { waitUntil: "networkidle" });
    await blitz.getByRole("button", { name: "משחק בליץ קצר" }).click();
    await blitz.waitForURL(/\/blitz$/, { timeout: 30_000 });
    await blitz.locator(".blitz-control").first().waitFor({ timeout: 30_000 });
    await blitz.waitForTimeout(500);
    await shoot(blitz, "20-blitz-setup", "the blitz door: the question and the board it will be answered on");
    await blitz.locator(".blitz-control").first().click();
    await blitz.locator("[data-square]").first().waitFor({ timeout: 30_000 });
    await blitz.waitForTimeout(900);
    await shoot(blitz, "21-blitz-board", "the blitz board");

    /* One sheet, so the whole product can be judged in a glance rather than file by file. */
    const cells = shots
      .map(
        (s) =>
          `<figure><img src="file://${s.file}"><figcaption>${s.label}</figcaption></figure>`,
      )
      .join("\n");
    const sheetHtml = `<!doctype html><meta charset="utf-8"><style>
      body{margin:0;padding:28px;background:#111;font:13px/1.4 system-ui,sans-serif;color:#eee}
      h1{font-size:15px;font-weight:600;margin:0 0 20px;letter-spacing:.02em}
      .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:20px}
      figure{margin:0}
      img{width:100%;display:block;border:1px solid #333;background:#000}
      figcaption{margin-top:7px;color:#9a9a9a;font-size:11px}
    </style><h1>Decision Lab, 390×844, device pixel ratio 2, touch on</h1><div class="grid">${cells}</div>`;
    const sheetFile = resolve(OUT, "sheet.html");
    writeFileSync(sheetFile, sheetHtml);
    const sheetPage = await context.newPage();
    await sheetPage.setViewportSize({ width: 1800, height: 1200 });
    await sheetPage.goto(`file://${sheetFile}`, { waitUntil: "load" });
    await sheetPage.waitForTimeout(1200);
    await sheetPage.screenshot({ path: resolve(OUT, "00-sheet.png"), fullPage: true });
    console.log(`\n${shots.length} frames + sheet: ${OUT}`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
