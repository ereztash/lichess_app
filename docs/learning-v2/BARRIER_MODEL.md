# Where learning currently dies — reconciled barrier model

This model separates **product gaps** from **measurement blockers**. The order matters: do not build
an instructional remedy for a barrier that has not yet been shown to be the binding one.

## Current product chain

```text
decision
  ↓
evidence
  ↓
finding
  ↓
player-authored rule
  ↓
(no validated teaching step)
  ↓
withheld-rule retrieval at 1/3/7/21 days
  ↓
cued transfer/drill
  ↓
ordinary future game (no rule-specific hook)
```

The product is stronger as a **measurement/claim-control system** than as a learning system. It can
record decisions before reveal, control evidence authority, elicit a structured rule, hide it and ask
for it later. It does not yet establish that the rule is safe to strengthen, that the learner notices
the relevant situation without a cue, or that the learned policy changes ordinary play.

---

# Barrier chain

## 1. VALID INSIGHT → ATTENTION / COMPREHENSION

**Failure:** the finding is technically valid but not attended to or understood.

**Repo:** `FindingCard` is deliberately constrained to one important thing, one example, one evidence
level and one next action. The evidence layer is relatively mature.

**Why this is not first:** the strongest external evidence reviewed here does not support treating
layout clarity as the main learning mechanism. A clearer finding can improve usability without
solving transfer.

**Status:** product concern, not the current epistemic blocker.

---

## 2. COMPREHENSION → KNOWLEDGE / POLICY REPRESENTATION

**Failure:** the learner can explain the finding but does not form a representation usable in a later
decision.

**Repo:** `LearningRuleComposer` elicits trigger, missed signal, action, exception, predicted outcome
and falsifier. That is a useful representation, but it is player-authored free text.

**Open issue:** text may be only one representation of the skill. Chess expertise literature often
points to recognition of relations/relevant structures rather than explicit verbal rules.

**Status:** plausible learning-design problem, not yet the next experiment.

---

## 3. RULE / POLICY REPRESENTATION → CONTENT VALIDITY

**Failure:** the rule is memorable and wrong, overbroad or underdetermined by chess.

**Repo:** `mayPrescribe` exists and gates prescriptive copy at the `tested` authority level, but that
authority does **not** gate rehearsal. A player-authored hypothesis can be scheduled for retrieval
before its content has earned prescriptive authority.

**Measurement programme:** under the current binary screen, only **1 of 15** researcher-designed
candidate rule classes is eligible (`RC-06`). Fourteen fail despite being designed deliberately.

**Critical lesson:** teaching is an amplifier. Stronger learning machinery increases harm if the
content sign is wrong.

**Status:** real architectural gate. Missing in the product.

---

## 4. CONTENT VALIDITY → ACTION-MODEL VALIDITY

**Failure:** the chess fact is true, but the measurement maps it to the wrong behavioural signature.

The current rule-class screen asks whether the **single engine-best move** satisfies B. Round 3
provides a direct warning that this may be too coarse as a general domain model: `RC-21
push-the-unstoppable-passer` uses genuine, exactly defined chess knowledge while the named act is the
engine's best move on only **16.4%** of T+ items.

So:

```text
true trigger T
≠
unique correct action B
```

This is now the **first unresolved pre-human barrier**.

**Required test:** [`PRE_HUMAN_GATES.md`](PRE_HUMAN_GATES.md), Gate A — action-set advantage, regret
and robustness across the existing screened classes.

**Stop condition:** if RC-06 does not survive a set-valued action model, Study D is cancelled.

---

## 5. ACTION-MODEL VALIDITY → ITEM EXCHANGEABILITY

**Failure:** T+ and T− differ in other decision-relevant ways, so the instrument discriminates items
rather than the learner's relationship to the trigger.

**Current evidence:** RC-06 max |SMD| = **0.573** between T+ and T− under the existing covariate
schema. The measurement programme already contains a negative control where a zero-discrimination
agent can obtain a large apparent d′ on unbalanced items.

**Required test:** Gate B — natural matching plus minimal functional twins, following the
Sheridan/Reingold logic that a small chess-valid transformation should flip functional relevance.

**Status:** second unresolved pre-human barrier.

---

