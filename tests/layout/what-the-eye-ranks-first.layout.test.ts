/**
 * The rank of things, measured on the painted page rather than read off the stylesheet.
 *
 * WHAT THIS IS FOR, AND WHAT IT IS DELIBERATELY NOT FOR. Nothing here scores beauty and nothing
 * here counts boxes. `expect(borderCount).toBeLessThan(7)` is a number with no invariant behind
 * it: it goes red when somebody adds a legitimate seventh border and stays green while the page
 * falls apart in six. Every assertion below is a RELATION that has a reason, and the reason is
 * either a mode contract or a rule about what a size means.
 *
 * WHY IT HAS TO RUN IN A BROWSER. `tests/client/piece-and-panel-weight.test.ts` holds the scale
 * to being declared and used, and it cannot see what is on the screen: a heading and its body can
 * both come from the scale and still be the wrong way round, and a size can be inherited from
 * somewhere the rule never mentions. `.value-triple .value-number` -- the element a `Value`
 * exists to show -- declared no font-size at all and inherited whatever it landed in. A
 * stylesheet reader cannot find that; a browser can.
 *
 * WHAT WAS MEASURED HERE BEFORE THE CHANGE, on the built app at 1440x900:
 *
 *   DECIDE   37 text runs at 10px, one at 20px, and the 20px one was `עמדת פתיחה` -- the NAME of
 *            the position. The question the panel asks was one rank below its own subject.
 *   EXPLORE  258 runs, 190 of them between 10 and 12px, and `h3` rendered at 11, 12 AND 14.
 *   REFLECT  127 runs, 59 at 10px and 30 at 11px, with every section heading at the smallest
 *            rank in the product and in the lowest-contrast colour on the page.
 *
 * 235 of 258 font-size declarations resolved to 10, 11 or 12 pixels: steps of 1.10x and 1.09x,
 * which is below what an eye ranks. Nothing receded, so everything competed.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, resolve } from "node:path";
import type { Browser, Page } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MODE_CONTRACT } from "@shared/interaction-mode";
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

async function open(path: string, width = 1440, height = 900): Promise<Page> {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(`${origin}${path}`, { waitUntil: "networkidle" });
  if (path === "/play") await page.locator("[data-square]").first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(600);
  return page;
}

/**
 * One decision, taken for real, so the states past DECIDE exist.
 *
 * THE STATES THAT HOLD THE DEFECTS ARE NOT THE ONES A COLD LOAD RENDERS, and the first version of
 * this file learnt that the hard way: four of its six assertions were green against the shipped
 * stylesheet, because a cold `/play` has no reveal blocks and a cold `/` has no dashboard. An
 * assertion that cannot reach the thing it is about is not coverage, which is the standard
 * `tests/layout/browser.ts` already sets for this directory.
 *
 * So a decision is committed and the record is read back. `.reveal-block h3`, `.section-heading`,
 * `.dash-title`, the calibration chart's axis ticks and `.value-fraction` all exist only on the
 * far side of this.
 */
async function commitOneDecision(page: Page): Promise<void> {
  await page.locator('[data-square="e2"]').click();
  await page.locator('[data-square="e4"]').click();
  await page.waitForTimeout(700);
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
  await page.locator(".commitment-submit").click();
  await page.waitForTimeout(2500);
  /* The counterfactual probe fires on a sample of decisions; step past it when it is open. */
  const probe = page.locator(".counterfactual-probe button").last();
  if (await probe.count()) await probe.click().catch(() => undefined);
  await page.locator(".reveal-panel").first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(2500);
}

/** The reveal, reached by taking a decision. */
async function openReveal(): Promise<Page> {
  const page = await open("/play");
  await commitOneDecision(page);
  return page;
}

