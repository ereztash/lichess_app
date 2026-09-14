# FIELD session package

Status: **`FIELD_READY / HUMAN_PARTICIPANTS_REQUIRED`**

Everything a person needs to run the pre-registered study is in this directory. Nothing in it can
be executed by an agent: the study requires cold chess players in a room or on a call, and a
simulated participant would produce a matrix of numbers with no observation behind any of them.

The protocol is [`../FIELD_RUN_CURRENT.md`](../FIELD_RUN_CURRENT.md). It is frozen. This directory
does not restate it; it operationalises it.

## The build

**THE AUTHORITY IS [`REGISTERED_STIMULUS.json`](REGISTERED_STIMULUS.json), NOT THIS PARAGRAPH.**
The stimulus is registered there as data, the deployed check reads it, and
`tests/docs/two-identities-for-one-build.test.ts` holds this file and the protocol to it in the
direction that matters: a digest or a commit named here that the registration does not name fails
the suite. That is the direct repair for the drift recorded two paragraphs below, where prose
discipline had already been tried and had already failed.

Stimulus frozen at `stimulus_sha256`
`20c3c60dcc168b2b8e42625a375acb42dcaf5db994af48c433151b68905b7ebd`, over forty files totalling
8,865,024 bytes, produced from `d2da163c26398c83fa91401699741e26a46af5a9`, the production
deployment.
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
needed. Verified signed-out, not assumed, on 2026-09-14 at 06:12Z: `200`, titled `Decision Lab`,
loading `assets/index-ZgOyRttd.js` and `assets/index-_bGdMEE1.css`, `/stimulus-manifest.json`
answering `application/json` with `stimulus_sha256: 20c3c60d…` over 40 files,
`/build-identity.json` reporting `gitSha: d2da163c26398c83fa91401699741e26a46af5a9` and
`target: production`, and `/api/health` answering `200` with `checks.storage` equal to
`"not-configured"`, which is the same storage model every walk was performed against.

**THE BUILD UNDER TEST HAS MOVED THREE TIMES, AND THE OWNER HAS DECIDED HOW THAT STOPS.** All three
were merges to `main`, and this file's own rule -- do not push product source while sessions are
running -- is a request nothing enforces. **The third move is the one worth reading:** the commit
went `e663ebc` -> `d2da163` and the two content-hashed filenames did not move at all. What cannot
be said is that the DIGEST did not move: `e663ebc` served no manifest, so there is nothing on that
side to compare, and `../FIELD_RUN_CURRENT.md` carries the four terms that stand in for the
comparison and names what they leave open. From `d2da163` onward the question is a comparison
rather than an argument. The decision is option `(a)`, an immutable deployment, and
`../FIELD_RUN_CURRENT.md` carries it with the measurement behind it. The mechanism is production
branch set to a frozen branch instead of `main`, so merges stop moving the build behind this URL
while `main` stays live for development. **The branch exists: `field/frozen-20c3c60d`, pushed at the
commit whose deployment was verified to serve the registered digest. The dashboard half has not been
taken** and cannot be taken from the repository: Vercel -> Project -> Settings -> Git -> Production
Branch. Until it is, production still tracks `main` and the step below is the only protection.

**THE CHECK NO LONGER WAITS FOR A SESSION TO RUN, WHICH IS THE PART THAT WAS MISSING.** A
pre-session check, however good, only ever fires when a moderator is already in the room with a
participant, so a merge that moved the stimulus stayed invisible until the worst possible minute.
`tests/deployment/the-stimulus-nobody-registered.deployment.test.ts` now makes the same three
readings on every production deployment and once a day besides, and `.github/workflows/deployed.yml`
runs it. **It does not replace the step below.** Reachability and storage can change with no
deployment at all, so between the last automatic run and this participant there is a window only
this step covers. **Run it every single time.**

### Before each session

Three checks before the hand-over, and they are three because no one of them can cover the
others: reachability is not the build, and the build is not the server configuration.

1. Open the URL **in a browser that is not signed in to Vercel**, or a private window. The page must
   answer `200`. A moderator's own browser loads the page whatever the protection says, which is
   exactly how a wall would go unnoticed until participant 1 is sitting there.

