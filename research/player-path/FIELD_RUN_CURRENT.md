# FIELD run on the frozen build

Pre-registered. Everything below the line "frozen before the first participant" was written before
any participant was recruited, and is not to be edited after the first session.

## The build under test

* Repository: `ereztash/lichess_app`, branch `claude/ux-ui-analysis-v6ao5u`.
* **Product source frozen at** `4c395637cd274c5faffb29ebb8429bfdac358eb1`.
* Later commits on this branch change documentation only, and the build is content-hashed: the
  page bundle stays `index-D_Il6CdA.js` across them, so the stimulus a participant sees is the same
  bytes. The one file that does differ is `/build-identity.json`, which names the head commit and
  the build time and is read only by the self-check overlay. Verify before a session that the
  deployed bundle still carries that hash; if it does not, the stimulus has moved and the run is
  against a different build.
* What that commit contains beyond its parent: the audit in `PRODUCT_STATE_WALK.md`, and one
  repair, B-1 (a live game can reach its second decision). No new surface, no new wording pass.
* Reachability at this commit is the `§3` table in `PRODUCT_STATE_WALK.md`. Six of the seventeen
  states are `NOT_REACHABLE` because `EXPERIMENTAL_LEARNING_ENABLED` is off. **Do not turn it on
  for this run.** A run against a different stimulus is a different run.
* Deployment: the production deployment of this commit, phone-first. Participants use their own
  phone where possible; record the device and viewport.

## Owner decisions recorded before the run

Taken by the owner after the product-state walk and before any participant was recruited.
`docs/decisions/D26-primary-evidence-path.md` holds the reasoning and the reversal conditions.

1. The long-term primary product evidence path is prospective decision evidence, `decisions`.
2. A blitz game is a context in which decisions occur. `blitzGames` must not ultimately compete
   with `decisions` as a co-equal user-facing meaning of progress.
3. **The consolidation is not implemented before this run.** `C-1` is left visible on purpose.
4. `EXPERIMENTAL_LEARNING_ENABLED` stays off. Do not enable it for any session.
5. PR #105 is frozen as the stimulus under test.

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
