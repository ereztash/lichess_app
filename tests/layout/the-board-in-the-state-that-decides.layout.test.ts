/**
 * The board, in the one state the product exists to measure, in a real browser.
 *
 * WHAT SHIPPED, AND WHY EVERY EXISTING TEST WAS GREEN ON IT. `.workbench` declares three columns
 * -- toolbox, board, task -- and named the column of none of its children. `Home.tsx` REMOVES the
 * toolbox from the DOM while the player is producing evidence (LAW 1, LAW 5): absent, not hidden.
 * So every DECIDE state had two children and three tracks, and grid auto-flow shifted both one
 * track towards the start. The board went into the 132px toolbox track. Measured on the built app:
 *
 * | viewport | `.board-workspace` | `.board-stage` | one square | centre of e2 hit-tests to |
 * | --- | --- | --- | --- | --- |
 * | 1920x1080 | 132px | 92x92 | 9.8px | `span.file-label` |
 * | 1440x900 | 132px | 92x92 | 9.8px | `span.file-label` |
 * | 1280x800 | 132px | 92x92 | 9.8px | `span.file-label` |
 * | 1024x768 | 90px | 50x50 | 4.5px | `span.file-label` |
 * | 390x844 | 370px | 342x342 | 41.5px | the piece |
 *
 * THE BOARD WAS NOT MERELY SMALL. A 9.8px square against this stylesheet's own 44px `--tap-floor`
 * is a target no pointer can acquire, and the coordinate strip sat over the middle of it, so
 * `elementFromPoint` at the centre of e2 returned a label rather than the square. Playwright could
 * not click a square at all: the one act DECIDE exists to collect could not be performed with a
 * mouse on any desktop width. The phone was correct throughout, because at <=680px the workbench
 * abandons grid for flex and `order`, which has no empty-track failure mode.
 *
 * WHY NOTHING CAUGHT IT.
 *
 *   - Six layout suites load `/play`. Not one asserts the geometry of the board there: they audit
 *     axe, the CSP, the record, the tab order, or a route that never reaches this branch.
 *   - `cumulative-layout-shift` visits `/play` at 390 and 1280 and scores SHIFT. A layout that is
 *     consistently wrong from the first paint does not shift, and it scored 0.00000.
 *   - Every jsdom suite renders `<Home>` and asserts what is in the DOM. jsdom has no layout: the
 *     board was in the document, correct, complete, and 0x0 like everything else.
 *   - `ux-contract` reads the stylesheet, and the stylesheet was not wrong on its face -- three
 *     tracks is a reasonable thing to declare. What was wrong was the RELATION between the tracks
 *     and a child list that changes with the interaction state, and no file was reading both.
 *
 * SO THIS FILE ASSERTS BOTH ENDS. The cause -- no child of this grid is placed by auto-flow -- and
 * the outcome -- a square a pointer can hit, and hits. Either alone would have missed it: the
 * outcome assertion cannot say why, and the cause assertion cannot say that a player is unblocked.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, resolve } from "node:path";
import type { Browser, Page } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { launchChromium } from "./browser";

const DIST = resolve(__dirname, "../..", "dist/public");

const TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
};

let browser: Browser;
let server: Server;
let origin: string;

beforeAll(async () => {
  if (!existsSync(join(DIST, "index.html"))) {
    throw new Error("dist/public is not built. Run `npm run build` before the layout tests.");
  }
  server = createServer((req, res) => {
    const url = (req.url ?? "/").split("?")[0];
    let file = join(DIST, url);
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, "index.html");
    res.setHeader("Content-Type", TYPES[extname(file)] ?? "application/octet-stream");
    res.end(readFileSync(file));
  });
  await new Promise<void>((done) => server.listen(0, done));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  browser = await launchChromium();
}, 90_000);

afterAll(async () => {
  await browser?.close();
  await new Promise<void>((done) => (server ? server.close(() => done()) : done()));
});

/**
 * `/play` at a viewport, with the board painted.
 *
 * WAITS FOR A SQUARE AND NOT FOR A TIMEOUT. The board is the subject here; measuring before it
 * exists would report the loading state's geometry under this file's name.
 */
async function openPlay(width: number, height: number): Promise<Page> {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(`${origin}/play`, { waitUntil: "networkidle" });
  await page.locator("[data-square]").first().waitFor({ timeout: 30_000 });
  /* One frame for fonts and the ribbon's reserved slot to settle before anything is measured. */
  await page.waitForTimeout(400);
  return page;
}

