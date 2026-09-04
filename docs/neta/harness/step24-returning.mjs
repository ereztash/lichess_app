/**
 * NETA RERUN ON THE RETURNING-USER STATE, after the owner's decision on `N-3`.
 *
 * The same walk that produced the finding: clean profile, two complete bank decisions, then the
 * front door again. Two viewports. Serves `dist/public` so the state under test is the built
 * artefact rather than a dev server.
 */
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
const log = (...a) => console.log(...a);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });

const walk = async (width, height, label) => {
  const ctx = await browser.newContext({ viewport: { width, height }, locale: "he-IL" });
  const page = await ctx.newPage();
  const sq = (s) => page.locator(`[data-square="${s}"]`);
  const chip = async (rx) => { const h = await page.evaluateHandle((r) => [...document.querySelectorAll("button")]
    .find((b) => b.offsetParent && new RegExp(r).test(b.innerText.replace(/\s+/g," ").trim())), rx); await h.asElement().click(); };
  const conf = async (n) => { const h = await page.evaluateHandle((k) => [...document.querySelectorAll("button")]
    .find((b) => b.offsetParent && b.getBoundingClientRect().width < 90 && new RegExp("^"+k+"\\s").test(b.innerText.trim())), n);
    await h.asElement().click(); };
  const anyMove = async () => {
    const all = await page.evaluate(() => [...document.querySelectorAll("[data-square]")].map((e)=>e.getAttribute("data-square")));
    for (const s of all) { await sq(s).click(); await page.waitForTimeout(60);
      const hints = await page.evaluate(() => [...document.querySelectorAll("[data-square]")]
        .filter((e)=>/hint|target|legal|dest|move-option/i.test(e.className.toString())).map((e)=>e.getAttribute("data-square")));
      if (hints.length) { await sq(hints[0]).click(); await page.waitForTimeout(350); return `${s}${hints[0]}`; } }
    throw new Error("no legal move");
  };
  const decide = async () => {
    const mv = await anyMove();
    await chip("יתרון מרחב|המרכז|מלך חשוף|פער בפיתוח"); await page.waitForTimeout(200);
    await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(420);
    await chip("^לא "); await page.waitForTimeout(200);
    await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(520);
    await conf(4); await page.waitForTimeout(360);
    await page.locator(".commitment-submit,[data-commit],button[type=submit]").first().click();
    await page.waitForTimeout(2600);
    if (await page.evaluate(() => /מה כן היית עושה/.test(document.body.innerText)))
      { await page.getByRole("button", { name: "לא היה לי מהלך אחר" }).click(); await page.waitForTimeout(2200); }
    await page.waitForFunction(() => /עומק \d+|בחרת את|ס״פ/.test(document.body.innerText), null, { timeout: 60000 });
    return mv;
  };

  await page.goto(origin + "/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: "עמדה מהסט המשותף" }).click();
  await sq("e4").waitFor({ timeout: 60000 }); await page.waitForTimeout(1400);
  log(`\n### ${label}: decision 1 -> ${await decide()}`);
  await page.getByRole("button", { name: "לעמדה הבאה" }).click();
  await page.waitForFunction(() => /DECIDE/.test(document.body.innerText), null, { timeout: 30000 });
  await page.waitForTimeout(1000);
  log(`### ${label}: decision 2 -> ${await decide()}`);
  await page.waitForTimeout(1000);
  try { await page.getByRole("button", { name: "לא עכשיו" }).click({ timeout: 3000 }); await page.waitForTimeout(400); } catch {}

  log(`\n### ${label}: RETURN THROUGH THE FRONT DOOR`);
  await page.goto(origin + "/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  const text = await page.evaluate(() => document.body.innerText.split("\n").map((s)=>s.trim()).filter(Boolean));
  for (const l of text.slice(0, 14)) log("   " + l);
  log(`\n### ${label}: where the acknowledgement lands`);
  for (const e of await page.evaluate(() => [...document.querySelectorAll("p,h1,h2,h3,button")]
    .filter((el)=>el.offsetParent && /נרשמ|נקרא|שיחקת|נמדד/.test(el.innerText||""))
    .map((el)=>({t:(el.innerText||"").replace(/\s+/g," ").trim().slice(0,86),
      y:Math.round(el.getBoundingClientRect().top+scrollY), fold: el.getBoundingClientRect().top < innerHeight ? "fold1" : "below"})))) 
    log(`   y=${String(e.y).padStart(4)} ${e.fold} :: ${e.t}`);
  await page.screenshot({ path: `/tmp/claude-0/-home-user-lichess-app/634dd395-630e-5c56-b477-315c92c04969/scratchpad/neta/n3-${width}.png` });
  await ctx.close();
};

await walk(1440, 900, "desktop 1440x900");
await walk(390, 844, "handset 390x844");
await browser.close();
process.exit(0);
