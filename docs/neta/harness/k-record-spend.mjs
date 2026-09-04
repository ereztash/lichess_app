/**
 * WHAT SHARE OF A REVEAL IS ABOUT THE RECORD, AND WHERE THAT SHARE SITS.
 *
 * The owner's raw signal was "the payoff per decision is too local" and "I want each decision to
 * build a cumulative picture". Pass 3 specified an accumulation surface on the strength of that
 * sentence alone. This measures the thing the sentence is about before anything is built: on a
 * reveal taken with several decisions already on record, every painted text element is assigned to
 * the block it sits in, and separately marked for whether it says anything about the record rather
 * than about this position.
 *
 * THE CLASSIFIER IS DOM ANCESTRY, NOT A REGEX OVER PROSE. `reveal-limits`, `reveal-one-thing`,
 * `reveal-question`, `reveal-detail`, `reveal-continuation` are the panel's own section classes, so
 * an element's block is a structural fact rather than my reading of its words. The record/local
 * mark is a regex and IS my reading, so it is printed with the text it matched on and can be
 * checked line by line.
 *
 * WHAT IT CANNOT SAY. Nothing here establishes what a player notices or wants. It establishes what
 * the screen spends its elements on, which is the half a repository owns.
 */
import { serveBuild, launch } from "./ux-lib.mjs";

const { origin, close } = await serveBuild();
const browser = await launch();
const log = (...a) => console.log(...a);

const DECISIONS = Number(process.env.N ?? 3);

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "he-IL" });
const page = await ctx.newPage();
const sq = (s) => page.locator(`[data-square="${s}"]`);
const chip = async (rx) => {
  const h = await page.evaluateHandle((r) => [...document.querySelectorAll("button")]
    .find((b) => b.offsetParent && new RegExp(r).test(b.innerText.replace(/\s+/g, " ").trim())), rx);
  await h.asElement().click();
};
const conf = async (n) => {
  const h = await page.evaluateHandle((k) => [...document.querySelectorAll("button")]
    .find((b) => b.offsetParent && b.getBoundingClientRect().width < 90 && new RegExp("^" + k + "\\s").test(b.innerText.trim())), n);
  await h.asElement().click();
};
const anyMove = async () => {
  const all = await page.evaluate(() => [...document.querySelectorAll("[data-square]")].map((e) => e.getAttribute("data-square")));
  for (const s of all) {
    await sq(s).click(); await page.waitForTimeout(60);
    const hints = await page.evaluate(() => [...document.querySelectorAll("[data-square]")]
      .filter((e) => /hint|target|legal|dest|move-option/i.test(e.className.toString())).map((e) => e.getAttribute("data-square")));
    if (hints.length) { await sq(hints[0]).click(); await page.waitForTimeout(350); return `${s}${hints[0]}`; }
  }
  throw new Error("no legal move");
};
const decide = async () => {
  const mv = await anyMove();
  await chip("יתרון מרחב|המרכז|מלך חשוף|פער בפיתוח"); await page.waitForTimeout(200);
  await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(420);
  await chip("^לא "); await page.waitForTimeout(200);
  await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(520);
  await conf(4); await page.waitForTimeout(360);
  await page.locator(".commitment-submit,[data-commit],button[type=submit]").first().click();
  await page.waitForTimeout(2600);
  if (await page.evaluate(() => /מה כן היית עושה/.test(document.body.innerText))) {
    await page.getByRole("button", { name: "לא היה לי מהלך אחר" }).click(); await page.waitForTimeout(2200);
  }
  await page.waitForFunction(() => /עומק \d+|בחרת את|ס״פ/.test(document.body.innerText), null, { timeout: 60000 });
  return mv;
};

await page.goto(origin + "/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(900);
await page.getByRole("button", { name: "עמדה מהסט המשותף" }).click();
await sq("e4").waitFor({ timeout: 60000 }); await page.waitForTimeout(1400);

for (let i = 1; i <= DECISIONS; i += 1) {
  log(`### decision ${i} -> ${await decide()}`);
  if (i < DECISIONS) {
    await page.getByRole("button", { name: "לעמדה הבאה" }).click();
    await page.waitForFunction(() => /DECIDE/.test(document.body.innerText), null, { timeout: 30000 });
    await page.waitForTimeout(1000);
  }
}

/*
 * The reveal, element by element. `reveal-panel` is the whole panel; the block is whichever
 * `reveal-*` section class is nearest above the element, which is exactly how the panel is built.
 */
const rows = await page.evaluate(`(() => {
  const panel = document.querySelector(".reveal-panel");
  if (!panel) return null;
  const BLOCK = /^reveal-(limits|one-thing|question|detail|continuation|elsewhere|build-limit)$/;
  const blockOf = (el) => {
    let n = el;
    while (n && n !== document.body) {
      for (const c of n.classList) if (BLOCK.test(c)) return c.replace("reveal-", "");
      n = n.parentElement;
    }
    return "panel";
  };
  /* Says something about the record: a count of decisions, or the word for what is accumulating. */
  const RECORD = /נרשמו \\d+ החלטות|החלטה אחת שנרשמה|החלטות מדודות|עד עכשיו|בהחלטות הקודמות|החלטות שנרשמו/;
  const out = [];
  for (const el of panel.querySelectorAll("h2,h3,p,li,button,span,summary")) {
    if (el.querySelector("h2,h3,p,li,button,summary")) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none") continue;
    const text = (el.innerText || "").replace(/\\s+/g, " ").trim();
    if (!text) continue;
    out.push({ tag: el.tagName.toLowerCase(), block: blockOf(el), record: RECORD.test(text),
      chars: text.length, text: text.slice(0, 110) });
  }
  return out;
})()`);

if (!rows) { log("NO REVEAL PANEL"); await ctx.close(); await browser.close(); close(); process.exit(1); }

log(`\n### the reveal after ${DECISIONS} decisions: ${rows.length} painted elements`);
for (const r of rows) log(`   ${r.record ? "RECORD" : "local "} ${r.block.padEnd(14)} ${String(r.chars).padStart(4)}ch  ${r.text}`);

const by = {};
for (const r of rows) {
  by[r.block] ??= { n: 0, chars: 0, record: 0, recordChars: 0 };
  by[r.block].n += 1; by[r.block].chars += r.chars;
  if (r.record) { by[r.block].record += 1; by[r.block].recordChars += r.chars; }
}
log(`\n### by block`);
log(`   ${"block".padEnd(14)} ${"els".padStart(4)} ${"chars".padStart(6)}  ${"record els".padStart(10)} ${"record chars".padStart(12)}`);
for (const [b, v] of Object.entries(by))
  log(`   ${b.padEnd(14)} ${String(v.n).padStart(4)} ${String(v.chars).padStart(6)}  ${String(v.record).padStart(10)} ${String(v.recordChars).padStart(12)}`);

const tot = rows.length, rec = rows.filter((r) => r.record).length;
const totC = rows.reduce((a, r) => a + r.chars, 0), recC = rows.filter((r) => r.record).reduce((a, r) => a + r.chars, 0);
log(`\n### the whole panel`);
log(`   elements about the record: ${rec} of ${tot}`);
log(`   characters about the record: ${recC} of ${totC}`);
log(`   and every one of them sits in: ${[...new Set(rows.filter((r) => r.record).map((r) => r.block))].join(", ") || "(nowhere)"}`);

await page.screenshot({ path: "/tmp/claude-0/-home-user-lichess-app/634dd395-630e-5c56-b477-315c92c04969/scratchpad/neta/k-reveal.png", fullPage: true });
await ctx.close(); await browser.close(); close(); process.exit(0);
