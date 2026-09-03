/** Second decision on the served position, second reveal, and whatever appears after reveal 2. */
import { openApp, shot, visibleText } from "./session.mjs";
const { browser, page, console_, ORIGIN, OUT } = await openApp();
const log = (...a) => console.log(...a);
const sq = (s) => page.locator(`[data-square="${s}"]`);
const chip = async (rx) => { const h = await page.evaluateHandle((r) => [...document.querySelectorAll("button")]
  .find((b) => b.offsetParent && new RegExp(r).test(b.innerText.replace(/\s+/g," ").trim())), rx);
  const el = h.asElement(); if (!el) throw new Error("no chip " + rx); await el.click(); };
const conf = async (n) => { const h = await page.evaluateHandle((k) => [...document.querySelectorAll("button")]
  .find((b) => b.offsetParent && b.getBoundingClientRect().width < 80 && new RegExp("^"+k+"\\s").test(b.innerText.trim())), n);
  await h.asElement().click(); };
/** A legal move, found the way a person does: try a piece, see if anything lights up. */
const anyLegalMove = async () => {
  const squares = await page.evaluate(() => [...document.querySelectorAll("[data-square]")].map((e)=>e.getAttribute("data-square")));
  for (const s of squares) {
    await sq(s).click(); await page.waitForTimeout(90);
    const hints = await page.evaluate(() => [...document.querySelectorAll("[data-square]")]
      .filter((e)=>/hint|target|legal|dest|move-option/i.test(e.className.toString())).map((e)=>e.getAttribute("data-square")));
    if (hints.length) { await sq(hints[0]).click(); await page.waitForTimeout(400); return `${s}${hints[0]}`; }
  }
  throw new Error("no legal move found by clicking");
};
const btnNow = () => page.evaluate(() => document.querySelector(".commitment-submit,[data-commit],button[type=submit]")?.innerText.replace(/\s+/g," ").trim().slice(0,40) ?? "GONE");
const full = async (label) => {
  const mv = await anyLegalMove(); log(`  ${label}: placed ${mv} | btn=${await btnNow()}`);
  await chip("יתרון מרחב|המרכז|מלך חשוף|פער בפיתוח"); await page.waitForTimeout(250);
  log(`    after reading chip: btn=${await btnNow()}`);
  await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(450);
  await chip("^לא "); await page.waitForTimeout(250);
  log(`    after cannot-assess chip: btn=${await btnNow()}`);
  await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(550);
  await conf(4); await page.waitForTimeout(400);
  log(`    after confidence: btn=${await btnNow()}`);
  const t0 = Date.now();
  await page.locator(".commitment-submit,[data-commit],button[type=submit]").first().click();
  await page.waitForFunction(() => /עומק \d+|בחרת את/.test(document.body.innerText), null, { timeout: 60000 });
  log(`  ${label}: press -> answer ${Date.now()-t0} ms`);
};

await page.goto(ORIGIN + "/", { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(1000);
await page.getByRole("button", { name: "עמדה מהסט המשותף" }).click();
await sq("e4").waitFor({ timeout: 60000 }); await page.waitForTimeout(1500);
log("### decision 1"); await full("d1");
await page.getByRole("button", { name: "לעמדה הבאה" }).click();
await page.waitForFunction(() => /DECIDE/.test(document.body.innerText), null, { timeout: 30000 });
await page.waitForTimeout(1200);
log("\n### decision 2 (continuation position)"); await full("d2");
await page.waitForTimeout(1500);
await shot(page, "15-reveal-2", OUT);
log("\n### AFTER REVEAL 2, the whole screen:");
for (const t of await visibleText(page)) log("  " + t);
await browser.close();
