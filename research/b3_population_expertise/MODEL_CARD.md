# B3 -- model card

What was built, what it may be used for, and what it must not be used for. Written before the
result, so nothing here is shaped by which way the numbers went.

---

## 1. What the models are

| Name | Predicts | From | Fitted on |
|---|---|---|---|
| `T0` | `log(1 + T)` | phase, standing, ply, move number, both clocks, clock pressure, clock difference, non-pawn material, colour, `rating_diff`, opponent's previous think time | DEVELOPMENT |
| `T1P` | `log(1 + T)` | T0 + engine difficulty and search-complexity features from the pre-move search | DEVELOPMENT |
| `T2P` / `T2R` | `log(1 + T)` | T1 + value-of-computation features + two preregistered interactions; `T2R` adds rating | DEVELOPMENT |
| `Q0` | `quality_loss` | the T2R feature set | DEVELOPMENT |
| `partial_*` | one right-hand-side quantity | the nuisance set it must be purged of | DEVELOPMENT |
| `gbt` | `log(1 + T)` | the T2R numeric and binary columns | DEVELOPMENT |

All are additive natural-cubic-spline regressions with a ridge penalty, except `gbt`, which is a
pinned gradient-boosted tree.

## 2. What they are for

**Every one of them is a nuisance model.** Their job is to say what a decision's thinking time and
quality *ought* to look like given the position, the clock and the skill level, so that what is left
over can be examined. None of them is a claim about how a person decides.

The two quantities the study actually reports are residual slopes:

* `beta` -- does unusually long deliberation, net of measured difficulty, value of computation,
  clock and rating, still predict a worse move?
* the Metric B gradient -- does the relation between thinking time and the value of further
  computation change with rating?

## 3. What they must not be used for

* **Predicting a player's rating from behaviour.** Nothing here is validated for that, and
  `PREREGISTRATION.md` §9 forbids reporting it.
* **Judging an individual.** The player-level estimates are shrunk group-level summaries with
  roughly thirty decisions behind each. They are for a population trend and are not fit to tell one
  person anything about themselves.
* **Detecting engine assistance.** Metric B is close in shape to what assistance detection looks
  for, which is why closed accounts are *excluded* here. Turning it around and using it as a
  detector would be using an uncalibrated statistic to accuse people.
* **Any causal claim.** `beta` is an adjusted association. Difficulty is measured with error by one
  engine at one budget, so the residual absorbs whatever the engine features miss.
* **Any claim about cognition.** `unexpected_time` is a regression residual of a clock difference.

## 4. Known limitations, in the order they matter

1. **Unmeasured difficulty (A2).** The central limitation. Adjustment shrinks it; nothing here
   removes it. C9 is the only falsification handle and at `n = 5,000` it can only see attenuation of
   roughly two-thirds or more.
2. **Allocation versus recognition.** No metric separates a better allocation policy from better
   recognition of which positions need computation. A stronger player who merely *sees* that a
   position is sharp produces the same Metric B gradient as one who allocates better.
3. **Whole-second clocks.** The Lichess dumps write clocks to the second, so `T = 0` means "under a
   second" and `log(1 + T)` has a point mass and visible steps. C17 repeats everything without them.
4. **One engine, one budget.** 60,000 nodes at MultiPV 4, median depth ~12.
5. **One calendar day per period.** A complete diurnal cycle, but one day's player mix.
6. **The win-probability curve is population-dependent.** Lichess fitted it on 2300-rated games;
   B3 applies it from 800 to 2600. It is not equally right across that range, and every effect size
   in win-probability units inherits that.
7. **The account-status lookup is a snapshot** whose lag differs by period, leaving FINAL's top band
   the least cleaned -- a direction that favours the hypothesis.

## 5. Reproducibility

Engine, options, node budget and binary sha256 in `FEATURE_SCHEMA.md` §1; the frozen constants,
knots, penalties and coefficients in `results/model_manifest.json`; the corpus provenance (source
URL, prefix bytes, prefix sha256, seed, acceptance rates, caps, account-lookup date) in each
period's `manifest.json`. Determinism is measured, not assumed:
`tests/test_engine_determinism.py`.

## 6. Ethics

No plaintext username reaches any committed artifact; players are `blake2b` pseudonyms. The source
is Lichess's own public database dump, published for research. Nothing here identifies an
individual, and §3 says why it must not be turned into something that does.

---

## 7. What the run taught about these models (added after the result; nothing above was edited)

1. **They drift, and the drift is visible in the controls before it is visible anywhere else.**
   Fitted in February and applied in June, every destructive null carries an offset from zero
   (0.6 to 2.5 null standard deviations on FINAL, larger than on April). One crossed the tolerance
   and failed the mechanical verdict; the derivation, the repair and the offset table are in
   amendment A7 and `REPORT.md` section 6.3. The estimates themselves moved about 2% under
   drift-free re-estimation, because the estimator's regressor is correlated with the frozen
   prediction and the misfit cancels. **A frozen nuisance model is safer inside an estimate than
   inside a null.**
2. **They do not extrapolate to another time control.** The frozen time models were fitted on
   three-minute clocks; on five-minute clocks about two thirds of decisions are outside the knot
   range and the frozen prediction of log-time runs negative. Every number in the secondary block
   is an artefact of that. A second time control needs its own development day and its own fits.
3. **`T1P` explains about 3% of residual time variance.** The whole fourteen-feature
   engine-difficulty block moves `beta` by 3.7%. That is consistent with `beta` being robust to
   measured difficulty and equally consistent with the features measuring very little of what makes
   a human slow and wrong. The model card cannot choose between those and neither does the report.
4. **`voc_z`, as a model input, is not the instrument its name suggests.** It is zero by
   construction on 59% of decisions, correlates 0.62 with itself across engine budgets, has a 1.7%
   partial correlation with residual thinking time, and does not respond to how much clock is left.
   Any future use of it as a measure of "how much further thinking is worth here" should read
   `REPORT.md` section 5.2 first.
