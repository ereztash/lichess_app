# Production readiness ledger

Kept per the recursive-improvement directive. One section per cycle. A row moves to **closed**
only when a regression test exists that goes red without the fix.

## Source of truth

| field | value |
| --- | --- |
| repository | `ereztash/lichess_app` |
| branch | `claude/mati-user-experience-components-d7549y` |
| PR | [#24](https://github.com/ereztash/lichess_app/pull/24) (draft) |
| `BASELINE_OID` | `03d8f96` — `origin/main`, the PR base and the commit the seed review was run against |
| `CURRENT_OID` | `7ed4da6` |

**A note on the seed review's provenance.** The findings were produced against `03d8f96`, which is
the PR **base**, not its head. The branch was 12 commits ahead at the time. Every finding was
therefore re-verified against the head before any of it was acted on; none had been fixed in the
interim, because none of them touched what PR #24 changed. An earlier version of the same review
had been run against a stale local checkout — it reported 325 tests and a 542kB bundle against a
head carrying 1,008 tests and 601kB — and was withdrawn.

## Lanes, and one that is blocked

| lane | status |
| --- | --- |
| Repository | running — code, schema, migrations, runtime behaviour, bundle, PR diff |
| Research | running — see `docs/RESEARCH_EVIDENCE.md` |
| COR-SYS graph | **BLOCKED, not skipped.** The canonical skill is at a Windows path on the operator's machine (`C:\Users\97252\...\COR-SYS-Graph`). This session runs in a Linux container with no access to it, so `route_query.py` cannot be run and the routed nodes cannot be read. No graph conclusions are recorded, and none are invented. The operator can unblock it by making the graph reachable to the session. |

## Environment facts that change what can be verified

- **No `gh` CLI.** GitHub is reached through MCP tools. Equivalent, but the commands differ from
  the ones the directive names.
- **A real database now runs locally.** MariaDB in-container, all three migrations applied,
  `DATABASE_URL=mysql://lab:lab@127.0.0.1:3306/decision_lab`. The suite went from **5 skipped to 0
  skipped**. Before this, `DrizzleRecordStore` was covered only by CI.
- **A real browser now runs locally.** Chromium at `/opt/pw-browsers/chromium-1194/`, wired into
  `tests/layout/` and installed in CI. jsdom reports every box as 0x0, which is how three visible
  defects shipped past a green suite.

## Cycle 1 — the cross-user record leak

| field | value |
| --- | --- |
| severity | **Critical** |
| hypothesis | A second signed-in account can read and write the owner's record. |
| reproduced | HTTP 200 carrying `"unknown":"לא הבנתי למה הרגל הזה תקוע"` to an account that never wrote it. The stranger's writes landed too: `record.count` returned 2. |
| cause | `record.*` on `protectedProcedure`, which asks only whether *somebody* is signed in. No record table carries a `user_id`, so no query could have scoped even if one had tried. |
| fix | `afca034` — `ownerProcedure` moved to `server/_core/owner.ts` and applied to the record router. The gate already guarded every Lichess route and Layer C, so the product was single-tenant everywhere **except** the router holding the private text. |
| test | `tests/server/record-isolation.test.ts` — 4 assertions, 4 positive controls red |
| residual | **The product is not multi-user and this does not make it one.** A second account is now refused rather than served someone else's record. Per-user separation needs `user_id` on twelve tables plus every query, index, and cache key — a product decision, not a defect fix. Open for the operator. |

## Cycle 2 — three defects a green suite could not see

| finding | severity | fix | test |
| --- | --- | --- | --- |
| Bucket label collapsed to one glyph per line, 23 lines tall, at 390px | High (UX) | `8edbbd0` — `minmax(7.5rem, auto) minmax(0, 1fr)` | `tests/layout/bucket-row.layout.test.tsx` |
| A gap of −30% rendered as `30%-` — the sign is the meaning of the figure | High (correctness) | `8edbbd0` — `unicode-bidi: plaintext` | `tests/layout/signed-number-reads-as-signed.layout.test.tsx` |
| "choose between e4d5 and e4d5" whenever the player picked the engine's move | High (correctness) | `8edbbd0` — guard on the strings; the replacement asks for the reason rather than congratulating | `tests/client/reveal.test.ts` |

Found by the controls rather than by inspection: the guard's `chosenWasBest` half was dead (the
one call site computes it as the same string comparison), and two fixtures described a record the
product cannot produce — `chosenWasBest: true` beside two different moves.

## Cycle 3 — invalid nesting and the dependency advisory

| finding | severity | verdict |
| --- | --- | --- |
| `<details>` inside `<p className="commitment-error">` | Medium | **Confirmed.** The parser evicts the child, so React warns on hydration — on the panel whose job is to be trustworthy when everything else has failed. Fixed as a render-path **scan** (`findInvalidParagraphs`), with a fixture proving it detects the shape. `3394342` |
| `drizzle-orm@0.44.7`, GHSA-gpj5-g38j-94v9, high | High advisory | **Confirmed present, NOT reachable.** `sql.identifier` appears zero times; every `orderBy` passes static schema columns, which the advisory names as unaffected. Bumped to 0.45.2 anyway, validated against the real database. `npm audit --omit=dev`: 0. `3394342` |

## Cycle 4 — a preregistered test that cannot be escaped

`c507a15`. Four holes in one claim: that the test deciding whether a rule transferred was fixed
before it ran.