2. **The build.** Open `https://lichessapp.vercel.app/stimulus-manifest.json`. The page must be
   **JSON, beginning `{`**, and its `stimulus_sha256` must equal the one in
   [`REGISTERED_STIMULUS.json`](REGISTERED_STIMULUS.json):

   ```
   20c3c60dcc168b2b8e42625a375acb42dcaf5db994af48c433151b68905b7ebd
   ```

   That one string is the whole build check, and this time the sentence is true. Behind it is the
   content hash of all **40** emitted files: every chunk, the stylesheet, all nine `.woff2` faces,
   the favicon, the share card, `index.html`, `robots.txt`, the three licences, `_headers` and
   `_redirects`. Nothing the browser fetches or obeys is outside it except the two generated
   identity files, and `scripts/stimulus-manifest.ts` says why each of those is.

   **DO NOT COMPARE THOSE SIXTY-FOUR CHARACTERS BY EYE.** A person checks the first few and the
   last few and trusts the middle, which is the one part a swapped build would differ in as
   readily as any other. If you have a terminal in the checkout, run the comparison instead and
   read one word:

   ```bash
   DEPLOYED_ORIGIN=https://lichessapp.vercel.app \
     npx vitest run tests/deployment/the-stimulus-nobody-registered.deployment.test.ts
   ```

   It prints each of the three readings as `PASS`, `WARN` or `FAIL` and exits non-zero on a `FAIL`.
   Without a terminal, paste both strings into anything that compares text. A `WARN` on the digest
   means the build moved while the run is still open with zero participants: that is a re-point to
   take to the owner before the session, not a reading to wave through.

   **IF THE APP LOADS INSTEAD, THE BUILD HAS NO MANIFEST — AND IT DOES NOT LOOK LIKE AN ERROR.**
   Measured, not assumed: on a build without one that URL answers `200 text/html`, because
   `vercel.json`'s last route sends every unmatched path to `index.html`. A browser shows the
   product. There is no `404`, no red, nothing to notice. `client/src/lib/self-check.ts` already
   refuses this trap by name — *"an SPA fallback answers `200 text/html` for any unknown path, and
   reading that as 'an older build' would be a confident and false diagnosis"* — and an early
   version of this step walked straight into it by claiming the endpoint `404`s.
   **So the check is the content and never the status code. JSON is the pass; the app is the stop.**
   A build with no manifest is a `FAIL` in every run state rather than a stale registration: it is
   not a stimulus that moved, it is a stimulus this check cannot read at all.

   **THE INTERIM CHECK IS WITHDRAWN AND IS NOT TO BE REVIVED.** While no deployment carried a
   manifest, this step named two content-hashed filenames instead, `assets/index-ZgOyRttd.js` and
   `assets/index-_bGdMEE1.css`. Production has carried the digest since `d2da163`, so the substitute
   is no longer needed, and it was never sufficient: nine `.woff2` faces, the favicon, the share
   card, `robots.txt`, `_headers` and `_redirects` carry no content hash at all, so nothing about
   their names moves when their bytes do. If a future deployment ever answers this step with the app
   again, that is a `FAIL` to take to the owner, not a signal to fall back to reading filenames.

3. **The storage model.** `https://lichessapp.vercel.app/api/health` must answer `200` with
   **`checks.storage` equal to `"not-configured"`** — nested under `checks`, not at the top level.
   Storage is not in the digest and cannot be: it is server configuration and it can change with no
   deployment at all, which is exactly why it is checked live.

   **THE `build.gitSha` IN THE SAME RESPONSE IS NOT A PASS CRITERION. RECORD IT; DO NOT COMPARE
   IT.** An earlier version of this step said the request "covers the commit as well", and that
   sentence would have stopped a valid session. It would have stopped one today: the registration
   names the commit that produced the digest, four merges have landed on `main` since, and the
   origin reports the newest of them. Each reading below was taken from the origin after that merge
   went live:

   | merge | what it touched | digest read from the origin afterwards |
   |---|---|---|
   | #115 | `research/` | `20c3c60d…` |
   | #116 | `.github/`, `research/`, `scripts/`, `tests/` | `20c3c60d…` unchanged |
   | #118 | `docs/` | `20c3c60d…` unchanged |
   | #119 | `docs/` | `20c3c60d…` unchanged |

   Not one touched `client/` or `shared/`, and the digest did not move once, over the same 40 files
   and the same 8,865,024 bytes. **The commit is expected to move while the stimulus holds**, which
   is the whole reason `gitSha` sits beside the digest rather than inside it. A moderator who treats
   a moved commit as a mismatch learns to override the step, and an overridden step is worse than an
   absent one. Write the sha into the participant file as provenance. **The digest is what gates.**

   **THE SAME HOLDS WHEN PRODUCTION STOPS TRACKING `main`.** Pointing the production branch at a
   frozen branch is a deployment of the same tree, so the digest stays and the commit the origin
   reports becomes that branch's. Read the digest. Record whatever sha comes back.

4. If the URL does not answer, the digest does not match, or storage is not `"not-configured"`,
   **stop**. (A moved `build.gitSha` is not one of these.) Do not run the session against whatever is
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
