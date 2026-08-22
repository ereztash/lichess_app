# Vercel deployment

Vite SPA + catch-all Express Vercel Function.

- Build: `npm run build`
- Static output: `dist/public`
- API entry: `api/[...path].ts`, a thin re-export of `server/app.ts`

`server/app.ts` is the single Express app. The serverless entry, the Vite dev server
(`apiDevServer` in `vite.config.ts`), and the test suite all mount that same app, so local
development and production run identical server code.

The board and browser-side Stockfish work without server secrets. Private Lichess integration
additionally needs the OAuth/session variables read by `server/_core/env.ts` plus
`LICHESS_API_TOKEN`. Never commit secrets.

## Environment

Two kinds of variable, and the difference is the single most common way this deployment breaks.

**Build-time (`VITE_*`).** Vite substitutes these into the JavaScript bundle when the build runs.
They are not read at runtime. **Adding one in the Vercel dashboard changes nothing until the
project is rebuilt** — the existing deployment still carries the values it was built with.

| Variable                 | Purpose                                                            |
| ------------------------ | ------------------------------------------------------------------ |
| `VITE_APP_ID`            | OAuth client id, sent by the browser when starting sign-in.        |
| `VITE_OAUTH_PORTAL_URL`  | Host the browser is redirected to for sign-in.                     |

Missing either one and the sign-in button cannot start. It now says which one on screen rather
than failing silently.

**Runtime.** Read by the serverless function on each request, so a change takes effect on
redeploy without a rebuild.

| Variable            | Purpose                                                                   |
| ------------------- | ------------------------------------------------------------------------- |
| `JWT_SECRET`        | Signs the session cookie. Without it, no session can be created.          |
| `OAUTH_SERVER_URL`  | OAuth token/userinfo host, called server-side to complete sign-in.        |
| `OWNER_OPEN_ID`     | Single-tenant gate. Every Lichess procedure is restricted to this openId. |
| `LICHESS_API_TOKEN` | Lichess API access. Server-side only; see below.                          |
| `DATABASE_URL`      | MySQL connection for the decision record.                                 |
| `LAYER_C_ENABLED`   | Off unless set to exactly `true`. See below.                              |

`system.lichessConfig` reports which of the runtime variables are present, as booleans and names
only — never a value, a prefix, or a length. It is behind sign-in, and the Lichess panel asks for
it at the moment a request fails, so a failure names its cause instead of saying "could not load".

## Signing in does not sign in to Lichess

The sign-in button authenticates against the OAuth portal at `VITE_OAUTH_PORTAL_URL` — the
application's own login. **No Lichess login page is ever shown, and the app never holds a
visitor's Lichess credentials.**

Lichess data is fetched server-side with `LICHESS_API_TOKEN`, a token the deployment's owner
issues from their own Lichess account. So Lichess integration works when three things hold at
once, and each fails differently:

1. The build carries `VITE_APP_ID` and `VITE_OAUTH_PORTAL_URL` — otherwise the button reports
   which is missing and does not navigate.
2. `LICHESS_API_TOKEN` is set on the server — otherwise requests fail with
   `PRECONDITION_FAILED`, and the panel names the variable.
3. The signed-in account's openId equals `OWNER_OPEN_ID` — otherwise `FORBIDDEN`. An unset
   `OWNER_OPEN_ID` is reported separately as `PRECONDITION_FAILED`, because a missing server
   setting and a wrong browser session have different fixes.

## Deployment protection

Vercel SSO protection is enabled for this project on all non-custom domains, so a `*.vercel.app`
preview or production URL asks for a Vercel login before the app loads at all. That is a
deployment setting, not an application one; a custom domain bypasses it.

## Layer C is not mounted

**`LAYER_C_ENABLED` currently changes nothing.** `server/layerC.ts` is imported by no router --
only by its own test -- so the running API has no path that reaches it. Setting the variable to
`"true"` on a deployment has no effect, and this section previously read as though it did.

Two things are true at once and both matter: the flag is honoured by the code that reads it
(`layerCEnabled()` accepts only the exact string), and nothing calls the code that reads it. It is
documented here rather than quietly mounted because mounting it would ship a live dependency on
`explorer.lichess.ovh` that this codebase has never once reached -- see docs/FINDINGS.md.

The rest of this section describes the layer as designed, for whoever mounts it.

The external-pointer layer (`server/layerC.ts`) is disabled unless `LAYER_C_ENABLED` is exactly
`"true"`. Layers A and B are a complete product without it.

It is off because it is the part most likely to produce fluent nonsense, and it should earn its
way in with measurements rather than a demo. It cannot raise a claim's grade under any
configuration -- that is enforced at the type level and proved by GATE-EXTERNAL, which compiles a
file attempting the promotion and requires it to fail. The flag governs whether it runs at all,
not whether it is trusted.
