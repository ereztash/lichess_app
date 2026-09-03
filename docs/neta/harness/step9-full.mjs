/**
 * STEP 9. The whole decision, end to end, with the press-to-reveal interval sampled at 100 ms.
 * The five states the user asked to be separable:
 *   clicked / acknowledged / working / finished / visibly changed.
 */
import { openApp, shot, visibleText } from "./session.mjs";
const { browser, page, console_, ORIGIN, OUT } = await openApp();
const log = (...a) => console.log(...a);
const sq = (s) => page.locator(`[data-square="${s}"]`);
const controls = async (lo, hi) => (await page.evaluate(() => [...document.querySelectorAll("button,input,[role=slider],[role=radio]")]
  .filter((el)=>el.offsetParent && !el.getAttribute("data-square") && el.getBoundingClientRect().width>0)
  .map((el)=>({txt:(el.innerText||el.value||el.getAttribute("aria-label")||"").replace(/\s+/g," ").trim().slice(0,50),
    y:Math.round(el.getBoundingClientRect().top+scrollY), t:el.tagName.toLowerCase(), type:el.getAttribute("type")}))
  .filter((e)=>e.txt).sort((a,b)=>a.y-b.y))).filter((e)=>e.y>lo&&e.y<hi);

const frame = () => page.evaluate(() => {
  const btn = document.querySelector(".commitment-submit, [data-commit], button[type=submit]");
  const bs = btn && getComputedStyle(btn);
  const rev = document.querySelector(".reveal-panel, [data-reveal]");
  return {
    btn: btn ? btn.innerText.replace(/\s+/g," ").trim().slice(0,40) : null,
    bg: bs ? bs.backgroundColor.replace(/\s/g,"") : null,
    dis: btn ? btn.disabled : null,
    busy: btn ? btn.getAttribute("aria-busy") : null,
    spin: document.querySelectorAll(".animate-spin,[data-spinner],[aria-busy=true]").length,
    reveal: !!rev,
    rev: rev ? rev.innerText.replace(/\s+/g," ").trim().slice(0,55) : "",
    live: [...document.querySelectorAll("[role=status],[aria-live]")].map((e)=>e.innerText.replace(/\s+/g," ").trim()).filter(Boolean).slice(-2),
    b4: !!document.querySelector('[data-square="b4"]')?.querySelector("[data-piece],.piece"),
    h: document.body.scrollHeight,
  };
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

log("### STEP 4 offers:");
for (const e of await controls(600, 1400)) log(`  y=${e.y} ${e.t}${e.type?"/"+e.type:""} :: ${e.txt}`);
await shot(page, "09-step4", OUT);
log("\n### frame before answering step 4: " + JSON.stringify(await frame()));
await browser.close();
