# FIELD session package

Status: **`FIELD_READY / HUMAN_PARTICIPANTS_REQUIRED`**

Everything a person needs to run the pre-registered study is in this directory. Nothing in it can
be executed by an agent: the study requires cold chess players in a room or on a call, and a
simulated participant would produce a matrix of numbers with no observation behind any of them.

The protocol is [`../FIELD_RUN_CURRENT.md`](../FIELD_RUN_CURRENT.md). It is frozen. This directory
does not restate it; it operationalises it.

## The build

Product source frozen at `dd30b3a`, page bundle `assets/index-DUEXf-qq.js`. It reached `main`
through [PR #107](https://github.com/ereztash/lichess_app/pull/107) as merge commit `c18c836`,
whose tree is byte-identical to the frozen head `6053af2`, which is why the content hash does not
move across the merge. Production tracks `main`: do not push product source to it while sessions
are running.

## The URL participants get

**`https://lichessapp.vercel.app/`**

Verified signed-out on 2026-09-13 at 16:56Z, not assumed:

```
https://lichessapp.vercel.app/     200, <title>Decision Lab — החלטה, ואז חשיפה</title>
                                   loads assets/index-DUEXf-qq.js
/build-identity.json               gitSha c18c836, target production
/api/health                        200, storage: not-configured
```

`storage: not-configured` matters as much as the hash: it is the storage model every walk in
`../PRODUCT_STATE_WALK.md` was performed against, so a participant's records live in their browser
exactly as they did in the audit.

### This section once recorded an observation it had never made

The paragraph above used to read `gitSha: b2d8865` together with `assets/index-DUEXf-qq.js`, under
the words *verified signed-out, not assumed*. Those two never appeared together. At `b2d8865`
production served `index-D_Il6CdA.js`, which is the **first** freeze, and that was still true when
production was read at 15:46Z on 2026-09-13, an hour before the merge.

How it happened is worth keeping. Commit `6053af2` re-froze the stimulus and updated the bundle
hash in this file in three places. Two were instructions about what a moderator should expect to
see, and were right to move. The third sat inside a record of what had already been seen, and
moving it rewrote history into something that had not happened. The same commit deliberately left
the old hash standing in `research/instrument-telos/CURRENT_STATE.md`, for exactly this reason, and
said so in its message. The principle was applied in one file and missed in the one next to it.

A record and an instruction can carry the same string and still are not the same kind of sentence.
An instruction is updated when the world moves. A record is not.

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
