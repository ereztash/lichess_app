/** RUN A: the walk done correctly. Confidence chip picked by exact label, not by a loose regex. */
import { openApp, shot, visibleText } from "./session.mjs";
const { browser, page, console_, ORIGIN, OUT } = await openApp();
const log = (...a) => console.log(...a);
const sq = (s) => page.locator(`[data-square="${s}"]`);
await page.goto(ORIGIN + "/", { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(1000);
await page.getByRole("button", { name: "עמדה מהסט המשותף" }).click();
await sq("e4").waitFor({ timeout: 60000 }); await page.waitForTimeout(1500);
await sq("b5").click(); await page.waitForTimeout(250);
await sq("b4").click(); await page.waitForTimeout(400);
await page.getByRole("button", { name: "יש לי יתרון מרחב" }).click(); await page.waitForTimeout(250);
await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(500);
await page.getByRole("button", { name: "לא מכיר את העמדה הזו" }).click(); await page.waitForTimeout(250);
await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(600);
const conf = await page.evaluateHandle(() => [...document.querySelectorAll("button")]
  .find((b) => b.offsetParent && b.getBoundingClientRect().width < 80 && /^5\s/.test(b.innerText.trim()) && /סביר/.test(b.innerText)));
log("### confidence chip found: " + await conf.evaluate((e) => e && e.innerText.replace(/\s+/g, " ")));
await conf.asElement().click(); await page.waitForTimeout(400);
log("### ready: " + JSON.stringify(await page.evaluate(() => {
  const b = document.querySelector(".commitment-submit,[data-commit],button[type=submit]");
  return { btn: b?.innerText.replace(/\s+/g," ").trim().slice(0,30), dis: b?.disabled,
    live: [...document.querySelectorAll("[role=status],[aria-live]")].map((e)=>e.innerText.replace(/\s+/g," ").trim()).filter(Boolean).slice(-2) };})));

const t0 = Date.now(); let seen = ""; const marks = {};
await page.locator(".commitment-submit,[data-commit],button[type=submit]").first().click();
for (let i = 0; i < 400; i += 1) {
  const s = await page.evaluate(() => { const t = document.body.innerText;
    const b = document.querySelector(".commitment-submit,[data-commit],button[type=submit]");
    return { rev:/REVEAL/.test(t), computing:/המנוע מחשב/.test(t), notYet:/טרם ניתח/.test(t),
      failed:/המנוע לא סיים/.test(t), answer:/עומק ([0-9]+)|המנוע בחר|הפרש|טוב יותר|שווה/.test(t),
      btn: b ? b.innerText.replace(/\s+/g," ").trim().slice(0,24) : null,
      spin: document.querySelectorAll(".animate-spin,[aria-busy=true],[data-spinner]").length,
      head: (t.match(/\n(\d+\. ?[^\n]{1,12})\n/)||[])[1] ?? null, h: document.body.scrollHeight }; });
  const k = JSON.stringify(s);
  if (k !== seen) { log(`  +${String(Date.now()-t0).padStart(6)}ms ${k}`); seen = k;
    for (const key of ["rev","computing","answer","failed"]) if (s[key] && !marks[key]) marks[key] = Date.now()-t0; }
  if (s.answer || s.failed) break;
  await page.waitForTimeout(100);
}
log(`\n### milestones (ms from press): ${JSON.stringify(marks)}`);
await page.waitForTimeout(800);
await shot(page, "13-reveal-clean", OUT);
log("\n### THE REVEAL:"); for (const t of await visibleText(page)) log("  " + t);
await browser.close();
