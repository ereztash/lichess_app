# Ranking ten candidate first interventions

Scored 1 (bad) to 5 (good) on the mission's ten criteria. **The column that decides the table is
#3, measurement availability** — and it is low for every row, which is itself the finding.

**Legend for #5 (risk of strengthening a false rule):** high score = *low* risk.

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
| **K** *focal-trigger constraint* — added by this research | 4 | **5** | **1** | 3 | 3 | 3 | 2 | **4** | 4 | 4 | **35** |

## Reading the table

**The totals are close and that is not a tie — it is a symptom.** Nothing separates cleanly because
every candidate is bottlenecked by the same column. **No row scores above 2 on measurement
availability.** Ranking interventions when none of them can be scored is choosing which experiment
to run badly.

**K, the highest scorer, is not in the mission's list.** It comes out of V8 and Cluster 1: constrain
the authored trigger to name something the player already processes while choosing a move. It ranks
highest on construct relevance because, unlike every other row, it does not *improve* the target
behaviour — it is a **precondition for the behaviour existing at all**. It also ranks worst-equal on
measurement, for the same reason as B and H: it requires negative items that do not exist.

## The case against A (PR #48's Study 0), stated fully

PR #48 chose response-congruent retrieval. Three arguments against it, and one for.

1. **It is confirmatory.** V13 — Chessable already retrieves by playing the move, and it is the
   largest chess-learning product in the world. A positive result reproduces a settled convention;
   a null result is more likely to indict the local implementation than the principle.
2. **Its outcome cannot reach the target.** PR #48's own outcome is "rule-consistent action with
   base rate as a covariate", which is **L4 cued application** — the position is presented. The
   target is L5. The study cannot observe the construct it is motivated by.
3. **It does not address either blocking barrier.** [`BARRIER_MODEL.md`](BARRIER_MODEL.md) puts the
   deaths at content validity, encoding, trigger recognition and discrimination. Response
   congruency touches encoding only.

**In its favour:** it is subtractive, cheap, needs no new machinery, and is honestly framed.
**Verdict: Study 0 is a well-designed study of the wrong question.** It should not be run first.

## The table was scored before `RULE_CLASS_SEARCH` landed

**Column 3 was the bottleneck and it has partly opened.** With `RC-06` the measurement availability
of any design scored **on RC-06 items** rises from 1–2 to roughly 4: a signature exists, a
trigger-negative cell exists, and the prescribed act is engine-checkable at a median cost of +1 cp.

**It does not open for the product as it stands**, because RC-06 is expert-screened and the product
accepts player-authored rules — and nine of ten researcher-designed candidates failed the same
screen. So the column splits in two: **high** for a screened rule class, **unchanged** for the
product's actual content.

**This does not promote row A.** Response congruency is still confirmatory of Chessable's settled
convention, still yields an L4 outcome, and still addresses none of the top barriers. What the
change does is make **K** (focal-trigger constraint) and **B** (contrastive) testable *in principle*
— and it makes a prior question testable *first*, which is the one the experiment now asks.

## What the table actually recommends

**Still not an intervention — but for a different reason than when this table was written.**

The item set now exists. What does not exist, in this repository or in the published literature, is
any measurement of whether **detection governs action**. Every row above assumes that if the player
recognises the trigger they will act on it, and that assumption has never been tested for anything.

An intervention chosen before that is known is an intervention aimed at a guess: if the barrier is
recognition, **K** is right and **A**/**D** are wasted; if it is action selection, the reverse. One
study separates them.

That is the reasoning that produces [`EXPERIMENT.md`](EXPERIMENT.md).
