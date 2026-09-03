/**
 * WHOSE HAND IS ON THE BOARD, driven in a real browser rather than reasoned about from source.
 *
 * WHAT THIS EXISTS TO CATCH, and every one of these was live when it was written, measured on the
 * built app at `c1d72935c0389c8f301edfd4083aabb584764cc7`:
 *
 *   1. After the decision was recorded, a board interaction PLAYED a move instead of proposing
 *      one -- for whichever side was to move. Alternating clicks played White d4-c6 and then Black
 *      b8-d7, so one player was both hands. In a live game against the Stockfish opponent the same
 *      gesture made the opponent's move for it.
 *   2. The reveal went on describing a decision taken in a position the board had left, with the
 *      same sentence and the same number, and nothing said so. Only the engine's arrow was guarded
 *      by `isStale`.
 *   3. Pressing the continuation on the front door's one-position handoff played the committed
 *      move into a game with no opponent: the board went from `תור לבן` to `תור שחור` and asked
 *      the player to decide for the other side -- and the answer was accepted and recorded.
 *
 * WHY A BROWSER AND NOT JSDOM. Every one of these is a property of a gesture landing on a rendered
 * square and of what the position does afterwards. `docs/INERTIAL_UX_LAWS.md` LAW 3 already
 * records what jsdom missed once by mocking a clock; a board that accepts a click nobody may make
 * is the same class of miss.
 *
 * IT DOES NOT INTERCEPT THE ENGINE. The reveal below comes out of the shipped Stockfish wasm in a
 * real Worker, because a reveal that never ran is not a reveal a board could be stale against.
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

/** Which squares carry a piece of one colour, in the order the board renders them. */
const piecesOf = (page: Page, colour: "w" | "b") =>
  page.evaluate(
    (c) =>
      [...document.querySelectorAll<HTMLElement>("[data-square]")]
        .filter((el) => el.querySelector(`.piece.piece-${c}`))
        .map((el) => el.getAttribute("data-square") as string),
    colour,
  );

/** Every square that carries a piece, and which piece. The board's whole state as one string. */
const position = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-square]")]
      .map((el) => `${el.getAttribute("data-square")}:${el.querySelector(".piece")?.className ?? ""}`)
      .join("|"),
  );

/**
 * Try to move one piece of a colour: press it, and if the board offers a target, press that.
 *
 * Returns what it managed to do. `null` for "the board offered nothing", which is the answer this
 * file is looking for everywhere except while a decision is open.
 */
