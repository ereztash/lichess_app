/**
 * THE DOOR THAT IS ALREADY THERE, AND WHAT IS BEHIND IT.
 *
 * `l-where-the-record-is.mjs` reported that no element on the reveal links to an in-app route, and
 * concluded the record is unreachable from the reveal. THAT CONCLUSION WAS WRONG AND THE
 * MEASUREMENT WAS RIGHT: the route is not a link. `Home.tsx` renders `.explore-toggle`
 * ("מה עוד יש כאן") which mounts `RecordExplorer` in place, carrying `recordReading.data` -- the
 * whole record dashboard -- without navigating. An anchor probe cannot see a disclosure, and
 * `a[href^="/"]` was the wrong proxy for reachability, the same class of error as ranking salience
 * by painted area.
 *
 * SO THE QUESTION IS NOT WHETHER THE RECORD IS REACHABLE. It is: where is that control, what does
 * its label promise, and does what opens behind it acknowledge the decision just taken.
 */
import { serveBuild, launch } from "./ux-lib.mjs";

const { origin, close } = await serveBuild();
const browser = await launch();
const log = (...a) => console.log(...a);

const run = async (width, height, label) => {
const ctx = await browser.newContext({ viewport: { width, height }, locale: "he-IL" });
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
for (let i = 1; i <= 3; i += 1) {
  await decide();
  if (i < 3) {
    await page.getByRole("button", { name: "לעמדה הבאה" }).click();
    await page.waitForFunction(() => /DECIDE/.test(document.body.innerText), null, { timeout: 30000 });
    await page.waitForTimeout(1000);
  }
}
log(`\n=== ${label} — three decisions taken, the reveal is up`);

const where = await page.evaluate(() => {
  const b = document.querySelector(".explore-toggle");
  if (!b) return null;
  const r = b.getBoundingClientRect();
  const panel = document.querySelector(".reveal-panel")?.getBoundingClientRect();
  return { label: b.innerText.replace(/\s+/g, " ").trim(),
    y: Math.round(r.top + scrollY), fromTopOfViewport: Math.round(r.top),
    fold: r.top < innerHeight && r.bottom > 0 ? "in the first fold" : "below the fold",
    page: Math.round(document.documentElement.scrollHeight), viewport: innerHeight,
    afterPanel: panel ? Math.round(r.top - panel.bottom) : null,
    weight: getComputedStyle(b).fontWeight, size: getComputedStyle(b).fontSize };
});
log(`   the door: "${where.label}"`);
log(`   y=${where.y} of a ${where.page}px page, ${where.fromTopOfViewport}px from the top of a ${where.viewport}px viewport -> ${where.fold}`);
log(`   ${where.afterPanel}px below the reveal panel, weight ${where.weight}, size ${where.size}`);

const before = await page.evaluate(() => document.body.innerText.length);
await page.locator(".explore-toggle").click();
await page.waitForTimeout(2600);
const after = await page.evaluate(() => document.body.innerText.length);
log(`   pressing it adds ${after - before} characters to the page`);

const RECORD = /נרשמו \d+|החלטות שלך|החלטות מדודות|חסרות עוד|נמדד|הרשומה|עד עכשיו/;
const rows = await page.evaluate(`(() => {
  const RECORD = ${RECORD.toString()};
  const out = [];
  for (const el of document.querySelectorAll("h1,h2,h3,p,li,button,summary,dt,dd,span")) {
    if (el.querySelector("h1,h2,h3,p,li,button,summary")) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    const t = (el.innerText || "").replace(/\\s+/g, " ").trim();
    if (!t || !RECORD.test(t)) continue;
    out.push({ y: Math.round(r.top + scrollY), t: t.slice(0, 120) });
  }
  return out.sort((a, b) => a.y - b.y);
})()`);
log(`\n   what the record now says on this screen, ${rows.length} elements:`);
for (const r of rows) log(`   y=${String(r.y).padStart(5)}  ${r.t}`);

await page.screenshot({ path: `/tmp/claude-0/-home-user-lichess-app/634dd395-630e-5c56-b477-315c92c04969/scratchpad/neta/m-door-${width}.png`, fullPage: true });
await ctx.close();
};

await run(1440, 900, "desktop 1440x900");
await run(390, 844, "handset 390x844");
await browser.close(); close(); process.exit(0);
