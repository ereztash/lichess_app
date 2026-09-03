# Baseline — the tree this study ran against

**Resolved, not taken from the handoff.** `git ls-remote origin main` returned
`c1d72935c0389c8f301edfd4083aabb584764cc7`; the local `origin/main` ref was stale at `0b2f07c`
(PR #34) and was force-updated before anything was read. Every measurement below was taken at that
SHA, before any file in this mission was written.

| fact | value | how it was established |
| --- | --- | --- |
| `main` head | `c1d72935c0389c8f301edfd4083aabb584764cc7` | `git ls-remote origin main` |
| branch base | the same SHA | `git rev-parse HEAD` on `claude/lichess-decision-loop-closure-iptrex` |
| `npm run check` | exit 0 | executed |
| `npm run build` | exit 0 | executed |
| `npm test` | **3002 passed, 35 skipped; 273 files passed, 4 skipped** | executed, 251.8 s |
| `npm run gates` | **33 gates: 33 pass, 0 fail, 0 not-measured** | executed |
| `npm run gates:controls` | **33 gates: 0 pass, 33 fail** — every control red | executed |
| `npm run bundle:budget` | 768.9 kB / 771 kB raw — **2.1 kB of headroom** | executed |
| Chromium | `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` | `tests/layout/browser.ts`'s own first candidate |

The handoff's claim of 33 gates and of every gate carrying a red control **reproduces**. The bundle
figure is recorded because it bounds what this mission may add: 2.1 kB, not a fresh panel.

## What was driven, and how

`dist/public` built with `npm run build` and served by a static host that answers every `/api/*`
with 503 — the shape a signed-out stranger gets — with `https://lichess.org/api/games/user/**`
answered from the same fixture `tests/layout/a-stranger-takes-their-first-decision.layout.test.ts`
uses. The engine was **not** intercepted: every reveal below came out of the shipped Stockfish wasm
in a real Worker. Walk scripts and their raw output are in `evidence/`.

Viewports driven: **1440x900, 1920x1080, 390x844, 1024x500 (short landscape)**, plus a
keyboard-only pass.

## What this baseline does not establish

It does not say the product is correct — only what the tree reported about itself before this
mission touched it. It is a snapshot. When gate or test counts move later, this file does not move
with them; `RNL-10` is why.