async function tryToMove(page: Page, colour: "w" | "b") {
  for (const square of await piecesOf(page, colour)) {
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

/** Load the demo game through the toolbox, which is reachable at the reveal and only there. */
async function openTheSamplePgn(page: Page): Promise<void> {
  await page.locator(".rail-button").first().click();
  await page.waitForTimeout(300);
  await page.locator(".position-source-option").nth(1).click();
  await page.waitForTimeout(300);
  await page.locator(".ghost-control").click();
  await page.waitForTimeout(200);
  await page.locator(".drawer-confirm").click();
  await page.waitForTimeout(700);
}

/** Arrive, take one decision, and stop when the reveal is on screen. */
async function walkToAReveal(): Promise<Page> {
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
  const proposed = await tryToMove(page, "w");
  expect(proposed, "the board offered no move while a decision was open").not.toBeNull();
  await answerTheCommitment(page);
  await page.locator(".commitment-submit").click();
  const outcome = page.locator(".counterfactual-probe, .reveal-panel, .reveal-failure, .reveal-waiting");
  await outcome.first().waitFor({ timeout: 30_000 });
  const none = page.locator(".counterfactual-probe__none");
  if (await none.count()) await none.click();
  await page.locator(".reveal-panel, .reveal-failure").first().waitFor({ timeout: 180_000 });
  await page.waitForTimeout(600);
  return page;
}

describe("once a decision is committed the board is nobody's to move", () => {
  /*
   * ALTERNATING, AND THAT IS THE WHOLE TEST. One attempt proves nothing: at `c1d7293` the board was
   * on the player's turn, so a single press on an opponent's piece found no target and a test that
   * stopped there would have gone green over a board that played both hands. What produced the
   * defect is the SEQUENCE -- play White, which passes the turn, then play Black -- and it ran to
   * four plies with the reveal on screen. So this drives six.
   */
  it("refuses both hands, however many times it is asked", async () => {
    const page = await walkToAReveal();
    const before = await position(page);
    const played: Array<{ from: string; to: string } | null> = [];
    for (let i = 0; i < 6; i += 1) played.push(await tryToMove(page, i % 2 === 0 ? "w" : "b"));
    expect(
      played.filter(Boolean),
      "the board offered a move after the decision was recorded",
    ).toEqual([]);
    expect(await position(page), "the position changed after the decision was recorded").toBe(before);
    await page.context().close();
  }, 300_000);

  /*
   * AND NOT ONE SQUARE OFFERED A TARGET. The position staying put is necessary and not sufficient:
   * a board can refuse the move and still light the path to it, which is an offer the player can
   * never take. `tryToMove` above reads `.legal-square` to find its target, so this is the property
   * that makes its silence mean something.
   */
  it("offers no target to anybody", async () => {
    const page = await walkToAReveal();
    for (const square of [...(await piecesOf(page, "w")), ...(await piecesOf(page, "b"))].slice(0, 20)) {
      await page.locator(`[data-square="${square}"]`).click();
      await page.waitForTimeout(60);
      expect(
        await page.locator(".legal-square").count(),
        `pressing ${square} lit a target the board would not act on`,
      ).toBe(0);
    }
    await page.context().close();
  }, 300_000);

  /*
   * SELECTION IS AN ACT TOO. A square that lights up under a press it can never act on is an
   * acknowledgment of authority the player does not have, which is the same defect one layer up.
   */
  it("does not light up a square it will not act on", async () => {
    const page = await walkToAReveal();
    const [square] = await piecesOf(page, "b");
    await page.locator(`[data-square="${square}"]`).click();
    await page.waitForTimeout(150);
    expect(
      await page.locator(".selected-square").count(),
      "a square reported itself selected while the board had no authority",
    ).toBe(0);
    await page.context().close();
  }, 300_000);
});

describe("the reveal says which position it is about", () => {
  /*
   * Section 4.3, which `GATE-STALE` states: a result rendered against an input it was not computed
   * for is marked stale. The move timeline can take the board off the decision's position while
   * the reveal is up -- that is LAW 11's own `FINAL -> REVIEW(move 23) -> BACK` and it is allowed.
   * What is not allowed is the reveal going on as though nothing moved.
   */
  it("marks itself stale when the board has been navigated off the decision's position", async () => {
    const page = await walkToAReveal();
    expect(await page.locator(".reveal-elsewhere").count(), "stale before anything moved").toBe(0);
    await page.locator(".move-cell").nth(4).click();
    await page.waitForTimeout(500);
    expect(
      await page.locator(".reveal-panel").count(),
      "the reveal disappeared instead of being marked",
    ).toBe(1);
    expect(
      await page.locator(".reveal-elsewhere").count(),
      "the reveal described a position the board had left, unmarked",
    ).toBe(1);
    await page.context().close();
  }, 300_000);
});

/**
 * `docs/ACQUISITION_EVIDENCE.md` states this step mechanically -- the continue row is
 * *"board accepts the next move"* / *"position advances"* -- and does not say WHOSE move, because
 * until this walk nothing needed it to. On the front door's one-position handoff the continuation
 * passed the turn to the side nobody plays, and the decision taken there was recorded.
 */
describe("a continuation is offered only where it can be taken", () => {
  /*
   * REWRITTEN UNDER OWNER DECISION `O-1` = A, AND THE DEFECT IT GUARDS IS UNCHANGED.
   *
   * This case used to assert that NO way on was offered here: at the time the only continuation
   * available was the fork, and pressing it played the committed move into a game with no opponent
   * and asked the player to decide for the other side. Offering nothing was the honest end of that
   * path, and `RevealNoContinuation` said so over a `return-record` control.
   *
   * `O-1` gives the reveal a way on that is not the fork: a position from the anchor set, on the
   * player's own side. So the assertion flips from "nothing is offered" to "what is offered is not
   * the fork" -- which is the same guard stated against the route that now exists. The three facts
   * below are what make it not the fork: the board changes to a different game, the player may
   * move in it, and no reveal is left standing over it.
   */
  it("offers a position that is not this game's, and not the fork that used to delete it", async () => {
    const page = await walkToAReveal();
    const wayOn = page.locator('[data-primary-action="next-decision"]:visible');
    expect(await wayOn.count(), "the reveal ended with no way on at all").toBe(1);
    expect(
      await page.locator(".control-rail").count(),
      "the player was left with no way to another position",
    ).toBe(1);

    const before = await position(page);
    await wayOn.click();
    await page.waitForTimeout(1500);
    await page.locator("[data-square]").first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(400);

    expect(await position(page), "the press left the board where it was").not.toBe(before);
    expect(
      await page.locator(".reveal-panel").count(),
      "a reveal was left standing over a position it does not describe",
    ).toBe(0);
    expect(
      await tryToMove(page, "w") ?? (await tryToMove(page, "b")),
      "the position offered would not accept a move from the player",
    ).not.toBeNull();
    await page.context().close();
  }, 300_000);

  /*
   * THE OTHER HALF, AND IT IS A LAW 4 CASE. `playMove` truncates history, so pressing the
   * continuation on a game the player had rewound into DELETED the rest of it: an 18-ply PGN came
   * back as 11, seven half-moves of a game somebody had loaded. A loaded game continues along
   * itself.
   */
  it("advances along a loaded game without destroying the rest of it", async () => {
    const page = await walkToAReveal();
    await openTheSamplePgn(page);
    const loaded = await page.locator(".move-cell").count();
    expect(loaded, "the sample PGN did not load").toBeGreaterThan(6);
    await page.locator(".move-cell").nth(Math.floor(loaded / 2)).click();
    await page.waitForTimeout(400);
    const proposed = await tryToMove(page, "w");
    expect(proposed, "no move was offered on the rewound position").not.toBeNull();
    await answerTheCommitment(page);
    await page.locator(".commitment-submit").click();
    const none = page.locator(".counterfactual-probe__none");
    await page
      .locator(".counterfactual-probe, .reveal-panel, .reveal-failure, .reveal-waiting")
      .first()
      .waitFor({ timeout: 30_000 });
    if (await none.count()) await none.click();
    await page.locator(".reveal-panel, .reveal-failure").first().waitFor({ timeout: 180_000 });
    await page.waitForTimeout(500);
    await page.locator('[data-primary-action="next-decision"]').first().click();
    await page.waitForTimeout(1200);
    expect(
      await page.locator(".move-cell").count(),
      "the continuation deleted plies of the loaded game",
    ).toBe(loaded);
    /*
     * EITHER COLOUR, DELIBERATELY. In a loaded game there is no side the product handed the player
     * -- `decisionPurposeFor` stamps these `import`, and deciding at any ply is what importing is
     * for -- so the property here is that the position offers a move at all. The first version of
     * this walk asked only about White and reported a lock that was not there; the correction is
     * in `docs/user-loop-integrity/CONTRADICTIONS.md`.
     */
    const again = (await tryToMove(page, "w")) ?? (await tryToMove(page, "b"));
    expect(
      again,
      "the continuation handed over a position with no move to make at all",
    ).not.toBeNull();
    await page.context().close();
  }, 300_000);
});
