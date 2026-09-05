/**
 * THE PERCEPTUAL CRITERION FOR THE OWNER-LICENSED INTERVENTION, MEASURED.
 *
 * Stated before implementation and checked here against the built tree, on the same walk that
 * produced the pass-3 baseline:
 *
 *   1. the largest painted heading on the front door and on the deciding screen computes 600, and
 *      exactly one element per screen changed weight
 *   2. the reveal carries at least two record-scoped elements, the new one outside `.reveal-limits`,
 *      and `CONTINUATION_PROPOSITION`'s text is absent from the DOM
 *   3. the reveal's block count is five, not six -- replaced, not joined
 *   4. the control that opens the full record has an accessible name containing רשומה
 *
 * BASELINE, from `k-record-spend.mjs` on the tree before this change: 1 record-scoped element of
 * 14, 60 characters of 754, all of it inside `.reveal-limits`.
 */
import { serveBuild, launch } from "./ux-lib.mjs";

const { origin, close } = await serveBuild();
const browser = await launch();
const log = (...a) => console.log(...a);
const N = Number(process.env.N ?? 3);

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "he-IL" });
const page = await ctx.newPage();
const sq = (s) => page.locator(`[data-square="${s}"]`);
const chip = async (rx) => { const h = await page.evaluateHandle((r) => [...document.querySelectorAll("button")]
  .find((b) => b.offsetParent && new RegExp(r).test(b.innerText.replace(/\s+/g," ").trim())), rx); await h.asElement().click(); };
const conf = async (n) => { const h = await page.evaluateHandle((k) => [...document.querySelectorAll("button")]
  .find((b) => b.offsetParent && b.getBoundingClientRect().width < 90 && new RegExp("^"+k+"\\s").test(b.innerText.trim())), n); await h.asElement().click(); };
const anyMove = async () => { const all = await page.evaluate(() => [...document.querySelectorAll("[data-square]")].map((e)=>e.getAttribute("data-square")));
  for (const s of all) { await sq(s).click(); await page.waitForTimeout(60);
    const hints = await page.evaluate(() => [...document.querySelectorAll("[data-square]")]
      .filter((e)=>/hint|target|legal|dest|move-option/i.test(e.className.toString())).map((e)=>e.getAttribute("data-square")));
    if (hints.length) { await sq(hints[0]).click(); await page.waitForTimeout(350); return; } } throw new Error("no legal move"); };
const decide = async () => {
  await anyMove();
  await chip("יתרון מרחב|המרכז|מלך חשוף|פער בפיתוח"); await page.waitForTimeout(200);
  await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(420);
  await chip("^לא "); await page.waitForTimeout(200);
  await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(520);
  await conf(4); await page.waitForTimeout(360);
  await page.locator(".commitment-submit,[data-commit],button[type=submit]").first().click();
  await page.waitForTimeout(2600);
  if (await page.evaluate(() => /מה כן היית עושה/.test(document.body.innerText)))
    { await page.getByRole("button", { name: "לא היה לי מהלך אחר" }).click(); await page.waitForTimeout(2200); }
  await page.waitForFunction(() => /עומק \d+|בחרת את|ס״פ/.test(document.body.innerText), null, { timeout: 60000 });
};

/** Every painted heading, largest first, with the weight the browser computed. */
const heads = () => page.evaluate(`(() => [...document.querySelectorAll("h1,h2,h3")]
  .filter((e) => e.offsetParent)
  .map((e) => { const s = getComputedStyle(e), r = e.getBoundingClientRect();
    return { tag: e.tagName, w: Number(s.fontWeight), px: parseFloat(s.fontSize),
      t: (e.innerText||"").replace(/\\s+/g," ").trim().slice(0,46) }; })
  .sort((a,b) => b.px - a.px))()`);
/** Every painted element at each weight, so "exactly one changed" is checkable. */
const weights = () => page.evaluate(`(() => { const m = {};
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
    const s = getComputedStyle(el); if (s.visibility === "hidden" || s.display === "none") continue;
    if (!(el.innerText || "").trim()) continue;
    m[s.fontWeight] = (m[s.fontWeight] ?? 0) + 1; }
  return m; })()`);

