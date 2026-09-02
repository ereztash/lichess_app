PASS_WITH_REQUIRED_CHANGES

# FABLE GATE 2 -- pre-holdout seal audit (independent scientific adversary)

**Reviewer role:** adversary, in a fresh context, assuming the researchers want the hypothesis to be
true. **Read in full:** `GATE_2_PACKET.md`, `results/POST_FREEZE_AMENDMENTS.md`,
`results/PREREGISTRATION_FREEZE.json`, the five frozen documents, all three Gate 1 passes
(R1-R13, N1-N9, M1-M5), every file in `src/` and `tests/`, `results/analysis_validate.json`,
`analysis_develop.json`, `c9.json`, `gate_checks.json`, `model_manifest.json`, every
`data/*/manifest.json`, `FAILURES.md`, `MODEL_LEDGER.md`, `MODEL_CARD.md`, `README.md`,
`REPRODUCIBILITY.md`, `SAMPLE_SIZE_FREEZE.md`, and the git history of the experiment including
dangling objects. **Run:** the test suite (53 passed); a read-only reconstruction of every frozen
fit from the manifest penalties (coefficients reproduce the manifest to 0.0) and of the residualised
DEVELOPMENT and VALIDATION frames (beta, the Metric B gradient and Metric A reproduce the shipped
numbers to seven decimals); and the independent analyses quoted below, all in the scratchpad. **Not
touched:** no research code, document, or result was edited; this file is the only write.
`data/final/` does not exist and no byte of the 2026-06 dump was read by me or, as far as the disk
and the history show, by anyone.

## Summary

The holdout is sealed. Nothing derived from 2026-06 exists on disk, in any manifest, in any commit
on any ref, or in the dangling objects; every frozen constant, knot, rate, threshold and coefficient
traces to DEVELOPMENT or to Gate 1; the results on disk correspond to the committed code (cache keys
recomputed); and the post-freeze code changes altered no DEVELOPMENT estimate (zero differences
between the pre-amendment and post-amendment analyses of the same period). The primary estimator is
sound where it matters: re-estimated on VALIDATION as a three-parameter partial regression it agrees
with the shipped `beta` to five decimals (0.014116 vs 0.014119), and with every nuisance model
**refitted on VALIDATION** it returns 0.014177 against the frozen 0.014119. H1 is real and the
freeze is not what produced it.

The amendments are repairs in substance. But the document that describes them is inaccurate in
four places that matter for how the report will read, and the audit found three defects in
verdict-bearing machinery that must be fixed before FINAL is scored: (i) three of the "five
VALIDATION failures" -- C3, C4 and C7 -- had already failed on DEVELOPMENT in the committed
pre-amendment analysis and were systematic, not draws; (ii) C3's construction was changed (the
recomputation of `rating_diff`, which the Gate 1 re-review had explicitly approved, was dropped) and
that change, not the permutation count, is what fixed it -- it is nowhere in the amendments
document; (iii) the destructive controls are seeded from Python's per-process-salted `hash()`, so
no control number on record can be regenerated, and the amendments document's own DEVELOPMENT
figures already disagree with the committed results for that reason; (iv) C7's `extreme_ut_vs_rating`
-- a field `evaluate.py` lists as required -- is a hard-coded `[0, 0, 0]`. None of this changes a
scientific choice, none of it needs FINAL to fix, and none of it can manufacture the top verdict,
which the walk in §4 shows failing seven H2 conditions at once on VALIDATION-like numbers. The
verdict is therefore `PASS_WITH_REQUIRED_CHANGES`; the exact list is in §6, and the holdout may be
opened the moment it is done.

---

## 1. Sealing audit

### 1.1 Direct: is any part of 2026-06 anywhere?

* `data/` holds `development`, `validation`, `validation_150k`, `validation_60k` and nothing else;
  `results/FINAL_HOLDOUT_SEALED.json` does not exist; `analysis_final.json` and `verdict.json` do
  not exist.
* A disk-wide search for `2026-06`, `2026_06`, `lichess_db*`, `*.pgn.zst` finds only the frozen
  documents, `score.py`'s period table, and B2's own PGN exports in the scratchpad.
* `git log --all --name-only` over the experiment directory lists no path ever committed on any ref
  that names `final`, `2026-06` or a verdict artefact (the only hits are `VERDICT_RULES.md`,
  `test_verdict_rules.py`, and the secondary-control pilot/rates files, which are `300+0` supply
  numbers from 2026-02). The four dangling commits are August product-UI work with no B3 content.
* Both cost pilots streamed 2026-02 only; `rates_primary.json` (21:46:15) predates every scored
  decision and is byte-identical in both period manifests.

### 1.2 Indirect: could FINAL have shaped anything?

