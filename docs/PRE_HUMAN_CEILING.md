# Pre-human ceiling

**The stopping condition, as it was written on 2026-09-03:** *"Every material uncertainty the
repository, its data, an owner decision or the production environment is competent to settle has
been settled. What remains is either external configuration nobody in the tree can perform, or
evidence only a person outside this project can supply."*

**That sentence was falsified on 2026-09-04**, and it is kept here rather than rewritten because the
way it failed is the most useful thing in this file. Four repo-native uncertainties were open on the
tree it was written about. The next section says what they were, what closed them, and why closing
them does not license saying it again.

Two ceilings, and they are not the same. The second needs four things that are not code.

---

## The reopening — 2026-09-04

**A ceiling is a claim, and this one was falsified.** The sentence at the top of this file said that
every material uncertainty the repository is competent to settle had been settled. Four Neta
falsification runs against `main@f1315d7` found four that had not been, and every one of them is
repo-native: no environment, no owner and no field evidence was needed to see them or to close them.

**What the saturation reading actually meant.** Three orthogonal discovery runs in a row had
produced no novelty that changed an action, and that was read as "nothing is left". It is not the
same statement. Saturation says a search stopped finding things; it says nothing about what a
different search would find, and the run that came next found four things in one pass. The reading
that survives is narrower and is worth keeping: **the fourth run was the last one authorised before
fixing, not before declaring.**

**The four families, what each one substituted for what, and what closed it.**

| | family | the illegal inference | closed by | reversed by |
| --- | --- | --- | --- | --- |
| ☑ | **F1** provenance preserved, then lost at aggregation | a set of decisions from two measurement regimes read as one population | [`tests/shared/a-reading-that-pooled-two-regimes.test.ts`](../tests/shared/a-reading-that-pooled-two-regimes.test.ts) — `forDescriptiveHistory` and `forAnchorReference` return strata; `recordReading` reads the regime in force once it clears `MIN_BUCKET_N`, the largest until then, and reports the rest | a reading whose `n` spans two `stratumId`s |
| ☑ | **F2** local eligibility read as global certification | one confidence level over `MIN_BUCKET_N` certifying a decomposition mostly made of levels under it | [`tests/shared/one-eligible-cell-is-not-a-certificate.test.ts`](../tests/shared/one-eligible-cell-is-not-a-certificate.test.ts) — `reliable` is `some` and `unreadableShare` reports how much of the figure rests on cells too thin to read | a displayed decomposition with no share beside it |
| ☑ | **F3** producer completion read as consumer exposure | `atom.result !== null` spent as "the player was shown this" | [`tests/client/a-verdict-the-player-was-never-shown.test.tsx`](../tests/client/a-verdict-the-player-was-never-shown.test.tsx) — `verdictWithheldWhenComputed`, and `OneThingMix.withheld` beside `n` | a record surface counting stored verdicts as things a player saw |
| ☑ | **F4** historical event reconstructed with current semantics | "מה הכלי אמר לכם עד כה" computed by re-running today's branch rules on old rows | [`tests/client/what-the-tool-says-now-is-not-what-it-said-then.test.ts`](../tests/client/what-the-tool-says-now-is-not-what-it-said-then.test.ts) — the page states which of the two readings it is, held there by a source-level assertion | the mix block using the vocabulary of past presentation |

Each carries a counterexample that was **red before the repair and green after**, and a positive
control that fails if the repair were "stop saying anything": two regimes stay apart *and* one regime
still aggregates; a thin level's share of the figure is named *and* is exactly zero once every used
level clears the floor, with the flag never turning off as the record grows; a deferred verdict is
not exposure *and* a coached one still reads as the tool speaking; today's classification is not a
transcript *and* is still correct under today's rule.

**Both first repairs were themselves falsified, and that is the most useful row in this section.**
F2 first shipped `reliable = every used level clears the floor` — the obvious generalisation of
`BucketReading.measurable`, needing no new constant, killing its counterexample outright. Simulated
on four confidence distributions at 4,000 records each, it certified on **0.0%** of concentrated
records at every size up to 2,000 and 2.0% at 4,000; and it is **not monotone** — 60 decisions
across two levels certify, the same record plus ONE correct decision stated at 95% does not. An
instrument that unanswers a question because it was given more evidence is not stricter, it is
broken. F1 first shipped "read the largest regime", reused from `discoverySearchPopulation` without
re-deriving it: largest is not latest, so after a bump to `CURRENT_PROTOCOL_VERSION` a
120-against-40 record read the **retired** protocol at 100% accuracy for 81 more decisions.

