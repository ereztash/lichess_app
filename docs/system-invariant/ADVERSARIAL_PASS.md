# Adversarial pass: eighteen attempts to show this is not a system invariant

Mission section 29. The task is to prove the result is not what it appears to be. Attacks that
**fail** are recorded as fully as attacks that **land**, because a pass that only lists the survivors
is a defence, not a review.

Nothing here was repaired quietly. Where an attack landed, the finding stands in the document it
concerns and is named below.

Verdict key: **FAILS** (the attack does not hold), **LANDS** (it does), **PARTIAL** (it holds
against part of the claim).

---

## A-1 -- OwnExposure is just material. **FAILS**

`L + Material` reaches **0.4955** on held-out players, statistically indistinguishable from move
geometry alone (0.4963) and from chance. `L + Epost` reaches 0.5501. The difference is
**+5.45 pp, CI [+5.16, +5.76]**.

Material is not a weak version of exposure. Within a position, among the engine's own candidates, it
carries **nothing**.

---

## A-2 -- OwnExposure is just mobility. **FAILS**

`L + Mobility` reaches 0.5102, which is above chance and is the strongest of the alternatives
tested. It is still **3.99 pp [+3.65, +4.30]** below exposure. Mobility explains about a fifth of
what exposure explains.

---

## A-3 -- OwnExposure is a proxy for already-bad positions. **FAILS, and inverts**

The strongest form of this attack predicts that conditioning on position value absorbs the effect.
The opposite happens:

| Model | beta |
|---|---:|
| with `wp1`, `edge`, `gap12`, `n_near`, `ambiguity_entropy` | **+0.1014** [+0.0908, +0.1134] |
| with those removed | +0.0670 [+0.0560, +0.0787] |

Position value **suppresses** the association. Controlling for how bad a position already is makes
the exposure effect larger, not smaller.

---

## A-4 -- The result exists only because the original P3 rule classes were selected. **FAILS**

This was the most serious structural attack, because P3, the pressure-exposure test and P4 all ran
on one corpus: positions where a designated-threat trigger fires, with candidates restricted to a
rule class's permitted set.

The natural sample applies **no rule-class filter of any kind**. Positions are ordinary blitz
decisions sampled by B3's own machinery from a month B3 never used. There is no trigger, no `B(s)`,
no focal piece. The effect is the same sign and comparable size.

---

## A-5 -- B3 player dependence inflates certainty. **FAILS**

Every Test A interval resamples **players**, not decisions, 1,333 clusters. Every Test B interval
resamples **positions**. The within-player estimator, which discards all between-player variation,
returns **+0.0975 [+0.0864, +0.1087]** against the pooled +0.1014: the effect is almost entirely
within-player to begin with.

---

## A-6 -- One rating band drives everything. **FAILS, with a real gradient recorded**

All nine bands are positive with intervals excluding zero. But the attack surfaces something worth
stating plainly:

| Band | beta |
|---|---:|
| 800-999 | **+0.1622** |
| 1000-1199 | +0.1429 |
| 1400-1599 | +0.1222 |
| 1800-1999 | +0.0874 |
| 2200-2399 | +0.0661 |
| 2400-2599 | **+0.0354** |

The effect is **4.6 times larger** in the weakest band than the strongest. It is not driven by one
band, and it is also not uniform across skill. Any future claim must carry that gradient.

---

## A-7 -- One phase drives everything. **FAILS**

Opening +0.1071, middlegame +0.0997, endgame +0.0993. Close to uniform on the Test A scale.

Note the tension with the scope map, which is measured on a different quantity: the model-free
within-position heuristic reaches 0.7220 in the endgame and 0.5356 in the opening. Both are true.
The association between a played move's exposure and its cost is flat across phase; the ability of
exposure to **rank candidates** is far higher in the endgame. Reporting only one of those would
misrepresent the result.

---

## A-8 -- Time pressure drives everything. **FAILS, with the same two-quantity nuance**

Test A: low +0.1079, mid +0.1059, high +0.0906. Flat.
Scope map: `clock_pressure=high` 0.6254 against `clock_pressure=low` 0.5276.

Exposure ranks candidates **better** when the player is short of time, which is the opposite of the
failure mode feared before the run.

---

## A-9 -- The candidate analysis only sees positions with convenient engine coverage. **LANDS**

This is the strongest surviving attack and it is not repaired.

Test B ranks among the engine's **MultiPV 8** list. That is a selected candidate set: a move a human
would seriously consider but the engine ranks ninth or worse is **absent from every pair**. So Test B
establishes that exposure ranks well **among engine-plausible moves**, and says nothing about moves
outside that set.

Three things bound the damage without removing it. `L` sits at chance on this set, so the selection
did not hand the models an easy ranking. The set is 8 wide rather than B3's 4, chosen in the freeze
for exactly this reason. And the ecology section reports what happens when the human plays outside
the reasonable set: **3,987 opportunities**, 25.4% of the total, are unclassifiable for that reason
and are excluded from headroom rather than scored as successes.

**Recorded as a limit on Test B's population, not as a defect in its estimate.**

---

