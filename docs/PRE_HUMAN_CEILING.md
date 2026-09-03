# Pre-human ceiling

**The stopping condition.** Every material uncertainty the repository, its data, an owner decision
or the production environment is competent to settle has been settled. What remains is either
external configuration nobody in the tree can perform, or evidence only a person outside this
project can supply.

Two ceilings, and they are not the same. The first is reached; the second needs three things that
are not code.

---

## REPO PRE-HUMAN CEILING — **REACHED** 2026-09-03

Everything below is closed, each with the check that proves it and the condition that would reopen
it.

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
| ☑ | the shipped engine starts under the policy production serves: `UCIOK`, 0 refusals |
| ☑ | one authoritative debt register, which names every other tracker and what it is for |

---

## What is left, and none of it is code

Three things. Each is `ENVIRONMENT` or `OWNER`, each is verified, and each fails the test *"could a
technical failure here be misread as an absence of value?"* in the direction that matters.

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

## After those three

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

---

## The one sentence

`REPO PRE-HUMAN CEILING REACHED`. Three external items — a branch ruleset, one rehearsed alias
rollback, and an owner decision on monitoring — stand between here and
`FULL PRE-HUMAN CEILING REACHED`. After those, every remaining material uncertainty is
`FIELD-REQUIRED` and no further internal work is authorised by the evidence.
