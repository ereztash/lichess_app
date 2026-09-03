/**
 * NETA EMBODIED SESSION HARNESS
 *
 * Serves the PRODUCTION responses of lichessapp.vercel.app (bytes + headers, including its CSP)
 * into a clean Chromium context, and lets the page make its own outbound calls, relayed through
 * Node so the sandbox's egress proxy is transparent to the browser.
 *
 * Clean profile: a fresh context per run means no localStorage, no cookies, no prior session.
 * No DevTools. No source is read by this script.
 */
import { chromium } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";

const ORIGIN = "https://lichessapp.vercel.app";
const OUT = "/tmp/claude-0/-home-user-lichess-app/634dd395-630e-5c56-b477-315c92c04969/scratchpad/neta";
mkdirSync(OUT, { recursive: true });

const cache = new Map();
async function upstream(url) {
  if (cache.has(url)) return cache.get(url);
  const r = await fetch(url, { redirect: "follow" });
  const body = Buffer.from(await r.arrayBuffer());
  const headers = {};
  for (const [k, v] of r.headers) {
    if (/^(content-encoding|content-length|transfer-encoding|strict-transport-security)$/i.test(k)) continue;
    headers[k] = v;
  }
  const out = { status: r.status, headers, body };
  if (r.status < 400) cache.set(url, out);
  return out;
}

export async function openApp({ width = 1440, height = 900 } = {}) {
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({ viewport: { width, height }, locale: "he-IL" });
  const page = await context.newPage();
  const console_ = [];
  page.on("console", (m) => console_.push(`${m.type()}: ${m.text().slice(0, 200)}`));
  page.on("pageerror", (e) => console_.push(`pageerror: ${e.message}`));

  await page.route("**/*", async (route) => {
    const url = route.request().url();
    try {
      if (url.startsWith(ORIGIN)) {
        const r = await upstream(url);
        return route.fulfill({ status: r.status, headers: r.headers, body: r.body });
      }
      if (/^https:\/\/(lichess\.org|api\.chess\.com)\//.test(url)) {
        const r = await upstream(url);
        return route.fulfill({ status: r.status, headers: r.headers, body: r.body });
      }
      return route.abort();
    } catch {
      return route.abort();
    }
  });

  return { browser, context, page, console_, ORIGIN, OUT };
}

/** What the eye can rank: visible text blocks in DOM order with their computed weight. */
export const perceptualScan = (page) =>
  page.evaluate(() => {
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.opacity !== "0";
    };
    const out = [];
    for (const el of document.querySelectorAll("h1,h2,h3,button,a,[data-primary-action],[role=status],input,label,section")) {
      if (!vis(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.top > window.innerHeight || r.bottom < 0) continue;
      const s = getComputedStyle(el);
      const text = (el.innerText || el.getAttribute("placeholder") || "").trim().replace(/\s+/g, " ").slice(0, 70);
      if (!text) continue;
      out.push({
        tag: el.tagName.toLowerCase(),
        act: el.getAttribute("data-primary-action") || null,
        text,
        y: Math.round(r.top),
        w: Math.round(r.width),
        h: Math.round(r.height),
        px: s.fontSize,
        weight: s.fontWeight,
        bg: s.backgroundColor,
        color: s.color,
      });
    }
    return out.sort((a, b) => a.y - b.y);
  });

export const shot = async (page, name, OUT) => {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  return `${OUT}/${name}.png`;
};

export const visibleText = (page) =>
  page.evaluate(() => document.body.innerText.split("\n").map((s) => s.trim()).filter(Boolean));
