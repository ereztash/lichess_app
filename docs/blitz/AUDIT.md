# Milestone 0 — repository truth audit

The gate before any code changes for blitz-native measurement. Every row below was read in the
working tree at the commit named here, not recalled. Where the plan that commissioned this work
assumed something about the repository, the assumption is checked rather than carried.

## 0. Which tree is the truth

| | |
| --- | --- |
| `origin/main` | `8dba6f7` |
| this branch | `f42bb39`, **11 commits ahead of main, not merged** |
| open pull requests | **one** — #40, the 117-game time-representation study, CI green, mergeable |
| other remote branches | four, all stale, no open PR against any |

**The 117-game study is not on `main`.** The plan asked whether `f42bb39` was still ahead; it is,
and `git merge-base --is-ancestor f42bb39 origin/main` is false. So the corrected study — the one
that found the shipped 45 s / 120 s cut puts every blitz decision in one bucket — exists only on
this branch and in PR #40. Anything built on `main` would not see it.

## 1. The gap table

### 1.1 Time-control metadata — **lost at normalization**

| | |
| --- | --- |
| **Current** | `ImportedGame` (`client/src/lib/game-source.ts:64`) carries `speed: string` and `rated: boolean`. **No base time, no increment.** Lichess's `toGame` (`lichess-public.ts:36`) maps eleven fields and never reads `raw.clock`, although the request asks for clocks (`lichess-public.ts:87`) and the API returns `{initial, increment, totalTime}`. Chess.com declares `time_control?: string` in its raw type (`chesscom-public.ts:65`) and **never maps it** — only `time_class` survives, as `speed` (`chesscom-public.ts:148`). |
| **Desired** | base and increment preserved from the source, `null` where the source does not supply them. |
| **Gap** | Both sources supply it; both drop it. It is recovered downstream only by re-parsing the PGN header (`import-run.ts:117`), so a source whose PGN omits `[TimeControl]` loses it entirely, and `speed = "blitz"` is all that remains — which INV-8 says is not a unit of analysis. |
| **Evidence** | `game-source.ts:64-78`, `lichess-public.ts:36-61,87`, `chesscom-public.ts:65,148`, `import-run.ts:117` |

### 1.2 Clock semantics — **already correct, and better than the plan assumed**

| | |
| --- | --- |
| **Current** | `shared/pgn-clock.ts` handles the increment explicitly (`spent = previous − current + increment`), returns `null` rather than `0` for a first move with no prior reading, and returns `NaN → null` when the `TimeControl` header is missing rather than guessing from the first `[%clk]`. `clockMsRemainingAt` states the choice in its own words: *"this is the clock as the player FACED it — the reading before their move … The after-reading is a consequence of the decision; the before-reading is a condition of it."* |
| **Desired** | exactly that. |
| **Gap** | **None on the player's own clock.** The one real gap is the **opponent's** clock: the readings are already in the same `clockTimes` array at the alternating indices, and nothing derives them, so `clock_balance` and `clock_share` are underivable today. |
| **Evidence** | `shared/pgn-clock.ts:56-96` |

### 1.3 Measurement protocol — **does not exist**

| | |
| --- | --- |
| **Current** | No `measurementProtocol`, `protocolVersion` or `analysisTiming` anywhere in `shared/`, `client/` or `server/`. The grep returns nothing. |
| **Desired** | first-class and versioned, with legacy rows landing in an explicit unknown rather than being mis-labelled. |
| **Gap** | The whole concept. Note the adjacent precedent that already exists and should be followed rather than reinvented: `EVIDENCE_POLICY_VERSION` and the `LEGACY_CONTEXT` key in `evidence-policy.ts` do exactly this for a different axis, including the argument for why legacy is a separate key and not a seventh member of the union. |
| **Evidence** | grep over `shared client server`; `evidence-policy.ts:36,60-66` |

### 1.4 Evidence pooling — **the wall exists; reveal timing is not on it**

