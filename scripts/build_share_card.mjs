/**
 * The 1200x630 card a pasted link renders as.
 *
 * WHY IT IS GENERATED RATHER THAN DRAWN. The card carries the product's one differentiating
 * sentence, and that sentence lives in `client/src/pages/Record.tsx`. A card exported from a
 * design tool is a second copy of it that nothing keeps in step -- and the failure mode is
 * exactly the one this repo spends its gates on: the promise a player arrives with drifting away
 * from the promise the product makes. Rendered in the shipped typeface, from the shipped tokens,
 * with the sentence pasted in one place below.
 *
 * Run:  node scripts/build_share_card.mjs
 * Out:  client/public/share-card.png
 *
 * NOT PART OF `npm run build`. It needs a browser, it changes only when the sentence changes, and
 * a build step that silently regenerates a committed binary hides that change in a diff nobody
 * reads. Regenerate deliberately; the test in tests/client/the-link-someone-was-sent.test.ts
 * holds the card's existence and dimensions, not its pixels.
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const font = readFileSync(resolve(root, "client/public/fonts/noto-sans-hebrew-700-hebrew.woff2"));
const fontBody = readFileSync(resolve(root, "client/public/fonts/noto-sans-hebrew-400-hebrew.woff2"));

/** The front door's own sentence. If this file and Record.tsx disagree, Record.tsx is right. */
const CLAIM = "כל כלי שחמט אחר אומר לכם מה עשיתם לא נכון.";
const DIFFERENTIATOR = "זה מודד מתי לא ידעתם שאתם לא יודעים.";
const RULE = "אתם מחליטים, ורק אז המנוע מדבר.";

const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><style>
@font-face{font-family:N;font-weight:700;src:url(data:font/woff2;base64,${font.toString("base64")}) format("woff2")}
@font-face{font-family:N;font-weight:400;src:url(data:font/woff2;base64,${fontBody.toString("base64")}) format("woff2")}
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#f7f3e9;color:#17221f;font-family:N,sans-serif;
     display:flex;flex-direction:column;justify-content:center;gap:26px;padding:84px 96px}
.kicker{font-weight:700;font-size:26px;letter-spacing:.06em;color:#2f6072}
h1{font-weight:700;font-size:62px;line-height:1.18;max-width:940px}
h1 .quiet{color:#50605c;font-weight:400}
.rule{font-weight:400;font-size:30px;color:#50605c;border-top:2px solid rgba(23,34,31,.16);padding-top:24px}
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
