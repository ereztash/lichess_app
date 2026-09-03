# Retention, deletion, export

Authority for two questions in `scripts/authority-scan.ts`: Q28, *what may the product record
about a person, and what may it never record*, and Q29, *how long is a record kept, and how is it
deleted*. The code this rests on is `client/src/lib/storage-keys.ts`, `client/src/lib/local-record-store.ts`
(`exportLocalRecord`, `deleteLocalRecord`), `scripts/purge.ts` and `shared/tenancy.ts`.
`tests/client/a-record-the-player-can-take-and-erase.test.tsx` holds the browser half;
`tests/server/a-record-that-can-be-erased.test.ts` holds the server half against a real MySQL in CI.

## 1. Where data lives

| store | what | who can read it | kept until |
| --- | --- | --- | --- |
| this browser, `localStorage`, key `decision-lab.record.v1` (suffixed `:<account>` after sign-in) | the decision record: positions, moves, the player's written reads and unknowns, confidences, blitz games, import readings, preregistrations | the person at that browser | they erase it (section 4), or the browser's site data is cleared |
| this browser, other keys | preferences and trial bookkeeping; the full list with what each holds is `STORAGE_KEYS` in `client/src/lib/storage-keys.ts` | the same | each has its own clear; the trial ledger has a button beside the record's |
| the server, MySQL, the tables in `RECORD_TABLES` | the same record, when the owner signs in on a deployment with `DATABASE_URL` | the one account `OWNER_OPEN_ID` names, through `ownerProcedure` | the operator runs `npm run purge -- --yes` (section 4) |
| the server, `users` | the OAuth identity: openId, display name, role, last sign-in; email is never written | the gate | not part of the record; removed with the deployment |
| this browser, cookies | `app_session_id`, the HttpOnly session (one year, `SameSite=Lax`); `__Host-oauth_state`, the ten-minute sign-in nonce | the server on each request; no script | sign-out clears the session; the nonce expires or is cleared by the callback |
| the platform's function log | operator lines: failure names, classes, request ids, build; never content (`docs/OBSERVABILITY.md` section 3) | the operator, in the Vercel dashboard | one hour (Hobby plan) |
| the platform's request log | method, path, status, request id | the same | one hour |
| Lichess, Chess.com | the username typed into the import box, in the request that fetches that account's public games | those services, under their own terms | not ours to state |

The deployment holds **one person's record** (`shared/tenancy.ts`, enforced by
`tests/server/one-record-one-person.test.ts`). There is no second tenant to separate data from,
and no row carries an owner column.

## 2. What may be recorded

The record is the product. It may hold, and does hold:

- the position (FEN) and the move chosen, with the candidate moves considered;
- the player's own words: the stated read, the stated unknown, the free-text value answer;
- the stated confidence and the scale it was stated on;
- times: seconds to decide, clock remaining, think times in blitz;
- the engine's verdicts after commit, with the engine's identity and depth;
- the username typed into the import box, in the import readings.

These are recorded because the instrument is about them, and the player is told so before the
first decision (`WhatThisIs`, `RecordModeNotice`).

## 3. What may never be recorded

| never | held where it would otherwise leak |
| --- | --- |
| a password, a session token, a Lichess personal token | `redact` strips token shapes from operator lines; the client never sees a token; the session is an HttpOnly cookie |
| an email address | `authenticateRequest` hard-codes `email: null`; `users.email` is never written |
| the record's content in any server log | `describeForOperator` logs the parameterised statement and never the bound values; `tests/server/the-record-does-not-come-back-in-an-error.test.ts` |
| the record's content in a request URL | tRPC queries go as POST (`methodOverride: "POST"` in `client/src/main.tsx`), so a FEN or a username is in a body the platform log does not keep |
| the record's content in a failure report | the client beacon is five enumerated fields (`docs/OBSERVABILITY.md` section 5) |
| an IP, a referrer, a user agent, a fingerprint, in anything this application writes | the acquisition ledger's privacy model (`docs/ACQUISITION_EVIDENCE.md` section 8); the operator line carries none of them |
| anything about a player in the acquisition ledger beyond enums, counts, durations and the one deliberate free-text answer | the event union makes other fields unrepresentable; `prohibitedContent()` throws |

## 4. Deletion

**Browser.** Self-check drawer, *מחקו את הרשומה מהדפדפן הזה*, pressed twice. It removes the record
key for the current identity, drops the in-memory copy, and leaves preferences, the trial ledger
and other accounts' records in place, each of which says so on screen. The trial ledger has its own
erase beside it.

**Server.** There is one person and one record, so deletion is the whole record:

```
DATABASE_URL=mysql://... npm run purge -- --yes
```

It refuses without `--yes` and without `DATABASE_URL`, deletes every row of every table in
`RECORD_TABLES`, leaves `users`, and prints the count per table before and after. There is no
per-decision delete: the record is append-only by design, and a record that can lose rows is a
record whose counts cannot be trusted (`docs/MASTER_PRODUCT_DEBT.md`, R-02).

**Logs.** Nothing to delete; the platform drops them after an hour.

## 5. Export

Self-check drawer, *הורידו את הרשומה*: a file `decision-lab-record.json` that is the stored JSON
verbatim, nothing summarised on the way out. The server record has no export of its own yet; the
owner reads it through the record routes they are already signed in to, and a dump is the
operator's `mysqldump`. That gap is stated rather than papered over.

## 6. Retention

There is no time-based retention. A record is kept until the person erases it (browser) or the
operator purges it (server). The reasons: the instrument's value is longitudinal, the deployment
is one person's, and a silent expiry would be the product losing decisions the person did not ask
it to lose. A deployment serving somebody who is not the owner does not exist yet; the day it
does, this section is the one to reopen.

## 7. What a person can ask, and what they get

| ask | answer |
| --- | --- |
| what do you keep about me? | section 1 and `STORAGE_KEYS`, and the download in section 5 |
| delete it | section 4, both halves |
| who else can see it? | nobody through the product; the operator through the database, and the platform's log for an hour, names only |
| do you sell or share it? | there is nothing to share it with: no analytics vendor, no error SDK, no third-party script (`docs/ACQUISITION_EVIDENCE.md` section 12, the CSP `connect-src`) |