| | |
| --- | --- |
| **Current** | `shared/evidence-policy.ts` is already the abstraction PR-4 asks for: one versioned table, six consumers × seven contexts, four admission kinds (`admitted` / `refused` / `scoped` / `separate`) with a written reason in **every** cell, and `forDiscovery` admitting only `admitted`. It is materially stronger than the plan assumed. |
| **Desired** | incompatible populations cannot pool. |
| **Gap** | **The table keys on `DecisionPurpose` and nothing else.** `reveal_timing` is stored on the atom (`decision-atom.ts:267`), mapped by the service (`record-service.ts:312`) and read by the UI — and is **never consulted by `evidence-policy.ts` or `forDiscovery`**. So two decisions identical except that one was coached move-by-move by a stronger engine and one was not are both `purpose: "play"` and both enter discovery. `reveal-timing.ts:9` says in its own words *"the two are not poolable, and every decision records which was in force"* — the recording happens; the enforcement does not. **INV-7 is violated today, before any blitz evidence exists.** |
| **Evidence** | `evidence-policy.ts:140-260` (no reveal-timing reference), `forDiscovery` at `:261`, its only callers at `record-service.ts:1452,1484`; `decision-atom.ts:267`; `reveal-timing.ts:1-20` |

### 1.5 Live engine coupling — **the game awaits the engine, twice**

| | |
| --- | --- |
| **Current** | `Home.tsx:946` awaits `engine.analyze(after.fen(), 14)` inside the commit path, and `Home.tsx:750` awaits `engine.analyze` to choose the opponent's move. The board does not advance until both resolve. |
| **Desired** | INV-3: commit → advance. INV-4: zero analysis calls before game over. |
| **Gap** | Both, by construction. This is not a defect of the current product — it is a per-position commitment loop where waiting is the point — but it is unusable for a timed game, and the opponent engine and the analysis engine are the same object today, which INV-11 separates. |
| **Evidence** | `Home.tsx:750,946` |

### 1.6 Confidence sampling — **exists, is argued for, is not self-describing**

| | |
| --- | --- |
| **Current** | `ASK_RATE = 0.15` (`confidence-asked.ts:189`), chosen with a written run-length analysis over 500 and 5,000 simulated games. Whether a decision was asked is recorded. |
| **Desired** | the rate and the policy version recorded per decision, so a later reader can reconstruct what regime produced the sample. |
| **Gap** | Neither `sampling_probability` nor a policy version is stored anywhere. Today the rate is a constant, so it is recoverable from the source at that commit; the moment it becomes conditional on time control — which blitz needs — it stops being. |
| **Evidence** | `confidence-asked.ts:189,212-223`; grep for `sampling_probability` returns nothing |

### 1.7 Validation protocol — **a prospective window exists; it counts decisions, not time**

| | |
| --- | --- |
| **Current** | `claim-validation` is `scoped` to `matching-test` *"only inside a registered observation window"* (`evidence-policy.ts:180`), and the window is implemented as a decision-count slice: `atoms.slice(narrowing.decisions_before)` (`record-service.ts:1485`). `drill.ts` supplies `createDrill` / `startDrill` / `completeDrill` / `evaluateRefutation`, and only prospective results may move a grade (`record-service.ts:1364`). |
| **Desired** | `Claim → ValidationProtocol`, with `TimedHoldout` for claims that are properties of the decision *environment*. |
| **Gap** | The prospective discipline is real and already enforced, but the only protocol is a static-position drill, and the freeze boundary is a decision index rather than a timestamp. A time-pressure claim validated by a static FEN drill is exactly what INV-10 forbids. |
| **Evidence** | `evidence-policy.ts:174-186`, `record-service.ts:1364,1485`, `drill.ts:50-285` |

**Resolved in part, and one part deliberately left open.** PR-13 supplies `ValidationProtocol` and
`TimedHoldout` (`shared/validation-protocol.ts`), including the timestamp boundary. It also made
visible that the gap was not a missing feature but a **disagreement**: `beginDrill` built a static
drill for `fast-under-45s`, with a reason written in its own comment, and `protocolFor` sent that
bucket to a holdout. Reproduced by running the repository's drill-loop test:
`DRILLED_CLAIM: claim-fast-under-45s | protocol INV-10 requires: timed-holdout`.

