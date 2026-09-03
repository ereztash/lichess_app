/**
 * The counterfactual ask fires on some sessions and not others. Three candidates:
 *   M1 randomised arm            -> no relation to which move was played
 *   M2 fires on engine agreement -> fires when the played move is the engine's
 *   M3 fires on the first decision of a profile only -> fires every clean session
 * Discriminator: play the engine's move (b5b4) in half the sessions and a different legal
 * move in the other half, all clean profiles, and see whether the ask co-varies.
 */
import { openApp } from "./session.mjs";
import { mk } from "./lib.mjs";
const log = (...a) => console.log(...a);
const plan = [["b5","b4"],["a6","a5"],["b5","b4"],["h7","h6"],["b5","b4"],["a6","a5"]];
for (const [from, to] of plan) {
  const { browser, page, ORIGIN } = await openApp();
  const { sq, chip, conf } = mk(page);
  try {
    await page.goto(ORIGIN + "/", { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(900);
    await page.getByRole("button", { name: "עמדה מהסט המשותף" }).click();
    await sq("e4").waitFor({ timeout: 60000 }); await page.waitForTimeout(1400);
    await sq(from).click(); await page.waitForTimeout(200);
    await sq(to).click(); await page.waitForTimeout(400);
    const placed = await page.evaluate(() => (document.body.innerText.match(/המהלך שנרשם: (\w+)|([a-h][1-8][a-h][1-8]) נבחר/)||[])[0] ?? null);
    await chip("יתרון מרחב|המרכז"); await page.waitForTimeout(200);
    await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(420);
    await chip("^לא "); await page.waitForTimeout(200);
    await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(520);
    await conf(4); await page.waitForTimeout(360);
    await page.locator(".commitment-submit,[data-commit],button[type=submit]").first().click();
    await page.waitForTimeout(3000);
    const gated = await page.evaluate(() => /לפני שהמנוע מדבר|מה כן היית עושה/.test(document.body.innerText));
    if (gated) { await page.getByRole("button", { name: "לא היה לי מהלך אחר" }).click(); }
    await page.waitForFunction(() => /עומק \d+|בחרת את|ס״פ/.test(document.body.innerText), null, { timeout: 60000 });
    const agree = await page.evaluate(() => /וזה גם המהלך של המנוע/.test(document.body.innerText));
    log(`${from}${to}: gated=${gated ? "YES" : "no "} agreesWithEngine=${agree ? "YES" : "no "} (${placed})`);
  } catch (e) { log(`${from}${to}: THREW ${String(e).slice(0, 90)}`); }
  await browser.close();
}
