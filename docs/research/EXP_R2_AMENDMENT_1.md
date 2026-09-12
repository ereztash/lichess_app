# EXP-R2 Amendment 1 — the construct has to be identifiable before it is measured

**Date: 2026-09-12.**
**Status: PRE-RECRUITMENT AMENDMENT. No participant data of any kind exist.**

Companion documents, all unchanged by this amendment:

- [`EXP_R2_RESOURCE_FIELD_PREREG.md`](./EXP_R2_RESOURCE_FIELD_PREREG.md) — the original frozen design. **Canonical historical evidence. Not edited.**
- [`TELOS_CONDITIONED_RESOURCE_FIELD_SPEC.md`](./TELOS_CONDITIONED_RESOURCE_FIELD_SPEC.md) — the construct specification.
- [`TCRF_CONSTRUCT_AUDIT.md`](./TCRF_CONSTRUCT_AUDIT.md) — the adversarial review that preceded the pilot.
- [`EXP_R2_IDENTIFIABILITY_PILOT.md`](./EXP_R2_IDENTIFIABILITY_PILOT.md) — what was executed under this amendment and what it showed.

---

## 0. What this amendment is not

It is not permission to rescue TCRF. It does not move a threshold, does not widen a tolerance, and
does not reinterpret a result — there is no result to reinterpret, because no human has seen a
stimulus.

**What triggered it happened entirely before recruitment**, which is the only window in which a
preregistration may be amended without the amendment being a form of data-dependent analysis. The
trigger was a stimulus-construction pilot whose purpose was to check whether the frozen design's
stimuli can be built at all.

The amendment's purpose is to separate two questions the frozen design collapses into one:

1. Can relational topology change what a player represents **when gross engine value is held
   approximately constant**?
2. What happens when the relational topology **is itself constitutive of objective chess value**,
   so that a strictly value-neutral manipulation is structurally inappropriate rather than merely
   hard?

These are different claims, they need different stimuli, and only the first can support the strong
version of TCRF.

---

## 1. The pilot evidence that triggered this

Thirteen candidate stimulus pairs were constructed and run through both preregistered engine
configurations. Full table and method in the pilot document; the two findings that force the
amendment are these.

### 1.1 Topology and value are not independent for every family

| family | manipulation | winning-chance delta (shipped / high budget) |
| --- | --- | --- |
| support / defence | ablate the defence | 0.0119 / 0.0055 |
| line activation | close the file | 0.0300 / 0.0119 |
| constraint / overload | break the dependency | 0.3239 / 0.3490 |
| higher-order coalition | break the battery | 0.4209 / 0.4575 |

Frozen §4.3 tolerance: `ACCURATE_WIN_PROBABILITY_LOSS` = 0.0276. Material is identical inside every
pair.

In the constraint and coalition families the structure being removed **is** the advantage. HC-03's
battery is worth 42 points of winning chances by itself. §4.3 asks those families to be matched on
a quantity the manipulation causes.

### 1.2 The frozen manipulation cannot identify the construct it is testing

This is the more serious finding and it is not about thresholds at all.

EXP-R2's manipulation is an **ablation**: the target relation is present in one arm and removed in
the other. An ablation cannot leave the board's object-level description unchanged. Remove a
defence and the defended piece becomes undefended — and "undefended" is a property of **one piece**.

So a participant who notices the change has told us nothing about whether they represent relations.
An account that tracks only per-piece local properties — colour, material value, how many enemies
attack it, how many friends defend it, how many squares it covers, whether it is pinned — predicts
exactly the same noticing, with no relational machinery at all.

Computed over the frozen design's own families (`research/tcrf/identifiability.ts`):

| family, ablation manipulation | every relation endpoint object-visible? | verdict |
| --- | --- | --- |
| support / defence | yes | `SIMPLER_ACCOUNT_EQUIVALENT` |
| line activation | yes | `SIMPLER_ACCOUNT_EQUIVALENT` |
| constraint / overload | no | `RELATIONAL_IDENTIFIABILITY_PARTIAL` |
| higher-order coalition | no | `RELATIONAL_IDENTIFIABILITY_PARTIAL` |

**The two families that pass §4.3 are the two that cannot identify the construct, and the two that
can identify it are the two that fail §4.3.** That inverse relationship is the reason this is an
amendment and not a threshold adjustment.

---

## 2. Is §4.3 controlling a confound, or conditioning on part of the mechanism?