Checked item by item. **Feature selection, outcome, exclusions, bands, thresholds, model family,
hyperparameter grid, knot rule, sample size:** fixed in the five documents hashed at `8141c5b`;
`PREREGISTRATION.md`, `DATA_PROTOCOL.md`, `FEATURE_SCHEMA.md` and `VERDICT_RULES.md` are
byte-identical to their frozen hashes; `MODEL_SPEC.md` differs from its frozen hash only in §9
(verified by diff: 17 insertions, 5 deletions, all in the controls table and its preamble). Every
literal in `evaluate.py` matches the documents. **Frozen constants:** `frozen_constants(dev)`
recomputed by me equals the manifest to 1e-9, including `ut_q95`. **Coefficients:** refitting every
model with the manifest's penalties reproduces every coefficient and intercept to 0.0. **Rating
basis knots:** DEVELOPMENT quantiles. **Acceptance rates:** the pilot's. **Results on disk match the
code on disk:** `period_development.json` and `period_validation.json` carry `_cache_key` values I
recomputed from the current `src/*.py`, the constants and the penalties -- both match, so no result
was produced by code that is not committed. **Post-freeze code changes:** commits `4387189` and
`e70a0de` changed `analysis.py` (bootstrap resamples built once), `estimands.py` (the `only` fast
path), `run.py` (period cache), `controls.py` (the amendments). The DEVELOPMENT estimates, matched
estimates and player-level block in `analysis_validate.json` (amended code) are identical, number
for number, to those in `analysis_develop.json` (pre-amendment code): zero differences. The
amendments touched controls and nothing else, as claimed.

### 1.3 The seal mechanism, tested rather than described

`run.require_seal()` raises `SystemExit` (tested directly), and `run.py` calls it before reading any
period whenever `final` is in the stage or the stage is `secondary`. That is real. It is also the
only guard. **`score.py` -- the script that would actually stream 2026-06 and score it -- has no
seal check**; nor do `rescore.py`, `gate_checks.py` or `make_report.py`, each of which reads
whatever period directory it is pointed at, and `make_report.py` picks up `data/final` automatically
if it exists. `python src/score.py --period final ...` runs today, unchallenged, and writes a
manifest with per-band decision counts to stderr. The README's "the seal is mechanical" is true of
the analysis and false of the ingest. Required change R4.

### 1.4 What is on record can be re-derived -- except the controls

* Engine determinism: `gate_checks.json` re-scored 250 DEVELOPMENT decisions with 0 mismatches. I
  add a stronger one for free: the C9 60k-node re-score (`data/validation_60k`, a fresh process)
  reproduces the original VALIDATION rows for all 5,000 decisions with **0 mismatches in 17 fields**,
  including `quality_loss`, `voc_regret` and `accurate`. VALIDATION is deterministic too.
* **Control seeds are not reproducible.** `controls._rng(tag)` seeds `default_rng` with
  `abs(hash((SEED, tag))) % 2**32`; `hash()` of a tuple containing a string is salted per process
  when `PYTHONHASHSEED` is unset, which it is. Three consecutive processes gave seeds 1571311460,
  1028081532 and 2254223279 for `"C1"`. Every permutation, C6/C7/C7b draw and null interval in
  `analysis_validate.json` therefore comes from an unrecorded random state and cannot be regenerated;
  the pre-amendment single draws that "failed" cannot be reconstructed at all. The amendments
  document already shows the symptom: it quotes DEVELOPMENT C1 after repair as -0.00002
  [-0.00089, +0.00080] and C2 as +0.00002 [-0.00044, +0.00052], while the committed file holds
  -0.000003 [-0.00074, +0.00090] and -0.000004 [-0.00061, +0.00051] -- two runs, two answers. The
  bootstrap (`default_rng(BOOT_SEED)`, an integer) is unaffected. Required change R1.

### 1.5 Provenance defects in the freeze record

* `PREREGISTRATION_FREEZE.json` records `git_commit_at_freeze = 3b5fd72`, but at `3b5fd72` the
  documents hash to `c9aae632...` (PREREGISTRATION), `431ecb57...` (MODEL_SPEC) and `1d7c0cc8...`
  (VERDICT_RULES) -- the third re-read's pre-edit versions. The hashes in the JSON are those of
  `8141c5b`, the freeze commit itself. Likewise `amended_commit = 4387189` names the development
  commit; the amendment commit is `e70a0de`. Both are "HEAD at the moment the file was written",
  one commit stale. A freeze record must name the commit that contains what it hashes.
* `MODEL_LEDGER.md` ends at row 17 (the freeze, 22:26). DEVELOPMENT scoring finishing, the
  gate checks, VALIDATION scoring, C9, the five failures, the amendments, the packet and the
  figures are not in it, although its own preamble says it is "appended to as the run proceeds".
  Required change R6.

**Sealing conclusion:** not contaminated. The one structural weakness (1.3) is a missing guard on
the ingest script, repairable in ten lines without reading anything.

---

## 2. The post-freeze amendments: REPAIR or RESCUE

### 2.0 What actually failed, and when -- the record the amendments document does not give

