# TCRF construct audit — what survived an adversarial review, and what did not

> **A-2 WAS RESOLVED AND A LARGER FINDING FOUND UNDERNEATH IT.** See
> [`EXP_R2_AMENDMENT_1.md`](./EXP_R2_AMENDMENT_1.md): the value tension is real, and the prior problem
> is that the frozen manipulation cannot tell a relational representation from a per-piece one in two
> of the four families. §4's "simpler constructs" table below understated the risk; the pilot measured
> it.

**Status: REVIEW OF A RESEARCH CANDIDATE.** This audits
[`TELOS_CONDITIONED_RESOURCE_FIELD_SPEC.md`](./TELOS_CONDITIONED_RESOURCE_FIELD_SPEC.md) against
[`EXP_R2_RESOURCE_FIELD_PREREG.md`](./EXP_R2_RESOURCE_FIELD_PREREG.md) and against what the
repository can execute. It changes neither document. Where it found an ambiguity the frozen design
left open, it says which artefact resolved it and under whose authority.

The audit asks six questions of every object in the specification:

1. **Necessary** — does EXP-R2 fail without it?
2. **Observable** — can anything in a session produce evidence about it?
3. **Identifiable** — given the evidence, can it be separated from its neighbours?
4. **Distinct** — is it different from the construct beside it, or the same thing renamed?
5. **Decision-bearing** — does its value change what the project does next?
6. **Falsifiable** — is there a result that would retire it?

**The default is defer.** A construct that survives is one that R2 cannot be run without.

---

## 1. Verdict table

| Construct | Operational definition available now | Observable directly? | Derived from | Main confound | Needed in R2? | Defer? |
| --- | --- | --- | --- | --- | --- | --- |
| **Carrier** | a piece, pawn or square named in a response; `OBJECT_CARRIER` in the codebook | yes, in free text | FEN; coded response | the contrast class for every other level, so a coding error here inflates every other level | **yes** | no |
| **Relation** | six versioned detectors in `research/tcrf/relations.ts`; `RELATION` in the codebook | structurally yes, psychologically only through free text | FEN; coded response | structural relation is not perceived relation, which is the whole question | **yes** | no |
| **Coalition / motif** | `battery` detector; `COALITION_MOTIF` coded at three or more elements in one functional statement | structurally yes; the coded level is a convention, not a discovery | FEN; coded response | not separable from `RELATION` without the element-count rule (A-5) | **yes, as one of four families** | the general motif vocabulary defers |
| **Affordance** | `target_affordance_present/disrupted`, frozen per arm by review | only through the move, which is selection and not perception | stimulus review; committed move | selecting an affordance is not perceiving one (A-11) | **yes, as H2's outcome only** | affordance *competition* defers |
| **Constraint** | `pin` and `overload` detectors; `CONSTRAINT` in the codebook | structurally yes | FEN; coded response | intrinsically value-bearing, so its stimuli fail §4.3 (A-2) | **yes, as one family** | no |
| **Telos** | probe question 3; `TELOS` in the codebook; `target_telos_linked` | one free-text answer | coded response | four hierarchy levels are not recoverable from one question (A-10) | **the label, yes. The hierarchy, no** | **hierarchy defers to R3** |
| **Conditional marginal value** `Value(r \| S,τ,π_opp,h)` | none. Needs `ν_τ`, which needs `Q_τ` and `π_opp` | no | — | — | **no** | **R3** |
| **Characteristic function** `ν_τ(C\|S)` | none. `A_C` requires a complete prerequisite-structure map `P(a)` that does not exist | no | — | — | **no** | **R3** |
| **Shapley / Myerson interaction** | none, and forbidden in R2 by §14 | no | — | — | **no** | **R3** |
| **Partial resource hierarchy** `≻_(S,τ)` | none. A partial order over unvalued elements is empty | no | — | — | **no** | **R3** |
| **Subjective resource field** `Ĝ_u, T̂_u, ν̂_u` | not implementable. What exists is the CODED RESPONSE, which is a lossy, coder-mediated sample of it | no, latent by construction | coded response | free-text report is not ground truth; H6 tests whether asking changes it | **yes as the object under test, never as a stored field** | `ν̂_u` defers |
| **Cognitive / meta-resource** | `time_regime` (randomised) plus `think_ms` (measured). No score | yes, both | protocol; commit event | think time confounds difficulty with deliberation, which `TIME_REPRESENTATION_PREREG.md` §2.2 already says this repository cannot separate | **yes, as two variables** | `ComputationNeed` / value-of-computation defers |
| **Opponent-response model** `π_opp` | none. Nothing in an R2 session observes what a participant expected the opponent to do | **no** | — | — | **no** | **R3**, and it is R3's hardest input (A-8) |
| **Failure taxonomy** (11 codes) | none. Every code needs a ground-truth field R2 does not collect | no | — | — | **no** | R4 at the earliest |

