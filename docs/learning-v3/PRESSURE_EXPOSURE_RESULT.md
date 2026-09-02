# Pressure–Exposure learning-loop result

Status: **COMPLETE**  
Verdict: **`PE-EXPOSURE-ONLY`**  
Protocol authority: `docs/learning-v3/PRESSURE_EXPOSURE_PREREG.md`  
Freeze commit: `612c35740392962b085363638e052b12d071b669`

## Question

Can the proposed player-facing loop be licensed from the preserved data?

> reduce my exposed pieces, then increase pressure on the opponent

The frozen test used only already-valid RC-07/08/09 actions, leave-one-rule-class-out transfer, the same local comparator as P3, 5,000 position-cluster bootstrap replicates, and **0 new engine searches**.

## Data integrity

- move rows: **4,139**
- source positions: **711**
- informative primary pairs: **4,546** across **369** positions
- missing preserved move evaluations: **0**
- engine searches: **0**

## Frozen decision outcome

| Claim | Result |
|---|---|
| C1 — lower own exposure predicts better moves | **PASS** |
| C2 — higher opponent pressure predicts better moves | **FAIL** |
| C3 — pressure adds beyond exposure | **FAIL** |
| C4 — literal increase/decrease wording is jointly stable | **FAIL** |

Therefore:

> **`PE-EXPOSURE-ONLY — exposure supported; pressure loop not licensed`**

## Exposure result

`OwnExposure_post` = own non-king pieces with more enemy attackers than own defenders after the move.

Its standardized coefficient was positive in every held-out fold, exactly in the preregistered direction:

- RC-07 held out: **+0.0580**
- RC-08 held out: **+0.0602**
- RC-09 held out: **+0.0676**

Higher own exposure therefore predicts more regret across all three transfer folds.

Pairwise ranking:

- local comparator: **57.79%**
- local + `OwnExposure_post`: **63.55%**
- gain: **+5.76 pp**
- 95% position-cluster CI: **[+3.93, +7.68] pp**

The literal delta version also survives:

- local + `OwnExposure_delta`: **61.97%**
- gain over local: **+4.18 pp**
- 95% CI: **[+2.60, +5.83] pp**
- delta coefficients positive in 3/3 folds.

So both resulting-state and change language are individually supported for **own exposure**.

## Pressure result

`OpponentPressure_post` = opponent non-king pieces with more attackers from us than defenders from them after the move.

The preregistered hypothesis predicted a **negative** regret coefficient: more opponent overload should predict a better move.

The observed coefficients were instead positive in **all three** folds:

- RC-07 held out: **+0.0158**
- RC-08 held out: **+0.0157**
- RC-09 held out: **+0.0248**

That is the opposite of the proposed post-state direction.

Pairwise ranking:

- local comparator: **57.79%**
- local + `OpponentPressure_post`: **56.95%**
- change: **−0.84 pp**
- 95% CI: **[−1.85, +0.20] pp**

Pressure also failed the incremental test after exposure:

- local + exposure: **63.55%**
- local + exposure + pressure: **63.18%**
- incremental change: **−0.37 pp**
- 95% CI: **[−0.96, +0.19] pp**

So the pressure count neither adds robust predictive information alone nor after the supported exposure feature.

The delta pressure feature also fails the frozen direction guard: its standalone standardized signs are negative for RC-07 and RC-08 but **positive for RC-09**, and its pooled ranking change over local is essentially zero.

## Exploratory diagnostic — why the count fails

This diagnostic was run **after** the frozen verdict and cannot change it.

For within-position move pairs where the relevant count differed, ask whether the simple player heuristic alone picked the lower-regret move.

### Own exposure: lower is better

- all informative pairs: **1,115 / 1,459 = 76.4%**
- both moves non-captures: **747 / 953 = 78.4%**
- at least one capture: **368 / 506 = 72.7%**

The exposure heuristic remains strong in both strata.

### Opponent pressure: higher is better

- all informative pairs: **761 / 1,665 = 45.7%**
- both moves non-captures: **536 / 972 = 55.1%**
- at least one capture: **225 / 693 = 32.5%**

The capture stratum exposes a structural problem with the count: a successful move can **capture and remove** an opponent piece that was under pressure, making the post-move count smaller precisely when the action succeeded. This is consistent with a “success paradox” for a stock count of threatened opponent pieces.

Even after removing that mechanism by looking only at non-captures, the simple pressure heuristic is only **55.1%**, far weaker than the exposure signal and not enough to rescue the frozen claim.

(Post and delta pairwise heuristic rankings are identical within a position because the pre-move count is common to both candidate moves; subtracting the same baseline does not change their order.)

## Product consequence

The data now license this component of the learning loop:

> **After a candidate move, check how many of your own pieces would have more attackers than defenders. Prefer, among already-valid actions, the option that leaves fewer such exposures.**

They do **not** license:

> “Then maximize the number of opponent pieces with more attackers than defenders.”

That offensive rule should not enter the product in this form.

The failure does not imply that pressure is irrelevant. It implies that **counting currently threatened opponent pieces is the wrong representation of offensive progress**. A future offensive metric must distinguish creating credible pressure from successfully converting/removing the target, and should probably represent opponent constraint or threat-channel viability rather than a raw stock count.

## Current authority boundary

Supported:

- own-exposure resulting state;
- own-exposure reduction direction;
- transfer across RC-07/08/09 valid-action ranking;
- prior N-of-1 human cue evidence for the same exposure concept.

Not supported:

- raw opponent-threat count as a second-stage objective;
- a symmetric `own exposure ↓ + opponent exposure ↑` score;
- any weighting between defense and attack;
- population or natural-game causal efficacy;
- homeostasis or a global system-health score.
