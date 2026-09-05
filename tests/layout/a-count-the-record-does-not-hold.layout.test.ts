/**
 * `נרשמו N החלטות` ON THE REVEAL, AGAINST THE RECORD THAT IS SUPPOSED TO HOLD THEM.
 *
 * `N-7` recorded the disagreement and deliberately did not fix it: the sentence had printed both
 * `k` and `k+1` at the kth reveal of the same walk, and what was missing was not another sample but
 * the arithmetic. `client/src/pages/Home.tsx` built the number as
 * `(decisionCount.data?.decisions ?? 0) + 1` -- the cached count, plus one for the decision being
 * revealed -- and by the time the reveal is assembled that decision is ALREADY on the record,
 * because `onCommit` awaits the write and returns on failure before the engine is ever asked.
 *
 * IT IS NOT A RACE, AND THE FIRST VERSION OF THIS FILE SAID IT WAS. That version forced the losing
 * arm with focus events, on the theory that `useDecisionCount` is one of the two reads in
 * `record-api.ts` without `refetchOnWindowFocus: false`. An independent pass measured that arm and
 * it does nothing: 50-56 synthetic blur/visibilitychange/focus events dispatched across the engine
 * wait, 5 of 5 runs on the unrepaired build printed the CORRECT sentence. The forcing condition
 * this file shipped with could not go red, which is the one thing a positive control must do.
 *
 * WHAT ACTUALLY DECIDES IT IS THE COUNTERFACTUAL PROBE'S ARM, and it is deterministic:
 *
 *   NOT-PROBED  `onCommit` calls `runReveal` inside the closure it was created in, so
 *               `decisionCount.data` is still `k-1` and `+ 1` lands on `k`. Right by accident.
 *   PROBED      `onCommit` returns. `useCommitDecision` has already invalidated `LOCAL_KEYS.count`
 *               (`record-api.ts`), the refetch lands, React re-creates `runReveal` -- `decisionCount`
 *               is in its dependency array -- and `onAnswerProbe` calls the LATER closure, where
 *               `data` is already `k`. `+ 1` prints `k+1`.
 *
 * Measured on the unrepaired build: 8 of 8 probed runs wrong, 18 of 18 not-probed runs right, 26
 * runs, 26/26 agreement between the arm and the sentence. At `k=1` the error crosses a copy branch
 * and not only a digit: `shared/reveal.ts` renders `זו החלטה אחת שנרשמה` on `=== 1` and a counted
 * sentence otherwise, so a probed first decision was told `נרשמו 2 החלטות`.
 *
 * SO BOTH ARMS ARE FORCED HERE RATHER THAN SAMPLED. `assignProbe` takes its `draw` as an argument
 * and `decision-session.ts` defaults it to `Math.random`, which `addInitScript` can pin before any
 * page script runs. `crypto.randomUUID` makes the decision ids, so pinning it cannot collide them,
 * and `confidence-asked` draws from a hash of the position rather than from `Math.random` -- the
 * one other draw on this path is `blitz-instrument`, which no walk here reaches. Each case asserts
 * the arm it asked for actually rendered, so none of them can pass vacuously.
 *
 * EVERY COUNT IS COMPARED AGAINST THE RECORD IN `localStorage`, never against the loop index. "The
 * truth at reveal k is k" is the claim under test; a test that assumed it would be asserting its
 * own premise. `what-the-record-holds-after-a-game` makes the same argument for the same reason.
 */
import { createReadStream, existsSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, resolve } from "node:path";
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

/** The same 47-ply game the other front-door walks import, so the picker has positions to offer. */
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

function serve(): Promise<{ server: Server; origin: string }> {
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

let browser: Browser;
let server: Server;
let origin: string;

beforeAll(async () => {
  if (!existsSync(dist)) throw new Error(`no build at ${dist} -- run \`npm run build\``);
  browser = await launchChromium();
  ({ server, origin } = await serve());
}, 180_000);

afterAll(async () => {
  await browser?.close();
  server?.close();
});

/**
 * The count as the RECORD holds it, read from the page's own storage.
 *
 * Every key with the record prefix, because the store suffixes `:<account>` once signed in and a
 * prefix miss would read zero and pass this file for the wrong reason.
 */
const storedDecisions = (page: Page) =>
  page.evaluate(() => {
    let n: number | null = null;
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith("decision-lab.record.v1")) continue;
      try {
        const parsed = JSON.parse(localStorage.getItem(key) ?? "");
        if (Array.isArray(parsed?.decisions)) n = (n ?? 0) + parsed.decisions.length;
      } catch {
        /* a key that is not the record shape is not the record */
      }
    }
    return n;
  });