**Six of fourteen survive into R2.** Everything on the cooperative-game side of the specification
defers whole, which is what §14 of the preregistration already sequenced; this audit confirms the
sequencing is forced rather than cautious, because the inputs those objects need are not merely
unmeasured but unobservable in an R2 session.

---

## 2. Findings

Each finding names what was wrong or ambiguous, what resolves it, and whose authority the
resolution sits under. **None of them amends a frozen document.**

### A-1 — `target_structure_mentioned` has no polarity, and the naive reading points the wrong way
**Severity: would have produced a false STOP-R2-H1.**

H1 predicts more representation of the target structure when it is PRESENT. But a participant in the
DISRUPTED arm can name the target relation correctly and informatively: *"the rook no longer covers
e5"* names exactly the relation the edit removed. Under a rule that counts any mention, both arms
score 1, the coefficient is null, and the construct-validity gate fails on a coding decision.

It is worse than insensitive. Noticing that a defence is **gone** is stronger evidence of relational
representation than noticing it is there, so the naive rule penalises the responses that best
support the construct.

**Resolved in** `research/tcrf/codebook.ts`: two coded variables, `target_structure_mentioned`
(presence-assertions only, H1's DV, matching the direction §2 states) and
`target_structure_referenced` (either polarity, pre-registered secondary, predicted flat or
reversed). The implication `mentioned -> referenced` is enforced in `codingContradictions`.
**Authority:** §8 of the preregistration assigns the `target_structure_mentioned` rule to the
codebook and requires it written before confirmatory data are opened. Writing it is scheduled work,
not an amendment.

**Read this way at analysis time:** a null primary beside a large positive secondary is not a rescue
of H1. It is evidence that the construct is about noticing structure rather than about topology, and
it belongs in the results as that.

### A-2 — §4.3 value matching and §4.1 decision-relevance are in direct tension, and it is measurable
**Severity: the single largest threat to the study running at all. Now quantified.**

A relation whose removal changes nothing about the evaluation is a relation the player has no reason
to represent. A relation whose removal changes the evaluation fails the §4.3 matching test. The
preregistration does not acknowledge the tension.

The pilot measured it. Eight hand-authored candidate pairs, both engine configurations, in
`research/tcrf/stimuli/PRIMARY_V1.json`:

| family | template | shipped Δ | high-budget Δ | outcome |
| --- | --- | --- | --- | --- |
| support / defence | SD-01 | 0.0119 | 0.0055 | within tolerance |
| support / defence | SD-02 | 0.0040 | 0.0067 | within tolerance |
| line activation | LA-02 | 0.0300 | 0.0119 | over on the shipped config only |
| line activation | LA-03 | 0.0304 | 0.0110 | over on the shipped config only |
| constraint / overload | CO-03 | 0.3239 | 0.3490 | over by an order of magnitude |
| constraint / overload | CO-06 | 0.0097 | 0.0008 | unresolvable (see A-4) |
| higher-order coalition | HC-02 | 0.0000 | 0.0000 | unresolvable (see A-4) |
| higher-order coalition | HC-03 | 0.4209 | 0.4575 | over by an order of magnitude |

Tolerance is `ACCURATE_WIN_PROBABILITY_LOSS` = 0.0276.

**The pattern is not noise and it is family-shaped.** Support and defence manipulations matched.
Line activation missed by a hair. Constraint and coalition manipulations produced value shifts of
0.32 and 0.42 in winning chances, on positions with identical material, because the structure being
removed **is** the advantage: HC-03's battery is worth 42 points of winning chances on its own, and
CO-03's overload is a tactic, which the forcing-gap check caught independently (best-move gap 0.324
in one arm against 0.004 in the other).

**Consequence for the design, stated before any participant is run:** `STOP-R2-C` /
`STOP-R2-TEMPLATE` — "the result depends on one motif family" — is the most likely way EXP-R2 ends,
and the likely surviving family is support/defence, which is the weakest support for TCRF because
pairwise defence is exactly what a non-relational account predicts too.

**Not resolved, because it cannot be resolved by code.** Three routes exist and the choice is the
owner's, recorded in [`EXP_R2_EXECUTION_PLAN.md`](./EXP_R2_EXECUTION_PLAN.md) §5.

### A-3 — `base_arm` is a confound the frozen design does not name
**Severity: moderate, and cheap to eliminate before recruitment.**

§4.4 generates candidate variants from a base position and never says which arm the base is. If
PRESENT is the unedited arm for most templates, `topology_present` is partly "the position nobody
edited", and edited positions can read as slightly unnatural for reasons no invariant covers.