The document says "On VALIDATION, five controls failed". The committed pre-amendment DEVELOPMENT
analysis (`results/analysis_develop.json`, commit `4387189`, message "development scored and
analysed; the regularity is there, the primary expertise metric is not", which mentions no control)
already contained, under the frozen construction:

| pre-amendment DEVELOPMENT control | value | excludes 0 |
|---|---|---|
| C1 `beta` | +0.00077 [-0.00009, +0.00181] | no |
| C2 `beta` | +0.00039 [-0.00014, +0.00104] | no |
| C3 `tae_rating_gradient` | +0.00185 [+0.00089, +0.00281] | **yes** |
| C3 `allocation_loss_vs_rating` | +0.00347 [+0.00263, +0.00428] | **yes** |
| C3 `extreme_ut_vs_rating` | +0.00195 [+0.00153, +0.00237] | **yes** |
| C3 `beta_rating_interaction` | +0.00051 [+0.00032, +0.00068] | **yes** |
| C4 `tae_rating_gradient` | -0.00099 [-0.00167, -0.00023] | **yes** |
| C7 `beta` | +0.00113 [+0.00044, +0.00187] | **yes** |

So C3 (four fields), C4 and C7 had failed on DEVELOPMENT, with intervals that are not close, before
VALIDATION was analysed; only C1 and C2 first failed on VALIDATION. The amendments document must say
so (R5). It matters because the document's central explanatory device -- "an ordinary tail value
being read against the wrong ruler" -- is offered for all five, and it is true of at most two.

### A1. Destructive controls as permutation tests -- **REPAIR of the ruler; the text overclaims**

(a) *Is a single permutation with a bootstrap interval genuinely not a test of the null?* Correct.
The bootstrap interval around one shuffled dataset is that dataset's sampling interval; its centre
is one draw from the null, and "contains 0" is then "this one draw is within two bootstrap SEs of
zero", which fails about 5% of the time per field with a perfectly unbiased estimator. Ten fields
were read on VALIDATION; that alone predicts half a false failure. The diagnosis is right.

*But three claims made about the repair are wrong and must be corrected.*

1. **"Strictly harder to pass" is false.** The new rule -- the central 95% of the null across
   permutations contains 0 -- has an essentially zero false-failure rate and can only fail when the
   estimator's bias under the null exceeds about two null SDs (about 0.001 for `beta`). The old rule
   failed on noise and was, noisily, sensitive to smaller biases. The new rule is the right shape
   for a code check; it is not stricter. And it is not "the discipline B2's `analyse.py` applies":
   B2 compares the *observed* statistic against the null's 95th percentile; this compares the
   *null* against zero.
2. **The null is measurably off zero on VALIDATION, and the new rule cannot see it.** C1's amended
   VALIDATION null is -0.00041 with sd 0.00054 over 200 draws, i.e. a Monte-Carlo SE of 0.00004:
   ten SEs from zero. I reproduced it (100 draws: mean -0.000455, -8.7 SE) and derived it: under a
   destroyed-quality null the shipped estimator returns exactly `-slope(Qhat0, ut_resid)`, which is
   -0.000001 on DEVELOPMENT (in-sample ridge residuals are orthogonal to the design) and -0.000449
   on VALIDATION (frozen fits applied out of sample are not). C2's null (-0.00023) is the same
   phenomenon. This is the fingerprint of the freeze, it is 3% of `beta`, and it is *negative*. It
   does not threaten H1; it must be reported as what it is rather than hidden inside "contains 0".
3. **"An ordinary tail value" is not what the VALIDATION draws were.** The old C1 draw, -0.00174,
   lies outside the amended null's own 95% interval [-0.00146, +0.00059]; the old C2 draw, -0.00082,
   lies just outside [-0.00080, +0.00037]. Two of two beyond the 2.5th percentile. Because the seeds
   are process-salted (§1.4) neither draw can be regenerated, so this cannot be resolved either way;
   the document should state it as unresolved rather than as explained.

(b) *Is the estimator unbiased as claimed -- "three-parameter partial regression agrees to five
decimals"?* The document did that check on **DEVELOPMENT**, where the frozen fits are in-sample and
Frisch-Waugh-Lovell equivalence is close to automatic; it proves little about the periods the
result is read from. I did it on **VALIDATION**: `quality_loss ~ 1 + ut + Qhat0 + UThat` gives
0.0141162 against the shipped 0.0141192 (DEVELOPMENT: 0.0126936 vs 0.0126968). Its destroyed-quality
null on VALIDATION is centred (mean -0.000005, -0.1 MC-SE) where the shipped estimator's is not
(-0.000455). And with **every nuisance model refitted on VALIDATION** (same recipe, manifest
penalties) `beta` = 0.014177 and the Metric B gradient = +0.000846, against the frozen 0.014119 and
+0.000752. The estimator is not biased in any way that reaches the second significant figure; the
freeze costs `beta` nothing. The document's conclusion stands; its evidence was taken on the wrong
period and must be replaced by the VALIDATION check (R5).

(c) *C3 -- the change the document does not mention.* The pre-amendment C3 permuted rating across
players, **recomputed `rating_diff` and `rating_band`**, and re-derived every residual through the
frozen fits -- the construction the Gate 1 re-review recorded approvingly ("C3 shuffles whole
players and recomputes `rating_diff` and `rating_band` consistently"). The amended C3 keeps every
T1P residual fixed and permutes only the three vectors that carry rating; the code comment asserts
"nothing in the T1P residuals depends on rating", which is untrue as stated, since T1P contains
`rating_diff`. I ran the old construction (6 whole-player permutations, everything re-residualised)
and the new one (30) on both periods:

| C3 null, mean +/- sd | old construction | new construction |
|---|---|---|
| DEV Metric D | **+0.00178 +/- 0.00011** | -0.00001 +/- 0.00012 |
| DEV Metric C | **+0.00286 +/- 0.00033** | +0.00002 +/- 0.00028 |
| DEV Metric B gradient | +0.00073 +/- 0.00057 | -0.00016 +/- 0.00055 |
| VAL Metric D | **+0.00206 +/- 0.00018** | +0.00005 +/- 0.00015 |
| VAL Metric C | **+0.00358 +/- 0.00033** | -0.00011 +/- 0.00025 |
| VAL Metric B gradient | +0.00110 +/- 0.00044 | -0.00013 +/- 0.00057 |

The old C3's failures were **systematic** -- a permuted `rating_diff` feeds impossible matchups
(a 900 player "facing" a 2400 opponent) through frozen models fitted on real ones, and the misfit
is correlated with the permuted rating -- and no number of draws would have fixed them. The new
construction is the right null for an exposure permutation (nuisance residuals real, exposure
shuffled across clusters), and I endorse it. But it is a construction change to a reviewed control,
made after both periods' results were visible, attributed in the audit document to a different
cause (A1), and absent from the amendment list. It must be written up as its own amendment with the
table above or an equivalent (R5). **Substance: REPAIR. Presentation: not acceptable as it stands.**

### A2. C4 permutes `voc_resid` rather than `voc_z` -- **REPAIR; C4 is now a code check**

*Is permuting `voc_resid` the right null, or the one that happens to pass?* The right one, for the
estimator as specified. The estimator's regressor is `eV = voc_z - Vhat_T1P(x)`. On both periods
`corr(eV, Vhat) = +0.0003` (DEV) and -0.0047 (VAL): the real regressor carries no position
structure, in or out of sample, so permuting it destroys exactly what Metric B is a slope of.
Permuting the raw column instead yields a regressor `perm(voc_z) - Vhat(x)` that carries *minus the
position-predicted VoC* -- more position structure than the real regressor has -- and the T1P
residual of time has strong rating-dependent structure along that direction: the gradient of `eY` on
`Vhat x rating_c` is +0.0098 (DEV) and +0.0081 (VAL), ten times the residual-VoC gradient the design
reads (+0.0006, +0.0008). That is why the raw-column null is -0.00117 [-0.00187, -0.00049] on
DEVELOPMENT and -0.00092 [-0.00171, -0.00013] on VALIDATION (my reruns: -0.00133 +/- 0.00034,
-0.00104 +/- 0.00047). It excludes zero on the fitting period too, so it is not distribution shift;
it is real structure in the data that the raw permutation exposes and the residual permutation does
not. The document's diagnosis is correct.

Two things must be said plainly, and the document does not say either. First, a least-squares
coefficient on an independently permuted regressor has expectation zero **by construction**; the
amended C4 can fail only on a code defect. It is therefore a code check, which is what the Gate 1
review's disclosure 9 already said C1-C4 were, and §2.5 condition 8 ("C4 passes") is now satisfied
automatically. Second, the raw-column result is scientifically informative -- it says that
stronger players spend more time on positions that *measured* difficulty predicts to be sharp, the
"recognition" channel R13 named -- and the design's own Gate 1 choice (R1c) was to exclude that
channel from Metric B. The report must carry the raw-column value on FINAL beside the pass
condition, as `MODEL_SPEC.md` §9 now promises, and describe what it measures. **REPAIR.**

### A3. C7 generates from T2P and Q0 -- **REPAIR of a transcription defect, mis-described**

The frozen §9 said C7 rebuilds quality "from their T1P/**Q0** fits plus independent noise". The
pre-amendment code generated quality around its **mean**. That is a code-versus-hashed-document
disagreement -- the class of defect this study itself defines as a defect -- and restoring Q0 is a
straightforward repair. The document, however, attributes the failure jointly to "time from T1P
while the residual is taken against T2R" and "quality around its mean". I decomposed it (12 draws
each):

| C7 construction | DEV `beta` | VAL `beta` |
|---|---|---|
| old: T1P time, mean quality | +0.00180 +/- 0.00027 | +0.00170 +/- 0.00052 |
| T1P time, **Q0 quality** | +0.00027 +/- 0.00030 | +0.00019 +/- 0.00045 |
| **T2P time**, mean quality | +0.00161 +/- 0.00027 | +0.00147 +/- 0.00052 |
| new: T2P time, Q0 quality | +0.00027 +/- 0.00030 | +0.00019 +/- 0.00044 |

The entire failure was the quality generator. The T1P-to-T2P change is irrelevant to `beta` and is a
separate change to a hashed sentence, made after the results were visible; it is nonetheless the
conservative direction: with T1P-generated time, `eY_synth` is pure noise and the C7 checks on the
Metric B gradient and Metric A are tautologies, whereas with T2P the rating-free VoC-by-clock block
is inside the synthetic time and the check that no rating gradient is manufactured from it is a real
one (it passes: -0.00007 +/- 0.00044 on VALIDATION). Two consequences the document omits: (i) with
quality generated as Q0 plus independent noise, C7's `beta` check has expectation zero for *any*
time generator and can fail only on a code defect -- the old construction, whatever its intent, was
measuring the estimator's response to a grossly misspecified quality model, and that measurement is
gone; (ii) **`C7_no_effect_synthetic.extreme_ut_vs_rating` is a hard-coded `[0.0, 0.0, 0.0]`**
(`_null([0.0] * draws)`), a field `evaluate.REQUIRED_CONTROLS` names and checks with
`excludes_zero`. A required control field that is a literal cannot fail and is not a control. The
argument in the code ("no rating structure by construction") is true and is exactly why the number
should be computed rather than typed. R2. **REPAIR, with the diagnosis to be corrected (R5) and the
literal removed (R2).**

### A4. C7b -- see §3. **A legitimate diagnostic; its headline reading is the flattering one.**

### 2.1 Were the amendments made with the results visible, and does that make any of them untrustworthy?

They were all made with DEVELOPMENT and VALIDATION results visible, and A1, A2, A3 and the
undocumented C3 change each removed an `INVALID_EXPERIMENT` trigger that had fired. That is the
pattern this gate exists to catch, so the question deserves a direct answer.

*Untrustworthy as science: no.* Each removed trigger was, on independent reconstruction, a
construction artefact and not a property of the estimator or the data: the C3 offsets come from
impossible matchups, the C4 offset from a regressor with structure the real one lacks, the C7 offset
from a generator that violated the hashed specification. The estimator itself was checked out of
sample three ways (three-parameter form, full refit, destroyed-quality null of the alternative
estimator) and is unbiased to the second significant figure. And nothing amended touches any
quantity the top verdict is decided by: the H2 conditions are computed by `estimands.py`, which the
amendments did not change (zero differences on DEVELOPMENT), and they fail seven-fold on VALIDATION.

*Untrustworthy as a record: yes, as written.* The amendments document is the audit trail a later
reader will rely on, and it (i) omits that three of the five failures were on DEVELOPMENT and
systematic, (ii) omits the C3 construction change entirely and misattributes its repair, (iii)
claims the new rule is stricter and is B2's, (iv) attributes C7's failure to a change that did not
cause it, and (v) reports its estimator check on the period where it could not have failed. With the
salted seeds, none of its numbers can be regenerated. Every one of these is fixable now (R1, R5) and
none requires FINAL. Until they are fixed the document is not fit to be cited by the report.

The honest summary the amendments should carry: **C1, C2, C4 and C7 are now code checks that can
fail only on a defect; C3 is a cluster permutation of the exposure and likewise; the scientific
weight of "the destructive controls pass" on FINAL is that the code is not broken, and no more.**

---

## 3. C7b -- the number the report will lean on

**Construction, verified.** A latent `U ~ N(0,1)`, independent of everything measured, enters
synthetic time through `yhat_T2R + a*U + noise` and synthetic quality through `Qhat0 + b*U + noise`,
with `a = sd(yhat_T1P - yhat_T0) = 0.129` log-seconds (the engine-difficulty block's contribution to
predicted time) and `b = a x` (marginal slope of `quality_loss` on that block) `= 0.0025` wp (DEV),
0.0019 (VAL). The manufactured `beta` is, analytically, `a*b / (a^2 + var(ut_resid))` with
`var(ut_resid) = 0.362`: +0.00084 (DEV), +0.00065 (VAL), against the reported +0.00076 and +0.00069.
The number is honest and its construction is correct. (One defect: the block comment above the C7b
code in `controls.py` describes the *previous* construction -- "thinking time is generated from T1P
while the residual is still taken against T2R" -- and not the code beneath it. R9.)

**The exchange rate, which is what should be reported.** Rearranged, the manufactured `beta` is

    beta_manufactured = (b / a) x f

where `b/a` is the factor's *quality-per-log-second ratio* and `f = a^2 / (a^2 + var(ut_resid))` is
the *share of residual time variance the factor explains*. The measured engine-difficulty block has
ratio 0.019 wp per log-second and `f = 0.044` (it explains 3.2% of total log-time variance; the
T1P-over-T0 gain in R^2 is 0.033). The observed `beta` of 0.0127 (DEV) requires `ratio x f = 0.0127`.

**Is "the observed beta is 17 times the manufactured one, so A2 would need 17 more factors as strong
as the measured ones" defensible?** It is one of several equivalent decompositions and it is the
most flattering. The same arithmetic says:

* **one** latent factor reproduces the observed `beta` on its own at **6.6 times** the measured
  block's strength on both axes (DEV; 12 times on VAL) -- a factor explaining 67% (87%) of the
  residual time variance and moving quality by 0.22 (0.30) SD of the Q0 residual per SD of the
  factor; or
* a factor explaining 20% of residual time variance with 3.3 times the measured block's
  quality-per-time ratio.

A2's natural form is a single dominant latent -- "how hard this position actually was for this
human", of which depth-12 engine features are a weak proxy -- not seventeen independent small ones.
And the anchor is weak by the study's own numbers: the measured block explains 3% of time variance,
so "as strong as the ones we measure" is a low bar, and multiples of it sound larger than they are.
A fair adversary's sentence is: *the observed beta is what an unmeasured factor would produce if its
quality-per-time ratio times its share of residual time variance were 0.0127; the measured
engine-difficulty block scores 0.019 x 0.044 = 0.0008 on that product; no measurement here excludes a
latent difficulty factor several times stronger than the engine block on both axes, which is exactly
what the preregistration meant by irreducible.* The report may print the 17, but only beside that
sentence and the single-factor multiplier (R7).

**The direct measurement the report should carry beside C7b.** The cheapest calibration of "what a
difficulty block does to beta" is to omit the measured one. With the nuisance set built on T0 plus
rating, T1 plus rating, and T2 plus rating (fitted on DEVELOPMENT, applied frozen):

| nuisance set | DEV `beta` | VAL `beta` |
|---|---|---|
| T0R (context only) | 0.01379 | 0.01522 |
| T1R (+ engine difficulty) | 0.01289 | 0.01429 |
| T2R (+ VoC; the shipped one) | 0.01270 | 0.01412 |

Adding the entire fourteen-feature engine-difficulty block removes 0.0009 of `beta` -- 6.5% -- which
agrees with C7b's manufactured 0.0008 and confirms the calibration is right in magnitude. It also
admits two readings, and the report may not choose between them: either `beta` is robust to measured
difficulty, or depth-12 engine features capture so little of what makes a human slow *and* wrong
that their inability to move `beta` says little about what would. `C9` is in the same position: the
2.5-fold budget changes the VoC features substantially (`voc_regret` correlates 0.64 between budgets,
`voc_rank` 0.49) and the outcome little (`quality_loss` 0.96; the best move is identical on 68% of
decisions; median depth 12 to 14), and `r_beta` = 1.015 [0.953, 1.075] says `beta` does not move
under *that* re-measurement. The interval is tight because both budgets' estimates move together
under player resampling, not because the design gained information; the packet's "a stronger
statement than the design was entitled to expect" is an over-reading and must not reach the report.
Together C7b, the ladder and C9 constrain the *engine-measurable* version of A2 and leave the
human-perceived version where the preregistration put it: cannot be excluded.

---

## 4. The verdict rules against the numbers in hand

I ran `evaluate()` with the VALIDATION period substituted for FINAL and a player-disjoint block built
the way `run.py` builds it (64 of 2,142 VALIDATION players, 3.0%, also appear in DEVELOPMENT; the
restricted estimate is `beta` 0.01417 [0.01299, 0.01511], Metric B gradient +0.00053
[-0.00037, +0.00141]). Result: **`GENERAL_REGULARITY_ONLY`, level 3**, C9 not capping, with seven
conditions failed at once:

| §2.5 condition | VALIDATION value | fires? |
|---|---|---|
| 1, 3: `beta` > 0, excludes 0, >= 0.002 | 0.01412 [0.01308, 0.01511] | yes |
| 2: sign agreement >= 80% of >= 5 bands | 9/9 (DEV 9/9) | yes |
| 4: Metric B signed +, monotone | +0.00075 [-0.00025, +0.00192]; Spearman 0.47 | **no** |
| 4: one of A, D | A -0.0111 [-0.0125, -0.0098] | yes (A only) |
| 5: matched-sample gradient | **-0.00428 [-0.00812, -0.00026]** (DEV -0.00289) | **no, wrong sign** |
| 5: `T = 0` removed | +0.00080 [-0.00019, +0.00191] | **no** |
| 5: lowest clock-pressure tercile | +0.00166 [-0.00058, +0.00391] | **no** |
| 5: spread >= 0.02, excludes 0 | +0.0120 [-0.0148, +0.0386] (DEV +0.0017) | **no** |
| 6: player-level regression | +0.00066 [-0.00044, +0.00167] | **no** |
| 7, 8, 9, 10, 11 | pass | yes |
| disjoint restriction, conditions 1 and 5 | fails through 5 | **no** |

*Could `EXPERTISE_ADAPTATION_SUPPORTED` fire on a scientifically weak FINAL?* Not through noise.
The gate is a conjunction of seven interval conditions on Metric B that are null or wrong-signed on
both open periods, the matched-sample gradient is significantly *negative* on VALIDATION, and the
disjoint restriction must repeat all of them. Nothing amended makes any of them easier; condition 8
(C4) is the only one the amendments touch and it was a code check already. The rules cannot produce
the top verdict from these data unless FINAL is a different population.

*The live risk is at level 3, not level 4.* Level 3 -- "cross-rating law-like regularity" -- fires on
sign agreement alone, and `beta` is positive and separately significant in all nine bands on both
periods, so it will almost certainly fire on FINAL. But `beta` is not invariant in *magnitude*: the
`beta x rating` interaction is -0.00049 [-0.00067, -0.00027] per 100 Elo on DEVELOPMENT and -0.00037
[-0.00057, -0.00016] on VALIDATION, band Spearman -0.93 and -0.65, band values from 0.021 (1000-1199)
to 0.009 (2200-2399). The effect roughly halves across the rating range. The N3 decision to drop the
shape test from level 3 was right (no shape was preregistered), but "law-like" beside a coefficient
that falls by 40% across the population is a claim the report must qualify in the same sentence (R7).

*Two things the walk confirms are sound.* `q1_minus_q0_r2` is 0.0103 on VALIDATION, ten times the
level-2 floor; C5b recovers 0.94 and 0.97 of a foreign signal; C8's influence measures are an order
of magnitude inside their limits; C10 (binary outcome) agrees in sign; every stratum in C11-C14 and
C17-C18 gives a positive `beta` with an interval excluding zero (endgame and opening smaller). The
H1 verdict is not fragile.

---

## 5. Anything else that would make opening the holdout a mistake

None of the following is a reason to keep the holdout closed once §6 is done; all are things a
later reader would otherwise find and hold against the study.

1. **`MODEL_SPEC.md` §7 (hashed) promises "Control C6 exercises this estimator" -- the player-level
   inverse-variance regression condition 6 reads.** `controls.py` C6 computes only the pooled
   gradient. A hashed document and the code disagree, which the study's own rule calls a defect;
   the fix is a few lines, needs no FINAL, and would have been the control that catches a repeat of
   M4 on data (R3).
2. **`DATA_PROTOCOL.md` §4 leaves "if the top-band rate differs materially between periods" to
   judgement.** The top-band account-closure rate is already 7.7% on DEVELOPMENT (25/326) against
   4.1% on VALIDATION (9/217), FINAL will be the least cleaned of the three, and the exclusion works
   in the hypothesis's favour. A judgement word inside a mechanical rule is a door (Gate 1,
   recommended 14). Replace it now with a fixed rule: condition 5 is *always* additionally reported
   with the top adequately powered band dropped (R8).
3. **The pre-amendment C3 output carried `beta_rating_interaction`; the amended one silently
   drops it.** Not verdict-bearing; record the drop.
4. **The `len(restricted) > 5000` floor in `run.py`'s disjoint block is in no document** (third
   re-read noted it). It can only withhold; say so in the amendments.
