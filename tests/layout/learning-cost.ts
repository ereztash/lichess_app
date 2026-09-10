/**
 * THE WORDS A STRANGER HAS TO READ BEFORE THEY CAN ACT, measured on the built app.
 *
 * WHAT THIS MEASURES, AND WHAT IT DOES NOT. A player's attention is spent either on the position
 * or on the product. Every sentence that explains the instrument -- what it records, why it waits,
 * what a count means -- is attention the position did not get, and none of it is the reason the
 * player came. This walks the primary journey a stranger takes and counts, at each stage, the
 * visible words that are not the board and not the move list. A word count is not comprehension:
 * a short screen can still be opaque and a long one can be read in a glance. What the number IS
 * is the cost of the screen as text, and it is the one part of the cost the repository can put a
 * ceiling on without a person.
 *
 * SHARED BY A TEST AND A SCRIPT, on purpose. `the-words-a-stranger-must-read.layout.test.ts`
 * holds the ceilings; `scripts/measure-learning-cost.ts` deposits a reading under
 * `docs/learning-cost/evidence/`. Both drive the same walk, so the number a ceiling holds is the
 * number the evidence file shows -- two walks would be two definitions of the cost.
 *
 * THE WALK IS THE STRANGER'S. Front door, a username, the position handed over from their own
 * game, a move, the commitment, the reveal, then the one press to the shared set's next position
 * and a move there. It is the route `a-stranger-takes-their-first-decision` and
 * `the-loop-a-stranger-can-close` already walk, driven the same way: the built assets served
 * statically, `/api/*` answering 503 as a signed-out deployment does, Lichess answered from the
 * same fixture, and the engine NOT intercepted.
 */
import { createReadStream, existsSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Browser, Page, Route } from "@playwright/test";

/* `import.meta.url`, not `__dirname`: this module is loaded by vitest AND by `tsx` under `"type": "module"`. */
const here = fileURLToPath(new URL(".", import.meta.url));
export const dist = resolve(here, "../../dist/public");

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

/** The stranger's account and game: the same fixture the other stranger walks use. */
export const USERNAME = "erez281";
const PGN = `[Event "Rated rapid game"]
[White "erez281"]
[Black "other"]
[Result "0-1"]

1. e4 e5 2. d4 exd4 3. c3 dxc3 4. Bc4 Bb4 5. Nxc3 Bxc3+ 6. bxc3 Ne7 7. Nf3 O-O
8. O-O c6 9. Bg5 Qe8 10. Bb3 Ng6 11. Bc2 Ne5 12. Nd4 d6 13. Nf5 Bxf5 14. exf5 Qd7
15. f4 Nc4 16. Qd3 d5 17. f6 g6 18. Bb3 Nd6 19. Qg3 Nf5 20. Qf3 d4 21. Bc2 Ne3
22. Qg3 Nxc2 23. Qh4 Ne3 24. g4 0-1`;

export const LICHESS_BODY = `${JSON.stringify({
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

/** A static host: files, SPA fallback, and 503 for anything under /api. */
export function serveDist(): Promise<{ server: Server; origin: string }> {
  if (!existsSync(dist)) throw new Error(`no build at ${dist} -- run \`npm run build\``);
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

/** The stages, in the order the stranger meets them. */
export const STAGES = ["front-door", "decide", "commitment", "reveal", "anchor-commitment"] as const;
export type Stage = (typeof STAGES)[number];

export interface StageReading {
  /** Visible words in `main`, the board and the move list excluded. */
  words: number;
  /** Visible text blocks, each counted as at least one sentence. */
  sentences: number;
  /** Words that come before the stage's primary control in document order. Null: no control. */
  wordsBeforePrimary: number | null;
  /** The most words in any one visible block. A wall of text is a long block, not many blocks. */
  longestBlock: number;
  /** Words whose block starts inside the first viewport, without scrolling. */
  aboveTheFold: number;
  /** Disclosures a reader did not open, open by default. */
  openDisclosures: number;
  /**
   * Visible controls a player could press, the board and the move list excluded.
   *
   * A SECOND KIND OF COST, and the reason this file grew past words. A screen can be short and
   * still expensive: four buttons under one sentence is one question wearing a whole screen. Words
   * measure what must be read; this measures what must be chosen between.
   */
  controls: number;
  /** Whether a board is painted here. A stage without one is a stage between the player and it. */
  board: boolean;
}

/**
 * What reaching this stage cost, accumulated from the start of the walk.
 *
 * NOT DERIVABLE FROM THE DOM, which is why it is stamped by the walk rather than counted in the
 * page: a screen cannot see how many times it was pressed to get here. These are the axes a word
 * count is blind to, and the ones a player reports as "why is this so many steps".
 */
