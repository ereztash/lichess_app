# DR_PLAN_0 — the competing explanations, frozen before the audit

Frozen after `CURRENT_STATE.md` and **before** the action ledger, the delete test, the value-debt
map or any walk performed for this mission. Nothing in this file may be edited once the ledger
exists; corrections go in `FALSIFICATION_REPORT.md` with their reason.

The owner proposed H1. That is a reason to test it, not a reason to expect it. The audit is
constructed so that H1 can lose, and §"What would make this mission's answer worthless" below names
the way it could win dishonestly.

## The hypotheses

### H1 — Instrument–Telos Gap

The product repeatedly asks the user to perform actions whose primary beneficiary is the
measurement system rather than the player, over enough consecutive actions that the player becomes
an operator of the instrument.

* **Supports it:** a costly action whose deletion would not reduce what the player receives, and
  which the product does not pay for with immediate value, a visible option contract, or natural
  capture. **Several of these, on independent surfaces, sharing that structure.**
* **Falsifies it:** most costly actions turn out to be natural capture or to have an immediate
  payoff; or the uncovered ones are few, isolated, and do not share a mechanism; or the longest
  unpaid stretch turns out to be short.
* **Repository can supply:** the full inventory of costly actions, what each buys, what reads it
  downstream, and whether any payoff surface exists that could not exist without it.
* **Needs FIELD:** whether a player experiences the covered cases as covered. A contract the
  product states is not a contract the player accepted.

### H2 — UX legibility

The actions are worth their cost to the player, and the product fails to say so.

* **Supports it:** costly actions whose payoff **is** reachable and **is** differentiated, sitting
  behind wording that does not name it; a `MISLEADING` or `ABSENT` score on "what becomes knowable
  after I do this" while the thing genuinely becomes knowable.
* **Falsifies it:** the payoff is not reachable in the current build, in which case better wording
  would be a more accurate description of an absence.
* **Repository can supply:** whether each promised payoff exists and is reachable.
* **Needs FIELD:** whether the existing wording is understood. M1 and M2.

### H3 — Time-to-value only

The value contract is sound and repayment arrives too late.

* **Supports it:** every costly action eventually repays, the repayments are real and
  differentiated, and the only defect is the distance to the first one.
* **Falsifies it:** a repayment that never arrives at any n, or one whose arrival does not depend
  on the cost paid.
* **Repository can supply:** the exact n for each payoff, and the observed cost to reach it.
* **Needs FIELD:** whether the distance is judged worth it. M6.

### H4 — Missing learning layer

The measurement loop is coherent and the gap is mostly the unreachable Evidence → Learning →
Transfer half.

* **Supports it:** the unpaid stretches terminate exactly where the flagged states begin, and the
  reachable half repays adequately up to that boundary.
* **Falsifies it:** an unpaid stretch that lies entirely inside the reachable half and would not be
  shortened by the flag.
* **Repository can supply:** where each unpaid stretch ends relative to the flag boundary.
* **Needs FIELD:** nothing. This one is decidable here, which makes it the cheapest to test.

### H5 — Dual-ontology leakage

The primary defect is internal evidence structure surfacing as user work: two populations, two
denominators, two thresholds, two loops, exposed as things the player must reason about.

* **Supports it:** internal distinctions that change no user action, cost cognition, and are
  visible; and a user-facing surface that requires choosing between them.
* **Falsifies it:** the distinctions turn out to be either invisible to the player or to change
  what they should do next.
* **Repository can supply:** every internal distinction that reaches a screen, and what user
  decision each one changes.
* **Needs FIELD:** whether they are actually confusing. The frozen protocol's non-pointing
  denominator probe.

### H6 — Market / job mismatch

The product may be coherent and the job insufficiently valuable to justify the effort.

* **Supports it:** costly actions that are well covered, clearly contracted and reachable, that a
  player still declines.
* **Falsifies it:** players who continue when the contract is made plain.
* **Repository can supply:** almost nothing. This is the hypothesis the repository is least able to
  speak to, and saying so is part of the audit.
* **Needs FIELD:** M7 against M1 to M6. This is the one the frozen rules already isolate.

### H7 — No structural problem

The failures are local implementation defects with no common mechanism.

* **Supports it:** the uncovered costs are few, scattered, and each explained by its own history.
* **Falsifies it:** several independent surfaces failing the same way for the same reason.
* **Repository can supply:** whether the failures share a mechanism or only a mood.
* **Needs FIELD:** nothing.

## The discrimination rules, fixed now

Written before the evidence so the evidence cannot choose them.

| Observation | Raises | Lowers |
|---|---|---|
| An uncovered cost whose payoff is `NOT_IMPLEMENTED` or `FEATURE_FLAGGED` | H4 | H1, H2 |
| An uncovered cost whose payoff is `AVAILABLE_NOW` but unnamed on screen | H2 | H1 |
| An uncovered cost whose payoff is `REQUIRES_N` with a large n | H3 | H7 |
| An uncovered cost with **no** payoff at any n and no option contract | H1 | H2, H3 |
| An internal distinction visible on screen that changes no user action | H5 | H7 |
| Several uncovered costs on independent surfaces sharing one structure | H1 | H7 |
| Uncovered costs that are few, isolated, and separately explained | H7 | H1 |
| Costly actions a player would perform anyway | falsifies H1 locally | H2, H6 |

**H1 is credited only for the fourth and sixth rows.** An uncovered cost that a flag would cover,
or that wording would cover, or that an earlier payoff would cover, belongs to H4, H2 and H3
respectively, and giving it to H1 is exactly the failure mode this plan exists to prevent.

## What would make this mission's answer worthless

A concept that can absorb every friction the product has is a lens, not a hypothesis. Three ways
that happens, named now so they can be checked at the end:

1. **Retrofit.** Every finding gets labelled `UNCOVERED_EPISTEMIC_TAX` because the label fits
   anything costly. Guard: the verdict vocabulary has eight values, and a ledger where one value
   takes almost every row is a ledger to distrust.
2. **No losing outcome.** H1 survives whatever FIELD returns. Guard: §J of the final answer must
   name a FIELD observation that weakens H1, and `FIELD_DISCRIMINATION_MAP.md` must show it is
   reachable under the frozen M1 to M8.
3. **Burden equals defect.** Necessary scientific burden gets counted as tax. Guard: the delete
   test asks whether the payoff could exist without the cost; a cost that uniquely enables a
   differentiated payoff is not tax, however heavy.

## What this mission may not do

No orchestration surface, no merged denominator, no onboarding, no flag change, no threshold
change, no sampling-rate change, no progress bar, no rating, no coaching claim. The frozen FIELD
stimulus and `research/player-path/FIELD_RUN_CURRENT.md` are untouched. The only permitted code
change is a newly discovered correctness defect decidable from REPO authority.
