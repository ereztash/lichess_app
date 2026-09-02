PASS_WITH_REQUIRED_CHANGES

# FABLE GATE 4 -- final claim audit (independent scientific adversary, fresh context)

**Object audited:** `REPORT.md` as it stood at commit `9349c00` (sha256
`94b0404644daa9f09a2487dddbf1b1bbda9d451878ef975ffc419b3b22860896`). Two commits landed while
this audit was in progress (`67a2683`, `9349c00`); the second changed only the two provenance rows
in section 15, and every finding below was re-checked against the committed text.

**Read in full:** `REPORT.md`; the five frozen documents (`PREREGISTRATION.md`, `DATA_PROTOCOL.md`,
`FEATURE_SCHEMA.md`, `MODEL_SPEC.md`, `VERDICT_RULES.md` -- their sha256s equal the ones in
`FINAL_HOLDOUT_SEALED.json`, so nothing hashed moved after the seal); `results/POST_FREEZE_AMENDMENTS.md`
A0-A7; `PREREGISTRATION_FREEZE.json`; `FINAL_HOLDOUT_SEALED.json`; all three earlier reviews and the
three gate packets; `analysis_repaired.json`, `analysis_final.json`, `analysis_secondary.json`,
`verdict.json`, `verdict_repaired.json`, `report_diagnostics.json`, `c3_repair_diff.json`, `c9.json`,
`gate_checks.json`, `model_manifest.json` (keys), every table in `results/tables/`; `src/write_report.py`,
`src/report_diagnostics.py`, `src/repair_c3.py`, `src/evaluate.py`, `src/estimands.py`,
`src/make_report.py`, and the C7b and residualisation code in `src/controls.py` / `src/analysis.py`;
`MODEL_CARD.md`, `FAILURES.md`, `REPRODUCIBILITY.md`, `MODEL_LEDGER.md`, `README.md`; the git history
of the study including the diffs of the post-holdout commit `67a2683`.

**Run, read-only, in the scratchpad** (`.venv-b3`; the cached residualised frames and `fits.pkl`):

* the byte-identity claim of section 2 -- sha256 of each analysis file with the C3 blocks,
  `tae_pooled_slope_at_centre` and `_repair` excised: `analysis_secondary.json` and
  `analysis_repaired.json` both give `d2794b40...`; `analysis_final.json` gives a different hash only
  because it lacks the secondary block, and its `periods`, `controls`, `matched`, `player_level`,
  `model_comparison`, `player_disjoint_final` and `c9` blocks are identical to `analysis_secondary.json`'s;
* `evaluate.evaluate()` re-run on all three analysis files: `INVALID_EXPERIMENT` / `INVALID_EXPERIMENT` /
  `GENERAL_REGULARITY_ONLY` level 3, with the checks and the seven failed conditions identical between
  `verdict.json` and `verdict_repaired.json`;
* every number in the report's tables and prose against the JSON it cites (section 3 corpus table,
  section 4 and 5 tables, the C3 diff, the section 6 control table, the section 5.3 cancellation
  table, the balance table, the band residual means, C9, C7b, C8, the player-disjoint block, the
  exclusion counts, the secondary block);
* the C7b exchange-rate arithmetic of amendment A5(a) on FINAL from the C7b fields in the analysis
  and `var(ut_resid)` on the cached FINAL frame (finding 2);
* the "three-parameter" `beta` as `report_diagnostics.py` computes it and as section 2 describes it
  (finding 10);
* the pooled Metric B slope by clock tercile on all three cached frames (finding 3);
* the fall of `beta` across the rating range three ways: bottom band to top band, maximum band to
  minimum band, and the fitted interaction (finding 9);
* the drift offsets of every destructive null on VALIDATION and FINAL, in null standard deviations,
  from the control blocks of `analysis_repaired.json` (finding 4).

**Not touched:** no research code, document or result was edited. This file is the only write.

---

## 1. Summary

The report honours the substance of Gate 3. Both verdicts are printed on equal footing wherever the
repaired one appears except in one place (finding 6); the Metric B null is written as a null of the
instrument and not of players, without slippage in sentence order or emphasis; the secondary block is
declared not evaluable and quoted only under the exploratory label Gate 3 permitted; the blunder,
engine-best-move, standing, cancellation, floor/power and matched decompositions are all printed at
the weight Gate 3 assigned them; every sentence Gate 3 §3.6 and F-O2 declared unlicensed is absent,
and no phrase on the preregistration's §9 list or on amendment A5's list appears except in negation.

