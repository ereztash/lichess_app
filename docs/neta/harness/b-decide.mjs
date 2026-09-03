import { serveBuild, launch, salience, systemInventory, press } from "./ux-lib.mjs";
const { origin, close } = await serveBuild();
const browser = await launch();
const log = (...a) => console.log(...a);
const OUT = "/tmp/claude-0/-home-user-lichess-app/634dd395-630e-5c56-b477-315c92c04969/scratchpad";
const rank = async (page, n = 12, label = "") => {
  log(`\n--- what the eye is offered${label ? " :: " + label : ""} ---`);
  for (const e of (await salience(page)).slice(0, n))
    log(`  ${String(e.score).padStart(4)}  y=${String(e.y).padStart(4)} ${String(e.w).padStart(4)}x${String(e.h).padStart(3)} ${String(e.px).padStart(5)}px/${e.weight} c=${e.contrast}  ${e.tag}: ${e.text}`);
};
for (const [w,h,name] of [[1440,900,"desktop"],[390,844,"handset"]]) {
  const page = await (await browser.newContext({ viewport:{width:w,height:h}, locale:"he-IL" })).newPage();
  const sq = (s) => page.locator(`[data-square="${s}"]`);
  const chip = async (rx) => { const x = await page.evaluateHandle((r) => [...document.querySelectorAll("button")]
    .find((b) => b.offsetParent && new RegExp(r).test(b.innerText.replace(/\s+/g," ").trim())), rx); await x.asElement().click(); };
  await page.goto(origin + "/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(900);
  log(`\n${"=".repeat(70)}\nDECIDING SCREEN ${name} ${w}x${h}\n${"=".repeat(70)}`);
  const enter = await press(page, () => page.getByRole("button", { name: "עמדה מהסט המשותף" }).click(), 4000);
  log("press 'עמדה מהסט המשותף' -> " + JSON.stringify(enter.slice(0,4)));
  await sq("e4").waitFor({ timeout: 60000 }); await page.waitForTimeout(1400);
  await rank(page, 12, "before any move");
  const inv = await systemInventory(page);
  log(`\n  system: ${inv.elements} els | sizes ${inv.fontSizes.length} | weights ${inv.fontWeights.map(([k,v])=>k+"x"+v).join(" ")} | radii ${inv.radii.length} | shadows ${inv.shadows.length} | surfaces ${inv.surfaces.length}`);
  await page.screenshot({ path: `${OUT}/audit-decide-${name}.png` });

  log("\n--- placing a move: b5 then b4 ---");
  log("  select b5 -> " + JSON.stringify((await press(page, () => sq("b5").click(), 1500)).slice(0,3)));
  log("  choose b4 -> " + JSON.stringify((await press(page, () => sq("b4").click(), 1500)).slice(0,3)));
  await chip("יתרון מרחב|המרכז"); await page.waitForTimeout(250);
  await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(450);
  await chip("^לא "); await page.waitForTimeout(250);
  await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(550);
  const c = await page.evaluateHandle(() => [...document.querySelectorAll("button")]
    .find((b) => b.offsetParent && b.getBoundingClientRect().width < 90 && /^4\s/.test(b.innerText.trim())));
  await c.asElement().click(); await page.waitForTimeout(400);
  await rank(page, 10, "ready to commit");

  log("\n--- THE COMMIT PRESS, sampled at 50 ms ---");
  const frames = await press(page, () => page.locator(".commitment-submit,[data-commit],button[type=submit]").first().click(), 9000);
  for (const f of frames) log(`  +${String(f.ms).padStart(5)}ms len=${f.len} busy=${f.busy} disabledButtons=${f.disabled} h=${f.h} focus=${f.focus}`);
  await page.waitForTimeout(2500);
  if (await page.evaluate(() => /מה כן היית עושה/.test(document.body.innerText)))
    { log("  [counterfactual arm fired]"); await page.getByRole("button", { name: "לא היה לי מהלך אחר" }).click();
      await page.waitForFunction(() => /עומק \d+|בחרת את|ס״פ/.test(document.body.innerText), null, { timeout: 60000 }); }
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollTo(0,0)); await page.waitForTimeout(300);
  await rank(page, 14, "the reveal");
  await page.screenshot({ path: `${OUT}/audit-reveal-${name}.png` });
  await page.context().close();
}
await browser.close(); close(); process.exit(0);
