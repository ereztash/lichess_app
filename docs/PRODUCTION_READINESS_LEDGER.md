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

## Cycles 29–30 — the wiring, twice

Both of these are the same shape, and it is not the shape the rest of this ledger records. Cycles
13–22 were about measurements that were wrong. These two were about measurements that were **right
in isolation and wrong where they were plugged in** — which is the third time in this PR, after the
counterfactual probe sat collecting for three commits with nothing reading it back.

### Cycle 29 — the stored claim named a phase the player was fine in

Graded **Low** in this ledger on the strength of reasoning, then measured. The severity was wrong.

`selectClaim` took `patterns[0]`, and `detect` sorts by support. Among levels of one variable that
names whichever level the record happens to contain most of. Four hundred simulated players per
condition, one weakness each:

| weakness in | claim names a phase that is FINE | after | of the wrong ones, **inverted** |
| --- | --- | --- | --- |
| endgame | **14.7%** | 1.6% | 44 of 45 |
| opening | **14.7%** | 1.0% | 44 of 46 |
| middlegame | 0.0% | 0.8% | — |

**A claim is not a panel sentence.** It is written to the record, it accumulates prospective drill
results, and it is what the player is asked to go and test. Forty-four times in forty-five the
stored claim was the mirror: a player told they were underconfident in a phase they were
calibrated in, and then offered a drill to prove it. That does not merely misinform — it spends
their decisions.

An existing test failed and was right to. `"shows the best-supported candidate and counts the rest"`
built its second candidate as `{ ...pattern, scope: "אחר" }`, which copies the KEY — so both
candidates were one bucket under two names, something `detect` cannot produce. It read as "two
candidates, show one, count one" and was really "one bucket, counted twice".

### Cycle 30 — a claim carrying one bucket's id and another bucket's statement

**Mine, ten minutes old, and worse than the defect it rode in on.** Cycle 29 changed which pattern
`selectClaim` speaks about; the caller went on building the id from the detector's own ordering:

    claim_id: patterns.length ? `claim-${patterns[0].key}` : "claim-none"

Two independent answers to one question, diverging in exactly the case cycle 29 exists to create.
`recordClaim` reads back by id before deriving, so it would find a stored claim about a **different
phase** and return it — and a prospective drill result attaches by claim id, so the one mechanism
in this product designed to be unfalsifiable-proof would have been filing evidence against the
wrong hypothesis.

**Found by reading the wiring of the fix, not by a test failing** — and `26b3be0`, the commit
carrying it, **passed CI green**. No test asserted that the id and the statement describe the same
bucket, so nothing could have caught it. That is the honest note: a green suite is evidence about
the assertions that exist, not about the code.

The fix is structural rather than coordinated. `selectClaim` derives the id from the pattern it
selected and returns the key it used, so a caller cannot compute it independently and the two
cannot diverge — rather than two places that must be kept in agreement by whoever edits next.

### What these two say about the rest of the PR

Every measurement in cycles 23–28 was built module-first and wired afterwards, and the wiring is
where three of this PR's defects came from. The pattern worth carrying forward: **after changing
what a function returns, grep every caller that derives anything from the same inputs** — an id, a
count, an ordering — because those are the places that silently keep answering the old question.

## Cycle 31 — a verdict written in a second statement

The critic's pick across six assessments, chosen for being the only *load-bearing inferred claim*:
that `finishLearningTransfer` can destroy a grade permanently. Nobody had run it. So it was run.

`finishLearningTransfer` writes the transfer result, reads the rule, writes the graded rule. Three
statements, no transaction — neither store has one, because nothing in this record had previously
needed two writes to be correct. A store subclass was made to fail the grade write once, on a rule
sitting on its **second success day**, which is what `replicated` costs here.

**Observed, not inferred:**

| after the injected failure | |
| --- | --- |
| transfer results on the record | **2** — the sitting counts |
| the rule's `last_evaluated_at` | day one — the sitting left no trace |
| what the retry returned | `grade: "hypothesis"` |
| what the record supported | `replicated` |

And the retry is what makes it permanent. That branch exists *precisely* so a lost response can be
reported again; it returned `await store.getLearningRule(...)` — the rule as stored, which is the
ungraded one. The result row exists, so `already` fires forever, and no later call would ever grade
that sitting. **The recovery path was the thing that froze the loss.**

The fix is not a transaction. `gradeLearningRule` was an accumulator: take one result, step the
rule forward from wherever it stood. It is now a **fold over every result the record holds**, run
from the rule as authored. Same record, same rule — once, five times, before the crash or after it.
The retry now grades unconditionally instead of having to know whether the first attempt got
through, and a run that dies between the two writes is repaired by the next one rather than frozen
by it. `retired` is checked before the fold and never rebuilt by it: it is an act of the player's,
not a reading of the evidence.

It is the rule this file already states one function higher up — `recall.coverage` is not stored
beside `recalled_rules` because it is derivable. **Derived beats duplicated, and here it also beats
losable.**

Three assertions, three positive controls: neutering the sort reddens order-independence alone;
folding from the stored rule instead of the authored one reddens both idempotence and the crash
recovery. The crash test was red before the fix and is the reason the fix has this shape.

**Found while fixing it, and not fixed here:** `finishDrill` has the identical shape —
`saveDrillResult` then `saveClaim`, two writes, no transaction. It is worse in one way and better
in another: there is no idempotent replay branch at all, so a retry raises `append-only: drill
already reported` rather than returning a wrong verdict quietly. The same cure does not fit, because
a claim carries its own `prospective_tests` array and the store has no `listDrillResults(claimId)`
to fold over. That is a store-contract change with a real-database test behind it, not a symmetric
ten-line edit, and pretending otherwise would have widened this commit past what was verified. Open
below.

## Cycle 32 — what the build hands on, and what travelled with it

Every other gate in this repository protects the player from a claim the record cannot support.
This one is about other people: the build **conveys** a 7.3 MB GPL-3.0 engine and nine OFL font
files to whoever loads the page, and for the whole life of the repository **nothing travelled with
them** — no licence text, no copyright line, no pointer to corresponding source. The engine's own
npm package ships `Copying.txt`; the build did not carry it.

| conveyed | licence | before | now |
| --- | --- | --- | --- |
| Stockfish 18.0.8 wasm + loader | GPL-3.0 | nothing | `/licenses/stockfish/COPYING.txt`, version pinned, source named |
| Noto Sans Hebrew, 8 files | OFL 1.1 | nothing | `/licenses/fonts/noto-sans-hebrew/OFL.txt`, copyright line intact |
| DM Mono, 1 file | OFL 1.1 | nothing | `/licenses/fonts/dm-mono/OFL.txt`, copyright line intact |

Both OFL texts were **fetched from the upstream projects** rather than written out: a licence is a
legal text and reproducing one from memory is worse than not shipping it. Each family gets its own
verbatim copy, copyright header included, rather than one shared body — the notice is part of what
the licence asks to be preserved.

`THIRD_PARTY_NOTICES.md` serves the person who clones the repository. **It does nothing for the
person who loads the page, and they are the one the licences are about**, so the licence texts are
static files and the front door links to each of them. Three assertions on that footer, two
positive controls: rename a licence file out from under a link and the "points at a file that
exists" assertion goes red on its own; drop a `lang` and only the Latin-script assertion goes red.

**GATE-NOTICE (L1)** is the tenth gate. The conveyed set is read from the tree — the installed
engine version, the font families derived from the filenames in `client/public/fonts` — because a
hardcoded list is precisely what stops noticing when a tenth font arrives. It fails on three
things: a component the notices file never names, a version that has moved on without the notice
(a stale version points at corresponding source that is not the source of what was received, which
is the one thing GPL-3.0 §6 exists for), and a licence path that does not resolve. Its control
feeds the same predicate an undeclared typeface and a wrong version, and goes red on both.

**Two things this cycle deliberately does NOT do.**

