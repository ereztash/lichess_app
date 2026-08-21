# What reading and building this actually turned up

Findings from converting the analysis board into a decision-record tool. Recorded here because
they are otherwise spread across commit messages, and because several are the kind of thing that
gets rediscovered expensively.

Every claim below cites where it was observed. Anything not verified says so.

## The repository as found

- **45 tracked files, 903 lines** — but the source shipped **minified**, with lines up to 4,626
  characters and twelve files on a single line. Reformatted at 100 columns it is **2,294 lines**.
  Reading the tree at all required reformatting it first.
- **No `.gitignore` existed.** Nothing kept `node_modules` or `dist` out of a commit.
- **No test framework, no tests.** CI ran `npm install && npm run build` on pushes to `main`
  only, so `server/` could stop compiling entirely without CI noticing.
- **`npm run dev` served the SPA alone.** Nothing mounted the Express app, so every tRPC call
  404ed locally and the API existed only once deployed.

## Defects

Five were known. Three were not.

### 1–5, as specified

| #   | Where                      | What                                                                                                                                             |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `Home.tsx`                 | `FALLBACK = {scoreCp:42, depth:14, pv:[…]}` — the app opened on a fabricated +0.42, rendered identically to a real evaluation                    |
| 2   | `Home.tsx`, `game-data.ts` | a timed-out analysis left the previous position's evaluation on screen; `catch { break }` truncated an invalid PV into a short valid-looking one |
| 3   | `AnalysisPanel.tsx`        | "apply the recommended move" — no staleness check, not disabled during analysis                                                                  |
| 4   | `LichessLayersPanel.tsx`   | `rate(v,t)` rendered a percentage with the denominator never shown                                                                               |
| 5   | `AnalysisPanel.tsx`        | the same hardcoded sentence about the centre appended to every position                                                                          |

### 6. A request-generation race in `StockfishClient`