What does not survive audit is a set of specific sentences whose numbers the repository does not
support, plus one front-matter line that says the opposite of the result. The worst is the line under
the verdict block, "What the repaired verdict label is allowed to mean", which prints the
`VERDICT_RULES.md` §3.1 definition of `EXPERTISE_ADAPTATION_SUPPORTED` -- "the time /
value-of-computation relation differs systematically with rating" -- as the meaning of
`GENERAL_REGULARITY_ONLY`. That is the H2 sentence the study did not support, printed as the meaning
of the verdict. It is a mechanical paste (`evaluate.py` writes `label_means` unconditionally) and it
must go. The second is the A5(a) single-factor statement, whose "about 5 times the engine block" is
`sqrt(27)` and not the exchange-rate algebra the amendment prescribes; on FINAL the algebra says no
factor with the engine block's quality-per-time ratio reproduces `beta` at any strength. The third is
"no response to the clock", used four times as a property of the instrument on the strength of three
FINAL tercile estimates whose intervals each hide a doubling, while the same diagnostic on
DEVELOPMENT is reversed in order. The fourth is the drift table's sentence that every null's offset
is larger in June than in April, which the pipeline's own control blocks contradict for C1 and for
the raw-column C4 (the latter is 3.3 null SDs on the fitting period itself and is not drift). Beside
these are one missing hashed obligation (`VERDICT_RULES.md` §2.5c's "state the attenuation the
interval excludes"), one A7.11 lapse, one A2 sentence that reads the engine-measurable form of
unmeasured difficulty as the human-perceived one, and a handful of arithmetic glosses.

None of the findings changes a verdict, a level, a threshold or an estimate, none requires FINAL to be
re-read, and every replacement sentence below is weaker than the one it replaces. Hence
`PASS_WITH_REQUIRED_CHANGES` and not `FAIL`. I have not upgraded any claim, and nothing here may be
read as licensing one.

---

## 2. Findings

Each finding quotes the sentence, classifies it, gives the reason with the evidence, and states the
change. "Required" findings must be applied before the report is published; "recommended" findings
are precision edits the author may decline with a note.

### F1. The front-matter line attaches the level-4 meaning to a level-3 verdict -- OVERCLAIM (required)

**Quoted** (`REPORT.md` line 14): "**What the repaired verdict label is allowed to mean.** the time /
value-of-computation relation differs systematically with rating, net of matched position and clock
state -- NOT that expertise changes how players manage the process (VERDICT_RULES.md 3.1)".

**Reason.** That sentence is `VERDICT_RULES.md` §3.1's definition of what level 4 /
`EXPERTISE_ADAPTATION_SUPPORTED` means. The repaired verdict is `GENERAL_REGULARITY_ONLY`, whose
content is that H1 holds and §2.5 was not met. As printed, the report's front matter asserts, as the
meaning of its verdict, exactly the H2 proposition the study did not support. `evaluate.py` line 345
writes `label_means` regardless of which gate fired; `write_report.py` line 114 prints it under that
heading. The same mislabelled field sits in `results/verdict_repaired.json` and `results/verdict.json`.

**Replacement.** "**What the repaired verdict label means.** `GENERAL_REGULARITY_ONLY`: H1 holds on
FINAL (`beta` > 0, interval excluding 0, above `BETA_FLOOR`) and the conditions of `VERDICT_RULES.md`
§2.5 were not all met. It asserts nothing about whether the time / value-of-computation relation
varies with rating. The sentence in §3.1 defines what `EXPERTISE_ADAPTATION_SUPPORTED` would have
meant; that verdict was not reached, and the mechanical verdict as shipped is `INVALID_EXPERIMENT`."
The `label_means` field in the two verdict files should be disclosed as the §3.1 definition of level
4 (a comment in the report's provenance row is enough); renaming the key in `evaluate.py` is a
permitted implementation repair under `VERDICT_RULES.md` §4 that changes no verdict, but is not
required.

### F2. The single-factor A2 statement is arithmetically wrong on FINAL -- UNSUPPORTED NUMBER (required)

**Quoted** (§7): "so a *single* latent factor about 5 times the engine block on both axes
reproduces the observed `beta` by itself."

**Reason.** The 5 is `ratio ** 0.5` (`write_report.py`, the C7b paragraph), i.e. `sqrt(27)`. That is
not the exchange-rate algebra amendment A5(a) prescribes. Under that algebra
`beta_manufactured = (b / a) x f` with `f = a^2 / (a^2 + var(ut_resid)) < 1`. On FINAL
(`controls.final.C7b_omitted_difficulty_simulation`) `a = 0.12831` and `b = 0.0013527`, so the engine
block's quality-per-time ratio is `b / a = 0.01054` win probability per log-second; with
`var(ut_resid) = 0.3576` on the cached FINAL frame the formula reproduces the manufactured value
(0.00046 against the reported 0.00049). To reach `beta = 0.01342` a factor with that ratio would need
`f = 1.27`, which is impossible, and scaling `a` and `b` together leaves `b / a` unchanged -- so no
single factor "k times the engine block on both axes" reproduces `beta` at any `k`. The same algebra
reproduces A5(a)'s DEVELOPMENT figure exactly (`b / a = 0.0191`, needed `f = 0.666`, `k = 6.6`); the
shortcut fails on FINAL because the block's quality-per-time ratio there is about half of
DEVELOPMENT's. The printed number is also internally inconsistent: a larger observed-to-manufactured
ratio (27 against 17) cannot need a smaller factor (5 against 6.6).

**Replacement.** "The manufactured value is an exchange rate -- the factor's quality-per-time ratio
times its share of residual time variance. On FINAL the engine block's ratio is 0.0105 win
probability per log-second, so a single factor with that ratio cannot reproduce `beta` = 0.0134 at
any strength: the alternative requires a latent factor whose quality-per-time ratio is at least 1.3
times the engine block's (if it explained nearly all of the residual time variance), or, for
example, 6.4 times the block's ratio while explaining a fifth of it. On DEVELOPMENT the same
arithmetic gives one factor about 6.6 times the block on both axes (amendment A5(a)). A single
dominant latent, *how hard this position actually was for this human*, is the natural form of the
alternative, not many independent small ones." `write_report.py` must compute the statement from
the C7b fields and `var(ut_resid)` (or print the DEVELOPMENT figure from A5(a) and the FINAL
impossibility), never from `sqrt(ratio)`. Minor, same paragraph: "explains about 3% of residual
time variance" -- the FINAL figure is 3.0% of total log-time variance (`T1P - T0` = 0.030) and 4.0%
of what the context model leaves; say "about 3% of log-time variance".

### F3. "No response to the clock" is stated as a property the evidence cannot establish -- OVERCLAIM (required)

**Quoted.** §1: "no response to the clock"; §5.2: "**It does not respond to the resource.** ...
+0.0107 [+0.0016, +0.0205] (fullest), +0.0108 [+0.0025, +0.0193] (middle), +0.0105 [+0.0036,
+0.0180] (emptiest). Flat."; §12.3: "no response to the clock"; `MODEL_CARD.md` §7.4: "does not
respond to how much clock is left".

**Reason.** The three FINAL intervals have half-widths of about 0.009 around a level of 0.0107: a
doubling or a halving between terciles lies inside every one of them. `report_diagnostics.json`
carries the same diagnostic for the other two periods, and the report does not print them: on
DEVELOPMENT the ordering is reversed (+0.0007 [-0.0099, +0.0098] fullest, +0.0108 middle, +0.0115
emptiest) and on VALIDATION it runs the expected way (+0.0120, +0.0085, +0.0080). I reproduced all
nine values from the cached frames. Three periods with three different point orderings and no
detectable difference in any of them support "no detectable response"; they do not support "does
not respond", which is a claim about the instrument that the design cannot make. Gate 3 F-N1 wrote
"it does not respond to the clock" from the FINAL numbers alone; the pipeline's own diagnostics
file is the stronger evidence and it says less. This weakens one leg of the section 5 argument; it
does not license any stronger reading of the Metric B null, whose other legs (point mass,
cancellation, floor and power) stand.

**Replacement** (§5.2 bullet): "* **Its response to the resource is undetectable.** An allocation
instrument should react to how much clock is left. On FINAL the pooled relation by clock tercile is
+0.0107 [+0.0016, +0.0205] (fullest), +0.0108 [+0.0025, +0.0193] (middle), +0.0105 [+0.0036,
+0.0180] (emptiest): not detectably different, but each interval is wide enough to hide a doubling,
and the ordering is reversed on DEVELOPMENT (+0.0007, +0.0108, +0.0115) and in the expected
direction on VALIDATION (+0.0120, +0.0085, +0.0080). The design cannot tell whether the instrument
responds to the clock." §1 and §12.3: "no detectable response to the clock". `MODEL_CARD.md` §7.4:
"and shows no detectable response to how much clock is left (the tercile ordering differs across
periods)".

### F4. "Every destructive null ... larger than on the April period" is contradicted by the control blocks -- UNSUPPORTED NUMBER (required)

**Quoted** (§6.3): "Their misfit shows up in every destructive null as an offset from zero, larger
than on the April period"; the table heading "Every FINAL null carries a drift offset" with the row
"C4 raw column | -0.00081 | 2.10"; §12.10 "every destructive null carries a visible offset";
`MODEL_CARD.md` §7.1 "every destructive null carries an offset from zero (0.6 to 2.5 null standard
deviations on FINAL, larger than on April)".

