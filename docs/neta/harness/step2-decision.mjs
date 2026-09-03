import { openApp, perceptualScan, shot, visibleText } from "./session.mjs";

const { browser, page, console_, ORIGIN, OUT } = await openApp();
const log = (...a) => console.log(...a);

await page.goto(ORIGIN + "/", { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(1200);

log("### ACT: type the username, press the primary control");
const t0 = Date.now();
await page.locator("#first-decision-username").fill("erez281");
await page.getByRole("button", { name: "קחו אותי לעמדה" }).click();

// What happens between the press and the next state, sampled.
const frames = [];
for (let i = 0; i < 14; i += 1) {
  await page.waitForTimeout(250);
  frames.push({
    ms: Date.now() - t0,
    url: new URL(page.url()).pathname,
    squares: await page.locator("[data-square]").count(),
    text: (await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 90))),
  });
}
log("### WHAT HAPPENED, 250 ms apart, from the press:");
for (const f of frames) log(`  +${String(f.ms).padStart(5)}ms ${f.url.padEnd(6)} squares=${String(f.squares).padStart(2)}  ${f.text}`);

await page.locator("[data-square]").first().waitFor({ timeout: 60000 });
await page.waitForTimeout(1200);
log("\n### ON THE BOARD SCREEN, above the fold, in DOM order:");
for (const e of await perceptualScan(page)) {
  log(`y=${String(e.y).padStart(4)} ${e.px.padStart(6)}/${String(e.weight).padStart(3)} ${e.w}x${e.h} ${e.act ? "[" + e.act + "] " : ""}${e.tag}: ${e.text}`);
}
log("\n### VISIBLE TEXT:");
for (const t of await visibleText(page)) log("  " + t);
log("\n### board geometry");
log(await page.evaluate(() => {
  const b = document.querySelector(".board-stage") || document.querySelector("[data-square]")?.closest("div");
  const r = b?.getBoundingClientRect();
  const sq = document.querySelector("[data-square]")?.getBoundingClientRect();
  return { board: r && { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) },
           square: sq && { w: Math.round(sq.width), h: Math.round(sq.height) },
           viewport: { w: innerWidth, h: innerHeight },
           pageHeight: document.body.scrollHeight };
}));
await shot(page, "02-board", OUT);
log("\nconsole:", console_.slice(0, 6));
await browser.close();