export interface StageCost {
  /** Presses so far, a move counting as the two it takes: pick up, put down. */
  taps: number;
  /** Distinct routes reached so far. The decision loop is one; each detour is another. */
  screens: number;
  /** Seconds from the first paint of the front door. */
  seconds: number;
}

export type StagePrice = StageReading & StageCost;

export type Viewport = { width: number; height: number };
export const VIEWPORTS: readonly Viewport[] = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
];
export const viewportKey = (v: Viewport) => `${v.width}x${v.height}`;

/** Which control is the stage's one act. `[data-primary-action]` is the product's own declaration. */
const PRIMARY: Record<Stage, string> = {
  "front-door": '[data-primary-action="play-first-decision"]',
  decide: ".commitment-submit",
  commitment: ".commitment-submit",
  reveal: ".reveal-continue, [data-primary-action]",
  "anchor-commitment": ".commitment-submit",
};

/**
 * Count what is on screen.
 *
 * VISIBLE MEANS PAINTED. A closed `<details>` body, a `hidden` step body and a collapsed panel all
 * report a zero box, and a zero box is not read. Text inside the board and the move list is
 * chess, not product, and is excluded by selector rather than by size.
 */
/*
 * BUILT FROM SOURCE TEXT AT RUNTIME, and the reason is the toolchain rather than taste. `tsx` runs
 * this file through esbuild with `keepNames`, which wraps every inner function in a `__name` helper
 * that exists in the Node bundle and not in the page -- so a function serialised into the browser
 * threw `__name is not defined` on its first call. A function constructed from a string has nothing
 * for esbuild to decorate, and Playwright serialises it by its own source. Vitest transforms the same
 * file differently and would have passed a plain function through, which is exactly how the script
 * and the test would have come to give two different answers to one question.
 */
const COUNT_BODY = `
  const EXCLUDE = ".board-assembly, .move-timeline, .blitz-clocks, .sr-only, script, style, svg";
  const OWNERS = "p, li, h1, h2, h3, h4, dt, dd, summary, label, legend, button, output";
  const root = document.querySelector("main") || document.body;
  /*
   * A CLOSED DISCLOSURE IS NOT READ, and the box does not say so: Chromium keeps a box for the body
   * of a closed <details>, so the reveal's collapsed numbers and the ribbon's "why" counted as
   * painted on the first run. Walk the details ancestors instead; text under a closed one is
   * unread unless it is that disclosure's own summary.
   */
  const behindAClosedDisclosure = (el) => {
    for (let d = el.closest("details"); d; d = d.parentElement && d.parentElement.closest("details")) {
      if (d.open) continue;
      const summary = d.querySelector(":scope > summary");
      if (!summary || !summary.contains(el)) return true;
    }
    return false;
  };
  const painted = (el) => {
    if (behindAClosedDisclosure(el)) return false;
    const box = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden" && (box.width > 0 || box.height > 0);
  };
  const wordsOf = (text) => text.trim().split(/\\s+/).filter((token) => /[\\p{L}\\p{N}]/u.test(token)).length;
  const primary = root.querySelector(primarySelector);

  let words = 0;
  let before = 0;
  const blockWords = new Map();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!parent || parent.closest(EXCLUDE) || !painted(parent)) continue;
    const n = wordsOf(node.textContent || "");
    if (n === 0) continue;
    words += n;
    if (primary && primary.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_PRECEDING) before += n;
    /* The nearest block-shaped ancestor owns the words: a span inside a paragraph is the paragraph's. */
    const owner = parent.closest(OWNERS) || parent;
    blockWords.set(owner, (blockWords.get(owner) || 0) + n);
  }

  let sentences = 0;
  let longest = 0;
  let aboveTheFold = 0;
  for (const [block, n] of blockWords) {
    const text = block.textContent || "";
    sentences += Math.max(1, (text.match(/[.?!]/g) || []).length);
    longest = Math.max(longest, n);
    if (block.getBoundingClientRect().top < window.innerHeight) aboveTheFold += n;
  }

  /*
   * WHAT MUST BE CHOSEN BETWEEN, counted the same way the words were: painted, out of the board,
   * out of a closed disclosure. A control the player cannot see is not a choice they are facing.
   */
  const INTERACTIVE = 'button, a[href], input, select, textarea, [role="button"]';
  const controls = [...root.querySelectorAll(INTERACTIVE)].filter(
    (el) => !el.closest(EXCLUDE) && !el.closest("[data-square]") && painted(el),
  ).length;
  const boardSquare = root.querySelector("[data-square]");

  return {
    controls,
    board: Boolean(boardSquare && painted(boardSquare)),
    words,
    sentences,
    wordsBeforePrimary: primary ? before : null,
    longestBlock: longest,
    aboveTheFold,
    openDisclosures: root.querySelectorAll("details[open]").length,
  };
`;