5. **`analysis_develop.json` is committed with `leakage_tests_passed: false` and
   `engine_nondeterminism_detected: true`** because `gate_checks.json` did not yet exist when it
   ran. Anyone reading that file alone will conclude the development stage was invalid. Label it
   or regenerate it.
6. **Weekday composition** (Gate 1 disclosure 2): 2026-02-01 Sunday, 2026-04-01 Wednesday,
   2026-06-01 Monday. The frozen constants come from a Sunday population. VALIDATION shows what that
   costs: `rating_resid` has mean -40 Elo on VALIDATION (the frozen rating-from-position fit
   overpredicts because the frozen acceptance rates yielded fewer top-band sides in April: 185
   players against 265), `ut_resid` mean +0.006, `y_resid_T1` mean +0.010. Every reported slope is
   centred (N1), so these means cannot enter a coefficient, and the refit check in §2 shows they do
   not; but FINAL's band counts will differ again, and the report should show the per-band residual
   means for FINAL as Gate 1 recommended (recommendation 6).

---

## 6. Required changes -- all before FINAL is scored, none needing a byte of it

**R1. Make the controls reproducible.** Replace `abs(hash((SEED, tag))) % 2**32` in
`controls._rng` with a deterministic derivation (e.g. an integer from `blake2b(f"{SEED}|{tag}")`),
re-run `--stage validate` so `period_*.json` and `analysis_validate.json` carry regenerable nulls,
and re-issue the packet's control table from the regenerated file. DEVELOPMENT and VALIDATION are
open periods; re-running their controls reads nothing new.

