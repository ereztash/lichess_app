/** Is weight 800 painted anywhere, and are its files ever fetched? */
import { serveBuild, launch } from "./ux-lib.mjs";
const { origin, close } = await serveBuild();
const browser = await launch();
const log = (...a)=>console.log(...a);
const ctx = await browser.newContext({ viewport:{width:1440,height:900}, locale:"he-IL" });
const page = await ctx.newPage();
const fonts = [];
page.on("response", (r)=>{ if (/\.woff2/.test(r.url())) fonts.push(r.url().split("/").pop()); });
const sq = (s) => page.locator(`[data-square="${s}"]`);
const chip = async (rx) => { const x = await page.evaluateHandle((r)=>[...document.querySelectorAll("button")]
  .find((b)=>b.offsetParent && new RegExp(r).test(b.innerText.replace(/\s+/g," "))), rx); await x.asElement().click(); };
const weights = () => page.evaluate(() => { const m={};
  for (const el of document.querySelectorAll("body *")) { if (!el.offsetParent||el.children.length) continue;
    if (!(el.innerText||"").trim()) continue; const w=getComputedStyle(el).fontWeight; m[w]=(m[w]??0)+1; }
  return m; });
const seen = {};
const add = (label, m) => { log(`  ${label.padEnd(12)} ${JSON.stringify(m)}`); for (const [k,v] of Object.entries(m)) seen[k]=(seen[k]??0)+v; };

await page.goto(origin + "/", { waitUntil: "networkidle", timeout: 60000 }); await page.waitForTimeout(1200);
add("front door", await weights());
await page.getByRole("button", { name: "עמדה מהסט המשותף" }).click();
await sq("e4").waitFor({ timeout: 60000 }); await page.waitForTimeout(1400);
add("decide", await weights());
await sq("b5").click(); await page.waitForTimeout(200); await sq("b4").click(); await page.waitForTimeout(400);
await chip("יתרון מרחב|המרכז"); await page.waitForTimeout(250);
await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(450);
await chip("^לא "); await page.waitForTimeout(250);
await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(550);
const c = await page.evaluateHandle(()=>[...document.querySelectorAll("button")]
  .find((b)=>b.offsetParent && b.getBoundingClientRect().width<90 && /^4\s/.test(b.innerText.trim())));
await c.asElement().click(); await page.waitForTimeout(400);
add("ready", await weights());
await page.locator(".commitment-submit").click(); await page.waitForTimeout(2600);
if (await page.evaluate(()=>/מה כן היית עושה/.test(document.body.innerText)))
  await page.getByRole("button", { name: "לא היה לי מהלך אחר" }).click();
await page.waitForFunction(()=>/עומק \d+|בחרת את|ס״פ/.test(document.body.innerText), null, { timeout: 60000 });
await page.waitForTimeout(1200);
add("reveal", await weights());
await page.goto(origin + "/", { waitUntil: "networkidle", timeout: 60000 }); await page.waitForTimeout(2200);
add("return", await weights());
log("\n  TOTAL across five screens: " + JSON.stringify(seen));
log("  font files the browser actually fetched: " + JSON.stringify([...new Set(fonts)]));
await browser.close(); close(); process.exit(0);