It does not pick a licence for the project. There is no `LICENSE` file, so by copyright default the
application's own code is all rights reserved — which sits badly beside a GPL-3.0 engine in the
same build. Whether that combination makes the application a work that must itself be offered under
the GPL is a question about how the two programs are combined, and reasonable readings differ on
message-passing to a separate program. It is the owner's decision with advice this repository
cannot substitute for, it is written down as such in both `THIRD_PARTY_NOTICES.md` and the README,
and **nothing above depends on how it is answered** — conveying the licence and the source is
required either way.

It does not claim the existing build checks are licence separation. GATE-COMMIT proves the engine
is absent from the initial import graph and the bundle budget fails if `index.html` preloads it,
but both were written for R3 — the engine must not speak before a decision is recorded. They are
evidence about how the two programs are combined, not a finding that the combination is settled,
and the notices file says so in those words. A first draft of it claimed the budget check "asserts
that separation as a build constraint", which is not what that script does.

## Cycle 33 — the reported finding was eight times the real one

A WCAG 2.2 AA assessment reported **"26+ `dir="ltr"` islands with no `lang`"** as a Level AA
failure of SC 3.1.2. Thirty-five islands exist and thirty-two carried no `lang`, so the count was
right. Read one at a time, **almost all of them are exempt, and adding `lang` would have been
wrong**:

| island | content | why SC 3.1.2 exempts it |
| --- | --- | --- |
| `pv-line`, `reveal-pv`, `moves-rail`, `moment-move`, the candidate list | SAN — `Nf3`, `exd5` | technical terms |
| three `chart-frame`s | recharts ticks, which are numbers | indeterminate |
| `avgCPL`, `moment-cpl`, `not-found-code`, `"7 / 9"`, `<time>` | numerals | indeterminate |
| `import-players`, `provenance.username` | Lichess handles | proper names |
| `OWNER_OPEN_ID`, the blocking list, the PGN box | identifiers and notation | technical terms |
| `<pre>{stack}</pre>`, `<code>{error.detail}</code>` | a stack trace, a server detail | technical, and the element says so |
| `timeline-controls`, `board-grid`, `confidence-row` | layout, Hebrew labels | no foreign text at all |

**Four had actual English words**, and only those were changed: `placeholder="lichess username"`,
`placeholder="username"`, and the Lichess speed name — `bullet`, `blitz`, `rapid`, `classical` —
rendered raw from the API in two components. A scan of every user-visible Latin-script attribute in
`client/src` found exactly two, which is the whole population; the codebase was already disciplined
about this.

`lang="en"` on `Nf3` is a **false statement about the content**. Declaring a language for strings
that have none is the accessibility form of the thing this product exists not to do, so the
exemptions are asserted as a test of their own: if a later sweep decides every `dir="ltr"` needs a
`lang`, that test goes red on purpose.

SC 3.1.1 — Language of Page, and the Level **A** one — was checked first and already passes:
`<html lang="he" dir="rtl">`.

The durable half is a source scan, not the four edits. It walks every `.tsx` under `client/src` and
fails on any Latin-script placeholder whose element declares no language, so the next one anybody
adds is caught wherever it is added. It carries its own denominator — a second assertion pins the
two placeholders it finds, because a scan whose regex has quietly stopped matching passes just as
green as one that found nothing wrong.

## Cycle 34 — a policy that was measured rather than written

The deployment sent **no security headers of any kind**, and `SameSite=None` on the session cookie.
Every item below except the last is a default somebody else was choosing; the cookie is the one
that was chosen here, and it switched off the only CSRF defence in the codebase — there is no CSRF
token anywhere, and every mutation is owner-gated by a check that a cross-site request passes
because it carries the owner's own cookie. Nothing needed `None`: the single cross-site entry is
the OAuth provider's redirect, a top-level GET, which `Lax` allows. It also fixed a second thing
quietly — browsers reject `SameSite=None` without `Secure`, so on a local http deployment the
session cookie was being dropped rather than stored.

**The CSP was measured, not written.** `dist/public` is served under a candidate policy, both
routes load in a real Chromium, and every `securitypolicyviolation` is collected. Two things came
out that no amount of reading would have produced:

| found by loading the page | what it was |
| --- | --- |
| `script-src <- eval` on **both** routes, at load | Zod 4 JIT-compiles its parsers and probes for permission with `new Function("")`. It handles the refusal and falls back, so nothing was broken — but the page reached for `new Function` on every load, and every load reported a violation |
| the engine never reaches `uciok` under `script-src 'self'` | `WebAssembly.instantiateStreaming` is refused. `'wasm-unsafe-eval'` is enough; the browser's own error message names `'unsafe-eval'`, which would re-open eval to the whole page |

The Zod fix took **three attempts, and the re-measurement is what caught each miss.**
`config({ jitless: true })` in the entry body did nothing — the violation kept firing. Importing
from `zod/v4/core` rather than `zod` did nothing. The reason is evaluation order: the JIT decision
is memoised on first parse, which happens while `@shared/const` and the tRPC client are being
imported, before any statement in `main.tsx` runs. It now lives in `client/src/zod-jitless.ts` as
the first import, and the positive control for that is moving the import to last — which reddens
both routes.

The style directives were measured the same way, by setting a style attribute and inserting a
`<style>` element under each candidate: `default-src 'self'` blocks both, `style-src-attr
'unsafe-inline'` allows the attribute only, `style-src 'unsafe-inline'` allows both. React's
`style={{}}` needs the attribute, so the policy grants `style-src 'self' 'unsafe-inline'` for
browsers that stop there and withdraws the element half with `style-src-elem 'self'` for browsers
that understand it.

**The test reads the policy out of `vercel.json`.** A copy of the string in the test could pass
while production failed. And the engine is constructed in the test rather than reached through the
UI: it loads only on a reveal, so a page-load sweep would have reported a clean policy and the
first player to ask for an evaluation would have met a dead worker.

That test needs a build, and `npm test` ran before `npm run build`. **`verify` and the CI job now
build first** — a CSP test that quietly did not run is exactly how a policy that breaks the engine
reaches production.

Also this cycle, each with its own control:

- `npm install --no-audit` → **`npm ci`**. `install` may resolve to something the lock file does
  not name, which means CI could be green about a tree no developer has.
- **`npm audit --omit=dev --audit-level=high`** as a step that can fail. `--omit=dev` because a
  vulnerability in vitest is not conveyed to anybody; `high` because a step that fails on every low
  advisory gets disabled within a month. 0 vulnerabilities today. It can go red on a day nothing
  here changed, and that is the step working.
- `express.json({ limit: "10mb" })` → **1mb**. Ten megabytes was the framework's example, not a
  decision; on a serverless function it is ten megabytes of parse a caller gets to spend before a
  validator runs.
- `z.custom<ImportDiagnostic>(v => typeof v === "object" && v !== null)` accepted **an array, a
  Date, and an object of any size**. The shape stays unvalidated for the reason already written
  there — it is the client's own output, and a field-by-field schema would restate this codebase —
  but the size is now bounded at 64 KiB, which is a property of the storage this layer owns. A
  cyclic object refuses rather than throwing: a thrown validator is a 500 where a refusal was the
  honest answer.

## Cycle 35 — what moves under the cursor after the page is painted, and one of them was mine

CLS is invisible to every other test here. jsdom reports no boxes, and a green build says nothing
about whether the thing you were about to click stayed where it was. So it is measured: the built
app, served, loaded in Chromium behind a `layout-shift` observer, at a phone width and a desktop
width.

| | before | after |
| --- | --- | --- |
| `/play` at 1280 | 0.06584 | **0.00000** |
| `/play` at 390 | 0.067 (timing-dependent) | **0.00000** |
| `/` at 390 | 0.07811 | **0.00015** |
| `/` at 1280 | 0.01398 → 0.078 | **0.00006** |