**R2. Compute `C7_no_effect_synthetic.extreme_ut_vs_rating`.** Build the synthetic
`unexpected_time_population` as `synth_lt - yhat_T2P`, the indicator against the frozen `ut_q95`,
residualise against the frozen `partial_extreme` prediction (`extreme_ut - extreme_resid`), and
take the slope on `rating_resid` per draw. No literal may stand in a `REQUIRED_CONTROLS` field.

**R3. Make C6 exercise the condition-6 estimator** as hashed §7 says: on each synthetic draw, run the
per-player centred TAE and the inverse-variance regression on rating (the code in
`estimands.player_level`), and report the recovered player-level gradient under C6. State in the
amendments whether it joins C6's pass condition or is reported only; either is acceptable if stated
now.

**R4. Extend the seal to the ingest.** `score.py` must call `run.require_seal()` when `--period` is
`final` (and for the secondary control); `rescore.py`, `gate_checks.py` and `make_report.py` must
refuse any period path containing `final` or `secondary` without the seal file. Then the README's
sentence is true.

**R5. Correct `results/POST_FREEZE_AMENDMENTS.md`:** (i) the table in §2.0 above -- which controls
failed on DEVELOPMENT in the committed pre-amendment analysis; (ii) a new amendment for C3's
construction change with the old-versus-new null table and the reason (impossible matchups through
frozen models), replacing the attribution to A1; (iii) delete "strictly harder" and "the discipline
B2's `analyse.py` applies"; state the rule's actual power (fails on bias above about two null SDs,
near-zero false-failure rate) and require the report to print each null's mean with its Monte-Carlo
SE, naming the VALIDATION offsets (-0.00041, -0.00023) and their source; (iv) correct A3: the failure
was the quality generator's departure from the hashed spec; T1P-to-T2P is a separate, conservative
change to the H2 checks; C7's `beta` check is now a code check; (v) replace the DEVELOPMENT
three-parameter check with the VALIDATION one (0.0141162 vs 0.0141192) and add the full-refit check
(0.014177); (vi) state that C1, C2, C4 and C7 are code checks and what "they pass on FINAL" may be
read to mean.

