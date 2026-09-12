# FIELD session package

Status: **`FIELD_READY / HUMAN_PARTICIPANTS_REQUIRED`**

Everything a person needs to run the pre-registered study is in this directory. Nothing in it can
be executed by an agent: the study requires cold chess players in a room or on a call, and a
simulated participant would produce a matrix of numbers with no observation behind any of them.

The protocol is [`../FIELD_RUN_CURRENT.md`](../FIELD_RUN_CURRENT.md). It is frozen. This directory
does not restate it; it operationalises it.

## The build

Product source frozen at `4c395637cd274c5faffb29ebb8429bfdac358eb1`, deployed from
[PR #105](https://github.com/ereztash/lichess_app/pull/105). **Before each session, from a browser not signed in
to Vercel, check that the page opens at all and loads `assets/index-D_Il6CdA.js`.** The build is content-hashed, so that one string
is the whole check: documentation commits on the branch do not move it, and anything that does move
it has changed the stimulus. Do not push source to that branch while sessions are running.

## Blocker: participants cannot open the frozen build

Measured on 2026-09-12, not inferred.

| URL | What a participant gets |
|---|---|
| The PR #105 preview, `lichessapp-git-claude-ux-ui-analysis-v6ao5u-ereztashs-projects.vercel.app` | **HTTP 302 to `vercel.com/sso-api`.** A Vercel login wall |
| Production, `lichessapp.vercel.app` | HTTP 200, the real page, loading `assets/index-D4R4s45s.js`. That is `main`, **not** the frozen stimulus |

The Vercel project carries `ssoProtection: enabled, all_except_custom_domains` and has no custom
domain, so the only deployment a stranger can open is the one that is not under test.

**The run cannot start until this is resolved, and resolving it is the owner's call.** Three ways,
narrowest first:

1. **A protection-bypass share link for that one preview deployment.** Changes nothing about any
   other deployment, and the link can be revoked after the last session. This is the option that
   keeps the freeze and the privacy.
2. **A custom domain pointed at the preview.** `all_except_custom_domains` exempts it by
   definition.
3. **Turning SSO protection off for previews.** Simplest, and it makes every future preview of this
   project public, which is a standing change to pay for a five-session study.

Merging #105 so that production serves the frozen build is **not** on this list: the owner froze
the PR as the stimulus, and merging it is a different decision that should not be taken to unblock
a URL.

Whichever is chosen, run the bundle check below on the URL participants will actually be given,
from a browser that is not signed in to Vercel. A moderator's own laptop is signed in and will load
the page whatever the setting says, which is exactly how this would have gone unnoticed until
participant 1 was sitting there.

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