/** The limits block's first line, and the number in it. `null` where the sentence has no number. */
const printedCount = (page: Page) =>
  page.evaluate(() => {
    const el = [...document.querySelectorAll<HTMLElement>(".reveal-limits li, .reveal-limits p")].find(
      (e) => /נרשמו \d+ החלטות|החלטה אחת שנרשמה/.test(e.innerText),
    );
    const text = el ? el.innerText.replace(/\s+/g, " ").trim() : null;
    const m = text?.match(/נרשמו (\d+) החלטות/) ?? null;
    return { text, n: m ? Number(m[1]) : null };
  });

/**
 * Pin the counterfactual probe's arm before any page script runs.
 *
 * `assignProbe(fen, draw)` is called with `draw = Math.random` by `decision-session.ts`, and
 * `PROBE_PROBABILITY` is 0.35. A pinned value under it draws `probed` on every eligible position
 * and one over it draws `not-probed`, which turns a 0.35 coin into the independent variable this
 * file needs. The value still varies per call so nothing downstream sees a constant.
 */
const pinArm = (page: Page, arm: "probed" | "not-probed") =>
  page.addInitScript((ceiling: number) => {
    let i = 0;
    /* Under 0.35 draws `probed`, over it draws `not-probed`. Still varying, so nothing downstream
       sees a constant where it expected a draw. */
    Math.random = () => {
      i += 1;
      return ceiling + (i % 9) / 1000;
    };
  }, arm === "probed" ? 0.01 : 0.9);

/** Whether the counterfactual question is the thing on the screen right now. */
const probeShowing = async (page: Page) =>
  (await page.locator(".counterfactual-probe").count()) > 0;

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

const tryToMoveEitherSide = async (page: Page) =>
  (await tryToMove(page, "w")) ?? (await tryToMove(page, "b"));

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

/** Commit, and report whether the counterfactual arm actually rendered on the way to the reveal. */
async function commitAndWaitForReveal(page: Page): Promise<{ probed: boolean }> {
  await answerTheCommitment(page);
  await page.locator(".commitment-submit").click();
  const outcome = page.locator(".counterfactual-probe, .reveal-panel, .reveal-failure, .reveal-waiting");
  await outcome.first().waitFor({ timeout: 30_000 });
  const probed = await probeShowing(page);
  const none = page.locator(".counterfactual-probe__none");
  if (await none.count()) await none.click();
  await page.locator(".reveal-panel, .reveal-failure").first().waitFor({ timeout: 180_000 });
  await page.waitForTimeout(600);
  return { probed };
}

/** Arrive as a stranger through the front door, on the given arm, and stop on the first reveal. */
async function walkToTheFirstReveal(arm: "probed" | "not-probed"): Promise<{ page: Page; probed: boolean }> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await pinArm(page, arm);
  await page.route("https://lichess.org/api/games/user/**", (route: Route) =>
    route.fulfill({ status: 200, contentType: "application/x-ndjson", body: LICHESS_BODY }),
  );
  await page.goto(`${origin}/`, { waitUntil: "networkidle" });
  await page.locator("#first-decision-username").fill(USERNAME);
  await page.getByRole("button", { name: "קחו אותי לעמדה" }).click();
  await page.waitForURL(/\/play$/, { timeout: 30_000 });
  await page.locator("[data-square]").first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(500);
  expect(await tryToMove(page, "w"), "the board offered no move while a decision was open").not.toBeNull();
  const { probed } = await commitAndWaitForReveal(page);
  return { page, probed };
}

