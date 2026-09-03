/**
 * Clicks or time? Same move, same panel answers, two prefixes matched on wall-clock:
 *   A. 33 square clicks before placing b5b4
 *   B. no extra clicks, but the same seconds spent idle before placing b5b4
 */
import { openApp } from "./session.mjs";
import { mk } from "./lib.mjs";
const log = (...a) => console.log(...a);
const run = async (arm) => {
  const { browser, page, ORIGIN } = await openApp();
  const { sq, chip, conf } = mk(page);
  try {
    await page.goto(ORIGIN + "/", { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(900);
    await page.getByRole("button", { name: "עמדה מהסט המשותף" }).click();
    await sq("e4").waitFor({ timeout: 60000 }); await page.waitForTimeout(1400);
    const t0 = Date.now();
    if (arm === "clicks") {
      const squares = await page.evaluate(() => [...document.querySelectorAll("[data-square]")].map((e)=>e.getAttribute("data-square")).slice(0, 33));
      for (const s of squares) { await sq(s).click(); await page.waitForTimeout(80); }
    } else { await page.waitForTimeout(33 * 80); }
    const prefixMs = Date.now() - t0;
    await sq("b5").click(); await page.waitForTimeout(200);
    await sq("b4").click(); await page.waitForTimeout(400);
    await chip("יתרון מרחב|המרכז"); await page.waitForTimeout(200);
    await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(420);
    await chip("^לא "); await page.waitForTimeout(200);
    await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(520);
    await conf(4); await page.waitForTimeout(360);
    await page.locator(".commitment-submit,[data-commit],button[type=submit]").first().click();
    await page.waitForTimeout(3000);
    const gated = await page.evaluate(() => /מה כן היית עושה/.test(document.body.innerText));
    log(`arm=${arm.padEnd(6)} prefix=${String(prefixMs).padStart(5)}ms gated=${gated ? "YES" : "no"}`);
  } catch (e) { log(`arm=${arm}: THREW ${String(e).slice(0, 80)}`); }
  await browser.close();
};
for (const arm of ["clicks", "time", "clicks", "time"]) await run(arm);
