/**
 * D22's FIRST REVERSAL CONDITION, PERFORMED.
 *
 * `docs/decisions/D22-next-action-ownership.md` defers handing any screen over to
 * `deriveNextAction`, and names four things that would take a state. The first is the only one
 * available without a person:
 *
 *   > A surface's screen and the derivation disagree on a state, IN A WALK OVER THE BUILT APP.
 *   > That is a fact about the product available today, and it is what would say a screen is wrong
 *   > rather than merely unshadowed.
 *
 * Nothing had performed it. The live shadow runs on one surface and writes to a ring buffer in one
 * browser's `localStorage`; this build has had no players, so the ledger it fills is empty, and
 * D22 says so in as many words -- *"the wait had not started and could not finish"*. The other two
 * surfaces are measured by a test beside the product rather than by a hook, deliberately and on
 * cost grounds: instrumenting them live would pull the blitz reading chain into two hot routes at
 * **+16.1 kB raw / +5.1 kB gzipped** to write a row nobody reads.
 *
 * WHY THIS IS NOT THAT TEST AGAIN, ONE LEVEL UP. `a-derivation-that-decides-nothing-yet.test.tsx`
 * renders `ResumeScreen` in jsdom with a hand-built reading and compares. That is E2 -- a reference
 * behaviour reproduced BESIDE the product. This walks the shipped bundle in a real engine, at a
 * phone's size, from an empty profile, and reads `[data-primary-action]` off the page the player
 * would actually be looking at. The difference is not ceremony: `offeredAct` finds the FIRST
 * visible primary control in document order, and which control that is depends on routing, on
 * Suspense boundaries, on what has resolved, and on what a component chose not to render -- none of
 * which a component-level render decides.
 *
 * WHAT A FAILURE HERE MEANS, and it is the point of writing it. A red line is not a broken test. It
 * is D22 reversal condition 1 arriving: a state where the screen and the derivation want different
 * things, named, with the walk that produced it. Either the screen is wrong, or the derivation is,
 * and the disagreement is what says which question to ask. Do not silence it.
 *
 * THE TWO STOPS, AND WHY THERE ARE NOT MORE. `/` IS the record page -- `App.tsx` routes `/` to
 * `Record` and `/play` to `Home` -- so the empty record and the returning record are the two states
 * a new player actually passes through on the surface that routes. THE FIRST DRAFT OF THIS FILE
 * WALKED TO `/record` AS A THIRD STOP AND REPORTED A DISAGREEMENT: the derivation proposed
 * `play-blitz` and the screen offered nothing. The screen was a 404. A walk that navigates to a URL
 * the router does not have will read an empty page as a surface with nothing to offer, and D22's
 * reversal condition would have been reported as met by a typo. The stop was removed rather than
 * repaired, because there is no third routing surface for it to point at.
 *
 * `/play` IS DELIBERATELY NOT COMPARED. It is mid-act, and `actFor` maps no proposal onto
 * `commit-decision`, `answer-instrument` or `next-decision` -- D22 establishes that those three
 * acts are unreachable from the derivation BY DESIGN, because they are controls the player is
 * already using rather than somewhere to be sent. A comparison there would report a disagreement on
 * every run, for a reason that is the design working.
 *
 * `wait-analysis` IS NOT REACHED, and it is the state D22 calls the most emphatic agreement in the
 * product -- the screen deliberately offers nothing, because another game grows the backlog that is
 * the blocker. Reaching it means playing a blitz game to completion and stopping before the queue
 * scores it, which is a longer walk than this file is worth. Named rather than left as a silent
 * gap: the two states below are the ones covered, and that is all they are.
 *
 * WHAT IT STILL DOES NOT ESTABLISH. Whether the proposal is one a PERSON would have wanted. That is
 * reversal condition 3, it needs the acquisition trial, and no walk can produce it.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser, Page, Route } from "@playwright/test";
import { launchChromium } from "./browser";
import { LICHESS_BODY, serveDist, USERNAME } from "./learning-cost";
import { ANCHOR_POSITIONS } from "@shared/anchor-set";
import {
  actFor,
  agreesWith,
  deriveNextAction,
  type NextAction,
  type ProductState,
} from "@shared/next-action";
import { PRIMARY_ACTIONS, type PrimaryAction } from "@shared/primary-action";

const PHONE = { width: 390, height: 844 };

let browser: Browser;
let server: Awaited<ReturnType<typeof serveDist>>["server"];
let origin: string;

beforeAll(async () => {
  browser = await launchChromium();
  const served = await serveDist();
  server = served.server;
  origin = served.origin;
}, 120_000);

afterAll(async () => {
  await browser?.close();
  server?.close();
});

/**
 * What the page is offering, read the way the shadow reads it.
 *
 * THE SELECTOR IS `offeredAct`'s, RESTATED IN THE PAGE rather than imported into it. The bundle
 * under test is the built one and cannot be handed a function from the test process, so the rule
 * lives in two places for the length of this file. It is kept honest by asserting the result is a
 * member of `PRIMARY_ACTIONS`, which is the same closed vocabulary three gates already read: a
 * drift in either copy produces a value this refuses rather than a quiet disagreement.
 */
async function offeredOnPage(page: Page): Promise<PrimaryAction | null> {
  const act = await page.evaluate(`(() => {
    const control = [...document.querySelectorAll('[data-primary-action]')].find(
      (el) => !el.closest('details:not([open])') && !el.closest('[hidden]'),
    );
    return control ? control.getAttribute('data-primary-action') : null;
  })()`);
  if (act === null) return null;
  expect(
    PRIMARY_ACTIONS as readonly string[],
    `the page offered "${act}", which is in no vocabulary the derivation can name`,
  ).toContain(act);
  return act as PrimaryAction;
}

