import { serveBuild, launch, salience } from "./ux-lib.mjs";
const { origin, close } = await serveBuild();
const browser = await launch();
const log = (...a) => console.log(...a);
const REPEAT = "ההחלטות נשמרות בדפדפן הזה בלבד";

const probe = (page) => page.evaluate((needle) => {
  const lum = (c) => { const m = c.match(/[\d.]+/g) || [0,0,0];
    const [r,g,b] = m.slice(0,3).map((v)=>{const s=Number(v)/255; return s<=0.03928?s/12.92:Math.pow((s+0.055)/1.055,2.4);});
    return 0.2126*r+0.7152*g+0.0722*b; };
  const contrast = (a,b) => { const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p); return Math.round(((x+0.05)/(y+0.05))*10)/10; };
  const bgOf = (el) => { let n=el; while(n){ const c=getComputedStyle(n).backgroundColor;
    if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c; n=n.parentElement; } return "rgb(255,255,255)"; };
  const desc = (el) => { const r=el.getBoundingClientRect(); const s=getComputedStyle(el);
    return { y: Math.round(r.top+scrollY), w: Math.round(r.width), h: Math.round(r.height),
      px: s.fontSize, weight: s.fontWeight, c: contrast(s.color, bgOf(el)),
      area: Math.round(r.width*r.height) }; };
  const out = { repeated: [], headings: [], body: [], icons: [], primary: null };
  for (const el of document.querySelectorAll("p,h1,h2,h3,button")) {
    if (!el.offsetParent || el.getAttribute("data-square")) continue;
    const t = (el.innerText||"").replace(/\s+/g," ").trim();
    const tag = el.tagName.toLowerCase();
    if (t.includes(needle)) out.repeated.push({ ...desc(el), text: t.slice(0,44) });
    if (/^h[123]$/.test(tag)) out.headings.push({ ...desc(el), tag, text: t.slice(0,40) });
    if (tag === "p" && t.length > 40) out.body.push({ ...desc(el), text: t.slice(0,40) });
    if (tag === "button" && !t && el.getAttribute("aria-label")) out.icons.push({ ...desc(el), label: el.getAttribute("aria-label") });
    if (el.classList.contains("primary-control")) out.primary = { ...desc(el), text: t.slice(0,30) };
  }
  return out;
}, REPEAT);

for (const [w,h,name] of [[1440,900,"desktop"],[390,844,"handset"]]) {
  const page = await (await browser.newContext({ viewport:{width:w,height:h}, locale:"he-IL" })).newPage();
  const sq = (s) => page.locator(`[data-square="${s}"]`);
  const chip = async (rx) => { const x = await page.evaluateHandle((r)=>[...document.querySelectorAll("button")]
    .find((b)=>b.offsetParent && new RegExp(r).test(b.innerText.replace(/\s+/g," "))), rx); await x.asElement().click(); };
  log(`\n${"=".repeat(66)}\n${name} ${w}x${h}\n${"=".repeat(66)}`);
  await page.goto(origin + "/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1100);
  let p = await probe(page);
  log(`\n[FRONT DOOR] the designated primary control: ${JSON.stringify(p.primary)}`);
  log(`[FRONT DOOR] repeated privacy paragraph present: ${p.repeated.length}`);

  await page.getByRole("button", { name: "עמדה מהסט המשותף" }).click();
  await sq("e4").waitFor({ timeout: 60000 }); await page.waitForTimeout(1400);
  p = await probe(page);
  log(`\n[DECIDE] repeated privacy paragraph: ${JSON.stringify(p.repeated)}`);
  log(`[DECIDE] icon-only controls: ${p.icons.length}  ${p.icons.map((i)=>`${i.label}(${i.w}x${i.h})`).join(" ")}`);

  await sq("b5").click(); await page.waitForTimeout(200);
  await sq("b4").click(); await page.waitForTimeout(400);
  await chip("יתרון מרחב|המרכז"); await page.waitForTimeout(250);
  await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(450);
  await chip("^לא "); await page.waitForTimeout(250);
  await page.getByRole("button", { name: "הבא", exact: true }).click(); await page.waitForTimeout(550);
  const c = await page.evaluateHandle(()=>[...document.querySelectorAll("button")]
    .find((b)=>b.offsetParent && b.getBoundingClientRect().width<90 && /^4\s/.test(b.innerText.trim())));
  await c.asElement().click(); await page.waitForTimeout(400);
  await page.locator(".commitment-submit").click();
  await page.waitForTimeout(2600);
  if (await page.evaluate(()=>/מה כן היית עושה/.test(document.body.innerText)))
    await page.getByRole("button", { name: "לא היה לי מהלך אחר" }).click();
  await page.waitForFunction(()=>/עומק \d+|בחרת את|ס״פ/.test(document.body.innerText), null, { timeout: 60000 });
  await page.waitForTimeout(1200);
  p = await probe(page);
  log(`\n[REVEAL] repeated privacy paragraph: ${JSON.stringify(p.repeated)}`);
  log(`[REVEAL] headings, size and weight:`);
  for (const x of p.headings) log(`   ${x.tag} ${x.px}/${x.weight} c=${x.c} y=${x.y} :: ${x.text}`);
  log(`[REVEAL] body paragraphs:`);
  for (const x of p.body) log(`   ${x.px}/${x.weight} c=${x.c} area=${x.area} y=${x.y} :: ${x.text}`);
  log(`[REVEAL] top of the salience ranking:`);
  for (const e of (await salience(page)).slice(0,6))
    log(`   ${String(e.score).padStart(4)} ${e.px}/${e.weight} c=${e.contrast} ${e.tag}: ${e.text.slice(0,50)}`);
  await page.context().close();
}
await browser.close(); close(); process.exit(0);