**R6. Fix the record.** `PREREGISTRATION_FREEZE.json`: `git_commit_at_freeze = 8141c5b`,
`amended_commit = e70a0de`, with a note that the previous values were the parent commits. Append
`MODEL_LEDGER.md` rows for DEVELOPMENT scoring completion, `gate_checks`, VALIDATION scoring, C9,
the pre-amendment failures, the amendments, the packet and this gate.

**R7. Report-language obligations, recorded now in the amendments document** (the hashed forbidden
list is not edited; these are additions to what the report must and must not say): (a) C7b is
presented as the exchange rate `beta_manufactured = (b/a) x f` with the single-factor multiplier
beside any "17 factors" sentence, and the T0R/T1R/T2R ladder is printed beside it; (b) "A2 is
bounded", "constrained", "excluded" or any equivalent is forbidden -- the licensed sentence is that
the *engine-measurable* form of A2 is constrained and the human-perceived form is not; (c) C9's
interval is reported with what actually changed between budgets (the feature correlations above)
and without "stronger than the design was entitled to expect"; (d) any use of "law-like" for level
3 carries, in the same sentence, the `beta x rating` interaction and the top-to-bottom band
magnitudes; (e) the raw-column C4 value on FINAL is reported beside the pass condition with the
recognition-channel reading.

