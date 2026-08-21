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

| Variable | Purpose |
| --- | --- |
| `JWT_SECRET` | Signs the session cookie. Without it, no session can be created. |
| `VITE_APP_ID` | OAuth client id. |
| `OAUTH_SERVER_URL` | OAuth token/userinfo host. |
| `OWNER_OPEN_ID` | Single-tenant gate. Every Lichess procedure is restricted to this openId. |
| `LICHESS_API_TOKEN` | Lichess API access. |
| `DATABASE_URL` | MySQL connection for the decision record. |