/** One press to the next position, a move, a commitment, and the next reveal. */
async function takeAnotherDecision(page: Page): Promise<{ probed: boolean }> {
  await page.locator("button[data-primary-action='next-decision']").first().click();
  await page.locator("[data-square]").first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(700);
  expect(await tryToMoveEitherSide(page), "the next position offered no move").not.toBeNull();
  return commitAndWaitForReveal(page);
}

describe("the count on the reveal is the count the record holds", () => {
  it(
    "says the number the record holds at the first reveal of the PROBED arm, which is the arm that was wrong",
    async () => {
      const { page, probed } = await walkToTheFirstReveal("probed");
      const { text, n } = await printedCount(page);
      const stored = await storedDecisions(page);
      await page.context().close();

      expect(probed, "the pinned draw did not produce a probed decision, so nothing was tested").toBe(true);
      expect(stored, "the walk did not put exactly one decision on the record").toBe(1);
      expect(
        n ?? (text ? 1 : null),
        `the probed arm said ${n} for a record holding ${stored}: "${text}"`,
      ).toBe(1);
      /* At k=1 the defect crossed a copy branch, so the branch is asserted as well as the digit. */
      expect(text, "the singular sentence was replaced by a counted one").toContain("זו החלטה אחת שנרשמה");
    },
    900_000,
  );

  it(
    "says the number the record holds at every reveal of a four-decision walk on the PROBED arm",
    async () => {
      const { page, probed: first } = await walkToTheFirstReveal("probed");
      const seen: { printed: number | null; stored: number | null; text: string | null; probed: boolean }[] = [];
      let probed = first;
      for (let k = 1; k <= 4; k += 1) {
        if (k > 1) ({ probed } = await takeAnotherDecision(page));
        const { text, n } = await printedCount(page);
        const stored = await storedDecisions(page);
        /* The singular sentence carries no digit, and one decision is what it means. */
        seen.push({ printed: n ?? (text ? 1 : null), stored, text, probed });
      }
      await page.context().close();

      expect(
        seen.filter((r) => r.probed).length,
        "no decision in the walk drew the probed arm, so the walk tested the arm that already worked",
      ).toBe(4);
      for (const [i, row] of seen.entries()) {
        expect(row.text, `reveal ${i + 1} rendered no limits sentence about the record`).not.toBeNull();
        expect(
          row.printed,
          `reveal ${i + 1} said ${row.printed} and the record holds ${row.stored}: "${row.text}"`,
        ).toBe(row.stored);
      }
    },
    900_000,
  );

  it(
    "POSITIVE CONTROL: the arm that was already right is still right",
    async () => {
      /*
       * The not-probed arm printed the correct count on 18 of 18 runs before the repair. A change
       * that fixed the probed arm by breaking this one would look identical in the two cases above.
       */
      const { page, probed } = await walkToTheFirstReveal("not-probed");
      const first = await printedCount(page);
      const firstStored = await storedDecisions(page);
      const { probed: probedAgain } = await takeAnotherDecision(page);
      const second = await printedCount(page);
      const secondStored = await storedDecisions(page);
      await page.context().close();

      expect(probed || probedAgain, "the pinned draw produced a probed decision on the control arm").toBe(false);
      expect(first.text, "the first reveal said nothing about the record").not.toBeNull();
      expect(first.n ?? 1, `reveal 1 said ${first.n} for a record holding ${firstStored}`).toBe(firstStored);
      expect(second.n, `reveal 2 said ${second.n} for a record holding ${secondStored}`).toBe(secondStored);
    },
    900_000,
  );

  it(
    "POSITIVE CONTROL: the number moves when the record does",
    async () => {
      /* Without this, a rule that always printed the same digit would pass every case above. */
      const { page } = await walkToTheFirstReveal("probed");
      await takeAnotherDecision(page);
      const second = await printedCount(page);
      await takeAnotherDecision(page);
      const third = await printedCount(page);
      await page.context().close();

      expect(second.n, `the second reveal printed no count: "${second.text}"`).not.toBeNull();
      expect(third.n, `the third reveal printed no count: "${third.text}"`).not.toBeNull();
      expect(
        third.n! - second.n!,
        `the count went ${second.n} -> ${third.n} across one decision`,
      ).toBe(1);
    },
    900_000,
  );
});