Neither was caught by the tests written for the family it repaired, and that is a fact about what
those tests can do rather than about how carefully they were written. **A test of a repair asks
whether the repair does what it intended. It does not ask what the repair does somewhere else.**
Both were caught by asking, of each repair, what a realistic record does to it.

### Second-order repair failures, named

A **second-order repair failure** is a failure introduced BY a repair, in a place the repair was not
looking. It is not a bug in the repair's own logic: `every` killed its counterexample outright and
"the largest" ended the pooling it was written to end. Both were correct about the thing they were
pointed at and wrong about something they had turned their back on.

The two on this branch have two different shapes, and both shapes are searchable:

| shape | what happened | the question that finds it |
| --- | --- | --- |
| **A rule correct on the counterexample and wrong on the record's motion** | `every` was checked against a fixed 59-decision record. The counterexample held the record size still; the product does not. Certification then became non-monotone and, on realistic distributions, unreachable. | For each new predicate: is it monotone in the record? Can more evidence ever make a reading worse, later, or absent? |
| **A rule imported from a consumer that asks a different question** | "the largest" was taken from `discoverySearchPopulation` without re-deriving it. Discovery chooses a population to SEARCH for a hypothesis; the record page describes a player under conditions that hold. The same rule, two questions, and staleness after every version bump. | For each rule reused from elsewhere: does the consumer it came from ask the same question as the consumer it moved to? |

A third question follows from both, and neither of these two was found without it: **what did the
counterexample hold fixed?** A counterexample is a single record, and a repair validated against one
is validated at one point. Record size, protocol version, reveal mode, engine build and level count
were all constant in the fixtures that proved F1 through F4, and every one of them moves in
production.

**This search was then run**, on the six decisions the repairs added — `stratify`, the regime
chooser, `unreadableShare`, `verdictWithheldWhenComputed`, the `{measured, answered}` split,
`regime.current`. Two of the six failed it, and both are the same shape as the family they closed.

| | second-order failure | measured | closed by |
| --- | --- | --- | --- |
| ☑ | **S1** `unreadableShare` was a ratio of squared errors, so it moved with the number it qualified rather than with the cells it described | 3 decisions of 403, unchanged, reported as 100% / 96% / 86% / 60% / 27% / 9% / 2% as the big levels' error grew — loudest for the best-calibrated reader — and as exactly nothing when 28 decisions sat on a thin cell that happened to be right | the count of decisions on unreadable cells against `n`, which depends on nothing else |
| ☑ | **S2** `regime.current` was the regime of the LAST ROW, and reveal timing is chosen per game | 200 coached decisions beside 30 deferred: n=30 at 0%, n=201 at 100%, n=31 at 0%, n=202 at 100%, one decision at a time, forever | recency decides only on a CLEAN SUCCESSION — every row of the displaced regime preceding the first of the new one, which a protocol bump produces and an alternation does not |

Both were found by question 3. F2's counterexample held the big levels at essentially zero error, so
the ratio read as intended at that one point and was degenerate everywhere else; F1's held 120 rows
under one protocol followed cleanly by 40 under the next, so nothing interleaved and recency looked
like succession. **Neither test was wrong. Both were single points.**

**Two thresholds were considered and neither moved.** `MIN_BUCKET_N` is untouched and F2 is phrased
with it rather than beside it — the alternative, a rule about what SHARE of an aggregate may come
from ineligible cells, needs a number nothing here has measured. No detector semantics changed, no
probe was added, and no `FIELD_REQUIRED` question was answered in code.

**What F1 deliberately did not decide.** Progress through the shared bank (`anchorAnswered`) is not
stratified: it decides which position the front door serves next, and narrowing it to the read
regime would re-ask a player a position they have already answered because a protocol version moved
underneath them. Whether an older answer should be re-asked is a question about what the product
measures. It is an owner decision, it is listed with the other three below, and it is deliberately
not smuggled into a measurement fix.

---

## REPO PRE-HUMAN CEILING — declared **REACHED** 2026-09-03, reopened 2026-09-04, re-evaluated below

Everything below is closed, each with the check that proves it and the condition that would reopen
it. **The 2026-09-03 declaration stands as history and not as a current claim** — the four rows in
the section above were open on the tree it was made about.

