# Falsifiers -- written before the data existed

Companion to `RESEARCH_QUESTION_FREEZE.md`, frozen in the same commit and hashed in the same
`FREEZE.json`.

A falsifier written after the evidence is a description of the evidence. Each entry below states a
prediction, the observation that would kill it, and what the repository must then conclude. None of
them is worded so that any outcome satisfies it.

The register is deliberately front-loaded with the ways this could be **nothing**: a restatement of
material, of mobility, of position value, of who the player is, or of a pipeline leak.

---

## Primary

### F-1 -- the association exists at all
**Predicts:** the standardized coefficient of `OwnExposure_delta` on `quality_loss`, with the full
frozen control set, is positive with a player-cluster 95% CI excluding 0.
**Falsified if:** the CI includes 0, or the sign is negative.
**Then:** `SYSTEM POLICY REJECTED`. There is no natural association to scope.

### F-2 -- it survives within position
**Predicts:** `L + Epost` beats `L` on within-position pairwise ranking by at least 1.0 pp, CI above 0.
**Falsified if:** the gain is below 1.0 pp or its CI includes 0.
**Then:** `SYSTEM POLICY REJECTED`. This is the decisive test; Test A alone cannot carry the claim,
because a position-level confound reproduces it exactly.

---

## The simpler explanations (mission section 7)

### F-A7 -- material
**Predicts:** `L + Epost` beats `L + Material` by at least 1.0 pp.
**Falsified if:** material explains within 1.0 pp of it.
**Then:** the relational reading is unsupported. Report as *material proxy*, not as a system
invariant. Attack 1 lands.

### F-A8 -- mobility
**Predicts:** `L + Epost` beats `L + Mobility` by at least 1.0 pp.
**Falsified if:** mobility explains within 1.0 pp.
**Then:** report as *mobility proxy*. Attack 2 lands.

### F-A6 -- position value / difficulty
**Predicts:** the Test A coefficient keeps sign and significance with `wp1`, `edge`, `gap12` and
`n_near` in the model.
**Falsified if:** conditioning on them removes it.
**Then:** OwnExposure is a marker of already-bad positions, not a decision variable. Attack 3 lands.

### F-A9 -- the pipeline leaks
**Predicts:** permuting `OwnExposure` **within player** (preserving each player's marginal
distribution and every dependence structure) destroys the effect.
**Falsified if:** the permuted metric still shows the effect.
**Then:** `MEASUREMENT_INVALID`. Nothing else in this mission may be reported as a finding. The
permutation unit is the player and is fixed here, not chosen later.

### F-A10 -- the effect is not specific to this metric
**Predicts:** three board-derived control metrics, **named now**, show a smaller within-position gain
than `OwnExposure_post`:
1. `own_redundantly_defended_count` (own non-king pieces with at least 2 defenders)
2. `own_max_defense_dependency` (largest number of own squares defended by one own piece)
3. `own_king_ring_own_defenses` (defender count summed over the king ring)

All three are already computed by `p3_system_invariant.py`, all three are plausible relational
quantities, and all three are being nominated **before** any of them has been evaluated on this
data, so none can be swapped in later for giving a convenient contrast.
**Falsified if:** any of the three matches or exceeds `OwnExposure_post`.
**Then:** the specificity claim fails; report the family, not the column.

---

## Breadth (mission section 7, A1-A3)

### F-A1 -- rating
**Predicts:** the sign holds in at least 7 of 9 B3 rating bands.
**Falsified if:** fewer than 7.
**Then:** `NARROW` at best, scoped to the bands where it holds. **All 9 bands are reported whatever
happens**; a pooled average alone is not an acceptable report.

### F-A2 -- phase
**Predicts:** the sign holds in opening, middlegame and endgame.
**Falsified if:** any phase reverses.
**Then:** `NARROW`, scoped to the phases that hold.

### F-A3 -- clock pressure
**Predicts:** the sign holds in all three clock-pressure tertiles.
**Falsified if:** it reverses or vanishes under time pressure.
**Then:** `NARROW`. This one matters most for the product: a cue that only works when the player has
time is a cue that fails exactly when blitz players need it.

---

## Dependence (A4, A5)

### F-A4 -- within player
**Predicts:** the effect survives comparing a player's decisions against that same player's
decisions.
**Falsified if:** the within-player CI includes 0.
**Then:** the effect is composition across players, not a decision-level regularity. `REJECTED`.

### F-A5 -- within game
**Predicts:** the effect survives within-game estimation.
**Falsified if:** it does not.
**Then:** report as a between-game/position-quality effect, not a move-choice effect.

---

## Ecology (mission section 12)

### F-E1 -- opportunity density
**Predicts:** eligible opportunities occur in at least 5.0% of natural decisions.
**Falsified if:** below 1.0%.
**Then:** `SYSTEM POLICY VALID, ECOLOGICALLY INFEASIBLE`. Between 1.0% and 5.0% is `NARROW`.

### F-E2 -- headroom
**Predicts:** humans choose the higher-exposure reasonable candidate in at least 20% of
opportunities.
**Falsified if:** below 20%.
**Then:** there is nothing to teach; the ceiling is already reached.

### F-E3 -- consequence
**Predicts:** at least 30% of higher-exposure choices cost at least 0.02761 win probability.
**Falsified if:** below 30%.
**Then:** the mistake is free, and RC-05's failure mode has repeated. `ECOLOGICALLY INFEASIBLE`.

---

## Reproduction (mission section 4)

### F-P3 -- P3 reproduces
**Predicts:** rerunning `p3_system_invariant.py` on committed artefacts reproduces the published
verdict and its reported numbers.
**Falsified if:** it does not.
**Then:** classify as `P3_REPRODUCED` / `P3_IMPLEMENTATION_DRIFT` / `P3_DATA_MISSING` /
`P3_AUTHORITY_AMBIGUOUS` and **stop widening**. A mission that generalises an unreproducible result
is generalising nothing.

### F-X -- the extractor is equivalent
**Predicts:** any reusable extractor written for this mission returns values identical to
`p3_system_invariant.py` on every position it is tested against.
**Falsified if:** a single position disagrees.
**Then:** the extractor is wrong and no result computed with it stands. A port that is *nearly* the
same metric is a different metric.

---

## What no falsifier here can catch

That the construct is the wrong idea. That `attackers > defenders` is a poor model of danger. That a
count is the wrong shape for the quantity. These are answered by whether the thing predicts, and
predicting is not the same as being right.
