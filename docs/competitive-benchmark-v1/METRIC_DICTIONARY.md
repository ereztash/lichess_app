# METRIC_DICTIONARY

אין משקל ואין סכימה לציון אחד.

| ID | Layer | Metric | Operational definition | Direction | Role |
|---|---|---|---|---|---|
| M1 | epistemic | delayed_acceptable_move_rate | accepted moves / attempted T5 trigger items | higher | **primary** |
| M2 | epistemic | nontrigger_safe_rate | non-trigger items שבהם ההחלטה לא נפגעה מהפעלת יתר | higher | key secondary |
| M3 | epistemic | blinded_explanation_score | 0–8 לפי rubric | higher | secondary |
| M4 | epistemic | calibration_brier | mean((confidence_probability-correct)^2), mapping frozen מראש | lower | secondary |
| M5 | epistemic | far_transfer_rate | accepted move rate ב-surface-distance far | higher | secondary |
| M6 | product | active_minutes | foreground active time, idle >120s removed and reported | lower conditional on value | friction gate |
| M7 | product | completion_rate | completed all assigned native units / randomized | higher | friction gate |
| M8 | product | technical_failure_rate | participants with ≥1 product-caused blocking failure | lower | diagnostic/gate |
| M9 | behavioral | voluntary_choice_DL | chose DL first in T7 and completed meaningful session | higher | trade-off adjudicator |
| M10 | behavioral | day7_return | meaningful session on day 7±1 without product-specific reminder | higher | secondary |
| M11 | behavioral | future_recurrence_rate | labelled recurrence / eligible opportunities in prospective games | lower | exploratory |
| M12 | commercial | paid_conversion | own-money completed transaction at frozen price | higher | **not collected in v1** |

## Definitions

- **Attempted:** item shown for ≥5 seconds; timeout scored incorrect in ITT.
- **Accepted move:** in the pre-frozen accepted set. Engine top-1 is not required.
- **Meaningful session:** ≥5 active minutes and ≥1 completed review/training act.
- **Product-caused failure:** error originating in product, plan limitation or documented workflow. Counts against the arm.
- **Research-caused failure:** launcher, credentials supplied by study, data pipeline or moderator error. Can trigger invalidity; never charged to product.
- **Confidence mapping:** 1..7 → [0.05,0.20,0.35,0.50,0.65,0.80,0.95].
- **Incremental value:** arm contrast, never raw post-score.

Raw cp-loss, Elo change, satisfaction and NPS may be reported descriptively; none may replace M1.
