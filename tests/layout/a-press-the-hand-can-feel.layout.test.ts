/**
 * DOES ANY CONTROL IN THIS PRODUCT ANSWER A PRESS?
 *
 * THE OWNER'S SIGNAL WAS "הכפתורים לפעמים לא מרגישים מגיבים", and the measurement that followed it
 * is the reason this file exists rather than a stylesheet tweak. Five control classes were held
 * down in Chromium on the built app and every computed visual property compared at rest, at hover,
 * and while the mouse was down:
 *
 *   .ghost-control      the front door entry that needs no account   hover: none   press: NONE
 *   .read-chip          a reading chip, synchronous, stays mounted   hover: bg     press: NONE
 *   .commitment-submit  the commit                                   hover: none   press: NONE
 *   .step-head          a commitment step                            hover: none   press: NONE
 *
 * Not one of them changed. The whole stylesheet carried two `:active` rules in 90 kB, and the one
 * control that answered hover answers nothing on the handset, where hover does not exist.
 *
 * WHY THAT IS NOT A LATENCY PROBLEM, and why this test is not about speed. A reading chip resolves
 * in one frame and felt exactly as dead as the commit, which does take three seconds. Those are
 * two defects and they need two fixes; this file holds the first, and the wait's own case below
 * holds the second.
 *
 * A SOURCE-LEVEL ASSERTION WOULD NOT HAVE CAUGHT IT. `:active` existed in the file. What did not
 * exist was `:active` on anything in the decision loop, and the only way to know which is to press
 * the control the loop actually runs through and read what the browser computed.
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

/** Every visual property a press could plausibly move, read from the browser rather than the file. */
const LOOK = `(el) => {
  const c = getComputedStyle(el);
  return { transform: c.transform, boxShadow: c.boxShadow, background: c.backgroundColor,
           color: c.color, border: c.borderColor, opacity: c.opacity, filter: c.filter };
}`;

/**
 * Hold the control down and report which properties moved.
 *
 * THE MOUSE IS HELD RATHER THAN CLICKED, because a click resolves in one frame and the pressed
 * state is gone before anything can read it -- which is exactly why this defect survived every
 * suite in the repository until somebody held a button down and looked.
 */
async function pressChanges(page: Page, selector: string): Promise<string[]> {
  const el = await page.$(selector);
  if (!el) throw new Error(`no control matched ${selector}`);
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(60);
  const box = await el.boundingBox();
  if (!box) throw new Error(`${selector} has no box`);
  const read = () => page.$eval(selector, eval(`(${LOOK})`) as never) as Promise<Record<string, string>>;
  /*
   * AIMED ABOVE CENTRE, AND THE TARGET IS VERIFIED.
   *
   * `.commitment-submit` is `position: sticky` and sits over the step heads at exactly the
   * coordinate a centre-aimed press lands on. The first run of this file reported the step head
   * as unchanged; it had never been pressed. A wrong target that reads as a negative result is
   * worse than a failure, so the press asserts it actually landed on the element it named.
   */
  await page.mouse.move(box.x + box.width / 2, box.y + Math.min(10, box.height / 3));
  await page.waitForTimeout(90);
  const before = await read();
  await page.mouse.down();
  await page.waitForTimeout(120);
  const landed = await page.$eval(selector, (e) => e.matches(":active"));
  if (!landed) {
    const hit = await page.evaluate(() => {
      const over = document.querySelectorAll(":hover");
      return over.length ? (over[over.length - 1] as HTMLElement).outerHTML.slice(0, 100) : "nothing";
    });
    await page.mouse.up();
    throw new Error(`the press aimed at ${selector} landed on: ${hit}`);
  }
  const during = await read();
  await page.mouse.up();
  return Object.keys(before).filter((k) => before[k] !== during[k]);
}

/** Mark one control so it can be addressed by selector without depending on DOM order. */
const mark = (page: Page, pattern: string, name: string) =>
  page.evaluate(
    ({ pattern, name }) => {
      const found = [...document.querySelectorAll("button")].find(
        (b) => b.offsetParent !== null && new RegExp(pattern).test(b.innerText.replace(/\s+/g, " ")),
      );
      if (!found) return null;
      found.setAttribute("data-press-probe", name);
      return `[data-press-probe="${name}"]`;
    },
    { pattern, name },
  );

