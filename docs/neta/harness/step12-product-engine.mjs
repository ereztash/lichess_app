/** Watch the PRODUCT start its own engine, at the moment of commit. Full URLs, content-types. */
import { openApp, shot, visibleText } from "./session.mjs";
const { browser, context, page, console_, ORIGIN, OUT } = await openApp();
const log = (...a) => console.log(...a);
const sq = (s) => page.locator(`[data-square="${s}"]`);
const net = [];
page.on("response", async (r) => { const u = r.url();
  if (/stockfish|\.wasm|client-event|api\//.test(u)) net.push(`${Date.now()%100000} ${r.status()} ${r.headers()["content-type"]?.slice(0,24)} ${u.replace(ORIGIN,"")}`); });
page.on("requestfailed", (r) => net.push(`FAILED ${r.url().replace(ORIGIN,"")} :: ${r.failure()?.errorText}`));
page.on("worker", (w) => { net.push(`>>> WORKER ${w.url().replace(ORIGIN,"").slice(0,90)}`); w.on("close",()=>net.push("<<< WORKER CLOSED")); });
context.on("weberror", (e) => net.push("WEBERROR " + e.error().message.slice(0,120)));

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
await page.getByRole("button", { name: /^5/ }).first().click(); await page.waitForTimeout(400);

net.length = 0; net.push("--- PRESS ---");
const t0 = Date.now();
await page.locator(".commitment-submit,[data-commit],button[type=submit]").first().click();

/* sample by TEXT, because the reveal does not carry the class my earlier probe looked for */
let seen = "";
for (let i = 0; i < 200; i += 1) {
  const s = await page.evaluate(() => {
    const t = document.body.innerText;
    const btn = document.querySelector(".commitment-submit,[data-commit],button[type=submit]");
    return { rev: /REVEAL/.test(t), engineFail: /המנוע לא סיים/.test(t), engineOk: /עומק|הערכה|centipawn|המנוע אומר|טוב יותר/.test(t),
      btn: btn ? btn.innerText.replace(/\s+/g," ").trim().slice(0,26) : null,
      spin: document.querySelectorAll(".animate-spin,[aria-busy=true],[data-spinner]").length,
      live: ([...document.querySelectorAll("[role=status],[aria-live]")].map((e)=>e.innerText.replace(/\s+/g," ").trim()).filter(Boolean).slice(-1)[0]??"").slice(0,50),
      h: document.body.scrollHeight };
  });
  const k = JSON.stringify(s);
  if (k !== seen) { log(`  +${String(Date.now()-t0).padStart(6)}ms ${k}`); seen = k; }
  if (s.rev) break;
  await page.waitForTimeout(100);
}
log(`\n### press -> REVEAL on screen: ${Date.now()-t0} ms`);
await page.waitForTimeout(1500);
log("\n### network from the press onward:");
for (const n of net) log("  " + n);
log("\n### console:"); for (const c of console_.slice(-25)) log("  " + c);
await shot(page, "12-reveal", OUT);
log("\n### reveal text:"); for (const t of await visibleText(page)) log("  " + t);
await browser.close();