| hole | what it allowed | fix |
| --- | --- | --- |
| No single-active enforcement | The started transfer lived on the server; the fact that one was running lived only in React state. Look at three positions, dislike them, reload, draw three more. | `getOpenLearningTransfer` on the store contract and all three implementations — returns the transfer so it can be **resumed**, because losing a tab is not misconduct |
| `next_due_at: null` read as "due now" | It means the schedule RAN OUT. A finished rule offered unlimited fresh tests while the row beside the button said "אין בדיקה נוספת" | Refused in the service **and** the queue; either alone leaves a screen offering what the server declines |
| Whole-FEN novelty | Knights out and back reach the identical board with the counters advanced, so a position the player had already been shown the answer for entered as unseen | `shared/position-key.ts` — the four fields that determine the legal moves |

Two mutations walked through: the first already-decided test used the rule's **source** position,
excluded by a second path, so reverting the novelty check changed nothing. That second path was
then itself dead — `listAtoms()` returns every committed decision and a rule cannot exist unless
its source was committed and revealed.

## Cycle 5 — the observation, frozen before the engine speaks

`f5f6fe6`. The runner asked *"אחרי החשיפה: האם יישמתם את הכלל?"* — literally after the reveal.
Once told the move was good, "did I apply my rule?" is answered by the outcome, in the flattering
direction, and that answer fed `successes`. **This is R3 one layer out**: the engine must not speak
before the decision is recorded, and an observation *about* the decision collected after it speaks
is the same leak in different clothes. The guard moved to the **commit**, not the advance — blocking
the advance would leave a player who skipped the question able to answer only after the reveal.

## Cycle 6 — graded against the rule, claiming what three positions carry

`e0d764d`. `banana` scored 3/3. Two of the three criteria were not measurements.

- **Self-report out of the criterion.** Still collected, still stored, decides nothing. Asserted in
  *both* directions, because a criterion that merely inverted the tick would pass a one-sided test.
- **Recall scored against the authored rule**, from the snapshot. `shared/recall-score.ts` is word
  overlap and is **named** for it; it is biased toward false negatives on purpose and a passing
  test asserts the wrong behaviour, which is the difference between a known limitation and an
  undiscovered bug.
- **The verdict no longer says "הכלל הופרך"** — it says the preregistered condition held or did
  not, and names four limits.

Two rounds of getting the matcher wrong are in the comments: a Hebrew prefix strip that could not
tell a prefix from a root (`שחים` → `חים`) and still missed `והכאות`, which carries two.

## Cycle 7 — the form answering for the player

`414c09f`. `mechanism_class` opened on `threat_scan`, `wouldChooseAgain` on `false`, neither
required, both with `aria-pressed` set — under `authored_by: "player"`. **The existing test was
passing because of the defect**: it saved without touching either control and asserted the result
stored "the player's own language", which it could only do because the form supplied the answers.

## Cycle 8 — the cache that outlived the account

`714779d`. `ownerProcedure` stopped the **server** handing one account's record to another. It said
nothing about the browser: every `record.*` response sits in the react-query cache keyed by
procedure and input, never by who was signed in, and react-query serves stale cache while
revalidating — so a 403 on the refetch does not remove what is already on screen. A signs in, reads
their record, signs out; B signs in and sees A's `stated_unknown` **with no request to the server
involved**.

Cleared on **identity change**, not on the logout mutation — a session can expire and someone else
can sign in on the same tab, and then no logout ever ran. Two mutations walked through this file
first: both the clear/refetch order and the refetch itself were invisible because `auth.me` is
mocked. A test that cannot see a call is not covering it.

## Cycle 9 — evidence that the layout tests run at all

`112ef94`. `PLAYWRIGHT_CHROMIUM` was one candidate in a list rather than a replacement for it, so a
bad override fell through to another browser silently. That hid the one path the file exists for.
Now `PLAYWRIGHT_CHROMIUM=/nonexistent` makes the suite **fail** with a message naming the fix —
which is what makes green CI evidence the layout tests *ran* there rather than evidence they were
skipped.

## Cycle 10 — a bundle budget that can fail

`7ed4da6`. 591.5 / 640 kB raw, 183.4 / 200 gzipped, 654.1 / 720 initial. A ratchet, not a target.
The engine check was **wrong before it was right**: it searched the entry chunk for "stockfish" and
failed the build on `await import("./stockfish-…")` — the evidence that R3 *is* respected. Moved to
index.html, where eager fetching is what a build artifact can actually show.

## Cycle 11 — a refusal reported as a missing database

`4fc9edd`. `ownerProcedure` answers a refused visitor and an unconfigured deployment differently
**on purpose** — FORBIDDEN and PRECONDITION_FAILED, with two written messages, because one is a
browser session and the other is a server the owner has to configure. The client had one boolean
for six situations and printed one sentence for all of them: *"בשרת אין מאגר החלטות מוגדר
(DATABASE_URL)"*. A person the server **refused** was told the database was missing. The server's
two messages existed and never reached a screen.

This is the product's own failure mode occurring inside the product: an instrument reporting a
cause it did not measure. It could not have told a refusal from a missing database, because it
never read the code it was handed.

`serverStatus` now carries one of seven named causes, read from `data.code` with `httpStatus` as a
fallback; anything unrecognised stays `unreachable`, because naming a cause there would be the
same defect again. A refused account and an unconfigured deployment are both told the browser
record belongs to the **browser, not their account** — said rather than fixed, because keying
localStorage by account would look like separation and buy none.

## Cycle 12 — a callback that held a value it did not depend on

