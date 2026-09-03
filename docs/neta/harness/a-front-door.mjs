import { serveBuild, launch, salience, systemInventory } from "./ux-lib.mjs";
const { origin, close } = await serveBuild();
const browser = await launch();
const log = (...a) => console.log(...a);
for (const [w,h,name] of [[1440,900,"desktop"],[390,844,"handset"]]) {
  const page = await (await browser.newContext({ viewport:{width:w,height:h}, locale:"he-IL" })).newPage();
  await page.goto(origin + "/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1200);
  log(`\n${"=".repeat(70)}\nFRONT DOOR ${name} ${w}x${h}\n${"=".repeat(70)}`);
  log("\n--- what the eye is offered, ranked by area x weight x contrast ---");
  for (const e of (await salience(page)).slice(0, 14))
    log(`  ${String(e.score).padStart(4)}  y=${String(e.y).padStart(4)} ${String(e.w).padStart(4)}x${String(e.h).padStart(3)} ${String(e.px).padStart(5)}px/${e.weight} c=${e.contrast}  ${e.tag}: ${e.text}`);
  const inv = await systemInventory(page);
  log(`\n--- the visual system, counted over ${inv.elements} rendered elements ---`);
  log(`  font sizes  (${inv.fontSizes.length}): ${inv.fontSizes.map(([k,v])=>`${k}x${v}`).join("  ")}`);
  log(`  weights     (${inv.fontWeights.length}): ${inv.fontWeights.map(([k,v])=>`${k}x${v}`).join("  ")}`);
  log(`  families    (${inv.families.length}): ${inv.families.map(([k,v])=>`${k}x${v}`).join("  ")}`);
  log(`  radii       (${inv.radii.length}): ${inv.radii.map(([k,v])=>`${k}x${v}`).join("  ")}`);
  log(`  row gaps    (${inv.rowGaps.length}): ${inv.rowGaps.map(([k,v])=>`${k}x${v}`).join("  ")}`);
  log(`  paddings    (${inv.paddings.length}): ${inv.paddings.map(([k,v])=>`${k}x${v}`).join("  ")}`);
  log(`  surfaces    (${inv.surfaces.length}): ${inv.surfaces.map(([k,v])=>`${k}x${v}`).join("  ")}`);
  log(`  borders     (${inv.borders.length}): ${inv.borders.map(([k,v])=>`${k} x${v}`).join(" | ")}`);
  log(`  shadows     (${inv.shadows.length}): ${inv.shadows.map(([k,v])=>`${k} x${v}`).join(" | ")}`);
  await page.screenshot({ path: `/tmp/claude-0/-home-user-lichess-app/634dd395-630e-5c56-b477-315c92c04969/scratchpad/audit-front-${name}.png` });
  await page.context().close();
}
await browser.close(); close(); process.exit(0);