**Reason** (`analysis_repaired.json`, `controls.validation` and `controls.final`, `sd_units_from_zero`):

| null | DEVELOPMENT | VALIDATION | FINAL |
|---|---|---|---|
| C1 `beta` | -0.00002 (0.05) | -0.00044 (0.85) | +0.00031 (0.64) |
| C2 `beta` | -0.00002 (0.08) | -0.00022 (0.70) | -0.00026 (0.88) |
| C4 raw column | -0.00115 (3.25) | -0.00089 (2.15) | -0.00081 (2.10) |
| C3 -> Metric A (shipped) | +0.00003 (0.06) | -0.00016 (0.32) | -0.00115 (2.51) |
| C3 -> Metric C (shipped) | +0.00001 (0.02) | -0.00012 (0.50) | -0.00036 (1.52) |
| C3 -> Metric D (shipped) | -0.00000 (0.04) | +0.00003 (0.18) | -0.00012 (0.84) |

C1's offset is smaller on FINAL than on VALIDATION and changes sign; the raw-column C4 offset is
smaller on FINAL than on VALIDATION and is largest on DEVELOPMENT, the fitting period, at 3.3 null
SDs -- it is not drift at all but the deterministic recognition-channel term the report itself
describes in §5.3 and §6.3 (Gate 2 A2 established it excludes zero in-sample). Only C2 and the three
C3 nulls grow from April to June. And the nulls the table omits -- C3 -> B (0.04 SD), the
pass-condition C4 (0.1), C7 (0.1) -- carry no visible offset, so "every destructive null" is wrong
twice. Gate 3 §1.8.4 supplied the sentence; the pipeline's own numbers are the better evidence and
they say less.

**Replacement** (§6.3 first paragraph and table caption): "Their misfit shows up in the C3 nulls as
an offset from zero that grows from April to June (Metric A 0.32 -> 2.51 null SDs; Metric C 0.50 ->
1.52; Metric D 0.18 -> 0.84), and the 'contains zero' pass rule tolerates it up to about two null
standard deviations. The C1 and C2 offsets are of similar size on both periods (C1 -0.00044 in
April, +0.00031 in June; C2 -0.00022, -0.00026). The raw-column C4 value is in the table for
completeness but is not drift: it is -0.00115 (3.3 null SDs) on DEVELOPMENT itself, the
deterministic recognition-channel term of section 5.3 diluted by the permutation variance. The
C3 -> B, pass-condition C4 and C7 nulls sit within 0.1 null SD of zero on FINAL." Table heading:
"The FINAL nulls' offsets from zero, as shipped". §12.10: "the C3 nulls carry a visible drift offset
and one crossed its tolerance". `MODEL_CARD.md` §7.1: "(0.6 to 2.5 null standard deviations on
FINAL; the C3 offsets are larger than on April, the C1 and C2 offsets are not)".