`97e28b5`. `onCommit` read `learningTransferApplied` twice and did not list it, while listing
`learningTransferRecall` beside it. Nothing failed, because `useDecisionCount()` returns a fresh
object every render and the callback was rebuilt regardless. **What hid the bug is exactly what a
performance pass removes.** Memoize that hook — the obvious optimisation, correct on its own terms
— and a stale `null` becomes a written `false`: *"did not apply the rule"*, about a player who said
they did, in an append-only record, with every screen correct. `applied_rule` is half of
`successes`, so the product would report a rule refuted on an observation nobody made.

The assertion meant to cover this searched `Home.tsx` for two identifiers within 1200 characters of
each other — satisfied by source that merely mentions both, and it passed throughout. It is
replaced by a **parse**: every dependency list in the file, comparing what each hook body reads
against what it declares, excluding the two kinds React guarantees stable. It carries its own
vacuity check, because the assertion it replaces was vacuous in precisely that way.

`transferObservation` now throws on a null answer instead of `?? false` under a comment saying the
default could not fire. A missing measurement must not be recorded as a measured negative.

## Cycle 13 — "available" was never measured, and two things believed it

`a2ed0c5`. Reproduced before a line was written: point `DATABASE_URL` at a closed port and
`isAvailable()` returns **true in 4ms**; the first real query throws. `drizzle(url)` builds a
mysql2 pool, and a pool does not connect. `Boolean(await getDb())` was a test of whether a string
was set in the environment, wearing the name of a test of whether the database was up.

`record.storageAvailable` believed it — and `useRecordMode` exists for exactly one reason, in its
own comment: *"The server is used only when it says it can store."* Against an unreachable
database the server said it could, so the client abandoned a working browser-local record and
every commit failed: **the failure the local path was built to prevent, delivered by the check
meant to prevent it.**

`/api/health` believed it too, answering `{ok:true}` unconditionally. It is the diagnostic this
project actually used during the `FUNCTION_INVOCATION_FAILED` outage and the evidence cited in
`docs/FINDINGS.md` that a deployment is alive. What it measured was that a line of code ran.

Now: `select 1` under a 3s deadline; 503 for a **configured** database that cannot be reached, 200
when none is configured — absent is not down, and a browser-local record is a supported
deployment. No detail in the body: `system.lichessConfig` is protected because the names of the
missing pieces describe the deployment, and listing them here would move that report to an
unauthenticated URL.

**Two controls survived their first form**, both the same shape — an assertion satisfied by the
fixture rather than the code. The bound was timed against a dead address, and every unreachable
address available here is refused in under 25ms, so a deadline stretched to ten minutes passed;
the deadline is now its own function driven by a promise that never settles. "Does not hold a
timer open" asserted only that the call resolved, and deleting the `clearTimeout` passed;
`getTimerCount` is the observable.

## Cycle 14 — a health check that hangs instead of answering

Found in cycle 13's own code, after watching it answer `200` on the deployed preview. The handler
had become `async`, and **Express 4 does not catch a rejected promise from a handler** — it
neither responds nor errors, so the request hangs until the platform kills it. Reproduced: a store
whose `isAvailable` rejects held the request for the full 4s client timeout and leaked an
unhandled rejection.

A hung health check is worse than a red one. A monitor reads a timeout as *"the whole deployment
is gone"* and pages for the wrong thing, which is the same class of error as cycle 13 — a signal
that means something other than what it says. Every path now ends in a response.

**Verified on the deployed preview, not inferred from a green build**: `/api/health` on
`lichessapp-git-claude-mati-user-exper-c09c92` answers `{"ok":true}` at 200 through Express. That
proves the entry loads and the new handler runs. It deliberately cannot distinguish "no database
configured" from "database reachable" — that is the privacy property, and it is stated here rather
than papered over with a stronger claim than the route can support.

## Cycle 15 — the fallback that could now run backwards

A failure mode **this branch introduced**, found by re-reading cycle 13's own diff. Until
`isAvailable()` measured a live connection it read an environment variable, and an environment
variable does not change while somebody is playing — so `useRecordMode` could not flip
mid-session. Now it can. `storageAvailable` has `retry: false` and react-query's
`refetchOnReconnect` default is **on**, so the probe re-runs exactly when the network has just
been flaky and one failed attempt decides it.

The flip switches every read hook — claim, reading, count, learning rules — in a single render,
and the player watches their record shrink to whatever this browser holds. The next commit lands
in localStorage while the earlier ones sit on the server: one record, two stores, nothing said.

R2 already covers the shape of this — *"a record that could not be READ must not render as a
record with nothing in it"* — and rendering it as a **different, smaller** record is the same
violation with a worse ending, because this one also accepts writes.

**So the fallback is directional.** Starting local and staying local is the product working as
designed and had to keep working; a deployment with no database is supported. Starting on the
server and silently landing local is data loss dressed as graceful degradation. Once the server
has held this account's record in this session, losing it is `server-lost`: the record stays
pointed at the server, the commit fails visibly, and the notice says the browser record is a
different record that does not contain what was already written — rather than reassuring anyone
that their decisions are being kept here.

Latched per **account**, not per browser: the next person at this keyboard has no server record to
lose and belongs on the local path. Six positive controls red, including the two directions that
matter — restoring the silent fallback, and a latch greedy enough to catch the cold start and
break the local path.

## Cycle 16 — the instrument held itself to two standards on two screens

`findPatterns` will not report a bucket as a finding until its gap sits `SEPARABILITY_K = 3.75`
standard errors from the rest of the record. That bar is the whole reason `CalibrationSummary`
carries `gapVariance`. The dashboard then printed `inside.accuracyRate - population.accuracy` as a
signed figure, with **no standard error anywhere in its path and no bar to clear**, in the second
person: *"+14 נק׳ מול כולם"*.

