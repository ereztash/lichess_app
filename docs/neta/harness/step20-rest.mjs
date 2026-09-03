import { openApp, shot, visibleText } from "./session.mjs";
import { mk } from "./lib.mjs";
const log = (...a) => console.log(...a);
const { browser, page, ORIGIN, OUT } = await openApp();
const { sq, chip, conf } = mk(page);
const decide = async (from, to) => {
  await sq(from).click(); await page.waitForTimeout(200);
  await sq(to).click(); await page.waitForTimeout(400);
  await chip("יתרון מרחב|המרכז|מלך חשוף"); await page.waitForTimeout(200);
  await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(420);
  await chip("^לא "); await page.waitForTimeout(200);
  await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(520);
  await conf(4); await page.waitForTimeout(360);
  await page.locator(".commitment-submit,[data-commit],button[type=submit]").first().click();
  await page.waitForTimeout(2600);
  if (await page.evaluate(() => /מה כן היית עושה/.test(document.body.innerText)))
    await page.getByRole("button", { name: "לא היה לי מהלך אחר" }).click();
  await page.waitForFunction(() => /עומק \d+|בחרת את|ס״פ/.test(document.body.innerText), null, { timeout: 60000 });
};
await page.goto(ORIGIN + "/", { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(900);
await page.getByRole("button", { name: "עמדה מהסט המשותף" }).click();
await sq("e4").waitFor({ timeout: 60000 }); await page.waitForTimeout(1400);
await decide("b5", "b4");
await page.getByRole("button", { name: "לעמדה הבאה" }).click();
await page.waitForFunction(() => /DECIDE/.test(document.body.innerText), null, { timeout: 30000 });
await page.waitForTimeout(1000);
const legal = await page.evaluate(async () => null);
await (async () => { const { anyLegalMove } = mk(page); })();
/* second position: find any legal move the direct way */
{
  const squares = await page.evaluate(() => [...document.querySelectorAll("[data-square]")].map((e)=>e.getAttribute("data-square")));
  let done = false;
  for (const s of squares) { if (done) break; await sq(s).click(); await page.waitForTimeout(70);
    const h = await page.evaluate(() => [...document.querySelectorAll("[data-square]")].filter((e)=>/hint|target|legal|dest|move-option/i.test(e.className.toString())).map((e)=>e.getAttribute("data-square")));
    if (h.length) { await sq(h[0]).click(); await page.waitForTimeout(350); done = true; } }
  await chip("יתרון מרחב|המרכז|מלך חשוף"); await page.waitForTimeout(200);
  await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(420);
  await chip("^לא "); await page.waitForTimeout(200);
  await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(520);
  await conf(4); await page.waitForTimeout(360);
  await page.locator(".commitment-submit,[data-commit],button[type=submit]").first().click();
  await page.waitForTimeout(2600);
  if (await page.evaluate(() => /מה כן היית עושה/.test(document.body.innerText)))
    await page.getByRole("button", { name: "לא היה לי מהלך אחר" }).click();
  await page.waitForFunction(() => /עומק \d+|בחרת את|ס״פ/.test(document.body.innerText), null, { timeout: 60000 });
}
await page.waitForTimeout(1000);
try { await page.getByRole("button", { name: "לא עכשיו" }).click({ timeout: 3000 }); await page.waitForTimeout(400); } catch {}

for (const name of ["החלטות", "מה חוזר", "בדיקה", "תשובה", "כאן"]) {
  try {
    await page.getByRole("button", { name, exact: true }).first().click({ timeout: 4000 });
    await page.waitForTimeout(900);
    log(`\n===== ${name} @ ${await page.evaluate(()=>location.pathname)} =====`);
    for (const l of (await visibleText(page)).slice(0, 30)) log("   " + l);
    await shot(page, `20-${name.replace(/ /g,"-")}`, OUT);
  } catch (e) { log(`\n===== ${name}: not reachable as a button`); }
}
log("\n===== RETURN VISIT: same profile, front door again =====");
await page.goto(ORIGIN + "/", { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(2200);
await shot(page, "21-return", OUT);
for (const l of (await visibleText(page)).slice(0, 34)) log("   " + l);
log("\n### first three controls a returning person sees:");
for (const e of await page.evaluate(() => [...document.querySelectorAll("button,a")].filter((b)=>b.offsetParent&&b.getBoundingClientRect().top<900&&b.getBoundingClientRect().width>60)
  .map((b)=>({t:b.innerText.replace(/\s+/g," ").trim().slice(0,44),y:Math.round(b.getBoundingClientRect().top),w:Math.round(b.getBoundingClientRect().width)})).sort((a,b)=>a.y-b.y).slice(0,10))) log(`   y=${e.y} w=${e.w} :: ${e.t}`);
await browser.close();
