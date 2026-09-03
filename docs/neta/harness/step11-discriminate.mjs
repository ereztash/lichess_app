/**
 * DISCRIMINATOR. "The engine did not finish" has two candidate causes and only one is the product:
 *   H1  production ships an engine that does not start        -> product
 *   H2  my relay does not carry the worker's own fetches      -> instrument
 * They separate on ONE observable: whether the wasm request is made and by whom it is answered.
 */
import { openApp } from "./session.mjs";
const { browser, context, page, ORIGIN, OUT } = await openApp();
const log = (...a) => console.log(...a);
const sq = (s) => page.locator(`[data-square="${s}"]`);

const asked = [];
page.on("request", (r) => { if (/stockfish|\.wasm/.test(r.url())) asked.push(`REQ  ${r.url().slice(-46)} from=${r.frame() ? "page" : "?"}`); });
page.on("requestfailed", (r) => asked.push(`FAIL ${r.url().slice(-46)} :: ${r.failure()?.errorText}`));
page.on("response", (r) => { if (/stockfish|\.wasm/.test(r.url())) asked.push(`RESP ${r.status()} ${r.url().slice(-46)}`); });
page.on("worker", (w) => { asked.push(`WORKER CREATED ${w.url().slice(-46)}`);
  w.on("close", () => asked.push("WORKER CLOSED")); });
context.on("weberror", (e) => asked.push("WEBERROR " + e.error().message.slice(0, 90)));

await page.goto(ORIGIN + "/", { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(1000);

log("### the self-check the reveal told me about, in the header:");
for (const e of await page.evaluate(() => [...document.querySelectorAll("header button,button")].filter((b)=>b.offsetParent&&b.getBoundingClientRect().top<120)
  .map((b)=>({t:(b.innerText||b.getAttribute("aria-label")||b.title||"").replace(/\s+/g," ").trim().slice(0,44),y:Math.round(b.getBoundingClientRect().top),x:Math.round(b.getBoundingClientRect().left)})))) log(`  x=${e.x} y=${e.y} :: ${e.t}`);

/* Run the engine exactly as the product does, in the page, and watch what the network does. */
log("\n### asking the page to start a worker the way the product does:");
const verdict = await page.evaluate(async () => {
  const seen = new Set(); const q = [...document.querySelectorAll("script[src]")].map((s)=>s.src);
  let wasm = null; const cand = [];
  while (q.length && seen.size < 60) { const u = q.shift(); if (seen.has(u)) continue; seen.add(u);
    let t; try { t = await (await fetch(u)).text(); } catch { continue; }
    for (const m of t.matchAll(/["'`](\.?\/?assets\/[A-Za-z0-9._-]+|\.\/[A-Za-z0-9._-]+\.js)["'`]/g)) {
      const h = new URL(m[1], u).href;
      if (/stockfish[^/]*\.wasm$/.test(h)) wasm ??= h;
      else if (/stockfish[^/]*\.js$/.test(h)) { if (!cand.includes(h)) cand.push(h); q.push(h); }
      else if (h.endsWith(".js")) q.push(h); } }
  let js = null, big = 0;
  for (const h of cand) { try { const n = (await (await fetch(h)).text()).length; if (n > big) { big = n; js = h; } } catch {} }
  if (!js || !wasm) return { verdict: "NO_ASSETS", js, wasm };
  return await new Promise((res) => {
    const lines = []; let w;
    const t = setTimeout(() => res({ verdict: "TIMEOUT", js, wasm, lines }), 25000);
    try { w = new Worker(`${js}#${encodeURIComponent(wasm)}`); }
    catch (e) { clearTimeout(t); return res({ verdict: "WORKER_BLOCKED", js, wasm, err: String(e) }); }
    w.onerror = (e) => { clearTimeout(t); res({ verdict: "WORKER_ERROR", js, wasm, err: e.message || "?" , lines}); };
    w.onmessage = (ev) => { const l = String(ev.data); if (lines.length < 6) lines.push(l.slice(0, 60));
      if (/uciok/.test(l)) { clearTimeout(t); res({ verdict: "UCIOK", js, wasm, lines }); } };
    w.postMessage("uci");
  });
});
log("  " + JSON.stringify(verdict, null, 1));
log("\n### network, engine assets only:");
for (const a of asked) log("  " + a);
await browser.close();