`/play` was the `ContextRibbon`, which is what the assessment reported: absent while
`useClaimView` loads, then appearing above the board and dropping `section.workbench` 98 pixels
after paint. Reserving its space is honest here for a specific reason — `loopPosition` returns a
position for every one of its seven states and **cannot return null**, so the absence is purely a
loading state and the slot is certainly going to be filled. It is not a bet that there will be
something to say.

**The reserved height was derived first, and the derivation was wrong.** Computing the two rows
from the type scale gives 54px; the ribbon is 88px, because the arithmetic forgot the action row
that most positions carry. Reserving 54 for 88 left a 34px shift. The measurement is what said so,
and the reservation is now the measured 88px, with 124px below 768px where the headline wraps to
three lines. It cannot be exact and is not claimed to be: seven positions, seven sentence lengths,
two of them with no action row. The residual is bounded by the spread between positions rather
than by the ribbon's whole height.

**`/` was this branch's own doing, three commits earlier.** The licence footer added in cycle 32
is the last element on the page, and when the record layers replaced "קורא את הרשומה…" it was
pushed 289 pixels down — taking the front door from CLS 0.00015 to 0.07811 on a phone. A shift of
the *last* element is still a shift. It now renders after the record has answered, so it is
inserted at its final position rather than moved to it; an element appearing costs nothing, an
element moving does. Reserving the layers' space instead would not have been honest — their height
is the record's, and nobody knows it before it is read.

The budget is 0.02: a hundred times the 0.00015 that remains, a fifth of Google's 0.1 threshold,
and well under the 0.066 it caught. Deliberately not 0 — a threshold at the noise floor fails on a
day nothing changed, and a test that cries wolf gets deleted. Two positive controls: dropping the
reservation reddens `/play` at both widths, and ungating the footer reddens `/` at the phone width
alone.

**One existing test had to change, and its principle did not.** `knows-before-you-ask` asserted
that the ribbon renders nothing while the record loads, with the right reason: a guessed position
is worse than a blank frame. That still holds — no sentence about the player, no basis line, until
the record answers. What changed is what "blank" means: an empty reserved slot carrying the same
"reading" sentence the front door uses, rather than no element at all. Its stub restore also moved
into a `finally`, because a leak there was failing the *next* test rather than itself.

### Cycle 34's headers, confirmed on the deployment rather than inferred

`vercel.json` sets the page headers through a legacy `routes` entry with `continue: true`, which
nothing local can test. Fetched from the preview at `6b6185d` with a share bypass:

```
content-security-policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; ...
cross-origin-opener-policy: same-origin      referrer-policy: no-referrer
permissions-policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
strict-transport-security: max-age=31536000  x-content-type-options: nosniff
x-frame-options: DENY                        x-powered-by: (gone)
```

and on `/api/health`, from the Express middleware: `cache-control: no-store`,
`content-security-policy: frame-ancestors 'none'`, `cross-origin-resource-policy: same-origin`,
`referrer-policy: no-referrer`, `x-content-type-options: nosniff`, `x-frame-options: DENY`.

## Cycle 36 — the same two writes, one function over, and worse

Cycle 31 found `finishLearningTransfer` writing the evidence and the verdict in two statements with
no transaction. `finishDrill` is the same three lines — `saveDrillResult`, `getClaim`, `saveClaim`
— and it was found **by accident**, while fixing the other one. So this cycle began by asking how
many more there are (a six-angle sweep is running) and by proving this one rather than arguing it.

Injected the same way: fail the claim write once, after the result is already in.

| after the injected failure | |
| --- | --- |
| drill results on the record | **1** — the drill was run, the positions decided, the verdict computed |
| the claim's grade | `hypothesis` |
| the claim's `last_evaluated_at` | the day it was formed |
| what a retry does | **raises**, and does so forever |

**It is worse than the transfer case.** That path at least HAD an idempotent replay branch, which
returned stale state. This one had none, and `saveDrillResult` is append-only in both stores —
Memory throws `append-only: drill already reported`, MySQL violates the `drill_results` primary
key. So the retry a lost response makes inevitable did not return a wrong verdict; it returned a
500, every time, and the verdict was unreachable permanently.

**The fix needed no new store method, and my own note said it would.** The task for this cycle read
"needs `listDrillResults(claimId)` on the store contract" — a store-contract change with a
real-database test behind it. Reading the code instead of trusting the note: **both** `getClaim`
implementations already build `prospective_tests` by selecting the `drill_results` rows, rather
than from a column on the claim. The evidence to fold over was already being handed to every
caller. `evaluateClaim(claim, results)` is now a fold and `finishDrill` grades from the record on
both paths, fresh and replayed.

### Two divergences between the stores, found by running them side by side

Probed against a real MariaDB before anything was written, and neither was visible to any test —
every test in the repository except `drizzle-store.test.ts` runs against the in-memory store:

| field | what the service wrote | memory returned | MySQL returned |
| --- | --- | --- | --- |
| `claims.last_evaluated_at` | `2026-02-02T10:00:00Z` | the same | `2026-08-26T23:50:33Z` |
| `drill_results.recorded_at` | `2026-02-02T10:00:00Z` | the same | the moment the insert ran |

`ON UPDATE NOW()` and `defaultNow()`, with neither write passing a value. "When was this claim last
evaluated" was a fact about the row rather than about the drill. It matters more now that
`evaluateClaim` **orders the fold by `recorded_at`**: ordering by when a row was written and
grading by when a drill was reported are the same thing only until something is replayed. Asserted
as **agreement between the two stores**, not as one store's behaviour — an interface is not a proof,
and these two classes satisfied the same types while disagreeing about what the data meant.

While there: the database wipe in that file was not clearing `claims`, `drills` or `drill_results`,
so rows had been accumulating across every run.

### A claim I formed and then had to withdraw before writing it

The MySQL duplicate-insert error carries the bound values — the player's decision ids — in its
message, and the first version of this note said the retry put them in a 500 body. **It does not.**
`server/_core/trpc.ts`'s `errorFormatter` rebuilds the shape and replaces the message for every
error the product did not author, and it was deliberately put there rather than in a router so no
procedure could be forgotten. That fix, from an earlier cycle, already covers this path. The player
gets a generic 500 — and a verdict they can never see, which is defect enough.

### The array is a new surface, so GATE-EXTERNAL now covers it

`evaluateClaim` taking the whole result set is a new way to ask the same forbidden question. The R4
positive control gained two attempts — a list containing a pointer, and a list mixing a real result
with one — and now rejects 5 where it rejected 3. A gate that only covers the shape of the argument
the function used to take is a gate for the old function.

### A control that barely moved, which is itself a finding

The first positive control for the fold reset both the grade and the accumulated tests, and reddened
only ONE assertion. Chased rather than accepted: refutation is monotone in this data model and the
result rows are append-only, so **resetting the grade is observable only on the empty-result path**.
The mutation that discriminates is the one that reintroduces the accumulator — keeping the stored
`prospective_tests` — and that reddens idempotence directly. Recorded because a control that barely
moves is information about the assertion, not a formality to be waved through.

Full verify with the database up: **1,444 tests, 0 skipped**, 10/10 gates, every control red.

## Cycle 37 — a sweep, because the last two were found by accident

Cycles 31 and 36 each found a two-write-no-transaction defect, and **both were found while doing
something else**. So the question stopped being "fix this one" and became "how many are there".
Six independent search angles over the record layer, each told to read code and cite lines, each
verified adversarially. The first angle back enumerated every store call in every service function,
wrote and ran its own failure-injection repros, and returned five findings — **and independently
rejected the same information-disclosure claim cycle 36 had already withdrawn**, by reading
`server/_core/trpc.ts`. Two agents reaching the same withdrawal separately is the closest thing to
a control this kind of audit has.

### The third instance, closed here

`reveal` stores the engine's verdict on the chosen move, then the price of the alternative the
player named. Two writes, no transaction — and the function's own docstring states the invariant it
breaks: *"A second round trip would let one land without the other, and a record holding a
chosen-move score and no alternative score is one where the reading silently does not exist."* It
**is** that second round trip, inside itself.

