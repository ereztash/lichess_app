/**
 * The two states the accessibility audit could not see, audited.
 *
 * WHAT WAS WRONG, AND IT WAS NOT A MISSING RULE. `axe-on-the-built-app.layout.test.ts` audits three
 * routes -- `/`, `/play`, `/blitz` -- in their COLD state, and it says so in its own header:
 * *"this list is routes, and that file is states"*, pointing at `every-blitz-state` for the states
 * behind a click. That division is right, and it left a hole: `every-blitz-state` drives BLITZ.
 * Nothing drove the decision loop. So `REVEAL` had never been audited, and neither had `/` with a
 * record on it -- which are, between them, most of what a player actually reads.
 *
 * WHAT WAS IN THE HOLE. Run for the first time, against the tree at `5ecc58e`:
 *
 *   /  with a record   27 serious color-contrast failures across eight classes, 2.83:1 to 4.49:1
 *                      1 moderate heading-order (`.finding__headline`, an h3 under an h1)
 *   REVEAL             1 moderate heading-order (`.reveal-limits > h3`, three h3s under an h1)
 *
 * Twenty-eight violations, in a suite reporting green, because the suite stopped one click short of
 * them. `tests/layout/browser.ts` refuses to skip when there is no browser, on the argument that
 * *"a test that passes because it did not run is the exact failure the product is about"*. A test
 * that passes because it never reached the state is the same failure with a longer fuse.
 *
 * THE FIXES ARE ELSEWHERE AND THIS FILE IS THE GUARD. The contrast defect was one mechanism in two
 * shapes -- `opacity` on text, and `rgba(var(--ink-rgb), a)` as a text colour -- both recorded at
 * `.value-triple` in `index.css`. What this file exists to do is fail the next time either comes
 * back, in a state a cold route audit cannot see.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, resolve } from "node:path";
import type { Browser, Page } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { launchChromium } from "./browser";

const DIST = resolve(__dirname, "../..", "dist/public");
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

interface Violation {
  id: string;
  impact: string | null;
  nodes: number;
  target: string;
}
interface Audit {
  violations: Violation[];
  rulesRun: number;
  /** The floor: something only this state renders. */
  markers: number;
}

let browser: Browser;
let server: Server;
let origin: string;

beforeAll(async () => {
  if (!existsSync(join(DIST, "index.html"))) {
    throw new Error("dist/public is not built. Run `npm run build` before the layout tests.");
  }
  server = createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
    let file = join(DIST, url);
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, "index.html");
    res.setHeader("Content-Type", TYPES[extname(file)] ?? "application/octet-stream");
    res.end(readFileSync(file));
  });
  await new Promise<void>((done) => server.listen(0, done));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  browser = await launchChromium();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await new Promise<void>((done) => (server ? server.close(() => done()) : done()));
});

/**
 * One decision, taken for real.
 *
 * THE SAME WALK `what-the-eye-ranks-first` USES, and for the reason that file gives: the states
 * holding the defects are not the ones a cold load renders. A reveal panel, a finding card and a
 * record with `n=1` on it all exist only on the far side of a committed decision.
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

async function runAxe(page: Page, marker: string): Promise<Audit> {
  await page.addScriptTag({ content: axeSource });
  return (await page.evaluate(async (selector: string) => {
    const axe = (window as unknown as { axe: { run: (ctx: unknown) => Promise<unknown> } }).axe;
    const run = (await axe.run(document)) as {
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
      markers: document.querySelectorAll(selector).length,
    };
  }, marker)) as Audit;
}

describe("the states past a commit, audited by the same engine as the routes", () => {
  const audits = new Map<string, Audit>();

  beforeAll(async () => {
    const page = await browser.newPage({ viewport: { width: 1350, height: 940 } });
    await page.goto(`${origin}/play`, { waitUntil: "networkidle" });
    await page.locator("[data-square]").first().waitFor({ timeout: 30_000 });
    await commitOneDecision(page);
    audits.set("REVEAL", await runAxe(page, ".reveal-panel"));

    /* The record, read back, which is the state that held twenty-seven of the twenty-eight. */
    await page.goto(`${origin}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    audits.set("REFLECT", await runAxe(page, ".finding"));
    await page.close();

    /* eslint-disable no-console */
    for (const [state, a] of audits)
      console.log(
        `  ${state.padEnd(8)} ${a.rulesRun} rules evaluated, ${a.markers} markers, ` +
          `${a.violations.length} violations` +
          (a.violations.length
            ? `\n${a.violations.map((v) => `      ${v.impact ?? "?"}  ${v.id}  x${v.nodes}  ${v.target}`).join("\n")}`
            : ""),
      );
  }, 600_000);

  it("actually reached both states, so a green result cannot mean a walk that stopped early", () => {
    /*
     * THE FLOOR, AND IT IS THE WHOLE POINT OF THIS FILE. Every assertion below is vacuous if the
     * commit silently failed: no reveal panel, no finding card, an empty violations array, green.
     * That is precisely the failure this file was written to close, so it is asserted first and it
     * is asserted on the markers rather than on the absence of errors.
     */
    for (const [state, a] of audits) {
      expect(a.markers, `${state} rendered none of its own markers`).toBeGreaterThan(0);
      expect(a.rulesRun, `${state} evaluated too few rules to be a real document`).toBeGreaterThan(
        30,
      );
    }
  });

  it("has no critical or serious violations in either state", () => {
    const blocking = [...audits].flatMap(([state, a]) =>
      a.violations
        .filter((v) => v.impact === "critical" || v.impact === "serious")
        .map((v) => `${state}: ${v.id} x${v.nodes} (${v.target})`),
    );
    expect(blocking, "blocking accessibility violations past the commit").toEqual([]);
  });

  it("has not grown a backlog of the lesser ones either", () => {
    const rest = [...audits].flatMap(([state, a]) =>
      a.violations
        .filter((v) => v.impact !== "critical" && v.impact !== "serious")
        .map((v) => `${state}: ${v.id} x${v.nodes} (${v.target})`),
    );
    expect(rest, "new non-blocking violations past the commit -- triage, do not raise").toEqual([]);
  });
});
