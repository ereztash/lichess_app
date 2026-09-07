/**
 * EVERY SURFACE ON SCREEN WHILE THE EVIDENCE IS STILL MUTABLE.
 *
 * Walks the built app from arrival to reveal and dumps, at each state, every element that paints
 * text or accepts a press -- with its class, its role, its geometry, and the text a person reads.
 * It measures the artefact rather than the source, because the ledger's question is what a player
 * meets, and a component's props do not answer it.
 *
 * THE PROBE ARM IS PINNED, not drawn. `assignProbe` takes its `draw` as an argument and
 * `decision-session.ts` defaults it to `Math.random`, so an unpinned walk silently selects one of
 * two code paths -- the harness README records two passes lost to exactly that. Pass `probed` or
 * `unprobed` as argv[2].
 *
 * Run: node research/ux-measurement/probes/pre-evidence-surfaces.mjs [probed|unprobed]
 */
import { chromium } from "@playwright/test";
import { createReadStream, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";

const ARM = process.argv[2] === "unprobed" ? "unprobed" : "probed";
const OUT = resolve("research/ux-measurement/probes/out");
mkdirSync(OUT, { recursive: true });

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

/** Every element that paints its own text or takes a press. Own text only, so ancestors do not echo. */
const INVENTORY = `(() => {
  const out = [];
  const seen = new Set();
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;
    /*
     * checkVisibility, NOT the rect and the computed style, and a refuted finding is why.
     * A closed <details> gives its children content-visibility: hidden -- they keep the geometry
     * of their last layout and report display:block and visibility:visible, so the first version
     * of this probe reported the ribbon's disclosure body as painted during DECIDE and it is not.
     * checkVisibility() agrees with innerText, which is what a person reads.
     */
    if (el.checkVisibility && !el.checkVisibility({ contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true })) continue;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(" ").replace(/\\s+/g, " ").trim();
    const pressable = /^(BUTTON|A|INPUT|SUMMARY|TEXTAREA|SELECT)$/.test(el.tagName) || el.getAttribute("role") === "button";
    if (!own && !pressable) continue;
    const text = own || (el.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 120);
    const key = el.tagName + "|" + (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) + "|" + text;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      tag: el.tagName.toLowerCase(),
      cls: typeof el.className === "string" ? el.className : "",
      role: el.getAttribute("role") || (pressable ? "control" : ""),
      label: el.getAttribute("aria-label") || "",
      y: Math.round(r.y), x: Math.round(r.x), w: Math.round(r.width), h: Math.round(r.height),
      px: Math.round(parseFloat(cs.fontSize)), weight: cs.fontWeight,
      pressable,
      text: text.slice(0, 200),
    });
  }
  return out.sort((a, b) => a.y - b.y || a.x - b.x);
})()`;

const states = {};
const snap = async (page, name) => {
  const els = await page.evaluate(INVENTORY);
  states[name] = els;
  console.log(`\n${"=".repeat(78)}\nSTATE: ${name}   (${els.length} painted/pressable elements)\n${"=".repeat(78)}`);
  for (const e of els) {
    const mark = e.pressable ? "[press]" : "       ";
    console.log(`${mark} y=${String(e.y).padStart(5)} ${String(e.px).padStart(3)}px/${e.weight} .${e.cls.slice(0, 38).padEnd(38)} ${e.text}`);
  }
};

const { origin, close } = await serveBuild();
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "he-IL" });
/* Pin the counterfactual draw before any page script runs, so the arm is chosen and not drawn. */
await context.addInitScript(`Math.random = () => ${ARM === "probed" ? "0.01" : "0.99"};`);
const page = await context.newPage();
page.on("console", (m) => { if (m.type() === "error") console.log("  [page error] " + m.text().slice(0, 160)); });

await page.goto(origin + "/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1200);
await snap(page, "01-ARRIVE-front-door");

/* Whatever the front door offers a stranger with no account. */
await page.getByRole("button", { name: "עמדה מהסט המשותף", exact: true }).click();
await page.locator('[data-square="e4"]').waitFor({ timeout: 60000 });
await page.waitForTimeout(1500);
await snap(page, "02-DECIDE-before-any-move");

/* Place a move the way a person does: select, then land. */
await page.locator('[data-square="b5"]').click();
await page.waitForTimeout(400);
await snap(page, "03-DECIDE-piece-selected");
await page.locator('[data-square="b4"]').click();
await page.waitForTimeout(700);
await snap(page, "04-DECIDE-move-placed");

/* Whatever steps this decision actually asks for. Reported, not assumed. */
const steps = await page.evaluate(() =>
  [...document.querySelectorAll(".commitment-step")].map((s) => ({
    legend: s.querySelector(".step-legend")?.textContent?.trim() ?? "",
    required: Boolean(s.querySelector(".required-mark")),
    state: s.getAttribute("data-state"),
  })));
console.log("\nSTEPS THIS DECISION ASKS FOR: " + JSON.stringify(steps, null, 1));
states["__steps"] = steps;

const chip = async (rx) => {
  const h = await page.evaluateHandle((r) => [...document.querySelectorAll(".read-chip")]
    .find((b) => b.offsetParent && new RegExp(r).test(b.innerText)), rx);
  const el = h.asElement();
  if (el) { await el.click(); await page.waitForTimeout(250); return true; }
  return false;
};
if (steps.some((s) => s.legend.includes("קוראים"))) {
  await chip("המרכז|מרחב");
  await page.getByRole("button", { name: "הבא", exact: true }).first().click();
  await page.waitForTimeout(400);
  await chip("לא ");
  await page.getByRole("button", { name: "הבא", exact: true }).first().click();
  await page.waitForTimeout(400);
  await snap(page, "05-DECIDE-reads-stated");
}
/* Top-of-scale confidence, to make the declaredTensions surface reachable if it is going to be. */
const conf = page.locator(".commitment-confidence .confidence-row button");
if (await conf.count()) {
  await conf.last().click();
  await page.waitForTimeout(500);
  await snap(page, "06-DECIDE-confidence-stated-top-of-scale");
}

await page.locator(".commitment-submit").click();
await page.waitForTimeout(2600);
await snap(page, "07-AFTER-COMMIT");

if (await page.evaluate(() => /מה כן היית עושה/.test(document.body.innerText))) {
  console.log("\n>>> COUNTERFACTUAL PROBE FIRED (arm=" + ARM + ")");
  await snap(page, "08-COMMITTED-counterfactual-open");
  await page.getByRole("button", { name: "לא היה לי מהלך אחר" }).click();
  await page.waitForTimeout(500);
} else {
  console.log("\n>>> NO COUNTERFACTUAL (arm=" + ARM + ")");
}
await page.waitForFunction(() => /ס״פ|עומק \d+|אין כאן דבר/.test(document.body.innerText), null, { timeout: 90000 }).catch(() => {});
await page.waitForTimeout(1500);
await page.evaluate(() => window.scrollTo(0, 0));
await snap(page, "09-REVEAL");

writeFileSync(join(OUT, `surfaces-${ARM}.json`), JSON.stringify(states, null, 1));
console.log("\nwrote " + join(OUT, `surfaces-${ARM}.json`));
await browser.close();
close();
process.exit(0);
