import { openApp, shot, visibleText } from "./session.mjs";
const { browser, page, console_, ORIGIN, OUT } = await openApp();
const log = (...a) => console.log(...a);
const sq = (s) => page.locator(`[data-square="${s}"]`);
const frame = () => page.evaluate(() => {
  const btn = document.querySelector(".commitment-submit,[data-commit],button[type=submit]");
  const bs = btn && getComputedStyle(btn);
  const rev = document.querySelector(".reveal-panel,[data-reveal]");
  return { btn: btn ? btn.innerText.replace(/\s+/g," ").trim().slice(0,34) : null,
    bg: bs ? bs.backgroundColor.replace(/\s/g,"") : null, dis: btn ? btn.disabled : null,
    spin: document.querySelectorAll(".animate-spin,[data-spinner],[aria-busy=true]").length,
    reveal: !!rev, rev: rev ? rev.innerText.replace(/\s+/g," ").trim().slice(0,50) : "",
    live: ([...document.querySelectorAll("[role=status],[aria-live]")].map((e)=>e.innerText.replace(/\s+/g," ").trim()).filter(Boolean).slice(-1)[0]??"").slice(0,55),
    b4: !!document.querySelector('[data-square="b4"]')?.querySelector("[data-piece],.piece"),
    h: document.body.scrollHeight };
});

await page.goto(ORIGIN + "/", { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(800);
await page.getByRole("button", { name: "עמדה מהסט המשותף" }).click();
await sq("e4").waitFor({ timeout: 60000 }); await page.waitForTimeout(1500);
await sq("b5").click(); await page.waitForTimeout(250);
await sq("b4").click(); await page.waitForTimeout(400);
await page.getByRole("button", { name: "יש לי יתרון מרחב" }).click(); await page.waitForTimeout(300);
await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(600);
await page.getByRole("button", { name: "לא מכיר את העמדה הזו" }).click(); await page.waitForTimeout(300);
await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(700);

log("### the whole confidence scale, as offered:");
for (const e of await page.evaluate(() => [...document.querySelectorAll("button")].filter((el)=>el.offsetParent&&!el.getAttribute("data-square"))
  .map((el)=>({t:el.innerText.replace(/\s+/g," ").trim().slice(0,30),y:Math.round(el.getBoundingClientRect().top+scrollY),w:Math.round(el.getBoundingClientRect().width)}))
  .filter((e)=>e.y>430&&e.y<800))) log(`  y=${e.y} w=${e.w} :: ${e.t}`);

await page.getByRole("button", { name: /^5/ }).first().click(); await page.waitForTimeout(500);
log("\n### ready to commit: " + JSON.stringify(await frame()));
await shot(page, "10-ready", OUT);

log("\n### PRESS. sampling every 100 ms:");
const t0 = Date.now();
const btn = page.locator(".commitment-submit,[data-commit],button[type=submit]").first();
await btn.click();
let prev = "";
for (let i = 0; i < 90; i += 1) {
  const f = await frame();
  const key = JSON.stringify(f);
  if (key !== prev) { log(`  +${String(Date.now()-t0).padStart(5)}ms ${JSON.stringify(f)}`); prev = key; }
  if (f.reveal && Date.now()-t0 > 2000) break;
  await page.waitForTimeout(100);
}
log(`\n### total to reveal: ${Date.now()-t0} ms`);
await shot(page, "11-reveal", OUT);
log("\n### THE REVEAL, as text:");
for (const t of await visibleText(page)) log("  " + t);
log("\n### console:"); for (const c of console_.slice(-20)) log("  " + c);
await browser.close();
