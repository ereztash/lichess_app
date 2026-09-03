import { openApp, shot, visibleText } from "./session.mjs";
const { browser, page, console_, ORIGIN, OUT } = await openApp();
const reqs = [];
page.on("request", (r) => reqs.push(`REQ  ${r.method()} ${r.url().slice(0, 110)}`));
page.on("requestfailed", (r) => reqs.push(`FAIL ${r.url().slice(0, 110)} :: ${r.failure()?.errorText}`));
page.on("response", (r) => reqs.push(`RES  ${r.status()} ${r.url().slice(0, 110)}`));

await page.goto(ORIGIN + "/", { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(1000);
reqs.length = 0;

await page.locator("#first-decision-username").fill("erez281");
await page.getByRole("button", { name: "קחו אותי לעמדה" }).click();
await page.waitForTimeout(9000);

console.log("### NETWORK after the press");
for (const r of reqs) console.log("  " + r);
console.log("\n### WHAT THE SCREEN SAYS NOW");
for (const t of await visibleText(page)) console.log("  " + t);
console.log("\n### is any alert/notice/error element present?");
console.log(await page.evaluate(() => ({
  alerts: [...document.querySelectorAll("[role=alert],[role=status],.first-decision-error,.notice")].map((e) => e.className + " :: " + e.innerText.trim().slice(0, 120)),
  buttonText: document.querySelector('[data-primary-action="play-first-decision"]')?.innerText,
  buttonDisabled: document.querySelector('[data-primary-action="play-first-decision"]')?.disabled,
})));
console.log("\n### console");
for (const c of console_) console.log("  " + c);
await shot(page, "02b-after-press", OUT);
await browser.close();
