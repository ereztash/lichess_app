import { openApp, shot } from "./session.mjs";
const { browser, page, ORIGIN, OUT } = await openApp();
const log = (...a) => console.log(...a);
const sq = (s) => page.locator(`[data-square="${s}"]`);
await page.goto(ORIGIN + "/", { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(800);
await page.getByRole("button", { name: "עמדה מהסט המשותף" }).click();
await sq("e4").waitFor({ timeout: 60000 }); await page.waitForTimeout(1500);
await sq("b5").click(); await page.waitForTimeout(250);
await sq("b4").click(); await page.waitForTimeout(500);
await page.getByRole("button", { name: "יש לי יתרון מרחב" }).click();
await page.waitForTimeout(600);
log("### every visible control now, in reading order");
for (const e of await page.evaluate(() => [...document.querySelectorAll("button,input,select,textarea,[role=slider],[role=radio]")]
  .filter((el)=>el.offsetParent && el.getBoundingClientRect().width>0)
  .map((el)=>({t:el.tagName.toLowerCase(),role:el.getAttribute("role"),type:el.getAttribute("type"),
    txt:(el.innerText||el.value||el.getAttribute("aria-label")||"").replace(/\s+/g," ").trim().slice(0,54),
    y:Math.round(el.getBoundingClientRect().top+scrollY)}))
  .filter((e)=>e.txt).sort((a,b)=>a.y-b.y))) log(`  y=${String(e.y).padStart(5)} ${e.t}${e.role?"/"+e.role:""} :: ${e.txt}`);
await browser.close();