/** The desktop widths where the workbench is a grid. 680 and below is a flex column. */
const DESKTOP = [
  { name: "a wide desktop", width: 1920, height: 1080 },
  { name: "a laptop", width: 1440, height: 900 },
  { name: "a small laptop", width: 1280, height: 800 },
  { name: "a narrow desktop", width: 1024, height: 768 },
];

const ALL = [...DESKTOP, { name: "a phone", width: 390, height: 844 }];

describe.each(ALL)("the state that decides, on $name", ({ width, height }) => {
  it("is the DECIDE state, with the toolbox gone and the board in the document", async () => {
    /*
     * THE FLOOR FOR EVERYTHING BELOW. Each assertion in this file is about the state where the
     * toolbox is absent; on any other state they are measuring something else and would pass or
     * fail for reasons that have nothing to do with the defect.
     */
    const page = await openPlay(width, height);
    expect(await page.locator(".workspace-meta p").first().textContent()).toBe("DECIDE");
    expect(await page.locator(".control-rail").count(), "the toolbox is on screen").toBe(0);
    expect(await page.locator("[data-square]").count()).toBe(64);
    await page.close();
  }, 120_000);

  it("says on the workbench which state it is in", async () => {
    /*
     * THE FIX'S PREMISE, ASSERTED SEPARATELY FROM THE FIX'S EFFECT. A layout whose track count
     * depends on the interaction state has to be able to READ the interaction state; the shipped
     * one could not, which is why the template and the child list were free to disagree. The class
     * comes from the same `makingEvidence(stage)` that decides whether the toolbox renders, so
     * these two facts about the DOM cannot come apart -- and this is the assertion that goes red
     * if somebody later gates the toolbox on something else.
     */
    const page = await openPlay(width, height);
    const state = await page.evaluate(() => ({
      toolbox: document.querySelectorAll(".control-rail").length,
      focus: document.querySelectorAll(".workbench.workbench-focus").length,
      workbench: document.querySelectorAll(".workbench").length,
    }));
    expect(state.workbench).toBe(1);
    expect(state.focus, JSON.stringify(state)).toBe(state.toolbox === 0 ? 1 : 0);
    await page.close();
  }, 120_000);

  it("puts a square where a pointer can hit it, and hits it", async () => {
    /*
     * THE OUTCOME ASSERTION, and the reason it is a hit test rather than a width. A square wide
     * enough to click is not the same claim as a square that RECEIVES the click: the shipped
     * board failed both, and the second is the one a player experiences. `--tap-floor` is read
     * from the page rather than written here, so this cannot drift away from the stylesheet's
     * own idea of a target.
     */
    const page = await openPlay(width, height);
    const probe = await page.evaluate(() => {
      const square = document.querySelector('[data-square="e2"]')!;
      /* `elementFromPoint` hit-tests the viewport only; a square below the fold returns null. */
      square.scrollIntoView({ block: "center" });
      const box = square.getBoundingClientRect();
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return {
        side: box.width,
        tapFloor: Number.parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue("--tap-floor"),
        ),
        /* Not `hit === square`: the piece and the coordinate labels are legitimately inside it. */
        insideTheSquare: hit instanceof Element && hit.closest('[data-square="e2"]') !== null,
        hit: hit instanceof Element ? `${hit.tagName.toLowerCase()}.${hit.className}` : null,
      };
    });
    /*
     * THE PHONE IS EXEMPT FROM THE FLOOR AND NOT FROM THE HIT TEST. Eight squares across 342px is
     * 42.75px at most, so a 44px floor is unreachable there by arithmetic rather than by a defect,
     * and asserting it would be asserting that the board should not fit the screen. What can be
     * asserted everywhere is that the square receives the pointer.
     */
    if (width > 680) {
      expect(probe.side, `a ${probe.side.toFixed(1)}px square against a ${probe.tapFloor}px floor`)
        .toBeGreaterThanOrEqual(probe.tapFloor);
    }
    expect(probe.insideTheSquare, `the centre of e2 belongs to ${probe.hit}`).toBe(true);
    await page.close();
  }, 120_000);

  it("does not push the page sideways", async () => {
    const page = await openPlay(width, height);
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      inner: window.innerWidth,
    }));
    expect(overflow.scrollWidth, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.inner);
    await page.close();
  }, 120_000);
});

