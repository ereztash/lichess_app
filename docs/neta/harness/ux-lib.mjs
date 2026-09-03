/**
 * MEASUREMENT INSTRUMENT FOR THE PRE-HUMAN UX AUDIT.
 *
 * Every number here is a repo/DOM fact at R3: geometry, computed style, and browser timing on the
 * real application path. None of it establishes what a person notices. It establishes what the
 * screen is doing, which is the only half a repository can own.
 */
import { chromium } from "@playwright/test";
import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";

const TYPES = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".wasm":"application/wasm",
  ".json":"application/json", ".woff2":"font/woff2", ".png":"image/png", ".svg":"image/svg+xml" };

export async function serveBuild(dir = "dist/public") {
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

export const launch = () => chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"],
});

/** Relative luminance, for contrast ratios. */
const SALIENCE = `
  const lum = (c) => {
    const m = c.match(/[\\d.]+/g) || [0,0,0];
    const [r,g,b] = m.slice(0,3).map((v) => { const s = Number(v)/255;
      return s <= 0.03928 ? s/12.92 : Math.pow((s+0.055)/1.055, 2.4); });
    return 0.2126*r + 0.7152*g + 0.0722*b;
  };
  const contrast = (a, b) => { const [x,y] = [lum(a), lum(b)].sort((p,q)=>q-p); return (x+0.05)/(y+0.05); };
  const bgOf = (el) => { let n = el;
    while (n) { const c = getComputedStyle(n).backgroundColor;
      if (c && !/rgba\\(0, 0, 0, 0\\)|transparent/.test(c)) return c; n = n.parentElement; }
    return "rgb(255,255,255)"; };
`;

/**
 * What the screen offers the eye, ranked by a salience proxy.
 *
 * THE PROXY IS AREA x WEIGHT x CONTRAST, and it is a proxy. It cannot say what anybody looks at.
 * What it can say is which regions are competing: two blocks within a factor of two of each other
 * at the top of this list is a screen with no single answer to "where do I look".
 */
export const salience = (page) => page.evaluate(`(() => {
  ${SALIENCE}
  const out = [];
  for (const el of document.querySelectorAll("h1,h2,h3,p,button,a,[role=status],section,article,li,input,label")) {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    if (r.width < 4 || r.height < 4 || s.visibility === "hidden" || s.opacity === "0") continue;
    if (r.top > innerHeight || r.bottom < 0) continue;
    const text = (el.innerText || el.getAttribute("aria-label") || "").replace(/\\s+/g," ").trim();
    if (!text) continue;
    if (el.querySelector("h1,h2,h3,p,button")) continue;   // leaves only, so a wrapper does not outrank its own content
    const px = parseFloat(s.fontSize) || 16;
    const weight = Number(s.fontWeight) || 400;
    const c = contrast(s.color, bgOf(el));
    out.push({ tag: el.tagName.toLowerCase(), text: text.slice(0, 58),
      y: Math.round(r.top), x: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height),
      px, weight, contrast: Math.round(c*10)/10,
      score: Math.round(Math.sqrt(r.width*r.height) * (weight/400) * Math.min(c, 12) / 10) });
  }
  return out.sort((a,b) => b.score - a.score);
})()`);

/** The visual system, counted. A coherent one uses few values; an accreted one uses many. */
export const systemInventory = (page) => page.evaluate(`(() => {
  ${SALIENCE}
  const fs = new Map(), fw = new Map(), radius = new Map(), borders = new Map(), shadows = new Map();
  const gaps = new Map(), pads = new Map(), surfaces = new Map(), fams = new Map();
  const bump = (m, k) => m.set(k, (m.get(k) ?? 0) + 1);
  let n = 0;
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.opacity === "0" || s.display === "none") continue;
    n += 1;
    if ((el.innerText || "").trim()) { bump(fs, s.fontSize); bump(fw, s.fontWeight); bump(fams, s.fontFamily.split(",")[0].replace(/["']/g,"")); }
    if (s.borderTopWidth !== "0px" || s.borderBottomWidth !== "0px") bump(borders, s.borderTopColor + " " + s.borderTopWidth);
    if (s.borderRadius !== "0px") bump(radius, s.borderRadius);
    if (s.boxShadow !== "none") bump(shadows, s.boxShadow.slice(0, 46));
    if (s.rowGap && s.rowGap !== "normal" && s.rowGap !== "0px") bump(gaps, s.rowGap);
    if (s.paddingTop !== "0px") bump(pads, s.paddingTop);
    const bg = s.backgroundColor;
    if (bg && !/rgba\\(0, 0, 0, 0\\)/.test(bg)) bump(surfaces, bg);
  }
  const top = (m, k = 40) => [...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0, k);
  return { elements: n,
    fontSizes: top(fs), fontWeights: top(fw), families: top(fams),
    radii: top(radius), borders: top(borders, 12), shadows: top(shadows, 8),
    rowGaps: top(gaps, 16), paddings: top(pads, 16), surfaces: top(surfaces, 12) };
})()`);

/** Press something and sample what changes, at 50 ms, so acknowledgement is separable from work. */
export async function press(page, clickFn, ms = 6000, step = 50) {
  const before = await page.evaluate(() => document.body.innerText.length);
  const t0 = Date.now();
  const frames = [];
  const sample = async () => page.evaluate(() => {
    const a = document.activeElement;
    return { len: document.body.innerText.length,
      busy: document.querySelectorAll("[aria-busy=true],.animate-spin,[data-spinner]").length,
      disabled: document.querySelectorAll("button[disabled]").length,
      h: document.body.scrollHeight,
      focus: a ? (a.tagName.toLowerCase() + ":" + (a.innerText || "").replace(/\s+/g," ").trim().slice(0,20)) : null };
  });
  await clickFn();
  let prev = JSON.stringify({ len: before });
  for (let i = 0; i * step < ms; i += 1) {
    const f = await sample();
    const k = JSON.stringify(f);
    if (k !== prev) { frames.push({ ms: Date.now() - t0, ...f }); prev = k; }
    await page.waitForTimeout(step);
  }
  return frames;
}
