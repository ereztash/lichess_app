import { chromium } from "playwright";
const OUT = "/tmp/claude-0/-home-user/e1279e6e-3736-5a0e-b63a-d875e78ec2f8/scratchpad";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: "he-IL" });
const p = await ctx.newPage();
p.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));
p.on("console", (m) => { if (m.type() === "error") console.log("[console]", m.text().slice(0, 300)); });

async function decide() {
  for (const sq of await p.locator(".board-square").all()) {
    if ((await sq.locator(".piece").count()) === 0) continue;
    await sq.click(); await p.waitForTimeout(80);
    const t = await p.locator(".legal-square").all();
    if (t.length) { await t[0].click(); await p.waitForTimeout(300); return true; }
  }
  return false;
}
async function answerSteps() {
  for (const id of ["known", "unknown", "confidence"]) {
    const head = p.locator(`[aria-controls="step-body-${id}"]`);
    if (!(await head.count())) continue;
    if ((await head.getAttribute("aria-expanded")) !== "true") { await head.click(); await p.waitForTimeout(120); }
    const body = p.locator(`#step-body-${id}`);
    const chip = body.locator("button.read-chip, button.confidence-option, fieldset button").first();
    if (await chip.count()) { await chip.click(); await p.waitForTimeout(120); }
  }
}

await p.goto("http://127.0.0.1:4321/?angle=selection&src=dm&v=post_3", { waitUntil: "networkidle" });
await p.waitForTimeout(700);
await p.getByRole("button", { name: /עמדה מהסט המשותף/ }).click();
await p.waitForTimeout(1800);
await decide();
await answerSteps();
let label = await p.locator(".commitment-submit").innerText();
if (label.includes("חסר")) { await answerSteps(); label = await p.locator(".commitment-submit").innerText(); }
console.log("submit:", label);
await p.locator(".commitment-submit").click({ force: true });
await p.waitForTimeout(25000);
await p.screenshot({ path: `${OUT}/w2-reveal.png`, fullPage: true });
console.log("\nRIBBON:", (await p.locator(".context-ribbon").innerText()).replace(/\n/g, " | "));
console.log("\nREVEAL:\n" + (await p.locator(".reveal-panel").innerText().catch(() => "(none)")));
const geo = await p.evaluate(() => {
  const h = (s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().height) : null; };
  const f = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).fontSize : null; };
  return { page: Math.round(document.scrollingElement.scrollHeight), panel: h(".reveal-panel"),
    limits: h(".reveal-limits"), one: h(".reveal-one-thing"), col: h(".analysis-column"),
    hero: h(".analysis-hero"), composer: h(".learning-composer"),
    oneFont: f(".one-thing-text"), scoreFont: f(".score-number") };
});
console.log("\nGEOMETRY:", JSON.stringify(geo));
console.log("\nSTAGE TEXT:", (await p.locator(".analysis-stack").innerText()).slice(0, 700));
console.log("\nRECORD STORE:\n" + (await p.evaluate(() => localStorage.getItem("decision-lab.record.v1"))));
console.log("\nLEDGER:\n" + (await p.evaluate(() => localStorage.getItem("decision-lab.progress"))));
await b.close();
