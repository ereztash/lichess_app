/**
 * Does a press change anything visible, on controls that do NO async work?
 *
 * M1  no :active state anywhere  -> every control feels dead on press
 * M2  the 3.2 s commit gap       -> only the commit feels dead
 * M3  the control is removed     -> only controls that unmount feel dead
 * They separate on chips and step buttons, which are synchronous and stay mounted.
 */
import { serveBuild, launch, salience } from "./ux-lib.mjs";
const { origin, close } = await serveBuild();
const browser = await launch();
const log = (...a) => console.log(...a);
const page = await (await browser.newContext({ viewport:{width:1440,height:900}, locale:"he-IL" })).newPage();
const sq = (s) => page.locator(`[data-square="${s}"]`);

const styleOf = (sel) => page.evaluate((s) => { const el = document.querySelector(s); if (!el) return null;
  const c = getComputedStyle(el);
  return { bg: c.backgroundColor, color: c.color, border: c.borderColor, shadow: c.boxShadow.slice(0,40),
    transform: c.transform, opacity: c.opacity, outline: c.outlineStyle, filter: c.filter }; }, sel);

/** hold the mouse down and read the style while it is down */
const whileDown = async (sel) => {
  const el = await page.$(sel); if (!el) return { missing: true };
  const box = await el.boundingBox();
  const rest = await styleOf(sel);
  await el.scrollIntoViewIfNeeded().catch(()=>{});
  await page.waitForTimeout(60);
  const b2 = await el.boundingBox() ?? box;
  /* Above centre, because the sticky commit sits over the step heads at their midpoint. */
  await page.mouse.move(b2.x + b2.width/2, b2.y + Math.min(10, b2.height/3));
  await page.waitForTimeout(120);
  const hover = await styleOf(sel);
  await page.mouse.down();
  await page.waitForTimeout(140);
  const landed = await page.$eval(sel, (e) => e.matches(":active"));
  const down = await styleOf(sel);
  await page.mouse.up();
  if (!landed) return { landedOnSomethingElse: true };
  const diff = (a,b) => Object.keys(a).filter((k) => a[k] !== b[k]);
  return { hoverChanges: diff(rest, hover), activeChanges: diff(hover, down) };
};

await page.goto(origin + "/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(900);
log("### FRONT DOOR primary entry button");
const doorSel = await page.evaluate(() => { const b = [...document.querySelectorAll("button")]
  .find((x) => x.offsetParent && /עמדה מהסט המשותף/.test(x.innerText)); if (!b) return null;
  b.setAttribute("data-probe","door"); return "[data-probe=door]"; });
log("  " + JSON.stringify(doorSel ? await whileDown(doorSel) : { missing: true }));
/* whileDown already completed a click on it, so the app has moved on. */
await sq("e4").waitFor({ timeout: 60000 }); await page.waitForTimeout(1400);
await sq("b5").click(); await page.waitForTimeout(200);
await sq("b4").click(); await page.waitForTimeout(400);
log("\n### a reading chip (synchronous, stays mounted)");
const chipSel = await page.evaluate(() => { const b = [...document.querySelectorAll("button")]
  .find((x) => x.offsetParent && /המרכז סגור|יתרון מרחב/.test(x.innerText)); if (!b) return null;
  b.setAttribute("data-probe","chip"); return "[data-probe=chip]"; });
log("  " + JSON.stringify(chipSel ? await whileDown(chipSel) : { missing: true }));
log("\n### a board square (synchronous)");
log("  " + JSON.stringify(await whileDown('[data-square="a6"]')));
log("\n### the classes these controls carry");
log("  " + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll("button")].filter((b)=>b.offsetParent && !b.getAttribute("data-square")).map((b)=>b.className.toString().trim()).filter(Boolean).reduce((m,c)=>{m[c]=(m[c]??0)+1;return m;},{}))));
log("\n### the commit button, before it is satisfied");
log("  " + JSON.stringify(await whileDown(".commitment-submit, [data-commit], button[type=submit]")));
log("\n### the step header buttons");
const stepSel = await page.evaluate(() => { const b = [...document.querySelectorAll("button")]
  .find((x) => x.offsetParent && /כמה אתם בטוחים/.test(x.innerText)); if (!b) return null;
  b.setAttribute("data-probe","step"); return "[data-probe=step]"; });
log("  " + JSON.stringify(stepSel ? await whileDown(stepSel) : { missing: true }));
await browser.close(); close(); process.exit(0);
