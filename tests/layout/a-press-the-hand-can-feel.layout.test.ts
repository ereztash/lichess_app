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
   * AIMED AT A POINT THE ELEMENT ACTUALLY OWNS, AND THE TARGET IS STILL VERIFIED.
   *
   * `.commitment-submit` is `position: sticky` and sits over the step heads at exactly the
   * coordinate a centre-aimed press lands on. The first run of this file reported the step head
   * as unchanged; it had never been pressed. A wrong target that reads as a negative result is
   * worse than a failure, so the press asserts it actually landed on the element it named.
   *
   * THE FIX FOR THAT WAS "TEN PIXELS FROM THE TOP", AND IT WAS PASSING BY FOUR. Measured on the
   * built app at 1440x900 with the `known` step open: the confidence step head sat at y=833 and
   * the sticky submit at y=847, so `833 + 10 = 843` cleared the button by four pixels. One extra
   * wrapped line anywhere above it consumed all four, `elementFromPoint` at the aim returned
   * `.commitment-submit`, and this file went red for a reason that was not about press feedback.
   *
   * So the aim is derived instead of chosen: walk down the element's own box for the first point
   * hit-testing resolves to it or to something inside it. That is strictly stronger than the
   * constant -- a control that is covered at EVERY point still finds nothing and still fails,
   * which is the defect the assertion below is for -- and it does not spend a margin nobody knew
   * was being spent.
   */
  const aim = await page.$eval(
    selector,
    (target) => {
      const r = target.getBoundingClientRect();
      const x = r.x + r.width / 2;
      for (let y = r.y + 2; y < r.bottom - 1; y += 3) {
        const hit = document.elementFromPoint(x, y);
        if (hit && (hit === target || target.contains(hit))) return { x, y };
      }
      return null;
    },
  );
  if (!aim) {
    const covering = await page.$eval(selector, (target) => {
      const r = target.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return hit ? (hit as HTMLElement).outerHTML.slice(0, 100) : "nothing";
    });
    throw new Error(`${selector} owns no hit-testable point; covered by: ${covering}`);
  }
  await page.mouse.move(aim.x, aim.y);
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

        /*
         * THE WAIT DOES NOT HAPPEN ON EVERY DECISION, AND THAT IS WHY THIS LOOPS.
         *
         * The engine answered in 2,185 ms on a cold start and 333 ms warm, and by the third case
         * in this file the wasm is compiled and the reveal can arrive inside one 50 ms sample. A
         * first draft of this case polled once per 50 ms after a single commit and failed on the
         * restored tree while passing under three of its own deliberate breaks -- a test that was
         * measuring the runner's cache, not the product.
         *
         * SAMPLING WAS STILL THE WRONG INSTRUMENT. A 10 ms poll then failed on CI with "reveal
         * arrived at +0ms with no wait" on all three decisions, while passing here in 19 s. That
         * is the same mistake as the pseudo-element one below -- an instrument that cannot see the
         * thing it checks for is not evidence about the product.
         *
         * So it OBSERVES instead of sampling. A MutationObserver records the first appearance of
         * the waiting state, with the busy and animation counts taken AT THAT INSTANT, because by
         * the time any poll returns the state is gone. Polling remains only to decide when an
         * attempt is over.
         *
         * OBSERVING WAS RIGHT AND THE TWO THINGS AROUND IT WERE WRONG, which is how this case went
         * red on CI a second time carrying the same sentence -- and the sentence was false both
         * times. Measured here on the built app at 10 ms resolution: `.reveal-waiting` mounts
         * +10 ms after the commit and is still mounted 2.5 s later. The state renders. What could
         * not see it was the probe.
         *
         *   1. THE COUNTERFACTUAL QUESTION IS A STAGE BEFORE THE REVEAL, AND WAS READ AS THE
         *      REVEAL. `Home.tsx` calls `reveal(...)` with the alternative the player named, so in
         *      the arm of the session that asks the question, nothing is sent to the engine until
         *      it is answered -- and `.reveal-waiting` cannot exist yet. The loop's end condition
         *      matched `מה כן היית עושה`, which is that question, and recorded "the reveal arrived
         *      with no wait" at +0 ms about a reveal that had not been requested. Three of the
         *      four strings it matched on are not the reveal: `בחרת את` is not in the product at
         *      all, and `עומק \d+` is a new-game notice and `Value`'s provenance line. The reveal
         *      has exactly two terminal states and both name themselves in the DOM, so
         *      `.reveal-panel` and `.reveal-failure` are read instead of guessing at prose, and
         *      the question is ANSWERED here rather than being mistaken for an answer.
         *
         *   2. RE-ARMING WIPED AN UNREAD SIGHTING. The probe was armed before every decision and
         *      each arming reset it to null. So the waiting state that appeared once the question
         *      was cleared -- after this loop had already given up on that attempt -- was recorded
         *      by the observer, never read, and erased by the next attempt's arming. It is armed
         *      ONCE for the whole case now: the first sighting survives to be read, whenever in
         *      the three decisions it happens.
         *
         * The assertion is unchanged: the state must have existed, and while it existed the page
         * must have declared itself busy and shown motion. If the wait never renders across all
         * three decisions that is still reported as a failure to REACH the state rather than
         * passed over: a case that quietly succeeds when the thing it checks did not occur is the
         * failure this repository already shipped once. The trace names which terminal state ended
         * each attempt, because `.reveal-failure` is a reason the wait could not render that says
         * nothing about whether the product reports the wait it has.
         */
        type Sighting = { busy: number; animating: number };
        const armWaitProbe = () =>
          page.evaluate(() => {
            const w = window as unknown as { __waitProbe?: Sighting | null };
            w.__waitProbe = null;
            const sample = () => ({
              busy: document.querySelectorAll("[aria-busy='true']").length,
              /*
               * PSEUDO-ELEMENTS COUNT. The first version of this probe read only
               * `getComputedStyle(el)`, which never sees `::before`/`::after`, and reported zero
               * against a page whose only moving thing is an `::after`. An instrument that cannot
               * see the fix it checks for is not evidence about the product.
               */
              animating: [...document.querySelectorAll("body *")].filter((e) =>
                [null, "::before", "::after"].some(
                  (pseudo) => getComputedStyle(e, pseudo as string | null).animationName !== "none",
                ),
              ).length,
            });
            const record = () => {
              if (w.__waitProbe) return true;
              if (document.querySelectorAll(".reveal-waiting").length === 0) return false;
              w.__waitProbe = sample();
              return true;
            };
            if (record()) return;
            const obs = new MutationObserver(() => {
              if (record()) obs.disconnect();
            });
            obs.observe(document.body, { subtree: true, childList: true, attributes: true });
          });
        /** What the reveal column is doing, read from the DOM rather than inferred from prose. */
        const readScreen = () =>
          page.evaluate(() => ({
            observed:
              (window as unknown as { __waitProbe?: Sighting | null }).__waitProbe ?? null,
            waiting: document.querySelectorAll(".reveal-waiting").length,
            panel: document.querySelectorAll(".reveal-panel").length,
            failure: document.querySelectorAll(".reveal-failure").length,
            asking: document.querySelectorAll(".counterfactual-probe").length,
          }));

        await armWaitProbe();
        let seen: Sighting | null = null;
        const trace: string[] = [];
        for (let attempt = 0; attempt < 3 && seen === null; attempt += 1) {
          if (attempt > 0) {
            const next = page.getByRole("button", { name: "לעמדה הבאה" });
            if ((await next.count()) === 0) {
              trace.push(`attempt ${attempt}: no control offered another position`);
              break;
            }
            await next.click();
            await page.waitForFunction(() => /DECIDE/.test(document.body.innerText), null, { timeout: 30_000 });
            await page.waitForTimeout(900);
          }
          await decide(page);
          let answered = false;
          let ended = "neither the waiting state nor a terminal reveal state inside 6 s";
          for (let i = 0; i < 600; i += 1) {
            const now = await readScreen();
            if (now.observed) {
              seen = now.observed;
              ended = `observed at +${i * 10}ms busy=${now.observed.busy} anim=${now.observed.animating}`;
              break;
            }
            if (now.panel) { ended = `.reveal-panel at +${i * 10}ms, no waiting state seen`; break; }
            if (now.failure) {
              ended = `.reveal-failure at +${i * 10}ms: the reveal failed, so it had no wait to report`;
              break;
            }
            if (now.asking && !answered) {
              /* Answer the question rather than wait it out: the reveal is not requested until it
                 is answered, so nothing this case measures can happen while it stands. */
              const none = page.getByRole("button", { name: "לא היה לי מהלך אחר" });
              if ((await none.count()) > 0) { await none.click(); answered = true; continue; }
            }
            await page.waitForTimeout(10);
          }
          trace.push(`attempt ${attempt}: ${ended}`);
          if (seen !== null) break;
          /* Let the reveal settle so the next attempt starts from a position, and read the probe
             once more: a sighting that arrived late is still evidence about the product. */
          await page
            .waitForFunction(
              () => document.querySelectorAll(".reveal-panel, .reveal-failure").length > 0,
              null,
              { timeout: 60_000 },
            )
            .catch(() => undefined);
          const settled = await readScreen();
          if (settled.observed) {
            seen = settled.observed;
            trace.push(
              `attempt ${attempt}: observed while the reveal settled busy=${settled.observed.busy} anim=${settled.observed.animating}`,
            );
          }
        }
        expect(
          seen,
          `the waiting state never rendered in three decisions, so this case could not test it :: ${trace.join(" | ")}`,
        ).not.toBeNull();
        expect(
          (seen as Sighting).busy,
          "the engine was working and nothing on the page declared itself busy",
        ).toBeGreaterThan(0);
        expect(
          (seen as Sighting).animating,
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