**Closed by ADR-003, option 3, decided by the repository's owner.** A forward test now carries the
protocol it ran under; a protocol the claim does not require may move the grade but never lock it,
and the card names both the test that ran and the test that would settle the question. The drill is
NOT withdrawn — that was option 1, and it would have stripped the only prospective test available
on the bucket holding 99.7% of a blitz player's decisions.
`tests/shared/a-rule-the-product-breaks.test.ts` now holds the resolution's two halves: the drill is
still built, and the grade it produces is not settled.

### 1.8 `Home.tsx` — **already fenced**

2,357 lines and 55 `useState`, against a committed ratchet of 2,400 / 55 that *only ever goes down*
(`tests/client/the-file-that-only-ever-grew.test.ts:41,50`). The plan's instruction not to add blitz
as another state machine inside `Home.tsx` is not merely advice here: **a fifty-sixth `useState`
fails the build.** An isolated route is the only option the repository permits.

### 1.9 The clock-reachability guard — **watched one file, and the blitz work built a second**

*Not found by this audit. Created by it, and found afterwards — recorded here because the gap table
is the honest place for it.*

`shared/live-acquisition.ts:44` states a fact in a constant:

```ts
export const LIVE_DECISION_CARRIES_CLOCK = false;
```

`isRegistrableBucket` reads it and refuses to preregister `clock-under-1m`, because a bucket the
live loop can never fill turns a preregistration into a countdown that never ends. The constant is
a *stated* fact — `shared/` cannot import the client — and its own comment names the guard that
keeps it honest:

> *if a clocked live game is ever built, the test that asserts every construction site passes null
> goes red and names this constant as what to change.*

**The guard read `Home.tsx` and nothing else** (`tests/gates/reachability.test.ts`), which was
complete when it was written: `Home` was the only place a game was played. PR-6b added `/blitz`, a
second live game **with a real clock**, on its own route — exactly as §1.8 requires. The promise was
scoped to a file rather than to the client, so the clocked game was built somewhere the guard could
not see.

**Measured, not argued.** Adding a `clockMsRemaining: 30_000` to `client/src/pages/Blitz.tsx` and
running the guard as it stood: **8 passed, 0 failed.** The same mutation against the generalised
guard fails, naming `pages/Blitz.tsx:51`.

**Nothing is wrong in the product today**, and that is why this is worth writing down rather than
only fixing. `/blitz` decisions stop at the post-game analyser and never enter the record store, so
the constant is still true. **PR-11 is the change that will break it, deliberately** — and on that
day `isRegistrableBucket` would go on refusing `clock-under-1m` on a premise that had quietly
stopped holding, with no assertion anywhere going red.

So the fix is two assertions, not one:

| | what it holds |
| --- | --- |
| the field, client-wide | no module under `client/src` builds a decision with a non-null clock |
| the wiring | no client module that plays the clocked game also commits decisions |

The second exists because the first watches a *field name*, and a blitz decision could reach the
record under any name. Both name the constant when they fail.

## 2. Stop conditions, as of this commit

| | status |
| --- | --- |
| **STOP-A** — decision time separable from instrumentation time | **not yet buildable.** No timed game exists to separate them in. |
| **STOP-B** — engine no longer delays the live game | **currently failing** (§1.5). Blocks the reactivity experiment. |
| **STOP-C** — protocols no longer mix in discovery | **currently failing** (§1.4), and failing *before* blitz, on reveal timing. |
| **STOP-D** — instrumentation does not change behaviour | unknown, and unmeasurable until STOP-A and STOP-B clear. |
| **STOP-E** — live calibration dataset sufficient | no such dataset exists. |

**STOP-C is failing today on the existing product**, independently of blitz. That reorders the plan
slightly: §1.4 is worth fixing on its own merits, and fixing it is a prerequisite the plan already
places before any time-based claim.

## 3. One thing the plan and this repository's rules disagree about

The plan asks for a series of small, separately deployable PRs. This session is constrained to a
single branch, `claude/blitz-computation-validation-3utluc`, which currently carries PR #40 — the
completed study, green and awaiting a merge decision that is the account holder's to make.

So the blitz commits will stack on that branch unless told otherwise. They stay small and
separable, and the constraint is recorded here rather than worked around: whether #40 merges first,
and whether the integration wants its own branch, is a decision for the repository's owner.
