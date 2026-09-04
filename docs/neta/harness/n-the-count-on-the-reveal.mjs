/**
 * DOES THE REVEAL KNOW HOW MANY DECISIONS IT IS THE Nth OF?
 *
 * Two runs of `m-the-door.mjs` over the identical three-decision walk printed different numbers in
 * the same sentence: "נרשמו 4 החלטות" and then "נרשמו 3 החלטות". Neither run touched the code that
 * produces it. `Home.tsx` builds `decisionsOnRecord: (decisionCount.data?.decisions ?? 0) + 1` --
 * the stored count PLUS THIS ONE -- and `decisionCount.refetch()` runs on the commit path, so
 * whether the decision being revealed has already reached the count when the reveal is assembled
 * decides whether it is added once or twice.
 *
 * THE RULE IS EXACT, WHICH IS WHY THIS IS MEASURABLE AND NOT AN IMPRESSION. At the kth reveal of a
 * session started from a clean profile, the kth decision is on the record and the sentence must say
 * k. `inferenceLimits` phrases 1 differently, so reveal 1 is checked against its own sentence.
 *
 * TWO RUNS ARE NOT A MEASUREMENT. This takes five decisions in one walk and reads the sentence at
 * every one of them, so a disagreement is located at a reveal index rather than inferred from two
 * transcripts.
 */
import { serveBuild, launch } from "./ux-lib.mjs";

const { origin, close } = await serveBuild();
const browser = await launch();
const log = (...a) => console.log(...a);
const N = Number(process.env.N ?? 5);

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
  await anyMove();
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
};

/* The sentence, read off the limits block only, so nothing else on the page can supply a digit. */
const claimed = () => page.evaluate(`(() => {
  const block = document.querySelector(".reveal-limits");
  if (!block) return { said: null, n: null };
  for (const li of block.querySelectorAll("li")) {
    const t = (li.innerText || "").replace(/\\s+/g, " ").trim();
    if (/החלטה אחת שנרשמה/.test(t)) return { said: t, n: 1 };
    const m = t.match(/נרשמו (\\d+) החלטות/);
    if (m) return { said: t, n: Number(m[1]) };
  }
  return { said: null, n: null };
})()`);

await page.goto(origin + "/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(900);
await page.getByRole("button", { name: "עמדה מהסט המשותף" }).click();
await sq("e4").waitFor({ timeout: 60000 }); await page.waitForTimeout(1400);

log(`### the kth reveal must say k\n`);
log(`   ${"reveal".padStart(6)} ${"says".padStart(5)}  verdict`);
const wrong = [];
for (let k = 1; k <= N; k += 1) {
  await decide();
  /* Settled, not sampled at the first paint: a refetch that lands late must have landed. */
  await page.waitForTimeout(1500);
  const { said, n } = await claimed();
  const ok = n === k;
  if (!ok) wrong.push({ k, n, said });
  log(`   ${String(k).padStart(6)} ${String(n).padStart(5)}  ${ok ? "ok" : `OFF BY ${n - k}`}   ${said ?? "(no sentence)"}`);
  if (k < N) {
    await page.getByRole("button", { name: "לעמדה הבאה" }).click();
    await page.waitForFunction(() => /DECIDE/.test(document.body.innerText), null, { timeout: 30000 });
    await page.waitForTimeout(1000);
  }
}
log(`\n### ${wrong.length} of ${N} reveals stated a count that is not the number of decisions taken`);
await ctx.close(); await browser.close(); close(); process.exit(0);