### F5. The §2.5c obligation on C9 is not met -- MISLEADING BY OMISSION (required; hashed obligation)

**Quoted** (§7): "`beta`(60k) = 0.01608, `beta`(150k) = 0.01631, ratio +1.015 [+0.953, +1.075]."

**Reason.** `VERDICT_RULES.md` §2.5c (hashed): "The report must state the attenuation the realised
interval actually excludes, computed from its width, beside the ratio itself", after "a C9 that does
not fire is not evidence against A2". Section 7 gives the ratio, the correlations and the
"move together" sentence, but neither the excluded attenuation nor the sentence. Amendment A4 had
the number ("excluding attenuation greater than 4.7%") and it was dropped on the way to the report.

**Change.** Add beside the ratio: "The lower bound 0.953 excludes attenuation greater than 4.7% for
the re-measurement this budget change produced, and the preregistration's own reading applies: a C9
that does not fire is not evidence against unmeasured difficulty (`VERDICT_RULES.md` §2.5c); at
n = 5,000 the trigger could only have fired for attenuation of roughly two-thirds or more." Keep the
existing sentence about the interval being narrow because the two budgets share the residuals.

### F6. Level-3 language and the level line appear without the shipped verdict beside them -- FORBIDDEN LANGUAGE by paraphrase of A7.11 (required)

**Quoted.** The verdict block: "SCIENTIFIC LEVEL: 3"; §13: "The strongest phrasing the
preregistration permits for what *was* found is a **cross-rating law-like regularity** ..."; §5.6:
"The verdict label is correct because it asserts only that the conditions were not met."

**Reason.** Amendment A7.11 (Gate 3 §1.7): `INVALID_EXPERIMENT` "is printed beside the repaired one
wherever the repaired one appears." Level-3 language is the repaired verdict's language; as shipped
the study has no level. The verdict block prints one level for two verdicts, §13 deploys the
level-3 phrase with no mention that the mechanical verdict licenses none, and §5.6's "the verdict
label" does not say which. Obligation (d)'s qualification is present (see §4 of this review); the
lapse is A7.11's.

**Replacement.** Verdict block: "SCIENTIFIC LEVEL: 3 after the repair; none as shipped". §13: "Under
the repaired verdict -- the mechanical verdict as shipped is `INVALID_EXPERIMENT` (section 2) and
licenses no level language at all -- the strongest phrasing the preregistration permits for what
*was* found is a **cross-rating law-like regularity**, and it carries its own qualification in the
same breath: ...". §5.6: "The repaired verdict label is correct because ...".

### F7. The human-perceived form of A2 is read as visible in section 4.3 -- OVERCLAIM (required)

**Quoted** (§7, last paragraph): "The *human-perceived* form -- a position that is hard for a person
in a way a search at this depth does not register -- is exactly where the preregistration put it:
**cannot be excluded**. Section 4.3 is the closest this design comes to seeing it, and there it is
visible." Also §4.3: "It is unmeasured difficulty measured directly, in the one place the design can
see it."