const countInPage = new Function("primarySelector", COUNT_BODY) as (selector: string) => StageReading;

export async function measureStage(page: Page, stage: Stage): Promise<StageReading> {
  return page.evaluate(countInPage, PRIMARY[stage]);
}

/**
 * The running cost of a walk: what has been pressed, where it has been, how long it has taken.
 *
 * EVERY PRESS IN THIS FILE GOES THROUGH `press`, and that is the only thing keeping the number
 * honest. A tap counter maintained beside the clicks rather than around them is a number that
 * drifts the first time somebody adds a click, and a drifted cost reads as a product that got
 * cheaper.
 */
interface Meter {
  taps: number;
  routes: Set<string>;
  startedAt: number;
}

const newMeter = (): Meter => ({ taps: 0, routes: new Set(), startedAt: Date.now() });

async function press(m: Meter, target: { click: () => Promise<void> }): Promise<void> {
  m.taps += 1;
  await target.click();
}

/** What has been spent by the time a stage is on screen. Reading a stage records the route it is on. */
function stamp(m: Meter, page: Page): StageCost {
  m.routes.add(new URL(page.url()).pathname);
  return {
    taps: m.taps,
    screens: m.routes.size,
    seconds: Math.round((Date.now() - m.startedAt) / 100) / 10,
  };
}

/** Press one piece of a colour and, if the board offers a target, press it. Null means refused. */
async function tryToMove(page: Page, m: Meter, colour: "w" | "b") {
  const squares = await page.evaluate(
    (c) =>
      [...document.querySelectorAll<HTMLElement>("[data-square]")]
        .filter((el) => el.querySelector(`.piece.piece-${c}`))
        .map((el) => el.getAttribute("data-square") as string),
    colour,
  );
  for (const square of squares) {
    /*
     * THE SEARCH IS NOT CHARGED, THE MOVE IS. This loop presses squares until one of them has a
     * legal target, which is the instrument hunting for a move a player already knows. Charging
     * the probes made `anchor-commitment` read 23 taps on a position where a player would spend
     * two, and a cost that counts the measurer's fumbling is a cost about the measurer.
     */
    await page.locator(`[data-square="${square}"]`).click();
    await page.waitForTimeout(90);
    const target = await page.evaluate(
      () => document.querySelector(".legal-square")?.getAttribute("data-square") ?? null,
    );
    if (!target) continue;
    await page.locator(`[data-square="${target}"]`).click();
    m.taps += 2;
    await page.waitForTimeout(300);
    return { from: square, to: target };
  }
  return null;
}

/** Answer every step of the commitment the way a finger does. */
async function answerTheCommitment(page: Page, m: Meter): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    const chip = page.locator(".read-chip:visible").first();
    if (await chip.count()) await press(m, chip);
    const confidence = page.locator(".confidence-row button:visible").nth(2);
    if (await confidence.count()) {
      await press(m, confidence);
      break;
    }
    const next = page.locator(".step-next:visible").first();
    if (await next.count()) await press(m, next);
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(300);
}

/** Commit what is on the board and wait for the engine to answer. */
async function commitAndWaitForReveal(page: Page, m: Meter): Promise<void> {
  await press(m, page.locator(".commitment-submit"));
  const outcome = page.locator(".counterfactual-probe, .reveal-panel, .reveal-failure, .reveal-waiting");
  await outcome.first().waitFor({ timeout: 30_000 });
  const none = page.locator(".counterfactual-probe__none");
  if (await none.count()) await press(m, none);
  await page.locator(".reveal-panel, .reveal-failure").first().waitFor({ timeout: 180_000 });
  await page.waitForTimeout(600);
}

export type JourneyReading = Record<Stage, StagePrice>;

/**
 * Walk the stranger's journey once, at one viewport, reading each stage as it is reached.
 *
 * A fresh context per walk: a stranger has no localStorage, and the record one walk leaves would
 * change what the next one is shown.
 */
