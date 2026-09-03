/** RUN A continued: press the continuation, decide again, read the second reveal, then look for
 *  anything that shows accumulation. Same clean session throughout -- no reload. */
import { openApp, shot, visibleText } from "./session.mjs";
const { browser, page, console_, ORIGIN, OUT } = await openApp();
const log = (...a) => console.log(...a);
const sq = (s) => page.locator(`[data-square="${s}"]`);
const chip = async (rx) => { const h = await page.evaluateHandle((r) => [...document.querySelectorAll("button")]
  .find((b) => b.offsetParent && new RegExp(r).test(b.innerText.replace(/\s+/g," ").trim())), rx.source ?? rx);
  const el = h.asElement(); if (!el) throw new Error("no chip for " + rx); await el.click(); };
const state = () => page.evaluate(() => { const t = document.body.innerText;
  return { url: location.pathname, head: (t.match(/\n(\d+\. ?[^\n]{1,12})\n/)||[])[1] ?? null,
    rev: /REVEAL/.test(t), decide: /DECIDE/.test(t), counter: (t.match(/\d+ נמדדו מתוך \d+ שנרשמו/)||[])[0] ?? null,
    lead: (t.match(/עוד \d+ החלטות[^\n]{0,60}/)||[])[0] ?? null,
    btn: document.querySelector(".commitment-submit,[data-commit],button[type=submit]")?.innerText.replace(/\s+/g," ").trim().slice(0,30) ?? null }; });

const decide = async (from, to, label) => {
  await sq(from).click(); await page.waitForTimeout(250);
  await sq(to).click(); await page.waitForTimeout(400);
  await chip(/יתרון מרחב|המרכז סגור|המרכז פתוח/); await page.waitForTimeout(250);
  await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(500);
  await chip(/^לא /); await page.waitForTimeout(250);
  await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(600);
  const c = await page.evaluateHandle(() => [...document.querySelectorAll("button")]
    .find((b) => b.offsetParent && b.getBoundingClientRect().width < 80 && /^4\s/.test(b.innerText.trim())));
  await c.asElement().click(); await page.waitForTimeout(400);
  const t0 = Date.now();
  await page.locator(".commitment-submit,[data-commit],button[type=submit]").first().click();
  await page.waitForFunction(() => /עומק \d+|הפרש|בחרת את/.test(document.body.innerText), null, { timeout: 60000 });
  log(`  ${label}: press -> engine answer ${Date.now()-t0} ms`);
};

await page.goto(ORIGIN + "/", { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(1000);
await page.getByRole("button", { name: "עמדה מהסט המשותף" }).click();
await sq("e4").waitFor({ timeout: 60000 }); await page.waitForTimeout(1500);
log("### decision 1"); await decide("b5", "b4", "d1");
log("  state: " + JSON.stringify(await state()));

log("\n### PRESS 'לעמדה הבאה' -- the continuation");
const t0 = Date.now(); const before = await state();
await page.getByRole("button", { name: "לעמדה הבאה" }).click();
let seen = "";
for (let i = 0; i < 60; i += 1) { const s = await state(); const k = JSON.stringify(s);
  if (k !== seen) { log(`  +${String(Date.now()-t0).padStart(5)}ms ${k}`); seen = k; }
  if (s.decide && s.head && s.head !== before.head) break; await page.waitForTimeout(100); }
await page.waitForTimeout(1200);
await shot(page, "14-after-continue", OUT);
log("\n### can I move here? legal destinations from the first piece I try:");
log("  " + JSON.stringify(await page.evaluate(() => ({ squares: document.querySelectorAll("[data-square]").length,
  btn: document.querySelector(".commitment-submit,[data-commit],button[type=submit]")?.innerText.replace(/\s+/g," ").trim() ?? null }))));
log("\n### board now:"); for (const t of (await visibleText(page)).slice(0, 16)) log("  " + t);
await browser.close();
