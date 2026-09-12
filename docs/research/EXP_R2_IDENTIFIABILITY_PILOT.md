# EXP-R2 identifiability pilot — can the relational account predict anything a simpler one cannot?

**Date: 2026-09-12. No participant data exist and none were collected.**
**This is a stimulus-construction study run entirely on positions and an engine.**

Decision record: [`EXP_R2_AMENDMENT_1.md`](./EXP_R2_AMENDMENT_1.md).
Implementation: `research/tcrf/identifiability.ts`, `scripts/build_tcrf_stimuli.ts`.
Frozen design: [`EXP_R2_RESOURCE_FIELD_PREREG.md`](./EXP_R2_RESOURCE_FIELD_PREREG.md), unchanged.

---

## 1. The question

> Can we construct at least one stimulus family in which the relational account and the strongest
> simpler non-relational account make different **observable** predictions?

**Answer: yes, in two families out of four, and only under a manipulation class the frozen design
does not use.**

---

## 2. Method

### 2.1 The rival account, given its strongest form

The object-local account is allowed to see, for every one of the 64 squares:

| feature | occupied square | empty square |
| --- | --- | --- |
| colour, piece type, material value | yes | n/a |
| attacker count | enemies attacking it | black's control count |
| defender count | friends defending it | white's control count |
| coverage | squares this piece attacks | n/a |
| pin status | whether removing it exposes its own king | n/a |

Two of those were added after the first run of this scan produced a result that was too flattering:
empty squares had no feature vector at all, so the terminal square of an open file counted as
invisible to an account that sees it perfectly well, and pins were invisible because `chess.js`'s
attack map is pin-blind by design. **A construct that only survives against a weakened rival has not
survived**, so both went in and both cost the relational account families it had appeared to win.

### 2.2 The test

For each matched pair, compute the object-local description of both arms. Any square that differs —
in occupancy or in any feature — is **object-visible**: the simpler account has a reason to make
somebody mention it. Then ask whether the target relation has an endpoint that is **not**
object-visible.

An element that participates in the changed relation, whose own description is identical in both
arms, and which did not move, is an element the object-local account has no reason to produce. A
participant who names it has made an observation only a relational representation predicts.

### 2.3 Why the frozen manipulation fails this by construction

The frozen design **ablates**: the relation is present in one arm and gone in the other. Remove a
defence and the defended piece becomes undefended, which is a property of one piece. The
alternative is **substitution**: change which element holds the relation, or aim the structure at
something already held, so that no single element's local description moves.

---

## 3. Results

Thirteen pairs. `wp Δ` is the winning-chance delta, shipped engine / high budget. Frozen tolerance
0.0276. `cp Δ` is the same gap in centipawns at the high budget.