Injected and confirmed before anything was changed:

| after the injected failure | |
| --- | --- |
| the engine's verdict on the chosen move | **stored** |
| the alternative's price | null |
| the retry | throws CONFLICT at `hasReveal`, before it can reach the second write |
| any other path that could write it | **none** — this line is the only caller of `scoreCounterfactual` |
| what the reading shows | `asked` 1, `answered` 1, **`scored` 0** |

`readCounterfactuals` drops an unpriced pair — "null is not a fifth reading" — so a row of the
probe's **treatment arm** leaves the denominator with no trace and no way back. Nothing on any
screen says so. This is the third time the gate written to protect append-only-ness turned out to
be what froze a half-written record.

**The distinction the fix turns on: completing a null is not overwriting a value.** A replay may
fill the price if it is still null; it may not touch the reveal, the alternative move, or a price
already stored. A second reveal carrying a *different* verdict is a different claim about the same
decision and stays a CONFLICT — the verdict is compared field by field. Two positive controls that
are exact complements: reverting the branch reddens the completion, dropping the comparison reddens
the refusal.

### The server half alone would have been unreachable

The UI never retried. `RevealFailure` offers only "next", so a half-written record stayed that way
whatever `reveal` was willing to accept. So the fix has three halves, not one:

1. `reveal` completes the record on an identical replay.
2. `runReveal` sends the **same payload object** a second time. Not a recomputed one: the price has
   to come out of the same search that scored the chosen move — that is why it travels on the
   reveal at all — so a retry that re-ran the engine would store two numbers from two trees under
   one decision, and the server would refuse it as a second, different reveal. Extracted into
   `client/src/lib/retry-once.ts` so it could be tested, which the inline version could not be.
3. **The failure panel stopped asserting something it cannot know.** Its copy said *"ההחלטה הזו לא
   תיספר בין ההחלטות החשופות"* — and in the partial case that is the opposite of what happened: the
   verdict WAS stored and the decision WAS counted. After a failed write and a failed retry the
   client cannot tell the two apart, so it now says what is certain and points at the record.

### Two tests encoded the pre-fix behaviour, and their principle survived both times

`local-record.test.ts` and **GATE-COMMIT's own suite** both asserted that a second identical reveal
returns CONFLICT. That conflates two things: the append-only rule is about **the value, not the
call**. Both were rewritten to assert what it actually requires, and the gate's version is stronger
than what it replaced — over the same real HTTP it now checks that an identical reveal replays
byte-for-byte, that a different verdict is refused, and that the stored verdict is the first one
after the refusal.

### Four more findings, recorded and not yet fixed

Each came with a reproduction the sweep ran itself. They are open as tasks rather than folded into
this commit:

| where | what |
| --- | --- |
| `record-service.ts:837`, `:671` | **The grade fold persists last-writer-wins** — a direct criticism of the cycle-31 and cycle-36 fixes. The fold made the grade a function of the record; the write that persists it is still a blind overwrite. Two concurrent drill completions bury a refutation, and `beginDrill` has no open-drill check (transfers have `getOpenLearningTransfer`), so two drills on one claim take a double click |
| `record-service.ts:782` | **A lost reveal silently shrinks a pre-registered drill.** `Home.tsx` pushes the decision id before the reveal write and carries on when it fails; `finishDrill` filters against scored decisions, so a five-position registered drill is reported as a four-decision result — and the truncated verdict is append-only. An R5 violation |
| `record-service.ts:316` | **A failure between the reflection and the rule locks the reflection forever.** The composer keeps the form on screen after a failure, so editing one word — the natural response — makes every later save CONFLICT, and that decision can never carry a learning rule |
| `record-service.ts:328` | **A lost response duplicates a learning rule.** The id is minted per call, nothing keys on `source_decision_id`, and the append-only check only compares rules of the same id. Two identical rules, each with its own retrieval schedule, each `authored_by: "player"` |

Full verify with the database up: **1,443 tests, 0 skipped**, 10/10 gates, every control red.

## Cycle 38 — the pointer did not survive what the observations survived

Two more sweep angles came back and **found the same defect independently**, both `high`, both
reproduced. It is the worst thing in this PR so far, because it does not lose a run — it kills a
rule.

`recordLearningTransferObservation` derived the slot being answered by **counting the rows already
written**. The client resets its index to 0 on every resume, and no route exposes that count —
`listLearningTransferObservations` is on no tRPC procedure. So after one interruption past the
first position:

| | |
| --- | --- |
| the board re-serves | `fens[0]` |
| the server computes slot | `already.length` = 1 |
| compares the decision against | `fens[1]` — a different board by construction |
| result | `PRECONDITION_FAILED`, and the count never changes, so **every** retry repeats it |
| the transfer | can never reach `fens.length`, so can never be reported |
| `getOpenLearningTransfer` | therefore returns it **forever** |
| the rule | frozen at `hypothesis`, with a due date, a test button, and no path that can complete a test |

The only escape in the product is Archive, which kills the rule rather than repairing it.

**It is the exact failure the per-position write was introduced to prevent** — its own comment says
*"a reload lost them and the resume re-served positions whose engine verdict the player had already
seen"*. The observations survived the reload. **The pointer into them did not, because it was never
stored, only counted.**

### An existing test had it pinned as correct

`"records each position once, refusing a second write for the same slot"` asserted that the second
write throws, and named append-only as the reason. What actually threw was the FEN comparison —
which is precisely the state a resumed client produces. **The test that was supposed to protect the
slot was protecting the deadlock.** Rewritten to assert what actually matters: the preregistered
answer stands and a second one writes nothing.

That is the fourth time in this PR a test encoded the pre-fix behaviour, and the fourth time the
principle survived and only its expression changed.

### The fix is on both sides, because either alone is half

- **Server**: the slot comes from the **board**, not the count. `transfer.fens.findIndex(samePosition)`
  — the candidate set is deduplicated by `positionKey` at preregistration, so no two slots share a
  board and the match is unambiguous. A slot already answered is a **replay**: it returns that slot
  so a client which has lost its place can move on, and writes nothing. Out of order is still
  refused, because `finishLearningTransfer` pairs observation *i* with `fens[i]`.
- **Client**: `beginLearningTransfer` now returns `observed` with a resumed transfer, and the run
  picks up there. Surviving a re-served board is not the same as not re-serving it — the player had
  already seen the engine's verdict for that position, which is the thing this whole mechanism
  exists to prevent.

**The tests model the client rather than assuming it** — they hold a `served` index the way
`Home.tsx` does, starting at 0 on every resume and advancing only when a write resolves. A test that
simply posted the right FEN would have passed against the broken code and proved nothing.

### And a second finding against this branch's own work

The sweep also found that **cycle 36's repair branch was unreachable from the UI** — the same
mistake cycle 37 caught for the reveal, one function over and not noticed. `DrillRunner` sets the
stage to "done" on a failed completion, not back to "running" the way the transfer runner does, and
at "done" with no verdict it renders an error paragraph and **no control at all**: the verdict block
is gated on `verdict`, the abandon button on briefing|running, and the drill id lives only in React
state. Nothing would ever have called `completeDrill` again.

Worse, **the comment justifying that branch was wrong** — it said "the runner returns the player to
the drill so reporting can be retried", which describes the *transfer* runner. Both are fixed:
`advanceDrill` sends the same payload twice through `retryOnce`, and the comment says what is
actually true.

Four positive controls: the count-derived slot reddens three assertions, an overwriting replay
reddens the same three, the client's reset-to-zero reddens the resume wiring, and dropping the drill
retry reddens the reachability claim.

Full verify with the database up: **1,451 tests, 0 skipped**, 10/10 gates, every control red.

**Still open from the sweep, with reproductions:** the fold's write is last-writer-wins and can
destroy `retired` — the one grade nothing can re-derive, and cycle 31 put that write on a path that
previously performed none; every READ of a learning rule still serves the stored grade, so a rule
the record refutes is offered for another test; a lost reveal silently shrinks a pre-registered
drill; `createLearningRule` locks the reflection or duplicates the rule; and a lost `commitDecision`
response writes a phantom decision. Three angles and the completeness critic are still running.

