/**
 * The primary customer journey, driven end to end in a real browser by someone who knows nothing.
 *
 * WHAT WAS MISSING. Six browser suites load `/play` and one plays a blitz game, and not one of them
 * walks the path a stranger actually takes: arrive at `/`, type a username, be handed a position
 * from their own game, commit a decision, wait for the engine, read a reveal, come back after a
 * reload. Every piece of that path had a unit test; the path had none. CI could be green with the
 * front door not reaching the board, and nothing in `npm run verify` would have said so.
 *
 * WHAT IS DRIVEN, AND HOW FAITHFULLY. The built assets in `dist/public`, served statically with
 * every `/api/*` answered 503 (a stranger is signed out either way, so this is the production
 * shape of their session). Lichess is the one thing intercepted: `page.route` answers
 * `/api/games/user/*` with a fixture, because a test that depends on lichess.org being up is a
 * test of lichess.org. The engine is NOT intercepted -- the reveal runs the shipped Stockfish wasm
 * in a real Worker, which is the part of the journey that has broken in production before.
 *
 * THE ADVERSARIAL HALF asks, for each way the journey can fail, whether the stranger is told what
 * happened and whether they can go on: an unknown username, a rate limit, no network, an account
 * with nothing to import, an engine whose files never arrive, and a finger that presses the
 * record button twice.
 *
 * NO WRITES LEAVE THE BROWSER. The record lands in this page's localStorage and is read back from
 * there, never off the screen -- `what-the-record-holds-after-a-game` explains why asking the page
 * whether the page saved something is asking the wrong party.
 */
import { createReadStream, existsSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, resolve } from "node:path";
import type { Browser, BrowserContext, Page, Route } from "@playwright/test";
import { Chess } from "chess.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pickFirstDecision } from "@/lib/first-decision";
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

/** The stranger's account. Lower case on the wire and mixed case in the PGN, as Lichess does it. */
const USERNAME = "erez281";

/** 47 plies, so the picker has middlegame positions to choose from. The same game first-decision.test.ts uses. */
const PGN = `[Event "Rated rapid game"]
[White "erez281"]
[Black "other"]
[Result "0-1"]

1. e4 e5 2. d4 exd4 3. c3 dxc3 4. Bc4 Bb4 5. Nxc3 Bxc3+ 6. bxc3 Ne7 7. Nf3 O-O
8. O-O c6 9. Bg5 Qe8 10. Bb3 Ng6 11. Bc2 Ne5 12. Nd4 d6 13. Nf5 Bxf5 14. exf5 Qd7
15. f4 Nc4 16. Qd3 d5 17. f6 g6 18. Bb3 Nd6 19. Qg3 Nf5 20. Qf3 d4 21. Bc2 Ne3
22. Qg3 Nxc2 23. Qh4 Ne3 24. g4 0-1`;

const GAME = {
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
};

/** One NDJSON line, the shape `/api/games/user/{u}?pgnInJson=true` returns. */
const LICHESS_BODY = `${JSON.stringify(GAME)}\n`;

/** A static host: files, SPA fallback, and 503 for anything under /api -- the stranger's deployment. */
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

const LICHESS_GAMES = "https://lichess.org/api/games/user/**";

/** A fresh browser profile -- a stranger has no localStorage -- with Lichess answering as asked. */
async function arrive(
  lichess: (route: Route) => Promise<void>,
  viewport = { width: 1350, height: 940 },
): Promise<{ context: BrowserContext; page: Page; crashes: string[] }> {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const crashes: string[] = [];
  page.on("pageerror", (e) => crashes.push(String(e)));
  await page.route(LICHESS_GAMES, lichess);
  await page.goto(`${origin}/`, { waitUntil: "networkidle" });
  return { context, page, crashes };
}

const lichessAnswers = (route: Route) =>
  route.fulfill({ status: 200, contentType: "application/x-ndjson", body: LICHESS_BODY });

/** Type the username and press the one primary control on a cold front door. */
async function askForAPosition(page: Page): Promise<void> {
  await page.locator("#first-decision-username").fill(USERNAME);
  await page.getByRole("button", { name: "קחו אותי לעמדה" }).click();
}

/** The record this browser holds, read from storage. Null when nothing was ever written. */
async function storedRecord(page: Page): Promise<{
  decisions: { decision_id?: string; decisionId?: string }[];
  reveals: Record<string, unknown>;
} | null> {
  const raw = await page.evaluate(() => localStorage.getItem("decision-lab.record.v1"));
  return raw === null ? null : JSON.parse(raw);
}