**Resolved in** `research/tcrf/stimulus.ts` (`base_arm` is a required hand-authored field) and
`validate-stimulus.ts` (`BASE_ARM_MISMATCH` blocks a record whose base does not match the arm it
names; `BASE_ARM_SKEW` reports imbalance at REVIEW severity across the set). It is REVIEW rather
than BLOCK because an imbalance cannot invalidate a preregistered set, and it has to be visible
while it is still cheap to fix. `research/tcrf/analysis/controls.ts` moves `is_base_arm` with the
label under C1, so the shuffle cannot leak the true condition through a column it forgot.

**All eight pilot candidates are edited away from PRESENT**, which is the maximally skewed
arrangement and would need fixing before recruitment.

### A-4 — §4.3's criterion cannot discriminate at the ends of its own scale
**Severity: would have admitted unmatched pairs as perfectly matched.**

Winning chances are a logistic and a logistic is flat at its ends. `shared/win-probability.ts`
documents this from the other direction: 30 centipawns costs 2.76 points of winning chances at a
level position and 0.28 at +10.00. Run backwards, two positions 200 centipawns apart in a won game
differ by less than the tolerance, and §4.3 passes them.

This was not hypothetical. Pilot pair HC-02 returned a delta of **exactly 0.0000 under both engine
configurations** while both arms evaluated at 1.000 winning chances. White was winning by a queen in
both. The pair had passed §4.3 by being decided, not by being matched.

**Resolved in** `research/tcrf/validate-stimulus.ts`: `VALUE_MATCH_UNRESOLVED`, which fires when
either arm sits outside the band where the tolerance still discriminates. The bound is **derived**
rather than chosen: it is the winning chance at which `ACCURATE_WIN_PROBABILITY_LOSS` stretches to
twice its own anchor `ACCURATE_CP_LOSS` — 60 centipawns rather than 30 — which puts the band at
`[0.133, 0.867]`. The factor of two is the one judgement and it is stated in the code.

**Framing matters and is deliberate:** this does not say such a pair is unmatched. It says §4.3's
test **did not run**, which is the same distinction `NOT_MEASURED` carries in the engine block and
that `NOT-MEASURED` carries in `scripts/run_gates.ts`. It is not a new matching criterion and it
does not move the tolerance.

**Downstream consequence:** EXP-R2 stimuli must live in near-balanced positions. That is a real
constraint on stimulus authoring that §4 does not state.

### A-5 — `COALITION_MOTIF` is not identifiable from free text without a stated rule
**Severity: would have made H3 uninterpretable.**

*"The rook and the bishop both hit f7"* is two relations or one coalition depending on who is
reading. A semantic rule makes the level a property of the coder, and H3 — which predicts a rating
gradient in coalition-level responses — would then be measuring coder habits.

**Resolved in** `research/tcrf/codebook.ts`: `COALITION_ELEMENT_THRESHOLD = 3`. A response is coded
`COALITION_MOTIF` when it names three or more elements in one functional statement, or a motif term
that entails more than two. Two elements in one statement is `RELATION`.

**Stated as a convention, not a discovery.** A failed H3 must be readable as *"the convention did
not separate the levels"* and not only as *"expertise does not work that way"*.

### A-6 — §4.3's "both configurations" rule makes the shallower engine the gatekeeper
**Severity: low, and it inverts the intent.**

§4.3 requires matching under the shipped configuration **and** a higher-budget one, so that a pair
matched only by a shallow search cannot slip through. In the pilot the disagreement ran the other
way, consistently: LA-02 reported 0.0300 shipped against 0.0119 at 2M nodes, LA-03 0.0304 against
0.0110. Both line-activation pairs were rejected by the depth-14 product search and accepted by the
deeper one.

So the binding constraint is the **less informative** measurement. That is defensible — the shipped
engine is what the product would tell a player — but it is not what the clause reads like it is for,
and it costs the family with the smallest collateral edits (LA-02's non-target edit count is 3, the
lowest in the pilot).

**Not resolved.** Both readings are recorded per pair and the rule is applied as written. An owner
decision to weight the high-budget reading would be an amendment and is listed as such in the
execution plan.

### A-7 — legal-move counts are not a §4.2 invariant and should not be silently ignored
An arm offering 24 options against one offering 35 differs in affordance-space size, which alone
predicts different reports. §4.2's list does not include it.

**Resolved in** `validate-stimulus.ts` at REVIEW severity (`LEGAL_MOVE_ASYMMETRY`, threshold 6),
with the delta recorded per arm and entering the analysis as a C4 covariate. It is REVIEW and not
BLOCK because blocking on it would amend a frozen document after the fact. Pilot pair CO-06 trips it
at a delta of 11.