**Reason.** What 4.3 shows is a positive slope of engine evaluation drift (the played move is the
engine's first line, so the measured loss is depth asymmetry between two searches) on residual
time: residual time tracks engine instability the frozen depth-12 features did not capture. That is
unmeasured difficulty of the engine-measurable kind. Gate 3 F-B4: "The human-perceived form of A2 is
untouched by every measurement here." "There it is visible" reports the human-perceived form as
observed, one sentence after saying it cannot be excluded.

**Replacement** (§7): "Section 4.3 is the closest this design comes to seeing unmeasured difficulty
at all, and what is visible there is its engine-measurable form -- evaluation instability the frozen
features did not capture, tracked by residual time. The human-perceived form is touched by no
measurement here." (§4.3): "It is unmeasured, engine-measurable difficulty seen directly, in the one
place the design can see it."

### F8. The practical-magnitude gloss has the wrong arithmetic -- UNSUPPORTED NUMBER (required)

**Quoted** (§4.4): "A decision taking e times longer than the model expects -- 2.7 seconds where it
expected 1 -- is associated with 0.0134 more".

**Reason.** `beta` is per unit of `log(1 + T)`. One unit multiplies `1 + T` by e: from an expected
1 second (`1 + T = 2`) that is `1 + T = 5.44`, i.e. about 4.4 seconds, not 2.7. "e times longer" is
only right for large `T`.

**Replacement.** "A decision whose `1 + seconds` is e times what the model expects -- about 4.4
seconds where it expected 1 -- is associated with 0.0134 more, about 27% of a typical error,
concentrated as 4.2 describes."

### F9. The obligation (d) qualification misstates the size of the fall -- UNSUPPORTED NUMBER (required)

**Quoted** (§13): "the band values run from about 0.0105 to 0.0162, so the magnitude falls by
roughly a third from the bottom of the rating range to the top. It is invariant in sign and in
shape."

**Reason** (`periods.final.beta_by_band`, `beta_at_mean_rating`, `beta_rating_interaction`): the
bottom band (800-999) is 0.0128 and the top (2400-2599) 0.0105, an 18% fall; 0.0162 is the
1200-1399 band, and maximum-to-minimum is 35%; the fitted interaction (-0.00022 per 100 Elo about
0.01368 at 1600) implies 0.0155 at 800 and 0.0115 at 2600, a 26% fall. "So ... from the bottom of
the rating range to the top" attaches the maximum-to-minimum figure to a bottom-to-top statement.
Separately, "invariant in shape": level 3 has no shape test (`VERDICT_RULES.md` §3, N3), the band
Spearman of `beta` is -0.57 (descriptive), and the report nowhere defines "shape". Amendment A5(d)
used the word; the report must say what it means or drop it.

**Replacement.** "the `beta` x rating interaction on FINAL is -0.00022 [-0.00043, -0.00002] per 100
Elo; the raw band values run from 0.0162 (1200-1399) to 0.0105 (2400-2599), the lowest band is
0.0128, and the fitted interaction implies a fall of about a quarter across 800-2600 (0.0155 to
0.0115). It is invariant in sign (9 of 9 bands) and both halves of its dose-response are positive
(section 4). It is not invariant in size."

### F10. The "three-parameter" `beta` column is not the estimator the sentence describes -- UNSUPPORTED NUMBER (required, minor)

**Quoted** (§2 table): "`beta` | +0.01342 | +0.01342 | +0.01340", described as "a three-parameter
regression that lets the frozen predictions carry their own coefficients".

**Reason.** `report_diagnostics.py` computes `beta_3param` as `loss ~ unexpected_time_population +
Qhat0 + (unexpected_time_population - ut_resid)`. But `ut_resid` is the residual of
`unexpected_time_within_rating` (`analysis.residualise`, line 119), so the third regressor is
`UThat + (Yhat_T2R - Yhat_T2P)`, not the frozen prediction. The regression as described
(`quality ~ UT_within + Qhat0 + UThat`) gives +0.013457 on the cached FINAL frame -- the value
amendment A7.5 and Gate 3 report (0.01346). Two documents now print different numbers for the same
named quantity. The Metric A column is computed as described and matches. The conclusion ("about
2%") is unaffected.

**Change.** Either fix `report_diagnostics.py` to regress on `unexpected_time_within_rating` (a
permitted implementation repair that changes no verdict; it reproduces A7.5) or print A7.5's value
and say so. Section 15 should note that the three-estimator columns are the pipeline's own
recomputation and agree with A7.5's adversary reconstruction to the fourth decimal.

### F11. "The only post-holdout change in the study" is false as written -- OVERCLAIM (required)

**Quoted** (`FAILURES.md` F10): "**Disclosure:** this is the only post-holdout change in the study."

**Reason.** Commit `67a2683`, after the holdout was opened, also changed `src/estimands.py` (the
F12 key rename), `src/c9.py` (the `budget_agreement` block; `results/c9.json` regenerated with
identical estimates), `src/make_report.py` (verdict argument, figure and table labels, the
`status` column), and added `report_diagnostics.py`, `repair_c3.py` and `write_report.py`. None of
them touches an estimate or a verdict-bearing quantity, which is the claim that is true.

**Replacement.** "**Disclosure:** this is the only post-holdout change to a control's construction,
and no estimate, verdict-bearing quantity or threshold changed after the holdout. The other
post-holdout code changes -- F12's key rename, the C9 budget-agreement correlations, the report
generator and its diagnostics, table labelling -- are in commit `67a2683` and produce no number a
verdict reads."

### F12. Section 9 omits that §2.6 was unreachable regardless -- MISLEADING BY OMISSION (required, minor)

**Quoted** (§9): "Preregistered condition §2.6 is therefore **not evaluable**".

**Reason.** `VERDICT_RULES.md` §2.6 is reachable only from `EXPERTISE_ADAPTATION_SUPPORTED`, which
did not fire under either verdict. A reader of the verdict block's "SECONDARY TIME CONTROL: not
evaluable" could infer that the secondary failure cost the study a label. It did not.

**Change.** Add: "(and it could not have applied in any case: §2.6 is reachable only from
`EXPERTISE_ADAPTATION_SUPPORTED`, which neither verdict reached; the secondary block's failure cost
the study no verdict)."

### F13. "The one that crossed the tolerance" -- OVERCLAIM (required, minor)

**Quoted** (§6.3): "The one that crossed the tolerance is the one section 2 is about."

**Reason.** Two FINAL nulls in the table exclude zero: C3 -> Metric A (2.51) and the raw-column C4
(2.10, interval [-0.00155, -0.00011]). Only the first is a pass condition.

**Replacement.** "Two of them exclude zero; the verdict-bearing one, C3 -> Metric A, is the one
section 2 is about; the raw-column C4 is discussed below and is not a pass condition."

### F14. "Every band condition is ... reported with the top band dropped" -- OVERCLAIM (required, minor)

**Quoted** (§12.9). Only `beta` and the pooled Metric B gradient are reported with the top band
dropped (sections 4 and 5). **Replacement.** "`beta` and the primary Metric B gradient are therefore
also reported with the top band dropped (sections 4 and 5)."

### F15. Metric D's Spearman is printed against the wrong bar -- UNSUPPORTED NUMBER (required, minor)

**Quoted** (§10): "band Spearman 0.20 against a bar of 0.6." The expected direction is negative, so
the bar is rho <= -0.6; as printed it reads as a near miss in the right direction. **Replacement.**
"band Spearman +0.20 against a required -0.6 (expected direction negative)." `write_report.py`
should print the signed bar for every metric.

### F16. "replicates across three independent months" -- OVERCLAIM (recommended)

**Quoted** (§1). DEVELOPMENT is the month every nuisance model was fitted on; the out-of-sample
replications are April and June. "within a single player's own decisions and within a single game"
are point estimates with no interval in `report_diagnostics.json`. **Replacement.** "and it is
reproduced out of sample in the two later months (three periods in all, the first being the fitting
period)"; add "(point estimates; no interval computed)" after the within-player and within-game
values in §4.1, or compute the intervals.

### F17. "the largest rating-dependent structure in these data" -- OVERCLAIM (recommended)

**Quoted** (§5.3). An unverifiable superlative; Metric A (-0.0107 log-seconds per 100 Elo) is a
larger rating-dependent quantity in the same units. **Replacement.** "a large, replicated
rating-dependent structure". Also add the zero-row value of the first row (+0.00817 on FINAL, the
exact negative of the second row; `ey_on_minus_predicted_voc_x_rating_zero_rows`) to the table, so
"the second row is the first row with a minus sign" can be checked from the page.

