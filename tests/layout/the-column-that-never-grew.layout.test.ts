/**
 * TWO THINGS MEASURED ON ONE SCREENSHOT: a reading column that ignores the screen, and an axis
 * label with its digits outside the picture.
 *
 * WHAT WAS ON SCREEN. A reveal with the record open, on a wide display. Every sentence the
 * dashboard writes -- eleven sections, a calibration chart, the decomposition, the bucket list --
 * was rendered into a 330px strip against the right edge, with the board track beside it holding
 * 982px it does not need, and the y-axis of the calibration chart read `%`, `%`, `%`, `%`, `%`
 * with the numbers cut off at the picture's edge.
 *
 * WHY A BROWSER, AND WHY THESE TWO TOGETHER. Neither is visible to a stylesheet reader. The
 * column is a grid track whose width is decided by the template, the viewport and the sibling
 * tracks at once; the label is an SVG text box positioned by a chart library from a margin, an
 * axis width and a font it resolves itself. jsdom reports both as 0x0, and `tests/client` mounts
 * the same components green today.
 *
 * NEITHER ASSERTION IS A NUMBER SOMEBODY LIKED.
 *
 *   THE COLUMN asserts a relation between two viewports, not a width: 414 more pixels of screen
 *   must produce more than 0 more pixels of reading column. `.workbench` declares `[task] 330px`,
 *   a track that is simultaneously at its minimum and its maximum, so it cannot receive surplus at
 *   any size in any state -- and the stylesheet already agrees this is wrong, in as many words, at
 *   the breakpoint below: "330px beside a 420px board is not a column, it is a squeeze."
 *
 *   THE LABEL asserts containment, not a margin: a tick's box must be inside the picture that
 *   draws it. A label the reader cannot read is worse than an axis with no labels, because the
 *   `%` that survives claims a number was shown.
 *
 * AND BOTH CARRY A POSITIVE CONTROL, because both repairs have an obvious way to pass while
 * making the screen worse: give the reading column its width by collapsing the board, or clear
 * the axis by dropping its labels. The board's own declared minimum and the tick text are
 * asserted alongside, so neither shortcut is green.
 *
 * ---
 *
 * THE THIRD THING, WHICH THE FIRST REPAIR MADE VISIBLE RATHER THAN CAUSED. Widening the reading
 * column does not shorten it: the record is eleven sections long, so by the calibration chart the
 * board has scrolled away and its track is a column of nothing. Measured at 1440x900 with the
 * record open, at the chart: the board's own box sat at top -1731, bottom -1371, and 0 of its 360
 * pixels were on screen. The reader is looking at numbers about a position while the position is
 * gone.
 *
 * ITS CONTROL IS THE ONE THAT MATTERS MOST, because `position: sticky` fails in two ways that both
 * look like success. A pinned box taller than the viewport has a bottom nobody can reach, and a
 * pinned box that escapes its track covers the thing being read. So the assertion is not "the
 * board is sticky": it is that WHENEVER the board is pinned it is pinned WHOLE, and that it never
 * overlaps the reading column. Both hold at a viewport too short to fit it, where the answer is
 * that it must not be pinned at all.
 */
import { createReadStream, existsSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, resolve } from "node:path";
import { readFileSync } from "node:fs";
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
    white: { user: { name: USERNAME }, rating: 1500 },
    black: { user: { name: "other" }, rating: 1520 },
  },
  pgn: PGN,
})}\n`;

let browser: Browser;
let server: Server;
let origin: string;
let page: Page;

beforeAll(async () => {
  if (!existsSync(join(dist, "index.html"))) {
    throw new Error(`no build at ${dist} -- run \`npm run build\` before the layout tests`);
  }
  browser = await launchChromium();
  server = createServer((req, res) => {
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
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", () => done()));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  page = await walkToTheRecordOnAReveal();
}, 300_000);

