/**
 * O-1, O-2 AND O-3, WALKED END TO END IN A REAL BROWSER.
 *
 * WHAT THE OWNER DECIDED, and what this file is here to hold to it.
 *
 *   `O-1` = A, DIRECT ROUTE. After a reveal whose game holds no further position -- which is every
 *   front-door arrival, because the handoff carries exactly one -- the player is routed straight
 *   to the anchor set's next unanswered position in ONE press. The route it replaced went through
 *   the record and cost two.
 *
 *   `O-2` CONTINUATION IS STILL A MOVE. The press is navigation. `next_decision_started` is
 *   recorded only when the player places a legal move on their own side in the position they land
 *   in. Removing the navigation confound must not lower that bar, and the danger of `O-1` is
 *   exactly that it puts a button one line away from the event.
 *
 *   `O-3` `ASK_AFTER_REVEALS = 2` STAYS. The value-reconstruction question is put after the second
 *   reveal. Before `O-1` a front-door stranger could never have a second reveal available, so the
 *   threshold was unreachable for them; the decision was to keep the threshold and let the new
 *   route make it reachable rather than to move the instrument. That is the claim this walk tests:
 *   reveal #1 -> next position -> decision #2 -> reveal #2 -> prompt.
 *
 * WHY A BROWSER. Every clause is a property of a gesture landing on a rendered square, of a route
 * that actually navigated, and of a ledger written by the shipped bundle. The unit tests fix the
 * predicate's truth table and `GATE-CONTINUATION-IS-A-MOVE` reads the source for a second writer.
 * Neither can tell you that a stranger can get from the front door to the question.
 *
 * IT DOES NOT INTERCEPT THE ENGINE. Both reveals come out of the shipped Stockfish wasm in a real
 * Worker, because a reveal that never ran is not one the ledger should have counted.
 */
import { createReadStream, existsSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, resolve } from "node:path";
import type { Browser, Page, Route } from "@playwright/test";
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

const USERNAME = "erez281";
const PGN = `[Event "Rated rapid game"]
[White "erez281"]
[Black "other"]
[Result "0-1"]

1. e4 e5 2. d4 exd4 3. c3 dxc3 4. Bc4 Bb4 5. Nxc3 Bxc3+ 6. bxc3 Ne7 7. Nf3 O-O
8. O-O c6 9. Bg5 Qe8 10. Bb3 Ng6 11. Bc2 Ne5 12. Nd4 d6 13. Nf5 Bxf5 14. exf5 Qd7
15. f4 Nc4 16. Qd3 d5 17. f6 g6 18. Bb3 Nd6 19. Qg3 Nf5 20. Qf3 d4 21. Bc2 Ne3
22. Qg3 Nxc2 23. Qh4 Ne3 24. g4 0-1`;

const LICHESS_BODY = `${JSON.stringify({
  id: "abcd1234",
  status: "resign",
  speed: "rapid",
  rated: true,
  createdAt: 1_700_000_000_000,
  clock: { initial: 600, increment: 0, totalTime: 600 },
  opening: { name: "Danish Gambit" },
  players: {
    white: { user: { name: "erez281" }, rating: 1500 },
    black: { user: { name: "other" }, rating: 1520 },
  },
  pgn: PGN,
})}\n`;

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

/** The trial ledger as the shipped bundle wrote it, read from the browser's own storage. */
const ledger = (page: Page) =>
  page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      const raw = localStorage.getItem(key);
      if (!raw || !raw.includes("reveal_presented")) continue;
      return raw;
    }
    return "";
  });

const eventNames = async (page: Page): Promise<string[]> =>
  [...(await ledger(page)).matchAll(/"name":"([a-z_]+)"/g)].map((m) => m[1]);

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

