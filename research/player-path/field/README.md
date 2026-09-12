# FIELD session package

Status: **`FIELD_READY / HUMAN_PARTICIPANTS_REQUIRED`**

Everything a person needs to run the pre-registered study is in this directory. Nothing in it can
be executed by an agent: the study requires cold chess players in a room or on a call, and a
simulated participant would produce a matrix of numbers with no observation behind any of them.

The protocol is [`../FIELD_RUN_CURRENT.md`](../FIELD_RUN_CURRENT.md). It is frozen. This directory
does not restate it; it operationalises it.

## The build

Product source frozen at `4c395637cd274c5faffb29ebb8429bfdac358eb1`, deployed from
[PR #105](https://github.com/ereztash/lichess_app/pull/105). The preview serves the branch head;
documentation commits do not move the bundle, and the check below is how you know. Do not push
source to that branch while sessions are running.

## The URL participants get

The frozen build lives on the PR #105 preview, and that preview is behind Vercel Authentication:
measured 2026-09-12, a signed-out visitor gets `302` to `vercel.com/sso-api`. The open production
URL is not a substitute, because it serves `main` (`assets/index-D4R4s45s.js`) rather than the
build under test.

**Decided:** a Vercel protection-bypass share link for that one preview deployment. It changes
nothing about any other deployment, nothing about production, and nothing about the project's
protection settings, and it is revocable.

**Verified**, not assumed: fetched signed-out through such a link on 2026-09-12, the page returned
`200`, titled `Decision Lab`, loading `assets/index-D_Il6CdA.js`, with `/build-identity.json`
reporting `target: preview`. That is the frozen bundle.

### Per session

1. Generate a fresh share link for the preview deployment. A generated link **expires in about 23
   hours**, so one per session is the working assumption rather than one for the study. The Vercel
   dashboard makes them on the deployment (⋯ → Share); ask if you would rather one was generated
   for you.
2. Open it **in a browser that is not signed in to Vercel**, or a private window. A moderator's own
   laptop loads the page whatever the protection says, which is exactly how this would have gone
   unnoticed until participant 1 was sitting there.
3. Confirm the page loads `assets/index-D_Il6CdA.js`. The build is content-hashed, so that one
   string is the whole freeze check: documentation commits on the branch do not move it, and
   anything that does move it has changed the stimulus.
4. Send the link to the participant, or open it on their phone. Nothing else is said.

### Never in the repository

A share link is a bearer credential: anyone holding it can open the deployment. It does not go in
this directory, in a commit, in a PR comment, or in a participant file. The participant file
records **that** a link was used and **which bundle hash** it served, which is the part that
matters for the record.

### The one thing that would remove the expiry

Promoting the frozen build to the project's production URL, which is already open, would give a
stable link with no regeneration and no settings change. It also changes what the public production
URL serves, so it is an owner decision rather than a session detail, and it is not assumed here.
Merging #105 is not on this list at all: the PR was frozen as the stimulus, and merging it to
unblock a URL is a different decision wearing a convenient hat.

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
