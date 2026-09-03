import { openApp, perceptualScan, shot, visibleText } from "./session.mjs";

const { browser, page, console_, ORIGIN, OUT } = await openApp();
await page.goto(ORIGIN + "/", { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(1500);

console.log("=== WHAT IS ON SCREEN, in DOM order, above the fold ===");
for (const e of await perceptualScan(page)) {
  console.log(
    `y=${String(e.y).padStart(4)} ${e.px.padStart(6)}/${String(e.weight).padStart(3)} ${e.w}x${e.h} ${e.act ? "[" + e.act + "] " : ""}${e.tag}: ${e.text}`,
  );
}
console.log("\n=== VISIBLE TEXT, in order ===");
for (const t of await visibleText(page)) console.log("  " + t);

console.log("\n=== storage at first paint ===");
console.log(await page.evaluate(() => ({ ls: Object.keys(localStorage), cookies: document.cookie })));
console.log("\n=== console ===");
console.log(console_.slice(0, 10));
await shot(page, "01-landing-1440", OUT);
console.log("\nscreenshot: 01-landing-1440.png");
await browser.close();
