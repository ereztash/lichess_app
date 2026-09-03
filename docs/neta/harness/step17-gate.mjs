/** The interstitial that holds the reveal: where is it, how big, is it in the eye's path? */
import { openApp, shot, visibleText } from "./session.mjs";
import { mk } from "./lib.mjs";
const log = (...a) => console.log(...a);
for (let attempt = 1; attempt <= 5; attempt += 1) {
  const { browser, page, ORIGIN, OUT } = await openApp();
  const { sq, chip, conf, anyLegalMove } = mk(page);
  await page.goto(ORIGIN + "/", { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: "עמדה מהסט המשותף" }).click();
  await sq("e4").waitFor({ timeout: 60000 }); await page.waitForTimeout(1400);
  await anyLegalMove();
  await chip("יתרון מרחב|המרכז"); await page.waitForTimeout(220);
  await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(430);
  await chip("^לא "); await page.waitForTimeout(220);
  await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(530);
  await conf(4); await page.waitForTimeout(380);
  await page.locator(".commitment-submit,[data-commit],button[type=submit]").first().click();
  await page.waitForTimeout(2500);
  const gated = await page.evaluate(() => /לפני שהמנוע מדבר/.test(document.body.innerText));
  log(`attempt ${attempt}: gated=${gated}`);
  if (!gated) { await browser.close(); continue; }

  log("\n### the interstitial, measured against the viewport (scrollY=0)");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  for (const e of await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("h1,h2,h3,p,button,textarea,input,label,[role=status]")) {
      if (!el.offsetParent) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1) continue;
      const txt = (el.innerText || el.placeholder || "").replace(/\s+/g, " ").trim().slice(0, 62);
      if (!txt) continue;
      out.push({ tag: el.tagName.toLowerCase(), txt, y: Math.round(r.top), h: Math.round(r.height),
        w: Math.round(r.width), px: getComputedStyle(el).fontSize, inView: r.top >= 0 && r.top < innerHeight });
    }
    return out.sort((a, b) => a.y - b.y);
  })) log(`  y=${String(e.y).padStart(5)} ${e.inView ? "SEEN " : "below"} ${e.px.padStart(6)} ${e.w}x${e.h} ${e.tag}: ${e.txt}`);
  log("\n### page/scroll: " + JSON.stringify(await page.evaluate(() => ({ scrollY, h: document.body.scrollHeight, vh: innerHeight }))));
  await shot(page, "18-gate", OUT);
  await browser.close();
  break;
}
