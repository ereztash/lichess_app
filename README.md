# Stockfish Chess Studio

A Vite/React chess analysis studio with browser-side Stockfish and optional private Lichess integration.

## Vercel

The repository is prepared for Vercel as a Vite SPA with a serverless Express API entry at `api/[...path].ts`.

```bash
pnpm install
pnpm run build
```

Static output is written to `dist/public`.

Private Lichess access requires server-side environment configuration. Never commit tokens to the repository; see `VERCEL_DEPLOYMENT.md`.
