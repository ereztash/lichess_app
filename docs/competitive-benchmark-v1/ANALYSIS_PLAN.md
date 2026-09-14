# ANALYSIS_PLAN

## Populations

1. **ITT (primary):** כל randomized participant. Missing T5 responses scored incorrect, with tipping-point sensitivity.
2. **Per-protocol:** completed ≥2/3 units and T5 in window; supportive only.
3. **Technical-cause sensitivity:** excludes research-caused failures only; product failures remain.

## Primary model

Mixed logistic model over item responses:

`correct ~ arm * time + baseline_score + rating_stratum + platform + prior_BAA_use + (1|participant) + (1|item_family)`

Primary contrast: arm difference in baseline-adjusted delayed probability. Report pp estimate, 95% CI and raw arm rates. If model fails to converge, pre-specified fallback is participant-level ANCOVA on delayed proportion with baseline proportion covariate and HC3 SE.

## Secondary

- M2/M5: same model on relevant items.
- M3: ordinal mixed model; fallback participant mean ANCOVA.
- M4: linear model with HC3; also calibration plot.
- M6: Hodges-Lehmann median difference + bootstrap CI; report setup and learning time separately.
- M7/M8/M9/M10: risk difference with Newcombe CI.
- M11: mixed logistic model with eligible opportunity denominator; exploratory.

## Multiplicity

M1 alone is confirmatory; alpha=.05. M2–M5 use Holm correction as one family. Product/behavioral metrics are decision gates with their stated CIs, not significance claims. No fishing across motifs; family interactions are exploratory unless frozen in V2.

## Missingness and attrition

Report reason by arm. Primary ITT treats missing item responses as failure. Sensitivity: multiple imputation using baseline, rating, platform, prior use and completion; best/worst-arm tipping table. Differential attrition >10pp is reported as a threat even if imputation is stable.

## Heterogeneity

Pre-specified: rating stratum, prior BAA use, platform, English proficiency. No segment claim unless interaction CI excludes 0 and cell n≥25. Otherwise descriptive.

## Comparator qualification

Q data selects BAA only and is archived separately. It is never pooled with C. The selected incumbent version and paid plan are frozen before C randomization.

## No composite

Job-by-job forest plot, friction table, behavior table, commercial table. If epistemic gain and friction point in opposite directions, verdict is unresolved unless T7 revealed behavior crosses the frozen threshold.