The frozen design does not ask. The amendment answers it **per family, from measurement**, and the
answer is encoded rather than argued: `valueRole()` in `research/tcrf/identifiability.ts` returns
one of three roles from a pair's own engine deltas.

### 2.1 The two causal structures

```text
(A)  topology ──► objective affordance / value ──► representation ──► action
                         │
                         └── §4.3 conditions HERE, which removes part of the path

(B)  topology ──► representation ──► action
          │
          └── value correlated but not on the path;  §4.3 removes a nuisance
```

### 2.2 The decision, stated formally

| role | definition | §4.3's status | destination |
| --- | --- | --- | --- |
| `CONFOUND` | both engine deltas within the frozen tolerance, both arms inside the resolvable band | a legitimate confound control: structure B | **R2-A** |
| `MEDIATOR` | delta above tolerance but below four times it | conditions on part of the causal path: structure A, partially | **DEFER** pending a design that separates them |
| `CONSTITUTIVE` | either delta above four times the tolerance | there is no version of the position with the structure and without its value: structure A, wholly | **R2-B** |
| `UNRESOLVED` | an arm outside the band where the tolerance discriminates | the test did not run | not a verdict |

The `CONSTITUTIVE_MULTIPLE = 4` boundary is the one judgement in this classification and it is
stated rather than buried: past four times the entire matching budget, the edit has not perturbed
the evaluation, it has replaced it.

**Consequence:** §4.3 is retained unchanged as written, and is now understood to be **valid only
for families whose measured value role is `CONFOUND`**. Applying it to a `CONSTITUTIVE` family is
not a strict control; it is a request for a position that does not exist.

---

## 3. What "beyond the objective position" can defensibly mean

The construct specification's central question asks whether representation explains action "beyond
the objective position itself." **Relation topology is part of the objective position.** As written,
the claim asks whether the objective position adds information beyond itself, which is not a claim.

The ladder, from least to most inclusive, with what each can support:

| # | sense of "objective" | contents | can TCRF claim to go beyond it? |
| --- | --- | --- | --- |
| 1 | **scalar engine evaluation** | one number | yes, and this is the claim the pilot's ID-01 and ID-04 can actually test |
| 2 | **material** | the piece inventory | yes, and §4.2 already holds it fixed |
| 3 | **object-local description** | per piece: colour, type, value, attackers, defenders, coverage, pin status; per square: control | **this is the contested boundary.** Only a substitution design puts a relation endpoint outside it |
| 4 | **tactical forcing structure** | how far the best move is ahead of the next | separate quantity, not a transform of 1; measured per arm |
| 5 | **relation topology** | the detectors in `relations.ts` | **no. This IS the construct.** A claim to go beyond it would be incoherent |
| 6 | **full objective board state** | the FEN | no. Everything above supervenes on it |

### 3.1 Claim delta, recorded

| | original | amended |
| --- | --- | --- |
| claim | representation adds information about action **beyond the objective position itself** | representation adds information about action **beyond scalar value summaries and the object-local description of the position** |
| what is conceded | — | relation topology is objective, and any relational effect is an effect of the objective position. TCRF is a claim about the **level of description** a player uses, not about information absent from the board |
| what is gained | — | the claim becomes falsifiable: levels 1 and 3 are computable, so "beyond" has a referent |
| what is no longer testable as written | H2 as "beyond the objective position" | H2 must name its baseline. `analysis/plan.ts` B0 already did, so the code was already more honest than the prose |

**No history is rewritten.** The specification's §16 sentence stands in its own document; this table
is the delta.

---

## 4. The branch split

### R2-A — value-neutral topology

Admission: value role `CONFOUND`, both arms inside the resolvable band, at least one relation
endpoint outside the object-local description, and the relational and object-only accounts make
distinguishable predictions.

May support: **representation at the relational level carries information not reducible to scalar
value or to per-piece local properties.** This is the strong claim.

### R2-B — value-constitutive topology

Holds families where removing the structure legitimately removes the advantage.

**These are not forced through a value-neutral gate, and they are not evidence for the R2-A claim.**
A participant who notices a constitutive structure may simply be noticing that the position is
better, which is the scalar-value account. R2-B's honest question is different and weaker: whether
the **level of description** differs across arms once value is matched *within* the branch — which
requires a design R2 does not have. Until then R2-B is deferred to EXP-R3 or dropped.

### The manipulation-class rule, which is the amendment's operative change

> A stimulus pair may enter R2-A only if the target relation has an endpoint whose colour, material
> value, attacker count, defender count, covered squares and pin status are identical in both arms,
> and which did not move.