UCI tags nothing with a request id, so an aborted search's `bestmove` was indistinguishable from
the live one's. `handleMessage` resolved whichever request happened to sit in `current`:

    analyze(B) while A in flight
      -> stopCurrent() rejects A, clears current, latest = INITIAL_LINE
      -> current = B
    worker emits bestmove for the ABORTED A search
      -> resolves B with { pv: [], depth: 0, bestMove: <A's move> }

B's real result was then discarded, because `current` was already null. Fast timeline navigation
dropped results permanently and stranded a stale number against a new position.

Fixed by counting the `bestmove` replies owed by abandoned searches and draining them. The
shipped logic is preserved in `tests/fixtures/legacy-stockfish.ts` as GATE-STALE's control.

### 7. The engine had never run — not once, in the project's history

`client/src/lib/stockfish.ts` built its worker URL as:

    `${ENGINE_JS}#${encodeURIComponent(ENGINE_WASM)},worker`

That `,worker` suffix sends the stockfish.js loader down a branch where it never initialises. The
script loads, the worker is created, and then **nothing** — no wasm fetch, no message, not even
an error. The app's central advertised feature produced zero evaluations for its entire history.

Nothing caught it because there were no tests and CI only ran `npm run build`. A build cannot
observe an engine that stays silent.

Found by driving a browser, not by reading. The code looks correct; section 1 of the brief called
this file "worth keeping", and on inspection so did I.

Verified empirically against the built asset, four URL variants, one browser:

| worker URL           | result                                               |
| -------------------- | ---------------------------------------------------- |
| no hash              | silent                                               |
| `#<wasm>`            | "Stockfish 18 Lite WASM by the Stockfish developers" |
| `#<wasm>,worker`     | **silent — what shipped**                            |
| `#<raw wasm>,worker` | silent                                               |

Ruled out before concluding, so the diagnosis is not a guess: `WebAssembly.instantiate` succeeds
in that browser, plain Workers round-trip, and the loader contains zero references to
`SharedArrayBuffer` — so cross-origin isolation, which looked like the obvious culprit, was not
involved. The worker script returns 200; the wasm is simply never requested.

### 8. `tsconfig.json` had no `target`

`tsc` therefore defaulted to ES5 and rejected `Map` iteration — an error that reads as unrelated
to the code that triggers it.

## Two things that were dead

- `registerOAuthRoutes` and `createContext` had **zero callers**. Both are now mounted.
- `server/db.ts`, `drizzle/schema.ts` and `shared/_core/errors.ts` had **zero importers**.
  `upsertUser` did not "no-op when `DATABASE_URL` is unset" — it no-opped _unconditionally_,
  because nothing called it. No user row was ever written under any configuration.

## The duplication had already drifted

`api/[...path].ts` was a 250-line hand copy of `server/lichess.ts` + `server/routers.ts` that
imported nothing local, while the client took its **types** from `server/routers.ts`. The two had
already diverged in seven ways, every one in the direction where production was worse than the
types promised:

| behaviour                    | type source           | production                |
| ---------------------------- | --------------------- | ------------------------- |
| explorer NDJSON              | streaming reader      | buffered the whole stream |
| `studyPgn` on a public study | unauthenticated retry | no fallback — failed      |
| `gamePgn` empty body         | `NOT_FOUND`           | returned `""`             |
| `studyPgn` empty body        | `NOT_FOUND`           | returned `""`             |
| cloud-eval 429               | `TOO_MANY_REQUESTS`   | `BAD_GATEWAY`             |
| cloud-eval 401/403           | `UNAUTHORIZED`        | `BAD_GATEWAY`             |
| `recentGames` max            | clamped in depth      | zod only                  |

`api/[...path].ts` is now three lines.

## Three checks that passed for the wrong reason

Each was a green that would have been reported as real. Worth naming as a class:

1. **GATE-COMMIT's first draft** asserted that an unauthenticated request was refused — but it
   was refused by the _auth middleware_, never reaching the commit gate. The suite now
   authenticates and asserts, as its first test, that auth is not what refuses.
2. **GATE-STALE's control "went red"** only because vitest collected no files and exited 1. A
   control that never ran is not a control. The runner now detects an uncollected control and
   fails the run; verified by pointing it at a missing file.
3. **`stockfish-worker-url.test.ts`** anchored on a line that had since moved. It now fails
   loudly if it cannot find its subject.

## Where the build stopped and asked

Section 8 of the brief names five stop conditions. Two fired.

- **The shuffled-label control found structure in noise.** The first detector thresholds
  produced a pattern on **53% of pure-noise records at n=40**. Stopped, swept the thresholds,
  operator chose 30 / 0.45 — worst case 0.7%. Full table in `MEASUREMENTS.md`.
- **A threshold moved to make a gate go green.** GATE-NO-FAKE went red on a zeroed sentinel after
  a refactor moved it between files. The rule was narrowed to require a non-zero depth. This was
  resolved first and flagged afterwards; the correct order was the reverse.

## Still unverified

- The deployed engine **producing an evaluation**. The fix is confirmed present in the deployed
  bundle and the wasm is served correctly (`application/wasm`, 7,295,411 bytes, HTTP 200), and
  the engine was driven successfully against a byte-identical local build — but the development
  sandbox cannot drive a browser against the deployed origin.
- `DrizzleRecordStore` against **MySQL**. `DATABASE_URL` has never been set in any environment
  this build has run in, so it has never executed a statement.
- **Layer C against live Lichess.** Its tests stub `fetch`.
- Every detector threshold **against real data**. All synthetic.

## Not built

- **The drill UI.** Drills grade correctly in the domain layer and Layer C proposes them, but
  nothing runs one from the screen — so no claim can currently reach `replicated` through the
  interface.
- **Self-hosted fonts.** `client/src/index.css:1` imports Google Fonts, so every page load
  reaches Google with the visitor's IP and referrer. Pre-existing, not introduced here, but this
  deployment holds a player's reasoning in their own words and the brief is explicit about not
  adding dependencies that phone home.