## A-10 -- The D04 scope was chosen after seeing outcomes. **FAILS**

The selector vocabulary, the depth limit of 2, the 60/40 player split, the 200-pair minimum and the
judgement rule are all in `RESEARCH_QUESTION_FREEZE.md` section 8, committed at `03613ab` before any
natural number existed. Tertile cuts come from derivation players only. The depth-2 winner was
chosen on derivation and then judged on held-out players.

The rule then cost the study its best-looking finding: `in_check=yes AND phase=endgame` reached
**0.8400 held out** and is labelled **INSUFFICIENT** because it has 175 pairs against a frozen
minimum of 200. A search discipline that never costs anything is not a discipline.

---

## A-11 -- The opportunity definition contains move quality and is circular. **LANDS, as declared**

The freeze declared this in section 10.1 before measuring, and promised a value-free companion. Both
are now reported:

| Definition | Rate |
|---|---:|
| at least two **legal** moves differ in exposure, no engine, no value filter | **95.42%** |
| at least two moves within 0.05 wp of best differ in exposure (primary) | **34.54%** |

The gap is **61 percentage points**, and it is the honest measure of what the player has to supply
themselves. The cue can be *applied* almost everywhere; it is *useful* only where the player has
already generated two reasonable candidates, and generating them is the skill this does not teach.

A policy phrased as "prefer the lower-exposure move" without that qualifier would be advice to play
worse moves 61% of the time. The circularity is real, was declared in advance, and is now
quantified.

---

## A-12 -- P4's wording teaches "never leave pieces attacked", unsupported by P3. **LANDS**

Two independent confirmations.

`AMENDMENT_01` section A downgraded P4 on its own numbers: CONTROL improved by the same +25 pp as
TARGET, so the experiment does not identify the cue as the cause of anything.

The natural data add the second half. A universal reading is not supported: exposure ranks at
**0.5155** in high-material positions and **0.5356** in the opening, against 0.7220 in the endgame.
A rule stated without scope would be strongest where it is weakest.

---

## A-13 -- The personal baseline is contaminated by rating and time drift. **LANDS**

Confirmed from the repository's own failed prediction. `ACCOUNT_BRIDGE_FULL_RESULTS.md` predicted
1.1583 pp of separation from rates observed at 1,240 games and measured 0.6218 pp at 2,209; the
margin swung 0.54 pp onto the wrong side of zero while the bar, predicted from `1/sqrt(n)`, was
right to 0.0053 pp.

Addressed in design, not dismissed: `PRE_EXPOSURE_BASELINE.md` makes the most recent 300 blitz games
the primary window and reports the whole account only beside it.

---

## A-14 -- The exposure timestamp cannot be established. **PARTIAL**

It is bracketed to **19 minutes 42 seconds** between commits `ed7e72b` and `51aba0d`, and the
account corpus was fetched 18.6 hours before the earliest point in that bracket, so every one of the
2,209 games is unambiguously pre-exposure.

The attack still lands on its second half: nothing in the repository **records** when the participant
read the sentence. It is inferred from commit metadata. For a participant who plays during the
study, the bracket would not be enough.

---

## A-15 -- The policy scorer grades move quality rather than rule use. **NOT APPLICABLE, addressed in design**

No scorer was built, because the gate did not license one. `PRE_EXPOSURE_BASELINE.md` section 3.3
already separates `policy_consistency`, `quality_loss` and `opportunity_rate` as three outcomes that
are never merged, which is the defect mission section 17 names.

---

## A-16 -- Shadow logging misses negatives and biases the denominator. **NOT APPLICABLE**

No shadow matcher exists. `C9` failed and the implementation path did not open.

---

## A-17 -- A composite metric was introduced after the result became known. **FAILS**

No composite exists anywhere in this mission. `REDUNDANT_FUTURE_WORK.md` forbids one and gives the
measured reason: the pressure-exposure test already showed what combining unvalidated columns does.
Every model here carries named individual features.

---

## A-18 -- New engine searches duplicate preserved evaluations. **FAILS**

The learning-v3 corpus is `multipv-over-B` and `full-width` at 200,000 nodes. This mission ran
`multipv-8-full-width` and `post-move-best` at 60,000. Different policy and different budget are
different measurements under `cache.py`'s content-addressed key, which this mission imports rather
than redefines. Nothing was recomputed, and all 90,592 values are preserved and findable.

---

## Summary

| Verdict | Attacks |
|---|---|
| **FAILS** | A-1, A-2, A-3, A-4, A-5, A-6, A-7, A-8, A-10, A-17, A-18 |
| **LANDS** | **A-9** (candidate set is engine-selected), **A-11** (circularity, declared and now quantified at 61 pp), **A-12** (a universal reading is unsupported), **A-13** (baseline drift, addressed in design) |
| **PARTIAL** | A-14 (bracketed, not recorded) |
| **NOT APPLICABLE** | A-15, A-16 (nothing was built) |

**None of the landed attacks changes the verdict.** `C9` failed on its own measurement before any of
them was considered. What they change is the strongest permitted claim, which section 19 of the
final report states with those four limits attached.