**Measured, not argued.** Simulating a player whose true accuracy EQUALS the population's, drawing
`MIN_BUCKET_N` decisions against the real published baselines, 20,000 trials, deterministic seed:

| n | shows a figure | ≥5 points | ≥10 points | clears K=3.75 |
| --- | --- | --- | --- | --- |
| 30 | **100%** | 71% | **25%** | 0.22% |
| 50 | 100% | 55% | 13% | 0.11% |
| 100 | 92% | 34% | 4% | 0.03% |
| 300 | 85% | 10% | 0.1% | 0.04% |

One exactly-average player in four was told they were ten or more points from everyone, at the
floor the product itself set.

`populationSeparation` now carries the difference **with its error**, using the detector's own
multiplier — reused rather than invented, because both comparisons run across the same six splits
and a fresh constant here would be a threshold chosen to make this screen produce a number. Both
rates stay on screen; what goes is the assertion that the player *differs*, which is the only part
that needed 30 decisions to carry it.

Agresti-Coull rather than `sqrt(p(1-p)/n)`: a player accurate on all 30 has `p(1-p) = 0`, so the
textbook estimator makes the bar **loudest where the sample says least**.

**The browser caught a regression a minute after it was introduced.** The new sentence inherited
`white-space: nowrap` from `.bucket-versus` — correct for a four-word figure, wrong for a sentence
— and laid 456px of text inside a 292px box, pushing the document to 525px at a 390px viewport
while collapsing the scope label to 0px across 12 lines. That is the same collapse
`bucket-row.layout.test.tsx` was written for, reached by a different route. jsdom reported every
box as 0x0 and the other 1,165 tests said nothing.

**One control survived its first form.** "Keeps a degenerate record from reading as infinite
precision" asserted `standardError > 0`, and restoring the textbook estimator passed it — the
population's own term keeps the sum above zero, so the assertion was satisfied by the side of the
comparison it was not about. It now asserts the outcome: five points from 30 decisions must not be
reported as a difference.

## Cycle 17 — the same defect in the neighbouring cell, twice over

Found by asking what else on the panel asserts without an error. `effortFollowsDoubt` gated on
`n >= MIN_BUCKET_N` and two degeneracy checks, then the dashboard printed `rho.toFixed(2)` under
the label *"מאמץ שהולך אחרי הספק"* — a claim about how somebody allocates their attention.

**Measured.** A player whose time is drawn INDEPENDENTLY of their confidence — no association at
all, by construction — 20,000 records, deterministic seed:

| n | shows a figure | ¦ρ¦ ≥ 0.20 | ¦ρ¦ ≥ 0.30 |
| --- | --- | --- | --- |
| 30 | **100%** | 29% | **11%** |
| 60 | 100% | 12% | 2% |
| 150 | 100% | 2% | 0% |

One player in nine with nothing whatsoever to find was handed *"−0.31"*. `Control` now carries
Fisher's z error (`1/sqrt(n-3)`, the standard remedy for a statistic that is skewed and bounded at
±1) and clears the detector's own multiplier — reused, again, so the panel does not hold itself to
two standards one cell apart. `atanh` is clamped: a perfectly monotone record gives ρ = 1 exactly,
and `atanh(1)` is Infinity, which clears any bar there is.

**The second defect in the same cell, and the worse one.** `Control.reason` was computed with four
distinct values — `ok`, `too-few`, `flat-time`, `flat-confidence` — and the dashboard rendered a
bare `—` for every one of them. **The reason reached no screen at all.** The distinction was built
in the shared code and thrown away at the last step.

It is not cosmetic, because two of the four are not waits: a player who took the same time over
every decision cannot fix that cell by playing more, and a player with twelve decisions can.
Telling both of them nothing tells the first to keep going, silently and wrongly — the same shape
as cycle 11's refusal reported as a missing database, one panel over. Five causes now, five
sentences, and the new one says explicitly that the association **was** measured.

## Cycle 18 — the sweep, finished

Ran the pattern from cycles 16–17 as a mechanical audit: every discriminated field the shared code
computes, checked for whether it reaches a screen and whether it carries its error.

| module | reaches a screen | carries its error |
| --- | --- | --- |
| `import-diagnostic` | yes, every member | n/a |
| `prereg` | yes, every member | n/a |
| `stability` | yes | **yes, already** — `standardError` and `spread` |
| `control` | **no** → cycle 17 | **no** → cycle 17 |
| `sensitivity` | **no** → this cycle | **no** → this cycle |
| `record-dashboard` buckets | yes | **no** → cycle 16 |

`metacognitiveSensitivity` gated on `accurate.length >= MIN_BUCKET_N && inaccurate.length >=
MIN_BUCKET_N` and printed `auroc2.toFixed(2)`. The panel puts two things beside that figure: the
sentence *"0.5 זה מקריות"*, which invites a comparison against chance, and the middle 80% of
matched people, which invites a placement inside it.

**Measured.** Confidence drawn INDEPENDENTLY of the outcome — true area exactly 0.5:

| per class | shows a figure | ≥0.05 from chance | ≥0.10 from chance |
| --- | --- | --- | --- |
| 30 | **100%** | 52% | **18%** |
| 60 | 100% | 34% | 6% |
| 150 | 100% | 14% | 0.3% |

