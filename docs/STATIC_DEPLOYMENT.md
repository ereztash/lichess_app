# Deploying with no server at all

The whole decision loop is client-side. `server/_core/configuration.ts` says what a deployment
without an owner does, in its own words: *"the record stays in the browser and the database is
never written to. Nothing fails, it just doesn't happen."*

That is now **measured, not inferred**. `tests/layout/a-stranger-with-no-server.layout.test.ts`
serves the built app on a host that answers **503 to every `/api/*` call** and checks what a person
who is not the owner actually gets: a board with 32 pieces, no error boundary, zero unhandled
errors, a screen that says the record is local, and the 7.1 MB engine wasm fetchable over the same
host.

**What you lose without a server:** the record on the server, and the Lichess endpoints that are
gated on `OWNER_OPEN_ID`. **What you keep:** playing, deciding, committing, the reveal, drills,
game review, and importing games from Lichess and Chess.com — those two archives are read directly
by the browser from public endpoints with no token.

---

## What is already in the build

| file | read by | what it does |
| --- | --- | --- |
| `_redirects` | Netlify, Cloudflare Pages | rewrites any path to `index.html` with **200**, so `/play` survives a refresh |
| `_headers` | Netlify, Cloudflare Pages | the CSP and security headers |
| `vercel.json` | Vercel | the same policy, in Vercel's format |

Both are emitted from `client/public/` into `dist/public/` on every build, and
`tests/layout/a-static-host-with-no-server.layout.test.ts` holds them: the fallback is a rewrite
and not a redirect, the CSP permits `wasm-unsafe-eval` and `worker-src 'self'` (without either the
engine does not run at all), `connect-src` still allows only the two game archives, the GPL text is
present at the path the notices point at — and **the two copies of the policy are asserted
identical**, because Vercel cannot read `_headers` and Netlify cannot read `vercel.json`.

## Build

```bash
npm ci
npm run build          # -> dist/public
```

Nothing needs to be set. `VITE_APP_ID` and `VITE_OAUTH_PORTAL_URL` are baked in at build time and
only drive the owner's OAuth button; without them the app runs in browser-record mode and says so.

## Deploy

**Cloudflare Pages** — reads both files, sends the headers, free tier serves the 7.1 MB wasm.

```bash
npx wrangler pages deploy dist/public --project-name decision-lab
```

**Netlify** — same two files, same behaviour.

```bash
npx netlify deploy --dir=dist/public --prod
```

**Vercel, as a static project** — `vercel.json` already carries the routing and headers. The
serverless function under `api/` deploys with it and every call to it fails gracefully, which is
the state the stranger test covers.

```bash
npx vercel --prod
```

**GitHub Pages** — works, with one real caveat: **Pages cannot send response headers**, so
`_headers` is ignored and the CSP does not apply. Everything still runs, because the CSP is a
restriction rather than a permission, but the deployment is less locked down than the other three.
Prefer one of the above if that matters.

## Checking a deployment rather than assuming it

```bash
curl -sI https://<host>/play | head -1                    # 200, not 404
curl -sI https://<host>/assets/*.wasm | grep -i content-type   # application/wasm
curl -s  https://<host>/licenses/stockfish/COPYING.txt | head -1
curl -sI https://<host>/ | grep -i content-security-policy      # ignored on GitHub Pages
```

The first is the one that actually breaks: without the rewrite, a link to `/play` is a 404 and that
is the first thing a stranger hits.

## Licensing, since deploying is distributing

The build **conveys** Stockfish 18 — 7.1 MB of WebAssembly under GPL-3.0-or-later, shipped
unaltered. Publishing this app is distributing that engine, which obliges you to convey its licence
and point at its source. Both already travel with the build (`/licenses/stockfish/COPYING.txt`,
checked above and by `GATE-NOTICE`).

The project itself is **GPL-3.0-or-later** (`LICENSE`). `THIRD_PARTY_NOTICES.md` records why: not a
preference, but because whether shipping a GPL engine alongside this application combines the two
is a question reasonable readings differ on, and licensing under the same terms makes the answer
stop mattering.
