import { serveBuild, launch } from "./ux-lib.mjs";
const { origin, close } = await serveBuild();
const browser = await launch();
const log = (...a) => console.log(...a);
for (const [w,h,name] of [[1440,900,"desktop"],[390,844,"handset"]]) {
  const page = await (await browser.newContext({ viewport:{width:w,height:h}, locale:"he-IL" })).newPage();
  const sq = (s) => page.locator(`[data-square="${s}"]`);
  const chip = async (rx) => { const x = await page.evaluateHandle((r) => [...document.querySelectorAll("button")]
    .find((b) => b.offsetParent && new RegExp(r).test(b.innerText.replace(/\s+/g," ").trim())), rx); await x.asElement().click(); };
  await page.goto(origin + "/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: "עמדה מהסט המשותף" }).click();
  await sq("e4").waitFor({ timeout: 60000 }); await page.waitForTimeout(1400);
  await sq("b5").click(); await page.waitForTimeout(200);
  await sq("b4").click(); await page.waitForTimeout(400);
  await chip("יתרון מרחב|המרכז"); await page.waitForTimeout(250);
  await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(450);
  await chip("^לא "); await page.waitForTimeout(250);
  await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(550);
  const c = await page.evaluateHandle(() => [...document.querySelectorAll("button")]
    .find((b) => b.offsetParent && b.getBoundingClientRect().width < 90 && /^4\s/.test(b.innerText.trim())));
  await c.asElement().click(); await page.waitForTimeout(400);
  await page.locator(".commitment-submit,[data-commit],button[type=submit]").first().click();
  await page.waitForTimeout(700);
  log(`\n${"=".repeat(64)}\nTHE WAIT, ${name} ${w}x${h}, 700 ms after the commit press\n${"=".repeat(64)}`);
  log(JSON.stringify(await page.evaluate(() => {
    const t = document.body.innerText;
    const line = [...document.querySelectorAll("p,div,span,h1,h2,h3")].filter((e)=>e.offsetParent && /מחשב|מנוע/.test(e.innerText||"") && (e.innerText||"").length < 90)
      .map((e)=>{ const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
        return { txt:(e.innerText||"").replace(/\s+/g," ").trim().slice(0,54), y:Math.round(r.top), inView: r.top>=0 && r.top<innerHeight,
                 px:s.fontSize, weight:s.fontWeight, color:s.color }; })[0] ?? null;
    return { hasComputingText: /המנוע מחשב/.test(t), line,
      ariaBusy: document.querySelectorAll("[aria-busy=true]").length,
      liveRegions: [...document.querySelectorAll("[aria-live]")].map((e)=>e.getAttribute("aria-live")),
      spinners: document.querySelectorAll(".spin,.animate-spin,[data-spinner]").length,
      /* Pseudo-elements count: an element-only probe cannot see an ::after, which is where the
         waiting indicator lives. The first version of this line reported 0 against a moving page. */
      anyAnimation: [...document.querySelectorAll("body *")].filter((e)=>
        [null,"::before","::after"].some((q)=>getComputedStyle(e,q).animationName !== "none")).length,
      scrollY: Math.round(scrollY), pageH: document.body.scrollHeight, viewportH: innerHeight,
    };
  }), null, 1));
  await page.screenshot({ path: `/tmp/claude-0/-home-user-lichess-app/634dd395-630e-5c56-b477-315c92c04969/scratchpad/audit-gap-${name}.png` });
  await page.context().close();
}
await browser.close(); close(); process.exit(0);