### F18. "pinned by the adversary before any variant was tried" -- UNSUPPORTED (recommended)

**Quoted** (§2 and `FAILURES.md` F10). A process claim the repository cannot verify. Gate 3 §1.6
says "One construction, no variants" and §1.9 "pinned by the adversary, not chosen by the
researchers". Use those words.

### F19. "which for many is a premove decided on the previous position" -- UNSUPPORTED (recommended)

**Quoted** (§5.1). The premove share is not observable in the dump (Gate 1 disclosure 3); "for many"
is unmeasured. **Replacement.** "which includes premoves -- decided on the previous position -- in a
share the dump does not record".

### F20. `MODEL_CARD.md` §7.3 and §7.4 -- UNSUPPORTED NUMBER (recommended)

§7.3 "The whole fourteen-feature engine-difficulty block moves `beta` by 3.7%": the block moves it
2.3% (0.01393 -> 0.01361); block plus value of computation, 3.7%. §7.4 "correlates 0.62 with itself
across engine budgets": 0.62 is the residual instrument; the raw `voc_regret` correlates 0.64. Fix
both numbers.

### F21. `REPRODUCIBILITY.md` §3 -- MISLEADING BY OMISSION (recommended)

Step 6 `python src/make_report.py` defaults to `analysis_final.json` and `verdict.json`; the committed
`results/tables/12_controls.csv` (repaired C3 block, the `_as_shipped` block, the repair note) and
`14_second_time_control.csv` (the NOT EVALUABLE status) were produced with
`--analysis results/analysis_repaired.json`. The recipe as written does not regenerate the committed
tables. Also "Three numbers quoted in `REPORT.md` come from that adversary's own reconstruction" are
three groups of numbers, and section 9's extrapolation diagnostics (-7.35, two thirds, five times,
+0.0114, -0.00005, "a hundred null standard deviations", the top-band player counts) and section 2's
`61,676 / 298,552` are the adversary's too; list them in §15 and in `REPRODUCIBILITY.md` §3.

### F22. `MODEL_LEDGER.md` rows 29 and 34 -- MISLEADING BY OMISSION (recommended)

Row 29 "Metric B null by five readings": after Gate 3 F-N4 add "[one instrument read four ways plus
a degenerate matched form; Gate 3 F-N4]". Row 34 "with every Gate 2 language obligation and every
Gate 3 downgrade applied": A5(a)'s single-factor statement was applied wrongly (F2) and §2.5c was
missed (F5); append a row 35 recording this gate's required changes rather than editing row 34.

### F23. §8 "The restricted Metric B gradient is what fails the `player_disjoint_holds` condition" -- imprecise (recommended)

Five of the six restricted sub-conditions fail (pooled gradient, matched, `T = 0` removed, low clock
pressure, spread); the restricted `beta` passes. **Replacement.** "The restricted Metric B readings
-- pooled gradient, matched, `T = 0` removed, low clock pressure, spread -- are what fail the
`player_disjoint_holds` condition; the restricted `beta` passes."

### F24. §14 item 2 "the channel found here at +0.007 to +0.010 per 100 Elo" -- recommended

Label it as §5.3 does: "observed here, un-preregistered and confounded by construction (section
5.3)". Gate 3 used "found"; the report's own §5.3 is stricter and should be consistent with itself.

---

## 3. Gate 3 downgrades and Gate 2 language obligations, item by item

### 3.1 Gate 3 rulings and disclosures (§1.8)

| Gate 3 item | Where in the report | Honoured? |
|---|---|---|
| 1.8.1 both verdicts, derivation, prediction table, repair diff | verdict block; §2 | yes; F6 for the level line and §13 |
| 1.8.2 corrected explanation (denominator, not player-versus-row) | §2 "The corrected explanation" | yes |
| 1.8.3 every destructive null is a code check | §6.1 | yes |
| 1.8.4 the class table with the offset statement | §6.3 | table yes; the "larger than April" statement is contradicted by the control blocks for C1 and the raw-column C4 -- F4 |
| 1.8.5 Metric A and `beta` under three estimators | §2 table | yes; the `beta` three-parameter column is computed differently from the description -- F10 |
| 1.8.6 the Gate 2 miss, in the reviewer's words | §2 | yes, verbatim |
| 1.7 the run label; 1.9 rescue-risk statement | run label at top; A7.10 in the amendments | yes |
| A7.11 `INVALID_EXPERIMENT` beside the repaired verdict wherever it appears | verdict block, §2, §15 | yes except the level line and §13 -- F6 |

### 3.2 Gate 3 interpretation downgrades and caveats (§2-§5)