/** Whichever side the board is currently asking for. The bank serves both. */
async function tryToMoveEitherSide(page: Page) {
  return (await tryToMove(page, "w")) ?? (await tryToMove(page, "b"));
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

/** Commit what is on the board and wait for the engine to answer. */
async function commitAndWaitForReveal(page: Page): Promise<void> {
  await answerTheCommitment(page);
  await page.locator(".commitment-submit").click();
  const outcome = page.locator(
    ".counterfactual-probe, .reveal-panel, .reveal-failure, .reveal-waiting",
  );
  await outcome.first().waitFor({ timeout: 30_000 });
  const none = page.locator(".counterfactual-probe__none");
  if (await none.count()) await none.click();
  await page.locator(".reveal-panel, .reveal-failure").first().waitFor({ timeout: 180_000 });
  await page.waitForTimeout(600);
}

/** Arrive as a stranger through the front door and stop on the first reveal. */
async function walkToTheFirstReveal(): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.route("https://lichess.org/api/games/user/**", (route: Route) =>
    route.fulfill({ status: 200, contentType: "application/x-ndjson", body: LICHESS_BODY }),
  );
  await page.goto(`${origin}/`, { waitUntil: "networkidle" });
  await page.locator("#first-decision-username").fill(USERNAME);
  await page.getByRole("button", { name: "קחו אותי לעמדה" }).click();
  await page.waitForURL(/\/play$/, { timeout: 30_000 });
  await page.locator("[data-square]").first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(500);
  expect(await tryToMove(page, "w"), "the board offered no move while a decision was open").not.toBeNull();
  await commitAndWaitForReveal(page);
  return page;
}

describe("the loop a stranger can close", () => {
  it(
    "routes from the reveal to another position in one press, and only counts the move as continuation",
    async () => {
      const page = await walkToTheFirstReveal();

      /*
       * O-1's OWN CLAIM, AND THE ONE THING THAT CANNOT BE READ FROM SOURCE: the control offered on
       * the front door's reveal is a route to a position, and there is exactly one of it.
       */
      const wayOn = page.locator('[data-primary-action="next-decision"]:visible');
      expect(await wayOn.count(), "the reveal did not offer a single way on").toBe(1);
      expect(await wayOn.textContent()).toContain("לעמדה הבאה");

      /*
       * O-2, MEASURED AT THE MOMENT IT COULD GO WRONG. The press navigates. If the ledger carries
       * `next_decision_started` before a move has been placed in the new position, the funnel is
       * counting the product's own button as the player's behaviour, and every continuation rate
       * taken from it is about the button.
       */
      const beforePress = await eventNames(page);
      expect(beforePress, "continuation was recorded before the player did anything").not.toContain(
        "next_decision_started",
      );

      await wayOn.click();
      await page.waitForTimeout(1200);
      await page.locator("[data-square]").first().waitFor({ timeout: 30_000 });
      await page.waitForTimeout(600);

      const afterPress = await eventNames(page);
      expect(
        afterPress,
        "the route itself was counted as continuation; O-2 says only a placed move is",
      ).not.toContain("next_decision_started");

      /*
       * AND THE POSITION LANDED ON IS ONE THE PLAYER MAY ACT IN. A route that arrives on the
       * opponent's turn is the `c1d72935c038` defect wearing a new button, and it is also what
       * `positionWasActionable` refuses. The board answering a gesture is the observable.
       */
      const secondMove = await tryToMoveEitherSide(page);
      expect(secondMove, "the position routed to would not accept a move from the player").not.toBeNull();
      await page.waitForTimeout(400);

      const afterMove = await eventNames(page);
      expect(
        afterMove,
        "a legal move was placed after a reveal and continuation was still not recorded",
      ).toContain("next_decision_started");
    },
    600_000,
  );

  it(
    "reaches the value question on the second reveal, which is where ASK_AFTER_REVEALS puts it",
    async () => {
      const page = await walkToTheFirstReveal();

      /*
       * O-3. The threshold was NOT moved. Before `O-1` a front-door stranger had no second reveal
       * available, so `ASK_AFTER_REVEALS = 2` was unreachable on that path; the decision was to fix
       * the route rather than the instrument. This is the walk that says whether that worked.
       */
      expect(
        await page.locator(".value-reconstruction").count(),
        "the question was put after the FIRST reveal, which is the moment continuation is measured",
      ).toBe(0);

      await page.locator('[data-primary-action="next-decision"]:visible').click();
      await page.waitForTimeout(1200);
      await page.locator("[data-square]").first().waitFor({ timeout: 30_000 });
      await page.waitForTimeout(600);
      expect(await tryToMoveEitherSide(page), "the second position refused the player").not.toBeNull();
      await commitAndWaitForReveal(page);

      const names = await eventNames(page);
      expect(names.filter((n) => n === "reveal_presented").length).toBeGreaterThanOrEqual(2);

      await page.locator(".value-reconstruction").waitFor({ timeout: 30_000 });
      expect(
        await page.locator(".value-reconstruction").count(),
        "two reveals were presented and the value question was never put",
      ).toBe(1);
    },
    600_000,
  );
});
