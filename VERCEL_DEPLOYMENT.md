# Vercel deployment

Vite SPA + catch-all Express Vercel Function.

- Build: `npm run build`
- Static output: `dist/public`
- API entry: `api/[...path].ts`

The board and browser-side Stockfish work without server secrets. Private Lichess integration additionally needs the OAuth/session variables used by `server/_core/env.ts` plus `LICHESS_API_TOKEN`. Never commit secrets.
