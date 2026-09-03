/** How often does the press fail to produce an engine answer? Five independent first decisions. */
import { openApp } from "./session.mjs";
import { mk } from "./lib.mjs";
const log = (...a) => console.log(...a);
for (let i = 1; i <= 5; i += 1) {
  const { browser, page, ORIGIN } = await openApp();
  const { sq, decide } = mk(page);
  try {
    await page.goto(ORIGIN + "/", { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(900);
    await page.getByRole("button", { name: "עמדה מהסט המשותף" }).click();
    await sq("e4").waitFor({ timeout: 60000 }); await page.waitForTimeout(1400);
    log(`run ${i}: ${JSON.stringify(await decide())}`);
  } catch (e) { log(`run ${i}: THREW ${String(e).slice(0, 120)}`); }
  await browser.close();
}
