import { serveBuild, launch } from "./ux-lib.mjs";
const { origin, close } = await serveBuild();
const browser = await launch();
const log = (...a) => console.log(...a);
const page = await (await browser.newContext({ viewport:{width:1440,height:900}, locale:"he-IL" })).newPage();
await page.goto(origin + "/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1000);
log("### the primary control, empty username vs filled");
const readPrimary = () => page.evaluate(() => {
  const el = document.querySelector(".primary-control"); if (!el) return null;
  const s = getComputedStyle(el);
  return { disabled: el.disabled, ariaDisabled: el.getAttribute("aria-disabled"),
    color: s.color, bg: s.backgroundColor, border: s.borderColor, opacity: s.opacity, cls: el.className };
});
log("  empty:  " + JSON.stringify(await readPrimary()));
const input = await page.$("input[type=text], input:not([type])");
if (input) { await input.fill("erez281"); await page.waitForTimeout(400); }
log("  filled: " + JSON.stringify(await readPrimary()));

log("\n### the four icon-only controls in the header");
for (const i of await page.evaluate(() => [...document.querySelectorAll("button")]
  .filter((b)=>b.offsetParent && !(b.innerText||"").trim() && b.getAttribute("aria-label"))
  .map((b)=>{ const r=b.getBoundingClientRect(); const s=getComputedStyle(b);
    return { label:b.getAttribute("aria-label"), y:Math.round(r.top), x:Math.round(r.left),
             w:Math.round(r.width), h:Math.round(r.height), title:b.getAttribute("title"), cls:b.className }; })))
  log("   " + JSON.stringify(i));
await browser.close(); close(); process.exit(0);
