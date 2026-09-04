/**
 * IF THE REVEAL DOES NOT SPEND THE RECORD, DOES ANYTHING NEAR IT?
 *
 * `k-record-spend.mjs` found one record-scoped element in fourteen on the reveal, and it is a
 * caveat. That is only a finding if the accumulation is not simply sitting one click away: a
 * product that keeps the local report local and puts the cumulative picture on a record screen
 * beside it has made a layout choice, not a mistake. This is the discrimination.
 *
 * MEASURED, NOT ASSUMED: every visible control on the page while the reveal is up, and then the
 * record surface itself -- what it says, and how many navigations from the reveal it takes to
 * reach. A route that exists but is not offered from this screen is still a route; it is counted
 * separately from one that is.
 */
import { serveBuild, launch } from "./ux-lib.mjs";

const { origin, close } = await serveBuild();
const browser = await launch();
const log = (...a) => console.log(...a);

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
for (let i = 1; i <= 3; i += 1) {
  log(`### decision ${i} -> ${await decide()}`);
  if (i < 3) {
    await page.getByRole("button", { name: "לעמדה הבאה" }).click();
    await page.waitForFunction(() => /DECIDE/.test(document.body.innerText), null, { timeout: 30000 });
    await page.waitForTimeout(1000);
  }
}

log(`\n### every visible control while the reveal is up, board squares and the move rail excluded`);
for (const c of await page.evaluate(() => [...document.querySelectorAll("button,a[href],summary,[role=button]")]
  .filter((el) => el.offsetParent && el.getBoundingClientRect().width > 4)
  .filter((el) => !el.hasAttribute("data-square") && !el.closest("[data-move-rail],.move-rail,.move-timeline"))
  .map((el) => ({ t: (el.innerText || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 60),
    href: el.getAttribute("href") || "", y: Math.round(el.getBoundingClientRect().top + scrollY) }))
  .filter((c) => c.t && !/^[a-h][1-8](, ריקה)?$/.test(c.t) && !/^[\u2654-\u265F]/.test(c.t) && !/^\d*\.?[NBRQK]?[a-h]?x?[a-h][1-8]/.test(c.t))))
  log(`   y=${String(c.y).padStart(5)} ${c.href ? "->" + c.href + " " : ""}${c.t}`);

log(`\n### anchors to any in-app route, from the reveal screen`);
const anchors = await page.evaluate(() => [...document.querySelectorAll("a[href^='/']")].map((a) => a.getAttribute("href")));
log(anchors.length ? anchors.map((r) => "   " + r).join("\n") : "   NONE. no element on this screen links to an in-app route.");

/* The record surface itself, reached by URL rather than by a control, which is itself the answer. */
for (const path of ["/"]) {
  await page.goto(origin + path, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1800);
  const lines = await page.evaluate(() => document.body.innerText.split("\n").map((s) => s.trim()).filter(Boolean));
  log(`\n### ${path} -> ${lines.length} lines`);
  for (const l of lines.slice(0, 22)) log("   " + l);
}

await ctx.close(); await browser.close(); close(); process.exit(0);