| id | class | family | verdict | value role | discriminating element | wp Δ | arms | cp Δ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SD-01 | ablation | support/defence | `SIMPLER_ACCOUNT_EQUIVALENT` | CONFOUND | none | 0.0119 / 0.0055 | 0.509 / 0.515 | 6 |
| SD-02 | ablation | support/defence | `SIMPLER_ACCOUNT_EQUIVALENT` | CONFOUND | none | 0.0040 / 0.0067 | 0.842 / 0.849 | 14 |
| LA-02 | ablation | line activation | `SIMPLER_ACCOUNT_EQUIVALENT` | MEDIATOR | none | 0.0300 / 0.0119 | 0.145 / 0.133 | 27 |
| LA-03 | ablation | line activation | `SIMPLER_ACCOUNT_EQUIVALENT` | MEDIATOR | none | 0.0304 / 0.0110 | 0.500 / 0.489 | 12 |
| CO-03 | ablation | constraint/overload | `PARTIAL` | CONSTITUTIVE | f7, e6 | 0.3239 / 0.3490 | 0.489 / 0.140 | 481 |
| CO-06 | ablation | constraint/overload | `PARTIAL` | UNRESOLVED | b5, e8 | 0.0097 / 0.0008 | 0.025 / 0.026 | 9 |
| HC-02 | ablation | coalition | `PARTIAL` | UNRESOLVED | d8 | 0.0000 / 0.0000 | 1.000 / 1.000 | n/a |
| HC-03 | ablation | coalition | `PARTIAL` | UNRESOLVED | d8 | 0.4209 / 0.4575 | 0.956 / 0.498 | 836 |
| **ID-01** | **substitution** | **coalition** | **`DEMONSTRATED`** | **CONFOUND** | **d5** | **0.0028 / 0.0028** | **0.522 / 0.525** | **3** |
| ID-02 | substitution | constraint/overload | `PARTIAL` | CONSTITUTIVE | f7, g6 | 0.3623 / 0.2928 | 0.723 / 0.430 | 337 |
| ID-03 | substitution | constraint/overload | `PARTIAL` | CONSTITUTIVE | e6 | 0.4006 / 0.4099 | 0.723 / 0.313 | 474 |
| **ID-04** | **substitution** | **support/defence** | **`DEMONSTRATED`** | **CONFOUND** | **e5** | **0.0037 / 0.0037** | **0.499 / 0.495** | **4** |
| ID-05 | substitution | line activation | `PARTIAL` | UNRESOLVED | d8 | 0.0042 / 0.0078 | 0.895 / 0.888 | 22 |

### 3.1 Family table

| family | value-neutral feasible? | relational prediction unique? | strongest simpler account | identifiable? | destination |
| --- | --- | --- | --- | --- | --- |
| **support / defence** | **yes** (ID-04: 0.0037) | **yes, under substitution** — no, under ablation | object-local, under ablation | **yes** | **R2-A** |
| **higher-order coalition** | **yes** (ID-01: 0.0028) | **yes, under substitution** | object-local, under ablation | **yes** | **R2-A** |
| line activation | boundary (ID-05: 0.0078, outside the band) | yes, under substitution | scalar value, unresolved | **partial** | DEFER, pending a pair inside the band |
| constraint / overload | **no** — three attempts, deltas 0.32, 0.36, 0.40 | yes, in every attempt | scalar value | **partial** | **R2-B** |

### 3.2 The two demonstrations

**ID-04, support/defence.** The white knight on e5 is defended exactly once in both arms: by the
rook on e1 in one, by a pawn on d4 in the other. Its attacker count, defender count, coverage and
pin status are identical, and it did not move. The relation `w:defends:e1>e5` holds in one arm and
not the other. Winning chances 0.499 and 0.495, four centipawns apart, in the middle of the band.

**ID-01, higher-order coalition.** A queen and rook stacked on the d-file aim at a black pawn its
own neighbour already defends, so the coalition is structurally real and objectively close to inert.
The target pawn's description is identical in both arms. Winning chances 0.522 and 0.525.

### 3.3 The finding that reframes the programme

**The family was never the problem. The manipulation class was.**

| family | ablation | substitution |
| --- | --- | --- |
| support / defence | `SIMPLER_ACCOUNT_EQUIVALENT` | **`DEMONSTRATED`** |
| line activation | `SIMPLER_ACCOUNT_EQUIVALENT` | `PARTIAL` (band) |
| constraint / overload | `PARTIAL` (constitutive) | `PARTIAL` (constitutive) |
| higher-order coalition | `PARTIAL` (unresolved) | **`DEMONSTRATED`** |

Every cell improves or holds. The two `DEMONSTRATED` results were each reached on the **second**
attempt within their family, by changing how the relation was removed rather than which relation
was chosen.

### 3.4 The family that resists

Constraint/overload failed three times, at 0.32, 0.36 and 0.40, across two different disruption
methods (activating a rook, and stepping the king across). It always had a discriminating element
and never a matched value. That is consistent and it has a reading: **an overload that matters is a
tactic**, and a tactic is a value discontinuity. The forcing-gap check caught CO-03 independently —
best-move gap 0.324 in one arm against 0.004 in the other.

