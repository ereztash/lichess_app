/** 390x844. Where does each thing land, and what does the thumb reach without scrolling? */
import { openApp, shot, visibleText } from "./session.mjs";
import { mk } from "./lib.mjs";
const log = (...a) => console.log(...a);
const { browser, page, ORIGIN, OUT } = await openApp({ width: 390, height: 844 });
const { sq, chip, conf } = mk(page);
const map = async (label) => {
  log(`\n===== ${label} (scrollY=${await page.evaluate(()=>Math.round(scrollY))}, page=${await page.evaluate(()=>document.body.scrollHeight)}) =====`);
  for (const e of await page.evaluate(() => [...document.querySelectorAll("h1,h2,h3,p,button,[role=status]")]
    .filter((el)=>el.offsetParent && !el.getAttribute("data-square") && el.getBoundingClientRect().width>1)
    .map((el)=>({t:(el.innerText||"").replace(/\s+/g," ").trim().slice(0,52), y:Math.round(el.getBoundingClientRect().top+scrollY),
      h:Math.round(el.getBoundingClientRect().height), w:Math.round(el.getBoundingClientRect().width), tag:el.tagName.toLowerCase()}))
    .filter((e)=>e.t).sort((a,b)=>a.y-b.y))) log(`  y=${String(e.y).padStart(5)} ${e.y<844?"fold1":e.y<1688?"fold2":"fold3+"} ${e.w}x${e.h} ${e.tag}: ${e.t}`);
};
await page.goto(ORIGIN + "/", { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(1200);
await map("LANDING 390x844");
await shot(page, "22-mobile-landing", OUT);
await page.getByRole("button", { name: "עמדה מהסט המשותף" }).click();
await sq("e4").waitFor({ timeout: 60000 }); await page.waitForTimeout(1600);
await map("DECIDING 390x844");
await shot(page, "23-mobile-decide", OUT);
log("\n### board geometry: " + JSON.stringify(await page.evaluate(() => {
  const s = document.querySelector("[data-square]")?.getBoundingClientRect();
  return { square: s && { w: Math.round(s.width), h: Math.round(s.height) } }; })));
await sq("b5").click(); await page.waitForTimeout(250);
await sq("b4").click(); await page.waitForTimeout(400);
await chip("יתרון מרחב|המרכז"); await page.waitForTimeout(220);
await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(430);
await chip("^לא "); await page.waitForTimeout(220);
await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(530);
await conf(4); await page.waitForTimeout(380);
await page.locator(".commitment-submit,[data-commit],button[type=submit]").first().click();
await page.waitForTimeout(2600);
if (await page.evaluate(() => /מה כן היית עושה/.test(document.body.innerText))) {
  log("\n### the counterfactual ask fired on the handset too"); await map("COUNTERFACTUAL 390x844");
  await page.getByRole("button", { name: "לא היה לי מהלך אחר" }).click(); }
await page.waitForFunction(() => /עומק \d+|בחרת את|ס״פ/.test(document.body.innerText), null, { timeout: 60000 });
await page.waitForTimeout(1200);
await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(400);
await map("REVEAL 390x844");
await shot(page, "24-mobile-reveal", OUT);
await browser.close();