/** The state every field of which this walk has established, with the rest at their empty values. */
function stateAfter(over: Partial<ProductState>): ProductState {
  return {
    pendingAnalyses: 0,
    analysisRunning: false,
    /*
     * NULL, AND THE WALK IS WHY THIS IS HONEST RATHER THAN CONVENIENT. A drill and a transfer live
     * in `Home.tsx`'s component state and do not survive navigating away -- D22 reversal condition
     * 2, a LAW 4 defect with its own row. This walk never starts one, so null is what the product
     * holds and not merely what the fixture says.
     */
    drill: null,
    transfer: null,
    unseenEvent: null,
    untestedRule: null,
    blitzStanding: { may: false, because: "no-games", readable: 0, needs: null },
    decisionsOnRecord: 0,
    anchor: { answered: 0, total: ANCHOR_POSITIONS.length },
    ...over,
  };
}

interface Point {
  where: string;
  proposed: NextAction;
  offered: PrimaryAction | null;
}

const agreed = (point: Point) =>
  `${point.where}: the derivation proposes ${point.proposed.kind} (act ${
    actFor(point.proposed.kind) ?? "none"
  }), the screen offers ${point.offered ?? "none"}`;

describe("what the screens offer, against what the derivation would send them to", () => {
  const points: Point[] = [];

  it("walks an empty record to a recorded decision and back, reading the act at each stop", async () => {
    const context = await browser.newContext({
      viewport: PHONE,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.route("https://lichess.org/api/games/user/**", (route: Route) =>
      route.fulfill({ status: 200, contentType: "application/x-ndjson", body: LICHESS_BODY }),
    );
    try {
      /* ---- STOP 1: the record page, empty ---- */
      await page.goto(`${origin}/`, { waitUntil: "networkidle" });
      await page.locator("#first-decision-username").waitFor({ timeout: 30_000 });
      await page.waitForTimeout(800);
      points.push({
        where: "the record page, empty",
        proposed: deriveNextAction(stateAfter({})),
        offered: await offeredOnPage(page),
      });

      /* ---- record one decision ---- */
      await page.locator("#first-decision-username").fill(USERNAME);
      await page.getByRole("button", { name: "קחו אותי לעמדה" }).click();
      await page.waitForURL(/\/play$/, { timeout: 30_000 });
      await page.locator(".commitment-submit").waitFor({ timeout: 30_000 });
      await page.waitForTimeout(500);

      const squares: string[] = await page.evaluate(`
        [...document.querySelectorAll('[data-square]')]
          .filter((el) => el.querySelector('.piece.piece-w'))
          .map((el) => el.getAttribute('data-square'))
      `);
      let moved = false;
      for (const square of squares) {
        await page.locator(`[data-square="${square}"]`).click();
        await page.waitForTimeout(90);
        const target: string | null = await page.evaluate(
          `document.querySelector('.legal-square')?.getAttribute('data-square') ?? null`,
        );
        if (!target) continue;
        await page.locator(`[data-square="${target}"]`).click();
        moved = true;
        break;
      }
      expect(moved, "the handed-over position offered no move").toBe(true);
      await page.waitForTimeout(400);

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
      await page.locator(".commitment-submit").click();
      const outcome = page.locator(
        ".counterfactual-probe, .reveal-panel, .reveal-failure, .reveal-waiting",
      );
      await outcome.first().waitFor({ timeout: 30_000 });
      const none = page.locator(".counterfactual-probe__none");
      if (await none.count()) await none.click();
      await page.locator(".reveal-panel, .reveal-failure").first().waitFor({ timeout: 180_000 });
      await page.waitForTimeout(600);

      /* ---- STOP 2: the record page, one decision on it ---- */
      await page.goto(`${origin}/`, { waitUntil: "networkidle" });
      await page.waitForTimeout(2_000);
      points.push({
        where: "the record page, one decision",
        proposed: deriveNextAction(stateAfter({ decisionsOnRecord: 1, anchor: { answered: 1, total: ANCHOR_POSITIONS.length } })),
        offered: await offeredOnPage(page),
      });

    } finally {
      await context.close();
    }

    expect(points, "the walk did not reach both stops").toHaveLength(2);
  }, 300_000);

  it("records what each stop proposed and what it offered, whether or not they agree", () => {
    /*
     * THE LEDGER THE LIVE SHADOW CANNOT FILL, printed rather than stored. It is the walk's actual
     * output and the reason the file is worth its runtime: two states on the surface that routes,
     * read off the shipped bundle, reproducible by anyone who runs it.
     */
    for (const point of points) console.log(`  ${agreed(point)}`);
    expect(points.every((p) => typeof p.where === "string")).toBe(true);
  });

  it("finds no state where a screen and the derivation want different things", () => {
    /*
     * D22 REVERSAL CONDITION 1, AS AN ASSERTION. If this goes red, do not adjust it: it has found
     * the thing D22 says would take a state, and the failure message names the stop, the proposal
     * and the act the screen offered instead.
     */
    const disagreements = points.filter((p) => !agreesWith(p.proposed.kind, p.offered));
    expect(disagreements.map(agreed), "a screen and the derivation disagree").toEqual([]);
  });
});