export async function walkAsAStranger(
  browser: Browser,
  origin: string,
  viewport: Viewport,
): Promise<JourneyReading> {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.route("https://lichess.org/api/games/user/**", (route: Route) =>
    route.fulfill({ status: 200, contentType: "application/x-ndjson", body: LICHESS_BODY }),
  );
  const m = newMeter();
  const read = async (stage: Stage): Promise<StagePrice> => ({
    ...(await measureStage(page, stage)),
    ...stamp(m, page),
  });
  try {
    await page.goto(`${origin}/`, { waitUntil: "networkidle" });
    await page.locator("#first-decision-username").waitFor({ timeout: 30_000 });
    m.startedAt = Date.now();
    const frontDoor = await read("front-door");

    /* Typing is not a tap and is not counted as one. It is a cost with no name here yet. */
    await page.locator("#first-decision-username").fill(USERNAME);
    await press(m, page.getByRole("button", { name: "קחו אותי לעמדה" }));
    await page.waitForURL(/\/play$/, { timeout: 30_000 });
    await page.locator("[data-square]").first().waitFor({ timeout: 30_000 });
    await page.locator(".commitment-submit").waitFor({ timeout: 30_000 });
    await page.waitForTimeout(500);
    const decide = await read("decide");

    const moved = await tryToMove(page, m, "w");
    if (!moved) throw new Error("the handed-over position offered the stranger no move");
    await page.waitForTimeout(400);
    const commitment = await read("commitment");

    await answerTheCommitment(page, m);
    await commitAndWaitForReveal(page, m);
    if (await page.locator(".reveal-failure").count()) throw new Error("the engine did not answer");
    const reveal = await read("reveal");

    /* O-1: one press to the shared set's next position, where every step of the commitment is asked. */
    await press(m, page.locator('[data-primary-action="next-decision"]:visible'));
    await page.waitForTimeout(1200);
    await page.locator("[data-square]").first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(600);
    const second = (await tryToMove(page, m, "w")) ?? (await tryToMove(page, m, "b"));
    if (!second) throw new Error("the shared set's position refused the stranger");
    await page.waitForTimeout(400);
    const anchorCommitment = await read("anchor-commitment");

    return { "front-door": frontDoor, decide, commitment, reveal, "anchor-commitment": anchorCommitment };
  } finally {
    await context.close();
  }
}

/* ------------------------------------------------------------------------------------------- *
 * THE OTHER DOOR, and the reason it is measured separately.
 *
 * The walk above is the journey the product is built around: front door, a position, a decision,
 * a reveal. The blitz route is the one a player takes when they would rather play than answer,
 * and it is offered on the same front door. Nothing measured it until a stranger said the setup
 * screen felt like a whole screen spent on one question -- a cost a word count cannot see, since
 * that screen is one of the shortest in the product.
 *
 * WHAT IT IS FOR: a comparison, not a ceiling. Two doors, both reached from the same front door,
 * priced in the same units. A difference between them is a fact about the product; whether that
 * difference is worth paying is an owner's decision and a FIELD question.
 * ------------------------------------------------------------------------------------------- */

export const BLITZ_STAGES = ["front-door", "blitz-setup", "blitz-board"] as const;
export type BlitzStage = (typeof BLITZ_STAGES)[number];

/**
 * The blitz route's primary controls.
 *
 * `blitz-setup` NAMES `play-blitz` AND OFTEN FINDS NOTHING, which is the point rather than a gap.
 * `Blitz.tsx` marks the remembered time control as the primary act and marks nothing on a first
 * visit, because "nothing chosen yet" is a fact and painting one of four as a preference would
 * invent one. A stranger therefore meets a required screen with no primary action on it, and
 * `wordsBeforePrimary: null` is this instrument reporting exactly that.
 */
const BLITZ_PRIMARY: Record<BlitzStage, string> = {
  "front-door": '[data-primary-action="play-first-decision"]',
  "blitz-setup": '[data-primary-action="play-blitz"]',
  "blitz-board": '.commitment-submit, [data-primary-action]',
};

export type BlitzJourneyReading = Record<BlitzStage, StagePrice>;

/** Walk the front door's other offer: a blitz game, priced in the same units as a decision. */
export async function walkToABlitzGame(
  browser: Browser,
  origin: string,
  viewport: Viewport,
): Promise<BlitzJourneyReading> {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const m = newMeter();
  const read = async (stage: BlitzStage): Promise<StagePrice> => ({
    ...(await page.evaluate(countInPage, BLITZ_PRIMARY[stage])),
    ...stamp(m, page),
  });
  try {
    await page.goto(`${origin}/`, { waitUntil: "networkidle" });
    await page.locator("#first-decision-username").waitFor({ timeout: 30_000 });
    m.startedAt = Date.now();
    const frontDoor = await read("front-door");

    await press(m, page.getByRole("button", { name: "משחק בליץ קצר" }));
    await page.waitForURL(/\/blitz$/, { timeout: 30_000 });
    await page.locator(".blitz-control").first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(400);
    const setup = await read("blitz-setup");

    await press(m, page.locator(".blitz-control").first());
    await page.locator("[data-square]").first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(600);
    const board = await read("blitz-board");

    return { "front-door": frontDoor, "blitz-setup": setup, "blitz-board": board };
  } finally {
    await context.close();
  }
}