## Cycle 39 — the fold's own comment named the thing the fold could destroy

Two findings against cycle 31, both from the sweep, both reproduced. They are the sharpest kind of
criticism: the fix was right about what to derive and wrong about what that let it overwrite.

### The one grade nothing can rebuild

`gradeLearningRule` checks `retired` before the fold and never re-derives it — the comment I wrote
says why: retirement is an act of the player's, not a reading of the evidence. **What that did not
account for is that the fold's WRITE can destroy it**, and cycle 31 put that write on a path (the
replay branch) which previously performed none.

    read rule (hypothesis) → player archives the rule → the fold's write lands → grade: hypothesis

Ordinary rather than exotic: the Archive button has **no disabled state at all** — no `busy` guard,
unlike the test button beside it — so a second tab or a completion still in flight is enough. And
it is unrecoverable by construction: retirement is stored **only as the grade enum**. No
`retired_at`, no retirement row. Nothing can put it back. The rule reappears in the queue with a
live due date and a test button, as though the player had never archived it, with no message and no
trace.

**The guard is in the store, not the service.** A service-level check is another read-then-write and
loses the same race; all three stores now refuse to move a rule off `retired`. Writing a retired
rule back *as* retired stays allowed on purpose — the fold returns it unchanged, and refusing that
would fail every completion on a rule archived mid-run, after the result was already on the record,
trading a silent loss for a partial one.

`gradeFromRecord` also reads the results **first** and the rule **last** — the opposite of the
obvious order — so one statement sits between the read and the write instead of a query. The store
guard closes the remainder, and if it fires the completion is retried: the retry finds the result
already recorded, re-reads the now-retired rule, and returns it unchanged. Self-healing rather than
lost.

### The fold repaired the write path and left every read serving the stored grade

Lose one grade write on a sitting that refutes a rule, and let the player abandon the retry — a
closed tab does — and the record holds two failing results on two days while `beginLearningTransfer`
reads `hypothesis` and **preregisters a new transfer**. `preregisterLearningTransfer` throws on a
refuted rule and that throw is bypassed, because it is handed the stale rule. The player then sits a
three-position retrieval test on a rule the record has already closed.

It now derives the grade before deciding anything. Idempotent, so on the ordinary path it costs a
query and changes nothing — and **it writes only when the fold actually repairs something**, because
running a rewrite on the path the player hits most would add a failure surface that buys nothing.

### Two fixtures were constructing states the product cannot produce

Both invariant tests wrote a grade straight onto the rule: `{...rule, grade: "refuted"}` and
`{...rule, next_due_at: null, retrieval_step: 4}`. Once the grade is derived, a hand-set one is
simply rebuilt — so the tests went red, correctly. **In production every grade except `retired`
comes from the results**: `formHypothesis` gives hypothesis with none, the fold gives the rest, and
retirement is written and guarded. So the fixtures build the record now — two failing sittings on
two days for refutation, four successful ones for a schedule that has run out — and each asserts its
invariant against a rule that could exist.

That is the fifth and sixth time in this PR a test needed changing, and again the principle survived
and only its expression did not.

Four positive controls: removing the store guard reddens the retirement claim; reading the stored
grade in `beginLearningTransfer` reddens **both** invariant tests, which is what shows the derivation
is now what enforces them; and writing unconditionally reddens the no-extra-write claim.

**Still open and stated plainly:** the learning queue's *display* still prints the stored grade
(`LearningQueue.tsx` renders `rule.grade` and enables its button off the stored `next_due_at`). The
damage is now bounded to a wasted click — `beginLearningTransfer` refuses with a reason and repairs
the record on the way — but the row can still say `השערה` about a rule the record has refuted until
something touches it.

Full verify with the database up: **1,455 tests, 0 skipped**, 10/10 gates, every control red.

## Cycle 40 — a reload changed which experiment the player was in

All six sweep angles are in: 35 raw findings. This one is the most damaging to the *instrument*
rather than to the record's integrity, and it came from the angle that looked at writes spanning
the client and the server.

`revealTiming` is an **experimental condition**, not a preference. The product's own note says why
the deferred game exists: *"over forty moves the coached loop measures a player who has been coached
mid-game — a different condition, and the record stores which was in force."*

`writePosition` stored the moves, the ply, the source, the orientation, the opponent and the game
id. **It did not store the arm.** So a player who chose the deferred game, played fifteen moves and
reloaded carried on in `per-decision` — the `useState` default — and the record then held **one game
whose first fifteen decisions say `end-of-game` and whose rest say `per-decision`**. Every row
internally consistent. Nothing anywhere saying the condition changed underneath them.

**A position that cannot say which arm it was in is no longer restored.** That is this file's own
rule — *"a stored shape that changed is not a position"*, and `parse` already returned null for
every other missing field — applied to the field that matters most. A game in flight across this
change is forgotten; its decisions are on the record either way, and forgetting a board is better
than continuing it in the wrong condition.

**The type system found every writer.** Making the field required turned up four call sites in one
compile: the live game, two handoffs from the front door, and a fixture. The two handoffs are a
single position rather than a game in progress, so they state `per-decision` explicitly rather than
leaving it to the board's default — the arm travels with the handoff now.

### Two things this repository's own guards caught, mid-change

- **The stale-closure test caught me.** Adding `revealTiming` to the write effect made it read a
  value its dependency array did not list. `no callback in the decision path closes over a value it
  does not depend on` went red immediately. That test exists because a dependency list that
  fabricated an observation shipped once; it earned its keep here.
- **A control came back GREEN, and that was the finding.** Deleting `setRevealTiming(saved.revealTiming)`
  from the restore broke nothing: the arm was stored and parsed and **quietly not applied**, and
  every test still passed. A first version of this change would have shipped exactly that. The
  restore wiring is asserted now, and the same deletion reddens it.

Four positive controls in the end: not requiring the arm in `parse` reddens both refusals; not
writing it reddens the round trip; and dropping either half of the board wiring — the restore or the
write-back — reddens the arm's wiring test.

Full verify with the database up: **1,460 tests, 0 skipped**, 10/10 gates, every control red.

## Cycle 41 — the sweep's adversarial pass, and the one finding that survived it

The sweep's Verify phase is what this cycle is about as much as the fix is. Fourteen verdicts in so
far on 35 raw findings, and **thirteen refuted**. The refutations are the useful part:

| why refuted | count |
| --- | --- |
| describes code that cycles 37–40 already changed — "written against a revision that no longer exists" | 6 |
| the mechanism is real but the load-bearing claim is false or overstated | 5 |
| unreachable in production, or no observable effect | 2 |

Several verifiers re-checked every line against HEAD and found the citations shifted by my own
commits, then judged the finding against the current code rather than the one the finder read. That
is the behaviour that makes a sweep worth running — and it is also a warning about reading raw
findings, which is why none of these were acted on before verification.

### The one that survived, at `high`

**`finishDrill` graded whatever survived the intersection.** It filtered the posted decision ids
against the *revealed* ones and reported the remainder. A five-position pre-registered drill whose
third reveal write was lost came back as a **four-decision result** — `describeResult` reporting the
smaller n as the test's size, `evaluateRefutation` computing its standard error from the survivors,
and nothing anywhere recording that a registered position went unmeasured, because
`ProspectiveDrillResult` has no field for it. The only guard was `length === 0`.

And it is terminal. A false `observed` grades the claim `refuted`, refutation cannot be revisited,
and `beginDrill` then refuses to test that claim again. **A run that lost a position could close a
question permanently.**

**The verifier's decisive argument was the sibling in the same file.** It named the refutation it
expected to work — that partial measurement is tolerated by design — and then closed it:
`finishLearningTransfer` refuses when `observations.length !== transfer.fens.length` *and* refuses
any decision without a reveal. Both are pre-registered tests. Only one of them checked that the test
it graded was the test it registered.