| Finding | Downgrade / caveat | Honoured? |
|---|---|---|
| F-B1 blunder regularity; capped values beside `beta`; licensed sentence "predict blunders" | §1 ("about three quarters ... blunders"), §4.2 table and sentence | yes |
| F-B2 `beta` on engine-best rows; the A2 paragraph quotes it | §1, §4.3, §7 | yes; §7's "there it is visible" over-reads it -- F7 |
| F-B3 stratum variation is the outcome's scale | §4.4 | yes |
| F-B4 measured difficulty moves `beta` 3.7%; add the two budget correlations | §7 ladder; C9 table (r = 0.995, 0.96) | yes |
| F-N1 instrument caveats: partial correlation, clock terciles, reliability, validity | §5.2 | yes for point mass, partial correlation, reliability, validity; the clock-tercile sentence overstates -- F3 |
| F-N2 the cancellation; the null licenses only "composite returned zero" | §5.3, §5.6 | yes |
| F-N3 detectable spread beside the floor; spread failure not a finding about players | §5.4 | yes |
| F-N4 "five independent readings" -> one instrument four ways plus a degenerate matched form; matched `beta` as "recomputed inside coarsened cells" | §5.5, §4 table, §10 | yes |
| F-N5 C6 plants in the instrument's units at 5-10x; "a null the instrument could have broken" withdrawn | §6.2 | yes |
| §3.6 licensed / not-licensed lists | §5.6 reproduces both lists; none of the not-licensed sentences appears anywhere | yes |
| F-S1 secondary block fatal as shipped; not evaluable; `CROSS_CONTEXT_REGULARITY` not "narrowly missed" | §9, verdict block, table 14, figure 13 | yes; add F12 |
| F-S2 no control run on the secondary (process failure) | §9, §10, F11 | yes |
| F-S3 refit diagnostics exploratory and labelled | §9 | yes, labelled in the same sentence |
| F-O1 `tae_pooled` collision | F12 in `FAILURES.md`; `tae_pooled_slope_at_centre` | yes |
| F-O2 drafted sentences withdrawn; raw-column C4 not read as the channel; direct gradient cited with both readings | `FORBIDDEN` list; §6.3; §5.3 | yes |
| F-O3 Metric A two fifths premove share | §5.1 | yes; "for many" -- F19 |
| F-O4 per-band residual means | §11 | yes |
| F-O5 level-3 phrase needs obligation (d) | §13 | present; arithmetic and "shape" -- F9; A7.11 -- F6 |
| C3-a, C3-b, C3-c (correct the record; disclose the miss; print the class table) | §2, §6.3 | yes; F4 for the class statement |

### 3.3 Gate 2 language obligations (amendment A5)

| Obligation | Honoured? |
|---|---|
| (a) C7b as an exchange rate; multiple only beside the single-factor statement and the nuisance ladder | form yes; the single-factor number is wrong on FINAL -- F2 |
| (b) "A2 is bounded / constrained / excluded" forbidden; only the engine-measurable form "constrained"; human-perceived form "cannot be excluded" | yes (§7, §12.2, §13); F7 for the sentence that follows |
| (c) C9's interval with what changed between budgets; no "stronger than the design was entitled to expect" | yes; the hashed §2.5c addition is missing -- F5 |
| (d) "law-like" at level 3 carries the interaction and the band magnitudes in the same sentence | yes in form; arithmetic -- F9 |
| (e) raw-column C4 on FINAL beside the pass condition, with the recognition-channel reading | yes, as modified by Gate 3 F-O2 (direct gradient cited, both readings) |
| Gate 2 R7a nuisance ladder beside C7b, two readings, no choice between them | yes |
| `PREREGISTRATION.md` §9 forbidden list; A5's forbidden phrases; Gate 3 §3.6 / F-O2 phrases | none present, in the report or in the four ledger documents, except in explicit negation |

### 3.4 The four particular checks the gate asked for

* **The level-3 phrase.** Used once (§13) with obligation (d) in the same sentence. The
  qualification's arithmetic is imprecise (F9) and the sentence lacks the shipped verdict beside it
  (F6).
* **The Metric B null as a fact about players.** Not found -- not by statement, sentence order,
  emphasis or implication -- in `REPORT.md`, `MODEL_CARD.md`, `FAILURES.md` or `REPRODUCIBILITY.md`.
  The one residue is `MODEL_LEDGER.md` row 29's "null by five readings" (F22). The front-matter line
  of F1 is the opposite error: it asserts H2's content as the meaning of the verdict.
* **Equal footing of the two verdicts.** Both are printed in the verdict block, §2 and §15; §2
  reports what the repair is and is not, and §6.1 forbids reading a passing null as evidence. The
  lapses are the single level line and the §13 level-3 sentence (F6). Nothing in the report calls
  `INVALID_EXPERIMENT` an artefact.
* **The secondary block as evidence.** Not quoted as evidence anywhere; §9's exploratory numbers are
  labelled as Gate 3 required, §13 lists cross-context replication as unsupported, table 14 and
  figure 13 carry NOT EVALUABLE.

---

## 4. Classification of every finding

