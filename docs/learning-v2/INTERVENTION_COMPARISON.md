# Ranking candidate learning interventions — after the measurement revisions

This file compares instructional candidates, but its main conclusion is now deliberately upstream:
**do not choose an instructional component before the observation model survives.**

Scored 1 (bad) to 5 (good) on the mission's ten criteria. The table is retained because it shows
which mechanisms are plausible once measurement becomes admissible; it is **not** a licence to build
the highest total now.

**Legend for #5 (risk of strengthening a false rule):** high score = low risk.

| intervention | 1 causal id | 2 construct rel. | **3 measurement** | 4 reactivity | 5 false-rule | 6 participants | 7 items | 8 ecological | 9 burden | 10 learning≠perf | **Σ** |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **A** response-congruent retrieval | 4 | 3 | **2** | 4 | 2 | 4 | 4 | 2 | 4 | 3 | **32** |
| **B** T+/T− contrastive practice | 4 | **5** | **1** | 4 | 3 | 3 | **1** | 3 | 3 | 4 | **31** |
| **C** scaffolded self-explanation | 3 | 3 | 2 | **1** | 2 | 3 | 4 | 2 | 3 | 3 | **26** |
| **D** if–then compilation | 3 | 3 | 2 | 2 | **1** | 4 | 4 | 3 | 4 | 3 | **29** |
| **E** worked example → faded | 3 | 2 | 2 | 3 | 2 | 3 | 3 | 2 | 3 | 3 | **26** |
| **F** delayed retrieval | 4 | 2 | 2 | 4 | 2 | 4 | 4 | 2 | 3 | **5** | **32** |
| **G** spaced retrieval | 4 | 2 | 2 | 4 | **1** | 4 | 4 | 2 | 2 | 4 | **29** |
| **H** varied / interleaved practice | 3 | 4 | **1** | 4 | 2 | 3 | 2 | 3 | 3 | 4 | **29** |
| **I** learner-generated rule *(status quo)* | 2 | 3 | 2 | 3 | **1** | 5 | 5 | 3 | 5 | 2 | **31** |
| **J** expert-validated rule | 3 | 3 | 2 | 4 | **5** | 2 | 2 | 3 | 3 | 3 | **30** |
| **K** focal-trigger constraint | 4 | **5** | **1** | 3 | 3 | 3 | 2 | **4** | 4 | 4 | **35** |

---

## Reading the table

The totals are close because nearly every candidate is bottlenecked by the same thing: **we do not
yet have a domain-valid, exchangeable observation of rule use that reaches the target construct.**

The table therefore ranks mechanisms under a conditional:

> *If* a valid target behaviour and item bank exist, which component would be a plausible first
> intervention?

It does not answer whether that condition is currently met.

---

## Why PR #48's response-congruency study is not first

Response-congruent retrieval remains attractive because it is subtractive, cheap and well supported
as a learning principle. It is still not the first uncertainty to buy here:

1. its outcome is cued application rather than uncued transfer;
2. it addresses encoding/retrieval rather than proving whether the bottleneck is recognition or
   action selection;
3. it can strengthen a player-authored rule before content safety is known;
4. its usefulness still depends on the behavioural signature being valid.

So Study 0 remains a good experiment of a lower-priority question.

---

## What the rule-class search changed

The first rule-class search partially opened the measurement bottleneck by finding `RC-06
answer-the-mate-threat`.

The later round then made the interpretation narrower, not broader:

- **15 rule classes** have now been screened across 8 families and 3 selection strategies;
- **14 of 15** fail the current eligibility screen;
- the `noise-cell-first` design story did not survive the candidates selected from it;
- no design rule extracted so far predicts which class will work;
- `RC-06` remains the sole observed survivor under the current binary action signature.

Therefore measurement availability is **provisionally higher for RC-06 only**, not for a known
family of teachable rules and not for the product's player-authored content.

---

## A new upstream concern: the action signature may itself be too coarse

The current screen asks whether Stockfish's **single best move** satisfies B.

Round 3 makes that representation suspect as a general model of chess knowledge: `RC-21` represents
genuine, exactly defined chess knowledge while its named act is the engine's best move on only
16.4% of T+ items.

That creates a cheaper uncertainty than any instructional comparison:

> Does RC-06 remain distinctive when we compare the value of the **best rule-consistent action set**
> against the best non-rule-consistent alternative, rather than treating the engine's top move as a
> binary label?

The specification is in [`PRE_HUMAN_GATES.md`](PRE_HUMAN_GATES.md).

---

## What must happen before any intervention ranking controls the roadmap

### Gate A — action-set validity

Re-score the existing classes with action-set advantage, regret and within-B robustness. If the
eligible set changes, the old binary measurement was the bottleneck and the intervention table is
premature.

### Gate B — exchangeability / minimal functional twins

If RC-06 survives Gate A, attack its max |SMD| .573 with matched natural items and minimal
functional pairs. If the contrast does not survive, a human study would be an item-difficulty study
wearing a learner label.

### Study D — next human study

Only after A/B pass, ask whether explicit detection predicts rule-consistent action and estimate how
much the detection prompt itself changes behaviour. See [`EXPERIMENT.md`](EXPERIMENT.md).

---

## How Study D would choose among interventions

If detection predicts action with low reactivity, the next mechanism should target **recognition and
boundary detection**. K and B become the leading candidates: focal triggers, T+/T− contrast,
minimal-pair discrimination.

If detection does not predict action, the bottleneck is downstream of seeing. D and A become more
plausible: if–then compilation and response-congruent action retrieval.

If hits and false alarms rise together, neither branch wins. The problem is criterion shift /
overgeneralisation, and the first intervention target is boundary learning rather than more positive
practice.

If the detection prompt itself drives the move, prompt-shaped self-explanation or explicit trigger
questions cannot be treated as neutral measurements.

---

## What the table actually recommends now

**No learning intervention yet.**

The current priority order is:

```text
Action-set validity
    ↓
Exchangeability / minimal twins
    ↓
Human detection → action + reactivity
    ↓
Choose the intervention family that matches the measured barrier
```

The intervention scores become decision-relevant only at the last arrow. Until then, building the
highest-scoring row would optimise a mechanism before the product knows what mechanism is missing.