`purpose: "IDENTIFIABILITY_TEST"` on a stimulus record invokes this rule; `NO_DISCRIMINATING_ELEMENT`
is a blocking violation and `GATE-TCRF-STIMULUS` enforces it.

---

## 5. Support/defence does not get in for free

The family that passed §4.3 is the family a non-relational account explains best. The amendment
attacks that directly rather than banking it.

> **What observation would occur under a relational representation account that should NOT occur
> under a simpler under-defended-piece account?**

Under **ablation**: none. SD-01 and SD-02 return `SIMPLER_ACCOUNT_EQUIVALENT` — every endpoint of
the target relation is object-visible. Under the amendment that is `STOP-R2-CONSTRUCT` for the
family **as manipulated**, and no participant is recruited to separate models that agree.

Under **substitution** it is a different story, and the pilot built the case: ID-04 defends the same
knight exactly once in both arms, by a rook in one and by a pawn in the other. The knight's attacker
count, defender count, coverage and pin status are identical and it did not move. A participant who
names it has produced something the object-local account does not predict.

**So the family was never the problem. The manipulation class was.**

---

## 6. Metric choice is a claim, and it is not being made here

The resolvable-band guard stays, as a **measurement-validity guard only**. It is not the resolution
to the §4.1 / §4.3 tension and is not treated as one.

Measured over the pilot pairs, the three candidate metrics do **not** agree:

- **Winning chances and centipawns produce different orderings of the same pairs.** They are
  monotone transforms position by position, but a *delta* is not: at saturation a win-probability
  delta of exactly 0.0000 corresponds to an unbounded centipawn gap (HC-02).
- **Forcing gap produces a third ordering**, and is not a transform of either. It is a different
  quantity, not a different scale.
- The consequential case is ID-05: **0.0078 in winning chances, about 22 centipawns.** Inside the
  30-centipawn anchor, outside the resolvable band. One metric admits it; the other does not.

**Decision: §4.3's metric is not changed.** Switching to centipawns would admit ID-05 and refuse
HC-02, and choosing between them on the basis of which stimuli survive is exactly the move this
amendment exists to avoid. Both quantities are recorded per pair so a later sensitivity analysis can
ask the question with data rather than with preference.

---

## 7. What is paused

No cost is spent downstream of an unresolved construct question:

- 240-participant recruitment — **paused**;
- Spanish rollout and confirmatory language strata — **paused**;
- the full coder workforce — **paused**;
- large expert-review authoring (the 90 to 120 pairs the earlier yield implied) — **paused**;
- cognitive interviews — **permitted only if cheap and reusable across branches.** The three probe
  questions are unchanged by this amendment, so interview findings survive any branch outcome.

---

## 8. Stop conditions added

| code | condition | consequence |
| --- | --- | --- |
| `STOP-R2-CONSTRUCT` | for a family, no admissible stimulus makes the relational account predict an observation the strongest simpler account does not | that family does not go to human participants |
| `STOP-R2-CONSTRUCT-IDENTIFIABILITY` | no family at all clears the above | **EXP-R2 is not run on humans** |

Both are implemented in `research/tcrf/stop-conditions.ts` and outrank every code in the frozen §12
list, because they are prior to it: §12 asks how the experiment might fail, and these ask whether it
can answer.

**`STOP-R2-CONSTRUCT-IDENTIFIABILITY` is a successful research outcome.** TCRF does not earn a human
experiment by being computable. It earns one by predicting something a simpler account does not.

---

## 9. What would force TCRF to stop

Unchanged from the frozen §12, plus:

- no family produces a value-neutral stimulus with a discriminating element;
- the discriminating element is never named by participants above the rate the object-local account
  predicts;
- the object-only baseline (control C3) matches the relational model held out.

---

## 10. Which original claims are no longer testable as written

| original | status | why |
| --- | --- | --- |
| H1 over all four families under ablation | **not testable as an identification of relational representation** | two families are object-equivalent under that manipulation; H1 would still return a coefficient, and it would not mean what §2 says it means |
| H2 "beyond the objective position" | **restated** | see §3.1. The code's B0 baseline was already the honest version |
| §4.1's 32 templates, eight per family | **suspended** | template counts are downstream of which families have a branch |
| §3's 240 participants | **suspended** | no recruitment until identifiability resolves |
| §4.3 as a universal gate | **scoped** | valid where the measured value role is `CONFOUND` |
| everything else in the preregistration | **unchanged** | the protocol ordering, the probe wording, blindness, the reliability gate, the controls and the verdict matrix are untouched |