It also recorded an overstatement against itself: `revealFailure === "write"` does not always
truncate, because `reveal` is two writes and a `scoreCounterfactual` failure after `recordReveal`
committed leaves the decision scored — and `retryOnce` must now fail twice. *"That narrows the
window but does not close it."*

`finishDrill` now refuses a run that did not measure what it registered, naming both numbers the way
its sibling does, and refuses a decision recorded against a board the drill never registered —
because the right *number* of revealed decisions is not the right *positions*, and without that the
completion believes whatever the client sends. Two positive controls, one per guard.

**What the player gets instead:** a refusal with both numbers rather than a false verdict, and the
run is lost. That is the same contract the transfer path has had all along. The residual is real and
stated: `beginDrill` still has no open-drill check, so a refused drill can be followed by a second
preregistration over the same claim — which is the other half of an open finding, not this one.

Full verify with the database up: **1,463 tests, 0 skipped**, 10/10 gates, every control red.

## Cycle 42 — three positions, decided twice, graded `replicated`

The second finding to survive adversarial verification, at `high`, and the verifier **reproduced it
end to end against the real service** before confirming it — while refuting three of the finding's
own claims as overstated and every one of its line numbers as stale.

`beginLearningTransfer` is check-then-act with no uniqueness: it reads the open transfer and later
writes a new one, with nothing between them and no unique index on `rule_id`. **Two tabs are
enough** — the queue's button is disabled on `busy`, and `busy` only becomes true after the first
mutation resolves. Both calls select from the same candidates by the same deterministic rule, so
the two preregistrations cover the **identical three positions**.

    sit transfer-B on day 1   →  observed, grade hypothesis, next due in three days
    on the due date, begin    →  RESUMES transfer-A, the orphan, over the same three boards
    sit transfer-A on day 2   →  two success days  →  grade `replicated`

Three positions have become evidence that a rule held up **across sittings**. That is exactly what
the spent-decision guard exists to prevent, and its own comment names this precondition — *"a double
click is enough, since the queue's busy flag only flips when the first mutation RESOLVES"*. It closes
only the `decision_id` half: the client mints a fresh id per position, so a re-decision of the same
board sails through, and the completion's only position check is that the atom matches
`transfer.fens[index]` — which a re-decision satisfies. Results are append-only, so the fold reads
two success days forever.

The existing test named for this — *"one sitting cannot replicate itself"* — covers only the id-reuse
case and **hand-inserts the second transfer rather than exercising the concurrent start.**

### The cure is at the start, and it took both halves

Refusing at the report would leave the orphan open and the rule frozen — the deadlock this path was
fixed for one cycle ago. So:

- **An orphan is not resumed.** The discriminator is *zero observations of its own* **and** *every
  board already decided*. Neither half alone works: a run the player got halfway through has some
  boards decided and is a legitimate resume, and a run they **completed but could not report** has
  all of them decided — by itself, with observations to show for it — and must be handed back.
- **`getOpenLearningTransfer` returns the NEWEST open transfer**, in all three stores. With one open
  transfer these are the same row; they differ only after a lost race. Ordering by most recent is
  what lets the fresh preregistration supersede the orphan instead of queueing behind it forever —
  without it, every start skips the orphan and preregisters another, one row per visit.

The selection rule was extracted rather than copied, because two answers to "which boards may be
tested" is how the two of them would drift.

### A positive control came back green again, and again it was the finding

Dropping the *zero observations* half broke nothing: the completed-but-unreported case was
**untested**, and discarding a finished sitting is worse than the defect being fixed. It is asserted
now, and the same deletion reddens it. That is the second cycle running in which a control that
failed to go red was more informative than the two that did.

Full verify with the database up: **1,467 tests, 0 skipped**, 10/10 gates, every control red.

## Cycle 43 — a refusal that protected one value by discarding another

`createLearningRule` writes the player's reflection, then the rule. Two writes, no transaction —
and the validation that can reject the rule ran **between** them, reachable on the browser path
where the service is called directly with nothing validating ahead of it.

Lose the second write and the record holds a reflection and no rule. The retry then meets the
append-only gate, which succeeds only on a **byte-identical** reflection.

**Narrower than this entry first said, and the correction is the sweep's.** A verifier ran the
pre-fix code and established that the plain retry *works*: the composer keeps every field on screen,
so a re-click without touching anything sends the same bytes and writes the rule — *"RETRY SAME →
rule created"*. What traps the decision is **editing** the revised-read box first, a plausible
response to "הכלל לא נשמר" rather than an automatic one; and once edited, the stored text is no
longer on screen to be retyped. It also narrowed the two ways in, which turn out to be disjoint: the
schema throw between the writes is dead on the server path (`learningRuleEventSchema` parses both
halves with `.strict()` in the router first) and survives only in the browser — where the store
write cannot fail at all, because `LocalRecordStore.write` swallows a quota error and downgrades to
memory. So a half-written record needs *either* that throw in the browser *or* a genuine driver
failure on the signed-in MySQL path.

The defect stands and the fix is unchanged; what was overstated was its inevitability.

Three things changed, and the third is the one that matters most:

1. **The rule is built before the reflection is written.** `formLearningRule`'s schema parse can
   throw; running it first makes that throw free, because nothing has been written when it fires.
2. **A stored reflection no longer refuses the rule.** What the append-only rule protects is the
   VALUE — what you said before seeing more is not retroactively improved — and that is untouched:
   the stored text still stands. What changes is that refusing to overwrite it no longer refuses
   everything else.
3. **The caller is told which happened.** `createLearningRule` returns `recorded` or `kept-earlier`
   with the stored text, and the composer shows it: the rule was saved, the reflection you just
   wrote was not, and here is what the record holds. Keeping one version silently while the screen
   shows another is the same defect in a different place — the form does not close until the player
   has acknowledged it.

Three positive controls: restoring the throw reddens four assertions across both layers; letting
the write overwrite reddens the append-only claim; and closing the composer without the notice
reddens the on-screen half alone.

**The seventh test in this PR to encode the pre-fix behaviour.** *"keeps the reflection
append-only"* asserted a thrown CONFLICT. The principle survives — the stored reflection is
unchanged, asserted directly — and only the expression changed. That is now the count: seven tests,
seven principles intact.

### The sweep's third confirmed finding, and its severity corrected downward

The duplicate-rule half of the same finding was confirmed but **re-graded `low` by the verifier**,
with reasons worth keeping: the duplicate is removable through the queue's ungated Archive button,
`listLearningRules` has exactly one consumer so nothing double-counts it, nothing is lost or
undrawn — the record gains a spurious authored row — and, unlike `reveal` and `completeDrill`, this
mutation is deliberately **not** wrapped in `retryOnce`, so it takes a human re-press rather than a
machine. Left open at `low` rather than fixed on the same commit.

Twenty-one verdicts now, three confirmed, eighteen refuted.

Full verify with the database up: **1,474 tests, 0 skipped**, 10/10 gates, every control red.

## Cycle 44 — the server said the write did not happen, and it did not know that

The generic 500 message read *"השרת נכשל באמצע הפעולה **והיא לא נשמרה**"* — the operation was not
saved. That is a claim of fact the server cannot make, and this record is full of counterexamples:
the reveal stores the engine's verdict and then the alternative's price; completing a transfer
stores the result and then the grade; authoring a rule stores the reflection and then the rule.
**When the second of a pair fails, "it was not saved" is exactly backwards about the first** — and
the player is told the opposite of what the record holds.

Its own note said R2 turns on the distinction between a lost decision and a slow one. It does, and
that is the argument for saying what is true rather than what is reassuring. It now says the server
does not know how far it got and points at the record.

**It still recommends retrying, and that advice is newly sound**: cycles 31–43 made the completion
paths replay rather than refuse. Deliberately *not* promised as a blanket property — `commitDecision`
still mints a fresh id per attempt, so a retry there writes a second decision rather than repairing
the first — which is why it says "check the record" and not "a retry never writes twice".

