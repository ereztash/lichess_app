import { serveBuild, launch } from "./ux-lib.mjs";
const { origin, close } = await serveBuild();
const browser = await launch();
const log = (...a) => console.log(...a);
const page = await (await browser.newContext({ viewport:{width:1440,height:900}, locale:"he-IL" })).newPage();
const sq = (s) => page.locator(`[data-square="${s}"]`);
const chip = async (rx) => { const x = await page.evaluateHandle((r)=>[...document.querySelectorAll("button")]
  .find((b)=>b.offsetParent && new RegExp(r).test(b.innerText.replace(/\s+/g," "))), rx); await x.asElement().click(); };
const headings = () => page.evaluate(() => [...document.querySelectorAll("h1,h2,h3")]
  .filter((e)=>e.offsetParent).map((e)=>{ const s=getComputedStyle(e);
    return { tag:e.tagName.toLowerCase(), cls:e.className.toString().slice(0,34), px:s.fontSize, weight:s.fontWeight,
             text:(e.innerText||"").replace(/\s+/g," ").trim().slice(0,34) }; }));
const bodies = () => page.evaluate(() => [...document.querySelectorAll("p,li")]
  .filter((e)=>e.offsetParent && (e.innerText||"").trim().length>30).map((e)=>{ const s=getComputedStyle(e);
    return { px:s.fontSize, weight:s.fontWeight }; }));

await page.goto(origin + "/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1000);
log("### FRONT DOOR headings"); for (const h of await headings()) log("   " + JSON.stringify(h));
await page.getByRole("button", { name: "עמדה מהסט המשותף" }).click();
await sq("e4").waitFor({ timeout: 60000 }); await page.waitForTimeout(1400);
log("\n### DECIDE headings"); for (const h of await headings()) log("   " + JSON.stringify(h));
await sq("b5").click(); await page.waitForTimeout(200);
await sq("b4").click(); await page.waitForTimeout(400);
await chip("יתרון מרחב|המרכז"); await page.waitForTimeout(250);
await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(450);
await chip("^לא "); await page.waitForTimeout(250);
await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(550);
const c = await page.evaluateHandle(()=>[...document.querySelectorAll("button")]
  .find((b)=>b.offsetParent && b.getBoundingClientRect().width<90 && /^4\s/.test(b.innerText.trim())));
await c.asElement().click(); await page.waitForTimeout(400);
await page.locator(".commitment-submit").click(); await page.waitForTimeout(2600);
if (await page.evaluate(()=>/מה כן היית עושה/.test(document.body.innerText)))
  await page.getByRole("button", { name: "לא היה לי מהלך אחר" }).click();
await page.waitForFunction(()=>/עומק \d+|בחרת את|ס״פ/.test(document.body.innerText), null, { timeout: 60000 });
await page.waitForTimeout(1200);
log("\n### REVEAL headings"); for (const h of await headings()) log("   " + JSON.stringify(h));
const b = await bodies();
const byWeight = b.reduce((m,x)=>{m[x.weight]=(m[x.weight]??0)+1;return m;},{});
log("\n### REVEAL body weights: " + JSON.stringify(byWeight));
log("### distinct heading weights across the three screens is what matters, above.");
await browser.close(); close(); process.exit(0);
