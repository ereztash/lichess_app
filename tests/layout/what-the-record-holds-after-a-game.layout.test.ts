/**
 * What is actually in the record after a real game, read from storage rather than off the screen.
 *
 * WHY THIS FILE EXISTS, AND IT IS A MEASUREMENT ABOUT THE SUITE. `npm run levels` resolves each debt
 * row's `**Gate:**` to the rung its proof stands on, and the four P0 rows -- every row that says a
 * record can be LOST OR MADE WRONG -- were proven at L2 and L3. Not one had ever met a real browser
 * or a real store. R-19 is the standing proof of what that costs: it exists only because R-02's
 * jsdom proof could not see that nothing was being stored at all.
 *
 * THE THREE CLAIMS HERE, AND WHY EACH NEEDS A BROWSER:
 *
 *   R-02  the game survives a tab closed during analysis. jsdom has no reload, so the strongest
 *         thing a jsdom test can say is "the write was called". This closes the page and opens a
 *         new one against the same profile, which is what a player does.
 *   R-03  the verdict names the engine that reached it. There is no engine in jsdom, so the field
 *         was only ever checked on a fixture somebody typed.
 *   R-04  the game names the opponent it was played against. Same: written by the real game, and
 *         only ever asserted on a hand-built row.
 *
 * READ OUT OF `localStorage`, NEVER OFF THE PAGE. `every-blitz-state` says the same thing about the
 * post-game card and had to learn it the hard way: the screen rendered from the copy the component
 * was already holding, so it said "המשחק עצמו נשמר" while the store had refused every game. A
 * browser check that asks the page whether the page saved something is asking the wrong party.
 */
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, resolve } from "node:path";
import type { Browser, BrowserContext, Page } from "@playwright/test";
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

let browser: Browser;
let server: Server;
let origin: string;

beforeAll(async () => {
  if (!existsSync(dist)) {
    throw new Error(`no build at ${dist} -- run \`npm run build\`. This reads the SHIPPED assets.`);
  }
  browser = await launchChromium();
  server = createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
    let path = join(dist, url);
    if (!extname(path) || !existsSync(path)) path = join(dist, "index.html");
    res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
    createReadStream(path).pipe(res);
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", () => done()));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}, 180_000);

afterAll(async () => {
  await browser?.close();
  await new Promise<void>((done) => (server ? server.close(() => done()) : done()));
});

/** The record as this browser holds it. Null when nothing was ever written. */
async function storedRecord(page: Page): Promise<{
  blitzGames?: {
    gameId: string;
    analysisState: string;
    analysis: { engine?: string; build?: string; depth?: number } | null;
    opponent: { kind?: string; engine?: string; build?: string; depth?: number } | null;
  }[];
  blitzDecisions?: { gameId: string; thinkMs: number }[];
} | null> {
  const raw = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith("decision-lab.record."));
    return key === undefined ? null : (localStorage.getItem(key) ?? null);
  });
  return raw === null ? null : JSON.parse(raw);
}

/**
 * Play one real game to a resignation, in one context, and hand back the context still open.
 *
 * ONE MOVE THEN RESIGN, because the claims here are about what a finished game WRITES, not about
 * how long it was. A longer game would add decisions and minutes and no new assertion.
 */
async function playAGame(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`${origin}/blitz`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "משחק בליץ" }).waitFor({ timeout: 60_000 });
  await page.getByRole("button", { name: "3+0" }).click();
  await page.locator(".board-square").first().waitFor({ timeout: 60_000 });
  await page.locator('[data-square="e2"]').click();
  await page.locator('[data-square="e4"]').click();
  await page.getByRole("button", { name: "פרישה" }).click();
  await page.getByRole("heading", { name: "המשחק נגמר" }).waitFor({ timeout: 60_000 });
  return page;
}