**R8. Replace "materially" in `DATA_PROTOCOL.md` §4** with the fixed rule that condition 5 is always
additionally reported with the top adequately powered band dropped. This is a reporting rule and not
a threshold; record it as an amendment and re-hash under `amended_sha256`.

**R9. Fix the stale C7b comment in `controls.py`** so it describes the latent-factor construction
the code implements; and label or regenerate `analysis_develop.json` (item 5 above).

None of R1-R9 adds a feature, changes an outcome, exclusion, band, threshold, hyperparameter or
model family, or reads FINAL. R1 and R3 will change the digits of the DEVELOPMENT and VALIDATION
control tables by Monte-Carlo noise and nothing else.

---

## 7. May the final holdout be opened?

**Yes -- after R1-R9, and not before.** The study is genuinely sealed: no part of 2026-06 has been
read, streamed, sampled, or counted, and every frozen quantity traces to DEVELOPMENT or to Gate 1.
The amendments are, in substance, repairs -- each removed trigger was a construction artefact that I
could reproduce and explain independently, the estimator is unbiased out of sample to the second
significant figure, and nothing amended reaches the quantities the top verdict is decided by. What is
not yet in order is the machinery around the verdict and the record of what was done: a required
control field that is a literal, controls whose seeds cannot be regenerated, a hashed promise (C6
exercises condition 6) the code does not keep, an ingest script the seal does not cover, and an
amendments document that misattributes two of its repairs and omits a third. All of it is fixable
without observing FINAL, all of it is cheap, and the holdout should be opened once, mechanically,
the moment it is fixed -- into a result that, on everything the two open periods show, will be
`GENERAL_REGULARITY_ONLY` at level 3, which is the honest outcome and a reportable one.
