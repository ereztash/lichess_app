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

| Variable            | Purpose                                                                   |
| ------------------- | ------------------------------------------------------------------------- |
| `JWT_SECRET`        | Signs the session cookie. Without it, no session can be created.          |
| `VITE_APP_ID`       | OAuth client id.                                                          |
| `OAUTH_SERVER_URL`  | OAuth token/userinfo host.                                                |
| `OWNER_OPEN_ID`     | Single-tenant gate. Every Lichess procedure is restricted to this openId. |
| `LICHESS_API_TOKEN` | Lichess API access.                                                       |
| `DATABASE_URL`      | MySQL connection for the decision record.                                 |
| `LAYER_C_ENABLED`   | Off unless set to exactly `true`. See below.                              |

## Layer C is off by default

The external-pointer layer (`server/layerC.ts`) is disabled unless `LAYER_C_ENABLED` is exactly
`"true"`. Layers A and B are a complete product without it.

It is off because it is the part most likely to produce fluent nonsense, and it should earn its
way in with measurements rather than a demo. It cannot raise a claim's grade under any
configuration -- that is enforced at the type level and proved by GATE-EXTERNAL, which compiles a
file attempting the promotion and requires it to fail. The flag governs whether it runs at all,
not whether it is trusted.
