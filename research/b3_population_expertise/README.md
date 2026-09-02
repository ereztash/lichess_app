# B3 -- Population Expertise x Decision Dynamics

**One question.** Across a population of ordinary blitz players, is there a common relationship
among position difficulty, thinking time, the value of further calculation, and move quality -- and
does increasing expertise show up as better *management* of that relationship, rather than only as
a higher level of the outcome?

**Why it is not B2 again.** B2 (`research/b2/`) is one account: 117 rated blitz games, 2,720
eligible decisions, one skill level, no measure of position difficulty and no measure of whether
more calculation was worth anything. It could establish that some representation of think time
separates accuracy. It could not ask whether that separation holds at 900 and at 2500, and it could
not ask whether stronger players spend their seconds in different places.

**Read in this order.**

| File | What it settles |
|---|---|
| `PREREGISTRATION.md` | the hypotheses, the alternative explanations they must survive, and the language that is forbidden regardless of result |
| `DATA_PROTOCOL.md` | source, periods, sampling, every exclusion |
| `FEATURE_SCHEMA.md` | every column, its definition, and the pre-move rule |
| `MODEL_SPEC.md` | the models, the estimators, and all eighteen controls with their pass conditions |
| `VERDICT_RULES.md` | the verdict, as a mechanical function of numbers fixed in advance |
| `REPRODUCIBILITY.md` | the B2 reproduction gate, and how to reproduce it |
| `FAILURES.md` | what went wrong, in the order it was found |
| `MODEL_LEDGER.md` | which model did which piece of thinking |
| `REPORT.md` | the result |
| `reviews/` | four independent adversarial reviews, at four fixed gates |

**Three design choices carry most of the weight.**

1. **Every model is fitted on DEVELOPMENT and applied frozen.** Once that is true, the
   Frisch-Waugh-Lovell theorem makes every reported coefficient the simple slope of one frozen
   residual on another, so the period a result is read from supplies two vectors and no model fit.
   It is also what makes the holdout a holdout.
2. **Every interval is a player-level block bootstrap.** Moves inside a game are not independent
   draws. With N in the hundreds of thousands, a move-level p-value is arbitrarily small and means
   nothing.
3. **The verdict is a program.** `src/evaluate.py` is a transcription of `VERDICT_RULES.md`, run on
   `results/analysis.json` before any narrative exists, with an absolute effect-size floor fixed
   before any estimate did.

**The seal is mechanical.** `src/run.py` refuses to read `data/final/` until
`results/FINAL_HOLDOUT_SEALED.json` exists, which happens only when the independent pre-holdout
audit returns PASS. A study that asks its author to remember not to look has not sealed anything.

## Running it

```
python3 -m venv .venv-b3 && .venv-b3/bin/pip install numpy scipy pandas scikit-learn \
        statsmodels matplotlib chess zstandard requests pytest

cd research/b3_population_expertise
python src/pilot.py  --period development                       # supply and cost; no effects
python src/score.py  --period development --rates src/rates_primary.json --out data/development
python src/run.py    --stage develop
python src/run.py    --stage validate
#   ... FABLE GATE 2, then results/FINAL_HOLDOUT_SEALED.json ...
python src/score.py  --period final --rates src/rates_primary.json --out data/final
python src/run.py    --stage final
python src/evaluate.py --analysis results/analysis_final.json
python src/make_report.py
python -m pytest tests/
```

The scored per-decision files are gitignored -- hundreds of megabytes, rebuildable from the
manifests beside them, which carry the source URL, the prefix byte count, the prefix sha256, the
seed, the acceptance rates, the caps, and the engine identity and options.

## What this cannot tell you

It is observational. It does not identify a causal effect of thinking time on move quality; it does
not measure cognition; `unexpected_time` is a regression residual of a clock difference and is
named that way in every file here for that reason. The strongest phrase the design can license, and
only if the invariance tests support it, is *cross-rating law-like regularity*.