This is the clearest `R2-B` case: value is not a nuisance there, it is the thing.

---

## 4. Predictions, per account, for the two R2-A templates

Frozen before any participant sees a stimulus.

| account | prediction for ID-01 and ID-04 |
| --- | --- |
| **object-local** | responses name elements whose local description moved (the rook that left, the pawn that arrived). The discriminating element is named at its base rate, and **does not differ between arms** |
| **scalar value** | no difference between arms at all: the evaluation is the same to within four centipawns |
| **tactical forcing** | no difference: best-move gaps are matched and small in both arms |
| **relational** | the discriminating element is named **more often in the arm where the relation holds**, and in a **two-place or higher-order predicate** rather than as a property of one piece |

The discriminating observation is therefore **not** the rate of `target_structure_mentioned`. It is:

1. `named_elements` containing the discriminating element, and
2. `predicate_arity` of `two_place` or `higher_order`.

Both are in codebook v2, and **neither is codeable from the condition**: the coder records what the
response refers to and how many places its predicate has, and the intersection with the
discriminating set happens in analysis, after blindness has done its work.

---

## 5. Metric comparison

| metric | ordering of the 13 pairs | is it a transform of winning chances? |
| --- | --- | --- |
| winning chances | HC-02 < CO-06 < ID-01 < ID-04 < SD-01 < … | — |
| centipawns | ID-01 < ID-04 < SD-01 < CO-06 < LA-03 < … | position by position yes; **as a delta, no** |
| forcing gap | LA-03 < CO-06 < LA-02 < ID-04 < HC-02 < … | **no.** A different quantity entirely |

The two value metrics disagree because the gap is taken in different spaces: at saturation a
winning-chance delta of exactly 0.0000 corresponds to an unbounded centipawn gap, which is HC-02.
The consequential case is **ID-05 at 0.0078 winning chances and about 22 centipawns** — inside the
30-centipawn anchor, outside the resolvable band.

**No metric change was made.** Choosing the one that admits ID-05 and refuses HC-02 on the basis of
which stimuli survive is the move the amendment exists to prevent. Both are recorded per pair.

---

## 6. Limits of this pilot, stated

- **Thirteen pairs, one author, no chess expert.** §4.5 requires two independent reviewers and none
  has seen these. Every pair sits at `review_status: DRAFT` and the gate blocks all of them from the
  primary set.
- **The discriminating-element test is a necessary condition, not a sufficient one.** It shows the
  object-local account has no *reason* to produce the observation. It does not show that
  participants will produce it, which is what the human study would be for.
- **`battery` is the only higher-order detector in the repository**, so the coalition family's
  `DEMONSTRATED` rests on one structure class.
- **The object-local account could be made stronger still** — piece-square tables, contact counts
  by attacker type, king distance. Each addition can only move results toward
  `SIMPLER_ACCOUNT_EQUIVALENT`, never away, so the current verdicts are upper bounds on
  identifiability.
- **One family is untested under substitution at a resolvable evaluation** (line activation): ID-05
  is a near miss on position selection, not a demonstrated failure.

---

## 7. Verdicts

| code | value |
| --- | --- |
| support / defence | `RELATIONAL_IDENTIFIABILITY_DEMONSTRATED` (substitution only) |
| higher-order coalition | `RELATIONAL_IDENTIFIABILITY_DEMONSTRATED` (substitution only) |
| line activation | `RELATIONAL_IDENTIFIABILITY_PARTIAL` |
| constraint / overload | `RELATIONAL_IDENTIFIABILITY_PARTIAL` |
| **study level** | **`STOP-R2-CONSTRUCT-IDENTIFIABILITY` does not fire** |

`STOP-R2-CONSTRUCT` **does** fire for support/defence and line activation **as manipulated by the
frozen design**, and is lifted for both by the substitution class.
