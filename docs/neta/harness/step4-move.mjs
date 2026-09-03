/**
 * STEP 4. Place a move. Recorded as a stranger would: look, click, look again.
 * No source is read by this script. It only asks the browser what is on screen.
 */
import { openApp, shot, visibleText } from "./session.mjs";
const { browser, page, console_, ORIGIN, OUT } = await openApp();
const log = (...a) => console.log(...a);

const board = () => page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll("[data-square]")) {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    out.push({
      sq: el.getAttribute("data-square"),
      txt: (el.innerText || "").trim().slice(0, 4),
      cls: el.className.toString().replace(/\s+/g, " ").slice(0, 90),
      // what a person can actually SEE as different about this square
      ring: s.boxShadow !== "none" ? "ring" : "",
      out: s.outlineStyle !== "none" ? "outline" : "",
      bg: s.backgroundColor,
      childBg: el.firstElementChild ? getComputedStyle(el.firstElementChild).backgroundColor : "",
      y: Math.round(r.top), x: Math.round(r.left),
    });
  }
  return out;
});

const diff = (a, b) => {
  const A = new Map(a.map((r) => [r.sq, JSON.stringify(r)]));
  const rows = [];
  for (const r of b) if (A.get(r.sq) !== JSON.stringify(r)) rows.push(r);
  return rows;
};

await page.goto(ORIGIN + "/", { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(800);
await page.getByRole("button", { name: "עמדה מהסט המשותף" }).click();
await page.locator("[data-square]").first().waitFor({ timeout: 60000 });
await page.waitForTimeout(1500);

const b0 = await board();
log("### THE BOARD AS SHOWN (piece squares only)");
for (const r of b0.filter((r) => r.txt)) log(`  ${r.sq} "${r.txt}" y=${r.y}`);
log(`\n  empty squares: ${b0.filter((r) => !r.txt).length} of ${b0.length}`);
log("\n### IS THERE ANYTHING ON SCREEN SAYING WHOSE TURN IT IS?");
const turn = await page.evaluate(() => {
  const hits = [];
  for (const el of document.querySelectorAll("*")) {
    if (el.children.length) continue;
    const t = (el.innerText || "").trim();
    if (/לבן|שחור|תור|to move|white|black/i.test(t) && t.length < 80) hits.push(t);
  }
  return [...new Set(hits)];
});
log("  " + JSON.stringify(turn));

log("\n### ACT: click a square with a piece on it (the king's knight, g8/b8 style guess)");
// A stranger clicks something that looks like theirs. Pick the first piece square in the
// bottom half of the board -- the side facing them.
const mine = b0.filter((r) => r.txt).sort((a, b) => b.y - a.y);
log("  bottom-most pieces: " + mine.slice(0, 8).map((r) => `${r.sq}"${r.txt}"`).join(" "));
const pick = mine[0];
log(`  clicking ${pick.sq} "${pick.txt}"`);
await page.locator(`[data-square="${pick.sq}"]`).click();
await page.waitForTimeout(600);
const b1 = await board();
const d1 = diff(b0, b1);
log(`\n### WHAT VISIBLY CHANGED after that click: ${d1.length} squares`);
for (const r of d1.slice(0, 24)) log(`  ${r.sq} "${r.txt}" ${r.ring}${r.out} bg=${r.bg} child=${r.childBg} cls=${r.cls}`);
await shot(page, "04-after-first-click", OUT);

log("\n### notes/status text right now:");
for (const t of (await visibleText(page)).slice(0, 40)) log("  " + t);
log("\n### console so far:");
for (const c of console_.slice(-15)) log("  " + c);
await browser.close();