### A-8 — the opponent-response model has no observable in EXP-R2
`Value(r | S, τ, π_opp, h)` is conditioned on `π_opp`, and nothing in an R2 session produces evidence
about what a participant expected the opponent to do. The three probe questions do not ask, and §7.3
freezes them, so they cannot be extended.

**Consequence:** every quantity conditioned on `π_opp` defers whole, and R3 cannot estimate `ν_τ`
without first obtaining an opponent-response observable. Recorded as precondition P-4 in
[`TCRF_EXP_R3_PRECONDITIONS.md`](./TCRF_EXP_R3_PRECONDITIONS.md).

### A-9 — the telos hierarchy's four levels are not recoverable from one question
§5 of the specification defines a four-level DAG (terminal, strategic, operational, immediate) with
parent links and success conditions. §7.3 asks one open question: *"What were you trying to make
happen?"* One answer cannot populate a graph, and inferring the parent level from the wording would
be the system authoring the participant's telos, which §5 forbids by keeping `authored_by` separate.

**Resolved by scope:** R2 codes `TELOS` as a representation level and `target_telos_linked` as a
binary. The hierarchy is not implemented, not stored, and not inferred. Deferred to R3.

### A-10 — "the player saw affordance *a*" is not what `target_affordance_selected` measures
§4 of the specification says the product must never infer perception from action, and then §9 of the
preregistration makes `target_affordance_selected` a primary outcome. These are compatible only if
the outcome is read as **selection**, never as perception: a participant who saw the affordance and
rejected it scores 0, and a participant who found the move for an unrelated reason scores 1.

**Resolved by naming.** The variable keeps the word `selected` and no artefact in this
implementation converts it to a perception claim. H2 is stated in the preregistration as explicitly
not a mediation claim, which is the same guard from the other side.

### A-11 — the `battery` detector fires on ordinary connected back-rank rooks
Structural motif is not perceived motif, and this is the concrete instance. Two rooks connected on
the first rank satisfy the battery definition, so the detector is common rather than rare, and the
graph diff for any family-4 edit is correspondingly noisy.

**Partly resolved in** `relations.ts`: only maximal stacks survive, so a three-piece stack counts
once rather than three times. **Not resolved** in the sense that matters: a common structure is a
weak manipulation, because the disrupted arm still contains batteries. Recorded as a stimulus-design
constraint in the execution plan.

### A-12 — moving a queen turns a local edit into a 27-relation edit
Measured while authoring: relocating the queen to break a battery produced a graph diff of 27, while
relocating the rook in the same position produced 13. High-degree carriers make §4.4's minimum-edit
rule expensive to satisfy.

**Not a defect, a finding.** Family-4 stimuli should break the coalition by moving the
**lower-degree** carrier. Recorded in the runbook as an authoring rule.

### A-13 — `battery` is the only higher-order detector, so family 4 rests on one structure class
§3.3 of the specification keeps the motif list open and admits one only after a versioned detector
exists. Exactly one exists. If C7's family holdout fails on family 4, it will be impossible to tell
whether higher-order structure is unrepresented or whether batteries specifically are.

**Not resolved.** It is a known limit on what a family-4 result can mean, and it is cheaper to state
now than to discover in the results.

---

## 3. What the audit did not find

Three things it is worth recording as **not** problems, because each looks like one:

- **No fixed piece-value table leaked in.** `PIN_WORTH` in `relations.ts` orders pieces, and it is a
  detector convention with a stated purpose (deciding whether a shield is worth shielding), not a
  resource claim. §6.1's rejection of a global hierarchy is about the construct and is intact.
- **No composite score exists anywhere.** §11 of the specification forbids one and nothing in
  `research/tcrf/` computes, stores or exports one.
- **The probe wording contains no part of its own answer.** All nine wordings clear the forbidden
  lexicon in all three languages, checked by test rather than by reading.

---

## 4. Simpler constructs that would explain the same behavioural delta

The governing instruction is that a simpler construct wins. Three are live and each has a control:

| simpler account | what it says | which control retires TCRF in its favour |
| --- | --- | --- |
| **object salience** | players report whatever piece changed, and relation words are incidental | **C3**, the object-only baseline. If piece/material/location features match B1 held-out, the relational claim is not supported |
| **evaluation sensitivity** | players report whatever the position's value turns on, and topology is a proxy for value | **C4**, plus the §4.3 tolerance itself. A-2 shows this is the live risk in families 3 and 4 |
| **option-count salience** | players report more structure when there is more to say, and the arms differ in how much there is to say | **A-7's covariate**, legal-move delta, entered in C4 |

If any of the three explains the delta as well as TCRF does, the finding is the simpler construct,
and the preregistration's §12 already says so for the second one (`STOP-R2-D` / `STOP-R2-CONFOUND`).