describe("what a real browser holds after a real game", () => {
  it("R-02: the game and its think times survive the tab that made them", async () => {
    /*
     * THE CLAIM R-02 ACTUALLY MAKES. Its row says a player who closed the tab during analysis lost
     * the whole game -- "nothing about the game was recoverable, including the think times, which
     * cannot be reconstructed from anything else". The fix was to write before the engine runs.
     *
     * A jsdom test can show that the write is CALLED before the analysis starts. It cannot show
     * that anything is there afterwards, because there is no afterwards: no reload, no second page,
     * no storage that outlives the test. This closes the page while the analysis is still in flight
     * and opens a new one on the same profile.
     */
    const context = await browser.newContext({ viewport: { width: 1350, height: 900 } });
    const first = await playAGame(context);

    const before = await storedRecord(first);
    expect(before?.blitzGames ?? [], "the finished game was never written").toHaveLength(1);
    const decisions = before?.blitzDecisions ?? [];
    expect(decisions.length, "the game was stored with no decisions").toBeGreaterThan(0);

    /* The tab closes while the engine is still working, which is the case the row is about. */
    await first.close();

    const second = await context.newPage();
    await second.goto(`${origin}/blitz`, { waitUntil: "networkidle" });
    const after = await storedRecord(second);

    expect(after?.blitzGames ?? [], "the game did not survive the tab").toHaveLength(1);
    expect(
      (after?.blitzDecisions ?? []).map((d) => d.thinkMs),
      "the think times did not survive, and nothing can reconstruct them",
    ).toEqual(decisions.map((d) => d.thinkMs));
    await context.close();
  }, 300_000);

  it("R-19: every think time the real clock produced is a whole millisecond", async () => {
    /*
     * `performance.now()` RETURNS A DOUBLE, and `storedBlitzRecordSchema` requires an int -- so
     * before `shared/measured-duration.ts` every game played in a browser was refused by the store
     * while three layers of tests stayed green. The fixtures were the problem: hand-built integers
     * in the shared suites, and a `performance.now()` mocked to whole milliseconds in every jsdom
     * one. The only clock that can falsify this is a real one.
     */
    const context = await browser.newContext({ viewport: { width: 1350, height: 900 } });
    const page = await playAGame(context);
    const record = await storedRecord(page);
    const decisions = record?.blitzDecisions ?? [];
    expect(decisions.length, "nothing was stored to check").toBeGreaterThan(0);
    for (const decision of decisions) {
      expect(
        Number.isInteger(decision.thinkMs),
        `a real clock produced ${decision.thinkMs}, which the stored schema refuses`,
      ).toBe(true);
    }
    await context.close();
  }, 300_000);

  it("R-04: the stored game names who it was played against", async () => {
    /*
     * The row's point is that two opponents are not one population: a record that cannot say which
     * engine, at which strength, it was played against cannot be divided by it later. The field has
     * only ever been asserted on a row somebody typed; this reads what a real game wrote.
     */
    const context = await browser.newContext({ viewport: { width: 1350, height: 900 } });
    const page = await playAGame(context);
    const [game] = (await storedRecord(page))?.blitzGames ?? [];
    expect(game, "no game to read").toBeTruthy();
    expect(
      game.opponent,
      "the game was stored with no opponent, so it cannot be told from a game against another",
    ).not.toBeNull();
    /* The row's four fields, each of which divides the population differently. */
    expect(game.opponent?.kind, "no opponent kind").toBeTruthy();
    expect(game.opponent?.engine, "no opponent engine").toBeTruthy();
    expect(game.opponent?.build, "no opponent build -- two builds are two opponents").toBeTruthy();
    expect(typeof game.opponent?.depth, "no opponent strength").toBe("number");
    await context.close();
  }, 300_000);

  it("R-03: the verdict, once the engine has spoken, names the engine that reached it", async () => {
    /*
     * WAITED FOR RATHER THAN MOCKED, and that is the whole reason this belongs here. There is no
     * engine in jsdom, so `engineBuild` was only ever checked on a fixture -- and the row's own
     * argument is that two builds disagree on 13.61% of decisions, which makes the field the
     * difference between a comparable observation and an uncomparable one.
     *
     * The wasm is local here, so readiness is fast; the budget is generous because the analysis is
     * a real search over the game's positions and the machine it runs on is not this test's
     * business. If the engine never finishes, this fails as a timeout naming the state it was
     * stuck in, which is a true report about a build in which the engine did not run.
     */
    const context = await browser.newContext({ viewport: { width: 1350, height: 900 } });
    const page = await playAGame(context);

    await page.waitForFunction(
      () => {
        const key = Object.keys(localStorage).find((k) => k.startsWith("decision-lab.record."));
        if (!key) return false;
        const games = JSON.parse(localStorage.getItem(key) ?? "{}").blitzGames ?? [];
        return games.length > 0 && games[0].analysisState === "complete";
      },
      undefined,
      { timeout: 120_000, polling: 2_000 },
    );

    const [game] = (await storedRecord(page))?.blitzGames ?? [];
    expect(game.analysisState).toBe("complete");
    expect(game.analysis, "a complete analysis with no provenance behind it").not.toBeNull();
    /*
     * `build`, NOT `engine`, IS THE FIELD THAT MATTERS, and the row says why: two builds of the
     * same engine disagreed on 13.61% of decisions when `ACTION_PLAN` B1 measured it, so "stockfish"
     * is a family and the comparison needs the member. The depth is here for the same reason -- a
     * verdict at one depth is not a verdict at another.
     */
    expect(
      game.analysis?.build,
      "the verdict cannot name WHICH build reached it, so it is not comparable with another",
    ).toBeTruthy();
    expect(game.analysis?.engine, "the verdict names no engine at all").toBeTruthy();
    expect(typeof game.analysis?.depth, "the verdict records no depth").toBe("number");
    await context.close();
  }, 300_000);
});
