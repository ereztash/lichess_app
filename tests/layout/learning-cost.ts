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
}

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

  return {
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

/** Commit what is on the board and wait for the engine to answer. */
async function commitAndWaitForReveal(page: Page): Promise<void> {
  await page.locator(".commitment-submit").click();
  const outcome = page.locator(".counterfactual-probe, .reveal-panel, .reveal-failure, .reveal-waiting");
  await outcome.first().waitFor({ timeout: 30_000 });
  const none = page.locator(".counterfactual-probe__none");
  if (await none.count()) await none.click();
  await page.locator(".reveal-panel, .reveal-failure").first().waitFor({ timeout: 180_000 });
  await page.waitForTimeout(600);
}

export type JourneyReading = Record<Stage, StageReading>;

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
  try {
    await page.goto(`${origin}/`, { waitUntil: "networkidle" });
    await page.locator("#first-decision-username").waitFor({ timeout: 30_000 });
    const frontDoor = await measureStage(page, "front-door");

    await page.locator("#first-decision-username").fill(USERNAME);
    await page.getByRole("button", { name: "קחו אותי לעמדה" }).click();
    await page.waitForURL(/\/play$/, { timeout: 30_000 });
    await page.locator("[data-square]").first().waitFor({ timeout: 30_000 });
    await page.locator(".commitment-submit").waitFor({ timeout: 30_000 });
    await page.waitForTimeout(500);
    const decide = await measureStage(page, "decide");

    const moved = await tryToMove(page, "w");
    if (!moved) throw new Error("the handed-over position offered the stranger no move");
    await page.waitForTimeout(400);
    const commitment = await measureStage(page, "commitment");

    await answerTheCommitment(page);
    await commitAndWaitForReveal(page);
    if (await page.locator(".reveal-failure").count()) throw new Error("the engine did not answer");
    const reveal = await measureStage(page, "reveal");

    /* O-1: one press to the shared set's next position, where every step of the commitment is asked. */
    await page.locator('[data-primary-action="next-decision"]:visible').click();
    await page.waitForTimeout(1200);
    await page.locator("[data-square]").first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(600);
    const second = (await tryToMove(page, "w")) ?? (await tryToMove(page, "b"));
    if (!second) throw new Error("the shared set's position refused the stranger");
    await page.waitForTimeout(400);
    const anchorCommitment = await measureStage(page, "anchor-commitment");

    return { "front-door": frontDoor, decide, commitment, reveal, "anchor-commitment": anchorCommitment };
  } finally {
    await context.close();
  }
}
