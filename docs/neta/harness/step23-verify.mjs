/** The same walk that found N-2, against the built fix. Clean profile, one bank decision. */
import { chromium } from "@playwright/test";
import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";
const dist = resolve("dist/public");
const TYPES = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".wasm":"application/wasm",
  ".json":"application/json", ".woff2":"font/woff2", ".png":"image/png", ".svg":"image/svg+xml" };
const origin = await new Promise((done) => {
  const s = createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
    let p = join(dist, url);
    if (!extname(p) || !existsSync(p)) p = join(dist, "index.html");
    res.writeHead(200, { "content-type": TYPES[extname(p)] ?? "application/octet-stream" });
    createReadStream(p).pipe(res);
  });
  s.listen(0, "127.0.0.1", () => done(`http://127.0.0.1:${s.address().port}`));
});
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "he-IL" })).newPage();
const sq = (s) => page.locator(`[data-square="${s}"]`);
const chip = async (rx) => { const h = await page.evaluateHandle((r) => [...document.querySelectorAll("button")]
  .find((b) => b.offsetParent && new RegExp(r).test(b.innerText.replace(/\s+/g," ").trim())), rx); await h.asElement().click(); };
await page.goto(origin + "/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(900);
await page.getByRole("button", { name: "עמדה מהסט המשותף" }).click();
await sq("e4").waitFor({ timeout: 60000 }); await page.waitForTimeout(1400);
await sq("b5").click(); await page.waitForTimeout(200);
await sq("b4").click(); await page.waitForTimeout(400);
await chip("יתרון מרחב|המרכז"); await page.waitForTimeout(200);
await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(420);
await chip("^לא "); await page.waitForTimeout(200);
await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(520);
const c = await page.evaluateHandle(() => [...document.querySelectorAll("button")]
  .find((b) => b.offsetParent && b.getBoundingClientRect().width < 90 && /^4\s/.test(b.innerText.trim())));
await c.asElement().click(); await page.waitForTimeout(360);
await page.locator(".commitment-submit,[data-commit],button[type=submit]").first().click();
await page.waitForTimeout(3000);
if (await page.evaluate(() => /מה כן היית עושה/.test(document.body.innerText)))
  { await page.getByRole("button", { name: "לא היה לי מהלך אחר" }).click(); await page.waitForTimeout(2500); }
await page.waitForFunction(() => /עומק \d+|בחרת את|ס״פ/.test(document.body.innerText), null, { timeout: 60000 });
await page.waitForTimeout(800);
const strip = await page.evaluate(() => document.body.innerText.split("\n").map((s)=>s.trim())
  .filter((s)=>/נמדדו|נספרות|שנרשמו/.test(s)));
console.log("### the strip, after one bank decision, on the built fix:");
for (const l of strip) console.log("   " + l);
console.log("\n### the two lines no longer share a verb: " +
  (strip.filter((l)=>l.includes("נמדדו")).length === 1 ? "CONFIRMED" : "STILL COLLIDING"));
await browser.close(); process.exit(0);
