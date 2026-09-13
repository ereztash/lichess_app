# FIELD session package

Status: **`FIELD_READY / HUMAN_PARTICIPANTS_REQUIRED`**

Everything a person needs to run the pre-registered study is in this directory. Nothing in it can
be executed by an agent: the study requires cold chess players in a room or on a call, and a
simulated participant would produce a matrix of numbers with no observation behind any of them.

The protocol is [`../FIELD_RUN_CURRENT.md`](../FIELD_RUN_CURRENT.md). It is frozen. This directory
does not restate it; it operationalises it.

## The build

Product source frozen at `4c395637cd274c5faffb29ebb8429bfdac358eb1`, merged to `main` in
[PR #105](https://github.com/ereztash/lichess_app/pull/105) and now the production deployment at
`b2d8865`. Do not push product source to `main` while sessions are running: production tracks it.

## The URL participants get

**`https://lichessapp.vercel.app/`**

PR #105 merged on 2026-09-12 at 19:53Z, so the frozen build is now the production deployment and
the access problem this section used to describe is gone. Verified signed-out, not assumed:
`200`, titled `Decision Lab`, loading `assets/index-DUEXf-qq.js`, with `/build-identity.json`
reporting `gitSha: b2d8865`, `target: production`, and `/api/health` answering `200` with
`storage: "not-configured"`, which is the same storage model every walk was performed against.

The build under test did not move. Between the frozen product source `4c39563` and merged `main`,
the only change to anything the build reads is a corrected comment in
`shared/confidence-asked.ts`. Comments do not ship, and the content hash is the proof: the bundle
is the same `index-DUEXf-qq.js` the pre-registration names.

### Before each session

1. Open the URL **in a browser that is not signed in to Vercel**, or a private window.
2. Confirm the page loads `assets/index-DUEXf-qq.js`. The build is content-hashed, so that one
   string is the whole freeze check, and anything that moves it has changed the stimulus.
3. Hand the participant the URL. Nothing else is said.

### What this replaced, kept because the reasoning still applies

Before the merge the build lived only on the PR preview, which answered a signed-out visitor with
`302` to `vercel.com/sso-api`, and participants would have reached it through a protection-bypass
share link generated fresh per session. That is no longer needed. The rule that produced it stands:
**check the URL from a signed-out browser and never from the moderator's own**, because a
moderator's laptop loads the page whatever the protection says, which is exactly how a wall would
have gone unnoticed until participant 1 was sitting there.

A share link, if one is ever needed again, is a bearer credential and does not go in this
directory, a commit, a PR comment or a participant file.

## Order of use

1. [`RECRUITMENT.md`](RECRUITMENT.md) — who to ask, what to ask them, who to exclude, and what they
   may be told before the session.
2. [`SESSION_SCRIPT.md`](SESSION_SCRIPT.md) — what the moderator says, verbatim, and what the
   moderator must not say.
3. [`PARTICIPANT_TEMPLATE.md`](PARTICIPANT_TEMPLATE.md) — copy to `P1.md`, `P2.md` and so on. One
   file per participant, filled during the session, no interpretation in it.
4. [`ANALYSIS_TEMPLATE.md`](ANALYSIS_TEMPLATE.md) — filled once, after the last session, citing the
   participant files.

## The seven rules that make the run worth running

1. **No product explanation before first use.** The session starts with the URL and one sentence.
2. **Behaviour first, explanation second.** Never ask what a screen means until the participant has
   acted on it or visibly declined to.
3. **Tag every intervention** `A0`/`A1`/`A2`/`A3`, against the measure it touched, not the session.
   `A2` or `A3` anywhere in a measure means that measure did not pass cold.
4. **Do not repair the product between participants.** Five sessions against one stimulus is a
   study; five sessions against five stimuli is five anecdotes.
5. **Do not explain a failure away**, in the room or in the file. Write what happened.
6. **Do not point at `C-1`.** The two denominators are the thing being watched. A participant who
   agrees they are confusing after being shown that there are two has told you nothing.
7. **Do not change the interpretation rules after participant 1.** They are in the protocol and
   they are frozen.

## The discrimination the whole run exists to make

At the point where a participant stops, four different things can look identical from outside. The
session log has to be good enough to tell them apart, because they imply different product
decisions:

| What happened | How it shows in the log |
|---|---|
| **Cannot understand** | M1 or M2 fails. They cannot say what the thing is for, or what it currently holds, before any action question arises |
| **Understands but cannot act** | M1 and M2 pass, M3 or M4 fails. They can say what it is for and cannot find or complete the next step |
| **Can act but the next effort is not worth it** | M3 and M4 pass, M6 fails. They complete the step and say, in their own words, that they would not take another |
| **Finds value but does not voluntarily continue** | M1 to M5 pass, M6 passes, M7 fails. They say it is worth it and, in the silence, stop anyway |

The last one is a product-pull problem and must not be repaired as a legibility problem.

## Recording

Capture, per participant: the raw chronological action log with a timestamp on each event, the
assistance level per event, the verbatim answers for M1, M2, M5, M6 and M8, and **the exact state
where hesitation, abandonment or assistance first occurred**. That last field decides the
discrimination above, and it cannot be reconstructed afterwards.

Screen recording is strongly preferred. If the participant refuses recording, the session still
runs and the log is written by hand; note the refusal.