/**
 * Walk the commitment accordion the way a finger does: a read chip in each open step, then a
 * confidence. Copied from `the-control-that-records-a-decision`, which already knows the route.
 */
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

/**
 * The counterfactual probe sits between the commit and the engine on a randomised arm. A stranger
 * who draws it is asked one question before the engine speaks; answering "no other move" is the
 * honest answer for a test that chose the first legal move, and the branch that does not draw it
 * goes straight on. Either way the journey continues, which is what this waits to see.
 */
async function answerProbeIfAsked(page: Page): Promise<void> {
  const none = page.locator(".counterfactual-probe__none");
  const outcome = page.locator(".counterfactual-probe, .reveal-panel, .reveal-failure, .reveal-waiting");
  await outcome.first().waitFor({ timeout: 30_000 });
  if (await none.count()) await none.click();
}

/** The position the picker hands over, computed with the product's own picker so the test cannot drift from it. */
function handedOver() {
  const decision = pickFirstDecision(
    [{ id: GAME.id, white: GAME.players.white.user.name, black: GAME.players.black.user.name, pgn: PGN }],
    USERNAME,
  );
  if (!decision) throw new Error("the fixture game yields no first decision; the test cannot run");
  const board = new Chess();
  for (const san of decision.sans) board.move(san);
  const [move] = board.moves({ verbose: true });
  if (!move) throw new Error("no legal move in the handed-over position");
  return { decision, fen: board.fen(), move, pieces: board.board().flat().filter(Boolean).length };
}

/** Make the first legal move on the board, then answer every step of the commitment. */
async function decide(page: Page): Promise<{ from: string; to: string }> {
  const { move } = handedOver();
  await page.locator(`[data-square="${move.from}"]`).click();
  await page.locator(`[data-square="${move.to}"]`).click();
  await page.waitForTimeout(400);
  await answerTheCommitment(page);
  return { from: move.from, to: move.to };
}