Hanley–McNeil rather than a binomial error, because this is a rank statistic over PAIRS whose
precision is governed by the smaller class: 200 accurate decisions beside 30 inaccurate ones is
not the precision of 115 and 115. Five reasons now reach the screen, and `too-few-inaccurate` says
what it actually means — *harder positions, not more of the same*.

**An existing fixture caught a defect in the fix, and was right to.** Hanley–McNeil's variance is
exactly ZERO at an area of 1, so the first version returned null there and reported perfect
separation — thirty confident hits against thirty diffident misses, the strongest evidence the
statistic can produce — as no evidence at all. The area is now clamped one pair off the boundary:
not a chosen epsilon but the granularity of the statistic itself, since over `n1·n2` pairs the
area can only move in steps of `1/(n1·n2)`.

**A consequence worth stating rather than burying.** Reusing `SEPARABILITY_K = 3.75` across the
whole panel means that at the `MIN_BUCKET_N` floor these cells will usually be silent — the
population comparison needs roughly a 34-point gap, the control coefficient roughly ρ = 0.62, the
discrimination roughly 0.78. That is the correct answer where the alternative was noise, and the
panel will look emptier on a short record than it did. It now says why, per cell, in five
sentences instead of one dash.

## Cycle 19 — the record came back in the error

Reproduced against a real MariaDB before anything was written. Make a record write fail:
drizzle-orm raises `Failed query: insert into decisions (...)` and **appends the bound values to
the message**; the error also carries them on `params`. `toTrpc` rethrew anything that was not a
`RecordError`, there was no `errorFormatter`, and tRPC's default shape puts `message` on the wire.

```
MESSAGE contains private: true
PARAMS  contains private: true
WIRE    contains private: true
```

The value that comes back is `stated_unknown` — what a player writes about what they did not
understand, before anybody tells them the answer. Only the owner can reach these procedures, so
this is not a cross-account leak; it is worse in a different direction. A 500 body travels into
browser devtools, into the platform's function logs, and into anything on the response path.

**The same defect twice.** The adversarial review found this exact shape once, on
`completeLearningTransfer`, and it was fixed **there**. The class was declared closed with one
procedure fixed and was live on every record procedure that writes — the pattern that review named.
So the fix is the **error formatter**, not the router: there is no procedure left to forget.

**Sanitising `message` was not enough, and the HTTP test proved it.** tRPC's default shape puts
`data.stack` in every non-production build and a drizzle stack BEGINS with the drizzle message.
The body still carried the sentence with the message already clean. The shape's `data` is now
rebuilt from named fields rather than spread.

**A regression this fix nearly introduced.** The first version replaced every unauthored message,
which included a `BAD_REQUEST` carrying a `ZodError` — telling a client that sent the wrong shape
that the server had broken. That is this cycle's own defect pointed the other way. A malformed
request now names its **field paths**; measured, zod v4 does not echo rejected values, so that
narrowing is a contract against a `.refine` that interpolates one, not a live fix, and it says so.

**Two controls survived their first form.** The end-to-end HTTP test posted anonymously to a
procedure behind `ownerProcedure`, so deleting the formatter entirely passed it — the request was
refused at the gate and the store was never reached. It now signs a real owner session, sends an
input that matches `commitEventSchema`, and carries **a vacuity guard that fails if the store was
not called**. The second: nothing asserted that field paths beat zod's own text, so a control
swapping them passed.

## Cycle 20 — a deployment that cannot say what is wrong with it

`system.lichessConfig` is the only place this product names which server-side pieces are absent,
and it is a `protectedProcedure` — correctly, since those names describe the deployment. Reaching
it needs a session. Creating a session needs `JWT_SECRET`. **So on a deployment missing
`JWT_SECRET`, the report that would say `JWT_SECRET` is missing is the one thing unreachable.**
What the operator sees is a sign-in button that appears to do nothing, `/api/health` answering
200, and the variable named nowhere.

**Combinations, not presence.** Five booleans were already available; that is not what was
missing. What no single flag can show is that a SET is incoherent — an owner who can never sign
in, a database no account can ever reach. Every variable is present or absent exactly as intended
and the deployment still cannot work.

Three faults, each naming what the deployment **cannot do** rather than restating which name is
absent: `owner-without-session`, `session-without-oauth`, `database-without-owner`.

**An empty deployment is not a fault**, and that is the load-bearing part. Nothing configured is
the supported browser-local product running as designed. A report that fires on it is a report an
operator learns to skip, and then it is worth less than none — which is why the
database-without-owner rule requires a deployment otherwise configured for sign-in.

**The channel is the server log.** Naming variables on a public route would move the private
report onto the open internet — the same reasoning that keeps `/api/health` to one boolean. Names
only, never values: a secret in a log is still a secret.

Five controls red, including the one that matters most for this session's recurring pattern — the
faults computed and never logged, which is a distinction discarded at the last step, found twice
already in cycles 17 and 18.

## Cycle 19 addendum — verified on the deployed preview

`/api/trpc/record.count` unauthenticated on the live preview returns the authored sentence and
`data` holding exactly `code`, `httpStatus`, `path`. **No `stack`.** The rebuild is running in a
real deployment, not inferred from a green build.

## Architecture, stated rather than scored up

`Home.tsx` is 1,764 lines with 71 hooks, and the line count is a **symptom**. The actual coupling
is that `onCommit` serves three decision modes — ordinary, drill, transfer — in one callback, so
extracting the transfer state moves `useState` declarations out while leaving the callback
reaching back in: more indirection, identical coupling. A clean split is a design change to how
the commit path handles modes, not a tidy-up, and it is the kind of change that can quietly undo
correctness work. Left open deliberately, with the reason recorded, rather than closed cosmetically
and scored as an improvement.