afterAll(async () => {
  await browser?.close();
  await new Promise<void>((done) => (server ? server.close(() => done()) : done()));
});

/** Press one piece of a colour and, if the board offers a target, press it. Null means refused. */
async function tryToMove(target: Page, colour: "w" | "b") {
  const squares = await target.evaluate(
    (c) =>
      [...document.querySelectorAll<HTMLElement>("[data-square]")]
        .filter((el) => el.querySelector(`.piece.piece-${c}`))
        .map((el) => el.getAttribute("data-square") as string),
    colour,
  );
  for (const square of squares) {
    await target.locator(`[data-square="${square}"]`).click();
    await target.waitForTimeout(90);
    const to = await target.evaluate(
      () => document.querySelector(".legal-square")?.getAttribute("data-square") ?? null,
    );
    if (!to) continue;
    await target.locator(`[data-square="${to}"]`).click();
    await target.waitForTimeout(300);
    return { from: square, to };
  }
  return null;
}

/**
 * A stranger, one decision, one reveal, and then the press that opens the record.
 *
 * IT IS THE SHIPPED BUNDLE AND THE SHIPPED ENGINE. Nothing is stubbed but the Lichess import the
 * front door makes, because the screen under test is the one a player reaches by pressing what is
 * on it, and a seeded `localStorage` would prove the dashboard renders somewhere rather than that
 * it renders here.
 */
async function walkToTheRecordOnAReveal(): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const arrived = await context.newPage();
  await arrived.route("https://lichess.org/api/games/user/**", (route: Route) =>
    route.fulfill({ status: 200, contentType: "application/x-ndjson", body: LICHESS_BODY }),
  );
  await arrived.goto(`${origin}/`, { waitUntil: "networkidle" });
  await arrived.locator("#first-decision-username").fill(USERNAME);
  await arrived.getByRole("button", { name: "קחו אותי לעמדה" }).click();
  await arrived.waitForURL(/\/play$/, { timeout: 30_000 });
  await arrived.locator("[data-square]").first().waitFor({ timeout: 30_000 });
  await arrived.waitForTimeout(500);
  expect(await tryToMove(arrived, "w"), "the board offered no move while a decision was open")
    .not.toBeNull();

  for (let i = 0; i < 6; i += 1) {
    const chip = arrived.locator(".read-chip:visible").first();
    if (await chip.count()) await chip.click();
    const confidence = arrived.locator(".confidence-row button:visible").nth(2);
    if (await confidence.count()) {
      await confidence.click();
      break;
    }
    const next = arrived.locator(".step-next:visible").first();
    if (await next.count()) await next.click();
    await arrived.waitForTimeout(200);
  }
  await arrived.waitForTimeout(300);
  await arrived.locator(".commitment-submit").click();
  await arrived
    .locator(".counterfactual-probe, .reveal-panel, .reveal-failure, .reveal-waiting")
    .first()
    .waitFor({ timeout: 30_000 });
  const none = arrived.locator(".counterfactual-probe__none");
  if (await none.count()) await none.click();
  await arrived.locator(".reveal-panel, .reveal-failure").first().waitFor({ timeout: 180_000 });
  await arrived.waitForTimeout(600);

  await arrived.locator(".explore-toggle").click();
  await arrived.locator(".record-explorer .record-dashboard").waitFor({ timeout: 60_000 });
  await arrived.waitForTimeout(800);
  return arrived;
}

/** The reading column, the board beside it, and the workbench that divides them. */
async function tracks(at: number) {
  await page.setViewportSize({ width: at, height: 900 });
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    const box = (sel: string) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { width: Math.round(b.width), left: Math.round(b.left) };
    };
    return {
      reading: box(".record-explorer"),
      board: box(".board-workspace"),
      workbench: box(".workbench"),
    };
  });
}