### Four of this branch's own claims, refuted by the sweep

The fourth confirmed verdict landed on the defect cycle 43 had just fixed, and while confirming the
core it **took apart four of my supporting claims** — including one I had written into a code
comment. The corrections are in the code and in cycle 43's entry above:

| I claimed | what was established |
| --- | --- |
| the decision could never carry a rule again | the **plain retry works** — a re-click without editing sends the same bytes and writes the rule, proved by running the pre-fix code |
| the schema throw between the writes is reachable on the browser path | true, but the *store write* cannot fail there — `LocalRecordStore.write` swallows a quota error — so the two ways in are **disjoint** |
| the router path is exposed to that throw | dead: `learningRuleEventSchema` parses both halves with `.strict()` before the service is reached |
| a lost response could duplicate the rule automatically | it takes a **human re-press**: this mutation is deliberately not wrapped in `retryOnce`, unlike `reveal` and `completeDrill` |

The defect and the fix are unchanged. What was overstated was its inevitability, and an entry that
says a thing is permanent when it is merely likely is the same failure this ledger exists to catch —
committed one cycle after being written, which is the shortest such loop in this PR.

Full verify with the database up: **1,474 tests, 0 skipped**, 10/10 gates, every control red.

## Cycle 45 — the fallback was directional, and only one direction was guarded

The fifth finding to survive adversarial verification, at `medium`, and it is against a guard this
branch already wrote.

`confirmedServerRecords` exists so that **a record on the server does not move into this browser
because one probe failed**. Its own file says the rule symmetrically: *"the record does not change
underneath you."* It was enforced in one direction. The latch is written only on success and read
only for the `usable → failure` transition, so **`failure → usable` is unguarded**:

    probe fails  →  "ההחלטות נשמרות בדפדפן הזה בינתיים"  →  decisions go into localStorage
    probe recovers  →  every read and every write silently points at the server again

Under an explicit on-screen promise, and then with no notice at all — `RecordModeNotice` returns
null the moment the status is `usable`, so the flip **takes its own explanation away with it**. And
there is no merge: no migration code exists anywhere in `client/src/lib`.

`kept-local` is the mirror latch: once this account has written into the browser record in this
session, a recovered probe leaves the record where those decisions are, and says so. Keyed by
account and module-scoped, exactly like the latch it mirrors. Three positive controls: not reading
it reddens the flip and the notice, dropping the account key reddens the next-person case, and
emptying the sentence reddens the on-screen half alone.

### What the verifier corrected, and it sharpened the fix

- **The commit → reveal interleaving is impossible on the ordinary path.** `onCommit` issues both
  the commit and the reveal from closures captured in one render, so both see the same mode. The
  window exists **only in the probed arm**, where the reveal is issued later by `onAnswerProbe`, a
  callback rebuilt every render that therefore reads the *current* mode. So the mark is written
  before the local write rather than after it.
- **"Never read again" was overstated.** `LocalRecordStore` keeps one browser-wide key, so the
  decisions still render in any later local-mode session. What is true is that they are invisible
  *whenever the server is healthy* — which is the same violation R2 already names: a record that
  could not be read must not render as a different, smaller one.
- **The orphaned unrevealed decision is a state the record already models as attrition.** The
  defect there is not a malformed record; it is that the player can never complete that decision
  and is told the wrong cause.

### The sweep, closed out

Thirty verdicts on 35 raw findings. **Five confirmed, all five fixed** — the truncated drill (41),
the double transfer (42), the reflection lock and the duplicate rule (43, the second re-graded and
left open at `low`), and this. **Twenty-five refuted**, and the refutations did real work:

| why | notable |
| --- | --- |
| describes code cycles 37–44 already changed | six of them, several catching that their own citations had shifted by my commits |
| the load-bearing claim is false at HEAD | the `beginDrill` race: *"beginDrill performs exactly ONE write… an unreported drill is designed, documented, and shipped as a button"* |
| the harm cannot occur through the product | the last-writer-wins grade: *"the fold is monotone, so a bury can only turn refuted into replicated — and `ClaimPanel` renders the drill button only for `hypothesis`, so the buried claim is never offered again"* |
| wrong class entirely | the phantom decision: *"nothing is derived from the extra row; every reader folds over `scored` decisions only"* |
| the trigger does not exist | the `NOT_FOUND` after an evidence write: *"nothing in this codebase can remove either row"* — no delete surface exists at all |

**Tasks #29 and #35 are closed as refuted, not as fixed.** That distinction is the point of running
the verification: two pieces of work that looked worth doing, and were not.

Full verify with the database up: **1,478 tests, 0 skipped**, 10/10 gates, every control red.

## Scores this cycle

Evidence-backed, against the state at `03d8f96`. A score does not rise because more code exists.

| category | base | now | what moved it |
| --- | --- | --- | --- |
| Security, privacy, isolation | 2 | **9** | Two cross-account leaks closed, each reproduced first; a refusal reaches the screen as a refusal; the record no longer comes back in a 500 body or a stack. Not 9+: single-tenancy is now declared and enforced from both ends rather than open, but it remains a gate rather than per-tenant scoping — the right design for one person, and the thing that would have to change for more. Cycle 34 closed the headers: a CSP measured in a real browser against the built app rather than written from the source, `SameSite=Lax` restoring the only CSRF defence this codebase has, a 1mb body limit and a bounded opaque diagnostic, `npm ci` and an SCA step in CI |
| Scientific / construct validity | 4 | **9** | `banana` closed; self-report removed on published evidence; the verdict scoped to what three positions carry; the population comparison, the control coefficient and the discrimination area now each carry their own error and clear the detector's bar before being asserted -- a mechanical sweep of every field, not three spot fixes. the phase split checked against 4.4M human-rated positions and its caveat put on screen. the six marginal buckets read as three variables, so one weakness is reported once instead of up to three times with one of them inverted; variables crossed, with the false-positive cost measured at 0.0% and the readability cost printed. Not higher: positions still are not selected for the trigger, and per-item difficulty is unmeasured because Maia is unreachable. Cycle 40 closed a defect in the instrument itself rather than in a measure — a reload moved a game from the deferred arm into the coached one mid-game, so one game's rows recorded two conditions with nothing saying so |
| Functional correctness | 6 | **9.5** | Degenerate question, bidi sign, null-due, FEN novelty, invalid nesting, a dependency list that would fabricate an observation, a fallback that could run backwards — each with a reproduction. And the first defect here found by **injecting a failure rather than reading code**: a lost grade write, reproduced, with the retry branch shown to be what made it permanent. The drill path had the same shape and is closed in cycle 36 — worse there, since it had no replay branch at all — along with two timestamp divergences between the two stores that no memory-backed test could see. Not 10: a systematic sweep for the rest of this class is still running |
| Test quality and CI | 8 | **10** | 1,373 tests, **0 skipped** (was 5); a real database and a real browser locally and in CI; ~110 positive controls red. Two regex-over-source assertions replaced by things that run — and **three** claims deleted or downgraded because no mutation could redden them: a panel width measured to have slack under every setting, a crossed-cell `outside` floor that cannot bind by construction, and a ranking rule kept for consistency rather than a measured edge. Cycle 37 added the thing that was missing: a **systematic adversarial sweep** rather than defects found while doing something else — six angles, each verified, which turned up four more open findings including one against this branch's own fixes |
| Architecture / maintainability | 5 | **6** | Store contract extended cleanly; the shared modules each own their own error and their own reasons. `Home.tsx` is 1,764 lines and stays there: the coupling is `onCommit` serving three decision modes, not the line count, and that is a design decision rather than a cleanup |
| UX, accessibility, recovery | 6 | **9.5** | Collapsed label, sign on the wrong side, invalid nesting, `aria-pressed` announcing unmade answers; six storage situations that shared two sentences now have six; four reasons an empty cell is empty that shared one dash now have five. SC 3.1.2 read island by island rather than swept: four English strings declared, thirty-one exemptions asserted so a later sweep cannot quietly claim a language for chess notation |
| Performance and bundle | 5 | **8.5** | Explicit budgets, wired into verify and CI, proven to fail — and now a **layout-shift budget measured in a real browser** at two viewports on both routes, which caught a 98px shift the assessment reported and a 289px one this branch had introduced itself. Not higher: LCP and INP are still unmeasured, and CLS is measured on a local server rather than on real users |
| Operations / deployability | 4 | **8.5** | `scripts/dev-db.sh`; a health check that measures health, returns 503 for a configured-but-unreachable database, cannot hang, and leaks no deployment detail; server-side error logging that keeps the parameterized statement and drops the values; incoherent configurations named at startup, by variable and never by value. Not higher: no incident runbook, and the record loop itself is still exercised only locally. Third-party error tracking is deliberately absent — shipping this record to a vendor would break the claim the product makes about it. Cycle 32 closed the licence obligations the build had been ignoring: a GPL-3.0 engine and nine OFL fonts now convey their licence texts, checked by GATE-NOTICE against the tree |
| Documentation / DX | 7 | **8.5** | This ledger, `RESEARCH_EVIDENCE.md`, a reproducible database, and `THIRD_PARTY_NOTICES.md` — every component the build conveys, at the version it conveys, with the licence text it serves and the source it came from |
| Differentiation / user value | 8 | **8.5** | Cycles 13–22 were unchanged by design — they made existing claims true rather than adding new ones. Cycles 23–26 add one: the counterfactual probe reads candidate SELECTION, the half of expertise the accuracy rate cannot see. Not higher until it has n behind it: four readings need 30 scored answers, and the panel currently counts down to that rather than reporting anything |