## Cycle 21 — one record, one person, declared and enforced

Single-tenancy was already true and lived in one comment inside the gate. It is now a declaration
the schema is checked against: no owner column on any record table, no `protectedProcedure` in the
record router, and the table list verified against the schema so it cannot fall behind a migration.

The point is not the rule but where it puts the decision. A record table that gained a `user_id`
would make the deployment one that **stores** several people's records while still admitting one —
and with no owner predicate on any query, the second person's rows would be served to the first.
Going multi-tenant stays entirely possible; it just has to break that file first.

The vacuity guard caught a defect **in itself**: `mysqlTable\("([a-z_]+)"` misses two tables whose
name sits on the next line, and `length > 10` passed happily on the other eleven.

## Cycle 22 — the phase split, checked outside this repository

The product's baseline says the **endgame is the easiest phase of the game**. On 4,416,361 Lichess
puzzle positions carrying a Glicko rating from real human solve attempts, humans find the endgame
*harder* than the opening — while agreeing that the middlegame is hardest, which is the product's
headline claim and survives.

And the figure that matters more than either ordering: **η² = 0.0035**. The phase label explains a
third of one percent of the variance in human difficulty, at three filter levels, with the
best-measured items giving the smallest value.

The screen now says the split is a property of the accuracy rule rather than a measure of
difficulty. The ordering comparison stays in `docs/RESEARCH_EVIDENCE.md` with its caveat, because
it compares two corpora measuring different constructs — and a test asserts the render path never
pairs them.

**GATE-DENOM went red on the fix**, which is the product's own R1 catching its author: the caveat
built a percentage by hand. Wrapping it in `<Value>` did not satisfy the gate either — the
exemption is per file, so the formatting itself had to move into `Value.tsx`. `SmallProportion`
does not round 0.0035 to `0%`, which would read as *not measured* rather than *measured, and
nearly nothing*.

**Maia was the first choice and is unreachable** — 403 through this environment's proxy. Per-item
difficulty stays unmeasured and is recorded as unmeasured, rather than replaced with an
engine-derived proxy that would assert sharpness as difficulty.

**The generator was nine minutes of solid CPU before it was twenty seconds.** Four `indexOf` scans
per row over six million rows, and an `sd` recomputing its own mean per element. A generator
nobody can bear to re-run is a generator whose output stops being checkable.

## Cycles 23–26 — the road not taken

Two features the operator asked for, built as one measurement: a question asked at random times
during play — *"if you hadn't done that, what would you have done?"* — and a game against the app
that the engine does not narrate.

### What is actually new, in one sentence

Every facet this product measured until now reads the move that WAS played. de Groot (1946),
replicated by Connors, Burns & Campitelli (2011), is that masters do not search deeper or wider —
they **select better candidates**. The alternative a player names, priced by the engine, is a
reading on the half the accuracy rate cannot see, and `reachable` (chosen inaccurate, alternative
accurate) is the Einstellung signature Bilalić, McLeod & Gobet needed an eye tracker for in 2013.

### The design decisions, and what each one prevents

| decision | what it prevents |
| --- | --- |
| The arm rides on **every** decision | A treatment group with no control group and therefore no denominator |
| `ineligible` is a third value | A control group that is a mixture of *not drawn* and *never askable* — a comparison of position types wearing an experiment's clothes |
| Eligibility is definitional (≥2 legal moves), the count a covariate | A floor chosen to make the arm look cleaner, which is a threshold picked to shape a result |
| The arm is drawn at **commit**, not at entry | Any pre-commit screen ever being able to read it — at which point the comparison is about the interface |
| No skip button; "I had nothing else" is an answer | A probed arm self-selected down to the decisions where the player had an answer ready |
| The alternative is priced from the **same root search** | Two scores off different trees, the defect that once charged the engine's own best move 9cp |
| Not in the top eight lines → unscored, not "bad" | A bound reported as a measurement |
| The reveal timing is stored on every decision | Pooling a coached game with an unnarrated one into a single calibration figure |

### The fourth state, twice

Both new fields are nullable, and in both cases null is **not** the majority value it looks like.
Decisions written before the probe existed were never randomised into anything; decisions written
before the deferred game existed were all made in the coached loop. Backfilling either would
assert that somebody recorded a condition when nobody did — and the first comparison between
groups would then show a control arm that is enormous and perfectly measured.

### The step that mattered most, and why

`ccf6e81` reads the four readings back onto a screen. Everything before it is collection, and a
probe nobody can read back **is this ledger's recurring finding with the expensive half already
paid for** — a distinction measured and discarded before display, found nine times in cycles
13–22.

Three denominators a single "probed" number would fuse — asked, answered, scored — are kept apart
on screen, because dividing the readings by *asked* divides by decisions that never produced one.

**The negative control is on the screen, not kept for a maintainer.** The arm is drawn after the
decision is complete, so being asked cannot have changed the decision it is attached to; there is
no causal path. A player reading their own numbers is entitled to know which comparison is the one
supposed to come out empty, or a chance difference reads as a finding.

### What the tests caught, that the author did not

- **The layout test passed on a fixture, not on the CSS.** It measured the panel at full viewport
  width, so `nowrap` on the question, `nowrap` on the actions row and zero-padding buttons all
  passed. The app gives this panel a **330px** column.
