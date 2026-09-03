export const mk = (page) => {
  const sq = (s) => page.locator(`[data-square="${s}"]`);
  const chip = async (rx) => { const h = await page.evaluateHandle((r) => [...document.querySelectorAll("button")]
    .find((b) => b.offsetParent && new RegExp(r).test(b.innerText.replace(/\s+/g," ").trim())), rx);
    const el = h.asElement(); if (!el) throw new Error("no chip " + rx); await el.click(); };
  const conf = async (n) => { const h = await page.evaluateHandle((k) => [...document.querySelectorAll("button")]
    .find((b) => b.offsetParent && b.getBoundingClientRect().width < 90 && new RegExp("^"+k+"\\s").test(b.innerText.trim())), n);
    await h.asElement().click(); };
  const anyLegalMove = async () => {
    const squares = await page.evaluate(() => [...document.querySelectorAll("[data-square]")].map((e)=>e.getAttribute("data-square")));
    for (const s of squares) { await sq(s).click(); await page.waitForTimeout(80);
      const hints = await page.evaluate(() => [...document.querySelectorAll("[data-square]")]
        .filter((e)=>/hint|target|legal|dest|move-option/i.test(e.className.toString())).map((e)=>e.getAttribute("data-square")));
      if (hints.length) { await sq(hints[0]).click(); await page.waitForTimeout(350); return `${s}${hints[0]}`; } }
    throw new Error("no legal move"); };
  const decide = async () => {
    const mv = await anyLegalMove();
    await chip("יתרון מרחב|המרכז|מלך חשוף|פער בפיתוח"); await page.waitForTimeout(220);
    await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(430);
    await chip("^לא "); await page.waitForTimeout(220);
    await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(530);
    await conf(4); await page.waitForTimeout(380);
    const label = await page.evaluate(() => document.querySelector(".commitment-submit,[data-commit],button[type=submit]")?.innerText.replace(/\s+/g," ").trim() ?? "GONE");
    const t0 = Date.now();
    await page.locator(".commitment-submit,[data-commit],button[type=submit]").first().click();
    try {
      await page.waitForFunction(() => /עומק \d+|בחרת את/.test(document.body.innerText), null, { timeout: 45000 });
    } catch {
      const t = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
      return { mv, ms: Date.now() - t0, pressed: label, TIMEOUT: true,
        computing: /המנוע מחשב/.test(t), notYet: /טרם ניתח/.test(t), failed: /המנוע לא סיים/.test(t),
        rev: /REVEAL/.test(t), where: t.slice(t.indexOf("REVEAL") >= 0 ? t.indexOf("REVEAL") - 260 : 0).slice(0, 260) };
    }
    return { mv, ms: Date.now() - t0, pressed: label }; };
  return { sq, chip, conf, anyLegalMove, decide };
};