describe("a stranger takes their first decision", () => {
  it("gets from the front door to a recorded reveal, and the record survives a reload", async () => {
    const { context, page, crashes } = await arrive(lichessAnswers);
    const expected = handedOver();

    /* 1. The front door says what this is before asking for anything. */
    expect(await page.locator("body").innerText()).toContain("איזה מהלך היה טוב יותר");

    /* 2. Their own game, their own position: the board shows what the picker chose. */
    await askForAPosition(page);
    await page.waitForURL(/\/play$/, { timeout: 30_000 });
    await page.locator("[data-square]").first().waitFor({ timeout: 30_000 });
    expect(await page.locator(".board-square").count()).toBe(64);
    expect(
      await page.locator(".piece").count(),
      "the board does not show the handed-over position",
    ).toBe(expected.pieces);

    /* 3. A move, then the four things the instrument asks for, then the one control that records. */
    await decide(page);
    const submit = page.locator(".commitment-submit");
    expect(await submit.getAttribute("class"), "the commitment never became ready").not.toContain(
      "not-ready",
    );
    await submit.click();
    await answerProbeIfAsked(page);

    /* 4. The decision is on the record BEFORE the engine speaks (R3). */
    await page.waitForFunction(
      () => {
        const raw = localStorage.getItem("decision-lab.record.v1");
        return raw !== null && (JSON.parse(raw).decisions ?? []).length === 1;
      },
      undefined,
      { timeout: 15_000 },
    );

    /* 5. The engine runs where it runs -- in a Worker, from the shipped wasm -- and a reveal arrives. */
    await page.locator(".reveal-panel").waitFor({ timeout: 120_000 });
    const reveal = await page.locator(".reveal-panel").innerText();
    expect(reveal, "the reveal has no headline").toContain("מה ההחלטה הזאת עדיין לא אומרת");
    /* The reveal must never wear the words of a finding it has not earned. */
    expect(reveal).not.toMatch(/חזר גם בבדיקה|מאומת|ישפר את/);

    /* 6. The verdict was written back beside the decision. */
    await page.waitForFunction(
      () => {
        const raw = localStorage.getItem("decision-lab.record.v1");
        return raw !== null && Object.keys(JSON.parse(raw).reveals ?? {}).length === 1;
      },
      undefined,
      { timeout: 15_000 },
    );
    const record = await storedRecord(page);
    expect(record?.decisions).toHaveLength(1);
    expect(Object.keys(record?.reveals ?? {})).toHaveLength(1);

    /*
     * 7. There is a way forward, it is one control, AND IT CAN BE TAKEN.
     *
     * NARROWED FROM "a control exists", and the narrowing is the finding. This assertion was green
     * at `c1d7293` over a control that led somewhere wrong: pressing `לבדוק אם זה חוזר` played the
     * committed move into a game with no opponent, so the board went from `תור לבן` to `תור שחור`
     * and the stranger was asked to decide for the other side -- and the answer was recorded. A
     * control that exists is not a way forward, which is the exact gap `docs/user-loop-integrity/`
     * was sent to find. What is asserted now is that the act on offer is one the screen can
     * honour.
     */
    const forward = page.locator("[data-primary-action]");
    await expect(forward.count()).resolves.toBe(1);
    const act = await forward.first().getAttribute("data-primary-action");
    if (act === "next-decision") {
      await forward.first().click();
      await page.locator(".commitment-submit").waitFor({ timeout: 15_000 });
      const moved = await page.evaluate(async () => {
        for (const el of document.querySelectorAll<HTMLElement>("[data-square]")) {
          if (!el.querySelector(".piece")) continue;
          el.click();
          await new Promise((r) => setTimeout(r, 60));
          if (document.querySelector(".legal-square")) return true;
          el.click();
        }
        return false;
      });
      expect(moved, "the continuation handed over a position with no move to make").toBe(true);
      await page.goBack({ waitUntil: "networkidle" }).catch(() => undefined);
    } else {
      /* The other honourable answer: this game holds no further position, and the screen says so. */
      expect(act).toBe("return-record");
      await expect(page.locator(".reveal-no-continuation").count()).resolves.toBe(1);
    }

    /* 8. A reload keeps the record and puts the board back; nothing crashes; nothing was double-counted. */
    await page.reload({ waitUntil: "networkidle" });
    await page.locator("[data-square]").first().waitFor({ timeout: 30_000 });
    expect(await page.locator(".boundary-card").count(), "the crash screen came up on reload").toBe(0);
    const after = await storedRecord(page);
    expect(after?.decisions, "the reload lost or duplicated the decision").toHaveLength(1);
    expect(Object.keys(after?.reveals ?? {}), "the reload lost or duplicated the reveal").toHaveLength(1);
    const position = await page.evaluate(() => localStorage.getItem("decision-lab.position.v1"));
    expect(position, "the board's position was not kept for the return").not.toBeNull();
    expect(JSON.parse(position!).gameId).toBe(`lichess-${GAME.id}`);

    expect(crashes, "unhandled errors along the primary journey").toEqual([]);
    await context.close();
  }, 300_000);

  it("is told, in its own language, when the username does not exist", async () => {
    const { context, page } = await arrive((route) => route.fulfill({ status: 404, body: "" }));
    await askForAPosition(page);
    const alert = page.locator(".first-decision-error[role='alert']");
    await alert.waitFor({ timeout: 15_000 });
    expect(await alert.innerText()).toContain("אין משתמש");
    /* Still on the front door, still able to try again: the field kept what was typed. */
    expect(page.url()).toMatch(/\/$/);
    expect(await page.locator("#first-decision-username").inputValue()).toBe(USERNAME);
    expect(await page.getByRole("button", { name: "קחו אותי לעמדה" }).isEnabled()).toBe(true);
    await context.close();
  }, 60_000);

  it("names a rate limit as a wait, not as a failure of theirs", async () => {
    const { context, page } = await arrive((route) => route.fulfill({ status: 429, body: "" }));
    await askForAPosition(page);
    const alert = page.locator(".first-decision-error[role='alert']");
    await alert.waitFor({ timeout: 15_000 });
    expect(await alert.innerText()).toMatch(/המתינו|נסו שוב/);
    await context.close();
  }, 60_000);

  it("names a network that is not there, and offers the way that needs none", async () => {
    const { context, page } = await arrive((route) => route.abort("failed"));
    await askForAPosition(page);
    const alert = page.locator(".first-decision-error[role='alert']");
    await alert.waitFor({ timeout: 15_000 });
    const text = await alert.innerText();
    expect(text).toMatch(/לא הצליח להגיע|לא הצלחתי להגיע/);
    /* No English internals reach the stranger. */
    expect(text).not.toMatch(/TypeError|Failed to fetch|undefined/);
    /* The route that needs no account is still on the page. */
    expect(await page.getByRole("button", { name: "עמדה מהסט המשותף" }).isEnabled()).toBe(true);
    await context.close();
  }, 60_000);

  it("says an account with nothing finished has nothing to import, rather than showing an empty board", async () => {
    const live = { ...GAME, id: "live0001", status: "started" };
    const { context, page } = await arrive((route) =>
      route.fulfill({
        status: 200,
        contentType: "application/x-ndjson",
        body: `${JSON.stringify(live)}\n`,
      }),
    );
    await askForAPosition(page);
    const alert = page.locator(".first-decision-error[role='alert']");
    await alert.waitFor({ timeout: 15_000 });
    expect(await alert.innerText()).toContain("אין משחקים");
    expect(page.url()).toMatch(/\/$/);
    await context.close();
  }, 60_000);

  it("keeps the decision and offers the next one when the engine's files never arrive", async () => {
    /*
     * THE FAILURE THAT HAS ALREADY HAPPENED IN PRODUCTION (R-09): the engine did not run on the
     * deployed origin. Here its script is withheld entirely, which is what a failed deploy, a bad
     * CDN path or a proxy looks like from the browser's side.
     */
    const { context, page, crashes } = await arrive(lichessAnswers);
    await page.route("**/assets/stockfish-*", (route) => route.abort("failed"));
    await askForAPosition(page);
    await page.waitForURL(/\/play$/, { timeout: 30_000 });
    await page.locator("[data-square]").first().waitFor({ timeout: 30_000 });
    await decide(page);
    await page.locator(".commitment-submit").click();
    await answerProbeIfAsked(page);

    /* The decision itself is on the record: the engine is not needed for that (R3). */
    await page.waitForFunction(
      () => {
        const raw = localStorage.getItem("decision-lab.record.v1");
        return raw !== null && (JSON.parse(raw).decisions ?? []).length === 1;
      },
      undefined,
      { timeout: 15_000 },
    );

    /* The stranger is told the engine failed, told their decision is safe, and given a way on. */
    const failure = page.locator(".reveal-failure");
    await failure.waitFor({ timeout: 90_000 });
    const text = await failure.innerText();
    expect(text).toContain("המנוע לא סיים את החישוב");
    expect(text).toContain("ההחלטה עצמה נרשמה");
    /*
     * NARROWED, for the same reason as step 7 above. This waited for `.commitment-screen`, and at
     * `c1d7293` that screen was the opponent's turn put to the player. The recovery contract is
     * that the decision is kept and the player can go on; where the loaded game holds no further
     * position, going on is the record, which is where the decision now is.
     */
    await page.getByRole("button", { name: "להחלטה הבאה" }).click();
    await page
      .locator(".commitment-screen, .resume-screen, .record-dashboard, #first-decision-username")
      .first()
      .waitFor({ timeout: 15_000 });
    /* Nothing was written that the engine never produced. */
    const record = await storedRecord(page);
    expect(Object.keys(record?.reveals ?? {})).toHaveLength(0);
    expect(crashes).toEqual([]);
    await context.close();
  }, 180_000);

  /*
   * RED AT c848f244 AND RECORDED AS `it.fails` THERE: two synchronous clicks wrote two decisions.
   * Fixed by a synchronous in-flight guard in `CommitmentScreen.submit`; flipped to `it` the same
   * commit, so the test that found the defect is the test that holds the fix.
   */
  it("records one decision when the record button is pressed twice in one gesture", async () => {
    /*
     * The button is `disabled={pending}`, and `pending` arrives through a state update -- so the
     * second press of a double-tap can land before React has re-rendered. Two synchronous clicks
     * are the harshest form of that: if they produce two decisions, a phone can too.
     */
    const { context, page } = await arrive(lichessAnswers);
    await askForAPosition(page);
    await page.waitForURL(/\/play$/, { timeout: 30_000 });
    await page.locator("[data-square]").first().waitFor({ timeout: 30_000 });
    await decide(page);
    await page.evaluate(() => {
      const button = document.querySelector<HTMLButtonElement>(".commitment-submit");
      button?.click();
      button?.click();
    });
    await answerProbeIfAsked(page);
    await page.locator(".reveal-panel, .reveal-failure").first().waitFor({ timeout: 120_000 });
    const record = await storedRecord(page);
    expect(record?.decisions, "a double press wrote two decisions").toHaveLength(1);
    await context.close();
  }, 180_000);
});