describe.each(DESKTOP)("the workbench places its children, on $name", ({ width, height }) => {
  it("leaves no child of the grid to auto-flow", async () => {
    /*
     * THE CAUSE ASSERTION, and it is the one that generalises. Auto-flow is correct for a grid
     * whose children are fixed; this grid's children depend on the interaction state, and there
     * placement by position means the meaning of a track changes when a sibling disappears. Any
     * child added here without a column of its own re-seats every child after it.
     */
    const page = await openPlay(width, height);
    const placed = await page.evaluate(() => {
      const workbench = document.querySelector(".workbench")!;
      return {
        display: getComputedStyle(workbench).display,
        children: [...workbench.children].map((child) => ({
          className: String(child.className),
          column: getComputedStyle(child).gridColumnStart,
        })),
      };
    });
    expect(placed.display, "the workbench is not a grid at this width").toBe("grid");
    expect(placed.children.length).toBeGreaterThan(0);
    for (const child of placed.children) {
      expect(child.column, `.${child.className.split(" ")[0]} is placed by auto-flow`).not.toBe(
        "auto",
      );
    }
    await page.close();
  }, 120_000);

  it("gives the board the widest track it declares", async () => {
    /*
     * WHAT WENT WRONG, STATED AS A RELATION RATHER THAN AS A NUMBER. The board sat in the 132px
     * toolbox track while the commitment panel sat in the board's. A pixel expectation would have
     * to be maintained per breakpoint and would go red for a deliberate change; "the board's
     * column is the largest one on the screen" is the intent and survives re-sizing.
     */
    const page = await openPlay(width, height);
    const boxes = await page.evaluate(() => {
      const width = (sel: string) => {
        const el = document.querySelector(sel);
        return el ? el.getBoundingClientRect().width : null;
      };
      return {
        board: width(".board-workspace"),
        task: width(".analysis-stack"),
        stage: width(".board-stage"),
      };
    });
    expect(boxes.board, "no board workspace").not.toBeNull();
    expect(boxes.board!, JSON.stringify(boxes)).toBeGreaterThanOrEqual(boxes.task!);
    /* The declared floor of the board's track at every desktop breakpoint. */
    expect(boxes.board!, JSON.stringify(boxes)).toBeGreaterThanOrEqual(420);
    await page.close();
  }, 120_000);
});

describe("the shell's bands agree about where the page ends", () => {
  it("holds one measure across the header, the workbench and the timeline", async () => {
    /*
     * ONLY VISIBLE ABOVE 1548px, which is why it shipped. `.studio-header, .workbench,
     * .move-timeline { max-width: 1500px; margin: auto; }` was destroyed by an insertion that put
     * a new selector between the second and the third -- legal CSS, no warning, and the header and
     * the workbench silently joined the review-stats rule instead. At 1920 they measured 1872px
     * while the timeline directly beneath them held its 1500. Every browser audit this repository
     * had was at 1440 or narrower, where a 1500px cap cannot bind.
     */
    const page = await openPlay(1920, 1080);
    const widths = await page.evaluate(() =>
      [".studio-header", ".workbench", ".move-timeline"].map((sel) => {
        const el = document.querySelector(sel);
        return { sel, width: el ? Math.round(el.getBoundingClientRect().width) : null };
      }),
    );
    for (const band of widths) expect(band.width, `${band.sel} is not on the page`).not.toBeNull();
    expect(new Set(widths.map((b) => b.width)).size, JSON.stringify(widths)).toBe(1);
    await page.close();
  }, 120_000);
});

describe("the evaluation column", () => {
  it.each(ALL)("does not move the board when it fills, on $name", async ({ width, height }) => {
    /*
     * THE SECOND HALF OF THE BOARD'S CONTRACT, and it is the reason the 28px column is reserved
     * while the engine is silent rather than being created at the reveal. The two requirements --
     * the board must not sit IN the evaluation's column, and the board must not JUMP when the
     * evaluation arrives -- are only jointly satisfiable by reserving it, so an empty column
     * during DECIDE is the price of the second and not an oversight.
     *
     * A STYLESHEET PROBE AND IT SAYS SO. Reaching the reveal needs the engine and a stored commit;
     * what is asked here is narrower and entirely decided by CSS, so the instrument is inserted
     * into the assembly and the board is measured on both sides of the insertion.
     */
    const page = await openPlay(width, height);
    const moved = await page.evaluate(() => {
      const stage = () => {
        const box = document.querySelector(".board-stage")!.getBoundingClientRect();
        return { x: Math.round(box.x), width: Math.round(box.width) };
      };
      const before = stage();
      const assembly = document.querySelector(".board-assembly")!;
      const bar = document.createElement("div");
      bar.className = "evaluation-instrument";
      bar.innerHTML = '<div class="evaluation-track"></div><span>0.0</span>';
      assembly.insertBefore(bar, assembly.firstChild);
      return { before, after: stage() };
    });
    expect(moved.after, JSON.stringify(moved)).toEqual(moved.before);
    await page.close();
  }, 120_000);
});

