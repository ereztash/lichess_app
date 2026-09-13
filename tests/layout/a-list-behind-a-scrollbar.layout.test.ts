/**
 * THE STEP THAT HID ITS OWN OPTIONS.
 *
 * `.read-chip` says what the chip list refuses to do: *"no option is hidden behind a 'more'
 * control, and none is reworded to fit. Both would trade a real cost -- what a player is able to
 * say about a position, and what the record then holds -- for a visual one."*
 *
 * `.step-body` capped itself at `min(38vh, 290px)` twenty-four lines above that, for its own good
 * reason: *"Four steps that cannot be seen together are not a stepper."* Two rules, written for
 * different reasons, neither aware of the other. Measured on the built panel at 390x844 with the
 * second step open: the body's content is 357px against a 290px cap, so the last chip row and the
 * write toggle sat under a native scrollbar. The list was behind a "more" control after all, and a
 * worse one, because a scrollbar announces itself less than a button would.
 *
 * REPORTED FROM A PHONE FRAME, which is the only way it could have been. Every unit test of the
 * chips passed: they all render, they are all in the DOM, they all carry the tap floor. What was
 * wrong was a box, and a box has no truth table.
 *
 * WHY THIS TEST ASSERTS BOTH HALVES. Raising the cap for everyone fixed the phone and broke the
 * desktop -- at 1440x900 the panel is a 330px column beside the board, the same ten chips wrap
 * into 405px, and a raised cap pushed the fourth step header out of the window. So the fix is
 * scoped to the narrow layout and this file holds the pair: the phone's list does not scroll, and
 * the desktop still shows four headers together. Either one alone can be satisfied by breaking
 * the other.
 */
import { createReadStream, existsSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, resolve } from "node:path";
import type { Browser, Page } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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

/**
 * A bank position, because its purpose is in `ALWAYS`: the confidence question is put every time
 * and `readsAreAsked` follows it, so the read steps are there without waiting on a 0.15 draw.
 */
async function openTheReadStep(page: Page): Promise<void> {
  await page.goto(`${origin}/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /עמדה מהסט המשותף/ }).first().click();
  await page.waitForURL(/\/play$/, { timeout: 30_000 });
  await page.locator("[data-square]").first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(800);
  const squares = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-square]")]
      .filter((el) => el.querySelector(".piece"))
      .map((el) => el.getAttribute("data-square") as string),
  );
  for (const square of squares) {
    await page.locator(`[data-square="${square}"]`).click();
    await page.waitForTimeout(70);
    const target = await page.evaluate(
      () => document.querySelector(".legal-square")?.getAttribute("data-square") ?? null,
    );
    if (target) {
      await page.locator(`[data-square="${target}"]`).click();
      break;
    }
  }
  await page.waitForTimeout(700);
  await page.locator(".read-options").first().waitFor({ timeout: 15_000 });
}

/** What the open step's box does, and how much of the stepper survives it. */
const shape = (page: Page) =>
  page.evaluate(() => {
    const body = document.querySelector<HTMLElement>(".step-body:not([hidden])");
    const heads = [...document.querySelectorAll<HTMLElement>(".commitment-step .step-head")];
    return {
      client: body?.clientHeight ?? 0,
      scroll: body?.scrollHeight ?? 0,
      chips: document.querySelectorAll(".read-chip").length,
      headers: heads.length,
      headersInWindow: heads.filter((h) => {
        const r = h.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= window.innerHeight;
      }).length,
    };
  });

describe("a list behind a scrollbar", () => {
  it(
    "shows every option of the open read step on a phone, with nothing under a scrollbar",
    async () => {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      await openTheReadStep(page);
      const box = await shape(page);

      expect(box.chips, "the read step rendered no options at all").toBeGreaterThan(0);
      expect(
        box.scroll - box.client,
        `the open step clips ${box.scroll - box.client}px of its own option list`,
      ).toBe(0);

      await context.close();
    },
    240_000,
  );

  it(
    "still shows all four step headers together, which is what the cap is for",
    async () => {
      for (const viewport of [
        { width: 390, height: 844 },
        { width: 1440, height: 900 },
      ]) {
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        await openTheReadStep(page);
        const box = await shape(page);

        expect(
          box.headersInWindow,
          `at ${viewport.width}x${viewport.height} only ${box.headersInWindow} of ${box.headers} step headers are in the window`,
        ).toBe(box.headers);

        await context.close();
      }
    },
    360_000,
  );
});