const screen = async (label) => {
  const h = await heads(), w = await weights();
  log(`\n### ${label}`);
  log(`   weights: ${Object.entries(w).sort().map(([k,v]) => `${k}:${v}`).join("  ")}`);
  for (const x of h.slice(0, 4)) log(`   ${x.tag} w=${x.w} ${String(x.px).padStart(4)}px  ${x.t}`);
  const top = h[0];
  log(`   -> largest heading "${top?.t}" computes weight ${top?.w}  ${top?.w === 600 ? "OK" : "NOT 600"}`);
};

await page.goto(origin + "/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1900);
await screen("1. FRONT DOOR");
await page.getByRole("button", { name: "עמדה מהסט המשותף" }).click();
await sq("e4").waitFor({ timeout: 60000 }); await page.waitForTimeout(1500);
await screen("2. DECIDE");

for (let i = 1; i <= N; i += 1) {
  await decide();
  if (i < N) { await page.getByRole("button", { name: "לעמדה הבאה" }).click();
    await page.waitForFunction(() => /DECIDE/.test(document.body.innerText), null, { timeout: 30000 });
    await page.waitForTimeout(1000); }
}
await page.waitForTimeout(1500);

const r = await page.evaluate(`(() => {
  const panel = document.querySelector(".reveal-panel");
  const BLOCK = /^reveal-(limits|one-thing|question|secondary|accumulation|continuation)$/;
  const blocks = [...panel.querySelectorAll(".reveal-block, details.reveal-secondary")]
    .map((el) => [...el.classList].find((c) => BLOCK.test(c)));
  const RECORD = /נרשמו \\d+ החלטות|החלטה אחת שנרשמה|הופיע ב-\\d+ מתוך \\d+/;
  const rows = [];
  for (const el of panel.querySelectorAll("h2,p,li,button,summary,span")) {
    if (el.querySelector("h2,p,li,button,summary")) continue;
    const t = (el.innerText || "").replace(/\\s+/g," ").trim(); if (!t) continue;
    const r2 = el.getBoundingClientRect(); if (r2.width < 4 || r2.height < 4) continue;
    let n = el, block = "panel";
    while (n && n !== document.body) { for (const c of n.classList) if (BLOCK.test(c)) { block = c; n = null; break; } if (n) n = n.parentElement; }
    rows.push({ block, record: RECORD.test(t), chars: t.length, t: t.slice(0,104) });
  }
  const door = [...document.querySelectorAll("button,[role=button]")]
    .filter((b) => b.offsetParent).map((b) => (b.innerText||b.getAttribute("aria-label")||"").replace(/\\s+/g," ").trim())
    .filter((t) => /רשומה/.test(t));
  return { blocks, rows, door,
    proposition: /החלטה אחת אומרת מה קרה בה, ולא יותר/.test(document.body.innerText) };
})()`);

log(`\n### 3. REVEAL after ${N} decisions`);
log(`   blocks (${r.blocks.length}): ${r.blocks.join(" -> ")}`);
for (const x of r.rows) log(`   ${x.record ? "RECORD" : "local "} ${x.block.padEnd(20)} ${String(x.chars).padStart(4)}ch  ${x.t}`);
const rec = r.rows.filter((x) => x.record);
log(`\n### against the criterion`);
log(`   record-scoped elements: ${rec.length} of ${r.rows.length}   (baseline 1 of 14)`);
log(`   blocks they sit in: ${[...new Set(rec.map((x) => x.block))].join(", ")}   (baseline: reveal-limits only)`);
log(`   block count 5, not 6: ${r.blocks.length === 5 ? "OK" : "FAIL (" + r.blocks.length + ")"}`);
log(`   accumulation is last: ${r.blocks[r.blocks.length-1] === "reveal-accumulation" ? "OK" : "FAIL"}`);
log(`   replaced proposition absent from the DOM: ${r.proposition ? "FAIL" : "OK"}`);
log(`   control naming the record: ${r.door.length ? "OK -> " + r.door.join(" | ") : "FAIL, none"}`);

await page.screenshot({ path: "/tmp/claude-0/-home-user-lichess-app/634dd395-630e-5c56-b477-315c92c04969/scratchpad/neta/p-after.png", fullPage: true });
await ctx.close(); await browser.close(); close(); process.exit(0);
