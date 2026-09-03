import { openApp, perceptualScan, shot, visibleText } from "./session.mjs";
const { browser, page, console_, ORIGIN, OUT } = await openApp();
const log = (...a) => console.log(...a);
const sample = async (label, ms = 250, n = 10) => {
  const t0 = Date.now(); const rows = [];
  for (let i = 0; i < n; i += 1) {
    await page.waitForTimeout(ms);
    rows.push({ ms: Date.now() - t0, ...(await page.evaluate(() => ({
      stage: document.querySelector("[data-stage]")?.getAttribute("data-stage") ?? null,
      squares: document.querySelectorAll("[data-square]").length,
      acts: [...document.querySelectorAll("[data-primary-action]")].filter((e)=>e.offsetParent).map((e)=>e.getAttribute("data-primary-action")).join(","),
      reveal: !!document.querySelector(".reveal-panel"),
      waiting: !!document.querySelector(".reveal-waiting"),
      commit: !!document.querySelector(".commitment-submit"),
      note: document.querySelector("[role=status]")?.innerText?.replace(/\s+/g," ").slice(0,60) ?? "",
    }))) });
  }
  log(`\n### ${label}`);
  for (const r of rows) log(`  +${String(r.ms).padStart(5)}ms stage=${r.stage} sq=${r.squares} acts=[${r.acts}] commit=${r.commit?1:0} waiting=${r.waiting?1:0} reveal=${r.reveal?1:0} :: ${r.note}`);
};

await page.goto(ORIGIN + "/", { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(1000);

log("### ACT: press 'עמדה מהסט המשותף'");
await page.getByRole("button", { name: "עמדה מהסט המשותף" }).click();
await sample("between the press and a board", 250, 10);
await page.locator("[data-square]").first().waitFor({ timeout: 60000 });
await page.waitForTimeout(1200);

log("\n### THE DECIDING SCREEN, above the fold:");
for (const e of await perceptualScan(page)) {
  log(`y=${String(e.y).padStart(4)} ${e.px.padStart(6)}/${String(e.weight).padStart(3)} ${e.w}x${e.h} ${e.act?"["+e.act+"] ":""}${e.tag}: ${e.text}`);
}
log("\n### geometry");
log(await page.evaluate(() => {
  const sq = document.querySelector("[data-square]")?.getBoundingClientRect();
  const stage = document.querySelector(".board-stage")?.getBoundingClientRect();
  return { square: sq && {w:Math.round(sq.width),h:Math.round(sq.height)},
           stage: stage && {w:Math.round(stage.width),h:Math.round(stage.height),top:Math.round(stage.top)},
           pageHeight: document.body.scrollHeight, viewportH: innerHeight };
}));
await shot(page, "03-deciding", OUT);
log("\n### FULL TEXT of the deciding screen:");
for (const t of await visibleText(page)) log("  " + t);
await browser.close();
