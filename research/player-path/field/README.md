# FIELD session package

Status: **`FIELD_READY / HUMAN_PARTICIPANTS_REQUIRED`**

Everything a person needs to run the pre-registered study is in this directory. Nothing in it can
be executed by an agent: the study requires cold chess players in a room or on a call, and a
simulated participant would produce a matrix of numbers with no observation behind any of them.

The protocol is [`../FIELD_RUN_CURRENT.md`](../FIELD_RUN_CURRENT.md). It is frozen. This directory
does not restate it; it operationalises it.

## The build

Product source frozen at `e663ebc6c2493c30ca0d29bb1ce61cdf1f289cab`, the production deployment.
Do not push product source to `main` while sessions are running: production tracks it.

**THIS SECTION HAD DRIFTED, AND THE DRIFT IS RECORDED RATHER THAN QUIETLY OVERWRITTEN.** It named
`4c39563` and `b2d8865` while claiming the `index-DUEXf-qq.js` bundle, which those two commits do
not build. What happened: `9818a62` pointed this file at production when PR #105 merged, then
`6053af2` re-froze the protocol and updated the HASH here without updating the commit identities
beside it. Two identities for one build, in the one file a moderator opens before a session. It is
fixed here and it is why the check below is the hash rather than a commit: **a sha in prose can
disagree with the bytes, and a content hash cannot.**

## The URL participants get

**`https://lichessapp.vercel.app/`**

Production tracks `main`, so the frozen build is the production deployment and no share link is
needed. Verified signed-out, not assumed, on 2026-09-13 at 19:25Z: `200`, titled `Decision Lab`,
loading `assets/index-ZgOyRttd.js`, with `/build-identity.json` reporting
`gitSha: e663ebc6c2493c30ca0d29bb1ce61cdf1f289cab`, `builtAt: 2026-09-13T17:26:33Z` and
`target: production`, and `/api/health` answering `200` with `storage: "not-configured"`, which is
the same storage model every walk was performed against.

**THE BUILD UNDER TEST HAS MOVED TWICE, AND THE OWNER HAS DECIDED HOW THAT STOPS.** Both moves were
merges to `main`, and this file's own rule -- do not push product source while sessions are running
-- is a request nothing enforces. The decision is option `(a)`, an immutable deployment, and
`../FIELD_RUN_CURRENT.md` carries it with the measurement behind it. **The mechanism is a Vercel
dashboard action that has not been taken**: production branch set to a frozen branch instead of
`main`, so merges stop moving the build behind this URL while `main` stays live for development.
Until it is taken, production still tracks `main` and the check below is the only thing between a
session and a stimulus nobody registered. **Run it every single time.**

### Before each session

Three checks before the hand-over, and they are three because no one of them can cover the
others: reachability is not the build, and the build is not the server configuration.

1. Open the URL **in a browser that is not signed in to Vercel**, or a private window. The page must
   answer `200`. A moderator's own browser loads the page whatever the protection says, which is
   exactly how a wall would go unnoticed until participant 1 is sitting there.

2. **The build.** Open `https://lichessapp.vercel.app/stimulus-manifest.json`. The page must be
   **JSON, beginning `{`**, and its `stimulus_sha256` must equal the one in
   `../FIELD_RUN_CURRENT.md`.

   **IF THE APP LOADS INSTEAD, THE BUILD HAS NO MANIFEST — AND IT DOES NOT LOOK LIKE AN ERROR.**
   Measured, not assumed, on 2026-09-13 at 21:05Z: that URL answers `200 text/html` on the frozen
   build, because `vercel.json`'s last route sends every unmatched path to `index.html`. A browser
   shows the product. There is no `404`, no red, nothing to notice. `client/src/lib/self-check.ts`
   already refuses this trap by name — *"an SPA fallback answers `200 text/html` for any unknown
   path, and reading that as 'an older build' would be a confident and false diagnosis"* — and the
   first version of this step walked straight into it by claiming the endpoint `404`s.
   **So the check is the content and never the status code.**

   **The value in the protocol is currently `PENDING`** because the frozen build predates the
   generator, so seeing the app there today is expected. What a build that DOES carry it looks like
   was checked rather than imagined: the `PR #111` preview at `fce720a` answered
   `content-type: application/json` with a manifest over 40 files on 2026-09-13 at 20:53Z. **JSON is
   the pass; the app is the stop.** Until the deploy that carries it, the
   interim check is the two content-hashed filenames in the page source,
   `assets/index-ZgOyRttd.js` **and** `assets/index-_bGdMEE1.css`. Two filenames is better than the
   one this file used to name, and it is **still not sufficient**: nine `.woff2` faces, the favicon,
   the share card, `robots.txt`, `_headers` and `_redirects` carry no content hash at all, so
   nothing about their names moves when their bytes do. That is the whole reason the digest exists.

3. **The storage model.** `https://lichessapp.vercel.app/api/health` must answer `200` with
   `storage: "not-configured"`. This is not in the digest and cannot be: it is server configuration
   and it can change with no deployment at all, which is exactly why it is checked live.

4. If **any** of the three does not match, **stop**. Do not run the session against whatever is
   there and do not update this file to match it: check with the owner first, because a mismatch
   means either a merge landed or the pre-registration is describing a build nobody is serving.

5. Hand the participant the URL. Nothing else is said.

### Why the check is a digest and not a filename

This file used to say that confirming one content-hashed JS filename was "the whole freeze check".
The build emits **forty** files. The named one is 695,047 bytes of 8,865,024 -- **7.8%** -- and
eighteen of the forty carry no content hash in their name at all. Swapping a Hebrew face changes
what every participant reads and leaves the JS filename exactly where the protocol says it should
be. The check would have passed.

The repair is not a longer list of filenames, which is the same defect with a later expiry date.
`scripts/write-stimulus-manifest.ts` walks whatever the build wrote, hashes every file and publishes
one `stimulus_sha256`. The enumeration is the walk, so an asset kind nobody anticipated cannot slip
past it.

### What this replaced, kept because the reasoning still applies

Before the merge the build lived only on the PR preview, which answered a signed-out visitor with
`302` to `vercel.com/sso-api`, and participants would have reached it through a protection-bypass
share link generated fresh per session. That is no longer needed for the URL above, and the same
wall is why the run is not pinned to a per-deployment URL: measured signed-out on 2026-09-13,
`lichessapp.vercel.app` answers `200` and the production deployment's own URL answers `302` to
`vercel.com/sso-api`. The project protects every deployment URL and exempts the alias.

The rule that produced all of this stands: **check the URL from a signed-out browser and never from
the moderator's own**, because a moderator's laptop loads the page whatever the protection says,
which is exactly how a wall would have gone unnoticed until participant 1 was sitting there.

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
