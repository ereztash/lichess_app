/** N-3 discriminator: does the return screen count decisions made through the blitz route? */
import { openApp, shot, visibleText } from "./session.mjs";
import { mk } from "./lib.mjs";
const log = (...a) => console.log(...a);
const { browser, page, ORIGIN, OUT } = await openApp();
const { sq, chip, conf } = mk(page);
await page.goto(ORIGIN + "/", { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(1000);
await page.getByRole("button", { name: "משחק בליץ קצר" }).click();
await page.waitForTimeout(2500);
await page.getByRole("button", { name: "3+0", exact: true }).click();
await page.waitForTimeout(4000);
await shot(page, "25-blitz-start", OUT);
log("### after pressing 'משחק בליץ קצר':");
for (const l of (await visibleText(page)).slice(0, 26)) log("   " + l);
log("\n### controls:");
for (const e of await page.evaluate(() => [...document.querySelectorAll("button")].filter((b)=>b.offsetParent&&!b.getAttribute("data-square")&&b.getBoundingClientRect().width>50)
  .map((b)=>({t:b.innerText.replace(/\s+/g," ").trim().slice(0,44),y:Math.round(b.getBoundingClientRect().top+scrollY)})).sort((a,b)=>a.y-b.y).slice(0,14))) log(`   y=${e.y} :: ${e.t}`);

/* Make decisions until at least two are recorded, however this route asks for them. */
for (let n = 1; n <= 3; n += 1) {
  const squares = await page.evaluate(() => [...document.querySelectorAll("[data-square]")].map((e)=>e.getAttribute("data-square")));
  let placed = null;
  for (const s of squares) { await sq(s).click(); await page.waitForTimeout(60);
    const h = await page.evaluate(() => [...document.querySelectorAll("[data-square]")].filter((e)=>/hint|target|legal|dest|move-option/i.test(e.className.toString())).map((e)=>e.getAttribute("data-square")));
    if (h.length) { await sq(h[0]).click(); await page.waitForTimeout(400); placed = `${s}${h[0]}`; break; } }
  if (!placed) { log(`\nmove ${n}: no legal move offered`); break; }
  try {
    await chip("יתרון מרחב|המרכז|מלך חשוף|פער בפיתוח"); await page.waitForTimeout(200);
    await page.getByRole("button", { name: "הבא", exact: true }).click({ timeout: 5000 }); await page.waitForTimeout(400);
    await chip("^לא "); await page.waitForTimeout(200);
    await page.getByRole("button", { name: "הבא", exact: true }).click({ timeout: 5000 }); await page.waitForTimeout(500);
    await conf(4); await page.waitForTimeout(350);
    await page.locator(".commitment-submit,[data-commit],button[type=submit]").first().click({ timeout: 5000 });
  } catch (e) { log(`move ${n} (${placed}): commitment panel not as expected -- ${String(e).slice(0,60)}`); }
  await page.waitForTimeout(3500);
  if (await page.evaluate(() => /מה כן היית עושה/.test(document.body.innerText)))
    { await page.getByRole("button", { name: "לא היה לי מהלך אחר" }).click(); await page.waitForTimeout(2500); }
  log(`move ${n}: placed ${placed} | strip=${await page.evaluate(() => (document.body.innerText.match(/\d+ נמדדו מתוך \d+ שנרשמו/)||["-"])[0])}`);
  try { await page.getByRole("button", { name: /לעמדה הבאה|המשך|הבא/ }).first().click({ timeout: 4000 }); await page.waitForTimeout(2500); } catch {}
}
log("\n### RETURN through the front door");
await page.goto(ORIGIN + "/", { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(2200);
await shot(page, "26-blitz-return", OUT);
for (const l of (await visibleText(page)).slice(0, 22)) log("   " + l);
await browser.close();
