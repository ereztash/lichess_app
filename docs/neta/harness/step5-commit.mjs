/**
 * STEP 5. Two things a stranger does: click an empty square, then actually move a piece.
 * Then answer the four commitment steps and press commit, sampling densely enough to tell
 * "I clicked" from "the system acknowledged" from "the work finished" from "the state changed".
 */
import { openApp, shot, visibleText } from "./session.mjs";
const { browser, page, console_, ORIGIN, OUT } = await openApp();
const log = (...a) => console.log(...a);

const sq = (s) => page.locator(`[data-square="${s}"]`);
const look = () => page.evaluate(() => {
  const out = { selected: [], hinted: [], pieces: {} };
  for (const el of document.querySelectorAll("[data-square]")) {
    const s = el.getAttribute("data-square");
    const cls = el.className.toString();
    if (/selected/.test(cls)) out.selected.push(s);
    if (/hint|target|legal|dest|move-option/i.test(cls)) out.hinted.push(s);
    if (el.querySelector("[data-piece], .piece")) out.pieces[s] = 1;
  }
  const chosen = document.querySelector(".chosen-move, [data-chosen-move]");
  out.chosenMoveText = chosen ? chosen.innerText.replace(/\s+/g, " ").trim().slice(0, 60) : null;
  const btn = document.querySelector(".commitment-submit, [data-commit], button[type=submit]");
  out.commitLabel = btn ? btn.innerText.replace(/\s+/g, " ").trim().slice(0, 60) : null;
  out.commitDisabled = btn ? btn.disabled : null;
  out.step1 = [...document.querySelectorAll("button")].map((b)=>b.innerText.replace(/\s+/g," ").trim()).filter((t)=>/המהלך שבחרתם/.test(t))[0] ?? null;
  return out;
});

await page.goto(ORIGIN + "/", { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(800);
await page.getByRole("button", { name: "עמדה מהסט המשותף" }).click();
await sq("e4").waitFor({ timeout: 60000 });
await page.waitForTimeout(1500);

log("### A: click e8 -- an EMPTY square");
await sq("e8").click(); await page.waitForTimeout(500);
log("  " + JSON.stringify(await look()));

log("\n### B: click b5 -- a black pawn (black is to move, black is at the bottom)");
await sq("b5").click(); await page.waitForTimeout(500);
const afterPiece = await look();
log("  " + JSON.stringify(afterPiece));
log(`  >> destinations shown to me: ${afterPiece.hinted.length}`);
await shot(page, "05-piece-selected", OUT);

log("\n### C: click b4 -- where I want the pawn to go");
await sq("b4").click(); await page.waitForTimeout(800);
log("  " + JSON.stringify(await look()));
await shot(page, "05b-move-placed", OUT);

log("\n### the four steps as they read NOW:");
for (const t of (await visibleText(page))) if (/^[1-4]$|המהלך שבחרתם|קוראים|להעריך|בטוחים|חסר|חסרים/.test(t)) log("  " + t);
await browser.close();
