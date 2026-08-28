/**
 * The 1200x630 card a pasted link renders as.
 *
 * WHY IT IS GENERATED RATHER THAN DRAWN, AND WHY IT IMPORTS. The card carries the product's
 * promise, and a card exported from a design tool is a second copy of that promise which nothing
 * keeps in step -- the failure mode this repo spends its gates on: what a player arrives expecting
 * drifting away from what the product says. So it does not paste the sentences, it imports them
 * from `shared/promise.ts`, the same module the front door renders. Rendered in the shipped
 * typeface, from the shipped tokens.
 *
 * WHAT STILL CANNOT BE IMPORTED, and is therefore held by a test rather than by a compiler: this
 * file emits PIXELS. Once written, the PNG is a copy of the promise that no import can update. If
 * `shared/promise.ts` changes, this script must be re-run, and the sentence that reaches a player
 * from a pasted link is stale until it is.
 *
 * Run:  npx tsx scripts/build_share_card.ts
 * Out:  client/public/share-card.png
 *
 * NOT PART OF `npm run build`. It needs a browser, it changes only when the promise changes, and
 * a build step that silently regenerates a committed binary hides that change in a diff nobody
 * reads. Regenerate deliberately; the test in tests/client/the-link-someone-was-sent.test.ts
 * holds the card's existence, its dimensions, and the fact that this file reads its words from
 * `shared/promise.ts` -- not its pixels.
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PROMISE_SHORT } from "../shared/promise";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const font = readFileSync(resolve(root, "client/public/fonts/noto-sans-hebrew-700-hebrew.woff2"));
const fontBody = readFileSync(resolve(root, "client/public/fonts/noto-sans-hebrew-400-hebrew.woff2"));

/*
 * The front door's own three ideas, at card length. Not a shortened paraphrase written here: the
 * first two lines are `PROMISE.problem` split at its own full stop and the third is
 * `PROMISE.mechanism` up to its dash, so the card is a smaller window onto one sentence rather
 * than a second sentence about the same product.
 */
const CLAIM = PROMISE_SHORT.engineDoes;
const DIFFERENTIATOR = PROMISE_SHORT.engineCannot;
const RULE = PROMISE_SHORT.mechanism;

const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><style>
@font-face{font-family:N;font-weight:700;src:url(data:font/woff2;base64,${font.toString("base64")}) format("woff2")}
@font-face{font-family:N;font-weight:400;src:url(data:font/woff2;base64,${fontBody.toString("base64")}) format("woff2")}
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#f7f3e9;color:#17221f;font-family:N,sans-serif;
     display:flex;flex-direction:column;justify-content:center;gap:26px;padding:84px 96px}
.kicker{font-weight:700;font-size:26px;letter-spacing:.06em;color:#2f6072}
h1{font-weight:700;font-size:48px;line-height:1.28;max-width:1008px}
h1 .quiet{color:#50605c;font-weight:400}
.rule{font-weight:400;font-size:34px;color:#2f4a44;border-top:2px solid rgba(23,34,31,.16);padding-top:26px}
</style></head><body>
<div class="kicker">DECISION LAB</div>
<h1><span class="quiet">${CLAIM}</span><br>${DIFFERENTIATOR}</h1>
<div class="rule">${RULE}</div>
</body></html>`;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: resolve(root, "client/public/share-card.png") });
await browser.close();
console.log("wrote client/public/share-card.png");