describe("the reading column and the screen it was on", () => {
  it(
    "gives the record more room when the screen has more room",
    async () => {
      const narrow = await tracks(1440);
      const wide = await tracks(1854);

      expect(narrow.reading, "no record explorer on screen").not.toBeNull();
      expect(wide.board, "no board on screen").not.toBeNull();

      /*
       * THE COUNTEREXAMPLE. 414 more pixels of screen, and the column holding the record is the
       * one thing on the page that does not see any of them. Measured before the repair:
       * 330 -> 330, while the board went 874 -> 982.
       */
      expect(
        wide.reading!.width,
        `the record column stayed ${narrow.reading!.width}px while the screen grew 414px ` +
          `(board ${narrow.board!.width} -> ${wide.board!.width})`,
      ).toBeGreaterThan(narrow.reading!.width);

      /*
       * POSITIVE CONTROL. Widening the column by collapsing the board would pass the line above
       * and be a worse screen. 480px is the board's own declared minimum in `.workbench` for
       * every viewport this test runs at, and it is not allowed to go under it to buy text width.
       */
      expect(wide.board!.width, "the board was collapsed to buy the column its width")
        .toBeGreaterThanOrEqual(480);
      expect(narrow.board!.width, "the board was collapsed to buy the column its width")
        .toBeGreaterThanOrEqual(480);
    },
    300_000,
  );

  it(
    "draws every axis label inside the picture that draws it",
    async () => {
      await page.setViewportSize({ width: 1854, height: 900 });
      await page.waitForTimeout(400);
      await page.evaluate(() => {
        const heading = [...document.querySelectorAll(".dash-title")].find((el) =>
          /מה שאמרת מול מה שקרה/.test(el.textContent ?? ""),
        );
        heading?.scrollIntoView({ block: "center" });
      });
      await page.waitForTimeout(600);

      const axis = await page.evaluate(() => {
        const svg = document.querySelector(".record-dashboard .chart-frame svg");
        if (!svg) return null;
        const frame = svg.getBoundingClientRect();
        const ticks = [...svg.querySelectorAll("text")]
          .filter((t) => /%/.test(t.textContent ?? ""))
          .map((t) => {
            const b = t.getBoundingClientRect();
            return {
              text: t.textContent ?? "",
              outsideBy: Math.round((frame.left - b.left) * 10) / 10,
              width: Math.round(b.width * 10) / 10,
            };
          });
        return { ticks };
      });

      expect(axis, "the calibration chart is not on the record").not.toBeNull();

      /*
       * POSITIVE CONTROL FIRST, so that "there is no axis" cannot be the way this goes green.
       * A chart with a y-axis has tick labels, and they say a number and not only its unit.
       */
      expect(axis!.ticks.length, "the y-axis has no labels at all").toBeGreaterThanOrEqual(3);
      for (const tick of axis!.ticks) {
        expect(tick.text, `a y-axis tick reads "${tick.text}" with no figure in it`).toMatch(/\d/);
      }

      /*
       * THE COUNTEREXAMPLE. Measured before the repair, at a 922px chart: `0%` and `9%` hung 7.7px
       * past the left edge and `18%`, `27%`, `36%` hung 14px past it -- of a 22px box. What
       * reached the reader was the `%`.
       */
      for (const tick of axis!.ticks) {
        expect(
          tick.outsideBy,
          `the y-axis label "${tick.text}" is ${tick.outsideBy}px of ${tick.width}px outside the chart`,
        ).toBeLessThanOrEqual(0);
      }
    },
    300_000,
  );

  /*
   * THE OTHER TWO CHARTS, WITHOUT RUNNING A GAME REVIEW.
   *
   * `GameReview` draws the same axis twice behind a button that analyses every position in the
   * game, and reaching it in a browser costs minutes of engine time for a geometry fact. The
   * geometry is decided by two literals sitting next to each other in the source, so it is read
   * there: a chart may not pull its y-axis out through the left edge of its own picture.
   *
   * `margin.left` IS THE WHOLE BUG AND THE READ IS EXACT. Recharts places the axis at `margin.left`
   * and right-anchors each label against the axis line, so a negative left margin puts the widest
   * label that many pixels outside the SVG -- 40 - 24 = 16 usable pixels here for a 22px label,
   * and 38 - 22 = 16 there. It is not a tuning value; it is a subtraction from the picture.
   */
  it("does not pull a y-axis out through the left edge, in any chart", () => {
    for (const file of ["client/src/components/RecordDashboard.tsx", "client/src/components/GameReview.tsx"]) {
      const source = readFileSync(resolve(__dirname, "../..", file), "utf8");
      const margins = [...source.matchAll(/margin=\{\{[^}]*left:\s*(-?\d+)/g)].map((m) => ({
        left: Number(m[1]),
        at: source.slice(0, m.index).split("\n").length,
      }));
      expect(margins.length, `${file} declares no chart margins to check`).toBeGreaterThan(0);
      for (const margin of margins) {
        expect(margin.left, `${file}:${margin.at} pulls the chart ${-margin.left}px left of its own picture`)
          .toBeGreaterThanOrEqual(0);
      }
    }
  });

  it(
    "keeps the position on screen while the record about it is read",
    async () => {
      const atChart = async (width: number, height: number) => {
        await page.setViewportSize({ width, height });
        await page.waitForTimeout(400);
        await page.evaluate(() => {
          const heading = [...document.querySelectorAll(".dash-title")].find((el) =>
            /מה שאמרת מול מה שקרה/.test(el.textContent ?? ""),
          );
          heading?.scrollIntoView({ block: "center" });
        });
        await page.waitForTimeout(600);
        return page.evaluate(() => {
          const workspace = document.querySelector(".board-workspace");
          const board = document.querySelector(".board-grid");
          const reading = document.querySelector(".record-explorer");
          if (!workspace || !board || !reading) return null;
          const b = board.getBoundingClientRect();
          const r = reading.getBoundingClientRect();
          return {
            position: getComputedStyle(workspace).position,
            height: Math.round(b.height),
            onScreen: Math.round(
              Math.max(0, Math.min(b.bottom, window.innerHeight) - Math.max(b.top, 0)),
            ),
            overlapsReading: b.right > r.left && b.left < r.right && b.bottom > r.top && b.top < r.bottom,
          };
        });
      };

      const tall = await atChart(1440, 900);
      expect(tall, "the board, the record or the workspace is not on screen").not.toBeNull();

      /*
       * THE COUNTEREXAMPLE. Measured before the repair: 0 of 360 pixels, the board's whole box
       * above the top of the viewport while the reader is at the calibration chart.
       */
      expect(
        tall!.onScreen,
        `the board is ${tall!.onScreen}px of ${tall!.height}px on screen at the calibration chart`,
      ).toBeGreaterThan(0);

      /*
       * POSITIVE CONTROLS, and they are asserted at BOTH viewports because that is what makes them
       * controls rather than restatements. A pin is only allowed to exist where the whole box fits,
       * and nowhere may it sit on top of the column being read.
       *
       * 640px is under the height the workspace needs -- 656px plus its offset, and 656 is constant
       * across every width this rule covers because the board track is fixed at 480px in EXPLORE.
       * So the short viewport is where "sticky" must decline, and this is the line that goes red if
       * the guard is ever loosened past what fits.
       */
      const short = await atChart(1440, 640);
      for (const [label, at] of [
        ["1440x900", tall!],
        ["1440x640", short!],
      ] as const) {
        if (at.position === "sticky") {
          expect(
            at.onScreen,
            `at ${label} the board is pinned with only ${at.onScreen}px of ${at.height}px reachable`,
          ).toBe(at.height);
        }
        expect(at.overlapsReading, `at ${label} the board is sitting on top of the record`).toBe(
          false,
        );
      }
    },
    300_000,
  );
});
