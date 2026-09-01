# Pre-human gates — what must survive before Study D recruits anyone

**Status: REQUIRED BEFORE HUMAN DATA.**

This file reconciles the learning-architecture work with the third rule-class round in PR #50.
That round screened **15 rule classes across 8 families and 3 selection strategies**. Exactly one
remains eligible under the current screen: `RC-06 answer-the-mate-threat`. The two design stories
extracted from earlier batches did not generalise to the candidates they produced, so no rule for
predicting a usable rule class is currently supported.

The consequence is not "find candidate 16". It is to attack the instrument and the one surviving
candidate before asking people to generate data.

---

## Why Study D is not the next overall step

Study D asks whether **detecting** a mate threat predicts a **rule-consistent move**. That is the
right next *human* question only if two upstream assumptions survive:

1. the current binary action signature is a faithful representation of rule value; and
2. T+ and T− items can be compared without item differences doing the work.

Neither is established yet.

The current screen defines `B_valid` by asking whether Stockfish's **single best move** satisfies B.
Round 3 supplies a direct warning against treating that as the final domain model: `RC-21
push-the-unstoppable-passer` is based on genuine, exactly defined chess knowledge, yet the named act
is the engine's best move on only **16.4%** of T+ items. A true state of the board need not imply one
unique best action.

RC-06 also still has max |SMD| **0.573** between its T+ and T− item sets. A human study before that
is resolved could measure item difficulty rather than a person-level detection → action relation.

---

# GATE A — action-set validity

## Question

Does RC-06 remain distinctive when the domain model evaluates the **set of actions permitted by the
rule**, rather than only whether the single engine-best move belongs to that set?

## Definitions

For position `s`, let:

- `B(s)` = legal actions satisfying the rule;
- `¬B(s)` = legal actions not satisfying the rule;
- `U(s,a)` = engine utility for action `a`, with WDL / expected score primary and centipawns retained
  as a secondary diagnostic.

Compute:

```text
V_B(s)      = max U(s,a), a ∈ B(s)
V_notB(s)   = max U(s,a), a ∉ B(s)
A_B(s)      = V_B(s) - V_notB(s)          # action-set advantage
R_B(s)      = V*(s) - V_B(s)              # regret of the best rule-consistent act
```

Also describe the distribution of regret among **all** legal actions satisfying B. A rule is not
safe merely because one B-action is excellent if many B-actions are bad.

## Reanalyse before inventing anything new

Run the same analysis on every already-screened rule class. Do **not** search for new classes first.
The existing set is valuable precisely because it contains:

- the ceiling and refuted floor anchors;
- RC-06;
- classes that looked strong on T+ but failed specificity;
- classes with inert T− but weak T+;
- RC-20 with negative separation;
- RC-21 where valid chess knowledge does not imply the named best move.

## What would change the programme

- **RC-06 remains exceptional under action-set measures:** confidence in the existing signature rises;
  proceed to Gate B.
- **Other classes become viable:** the binary `best_move ∈ B` screen was the bottleneck; update the
  rule-class ontology before any human study.
- **RC-06 loses its advantage:** do not run Study D. The apparent knowledge → action signature was an
  artefact of the binary action model.
- **The action sets overlap in value on both T+ and T−:** final move is not a sufficiently diagnostic
  observation of rule use; move to process evidence.

No universal numerical acceptance threshold is introduced here. Report the full distributions and
compare against the already measured ceiling and refuted floor under the same instrument.

---

# GATE B — exchangeability / minimal functional twins

## Precondition: the twin must hold the PREDICATE fixed, not only the position

A twin pair `P / P'` flips the trigger. If `B` is **also** defined differently on the two sides, the
contrast measures the predicate change and not the trigger change, and no matching repairs that —
it is in the response definition, not in the items.

**On RC-06 this precondition fails.** `_threat_satisfies` is the only predicate of the twelve
screened that recomputes the trigger: a hit means *"no mate in one"*, a false alarm means *"no check
at all"*. See [H22 and H23](FALSIFICATION_REGISTER.md#h22) and
[`CRITERION_CHANNEL.md`](CRITERION_CHANNEL.md).

**So Gate B cannot be run on RC-06 as specified**, and symmetrising the predicate is not available
either: for a rule of the form *"if THREAT, act so that THREAT is gone"*, `B` is trivially satisfied
when the threat is absent, which is why the branch exists. **Either the twin design fixes a single
predicate across both sides of the flip — and reports what that costs the noise cell — or Gate B
moves to a method-shaped rule class where `B` is a property of the move.**

This is a **new blocker, ahead of B1 and B2 rather than beside them**, and it was not known when
this file was written.

## Question

Can the trigger change while the rest of the decision problem remains similar enough that a change
in behaviour can reasonably be attributed to the trigger rather than to item difficulty?

## Two frames

### B1 — natural matching

Match RC-06 T+ and T− items on the covariates already used by the measurement programme, report the
residual imbalance, and retain item identity in all later models.

This is a diagnostic frame, not the strongest evidence.

### B2 — minimal functional twins

Use the Sheridan/Reingold design principle: create or identify position pairs `P / P'` that are as
similar as possible while a minimal, chess-valid transformation flips the target relation.

Required properties:

```text
T(P)  = 1
T(P') = 0
```

and the action-set model from Gate A must change in the predicted direction. Record the exact
transformation and every non-target feature it changes.

The pair is useful only if the transformation changes the **functional relevance** of the rule, not
merely the surface appearance of the board.

## What would change the programme

- **Stable action-set contrast on minimally changed pairs:** Study D becomes admissible as the next
  human construct-validation study.
- **Only naturally unmatched sets produce the effect:** do not recruit; the signature is confounded.
- **Minimal pairs cannot be constructed without changing many decision-relevant properties:** the
  final-move paradigm has reached a domain limit; move to process evidence.

---

# After both gates

Only then run [`EXPERIMENT.md`](EXPERIMENT.md), which becomes the **next human study**, not the next
overall step.

The dependency chain is therefore:

```text
15-class corpus
    ↓
GATE A — action-set validity
    ↓
GATE B — exchangeability / minimal twins
    ↓
Study D — detection → action + reactivity
    ↓
content-safety gate for player-authored rules
    ↓
learning intervention
    ↓
delayed uncued transfer
    ↓
ordinary Blitz ecological transfer
```

## Stop rule

If Gate A or Gate B fails, **do not repair the human study around the failure**. The conclusion to
carry forward is that rule use is not identifiable from the final move under the current paradigm.
The next research object is process evidence, not a sixteenth rule class and not a more elaborate
learning UI.
