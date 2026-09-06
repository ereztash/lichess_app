# Pre-release state

**Candidate:** `07ccd11aaa9d41ed700f5096d4fc536e8394d869`
**Target:** `broad-public`
**Disposition:** `NOT_READY_FOR_TARGET_DISTRIBUTION`
**Last recalibrated:** 2026-09-06

This file says what stands between the current candidate and broad distribution, and who owns each
remaining item. It is not a second debt register: `docs/MASTER_PRODUCT_DEBT.md` remains the one place
that answers *"what is open?"*, and `docs/PRE_RELEASE_AUDIT.md` is the contract this page reports
against. What this page adds is the reading, per candidate, of which open rows currently control the
release decision and which do not.

It is written to be replaced by the next audit run rather than amended.

## The blocker set

| gap | criticality | authority | blocking `broad-public` | what closes it |
| --- | --- | --- | --- | --- |
| `F-HUMAN-CORE` | P1 | **FIELD** | **yes** | prospective human sessions producing the pre-engine decision record and the planned comprehension and continuation evidence |
| `R-21` / `A-RELEASE-STALE-PR` | P1 | **ENVIRONMENT** | see below | one checkbox on the existing `main` ruleset, then an audit run that re-reads it |

Everything else the audit reports is P2 or lower and does not control this decision:
`R-22`, `R-23`, `R-24`, `R-25`, `R-26`, `R-28`, `F-SCREEN-READER`. Three rows are watch items with
zero score effect (`R-08`, `R-18`, `R-13`) and nineteen are historical or refuted and excluded from
scoring. **Watch is not backlog and refuted is not debt.** None of them is eligible for work while a
P1 still determines the release decision.

## No repository-owned blocker remains

The audit was run against this exact candidate. **None** of its repository checks produced a gap:

| check | result on `07ccd11` |
| --- | --- |
| `npm run check` | pass |
| `npm run build` | pass |
| `npm test` | pass |
| `npm run gates` | pass |
| `npm run gates:controls` | pass |
| `npm run bundle:budget` | pass |

`A-TYPECHECK`, `A-BUILD`, `A-TEST`, `A-GATES`, `A-GATE-CONTROLS` and `A-BUNDLE` were all absent from
the report. There is no code change this repository can make that removes a current release blocker,
and that is the reason none was made.

## `R-21`, ENVIRONMENT

Live authority, read by the audit from the GitHub Rulesets API rather than from this tree:
`pull_request` required, `non_fast_forward` blocked and required status check `verify` are **in
force**. `strict_required_status_checks_policy` is **false**.

**Owner action, and nothing wider:** on the active ruleset targeting `main`, in *Require status checks
to pass*, enable **Require branches to be up to date before merging**.

**Then verify from live authority:** Actions, `Pre-release Gap Audit`, Run workflow on `main` with
target `broad-public`. The row closes when that run emits neither `A-RELEASE-STALE-PR` nor
`A-RELEASE-AUTHORITY`. It does not close because this file, or `MASTER_PRODUCT_DEBT.md`, says the
checkbox was clicked.

**On the two gap identities.** The audit emits `A-RELEASE-STALE-PR` when it can read the ruleset and
finds `strict` false, and `A-RELEASE-AUTHORITY` when it cannot read the ruleset at all. The second is
`external-unverified` and therefore surfaces as `VERIFY_EXTERNAL_AUTHORITY` rather than as a blocker,
because an unread authority is an unknown and not a finding. Do not read a run that emitted
`A-RELEASE-AUTHORITY` as evidence that the flag is set.

## `F-HUMAN-CORE`, FIELD

The frozen instrument was recovered from this repository and re-proven runnable on this candidate.

| artifact | what it fixes |
| --- | --- |
| [`ACQUISITION_PROTOCOL_V1.md`](ACQUISITION_PROTOCOL_V1.md), version 1, frozen 2026-09-03 | the six things a trial can be invalidated by moving |
| [`ACQUISITION_EVIDENCE.md`](ACQUISITION_EVIDENCE.md) | every event, its denominator, its privacy class, and section 15's definition of acquisition-ready |
| [`VALUE_CLARITY_FIELD_PROTOCOL.md`](VALUE_CLARITY_FIELD_PROTOCOL.md) | three arms, preregistered thresholds, a coding scheme frozen before data, and a recruitment package that states *"Ready to run. Nothing below requires another build."* |

Runnability, measured on this candidate rather than carried forward from an earlier one:

- `the-loop-a-stranger-can-close.layout.test.ts` and `a-stranger-takes-their-first-decision.layout.test.ts`
  walk the three frozen clauses in a real browser against the built assets, with the shipped engine not
  intercepted: **9 of 9 pass**. That is section 1 (one-press route), section 2 (continuation is a placed
  move) and section 3 (the question absent on reveal 1, present on reveal 2);
- **35 of 35** invariant gates pass, including `GATE-CONTINUATION-IS-A-MOVE` and `GATE-REACHABILITY`;
- production serves this candidate and answers, and the scheduled `deployed.yml` run against the
  deployed origin passes with all three positive controls red under deliberate break, engine probe
  included;
- the handover surface exists: the self-check drawer offers a clipboard copy of the visit report and a
  JSON download, and the report prints each visit's ledger events verbatim with nothing derived.

**Therefore: no product code change, and the authority is FIELD.**

### The handoff

Run the recruitment package in `VALUE_CLARITY_FIELD_PROTOCOL.md` as frozen. It is not restated here,
because a second copy of a frozen protocol is a second thing to drift. In short: Arm A first, 5 to 8
cold, send the acquisition message and the link and then stop; Arm B 5 to 8 cold, sit them with the
app, first intervention after Reveal 1, keep recruiting until both reveal branches have appeared; Arm
C 8 to 15, send the link and say nothing else. Arm C's row is the browser's own ledger, copied out by
hand from the self-check drawer.

The entry link is the production alias, and **both** routes must work for a stranger: the username
route, and the shared-set route for someone with no account.

### What may not be used to close it

No telemetry, probe, explanation surface, synthetic user, model simulation or retrospective analysis
closes a human-evidence gap. Only participants do. A weak result is a result; it is not a licence to
go looking for a product bug to explain it.

### The one thing that reopens it as a repository gap

A participant who cannot reach a first decision on either supported entry route. The frozen protocol
names that as a liveness defect: the trial pauses, and the finding moves from FIELD back to REPO. That
is the reversal condition for the no-code-change decision recorded above, and until it happens there
is no product defect to find.

## Deliberately not worked

`R-22`, `R-23`, `R-24`, `R-25`, `R-26`, `R-28`, the `Home.tsx` size ratchet, further observability,
and further retrospective research. Each is real and none of them can remove a current release
blocker, so starting one now would be work whose completion cannot change the decision this page
exists to report. They become eligible when a later audit shows no higher-priority blocker still
determines the release state.
