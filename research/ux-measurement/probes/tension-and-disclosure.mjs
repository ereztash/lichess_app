/**
 * Two questions the surface ledger cannot answer from the source.
 *
 * 1. Is `.context-why` -- the disclosure that names the detector's own variables -- OPEN on
 *    arrival, or does a player have to press for it? A `<details>` with no `open` attribute is
 *    closed in HTML and this repository styles it, so the answer is a paint fact, not a prop.
 * 2. What does `.commitment-tension` actually put on screen, and at what rank, when a draft
 *    states one? The ledger classifies it; a classification of an unrendered string is a guess.
 */
import { chromium } from "@playwright/test";
import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".wasm": "application/wasm",
  ".json": "application/json", ".woff2": "font/woff2", ".png": "image/png", ".svg": "image/svg+xml" };
function serveBuild(dir = "dist/public") {
  const dist = resolve(dir);
  return new Promise((done) => {
    const s = createServer((req, res) => {
      const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
      let p = join(dist, url);
      if (!extname(p) || !existsSync(p)) p = join(dist, "index.html");
      res.writeHead(200, { "content-type": TYPES[extname(p)] ?? "application/octet-stream" });
      createReadStream(p).pipe(res);
    });
    s.listen(0, "127.0.0.1", () => done({ origin: `http://127.0.0.1:${s.address().port}`, close: () => s.close() }));
  });
}

const { origin, close } = await serveBuild();
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "he-IL" })).newPage();
await page.goto(origin + "/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1200);
await page.getByRole("button", { name: "עמדה מהסט המשותף", exact: true }).click();
await page.locator('[data-square="e4"]').waitFor({ timeout: 60000 });
await page.waitForTimeout(1500);

console.log("=== Q1: the disclosure that names the detector's variables ===");
console.log(JSON.stringify(await page.evaluate(() => {
  const d = document.querySelector("details.context-why");
  if (!d) return { present: false };
  const small = d.querySelector("small");
  const r = small ? small.getBoundingClientRect() : null;
  return {
    present: true,
    openAttribute: d.hasAttribute("open"),
    domOpenProperty: d.open,
    smallPaintedHeight: r ? Math.round(r.height) : 0,
    smallVisible: r ? r.height > 0 && getComputedStyle(small).display !== "none" : false,
    detailsDisplay: getComputedStyle(d).display,
    text: (small?.textContent ?? "").trim().slice(0, 200),
  };
}), null, 1));

console.log("\n=== Q1b: the board note on a stranger's first arrival at a shared-set position ===");
console.log(JSON.stringify(await page.evaluate(() => ({
  boardNote: document.querySelector(".board-note")?.textContent?.replace(/\s+/g, " ").trim() ?? null,
  hadPriorRecord: Object.keys(localStorage).length,
})), null, 1));

console.log("\n=== Q2: force a declared tension ===");
await page.locator('[data-square="b5"]').click();
await page.locator('[data-square="b4"]').click();
await page.waitForTimeout(600);
const chip = async (rx) => {
  const h = await page.evaluateHandle((r) => [...document.querySelectorAll(".read-chip")]
    .find((b) => b.offsetParent && new RegExp(r).test(b.innerText)), rx);
  const el = h.asElement();
  if (el) { await el.click(); await page.waitForTimeout(200); return true; }
  return false;
};
await chip("המרכז סגור");
await page.getByRole("button", { name: "הבא", exact: true }).first().click();
await page.waitForTimeout(400);
/* Three unknowns including "לא מכיר את העמדה הזו" -- fires certainty-without-familiarity. */
for (const rx of ["לא מכיר את העמדה", "לא יודע מה התוכנית", "לא יודע איך הוא יענה"]) {
  const ok = await chip(rx);
  console.log(`  chip ${rx}: ${ok ? "tapped" : "NOT FOUND"}`);
}
await page.getByRole("button", { name: "הבא", exact: true }).first().click();
await page.waitForTimeout(400);
const conf = page.locator(".commitment-confidence .confidence-row button");
await conf.last().click();
await page.waitForTimeout(600);

console.log(JSON.stringify(await page.evaluate(() => {
  const t = document.querySelector(".commitment-tension");
  const submit = document.querySelector(".commitment-submit");
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { y: Math.round(r.y), h: Math.round(r.height), px: Math.round(parseFloat(cs.fontSize)), weight: cs.fontWeight }; };
  return {
    tensionPresent: Boolean(t),
    role: t?.getAttribute("role") ?? null,
    ariaLabel: t?.getAttribute("aria-label") ?? null,
    question: t?.querySelector(".commitment-tension-question")?.textContent?.trim() ?? null,
    basis: t?.querySelector(".commitment-tension-basis")?.textContent?.trim() ?? null,
    tensionBox: box(t),
    submitBox: box(submit),
    tensionAboveSubmit: t && submit ? t.getBoundingClientRect().y < submit.getBoundingClientRect().y : null,
    submitEnabled: submit ? !submit.disabled : null,
    submitText: submit?.textContent?.trim() ?? null,
  };
})));
await page.screenshot({ path: "research/ux-measurement/probes/out/tension.png" });
await browser.close(); close(); process.exit(0);
