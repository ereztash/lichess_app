import { openApp, shot } from "./session.mjs";
const { browser, page, console_, ORIGIN, OUT } = await openApp();
const log = (...a) => console.log(...a);
const sq = (s) => page.locator(`[data-square="${s}"]`);
const controls = async (near) => (await page.evaluate(() => [...document.querySelectorAll("button,input,[role=slider],[role=radio]")]
  .filter((el)=>el.offsetParent && !el.getAttribute("data-square") && el.getBoundingClientRect().width>0)
  .map((el)=>({txt:(el.innerText||el.value||el.getAttribute("aria-label")||"").replace(/\s+/g," ").trim().slice(0,50),
    y:Math.round(el.getBoundingClientRect().top+scrollY), t:el.tagName.toLowerCase(), type:el.getAttribute("type")}))
  .filter((e)=>e.txt).sort((a,b)=>a.y-b.y))).filter((e)=>!near || (e.y>near[0]&&e.y<near[1]));

await page.goto(ORIGIN + "/", { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(800);
await page.getByRole("button", { name: "עמדה מהסט המשותף" }).click();
await sq("e4").waitFor({ timeout: 60000 }); await page.waitForTimeout(1500);
await sq("b5").click(); await page.waitForTimeout(250);
await sq("b4").click(); await page.waitForTimeout(400);
await page.getByRole("button", { name: "יש לי יתרון מרחב" }).click(); await page.waitForTimeout(400);
await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(700);

log("### STEP 3 offers:");
for (const e of await controls([600, 1150])) log(`  y=${e.y} ${e.t} :: ${e.txt}`);
await shot(page, "08-step3", OUT);

await browser.close();