## Open, by severity

| # | finding | severity | state |
| --- | --- | --- | --- |
| 2b | Candidate positions chosen for being unseen, never for the rule's trigger applying | **High** | open. Motif retrieval is validated on lichess data (Bizjak & Guid 2021) but **48% top-1** — it may *propose* and must never assert |
| — | Three positions is below every single-case standard consulted; no control positions | **High** | open, and now **stated on screen** rather than silently assumed |
| — | Multi-user separation: `user_id` on 12 tables, every query, index and cache key | High | **product decision for the operator**, not a defect fix |
| 7 | `Home.tsx` past 1,900 lines, `index.css` past 3,800 | Low | open. `runReveal` was extracted from `onCommit` in cycle 25 — a real decoupling, since the counterfactual probe needed a second caller for the engine half — and the file still grew. The coupling that matters is `onCommit` serving three decision modes plus a probe stage |
| — | The project has no `LICENSE` file, and ships a GPL-3.0 engine | **Medium** | **open, and it is the owner's decision.** Cycle 32 closed everything that does not depend on the answer: the licence texts and corresponding source now travel with what the build conveys. What is left is whether the application's own code is offered under the GPL, all rights reserved, or something else — a question this repository cannot settle for its owner |
| — | The chart's inline styles are not exercised under the CSP | Low | open, and the grant is wider than proven. `style-src 'unsafe-inline'` is measured to be REQUIRED for React style attributes, but the harness loads an empty record, so the recharts path was never rendered under the policy. Narrowing further would need a seeded record in the browser harness |
| — | ~~The fold's write can destroy `retired`~~; the learning queue's DISPLAY still prints the stored grade | ~~High~~ **Low** | **the write half is closed in cycle 39**: all three stores refuse to move a rule off `retired`, and `beginLearningTransfer` derives the grade before deciding on it. What is left is cosmetic — `LearningQueue.tsx` renders `rule.grade` and enables its button off the stored `next_due_at`, so a row can say `השערה` about a refuted rule until something touches it. The click is refused with a reason and repairs the record |
| — | ~~`beginLearningTransfer` is check-then-act with no uniqueness~~ | ~~High~~ | **the damage is closed in cycle 42**: an orphan preregistration is never resumed, so two transfers over one set of boards can no longer replicate a rule. The race itself remains — there is still no unique index on `rule_id`, so a lost race still writes a second row; it is now inert |
| — | ~~The grade fold persists last-writer-wins; `beginDrill` has no open-drill check~~ | ~~Medium~~ | **refuted in cycle 45, not fixed.** The fold is monotone and each writer reads after writing its own row, so a bury can only turn refuted into replicated — and `ClaimPanel` renders the drill button only for `hypothesis`, so a buried claim is never offered again. `beginDrill` performs exactly one write, and an unreported drill is a state the product ships a button for |
| — | The learning queue's display prints the stored grade rather than the derived one | Low | open, cosmetic since cycle 39: the click is refused with a reason and repairs the record |
| — | ~~A lost reveal silently shrinks a pre-registered drill~~ | ~~Medium~~ | **closed in cycle 41**, and it was the one finding of 35 that survived adversarial verification at `high`. `finishDrill` now refuses a run that did not measure what it registered, and refuses a decision recorded against a board it never registered |
| — | ~~`createLearningRule`: a failure between its two writes locks the reflection~~; a lost response still duplicates the rule | ~~Medium~~ **Low** | **the lock is closed in cycle 43**: a stored reflection stands and no longer refuses the rule, and the composer names what was kept. The duplicate half was confirmed and re-graded `low` by the verifier — removable through Archive, single consumer, nothing double-counted, and it takes a human re-press since this mutation is not wrapped in `retryOnce` |
| — | Incident runbook | Low | open. Health checks (13–14), error handling (19) and startup configuration faults (20) are closed. Third-party error tracking is deliberately absent: shipping this record to a vendor would break the claim the product makes about it |
| — | Production deployment tested directly rather than inferred from a green build | Medium | partly closed: `/api/health` fetched on the live preview (cycle 14). The record loop itself is still only exercised locally |
| — | Every construct PR #24 added, audited as *metric* vs *product inference* | — | partially done in `docs/MEASUREMENTS.md` §4b–4d |
| — | The counterfactual probe has no n yet | **Medium** | open by construction. Four readings need 30 scored answers; the panel counts down rather than reporting. The randomisation check on screen is the negative control that must stay empty |
| — | The crossed profile needs ~480 decisions before most of it is readable | **Medium** | open by construction, and measured: 0.1% of cells readable at n=120, 17.1% at 240, 65.1% at 480. The fraction is on screen so the silence has a size |
| — | ~~The variable collapse does not reach the claims the record stores~~ | ~~Low~~ **was Medium** | **closed in cycle 29, and the severity I first gave it was wrong.** Measured rather than reasoned about: `selectClaim` took `patterns[0]`, so on a player whose weakness sat in the opening or the endgame the STORED claim named a phase they were fine in **14.7% of the time**, and 44 times in 45 it was the inverted one. A claim is not a panel sentence — it is written to the record, accrues prospective drill results, and is what the player is asked to go and test, so a wrong one spends their decisions. Now 1.6% / 1.0%, at a cost of 0.0% → 0.8% when the weakness is the largest phase. `BUCKETINGS` still keeps every key, so claim ids and preregistered hypotheses are unaffected |
| — | ~~`finishDrill` loses a claim's grade the same way, and its retry raises instead of recovering~~ | ~~**Medium**~~ | **closed in cycle 36**, and the estimate written here was wrong: it needed no store-contract change at all. `getClaim` already derived `prospective_tests` from the result rows in both stores, so the fold had its input already. Found in cycle 31. Needs `listDrillResults(claimId)` on the store contract and `evaluateClaim` folded over it — a real-database change, not a symmetric edit |
| — | Whether the confidence rating should be sampled rather than asked every move | **Medium** | open, and it is the operator's call. Raised because the burden is real; sampling it on the same two-arm logic would keep Brier, Murphy, AUROC2 and the calibration curve while halving the interruptions, at the cost of multiplying time-to-first-reading by 1/p |