/** One complete decision on whatever position is on the board, as a person performs it. */
async function decide(page: Page): Promise<void> {
  const squares: string[] = await page.evaluate(() =>
    [...document.querySelectorAll("[data-square]")].map((e) => e.getAttribute("data-square") as string),
  );
  let placed = false;
  for (const from of squares) {
    await page.locator(`[data-square="${from}"]`).click();
    await page.waitForTimeout(50);
    const targets: string[] = await page.evaluate(() =>
      [...document.querySelectorAll("[data-square]")]
        .filter((e) => /hint|target|legal|dest|move-option/i.test(e.className.toString()))
        .map((e) => e.getAttribute("data-square") as string),
    );
    if (targets.length > 0) {
      await page.locator(`[data-square="${targets[0]}"]`).click();
      await page.waitForTimeout(350);
      placed = true;
      break;
    }
  }
  if (!placed) throw new Error("no legal move was offered on this position");
  const pick = async (pattern: string) => {
    const handle = await page.evaluateHandle(
      (p) =>
        [...document.querySelectorAll("button")].find(
          (b) => b.offsetParent !== null && new RegExp(p).test(b.innerText.replace(/\s+/g, " ")),
        ) ?? null,
      pattern,
    );
    const element = handle.asElement();
    if (!element) throw new Error(`no control matched ${pattern}`);
    await element.click();
  };
  await pick("יתרון מרחב|המרכז|מלך חשוף|פער בפיתוח");
  await page.waitForTimeout(220);
  await page.getByRole("button", { name: "הבא", exact: true }).click();
  await page.waitForTimeout(430);
  await pick("^לא ");
  await page.waitForTimeout(220);
  await page.getByRole("button", { name: "הבא", exact: true }).click();
  await page.waitForTimeout(530);
  const confidence = await page.evaluateHandle(
    () =>
      [...document.querySelectorAll("button")].find(
        (b) => b.offsetParent !== null && b.getBoundingClientRect().width < 90 && /^4\s/.test(b.innerText.trim()),
      ) ?? null,
  );
  const level = confidence.asElement();
  if (!level) throw new Error("no confidence level offered");
  await level.click();
  await page.waitForTimeout(350);
  await page.locator(".commitment-submit").click();
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

describe("a press the hand can feel", () => {
  it(
    "answers a press on every control the decision loop runs through",
    async () => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "he-IL" });
      const page = await context.newPage();
      try {
        await page.goto(`${origin}/`, { waitUntil: "networkidle", timeout: 60_000 });
        await page.waitForTimeout(900);

        const door = await mark(page, "עמדה מהסט המשותף", "door");
        expect(door, "the front door's no-account entry").not.toBeNull();
        expect(
          await pressChanges(page, door as string),
          "the front door entry did not change while it was held down",
        ).not.toEqual([]);

        /* `pressChanges` completes a click, so the app has already moved on. */
        await page.locator('[data-square="e4"]').waitFor({ timeout: 60_000 });
        await page.waitForTimeout(1200);

        /*
         * A READING CHIP DOES NOT EXIST UNTIL A MOVE IS ON THE BOARD. Step 2 opens when step 1 is
         * satisfied, which is the panel's own rule; a test that looked for a chip on arrival would
         * be asserting about a control the product has not offered yet.
         */
        await page.locator('[data-square="b5"]').click();
        await page.waitForTimeout(200);
        await page.locator('[data-square="b4"]').click();
        await page.waitForTimeout(500);

        const chip = await mark(page, "יתרון מרחב|המרכז סגור", "chip");
        expect(chip, "a reading chip").not.toBeNull();
        expect(
          await pressChanges(page, chip as string),
          "a reading chip did not change while it was held down",
        ).not.toEqual([]);

        const step = await mark(page, "כמה אתם בטוחים", "step");
        expect(step, "a commitment step head").not.toBeNull();
        expect(
          await pressChanges(page, step as string),
          "a commitment step did not change while it was held down",
        ).not.toEqual([]);

        expect(
          await pressChanges(page, ".commitment-submit"),
          "the commit did not change while it was held down",
        ).not.toEqual([]);
      } finally {
        await context.close();
      }
    },
    300_000,
  );

  it(
    "says it is working during the wait it actually has",
    async () => {
      /*
       * MEASURED ON THE COMMIT PRESS, sampled at 50 ms on the built app: the panel is gone at
       * +61 ms and the engine's sentence arrives at +3293 ms. Across that whole interval,
       * `aria-busy` was on zero elements, spinners were zero, and `animationName !== "none"` was
       * true of ZERO elements on the page. Nothing moved for three seconds after the most
       * consequential press in the product, and the one sentence that did report something was
       * rendered at `opacity: 0.75`.
       *
       * THIS ASSERTS THE ANSWER, NOT THE WAIT. The engine's duration, the text, when the reveal
       * renders and every recorded event are untouched and must stay so. What is held here is
       * that while the product is working it says so, in a way a screen reader and an eye can
       * both reach.
       */
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "he-IL" });
      const page = await context.newPage();
      try {
        await page.goto(`${origin}/`, { waitUntil: "networkidle", timeout: 60_000 });
        await page.waitForTimeout(900);
        await page.getByRole("button", { name: "עמדה מהסט המשותף" }).click();
        await page.locator('[data-square="e4"]').waitFor({ timeout: 60_000 });
        await page.waitForTimeout(1200);
        await decide(page);

        /*
         * THE WAIT DOES NOT HAPPEN ON EVERY DECISION, AND THAT IS WHY THIS LOOPS.
         *
         * The engine answered in 2,185 ms on a cold start and 333 ms warm, and by the third case
         * in this file the wasm is compiled and the reveal can arrive inside one 50 ms sample. A
         * first draft of this case polled once per 50 ms after a single commit and failed on the
         * restored tree while passing under three of its own deliberate breaks -- a test that was
         * measuring the runner's cache, not the product.
         *
         * So it polls at 10 ms and takes up to three decisions through the continuation. If the
         * wait never renders across all three, that is reported as a failure to REACH the state
         * rather than passed over: a case that quietly succeeds when the thing it checks did not
         * occur is the failure this repository already shipped once.
         */
        let seen: { busy: number; animating: number } | null = null;
        const trace: string[] = [];
        for (let attempt = 0; attempt < 3 && seen === null; attempt += 1) {
          if (attempt > 0) {
            const next = page.getByRole("button", { name: "לעמדה הבאה" });
            if ((await next.count()) === 0) break;
            await next.click();
            await page.waitForFunction(() => /DECIDE/.test(document.body.innerText), null, { timeout: 30_000 });
            await page.waitForTimeout(900);
            await decide(page);
          }
          for (let i = 0; i < 400; i += 1) {
            const now = await page.evaluate(() => ({
              busy: document.querySelectorAll("[aria-busy='true']").length,
              /*
               * PSEUDO-ELEMENTS COUNT. The first version of this probe read only
               * `getComputedStyle(el)`, which never sees `::before`/`::after`, and reported zero
               * against a page whose only moving thing is an `::after`. An instrument that cannot
               * see the fix it checks for is not evidence about the product.
               */
              animating: [...document.querySelectorAll("body *")].filter((e) =>
                [null, "::before", "::after"].some(
                  (pseudo) => getComputedStyle(e, pseudo).animationName !== "none",
                ),
              ).length,
              waiting: document.querySelectorAll(".reveal-waiting").length,
              done: /עומק \d+|בחרת את|ס״פ|מה כן היית עושה/.test(document.body.innerText),
            }));
            if (now.waiting > 0) {
              trace.push(`attempt ${attempt}: +${i * 10}ms busy=${now.busy} anim=${now.animating}`);
              seen = now;
              break;
            }
            if (now.done) { trace.push(`attempt ${attempt}: reveal arrived at +${i * 10}ms with no wait`); break; }
            await page.waitForTimeout(10);
          }
          if (seen === null) {
            /* Clear the one-time question if it is holding the screen, so the next attempt can run. */
            const cf = page.getByRole("button", { name: "לא היה לי מהלך אחר" });
            if ((await cf.count()) > 0) await cf.click();
            await page
              .waitForFunction(() => /עומק \d+|בחרת את|ס״פ/.test(document.body.innerText), null, { timeout: 60_000 })
              .catch(() => undefined);
          }
        }
        expect(
          seen,
          `the waiting state never rendered in three decisions, so this case could not test it :: ${trace.join(" | ")}`,
        ).not.toBeNull();
        expect(
          (seen as { busy: number }).busy,
          "the engine was working and nothing on the page declared itself busy",
        ).toBeGreaterThan(0);
        expect(
          (seen as { animating: number }).animating,
          "the page declared itself busy and showed nothing moving, which is the state that reads as a hang",
        ).toBeGreaterThan(0);
      } finally {
        await context.close();
      }
    },
    300_000,
  );

  it(
    "leaves the board's own vocabulary alone",
    async () => {
      /*
       * A square answers a press with a selection ring, which is the board's language. A second
       * acknowledgement layered on the one surface where the decision is made is not a
       * clarification, and the press layer excludes it on purpose. This holds that exclusion, so
       * that widening the selector later has to be a decision rather than a side effect.
       */
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "he-IL" });
      const page = await context.newPage();
      try {
        await page.goto(`${origin}/`, { waitUntil: "networkidle", timeout: 60_000 });
        await page.waitForTimeout(900);
        await page.getByRole("button", { name: "עמדה מהסט המשותף" }).click();
        await page.locator('[data-square="e4"]').waitFor({ timeout: 60_000 });
        await page.waitForTimeout(1200);
        expect(
          await pressChanges(page, '[data-square="a1"]'),
          "a board square grew a press layer it is not supposed to have",
        ).toEqual([]);
      } finally {
        await context.close();
      }
    },
    300_000,
  );
});
