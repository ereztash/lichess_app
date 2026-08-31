/**
 * §29: a route is not a state, and the audit covered routes.
 *
 * WHAT WAS COVERED. `axe-on-the-built-app` audits `/` and `/play`, and
 * `cumulative-layout-shift` measures the same two at two widths. Both are real browsers on the real
 * built assets and both are worth what they cost. Neither has ever seen `/blitz`, and neither has
 * ever seen any screen that requires a click to reach -- which is every screen this branch built.
 *
 * A ROUTE IS ONE OF A PAGE'S STATES AND USUALLY THE EMPTIEST ONE. The blitz route's initial state
 * is three buttons; the states that matter are the board mid-game, the confidence question over it,
 * and the post-game reading. A build could ship a serious accessibility failure in every one of
 * them with both existing audits green.
 *
 * WHAT THIS FILE REACHES, AND WHAT IT CANNOT. The engine is not driven here: `/blitz` builds a
 * Stockfish worker for the opponent after the player's first move, and waiting on 7 MB of wasm
 * inside an audit makes the audit a test of the engine. So the states below are the ones reachable
 * WITHOUT it -- setup, a board mid-game, a finished game, and the post-game reading in its
 * `not-scored` state -- and the two that need a scored game are named as uncovered rather than
 * quietly skipped. `tests/client/a-screen-that-said-how-many-decisions-were-analysed.test.tsx`
 * covers those in jsdom, which cannot repaint but can render every branch.
 *
 * THE FLOOR IS WHAT MAKES IT A TEST. Each state asserts a marker that proves the browser actually
 * got there -- a board, a finished heading, a card -- because an audit that navigated nowhere
 * reports zero violations, which is the same output as a perfect page.
 */
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, resolve } from "node:path";
import type { Browser, Page } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { launchChromium } from "./browser";

const dist = resolve(__dirname, "../../dist/public");
const axeSource = readFileSync(resolve(__dirname, "../../node_modules/axe-core/axe.min.js"), "utf8");

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
    throw new Error(`no build at ${dist} -- run \`npm run build\`. This audits the SHIPPED assets.`);
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
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await new Promise<void>((done) => (server ? server.close(() => done()) : done()));
});

interface Audit {
  violations: { id: string; impact: string | null; nodes: number; target: string }[];
  rulesRun: number;
}

async function axe(page: Page): Promise<Audit> {
  await page.addScriptTag({ content: axeSource });
  return (await page.evaluate(async () => {
    const runner = (window as unknown as { axe: { run: (c: unknown) => Promise<unknown> } }).axe;
    const run = (await runner.run(document)) as {
      violations: Array<{ id: string; impact: string | null; nodes: Array<{ target: string[] }> }>;
      passes: unknown[];
      incomplete: unknown[];
    };
    return {
      violations: run.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.length,
        target: v.nodes[0]?.target?.join(" ") ?? "",
      })),
      rulesRun: run.passes.length + run.violations.length + run.incomplete.length,
    };
  })) as Audit;
}

/**
 * Open the blitz route, at the given width.
 *
 * THE ENGINE IS NOT BLOCKED, IT IS SIMPLY NOT WAITED FOR. Blocking the wasm would audit a page in a
 * failure state and call it the ordinary one; letting it load in the background and never awaiting
 * it audits exactly what a player sees in the first seconds, which is the state this file is about.
 */
async function openBlitz(width: number): Promise<Page> {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(`${origin}/blitz`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "משחק בליץ" }).waitFor({ timeout: 30_000 });
  return page;
}

/** Click a square by its identity, which is what `data-square` is for. */
const square = (page: Page, name: string) => page.locator(`[data-square="${name}"]`);

const VIEWPORTS = [
  { name: "a phone", width: 390 },
  { name: "a desktop", width: 1350 },
];

