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
| `CURRENT_OID` | `3394342` |

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

## Open, by severity

| # | finding | severity | state |
| --- | --- | --- | --- |
| 2 | Transfer success = non-empty text + self-report + low cp_loss. `banana` scores 3/3 and `observed: true`. The authored rule and its stored `refutation_condition` never participate. | **High — construct invalidity** | open; the deepest item, and partly a design question rather than a defect |
| 2b | Candidate positions chosen only for being unseen, never for the rule's trigger applying | **High** | open; needs position-similarity, see research lane |
| 3 | `action_rule` displayed beside the start button; application self-reported *after* the engine reveal | **High** | open |
| 4 | A started transfer has no single-active enforcement, resume, or expiry. Reload abandons it and a new one can start. | **High** | open; store contract needs an open-transfer query in all three implementations |
| 5a | `next_due_at: null` means *schedule exhausted*, and both the queue and the service read it as *due now* | Medium | open |
| 5b | Novelty compared on whole FEN strings, so counters make one board look like three positions | Medium | `shared/position-key.ts` written and tested; **not yet wired** |
| 6 | `threat_scan` and `wouldChooseAgain` pre-selected, yet stored `authored_by: "player"` | Medium | open |
| 7 | `Home.tsx` 1,743 lines, `index.css` 3,693 | Low | open |
| — | Every construct PR #24 added, audited as *metric* vs *product inference* | — | open |