| # | Sentence or number | Class | Status |
|---|---|---|---|
| F1 | "What the repaired verdict label is allowed to mean: the time / VoC relation differs systematically with rating" | OVERCLAIM (asserts H2 as the verdict's meaning) | required |
| F2 | "a single latent factor about 5 times the engine block on both axes reproduces the observed `beta`" | UNSUPPORTED NUMBER (`sqrt(27)`; impossible under A5(a)'s algebra on FINAL) | required |
| F3 | "no response to the clock" / "does not respond to the resource ... Flat" (x4) | OVERCLAIM | required |
| F4 | "every destructive null ... larger than on the April period"; C4 raw column as drift | UNSUPPORTED NUMBER | required |
| F5 | C9 paragraph lacks the attenuation the interval excludes and the §2.5c sentence | MISLEADING BY OMISSION (hashed obligation) | required |
| F6 | level line and §13 level-3 phrase without the shipped verdict; "the verdict label" | FORBIDDEN LANGUAGE (A7.11 by paraphrase) | required |
| F7 | "there it is visible"; "unmeasured difficulty measured directly" | OVERCLAIM | required |
| F8 | "2.7 seconds where it expected 1" | UNSUPPORTED NUMBER | required |
| F9 | "falls by roughly a third from the bottom of the rating range to the top"; "invariant in shape" | UNSUPPORTED NUMBER | required |
| F10 | three-parameter `beta` +0.01342 (described estimator gives +0.01346) | UNSUPPORTED NUMBER | required (minor) |
| F11 | "this is the only post-holdout change in the study" | OVERCLAIM | required |
| F12 | §2.6 "not evaluable" without saying it was unreachable | MISLEADING BY OMISSION | required (minor) |
| F13 | "The one that crossed the tolerance" | OVERCLAIM | required (minor) |
| F14 | "Every band condition is ... reported with the top band dropped" | OVERCLAIM | required (minor) |
| F15 | "band Spearman 0.20 against a bar of 0.6" | UNSUPPORTED NUMBER | required (minor) |
| F16 | "replicates across three independent months"; within-player/game without intervals | OVERCLAIM | recommended |
| F17 | "the largest rating-dependent structure in these data" | OVERCLAIM | recommended |
| F18 | "pinned by the adversary before any variant was tried" | UNSUPPORTED (process claim) | recommended |
| F19 | "which for many is a premove" | UNSUPPORTED | recommended |
| F20 | MODEL_CARD §7.3 "3.7%"; §7.4 "0.62" | UNSUPPORTED NUMBER | recommended |
| F21 | REPRODUCIBILITY §3 recipe and "three numbers" | MISLEADING BY OMISSION | recommended |
| F22 | MODEL_LEDGER rows 29 and 34 | MISLEADING BY OMISSION | recommended |
| F23 | "The restricted Metric B gradient is what fails" | imprecise (OVERCLAIM, minor) | recommended |
| F24 | "the channel found here" | OVERCLAIM (minor) | recommended |

Everything else in `REPORT.md` I classify as **LICENSED**: the corpus table; the `beta` tables and
their intervals; the band sign agreement; the within-player and between-player decomposition as
point estimates; the blunder decomposition and its "licensed sentence"; the engine-best-move split;
the standing table; the Metric A statement with its `T = 0` qualification; the instrument's point
mass, partial correlation and reliability; the cancellation table and its two conclusions; the
floor and power statement; the matched-sample composition and balance table, and the sentence "could
not have been met by any allocation behaviour" (Gate 3's own words; a precise form would say "by any
gradient on the varying rows smaller than about ten times the one observed"); the licensed /
not-licensed lists; the controls table; §6.1 and §6.2; the nuisance ladder with its two readings;
the C9 correlation table; the replication table and the player-disjoint sentence; the secondary
section's numbers (all traced to Gate 3 §4 and `analysis_secondary.json`); the "what failed"
section; the band residual means; the limitations; the "claims this study does NOT support" list;
and the NEXT_EXPERIMENT specification, which is Gate 3's.

Counts (24 findings): OVERCLAIM 10 (F1, F3, F7, F11, F13, F14, F16, F17, F23, F24); UNSUPPORTED NUMBER 7 (F2, F4, F8, F9, F10, F15, F20) plus 2 unsupported process / behavioural claims (F18, F19); MISLEADING BY OMISSION 4 (F5, F12, F21, F22); FORBIDDEN LANGUAGE by paraphrase 1 (F6). Fifteen are required (F1-F15), nine recommended (F16-F24). No literal forbidden phrase is present anywhere.

---

## 5. What was checked and found sound

* The five frozen documents hash to the sealed values; `PREREGISTRATION_FREEZE.json` and
  `FINAL_HOLDOUT_SEALED.json` are unchanged since the seal.
* The C3 repair's byte-identity claim, the retention of the shipped block, the identical failed
  conditions, and `evaluate.py` unmodified on both files -- all reproduced.
* `MODEL_CARD.md` §7 was appended with nothing above edited; `FAILURES.md` F6-F12 were appended
  below the pre-scoring entries; `POST_FREEZE_AMENDMENTS.md` A0-A6 are unchanged and A7 is appended.
* `c9.json` was regenerated post-holdout with the `budget_agreement` block; every estimate in it is
  identical to the pre-regeneration copy in the scratchpad and to the copy embedded in the analysis.
* The C5b, C8 and `model_comparison` baselines are the centred slope (Gate 1 M3 was applied):
  `C5_planted_regularity.beta_unplanted` equals `periods.final.beta.point`.
* No number in the report's generated tables and prose disagrees with its JSON source, other than
  the items in F2, F8, F9, F10 and F15, which are computed or glossed in `write_report.py` rather
  than read from a file.

---

## NEXT_EXPERIMENT

Nothing here requires new computation on FINAL to apply; every replacement above uses numbers already
in `results/`, in the Gate 3 review, or in amendment A5. Ideas that would need new FINAL computation,
recorded here and nowhere else:

1. Player-bootstrap intervals for the within-player and within-game `beta` (§4.1 prints point
   estimates only), so that "the association is inside a single player's own decisions" carries an
   interval like every other reported effect.
2. A pre-specified, interval-bearing test of the instrument's response to the clock -- the pooled
   slope in the fullest tercile minus the emptiest, with a player-bootstrap interval, on each period
   -- as the validity check B4 item 1 already names, rather than three unrelated point estimates.
3. `report_diagnostics.py` should emit `var(ut_resid)` per period and the A5(a) single-factor
   statement computed from it, so that the report's C7b paragraph is interpolated rather than glossed.
