# FIELD run on the frozen build

Pre-registered. Everything below the line "frozen before the first participant" was written before
any participant was recruited, and is not to be edited after the first session.

## The build under test

* Repository: `ereztash/lichess_app`, branch `main`.
* **Stimulus registered at**
  `20c3c60dcc168b2b8e42625a375acb42dcaf5db994af48c433151b68905b7ebd`, forty files, 8,865,024 bytes,
  built from `d2da163`. **The machine-readable registration is
  [`field/REGISTERED_STIMULUS.json`](field/REGISTERED_STIMULUS.json) and it is the authority**;
  this paragraph and `field/README.md` are held to it by
  `tests/docs/two-identities-for-one-build.test.ts`, in both documents, so the drift that produced
  two identities for one build cannot recur as prose.
* **RE-FROZEN THREE TIMES, ALL THREE BEFORE ANY PARTICIPANT, AND THAT IS THE ONLY REASON ANY WAS
  ALLOWED.** **Zero participants have run**, which is what makes this bookkeeping rather than a
  protocol violation. After the first session it would be one, and the same change would have to
  wait.

  **THAT SENTENCE IS NOW A MECHANISM RATHER THAN A PROMISE.** It governed three re-freezes while
  being enforced by nobody: the only thing between a legitimate re-point and a protocol violation
  was somebody remembering it at the right moment. It is `state` and `participantsRun` in the
  registration, read by `scripts/field-stimulus.ts`. While the run is `open` with zero participants
  a moved stimulus is a `WARN` naming the re-point; the instant either field leaves that state the
  identical reading is a `FAIL`. The escalation has a positive control in
  `tests/fixtures/controls/field-stimulus.control.test.ts` that must go red, because a leniency
  nobody has watched escalate is a leniency.

  | # | from | to | why |
  |---|---|---|---|
  | 1 | `4c39563` / `index-D_Il6CdA.js` | `dd30b3a` / `index-DUEXf-qq.js` | the owner reported, from a phone frame, that step 2's option list was scrolling inside a clipped box. The repair changes the commitment screen, and a changed commitment screen is a changed stimulus |
  | 2 | `dd30b3a` / `index-DUEXf-qq.js` | `e663ebc` / `index-ZgOyRttd.js` | [PR #109](https://github.com/ereztash/lichess_app/pull/109) merged. Production tracks `main`, so the merge moved the deployment off the named hash |
  | 3 | `e663ebc` / `index-ZgOyRttd.js` | `d2da163` / `20c3c60d…` | [PR #111](https://github.com/ereztash/lichess_app/pull/111) merged and production rebuilt, so the deployment now carries the manifest. **This is the re-freeze that installs the mechanism**: the build identity stops being a filename somebody transcribes and becomes a digest the origin serves |

* **THE SECOND RE-FREEZE HAS A DIFFERENT CHARACTER FROM THE FIRST, AND THE DIFFERENCE IS THE POINT.**
  The first was a changed stimulus: a participant would have seen something else. The second is a
  changed BUNDLE with an unchanged participant-facing surface. Measured rather than assumed: between
  `dd30b3a` and `e663ebc` the only file under `client/src` that moved is
  `client/src/lib/next-action-shadow.ts`, which renders nothing, and everything else is `shared/`
  read by the record's stratification, the journey ledger's refuted sentence (behind
  `EXPERIMENTAL_LEARNING_ENABLED`, off) and two modules nothing renders. A participant arrives with
  an empty record, so there are no strata to partition and no rule to grade.
  **The limit of that statement:** it is an argument from the diff and the import graph, not a walk.
  What is certain is the hash moved; what is argued is that nothing a cold participant meets did.

* **THE FREEZE KEEPS BREAKING FOR A STRUCTURAL REASON, AND IT IS NOT THE MERGES.** The stimulus is
  pinned to production and production tracks `main`, so the pre-registration is pinned to a moving
  target: any merge invalidates it, and two have. A pre-registration that is re-pointed whenever the
  code moves is weaker than one that cannot move.

* **THE OWNER HAS NOW CHOSEN, AND THE CHOICE IS (a): THE RUN IS PINNED TO AN IMMUTABLE DEPLOYMENT.**
  `(b)` holding `main` frozen was rejected because it stops development for the length of the run.
  `(c)` continuing to re-freeze was rejected because it is unavailable the moment the participant
  count leaves zero, and because a habit re-decided every week is decision debt rather than a
  decision. What remains is `(a)`, and two things about it were not known when it was written down.

  **FIRST: THE PER-DEPLOYMENT URL IS NOT REACHABLE BY A PARTICIPANT.** Measured signed-out, not
  assumed, on 2026-09-13 at 20:02Z:

  | URL | signed-out response |
  |---|---|
  | `https://lichessapp.vercel.app/` | `200` |
  | `https://lichess-72bn8nwd7-ereztashs-projects.vercel.app/` (the production deployment's own URL) | `302` to `vercel.com/sso-api` |

  The project carries `ssoProtection: all_except_custom_domains`, which exempts the project alias
  and protects every per-deployment URL. So `(a)` **cannot be implemented by handing a participant a
  deployment URL**: that path needs either a protection-bypass share link, which is a bearer
  credential this package has already refused, or a project-wide protection change that would make
  every preview deployment publicly reachable for good. Both are worse than the problem.

  **SECOND: THE PROPERTY (a) WANTS DOES NOT REQUIRE THAT URL.** What `(a)` is for is that nothing
  routine can move the build behind the address a participant opens. The address can stay
  `lichessapp.vercel.app` -- already public, already verified -- and the immutability can come from
  the other end: **set the Vercel project's production branch to a branch that is not `main`** (say
  `field-stimulus`, at `e663ebc`). Merges to `main` then build previews and do not touch production.
  This is not `(b)`: `main` stays completely live for development, which was the entire objection to
  `(b)`. It is `(a)`'s property without `(a)`'s exposure cost.

  **THIS IS A DASHBOARD ACTION AND IT HAS NOT BEEN TAKEN.** Vercel -> Project -> Settings -> Git ->
  Production Branch. It cannot be done from the repository and it was not done from this session.
  **Until it is taken, production still tracks `main` and the check below is the only protection.**

* **THE FREEZE CHECK NAMED ONE FILE OUT OF FORTY, AND THAT IS A SEPARATE DEFECT FROM THE MOVING
  TARGET.** `field/README.md` told the moderator that confirming `assets/index-ZgOyRttd.js` was
  "the whole freeze check". The build emits forty files totalling 8,865,024 bytes; the named one is
  695,047 of them, **7.8%**. Eighteen of the forty carry no content hash in their name at all --
  nine `.woff2` faces, `favicon.svg`, `share-card.png`, `index.html`, `robots.txt`, three licence
  files, `_headers`, `_redirects` -- so their names do not move when their bytes do. A swapped
  Hebrew face changes what every participant reads and leaves the JS filename exactly where this
  document says it should be. The check would pass.

  **THE REPAIR IS NOT A LONGER LIST.** Naming the stylesheet as well reproduces the same defect with
  a later expiry date. `scripts/write-stimulus-manifest.ts` walks whatever the build wrote, hashes
  every file and reduces the lot to one `stimulus_sha256`, served at `/stimulus-manifest.json`
  beside `/build-identity.json`. The enumeration is the walk, so an asset kind nobody anticipated
  cannot escape it. What is deliberately outside the digest, and why, is in
  `scripts/stimulus-manifest.ts`; the short version is the two generated identity files, because one
  carries the digest and the other carries a timestamp that moves on every rebuild.

  **TWO CONDITIONS CANNOT BE IN A BUILD-TIME HASH AND STAY RUNTIME CHECKS**, because both can change
  with no deployment at all: whether the origin answers a signed-out visitor, and what `/api/health`
  reports for `storage`. The pre-session procedure checks the three things separately;
  `field/README.md` carries it.

* **THE MANIFEST IS NOW ON PRODUCTION, AND THE NUMBER WAS READ FROM THE ORIGIN RATHER THAN
  COMPUTED.** `e663ebc` was built before the generator existed and
  `https://lichessapp.vercel.app/stimulus-manifest.json` answered **`200 text/html`**, the app
  itself, measured signed-out on 2026-09-13 at 21:05Z. It never answered `404`: `vercel.json` sends
  every unmatched path to `index.html`. An earlier draft of this bullet said `404` and was wrong,
  which matters because the pre-session step turns on it, and the step is kept in its corrected
  form because the trap outlives the build that demonstrated it.

  Measured signed-out on 2026-09-14 at 06:12Z, production at `d2da163` answers
  `application/json; charset=utf-8` with a well-formed manifest:
  `stimulus_sha256` **`20c3c60dcc168b2b8e42625a375acb42dcaf5db994af48c433151b68905b7ebd`**,
  `target: production`, **40 files, 8,865,024 bytes**, all five recorded flags unset. The `/` route
  answers `200` signed out and `/api/health` reports `checks.storage` equal to `"not-configured"`.
  **Read from the endpoint, never computed locally**, because a build inlines `VITE_` variables and
  this checkout has none of them set; a local digest is the right answer only if the deployment's
  flags match, and the manifest records those flags so a reader can tell rather than assume.

* **WHAT THE DIGEST CANNOT DO IS COMPARE ITSELF BACKWARDS, AND THAT LIMIT NEVER CLOSES.** `e663ebc`
  served no manifest, so there is no digest for the build the first two freezes named and there
  never will be one. Whether the stimulus a participant would have met actually moved between
  `e663ebc` and `d2da163` is therefore still an argument rather than a comparison. It is a strong
  one, and these are its four terms, each measured:

  * `git diff --name-only e663ebc d2da163 -- client/` is **empty**. No product source moved.
  * `package-lock.json` is untouched, so the toolchain that compiled it is the same one.
  * Both content-hashed filenames are identical to the ones `e663ebc` served:
    `assets/index-ZgOyRttd.js` at 695,047 bytes and `assets/index-_bGdMEE1.css` at 95,435.
  * The file count and the total size, **40 and 8,865,024**, are the same two numbers measured on
    the build that produced the 7.8% finding.

  Four agreeing terms are not a digest. The residual is a pair of unhashed files exchanging bytes
  while preserving the total exactly, which is not credible and is also not excluded. **From
  `d2da163` forward the question stops being an argument**, which is the whole of what this
  re-freeze bought.

* **THE MECHANISM IS VERIFIED ON A DEPLOYMENT, not only in a test.** The `PR #111` preview at
  `fce720a` was fetched at 2026-09-13 20:53Z and answered
  `content-type: application/json; charset=utf-8` with a well-formed manifest over **40 files** --
  so `vercel.json`'s `{"handle": "filesystem"}` step does serve a real file and the SPA fallback
  only catches paths that do not exist. Two things fell out of it that are worth the sentence:

  * its `stimulus_sha256` is **`20c3c60d…`, byte-for-byte the digest the same source produced on a
    different machine**, with all five recorded flags unset on both. The generator is
    deterministic across machines when the flags agree, which is what makes a mismatch mean
    something rather than mean "a different builder".
  * its entry chunk is `assets/index-ZgOyRttd.js` at **695,047 bytes, identical to production's**,
    which is independent confirmation that nothing in this pass touched product code.

  **THAT MEANT ONE MORE RE-FREEZE, AND IT IS THE ONE THAT INSTALLS THE MECHANISM.** Row 3 above.
  It was still bookkeeping rather than a protocol violation for the reason the first two were:
  **zero participants have run.** After it the build identity stops being a filename somebody
  transcribes and becomes a digest the origin serves.

* **THE INTERIM CHECK IS WITHDRAWN.** While no deployment carried a manifest the substitute was the
  two content-hashed filenames, `assets/index-ZgOyRttd.js` and `assets/index-_bGdMEE1.css`. Two is
  better than one and it was never sufficient: it cannot see a font, a favicon, a share card or a
  header rule change, which is the finding above. Production has carried the digest since
  `d2da163`, so the substitute is retired rather than kept as a fallback. **An origin that answers
  the manifest step with the app again is a `FAIL`, not a signal to go back to reading filenames.**

* **AND THE CHECK NO LONGER WAITS FOR A MODERATOR.** A pre-session check fires only when somebody
  is already in the room with a participant, so a merge that moved the stimulus stayed invisible
  until the worst minute to discover it. `tests/deployment/the-stimulus-nobody-registered.deployment.test.ts`
  makes the same three readings against the live origin on every production deployment and once a
  day besides, through `.github/workflows/deployed.yml`. It does not replace the pre-session step:
  reachability and storage change with no deployment at all, so the window between the last
  automatic run and this participant is covered by nothing else.

* **Nothing else in this file moved.** The participants, the conditions, the assistance tags, M1 to
  M8 and the interpretation rules are exactly as first frozen. Only the build identity is new.
* Verify before each session, from a signed-out browser, that the origin answers, that the stimulus
  digest is the registered one and that storage is the model every walk was performed against. The
  procedure is `field/README.md`, and it is three checks rather than one filename for the reason
  above. As of this file production serves the registered stimulus: verified signed-out on
  2026-09-14 at 06:12Z, `/stimulus-manifest.json` carrying `20c3c60d…` over 40 files,
  `/build-identity.json` reporting `gitSha: d2da163c2639…` and `target: production`, the page `200`,
  and `/api/health` `200` with `checks.storage` equal to `"not-configured"` -- nested under `checks`
  rather than at the top level, a shape first verified on 2026-09-13 at 22:29Z and unchanged since.
* What that commit contains beyond the previous freeze: the recursive spine and the policy-space
  analysis of [PR #109](https://github.com/ereztash/lichess_app/pull/109), `D27` and `D28`. No new
  surface, no new wording pass, and no change to any screen.
* Reachability at this commit is the `§3` table in `PRODUCT_STATE_WALK.md`. Six of the seventeen
  states are `NOT_REACHABLE` because `EXPERIMENTAL_LEARNING_ENABLED` is off. **Do not turn it on
  for this run.** A run against a different stimulus is a different run.
* Deployment: phone-first, participants on their own device; record the device and viewport.
  Check the URL from a signed-out browser, never from the moderator's own, and run the build check
  before the participant touches it. `field/README.md` carries the procedure and why the signed-out
  check matters.

## Owner decisions recorded before the run

Taken by the owner after the product-state walk and before any participant was recruited.
`docs/decisions/D26-primary-evidence-path.md` holds the reasoning and the reversal conditions.

1. The long-term primary product evidence path is prospective decision evidence, `decisions`.
2. A blitz game is a context in which decisions occur. `blitzGames` must not ultimately compete
   with `decisions` as a co-equal user-facing meaning of progress.
3. **The consolidation is not implemented before this run.** `C-1` is left visible on purpose.
4. `EXPERIMENTAL_LEARNING_ENABLED` stays off. Do not enable it for any session.
5. PR #105 is frozen as the stimulus under test.
6. **The run is pinned to an immutable deployment, option `(a)`.** Recorded 2026-09-13. Re-freezing
   on every merge is not a policy and holding `main` still is not affordable. The mechanism, the
   measurement that ruled out the per-deployment URL, and the dashboard action this still requires
   are in "The build under test" above. **The action has not been taken; production still tracks
   `main` until it is.**

The run's purpose, given those: determine whether the product, **with these structural facts left
visible**, is understandable and worth continuing through without founder interpretation.

## Why this run exists

Every question `PRODUCT_STATE_WALK.md` could answer from the repository has been answered. What is
left is human: whether a cold player understands what the product is for, where they are in it,
what to do next, and what the numbers do and do not claim. No further repository reasoning can
substitute for that. The remaining REPO items (C-1) and OWNER items (B-3, B-4) are deliberately
left standing so the run measures the product as it is rather than a product tuned to the test.

---

## Frozen before the first participant

### Participants

3 to 5 cold chess players.

Recruit on two axes only: they play chess, and they are not already inside this project.

Record before the session, in the participant's own words where the field says so:

| Field | How recorded |
|---|---|
| Rating | Their own number and where it comes from (Lichess, Chess.com, FIDE, "no idea") |
| Existing analysis workflow | Own words. What they currently do after a game, if anything |
| Improvement intent | Own words. What they are trying to get better at, if anything |
| Prior knowledge of Decision Lab | None / heard of it / has seen a screen / has used it |

**Excluded:** anyone previously coached through this build, anyone who has seen a walkthrough of
it, and anyone who has been in a conversation about its design.

### Conditions

No product explanation before first use. The session starts with the participant opening the URL
and nothing else said beyond "open this and do what you would do".

Every intervention is tagged, per moment, at the highest level used:

* **A0** none.
* **A1** navigation only ("the button is further down", "scroll").
* **A2** product explanation (what the product is, what a screen is for, what a stage means).
* **A3** result interpretation (what a number, a finding or a negative state means).

**A2 or A3 anywhere in a measure means that measure did not pass cold.** Record the tag against
the measure, not against the session.

Order: behaviour first, explanation second. Never ask what they think a screen means until after
they have acted or visibly declined to act.

### Measures

| # | Measure | Observable | Passes when |
|---|---|---|---|
| M1 | Value comprehension | Asked, after first use: what is this trying to do differently from ordinary engine analysis? | They name the pre-verdict commitment, or the separation between what the move cost and what happened on the way to choosing it, in their own words. Naming "an engine that tells you your mistakes" is a fail |
| M2 | Journey orientation | Asked at a mid-session moment: where are you now, and what does the app know about you? | They can say what the product currently holds and what it does not, without inventing a claim it has not made |
| M3 | Next-action selection | Observed. At each state change, do they choose an action without help? | They act at A0 or A1 |
| M4 | Execution | Observed. Does the action they chose complete? | It completes without A2/A3 |
| M5 | Evidence boundary | Asked, after at least one counter has moved: does a higher number mean the app knows more, or that you have got better? | They separate the two. Any answer that treats the counter as a skill measure is a fail |
| M6 | Payoff | Observed first, then asked: is the next unit of effort worth it? | They say what they would get for it, and it matches something the product can actually produce |
| M7 | Organic continuation | Observed. Give one natural stopping point (a finished game, a reveal read, a negative state) and say nothing for 60 seconds | They continue without prompting |
| M8 | Negative-state comprehension | Observed and asked, at a boring state. Reach at least one: a finished blitz game with no finding, or the record page's shortfall | They can say what the negative result means and what follows from it |

Every participant must meet at least one negative state. If the session would not produce one
naturally, let it run to a finished blitz game, which reliably does.

### Where each state comes from in this build

* M1, M3, M4: cold `/`, then whichever door they pick.
* M2, M5: the record page after at least one recorded decision or one finished blitz game.
* M6, M7: the moment after the first reveal, and the moment after the first finished blitz game.
* M8: the post-game reading, or the record page's shortfall sentence.
* C-1 is the thing to watch under M2 and M5: two denominators on one page. Do not point at it.

## Frozen interpretation rules

These map the outcome to the layer that owns the problem. They are frozen now and are not to be
changed after observing participants.

| Outcome | Problem layer |
|---|---|
| M1 fail | Value-contract / comprehension |
| M1 pass, M2 fail | Journey orientation |
| M2 pass, M3 fail | Next-action / orchestration |
| M3 pass, M4 fail | Interaction / execution |
| M4 pass, M6 fail | Payoff / time-to-value |
| M5 fail | Evidential aliasing / claim boundary |
| A2 or A3 required for any success | Founder dependence |
| M1 to M5 pass, M7 fail | Value / pull. **Not** a UX-legibility failure, and must not be repaired as one |

Two additions, for hazards this build specifically carries. Both were written before the run:

* **M5 fail where the participant names the wrong denominator** (talks about games when the screen
  they are on counts decisions, or the reverse) is evidential aliasing attributable to C-1, not to
  the participant. Record which denominator they used.
* **M8 read as failure** ("so it didn't work", "there's nothing here") rather than as a result is a
  claim-boundary problem, not a copy problem. The sentences already say the result is valid; if
  they do not land, the layer at fault is the contract, not the wording.

### The four-way discrimination

Not a new rule. A restatement of the frozen mapping above, in terms of what the participant file
has to be good enough to separate, because these four look identical from outside at the moment a
participant stops and they imply different product decisions.

| What happened | How it reads in the frozen rules |
|---|---|
| Cannot understand | M1 or M2 fails |
| Understands but cannot act | M1 and M2 pass, M3 or M4 fails |
| Can act but the next effort is not worth it | M3 and M4 pass, M6 fails |
| Finds value but does not voluntarily continue | M1 to M6 pass, M7 fails. Product pull, not legibility |

The field that decides which one it was is the exact state where hesitation, abandonment or
assistance **first** occurred. It cannot be reconstructed after the session.

### What is not the dependent variable

Whether a participant spontaneously asks the six orientation questions of `§5`. That decomposition
is an analytical instrument, not a thing users produce. The test is whether they can orient
correctly when probed behaviourally and neutrally. Recurrence of that phrasing measures nothing.

## The session package

`research/player-path/field/` operationalises this protocol without restating it: recruitment and
screening, the moderator script with every probe written verbatim, the per-participant file and the
analysis template. Read `field/README.md` first.

## Recording

One file per participant under `research/player-path/field/`, named by participant code. Each
records: the pre-session table, a timestamped action log with an assistance tag per moment, the
verbatim answers for M1, M2, M5, M6 and M8, and the M7 observation. No interpretation in the
participant file. Interpretation goes in one summary that cites the files.

## Stop rules

* Stop the run early if three consecutive participants fail M1 at A0. The value contract is the
  blocker and nothing downstream is measurable through it.
* Stop a session if the participant cannot reach a second decision or a finished game within 20
  minutes. Record where it stopped; that is the finding.