/** The record, with something on it. */
async function openRecordWithData(): Promise<Page> {
  const page = await open("/play");
  await commitOneDecision(page);
  await page.goto(`${origin}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  return page;
}

/**
 * Every visible run of text, with the size it actually paints at.
 *
 * OWN TEXT ONLY -- a node's own text children, not its descendants' -- because an ancestor's
 * `textContent` is every size under it at once and ranks nothing.
 */
function runs() {
  const out: Array<{ px: number; cls: string; tag: string; text: string }> = [];
  for (const el of Array.from(document.querySelectorAll("body *"))) {
    const own = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => (n.textContent ?? "").trim())
      .join(" ")
      .trim();
    if (!own) continue;
    const box = el.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) continue;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || Number(style.opacity) < 0.05) continue;
    out.push({
      px: parseFloat(style.fontSize),
      cls: typeof el.className === "string" ? el.className : "",
      tag: el.tagName.toLowerCase(),
      text: own.slice(0, 60),
    });
  }
  return out;
}

/**
 * THE FLOOR IS A RANK, NOT A PREFERENCE.
 *
 * `--panel-fine` is the smallest step the scale has, and its job is kickers, counters,
 * provenance and board coordinates. Anything painting SMALLER than it is off the scale -- and
 * three things were: `.value-fraction` at `0.72em` (7.92px, and `em` was missing from the unit
 * list the stylesheet test checks), and chart axis ticks at `fontSize: 9` written as raw numbers
 * in JSX, where no stylesheet reader could ever see them.
 *
 * The two exemptions are drawings rather than text and both are named at their declaration: the
 * brand knight and a piece sized in `cqmin` to the square under it.
 */
describe.each([
  { name: "the state that decides", open: () => open("/play") },
  { name: "the front door", open: () => open("/") },
  { name: "the reveal", open: openReveal },
  { name: "the record, with something on it", open: openRecordWithData },
])("nothing paints below the scale on $name", ({ open: openState }) => {
  it("has no text smaller than --panel-fine", async () => {
    const page = await openState();
    const floor = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--panel-fine")),
    );
    expect(floor, "--panel-fine is not declared").toBeGreaterThan(0);
    const below = (await page.evaluate(runs)).filter(
      (r) => r.px < floor && !/\bpiece\b|brand-mark/.test(r.cls),
    );
    expect(
      below,
      `text below the scale's own floor:\n${below.map((b) => `${b.px}px ${b.cls} ${JSON.stringify(b.text)}`).join("\n")}`,
    ).toEqual([]);
    await page.close();
  }, 90_000);
});

/**
 * A HEADING IS NEVER SMALLER THAN THE BODY UNDER IT.
 *
 * The one relation a heading exists to express. It was inverted in six places, all of them by
 * the same mechanism: a heading picked `--panel-body` or `--panel-label` back when body was 12px
 * and the difference did not show. `.reveal-block h3` and `.claim-panel > h3` sat at body rank;
 * `.review-moments h4` sat BELOW it; and `.section-heading`, which names a whole region of the
 * record, sat at the kicker rank in the lowest-contrast colour on the page.
 */
