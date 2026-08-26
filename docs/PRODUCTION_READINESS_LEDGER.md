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

## Scores this cycle

Evidence-backed, against the state at `03d8f96`. A score does not rise because more code exists.

| category | base | now | what moved it |
| --- | --- | --- | --- |
| Security, privacy, isolation | 2 | **7.5** | Two cross-account leaks closed, each reproduced first; a refusal now reaches the screen as a refusal. Not 9+: the product is single-tenant by gate, not scoped by tenant, and that is an open product decision |
| Scientific / construct validity | 4 | **7** | `banana` closed; self-report removed on published evidence; the verdict scoped to what three positions carry. Not higher: positions still are not selected for the trigger, and there is no control condition |
| Functional correctness | 6 | **8.5** | Degenerate question, bidi sign, null-due, FEN novelty, invalid nesting, a dependency list that would fabricate an observation, a fallback that could run backwards — each with a reproduction |
| Test quality and CI | 8 | **9** | 1,163 tests, **0 skipped** (was 5); a real database and a real browser locally and in CI; ~100 positive controls red. Two regex-over-source assertions replaced by things that run |
| Architecture / maintainability | 5 | **6** | Store contract extended cleanly; `Home.tsx` still 1,743 lines |
| UX, accessibility, recovery | 6 | **8.5** | Collapsed label, sign on the wrong side, invalid nesting, `aria-pressed` announcing unmade answers; six storage situations that shared two sentences now have six |
| Performance and bundle | 5 | **7** | Explicit budgets, wired into verify and CI, proven to fail |
| Operations / deployability | 4 | **7** | `scripts/dev-db.sh`; a health check that measures health, returns 503 for a configured-but-unreachable database, cannot hang, and leaks no deployment detail. Not higher: no error tracking, no startup env validation, no incident runbook |
| Documentation / DX | 7 | **8** | This ledger, `RESEARCH_EVIDENCE.md`, a reproducible database |
| Differentiation / user value | 8 | **8** | Unchanged by design: this work made existing claims true rather than adding new ones |

## Open, by severity

| # | finding | severity | state |
| --- | --- | --- | --- |
| 2b | Candidate positions chosen for being unseen, never for the rule's trigger applying | **High** | open. Motif retrieval is validated on lichess data (Bizjak & Guid 2021) but **48% top-1** — it may *propose* and must never assert |
| — | Three positions is below every single-case standard consulted; no control positions | **High** | open, and now **stated on screen** rather than silently assumed |
| — | Multi-user separation: `user_id` on 12 tables, every query, index and cache key | High | **product decision for the operator**, not a defect fix |
| 7 | `Home.tsx` 1,743 lines, `index.css` 3,693 | Low | open |
| — | Error tracking, startup env validation, incident runbook | Medium | open. The health check itself is closed (cycles 13–14) |
| — | Production deployment tested directly rather than inferred from a green build | Medium | partly closed: `/api/health` fetched on the live preview (cycle 14). The record loop itself is still only exercised locally |
| — | Every construct PR #24 added, audited as *metric* vs *product inference* | — | partially done in `docs/MEASUREMENTS.md` §4b–4d |