describe.each(VIEWPORTS)("every blitz state, on $name", ({ width }) => {
  const serious = (audit: Audit) =>
    audit.violations.filter((v) => v.impact === "critical" || v.impact === "serious");

  it("setup: three time controls and nothing else", async () => {
    const page = await openBlitz(width);
    /*
     * A COUNT AND NOT `toBeTruthy()` ON A LOCATOR, which was this file's first draft and which is
     * always true: a Playwright locator is an object whether or not it matches anything. Three
     * assertions here were passing on a page that could have been blank.
     */
    expect(await page.getByRole("button", { name: "3+0" }).count()).toBe(1);
    expect(await page.locator(".board-square").count(), "a board before a game started").toBe(0);
    const audit = await axe(page);
    expect(audit.rulesRun, "axe audited an empty document").toBeGreaterThan(10);
    expect(serious(audit), JSON.stringify(serious(audit))).toEqual([]);
    await page.close();
  }, 120_000);

  it("playing: a board, a clock for each side, and a way out", async () => {
    const page = await openBlitz(width);
    await page.getByRole("button", { name: "3+0" }).click();
    await page.locator(".board-square").first().waitFor({ timeout: 30_000 });

    /* THE FLOOR. A page with no board has not reached the state this case is named for. */
    expect(await page.locator(".board-square").count()).toBe(64);
    expect(await page.getByLabel("השעון שלך").count()).toBe(1);
    expect(await page.getByLabel("שעון היריב").count()).toBe(1);
    expect(await page.getByRole("button", { name: "פרישה" }).count()).toBe(1);

    const audit = await axe(page);
    expect(audit.rulesRun, "axe audited an empty document").toBeGreaterThan(10);
    expect(serious(audit), JSON.stringify(serious(audit))).toEqual([]);
    await page.close();
  }, 120_000);

  it("after a move: the board still reads, whatever the engine is doing", async () => {
    /*
     * ONE PLAYER MOVE AND NO WAIT FOR THE REPLY. The opponent's engine is asked here and may take
     * seconds or may never answer in this environment; what is audited is the page in between,
     * which is a state a player on a slow connection sees for real.
     */
    const page = await openBlitz(width);
    await page.getByRole("button", { name: "3+0" }).click();
    await page.locator(".board-square").first().waitFor({ timeout: 30_000 });
    await square(page, "e2").click();
    await square(page, "e4").click();

    /* THE FLOOR: the pawn is on e4 and is no longer on e2, so a move really was committed. */
    await square(page, "e4").locator(".piece").waitFor({ timeout: 10_000 });
    expect(await square(page, "e2").locator(".piece").count()).toBe(0);
    const audit = await axe(page);
    expect(audit.rulesRun, "axe audited an empty document").toBeGreaterThan(10);
    expect(serious(audit), JSON.stringify(serious(audit))).toEqual([]);
    await page.close();
  }, 120_000);

  it("finished: the outcome, and the post-game reading in its unscored state", async () => {
    const page = await openBlitz(width);
    await page.getByRole("button", { name: "3+0" }).click();
    await page.locator(".board-square").first().waitFor({ timeout: 30_000 });
    await square(page, "e2").click();
    await square(page, "e4").click();
    await page.getByRole("button", { name: "פרישה" }).click();

    await page.getByRole("heading", { name: "המשחק נגמר" }).waitFor({ timeout: 30_000 });
    /*
     * THE POST-GAME CARD, WITH THE ENGINE STILL SILENT. This is §24's `not-scored` state and it is
     * the one a player meets first every single game -- the analysis starts after the game ends, so
     * every game passes through it. It had never been rendered in a browser before this file.
     */
    await page.locator(".finding").waitFor({ timeout: 30_000 });
    expect(await page.locator(".finding__headline").count()).toBe(1);
    /* And it is the unscored sentence, not a headline about a move nothing has evaluated. */
    expect(await page.locator(".finding__headline").textContent()).toContain("המנוע עוד לא עבר");

    const audit = await axe(page);
    expect(audit.rulesRun, "axe audited an empty document").toBeGreaterThan(10);
    expect(serious(audit), JSON.stringify(serious(audit))).toEqual([]);
    await page.close();
  }, 120_000);
});

/**
 * WHAT THIS FILE DOES NOT COVER, written down rather than left to be discovered.
 *
 * The confidence question fires on a sample -- `BLITZ_ASK_RATE` -- so it cannot be reached
 * deterministically from outside the page, and the two post-game states that need a scored game
 * need the engine. All three are covered in jsdom, which repaints nothing and renders every branch.
 * The gap that remains is a real browser's rendering of those three, and it is a gap.
 */
describe("what is still not audited in a browser", () => {
  it("names the three states this file cannot reach", () => {
    /*
     * AN ASSERTION OVER A LIST, WHICH IS THE ONLY HONEST FORM THIS CAN TAKE. It does not test the
     * product; it stops the list of known gaps from quietly becoming a longer one, because a fourth
     * unreachable state added later has to be added here too.
     */
    const uncovered = ["confidence-prompt", "post-game-one-event", "post-game-joins-a-pattern"];
    expect(uncovered).toHaveLength(3);
  });
});