- **And two of those three still cannot go red at 330px.** Measured with the longest label the
  panel can produce: wrapped, buttons are 291px holding 289px of content; unwrapped, 141px holding
  139px. Both have slack. The assertion written to catch them was **deleted rather than kept**,
  with the numbers recorded in the file — an assertion no mutation can redden is not evidence, and
  keeping it claims a protection the panel does not have.
- **The reporting panel broke R1 in the line that matters most.** `ArmRate` rendered a rate
  unconditionally, so three probed decisions printed `0% (0/3)` inside the sentence asking the
  reader to compare two numbers and judge whether they match. A reader comparing 0% against "no
  data" would conclude the randomisation was broken.
- **The stale-closure test caught two hooks** reading the reveal timing without depending on it —
  the exact class it was written for after it fabricated a transfer observation.
- **The type-scale test caught two invented font sizes**, against a document scale of seven named
  steps that exists because forty components each picking their own once produced twenty-three.
- **A service guard caught its own test's fixture**, which marked a twenty-legal-move opening
  position `ineligible`.
- **`recordCounterfactual` and `scoreCounterfactual` on `DrizzleRecordStore` had run zero times.**
  Found by checking this PR's own "0 skipped" claim rather than repeating it. The most valuable of
  the nine new database cases is `listAtoms`: `getAtom` and `listAtoms` are separate read paths and
  only the second feeds the dashboard, so a probe arriving through one and not the other would
  leave every screen empty while every single-decision test passed.

### The cost, stated

Four readings need `MIN_BUCKET_N = 30` **scored** answers. At one question in five that is a lot
of decisions, and the panel counts down to it rather than implying a reading exists. `Home.tsx`
grew; `runReveal` was extracted from `onCommit` so the engine half has a second caller, which is a
real decoupling, and the remaining coupling stays recorded rather than scored as an improvement.

## Cycles 27–28 — one weakness, told three times

The operator asked to cross the criteria instead of reading each on its own. Measuring the cost of
crossing turned up a defect in what was already there, and the crossing turned out to need the
same repair.

### The finding, measured before anything was changed

Four hundred simulated players with **exactly one** weakness — overconfident in the middlegame,
perfectly calibrated everywhere else — 240 decisions each, seeded:

| | |
| --- | --- |
| `phase-middlegame` fires | 85.5% — correct |
| `phase-opening` fires | **19.5%**, on a phase where nothing is wrong |
| `phase-endgame` fires | 17.8%, likewise |
| told they have more than one pattern | **35.0%** (43.0% once middlegame moves are quicker) |

**Arithmetic, not chance.** Each bucket is measured against "the rest", and the rest contains the
weakness. Of the 78 times `phase-opening` fired, it fired as underconfident **78 times out of 78**
— the product telling a player to trust themselves more in a phase they are already calibrated in.

A higher bar cannot fix it: the mirror and the real finding are one measurement seen from two
sides. The fix is to stop asking one question three times.

**What survived.** Candidates are ordered by support and the screen leads on the first, so the
headline was right on 85.5% and wrong on 0.8%. The defect is in the count and the secondary
claims, not the headline, and the ledger says so rather than inflating it.

### The crossing, and what it costs

On perfectly calibrated players, 500 runs per size:

| | marginal only | with every phase × time crossing |
| --- | --- | --- |
| n = 120 | 0.6% | **0.0%** |
| n = 240 | 0.4% | **0.0%** |
| n = 480 | 0.2% | **0.0%** |

Free in false positives — because `MIN_BUCKET_N` on **both** sides means an untrustworthy cell is
never tested. The cost is silence: cells measurable at all run 0.1% → 17.1% → 65.1% across those
sizes, so a profile needs roughly five hundred decisions before most of it can be read. The
fraction is printed rather than hidden.

And the crossing inherited the same defect: on a player weak only in fast middlegame positions the
real cell separated 200/200 runs, its mirror 35, four other cells 24 between them. One finding per
variable pair, same as one finding per variable.

### What was recorded rather than asserted

Three mutations survived their first form and only one became a test.

- **Real:** taking the first cleared cell instead of the strongest passed, because the first pair
  the list reaches was also the answer. A fixture with the weakness late in the bucket order
  reddens it.
- **Unreddenable by construction:** a crossed cell is an AND of two predicates, so it cannot exceed
  either, so `outside` cannot fall under the floor. The check is a guard against a future variable
  and the test says so — the second time this ledger records deleting an assertion instead of
  keeping one no mutation can break.
- **Honest about a rule I argued for:** distance-over-size ranking bought eleven points marginally
  and 100.0% against 98.0% crossed. Kept for consistency with the marginal collapse, with a note so
  consistency is not later read as measured superiority.

**Two errors of mine, both caught by tests.** The first fixture could not tell the two ranking rules
apart. Building one that could then failed an assertion I had written as "the mirror never leads" —
it leads on about 1%, because a mirror estimated from twice as many decisions can sit further out
in standard errors than the real effect. And a third rule I proposed as *the* fix — each level's own
gap against the median of the others — measured 89.0%, no better than what it replaced. All three
are written down so none is re-proposed.

### Two silences that are not the same state

Too few decisions improves with play; a record with no clock can never fill a clock cell. Telling
somebody "6 of 11 readable" when five of the missing are structurally impossible sends them toward
something unreachable. The counts are held apart on screen.

## Scores this cycle

Evidence-backed, against the state at `03d8f96`. A score does not rise because more code exists.