describe("headings outrank what they head", () => {
  it.each([
    { name: "the state that decides", open: () => open("/play") },
    { name: "the front door", open: () => open("/") },
    { name: "the reveal", open: openReveal },
    { name: "the record, with something on it", open: openRecordWithData },
  ])("holds on $name", async ({ open: openState }) => {
    const page = await openState();
    const inversions = await page.evaluate(() => {
      const bad: string[] = [];
      const sizeOf = (el: Element) => parseFloat(getComputedStyle(el).fontSize);
      for (const heading of Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6"))) {
        const box = heading.getBoundingClientRect();
        if (box.width < 1 || box.height < 1) continue;
        const head = sizeOf(heading);
        /*
         * The body a heading heads: the paragraphs and list items that FOLLOW it inside the same
         * section, stopping at the next heading of any level. A heading is not responsible for
         * prose that belongs to something else.
         */
        let node: Element | null = heading.nextElementSibling;
        const section = heading.closest("section, article, div") ?? document.body;
        while (node) {
          if (/^H[1-6]$/.test(node.tagName)) break;
          for (const prose of [
            node,
            ...Array.from(node.querySelectorAll("p, li, span")),
          ]) {
            if (!/^(P|LI|SPAN)$/.test(prose.tagName)) continue;
            /*
             * ONLY ELEMENTS THAT PAINT THEIR OWN TEXT. An `<li>` whose text lives in child spans
             * still has a computed font-size -- inherited, and painted by nothing -- and the
             * first version of this check compared against it: `.unclear__item` reported 16px
             * from the document default while every glyph in it painted at 14 or 11. Comparing a
             * heading against a size nothing draws finds inversions that are not on the screen.
             */
            const own = Array.from(prose.childNodes)
              .filter((n) => n.nodeType === 3)
              .map((n) => (n.textContent ?? "").trim())
              .join("")
              .trim();
            if (!own) continue;
            /*
             * A READING IS NOT PROSE, and a small label over a large number is the stat tile --
             * a correct pattern, not an inversion. `Value` renders every reading in this product
             * and marks it; a count beside a title is the same shape. The invariant is about the
             * text a heading INTRODUCES, not about the value it labels.
             */
            if (prose.closest(".value-triple")) continue;
            if (/(^|\s)(value-|data-chip)|__count(\s|$)/.test((prose as HTMLElement).className))
              continue;
            const rect = prose.getBoundingClientRect();
            if (rect.width < 1 || rect.height < 1) continue;
            const body = sizeOf(prose);
            if (body > head)
              bad.push(
                `${heading.tagName}.${heading.className} ${head}px < ${body}px on ` +
                  `${prose.tagName}.${(prose as HTMLElement).className} ` +
                  `"${(prose.textContent ?? "").trim().slice(0, 40)}"`,
              );
          }
          if (!section.contains(node)) break;
          node = node.nextElementSibling;
        }
      }
      return bad;
    });
    expect(inversions, `a heading smaller than its body:\n${inversions.join("\n")}`).toEqual([]);
    await page.close();
  }, 90_000);
});

/**
 * THE TASK OUTRANKS ITS OWN SUBJECT'S LABEL, in the one state the product exists to measure.
 *
 * `MODE_CONTRACT.DECIDE.central` is "the commitment", and the commitment panel's heading is the
 * question it asks. The largest non-decorative text on this screen was `עמדת פתיחה` at
 * `--panel-heading` -- the NAME of the position -- with the question one rank below it at
 * `--panel-title`. A name is a reading; the question is the region. They have swapped.
 *
 * ASSERTED AS A RELATION AND NOT AS A NUMBER, because a number would go red the first time the
 * scale is re-spaced for a reason that has nothing to do with this.
 */
describe("the state that decides ranks the task above the label", () => {
  it("gives the commitment panel's question more weight than the position's name", async () => {
    const page = await open("/play");
    expect(MODE_CONTRACT.DECIDE.central).toBe("the commitment");
    const ranks = await page.evaluate(() => {
      const px = (sel: string) => {
        const el = document.querySelector(sel);
        return el ? parseFloat(getComputedStyle(el).fontSize) : null;
      };
      return { question: px(".commitment-header h2"), label: px(".workspace-meta h1") };
    });
    expect(ranks.question, "the commitment panel is not on screen").not.toBeNull();
    expect(ranks.label, "the board's caption is not on screen").not.toBeNull();
    expect(
      ranks.question! > ranks.label!,
      `the question is ${ranks.question}px and the position's name is ${ranks.label}px`,
    ).toBe(true);
    await page.close();
  }, 60_000);

  it("makes the question the largest text outside the board", async () => {
    const page = await open("/play");
    const top = (await page.evaluate(runs))
      .filter((r) => !/\bpiece\b|brand-mark|rank-label|file-label/.test(r.cls))
      .sort((a, b) => b.px - a.px);
    expect(top[0]?.text, `the loudest text on DECIDE is ${JSON.stringify(top[0])}`).toContain(
      "מה העמדה הזו דורשת",
    );
    await page.close();
  }, 60_000);
});