| | item | closed by | reversed by |
| --- | --- | --- | --- |
| ☑ | **`O-1`** reveal routes directly to the next position | owner decision, implemented, walked in Chromium | a one-press route landing the player where they cannot legally move |
| ☑ | **`O-2`** `next_decision_started` is a placed move, on the player's own side, after a reveal | `GATE-CONTINUATION-IS-A-MOVE` + three deliberate breaks, each red for its own reason | a ledger carrying the event on a visit with no move after a reveal |
| ☑ | **`O-3`** `ASK_AFTER_REVEALS = 2` reachable from the front door, threshold unmoved | end-to-end walk: reveal 1 → press → position → move → decision → reveal 2 → prompt | the question on reveal 1, or absent on reveal 2 |
| ☑ | **acquisition protocol frozen** at version 1 | [`ACQUISITION_PROTOCOL_V1.md`](ACQUISITION_PROTOCOL_V1.md) | an edit to §1–§6 without a new protocol version |
| ☑ | **`R-27`** recurring deployed-origin engine gate | `the-engine-that-speaks.deployment.test.ts` in `deployed.yml`, with two controls that go red | the probe reaching `uciok` under a policy that forbids the engine |

**And the standing conditions that were already true and were re-verified rather than assumed:**

| | |
| --- | --- |
| ☑ | 35 gates pass, and all 35 positive controls go red under deliberate break |
| ☑ | production serves exactly what `main` builds — build identity, all assets, `Deployed` L6 green |
| ☑ | the shipped engine starts **on `lichessapp.vercel.app` itself**, over real TLS: `uciok` in 1,955 ms, `deployed.yml` [run 33763175591](https://github.com/ereztash/lichess_app/actions/runs/33763175591) bound to `9d03bbb`. Its control went red in the same run |
| ☑ | one authoritative debt register, which names every other tracker and what it is for |

---

## What is left, and none of it is code

Four things. Each is `ENVIRONMENT` or `OWNER`, and the first three each fail the test *"could a
technical failure here be misread as an absence of value?"* in the direction that matters. The
fourth is a measurement question F1 raised and deliberately did not answer.

### 1. `R-21` — `main` deploys before `verify` has run · **highest**

`main` reports `protected: false`, `verify-build.yml` runs on `push` **after** the merge, and Vercel
deploys `main` on push. A red build is already serving players by the time anything reports.

**Why it is a field blocker.** During a trial, a broken deployment is experienced by participants as
a product that does not work, and recorded as an absence of value. `ROLLBACK.md` makes it cheap to
undo, which shortens the window and does not close it.

**What closes it.** A branch ruleset: require a pull request, require the `verify` check, block
force-push; and on Vercel, deploy only after the check passes. Repository and project settings,
about five minutes, owner's hands. `EXTERNAL_CONFIGURATION_REQUIRED`.

### 2. `R-26` — the rollback has never been rehearsed on the live alias

The mechanism is falsified without touching production: the SHA binding goes red on a mismatch and
`GATE-ROLLBACK-EVIDENCE` holds the procedure to its evidence. What has not happened is the thing
itself.

**What closes it.** On a quiet hour, roll back to the current build — a no-op alias move — and
dispatch `deployed.yml` with that SHA. One green run, linked from `ROLLBACK.md` §7.

### 3. `R-23` — one hour of logs, no alerting

Vercel Hobby retains runtime logs for one hour and sends no alerts. A failure is observable only by
an operator who is already looking.

**Why it matters here and not before.** A trial runs while nobody is watching. A participant who
hits an error at 02:00 is a data point that is gone by 03:00, and the funnel records a stop with no
cause.

**What closes it.** An owner decision, either way, in writing: buy retention and alerting, or accept
the blindness and say so, so that trial-1 stops of unknown cause are read as unknown rather than as
disinterest.

### 4. Does a bank answer survive a protocol bump? · **new, 2026-09-04** · `OWNER`

F1 walled the shared bank: the between-player reading is now computed over one measurement regime,
because two answers scored by two engine builds hold nothing fixed and B1 measured 13.61% of
verdicts flipping across exactly that change. Progress through the set was deliberately left
unstratified — `anchorAnswered` decides what the front door serves next, and scoping it would re-ask
a player a position they had already answered.

**Why it is an owner decision and not a repair.** Both answers are defensible and they are about what
the product measures, not about what the code can do. Re-asking buys a comparable reading under the
current protocol at the cost of a player's time on a position they have already given. Not re-asking
keeps their progress and leaves the comparable reading smaller after every bump.

**What closes it.** A sentence, either way. Until then the split above is the conservative reading:
the comparison is scoped, the progress is not, and nothing silently changes what a player is served.

---

## Deliberately not blockers

Recorded so they are not rediscovered as new findings.

| row | why it is not a pre-human blocker |
| --- | --- |
| `R-13` `Home.tsx` size | governed by a ratchet that only goes down; it held during this work and forced two extractions |
| `R-22` hand-applied migrations | production has no `DATABASE_URL`; the record is browser-side. It becomes live the day a database is added, and not before |
| `R-24` no rate limiting | same reason: `/api/health` runs no query with storage unconfigured, and a small trial is not a load event |
| `R-28` `users` table nothing writes | dead schema. It costs a reader a minute and costs a participant nothing |
| `R-25` server record not exportable | there is no server record in production to export |

---

## After those four

Every material uncertainty left is `FIELD_REQUIRED`. These cannot legitimately be reduced further
without external humans, and each names what it needs.

| question | observable needed | denominator | prohibited inference | what the result changes |
| --- | --- | --- | --- | --- |
| **`F-1`** Is the reveal's payoff perceptible where it is put? | eye or interaction evidence that the finding block was reached, per viewport class | `reveal_presented` | a rendered block is not a read one; y=444 on desktop and y=893 on a 390×844 handset are geometry, not attention | whether the four-block order, declared non-negotiable and untouched, gets a prereg to move it |
| **`F-2`** Can a newcomer tell `F1` from `F2` on the built screen? | a person restating, unprompted, what the reveal claimed and what it did not | people shown a reveal carrying the distinction | a clean DOM is not comprehension; `EVIDENCE_LABEL` rendering is not `EVIDENCE_LABEL` landing | whether the evidence vocabulary ships as written or gets rewritten before any claim rests on it |
| **`F-3`** Is the first payoff worth continuing for? | `next_decision_started` after `reveal_presented`, on the frozen protocol | `reveal_presented`, with handover compliance in the denominator | continuation is not satisfaction; a stop is not a rejection when `R-23` leaves its cause unobservable | whether there is a product here at all |
| **`R-1`** Does a locked board after the commit change how people decide? | decision time and completion at that step, within participant | decisions reaching a commit | a difference is not a burden until the burden protocol says which direction is worse | whether the commit-time board lock needs its own arm |

**`F-3` is the one the whole instrument exists to ask**, and `O-1` is the decision that decided what
its numerator counts.

`F-1`'s geometry is no longer an estimate. [`neta/NETA_EMBODIED_RUN_001.md`](neta/NETA_EMBODIED_RUN_001.md)
walked the deployed build as an experience and measured it: on a 390×844 handset the first reveal
heading is at y=899 and the sentence carrying the payoff at y=1133, in an 844px viewport that does
not scroll itself. The row above said y=893, and it was measuring the heading rather than the
finding. The run is not authority to move anything, and it did not: it recorded six findings, one of
which was `BUILD_READY` and was a noun.

---

## The one sentence

**The four families are closed, and the ceiling is not re-declared.**

What is true, and it is the whole of what the evidence supports: F1 through F4 each carry a
counterexample that was red before its repair and green after, each carries a positive control that
would fail if the repair were a refusal to say anything, all 35 gates pass, all 35 positive controls
go red under deliberate break, `npm run check`, `build`, `test` (3,085) and `bundle:budget` are
green, and no threshold, detector semantic, denominator or probe moved.

What is not true is that this authorises the sentence the file used to end with. **The 2026-09-03
declaration was made under the same conditions and was wrong**, and the reason it was wrong is now
on the record above: three orthogonal discovery runs finding nothing was read as an absence of
findings. Repeating the declaration from a fourth green tree would be repeating the inference, not
the evidence — and F1 and F3 are both the same shape as that mistake, a fact about the producer read
as a fact about what is there.

So the honest form is narrower and is falsifiable:

`FOUR FAMILIES CLOSED, TWO SECOND-ORDER FAILURES CLOSED — CEILING NOT RE-DECLARED`

**Four repairs for them were falsified in turn** — `every` and "the largest" by review, then
`unreadableShare` and `regime.current` by the search this file names — on the same tree, by
measurement rather than by reading. That is not an argument that the work is unsound; it is the strongest
available argument that a green tree is not evidence of an absent finding, which is the exact
inference this file made on 2026-09-03 and is being asked not to make again.

**What would authorise a re-declaration.** Not the second-order run: it has been made, it returned
two findings, and both are closed. What it would take now is that run repeated over the decisions
S1 and S2 themselves introduced — the record-share count and the clean-succession test — returning
no novelty that changes an action. **That is the third round, and this file has no evidence about
it.** The first round found four, the second found two; nothing here says the sequence terminates,
and "it got smaller" is a reading of a search rather than a fact about the tree.

**And a run returning nothing is still not the sentence.** It would say a second search stopped
finding things, which is exactly what three orthogonal runs said on 2026-09-03 before a fourth found
four. What it would buy is a specific, named class ruled out on a specific tree, and that is worth
writing down as itself rather than promoting to a ceiling. The declaration needs a reason that is
not "we looked and did not see", and this file does not yet have one.

Until then the four `ENVIRONMENT` and `OWNER` items above stand between here and
`FULL PRE-HUMAN CEILING REACHED`, and every remaining material uncertainty beyond them is
`FIELD_REQUIRED`.