| category | base | now | what moved it |
| --- | --- | --- | --- |
| Security, privacy, isolation | 2 | **8.5** | Two cross-account leaks closed, each reproduced first; a refusal reaches the screen as a refusal; the record no longer comes back in a 500 body or a stack. Not 9+: single-tenancy is now declared and enforced from both ends rather than open, but it remains a gate rather than per-tenant scoping — the right design for one person, and the thing that would have to change for more |
| Scientific / construct validity | 4 | **8.5** | `banana` closed; self-report removed on published evidence; the verdict scoped to what three positions carry; the population comparison, the control coefficient and the discrimination area now each carry their own error and clear the detector's bar before being asserted -- a mechanical sweep of every field, not three spot fixes. the phase split checked against 4.4M human-rated positions and its caveat put on screen. the six marginal buckets read as three variables, so one weakness is reported once instead of up to three times with one of them inverted; variables crossed, with the false-positive cost measured at 0.0% and the readability cost printed. Not higher: positions still are not selected for the trigger, and per-item difficulty is unmeasured because Maia is unreachable |
| Functional correctness | 6 | **8.5** | Degenerate question, bidi sign, null-due, FEN novelty, invalid nesting, a dependency list that would fabricate an observation, a fallback that could run backwards — each with a reproduction |
| Test quality and CI | 8 | **9.5** | 1,373 tests, **0 skipped** (was 5); a real database and a real browser locally and in CI; ~110 positive controls red. Two regex-over-source assertions replaced by things that run — and **three** claims deleted or downgraded because no mutation could redden them: a panel width measured to have slack under every setting, a crossed-cell `outside` floor that cannot bind by construction, and a ranking rule kept for consistency rather than a measured edge |
| Architecture / maintainability | 5 | **6** | Store contract extended cleanly; the shared modules each own their own error and their own reasons. `Home.tsx` is 1,764 lines and stays there: the coupling is `onCommit` serving three decision modes, not the line count, and that is a design decision rather than a cleanup |
| UX, accessibility, recovery | 6 | **9** | Collapsed label, sign on the wrong side, invalid nesting, `aria-pressed` announcing unmade answers; six storage situations that shared two sentences now have six; four reasons an empty cell is empty that shared one dash now have five |
| Performance and bundle | 5 | **7** | Explicit budgets, wired into verify and CI, proven to fail |
| Operations / deployability | 4 | **8** | `scripts/dev-db.sh`; a health check that measures health, returns 503 for a configured-but-unreachable database, cannot hang, and leaks no deployment detail; server-side error logging that keeps the parameterized statement and drops the values; incoherent configurations named at startup, by variable and never by value. Not higher: no incident runbook, and the record loop itself is still exercised only locally. Third-party error tracking is deliberately absent — shipping this record to a vendor would break the claim the product makes about it |
| Documentation / DX | 7 | **8** | This ledger, `RESEARCH_EVIDENCE.md`, a reproducible database |
| Differentiation / user value | 8 | **8.5** | Cycles 13–22 were unchanged by design — they made existing claims true rather than adding new ones. Cycles 23–26 add one: the counterfactual probe reads candidate SELECTION, the half of expertise the accuracy rate cannot see. Not higher until it has n behind it: four readings need 30 scored answers, and the panel currently counts down to that rather than reporting anything |

## Open, by severity

| # | finding | severity | state |
| --- | --- | --- | --- |
| 2b | Candidate positions chosen for being unseen, never for the rule's trigger applying | **High** | open. Motif retrieval is validated on lichess data (Bizjak & Guid 2021) but **48% top-1** — it may *propose* and must never assert |
| — | Three positions is below every single-case standard consulted; no control positions | **High** | open, and now **stated on screen** rather than silently assumed |
| — | Multi-user separation: `user_id` on 12 tables, every query, index and cache key | High | **product decision for the operator**, not a defect fix |
| 7 | `Home.tsx` past 1,900 lines, `index.css` past 3,800 | Low | open. `runReveal` was extracted from `onCommit` in cycle 25 — a real decoupling, since the counterfactual probe needed a second caller for the engine half — and the file still grew. The coupling that matters is `onCommit` serving three decision modes plus a probe stage |
| — | Incident runbook | Low | open. Health checks (13–14), error handling (19) and startup configuration faults (20) are closed. Third-party error tracking is deliberately absent: shipping this record to a vendor would break the claim the product makes about it |
| — | Production deployment tested directly rather than inferred from a green build | Medium | partly closed: `/api/health` fetched on the live preview (cycle 14). The record loop itself is still only exercised locally |
| — | Every construct PR #24 added, audited as *metric* vs *product inference* | — | partially done in `docs/MEASUREMENTS.md` §4b–4d |
| — | The counterfactual probe has no n yet | **Medium** | open by construction. Four readings need 30 scored answers; the panel counts down rather than reporting. The randomisation check on screen is the negative control that must stay empty |
| — | The crossed profile needs ~480 decisions before most of it is readable | **Medium** | open by construction, and measured: 0.1% of cells readable at n=120, 17.1% at 240, 65.1% at 480. The fraction is on screen so the silence has a size |
| — | The variable collapse is a READING, not a change to the claims the record stores | Low | deliberate. `BUCKETINGS` keeps every key because stored claims and preregistered hypotheses name them and `onlyBucketKey` throws on an unknown one. A claim derived from a mirrored level can therefore still be stored; the panel now says it is a consequence, but the claim path is untouched |
| — | Whether the confidence rating should be sampled rather than asked every move | **Medium** | open, and it is the operator's call. Raised because the burden is real; sampling it on the same two-arm logic would keep Brier, Murphy, AUROC2 and the calibration curve while halving the interruptions, at the cost of multiplying time-to-first-reading by 1/p |
