/**
 * The control that records a decision, painted, in every state it renders in.
 *
 * WHAT SHIPPED, AND WHY THE TEST FOR IT WAS GREEN. `.commitment-submit` is `position: sticky;
 * bottom: 8px`, so while the panel is taller than the viewport it is pinned over the panel's own
 * content. The base rule declares an opaque ground and says why in a comment:
 *
 *     Opaque: it sits over the panel's own content while the panel scrolls under it.
 *
 * `.commitment-submit.not-ready`, 1,552 lines further down the same file, declared
 * `background: transparent` -- and `not-ready` is the panel's DEFAULT state, the one every
 * decision starts in. So the transparent case was the ordinary case. Photographed on the built
 * app at 390x844, scrolled to y=400: the read chips of step 2 render straight through
 * `חסר: בחרו רמת ביטחון`. The one control the measurement loop exists to collect was illegible
 * during ordinary scrolling of the instrument.
 *
 * `tests/client/ux-contract.test.ts` had an assertion for exactly this and it passed the whole
 * time. It matched `background: var(--surface)` inside the block for `.commitment-submit`, which
 * was true, while the state that rendered was governed by a different selector. **A
 * selector-scoped assertion cannot see a cascade**, which is the same shape as the `.workbench`
 * defect that `docs/INTERACTION_GEOMETRY.md` records: a container and its children governed by
 * two conditions, and nothing reading both.
 *
 * SO THIS FILE READS THE PAINT. Not the rule -- the composited background of the element that is
 * actually on the screen, in both states, at the width where the panel scrolls. A source-level
 * check cannot do that, and this is the level at which the defect was visible to a person.
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

async function openPlay(width: number, height: number): Promise<Page> {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(`${origin}/play`, { waitUntil: "networkidle" });
  await page.locator("[data-square]").first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(400);
  return page;
}

/** The alpha of the control's own painted background, as the compositor sees it. */
function groundAlpha() {
  const el = document.querySelector(".commitment-submit");
  if (!el) return null;
  const bg = getComputedStyle(el).backgroundColor;
  const parts = bg.match(/[\d.]+/g);
  if (!parts) return null;
  return { bg, alpha: parts.length > 3 ? Number(parts[3]) : 1 };
}

/**
 * A phone, because that is where the panel is reliably taller than the viewport and the sticky
 * behaviour is not hypothetical. 375 and 360 render the same clash; 390 is the one photographed.
 */
describe.each([
  { name: "a phone", width: 390, height: 844 },
  { name: "a small phone", width: 360, height: 740 },
])("the submit's ground, on $name", ({ width, height }) => {
  it("is opaque in the not-ready state, which is the state every decision starts in", async () => {
    const page = await openPlay(width, height);
    const submit = page.locator(".commitment-submit");
    expect(await submit.getAttribute("class")).toContain("not-ready");
    const painted = await page.evaluate(groundAlpha);
    expect(painted, "the control is not on the screen at all").not.toBeNull();
    expect(
      painted!.alpha,
      `not-ready paints ${painted!.bg}: the panel's own chips render through the button`,
    ).toBe(1);
    await page.close();
  });

  it("is opaque once the decision is ready to record", async () => {
    const page = await openPlay(width, height);
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();
    await page.waitForTimeout(600);
    for (let i = 0; i < 4; i += 1) {
      const chip = page.locator(".read-chip:visible").first();
      if (await chip.count()) await chip.click();
      const confidence = page.locator(".confidence-row button:visible").nth(2);
      if (await confidence.count()) {
        await confidence.click();
        break;
      }
      const next = page.locator(".step-next:visible").first();
      if (await next.count()) await next.click();
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(400);
    const painted = await page.evaluate(groundAlpha);
    expect(painted!.alpha, `ready paints ${painted!.bg}`).toBe(1);
    await page.close();
  });

  it("stays opaque while pinned, with the instrument scrolling under it", async () => {
    /*
     * THE PHOTOGRAPH, AS AN ASSERTION. Pinned means the control's bottom edge is at the
     * viewport's, which is when content passes behind it -- and the whole defect is that the
     * content was visible THROUGH it. `elementFromPoint` across the button's own box must return
     * the button at every sample; a transparent ground still hit-tests, so this is checked
     * together with the alpha above rather than instead of it.
     */
    const page = await openPlay(width, height);
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();
    await page.waitForTimeout(700);
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(350);
    const seen = await page.evaluate(() => {
      const el = document.querySelector(".commitment-submit");
      if (!el) return null;
      const box = el.getBoundingClientRect();
      const pinned = Math.abs(box.bottom - (window.innerHeight - 8)) < 2;
      const hits: string[] = [];
      for (const fraction of [0.08, 0.3, 0.5, 0.7, 0.92]) {
        const hit = document.elementFromPoint(box.x + box.width * fraction, box.y + box.height / 2);
        hits.push(hit ? hit.className.toString() : "null");
      }
      return { pinned, hits, alpha: getComputedStyle(el).backgroundColor };
    });
    expect(seen!.pinned, "the control is not pinned at this scroll offset").toBe(true);
    for (const hit of seen!.hits) expect(hit).toContain("commitment-submit");
    expect(seen!.alpha).not.toContain("rgba(0, 0, 0, 0)");
    await page.close();
  });
});

/**
 * THE OTHER HALF, AND IT IS A DIFFERENT CLAIM. Legibility is not salience: a control can be
 * perfectly readable and still be the second-loudest thing on the screen, which is what this one
 * was. It rendered in this stylesheet's SECONDARY language -- a cream ground and a hairline --
 * while `.primary-control`, the button that offers "take another decision" AFTER the reveal,
 * rendered a filled `--blue`. Two primary actions in two languages, and the quieter one was the
 * one that records a measurement.
 *
 * `Home.tsx` had already decided this and the stylesheet had not followed: *"The blue belongs to
 * the commitment panel's submit."*
 */
describe("the ready submit is the loudest control in the state that records a decision", () => {
  it("is painted in the same language as the product's other primary action", async () => {
    const page = await openPlay(1440, 900);
    await page.locator('[data-square="e2"]').click();
    await page.locator('[data-square="e4"]').click();
    await page.waitForTimeout(600);
    for (let i = 0; i < 4; i += 1) {
      const chip = page.locator(".read-chip:visible").first();
      if (await chip.count()) await chip.click();
      const confidence = page.locator(".confidence-row button:visible").nth(2);
      if (await confidence.count()) {
        await confidence.click();
        break;
      }
      const next = page.locator(".step-next:visible").first();
      if (await next.count()) await next.click();
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(400);
    const weights = await page.evaluate(() => {
      const accent = getComputedStyle(document.documentElement).getPropertyValue("--blue").trim();
      const submit = document.querySelector(".commitment-submit")!;
      return {
        ready: !submit.className.includes("not-ready"),
        ground: getComputedStyle(submit).backgroundColor,
        accent,
      };
    });
    expect(weights.ready, "the panel never reached the ready state").toBe(true);
    /* --blue is #1e5b72 in the light palette. Compare as painted, not as a literal. */
    expect(weights.ground).toBe("rgb(30, 91, 114)");
    await page.close();
  });
});