/**
 * The other way a board becomes unplayable, found by trying to break the fix rather than by a
 * report. `.board-stage` is bounded by `calc(100vh - 268px)`, and a subtraction with no floor
 * keeps subtracting: at 1440x620 that was a 352px board, at 1280x550 a 282px one, and a landscape
 * phone at 844x390 got a 122px board with 13.5px squares. The width was never the problem on any
 * of them -- the height bound was, and it was doing exactly what it was written to do.
 */
describe.each([
  { name: "a short desktop", width: 1440, height: 620 },
  { name: "a shorter desktop", width: 1280, height: 550 },
  { name: "a short narrow desktop", width: 1024, height: 600 },
  { name: "a phone on its side", width: 844, height: 390 },
  { name: "a smaller phone on its side", width: 812, height: 375 },
])("the board under height pressure, on $name", ({ width, height }) => {
  it("keeps every square at the tap floor and lets the page scroll instead", async () => {
    const page = await openPlay(width, height);
    const probe = await page.evaluate(() => {
      /*
       * READ BEFORE SCROLLING. `elementFromPoint` only hit-tests the visible viewport, so a square
       * below the fold returns null however clickable it is -- which on these viewports is most of
       * the board. Bringing it into view is what a player does; doing it AFTER the arrival
       * position is recorded is what keeps the two facts separate.
       */
      const scrolledOnLoad = Math.round(window.scrollY);
      const el = document.querySelector('[data-square="e2"]')!;
      el.scrollIntoView({ block: "center" });
      const square = el.getBoundingClientRect();
      const hit = document.elementFromPoint(
        square.x + square.width / 2,
        square.y + square.height / 2,
      );
      return {
        scrolledOnLoad,
        side: square.width,
        tapFloor: Number.parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue("--tap-floor"),
        ),
        insideTheSquare: hit instanceof Element && hit.closest('[data-square="e2"]') !== null,
        overflowX: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    expect(probe.side, `a ${probe.side}px square against a ${probe.tapFloor}px floor`)
      .toBeGreaterThanOrEqual(probe.tapFloor);
    expect(probe.insideTheSquare).toBe(true);
    expect(probe.overflowX, "the page scrolls sideways").toBe(false);
    /*
     * THE PRICE, ASSERTED SO IT STAYS THE PRICE. These viewports are now taller than their own
     * window, and that is the deliberate trade: the mobile invariant permits scrolling to reach
     * the rest of the task and does not permit a board nobody can play. What it does not permit
     * is the page ARRIVING scrolled, which is the assertion below.
     */
    expect(probe.scrolledOnLoad, "the page arrived already scrolled").toBe(0);
    await page.close();
  }, 120_000);
});

describe("the decision on a phone", () => {
  /*
   * SEQUENCE AND NOT COORDINATES (the mobile invariant). At <=680px the workbench is a flex column
   * and the order is set by `order`, not by the DOM, so this is exactly the case the accessibility
   * constraints call suspect: it asserts the VISUAL order and, separately, that the DOM order the
   * keyboard and a screen reader follow has not been inverted to produce it.
   */
  it("puts the board first, the task under it and the tools last", async () => {
    const page = await openPlay(390, 844);
    const order = await page.evaluate(() => {
      const workbench = document.querySelector(".workbench")!;
      return [...workbench.children].map((child) => ({
        className: String(child.className).split(" ")[0],
        top: Math.round(child.getBoundingClientRect().y + window.scrollY),
      }));
    });
    const board = order.find((c) => c.className === "board-workspace");
    const task = order.find((c) => c.className === "analysis-stack");
    expect(board, JSON.stringify(order)).toBeTruthy();
    expect(task, JSON.stringify(order)).toBeTruthy();
    expect(board!.top, JSON.stringify(order)).toBeLessThan(task!.top);
    /* And the DOM says the same thing, so `order` is not reversing anything a reader follows. */
    expect(order.map((c) => c.className)).toEqual(["board-workspace", "analysis-stack"]);
    await page.close();
  }, 120_000);

  it("exposes the next step after the move, and not before it", async () => {
    /*
     * The move is made ON THE BOARD and the question about it is below the fold; the invariant is
     * that the page is still at the top when it loads and that the step the player now has to
     * answer is reachable after they act. Nothing here presses submit: this file does not commit
     * decisions, it measures the screen that collects one.
     */
    const page = await openPlay(390, 844);
    expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(0);
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();
    const chosen = page.locator(".step-answer").first();
    await chosen.waitFor({ timeout: 10_000 });
    expect((await chosen.textContent())?.trim(), "the board move never reached the step").toContain(
      "e",
    );
    await page.close();
  }, 120_000);
});

describe("the toolbox returning", () => {
  it.each(DESKTOP)("moves the board by exactly one track and nothing else, on $name", async ({
    width,
    height,
  }) => {
    /*
     * THE TOLERANCE IS NOT A NUMBER OF PIXELS, it is an identity. A budget -- "under 100px" -- has
     * to be picked, and a picked number is a preference wearing a measurement's clothes. What
     * continuity actually means here is that the board moves BECAUSE a column appeared beside it
     * and for no other reason: displaced by exactly that column's width plus the gap, and not
     * resized at all. Driven on the live app at 1440x900 the reveal measured dx -82, dw 0, dy 0,
     * and 132 + 32 is 164, which is twice 82 because the board is centred in its own track: adding
     * the toolbox's track SHRINKS the board's by 164 from one end -- measured at 1440, x=386 w=1030
     * becomes x=386 w=866 -- and a centred box inside it moves by half of that. So the assertion is
     * `displacement === (rail track + gap) / 2`, at every desktop breakpoint, which holds for the
     * >1050 template and the narrower one alike and goes red for any movement with another cause.
     *
     * A STYLESHEET PROBE AND IT SAYS SO. Reaching a stored reveal needs the engine and a completed
     * write, which this file does not do; the geometry of the three-child state is decided
     * entirely by CSS, so the toolbox is inserted and the focus class removed.
     */
    const page = await openPlay(width, height);
    const moved = await page.evaluate(() => {
      const stage = () => {
        const box = document.querySelector(".board-stage")!.getBoundingClientRect();
        return { x: Math.round(box.x), width: Math.round(box.width) };
      };
      const workbench = document.querySelector(".workbench")!;
      /* The computed value carries the line names, so count the track SIZES rather than tokens. */
      const sizes = (of: string) => (of.match(/[\d.]+px/g) ?? []).map(Number.parseFloat);
      const before = stage();
      const beforeTracks = sizes(getComputedStyle(workbench).gridTemplateColumns).length;
      workbench.classList.remove("workbench-focus");
      const rail = document.createElement("aside");
      rail.className = "control-rail";
      rail.innerHTML = '<div class="rail-label">x</div>';
      workbench.insertBefore(rail, workbench.firstChild);
      const style = getComputedStyle(workbench);
      return {
        before,
        after: stage(),
        beforeTracks,
        afterTracks: sizes(style.gridTemplateColumns).length,
        railTrack: sizes(style.gridTemplateColumns)[0],
        gap: Number.parseFloat(style.columnGap),
        /* The toolbox landed in the track named for it, rather than displacing anybody. */
        railColumn: getComputedStyle(rail).gridColumnStart,
        boardColumn: getComputedStyle(document.querySelector(".board-workspace")!).gridColumnStart,
      };
    });
    expect(moved.afterTracks, JSON.stringify(moved)).toBe(moved.beforeTracks + 1);
    expect(moved.railColumn).toBe("rail");
    expect(moved.boardColumn).toBe("board");
    expect(moved.after.width, "the board resized when the toolbox appeared").toBe(
      moved.before.width,
    );
    expect(
      moved.before.x - moved.after.x,
      `the board moved by something other than the new column: ${JSON.stringify(moved)}`,
    ).toBe(Math.round((moved.railTrack + moved.gap) / 2));
    await page.close();
  }, 120_000);
});
