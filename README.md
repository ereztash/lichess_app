# Decision Lab

A chess tool that answers a **process**, not a position.

Every analysis tool on the market models positions. The painful part of improving is not "I don't
know the best move" — engines solved that and gave it away free. The pain is losing the same way
twice without noticing, because a mistake in a Sicilian on move 19 and a mistake in a Caro-Kann
on move 24 look like two unrelated events.

A position error is first-order: this allocation was wrong. A **policy** error is second-order:
the standing rule that produced the allocation is miscalibrated. Existing tools give exhaustive
first-order correction and zero second-order correction.

## The rule the whole thing rests on

**The player decides before the machine speaks.** You enter a move, what you _can_ read in the
position, what you _cannot_ evaluate, and a confidence. Only then does the engine talk.

That is not a training gimmick. An engine knows what the position needed; it has no idea what you
were choosing between, or why, or under what constraint. The commitment step is the only moment
that variable is observable, and it does not exist in any other tool.

It is enforced three ways rather than by discipline: a state machine where the engine may run in
exactly one stage, a type that makes an evaluation-carrying commit event unconstructible, and a
dynamic import that keeps the engine out of the initial module graph so it cannot even appear in
the network tab before you commit.

## What it will and will not tell you

It will say things like: _across 42 decisions taken under 45 seconds your stated confidence was
80% against 24% accuracy, while across the other 61 the gap was near zero._ It will call that a
**hypothesis**, show you its n, and state in advance what would refute it. It only becomes a
finding after a drill it could have failed.

It will frequently tell you **nothing**, and say so. That is the design. The product's
credibility is built entirely out of the moments it declines to claim something.

**You will wait weeks before it says anything at all.** At the shipped detector thresholds a
strong pattern first appears at roughly 60–90 recorded decisions, and a bucket needs 30
decisions inside it and 30 outside. That is the price of a 0.7% false-positive rate against
shuffled labels; the looser thresholds spoke after ~30 decisions and were wrong about half the
time at that size. The full curve is in [docs/MEASUREMENTS.md](docs/MEASUREMENTS.md).

## The loop

The unit of output is **one claim and one drill**. Not a dashboard, not a list of weaknesses.
If three candidate patterns exist it shows the one with the most support and tells you the other
two are being withheld — a page that shows everything is a page after which nothing changes.

```
record decisions  →  detect a pattern  →  hypothesis, with n and a refutation condition
                                              ↓
       graded, either way  ←  run the drill  ←  drill built from positions you have NOT decided
```

**A drill is the only thing that can change a grade**, because it is the only evidence that
postdates the claim. More of the data that produced a hypothesis cannot confirm it — that is
enforced in the type system: the function that raises a grade accepts a prospective drill result
and has no overload for anything else.

Running one:

- What would **refute** the claim is written to storage before the first position is shown, and
  stays on screen for the whole drill. You are told what you are being tested for.
- Positions come from your loaded games at plies you have **not** decided on. Re-showing a
  position whose verdict you have already seen is not a forward test.
- Each drill position is captured through the **same** commitment screen as any other decision —
  move, read, unknown, confidence, then the engine. There is no separate drill protocol.
- The verdict is measured against the condition the drill **stored**, not a rule invented at the
  end: the drill's mean calibration gap against the baseline from the rest of your record.
- The result is reported either way. A refuted claim is kept **forever** and never re-tested —
  deleting it would let the same wrong pattern be rediscovered.

Fewer than five undecided positions and it refuses to build a drill at all. A two-position drill
that returns a verdict is worse than no drill, because the verdict looks like evidence.

## What it does not claim

It does not claim to improve your chess. No such measurement exists. The strongest statement this
build supports is about calibration gap on recorded decisions, and nothing wider. It has never
been run against a real player's record.

## Development

```bash
npm install
npm run dev      # SPA + API on one port
npm run verify   # typecheck, tests, gates, gate controls, build
```

`npm run dev` mounts the same Express app the serverless entry uses, so dev and production run
identical server code. **The engine does not run in dev**: Vite rewrites the wasm asset URL with
a query string the Stockfish loader cannot parse. Use a production build to exercise it.

## Gates

Nine gates, each shipping with a positive control that must be demonstrated **red**. A gate that
has never failed has not been shown to be a gate.

```bash
npm run gates            # must be green on real code
npm run gates:controls   # must be RED on deliberately-broken fixtures
```

`gates:controls` exits non-zero if any control stays green, and also if a control never actually
ran — a control that fails to execute is not a control.

| Gate          | Rule | Positive control                                                                        |
| ------------- | ---- | --------------------------------------------------------------------------------------- |
| GATE-ISO      | 3.1  | an API event with the `unknown` atom dropped                                            |
| GATE-NO-FAKE  | R2   | the fabricated `+0.42 @ depth 14` opening evaluation, restored                          |
| GATE-DENOM    | R1   | `rate(1,1)` rendered as a bare "100%"                                                   |
| GATE-STALE    | 4.3  | the shipped superseding logic, which resolved a request with an abandoned search's move |
| GATE-GRADE    | 3.3  | a claim rendered without its grade or its n                                             |
| GATE-PREREG   | R5   | a drill starter with no pre-registration check                                          |
| GATE-EXTERNAL | R4   | a permissive promote path that lets external evidence raise a grade                     |
| GATE-COMMIT   | R3   | a reveal payload served before the decision was recorded                                |
| GATE-SHUFFLE  | 6    | the first-draft detector thresholds, which found structure in pure noise                |

## Deployment

See [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md). Single-tenant on purpose: every Lichess
endpoint is gated to one `OWNER_OPEN_ID`. The decision record contains a player's reasoning in
their own words and never leaves the deployment.

## The record lives where you are

Signed in, decisions go to the server. Not signed in, they are kept **in your browser** and never
leave the machine — no account, no OAuth portal, no configuration. The screen says which of the
two is in effect, and says so loudly if the browser is blocking storage, because a decision that
was not stored must never look like one that was.

Both paths run the same code: `shared/record-service.ts` against a `RecordStore`. R3 (the engine
does not speak before the decision is recorded), R5 (the refutation condition is written before
the drill runs) and append-only are enforced there, once, not re-implemented per backing.

## Getting your games in

Type a Lichess username. `/api/games/user/{username}` is public and sends
`access-control-allow-origin: *`, so the browser reads it directly: **no API token, no sign-in,
no configuration**. Only finished games are offered — the fair-play guard depends on a live game
never reaching the analysis layers. Pasting or uploading a PGN still works and is the fallback if
the network blocks the request, which the screen says by name rather than as "could not load".

**Signing in does not sign in to Lichess.** The button authenticates against the app's own OAuth
portal; no Lichess login page is ever shown and no visitor's Lichess credentials are held.
Lichess data is read server-side with a `LICHESS_API_TOKEN` the owner issues from their own
account. The two build-time variables (`VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL`) are baked into the
bundle, so setting them without rebuilding changes nothing — the deployment doc says which
failure looks like what.
