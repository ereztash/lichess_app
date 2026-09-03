/** Two decisions, then every surface that claims to hold what accumulated, then a return visit. */
import { openApp, shot, visibleText } from "./session.mjs";
import { mk } from "./lib.mjs";
const { browser, page, ORIGIN, OUT } = await openApp();
const { sq, decide } = mk(page);
const log = (...a) => console.log(...a);
await page.goto(ORIGIN + "/", { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(1000);
await page.getByRole("button", { name: "עמדה מהסט המשותף" }).click();
await sq("e4").waitFor({ timeout: 60000 }); await page.waitForTimeout(1500);
log("d1 " + JSON.stringify(await decide()));
await page.getByRole("button", { name: "לעמדה הבאה" }).click();
await page.waitForFunction(() => /DECIDE/.test(document.body.innerText), null, { timeout: 30000 });
await page.waitForTimeout(1000);
log("d2 " + JSON.stringify(await decide()));
await page.waitForTimeout(1200);
try { await page.getByRole("button", { name: "לא עכשיו" }).click(); await page.waitForTimeout(500); } catch {}

log("\n### the five words in the strip: what is behind each");
for (const name of ["החלטות", "מה חוזר", "בדיקה", "תשובה"]) {
  try {
    await page.getByRole("button", { name, exact: true }).first().click({ timeout: 4000 });
    await page.waitForTimeout(900);
    const t = await visibleText(page);
    log(`\n--- ${name} (${await page.evaluate(()=>location.pathname)}) ---`);
    for (const l of t.slice(0, 34)) log("   " + l);
    await shot(page, `16-${name}`, OUT);
  } catch (e) { log(`\n--- ${name}: could not open (${String(e).slice(0,60)})`); }
}
log("\n### RETURN VISIT: reload the same profile, land where a returning person lands");
await page.goto(ORIGIN + "/", { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(2000);
await shot(page, "17-return", OUT);
for (const l of (await visibleText(page)).slice(0, 40)) log("   " + l);
await browser.close();
