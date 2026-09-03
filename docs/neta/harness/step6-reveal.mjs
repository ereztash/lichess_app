/**
 * STEP 6. Finish the four steps, press commit, and sample densely enough to separate
 * "I clicked" / "it acknowledged me" / "it is working" / "the work finished" / "the state changed".
 */
import { openApp, shot, visibleText } from "./session.mjs";
const { browser, page, console_, ORIGIN, OUT } = await openApp();
const log = (...a) => console.log(...a);
const sq = (s) => page.locator(`[data-square="${s}"]`);

const frame = () => page.evaluate(() => {
  const btn = document.querySelector(".commitment-submit, [data-commit], button[type=submit]");
  const bs = btn && getComputedStyle(btn);
  return {
    btn: btn ? btn.innerText.replace(/\s+/g, " ").trim().slice(0, 48) : null,
    btnBg: bs ? bs.backgroundColor : null,
    btnDis: btn ? btn.disabled : null,
    spin: !!document.querySelector(".animate-spin, [data-spinner], [aria-busy=true]"),
    reveal: !!document.querySelector(".reveal-panel, [data-reveal]"),
    revealTxt: (document.querySelector(".reveal-panel, [data-reveal]")?.innerText ?? "").replace(/\s+/g," ").trim().slice(0,70),
    status: [...document.querySelectorAll("[role=status],[aria-live]")].map((e)=>e.innerText.replace(/\s+/g," ").trim().slice(0,60)).filter(Boolean),
    boardB4: !!document.querySelector('[data-square="b4"]')?.querySelector("[data-piece], .piece"),
    boardB5: !!document.querySelector('[data-square="b5"]')?.querySelector("[data-piece], .piece"),
    h: document.body.scrollHeight,
  };
});

await page.goto(ORIGIN + "/", { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(800);
await page.getByRole("button", { name: "עמדה מהסט המשותף" }).click();
await sq("e4").waitFor({ timeout: 60000 });
await page.waitForTimeout(1500);
await sq("b5").click(); await page.waitForTimeout(300);
await sq("b4").click(); await page.waitForTimeout(600);

log("### STEP 2: press one reading chip");
await page.getByRole("button", { name: "יש לי יתרון מרחב" }).click();
await page.waitForTimeout(500);
log("  " + JSON.stringify(await frame()));

log("\n### what step 3 offers me (I have to scroll to it)");
await page.evaluate(() => window.scrollTo(0, 500));
await page.waitForTimeout(400);
log("  " + JSON.stringify((await visibleText(page)).slice(-40)));
await shot(page, "06-step3", OUT);

await browser.close();