## 6. VALID / EXCHANGEABLE TASK → TRIGGER RECOGNITION

**Failure:** the learner knows the policy but does not notice when the condition is present.

**External convergence:** prospective-memory work distinguishes focal cues from cues that require
strategic monitoring; chess expertise research shows experts preferentially process relevant
relations; player complaints repeatedly distinguish puzzles ("I know something is there") from games
(no cue tells me to search).

**Repo:** player-authored triggers are unconstrained; mechanism labels such as `threat_scan` are an
internal taxonomy, not necessarily cues naturally processed during move choice.

**Status:** plausible human barrier, but it cannot be isolated until Gates A/B establish an admissible
task.

---

## 7. TRIGGER RECOGNITION → ACTION SELECTION

**Failure:** the player sees the relevant relation but does not let it govern the move.

The chess literature reviewed by the programme has validated detection paradigms for check, mate and
threat relations, but does not establish this arrow in an uncued decision setting.

**Next human study after Gates A/B:** [`EXPERIMENT.md`](EXPERIMENT.md), Study D.

Study D also estimates reactivity because asking "is there a mate threat?" before the move is itself
a cue/intervention.

**Status:** highest-value human construct question, **not yet admissible**.

---

## 8. ACTION SELECTION → CONDITIONAL DISCRIMINATION

**Failure:** training increases the target action in T+ but also increases it in T−.

**Important correction:** negative items are not absent from the *research corpus*. The rule-class
screen contains T− cells and RC-06 has a measurable trigger-negative action baseline. Negative items
are still absent from the **product's learning loop**.

The historical RC-06 analysis already shows why this matters: rule-following on T− can be costly.
A trigger-positive-only study can score a criterion shift as a learning success.

**Status:** measurable in research, not implemented in learning UX.

---

## 9. CONDITIONAL ACTION → MEMORY ENCODING / RETRIEVAL

**Failure:** the correct conditional policy is not retained or retrievable after delay.

**Repo:** retrieval intervals 1/3/7/21 exist and the rule is hidden. The lexical scorer is a floor
against unrelated text, not a validated memory measure. D23's original one-sitting null was also
corrected: the two-day `replicated` null under the same assumptions is roughly **9–65%**, not 47–81%.

**Learning mechanisms:** response-congruent retrieval, spacing, generation and self-explanation are
candidate interventions here, but they should not be selected before upstream construct validity.

**Status:** learning-design problem after the earlier gates.

---

## 10. RETRIEVAL → ACTION UNDER TIME PRESSURE

**Failure:** a policy works in an untimed presented task and collapses in 3+0.

**Repo:** current transfer/drill conditions and Blitz differ materially. No validated bridge exists.

**Status:** later representative-practice / transfer problem.

---

## 11. ACTION UNDER TIME PRESSURE → UNCUED / ECOLOGICAL TRANSFER

**Failure:** laboratory/presented performance never appears during an ordinary game without a
rule-specific cue.

**Repo:** ordinary Blitz currently has no rule-opportunity hook. The target is L5–L6; the repository
does not measure it.

**Role of Blitz:** ecological sampling and final proving ground, not the primary teaching engine.

**Status:** final validation layer.

---

# Current priority order

The old version of this file put `TRIGGER RECOGNITION → ACTION SELECTION` first. That remains the
highest-value **human** question, but PR #50 and the action-model critique add two cheaper upstream
questions that must precede it.

```text
1. ACTION-MODEL VALIDITY            ← Gate A, no humans
2. ITEM EXCHANGEABILITY             ← Gate B, no humans
3. TRIGGER RECOGNITION → ACTION     ← Study D, humans
4. CONTENT SAFETY FOR PLAYER RULES
5. LEARNING / ENCODING MECHANISM
6. DELAYED UNCUED TRANSFER
7. ECOLOGICAL BLITZ TRANSFER
```

This ordering is a dependency chain, not a claim that later barriers are unimportant.

## Stop rule

If Gate A or Gate B fails, do not make Study D more elaborate and do not search for candidate 16.
Carry the negative forward:

> **final move is not sufficiently diagnostic of rule use under the current paradigm.**

The next object then becomes **process evidence**, not a learning UI built on top of an invalid final-
action inference.
