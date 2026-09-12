/**
 * THE WALK THAT FOUND `-1` MEANING TWO THINGS.
 *
 * A game against the engine, under the reveal timing the product defaults to, used to stop after
 * one decision. The reveal offered no continuation, the board refused every move, and the only
 * ways on were a position from the shared bank -- a different game -- and the record. Measured
 * twice in Chromium on the built bundle at `4b322f2`, once from the board the app opens on and
 * once from a game started deliberately through `משחק חדש`.
 *
 * WHY IT MATTERED MORE THAN A MISSING BUTTON, and why the assertion at the end is about the
 * record rather than about the screen. `decisionPurposeFor` returns `play` for a live decision
 * that is not the game's first, and `play` is the ONLY purpose `shared/evidence-policy.ts` admits
 * into `discovery`. A live game that cannot reach its second decision therefore cannot produce a
 * single row the search counts, and the record page's `0 מתוך 60` could not move by that route.
 *
 * WHY A BROWSER. The defect was a sentinel collision between a state and a ply, and every unit
 * test of the pieces passed while it shipped: the function was right about the arguments it was
 * given, and the caller was right about the arguments it had. What was wrong was a number's
 * meaning, which only shows up when a person presses the button and nothing happens.
 * `tests/client/a-ply-that-was-also-a-state.test.ts` holds the truth table; this holds the press.
 *
 * IT DOES NOT INTERCEPT THE ENGINE. Both the opponent's reply and the reveal come from the shipped
 * Stockfish wasm in a real Worker.
 */
import { createReadStream, existsSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, resolve } from "node:path";
import type { Browser, Page } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CONTINUATION_CTA } from "@shared/reveal";
import { launchChromium } from "./browser";

const dist = resolve(__dirname, "../../dist/public");

const TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".wasm": "application/wasm",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function serve(): Promise<{ server: Server; origin: string }> {
  return new Promise((done) => {
    const server = createServer((req, res) => {
      const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
      if (url.startsWith("/api")) {
        res.writeHead(503, { "content-type": "text/plain" }).end("no server here");
        return;
      }
      let path = join(dist, url);
      if (!extname(path) || !existsSync(path)) path = join(dist, "index.html");
      res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
      createReadStream(path).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => {
      const a = server.address();
      done({ server, origin: `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}` });
    });
  });
}

let browser: Browser;
let server: Server;
let origin: string;

beforeAll(async () => {
  if (!existsSync(dist)) throw new Error(`no build at ${dist} -- run \`npm run build\``);
  browser = await launchChromium();
  ({ server, origin } = await serve());
}, 180_000);

afterAll(async () => {
  await browser?.close();
  server?.close();
});

/** Press one piece of a colour and, if the board offers a target, press it. Null means refused. */
async function tryToMove(page: Page, colour: "w" | "b") {
  const squares = await page.evaluate(
    (c) =>
      [...document.querySelectorAll<HTMLElement>("[data-square]")]
        .filter((el) => el.querySelector(`.piece.piece-${c}`))
        .map((el) => el.getAttribute("data-square") as string),
    colour,
  );
  for (const square of squares) {
    await page.locator(`[data-square="${square}"]`).click();
    await page.waitForTimeout(90);
    const target = await page.evaluate(
      () => document.querySelector(".legal-square")?.getAttribute("data-square") ?? null,
    );
    if (!target) continue;
    await page.locator(`[data-square="${target}"]`).click();
    await page.waitForTimeout(300);
    return { from: square, to: target };
  }
  return null;
}

/** Answer every step of the commitment the way a finger does. */
async function answerTheCommitment(page: Page): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    const chip = page.locator(".read-chip:visible").first();
    if (await chip.count()) await chip.click();
    const confidence = page.locator(".confidence-row button:visible").nth(2);
    if (await confidence.count()) {
      await confidence.click();
      break;
    }
    const next = page.locator(".step-next:visible").first();
    if (await next.count()) await next.click();
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(300);
}

async function commitAndWaitForReveal(page: Page): Promise<void> {
  await answerTheCommitment(page);
  await page.locator(".commitment-submit").click();
  await page
    .locator(".counterfactual-probe, .reveal-panel, .reveal-failure, .reveal-waiting")
    .first()
    .waitFor({ timeout: 30_000 });
  const none = page.locator(".counterfactual-probe__none");
  if (await none.count()) await none.click();
  await page.locator(".reveal-panel, .reveal-failure").first().waitFor({ timeout: 180_000 });
  await page.waitForTimeout(600);
}

/** The purposes the shipped bundle stamped on the rows it wrote, in order. */
const purposes = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      const raw = localStorage.getItem(key);
      if (!raw || !raw.includes('"decisions"')) continue;
      try {
        const parsed = JSON.parse(raw) as { decisions?: { purpose?: string }[] };
        return (parsed.decisions ?? []).map((d) => d.purpose ?? "");
      } catch {
        return [];
      }
    }
    return [];
  });

describe("a live game that can reach its second decision", () => {
  it(
    "offers the continuation on the opening reveal and records the next decision as free play",
    async () => {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      await page.goto(`${origin}/play`, { waitUntil: "networkidle" });
      await page.locator("[data-square]").first().waitFor({ timeout: 30_000 });
      await page.waitForTimeout(600);

      expect(
        await tryToMove(page, "w"),
        "the board offered no move while the opening decision was open",
      ).not.toBeNull();
      await commitAndWaitForReveal(page);

      /*
       * THE REGRESSION, AT THE PLACE IT WAS MEASURED. This used to be the bank's `לעמדה הבאה`,
       * which is a position in a different game: the way on existed and the game did not survive
       * taking it.
       */
      const wayOn = page.locator(`button:has-text("${CONTINUATION_CTA}"):visible`);
      expect(
        await wayOn.count(),
        "the opening reveal of a live game offered no way to continue that game",
      ).toBeGreaterThan(0);

      await wayOn.first().click();
      await page.waitForTimeout(1500);
      await page.locator(".commitment-submit").waitFor({ timeout: 30_000 });

      /*
       * AND THE POSITION LANDED ON IS THE PLAYER'S OWN TURN, which is the `c1d72935c038` defect
       * this continuation must not reintroduce: the committed move is played and the OPPONENT
       * answers, so the board comes back asking white for a move rather than asking the player to
       * decide for black.
       */
      let second: { from: string; to: string } | null = null;
      for (let wait = 0; wait < 20 && second === null; wait += 1) {
        second = await tryToMove(page, "w");
        if (second === null) await page.waitForTimeout(1000);
      }
      expect(second, "the continued live game never came back to the player's own turn").not.toBeNull();

      await commitAndWaitForReveal(page);

      /*
       * THE REASON THE BUTTON MATTERS. `play` is the only purpose `discovery` admits, and it is
       * reachable only from a live decision that is not the game's first.
       */
      expect(
        await purposes(page),
        "a second live decision was taken and nothing in the record was free play",
      ).toContain("play");

      await context.close();
    },
    900_000,
  );
});
