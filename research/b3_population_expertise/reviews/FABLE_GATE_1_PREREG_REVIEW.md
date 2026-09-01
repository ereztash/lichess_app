PASS_WITH_REQUIRED_CHANGES

# FABLE GATE 1 -- preregistration review (independent scientific adversary)

**Reviewer role:** adversary, not collaborator. **Scope read:** `GATE_1_PACKET.md`,
`PREREGISTRATION.md`, `DATA_PROTOCOL.md`, `FEATURE_SCHEMA.md`, `MODEL_SPEC.md`, `VERDICT_RULES.md`;
for context `research/b2/analyse.py`, `research/b2/analysis.json`, `shared/import-diagnostic.ts`,
`shared/win-probability.ts`, `shared/opening-book.ts`, `shared/opening-book-provenance.ts`.
No data was read (none exists). No research file was edited.

## 2. Summary

H1 is answerable as the adjusted association it claims to be, and the leakage boundary, freeze
discipline and player-level uncertainty are sound in structure. H2 as specified is not safe: the
primary Metric B has a specification bug (interaction without its main effect), an undefined
per-period estimation rule, a degenerate relative floor, and three mechanical routes to a rating
gradient (clock ceiling, `T = 0` floor, position/win-probability scale) that the verdict does not
close; Metrics A and D are over-adjusted on `opponent_rating` (a near-collinear proxy for the
exposure) so they estimate matchup rather than level, and Metric C is a restatement of Metric B, so
"two of four metrics" is really one. Every defect below is repairable before a single decision is
scored, which is why this is not a FAIL; the thirteen required changes must be made and re-hashed
before the freeze.

## 3. Required changes

Ordered by how directly each one can manufacture a wrong verdict. Each names the document and rule,
the mechanism, and the minimal repair.

### R1. Metric B is misspecified and its per-period estimation is undefined
**Where:** `MODEL_SPEC.md` §4 Metric B ("within band b: Y ~ gamma_b * voc_z + [T1 without VoC
and without rating]"; "Continuous form: the coefficient of `voc_z x rating` in the pooled model";
"partial correlation form, `gamma_b * sd(voc_z) / sd(Y | controls)`"; §4 preamble "fitted on
DEVELOPMENT where a fit is needed, frozen, and evaluated per period"); `VERDICT_RULES.md` §1 "TAE
gradient".
**Defects.**
(a) The pooled model as written contains `voc_z x rating` but no `rating` main effect (T1 has no
rating by construction). An interaction without its main effect loads the rating main effect on
time (Metric A predicts one) multiplied by `E[voc_z | rating]` (which is not zero within rating,
because position distributions differ by band) onto the interaction coefficient. That is a
mechanical TAE gradient with no allocation content.
(b) "Evaluated per period" has no meaning for a fitted coefficient. Either `gamma_b` is frozen from
DEVELOPMENT (then FINAL contributes nothing and condition 5 "on FINAL" is reading a DEVELOPMENT
number) or it is re-fitted on FINAL (then a model is fitted on the period the result is read from,
which §0 forbids). H1 resolves this explicitly (frozen nuisance + one-parameter re-estimate); H2
does not.
(c) Regressing the frozen-T1P residual of `Y` on raw `voc_z` is not the partial slope, because
`voc_z` is correlated with T1 features (`voc_switch` is a function of the same iteration history
as `best_move_changes`; `voc_drift` of the same as `eval_volatility`; censored `voc_regret`
*equals* `gap1k`). Frisch-Waugh requires `voc_z` to be residualised on the same frozen nuisance.
(d) `sd(voc_z)` in the partial-correlation form is 1 by construction on pooled DEVELOPMENT; it
must be the band-conditional, control-conditional sd or the form corrects nothing.
**Minimal repair.** Specify Metric B as: fit on DEVELOPMENT and freeze two nuisance models,
`Y ~ T1P` and `voc_z ~ T1P` (same basis, same penalty rule). In any period P, form
`eY = Y - Yhat_T1P`, `eV = voc_z - Vhat_T1P`; `gamma_b(P) = cov(eY, eV | b) / var(eV | b)`, a
one-parameter estimate per band; partial correlation `= corr(eY, eV | b)`. The continuous gradient
is the coefficient of `eV x rating` in `eY ~ s(rating) + eV + eV x rating` where `s(rating)` is
the frozen-knot spline main effect (a three-parameter re-estimate, no nuisance choice on P). Apply
the same "frozen nuisance, few-parameter re-estimate" construction to Metrics A, C and D and say
so in §4's preamble.

### R2. Three mechanical routes to a Metric B rating gradient are not closed by the verdict
**Where:** `VERDICT_RULES.md` §2.5 conditions 5 and 10; `MODEL_SPEC.md` §9 rows C14, C17; §6.
**Mechanisms** (each produces a gradient with the allocation policy held identical across bands):
(i) **Clock ceiling.** A player with 5 s left cannot spend 15 s on a high-VoC position. Time
trouble is more frequent in lower bands (A4, conceded). The within-band slope of time on VoC is
therefore compressed from above in low bands. Metric B's nuisance set is T1, which has
`clock_pressure` additively but *not* the `voc_z x clock_pressure` interaction (that is in T2).
(ii) **`T = 0` floor.** `log(1 + T)` on whole seconds has a point mass at 0 and steps at 0.69,
1.10. A band whose median `T` is 1 s has its slope compressed from below. C17 removes `T = 0`
but its pass condition names only `beta`.
(iii) **Scale of the regressor.** `voc_regret` is in win-probability units through a logistic that
compresses everything in decided positions (30 cp is 2.76 pp at level and 0.28 pp at +10). Lower
bands live in decided positions more of the time, so `var(voc_z | band)` and the reliability of
`voc_z` differ by band; a slope on a differently-scaled, differently-attenuated regressor is not
the same estimand across bands. The matched analysis (§6) is the right tool but condition 10 only
asks it to be "directionally consistent" -- sign only, no interval.
**Minimal repair.** Condition 5 must hold, with a bootstrap interval excluding 0 in each case, (1)
on the matched sample of §6, (2) with `T = 0` decisions removed (extend C17's pass condition to
"Metric B gradient same sign, interval excludes 0"), and (3) within the lowest `clock_pressure`
tercile (extend C14 from "reported" to a pass condition for Metric B), or equivalently with
`eV x clock_pressure` in the Metric B model and `gamma_b` reported at the frozen DEVELOPMENT
median of `clock_pressure`. Fix these now; they are three extra lines in `evaluate.py`.

### R3. The 20% relative TAE floor is degenerate
**Where:** `VERDICT_RULES.md` §2.5 condition 5: "`TAE(highest) - TAE(lowest)` is at least 20% of
`TAE(lowest)` in relative terms".
**Defect.** If `TAE(lowest)` is near zero, 20% of it is near zero and any positive difference
passes; if `TAE(lowest)` is negative (weak players spending *less* time where VoC is high is a
live possibility), 20% of a negative number is negative and the criterion is satisfied by every
difference. The design fixed `BETA_FLOOR` as an absolute number for exactly this reason and then
did not do the same for its primary H2 metric.
**Minimal repair.** Replace with an absolute floor in the metric's own units:
`TAE(highest adequately powered band) - TAE(lowest) >= TAE_FLOOR` log-seconds per DEVELOPMENT sd
of VoC, `TAE_FLOOR` fixed now (C6 plants a gradient of 0.05 across the rating range; a floor of
0.02, i.e. 40% of the planted scale, is the obvious choice; the number is the designers' to fix,
but it must be a number). Report `TAE(lowest)` itself in every table so the sign of the base is
visible.

### R4. The verdict gates are not exhaustive and several rule terms are undefined
**Where:** `VERDICT_RULES.md` §2.2, §2.3, §2.4, §2.5 conditions 2, 4, 5; §1 "adequately powered".
**Defects.**
(a) §2.2 is ambiguous in precedence: "`beta`'s interval contains 0, **or** `abs(beta) <
BETA_FLOOR`, **and** T1 already explains..." can be read as `(A or B) and C` or `A or (B and C)`.
(b) There is a hole: if `beta > 0`, interval excludes 0, `beta >= BETA_FLOOR`, but the direction
appears in fewer than 80% of adequately powered bands, §2.4 does not fire (it requires 80%), §2.5
does not, §2.3 does not (it requires `beta` to fail §2.2's bar), and §2.2 does not. A mechanical
`evaluate.py` has no verdict to print. Likewise, `beta` positive but below the floor with a
Q1-Q0 gain `>= 0.001` falls between §2.2 and §2.3.
(c) Conditions 4 and 5 do not say whether raw or shrunk (DerSimonian-Laird) band estimates enter
the Spearman and the high-low difference; shrinkage with unequal band variances can reorder bands.
(d) "80%" of 7 bands is 5.6; rounding is unstated. With 3 adequately powered bands, Spearman is in
`{-1, -0.5, 0.5, 1}` and "monotone enough" collapses to "perfectly ordered"; with 2 it is
vacuous. No minimum band count is stated, and which bands are adequate is partly a consequence of
the cost pilot's `q_b`, which is set after this freeze (packet §9.6 flags the softness; flagging
is not a rule).
(e) Condition 4 counts Metric C as an independent metric. Metric C is `abs(U) * 1[sign(U) !=
sign(voc_z)]` with `U` the T1P residual of `Y`; a larger within-band covariance of `U` with
`voc_z` (which is Metric B) mechanically lowers the disagreement rate (which is Metric C). "At
least two of A, B, C, D, one of them B" is satisfiable by B and its own transform.
**Minimal repair.** (a) Write §2.2 with explicit parentheses. (b) Add a catch-all: §2.4 becomes
"H1 holds on FINAL (conditions 1 and 3) and §2.5 is not met", and the 80% band agreement moves to
the scientific-level ladder (level 3) where §3 already places it; or add an explicit
`REGULARITY_NOT_INVARIANT` verdict. Enumerate the remaining cases and assert in `evaluate.py`
that exactly one gate fires. (c) State "raw band estimates" for the agreement/Spearman tests and
"shrunk" for figures, or the reverse, but state it. (d) State `ceil`; fix a minimum of **5**
adequately powered bands for §2.4 and §2.5, else the verdict is capped at the next lower level and
the reason is the band count; require the cost pilot to target adequacy in every band the
population allows, with the per-band targets written to the manifest before scoring. (e) Rewrite
condition 4 as "Metric B, and at least one of Metrics A and D"; demote Metric C to descriptive
alongside E and say in §4 that it is a transform of Metric B.

### R5. `opponent_rating` in the nuisance set of the H2 models over-adjusts the exposure
**Where:** `MODEL_SPEC.md` §1 T0 ("`opponent_rating`"), §4 Metric A ("coefficient of `rating`
in `Y ~ [T1 feature set] + rating`"), Metric C, Metric D ("`unexpected_time_population = Y -
Yhat(T2P)`, rating excluded"), §2; `FEATURE_SCHEMA.md` §7.
**Defect.** Lichess pairs players by rating; across 800-2600, `corr(rating, opponent_rating)` is
very high. T0 (hence T1, T2, T2P, T1P) contains `opponent_rating`. Consequences:
(a) Metric A's `rating` coefficient, with `opponent_rating` held fixed, is identified from
`rating_diff` variation only -- it is the effect of being stronger *than your opponent*, a
matchup quantity, not the effect of expertise level. The design's reading of it as "matched
difficulty thinking time decreases with expertise" is not what the estimand is.
(b) `unexpected_time_population` is described as rating-free. It is not: `opponent_rating` in T2P
absorbs most of the rating effect through its proxy. Metric D (tail rate of that residual by
band) is therefore a between-band comparison of a residual that has already had most of the
between-band signal removed; its expected direction is not what the text says it is.
(c) The same applies to Metric C's `AllocationLoss ~ [T1 without VoC] + rating`.
For H1, where `rating` is a nuisance, the parameterisation does not matter; for H2, where rating
is the exposure, it is the whole question.
**Minimal repair.** In every model, replace `opponent_rating` by `rating_diff` in the context
block. Rating-free models (T0, T1P, T2P) then adjust for matchup without proxying level; models
"with rating" (T2R, Q0, Q1, Metric A, Metric B pooled, Metric D logistic) contain
`{rating, rating_diff}`, so the `rating` coefficient is the level effect along the pairing
diagonal. Same column space as before for the rating-containing models, different estimand; no
extra feature.

> **Addendum to R1, written after the committed revision of `MODEL_SPEC.md` (`01f02d7`).** The
> committed text now gives Metric B in frozen-residual form (`gamma_b = <y_resid_T1, voc_resid> /
> <voc_resid, voc_resid>` with `voc_resid` purged of the same T1 controls) and puts Metrics A and D
> in the same shape. That resolves R1(b) and R1(c) for Metric B. Still open and still required:
> R1(a) -- the pooled model for the continuous gradient names `voc_resid x rating` and no `rating`
> main effect; R1(d) -- `sd(voc_z)` in the partial-correlation form is the pooled DEVELOPMENT sd
> (= 1) and must be the band-conditional sd of `voc_resid`; and a new inconsistency: `VERDICT_RULES.md`
> §1 defines the TAE gradient as the coefficient of `voc_z x rating` while `MODEL_SPEC.md` §4 now
> says `voc_resid x rating` per 100 Elo. The verdict document must use the model document's
> definition. Metric C is not yet in frozen-residual form; if it survives R4(e) as descriptive, say
> how it is computed per period.

### R6. Both sides of one game are counted as independent players
**Where:** `DATA_PROTOCOL.md` §4.1 (acceptance per `game_id || side`) and §4.3 (cap per player);
`MODEL_SPEC.md` §0 "Uncertainty" and §8 ("`move ⊂ game ⊂ player`"); `PREREGISTRATION.md` §2 A10
("Can it be excluded? Yes.").
**Defect.** Acceptance is per side, so both sides of one game can be accepted, and in every band
with `q_b = 1.0` (the scarce bands, by rule) *every* game contributes both sides. The two sides of
a game share the position sequence (alternate plies of one game, so their difficulty and VoC
features are the same trajectory sampled at offset one), a coupled clock history, and each is the
other's `opponent_rating` and `clock_ms_opp`. The dependence structure is a player-game graph, not
the tree `move ⊂ game ⊂ player`, so a bootstrap that resamples players as independent clusters
understates the variance of every band-level statistic, worst in the thinnest bands, and "interval
excludes 0" becomes easier exactly where the strongest verdict is decided (condition 5 compares the
extreme adequately powered bands). A10 is marked excluded; it is not.
**Minimal repair.** Accept at most one analysed side per game, chosen by the same hash (the side
with the smaller `blake2b(SEED || game_id || side)`), and count the discarded sides per band. Games
are then disjoint across players and the player bootstrap is a valid cluster bootstrap. If the
scarce-band cost is judged unacceptable, the alternative is a cluster bootstrap over connected
components of the player-game graph with component counts reported per band. Either way, A10's
"Yes" must be re-justified in the text.

### R7. The empirical leakage test cannot see two of the items §5 forbids
**Where:** `PREREGISTRATION.md` §5, enforcement item 2 ("the played move is replaced with a
different legal move and the whole pre-move feature vector is recomputed").
**Defect.** Swapping the played move detects a feature that reads the move or the resulting
board. It cannot detect a feature that reads a later clock, a later move, `Termination` or
`Result`, because the swap does not recompute any of those: `clock_ms_self` mistakenly read at
`clk[i]` instead of `clk[i-2]` passes bit-identical. §5's forbidden list names "the game result,
any later move, any later clock" explicitly, and B2's own history (the inferred base clock,
`research/b2/analyse.py` lines 52-63) shows clock-derivation bugs are the ones that happen. A test
that fails the build must cover the list it enforces.
**Minimal repair.** The perturbation replaces the entire game suffix after the decision --
remaining moves, remaining `%clk` annotations, `Termination`, `Result` -- with a different legal
continuation and different clocks, and requires bit-identity of every `PRE_MOVE` column. State
explicitly that `seconds_taken` and `log_time` are the only non-outcome columns permitted to change
(they read `clk[i]`, which is the reason they are outcomes and never predictors), and that
`clock_ms_self`, `clock_ms_opp` and any lagged-time feature (R9) must not.

### R8. A design freedom survives the freeze
**Where:** `PREREGISTRATION.md` §3 table: DEVELOPMENT may be used for "model-family exploration";
VALIDATION for "comparing already-defined candidates ... freezing the final specification".
Against: `MODEL_SPEC.md` preamble ("This file is binding"), §0 (one family, one penalty grid, one
knot rule), and `PREREGISTRATION.md` §10 (hashed at Gate 1 PASS).
**Defect.** If the family or the specification can still be chosen on DEVELOPMENT and "frozen"
on VALIDATION, Gate 1 hashes a document that does not determine the analysis, and the choice is
made after two of the three periods have been seen. If nothing is open, the two phrases are dead
text that a later reader will treat as licence. Either way `evaluate.py` cannot be "a transcription"
of an under-determined specification.
**Minimal repair.** Delete "model-family exploration" and "freezing the final specification", or
replace them with an exhaustive list of every choice that remains open after Gate 1, each with its
decision rule and the period that decides it (the ridge penalty from the frozen grid by grouped CV
on DEVELOPMENT is already such a rule and is the model for how the others must read). Anything not
on the list is closed. The list is part of what is hashed.

### R9. The opponent's previous think time is an available pre-move predictor, and its omission opens a mechanical positive for H1
**Where:** `FEATURE_SCHEMA.md` §6 (clock features); `MODEL_SPEC.md` §1 T0.
**Defect.** Blitz players think on the opponent's clock. The deliberation behind decision `i`
includes an unobserved share of the opponent's think time on ply `i-1`, which is observable from
the clocks already parsed (`clk_opp[i-3] - clk_opp[i-1]`) and is available before the human moved.
Omitting it: a decision made after a long opponent think tends to have low own `T` (the move was
already chosen) *and* better quality (more effective deliberation went into it) -- negative
`unexpected_time` paired with low `quality_loss`, which is a positive contribution to `beta` that
has nothing to do with "unusually long deliberation predicts a worse move". Its use also varies
with rating, so it reaches H2.
**Minimal repair.** Add `opp_prev_think_s` (whole seconds; `null` plus an indicator when the
opponent's previous move was their first) tagged `PRE_MOVE`, to T0. It is invariant under the swap
test and under the suffix test of R7 by construction. `own_prev_think_s` (`clk[i-4] - clk[i-2]`)
is the companion feature; it absorbs pace but also part of the policy Metric B measures, so if it
is added its role must be stated (T0 for H1; excluded from the Metric B nuisance set). That second
feature is recommended, not required.

### R10. Engine-assisted and closed accounts are not excluded, and Metric B is the statistic that finds them
**Where:** `DATA_PROTOCOL.md` §2 ("not a bot": title `BOT` only); `VERDICT_RULES.md` §2.5
condition 5.
**Defect.** Time that tracks engine difficulty, combined with low `quality_loss`, is close to what
Lichess's own detection looks for, and it is exactly what Metric B rewards. Engine-assisted
accounts concentrate in the upper bands of `180+0`. The two-sides-per-player cap bounds one
account, not a class of accounts, and condition 5 is a contrast between the top and bottom
adequately powered bands, so a few percent of assisted sides in the top band inflate
`TAE(highest)` directly. Titled bots are excluded; accounts later closed for engine use are not,
and the dumps do not mark them.
**Minimal repair.** At each period's ingest, one batch lookup of the sampled usernames' public
account status (`POST /api/users`, 300 ids per call) on a lookup date recorded in the manifest;
exclude sides whose account is closed or marked `tosViolation` as of that date; count the
exclusion per band. The rule is identical for every period, reads no game content, and for FINAL
runs after Gate 2 as part of the mechanical ingest. If the designers decline the lookup, §2 must
gain an A11 marked "cannot be excluded" and condition 5 must be reported with and without the
highest adequately powered band.

### R11. C5 is tautological, and the negative-verdict interpretation rests on it
**Where:** `MODEL_SPEC.md` §9 row C5 and closing paragraph ("C5, C6 and C7 are the controls that
give a negative result meaning"); `VERDICT_RULES.md` §2.1 item 2; `PREREGISTRATION.md` §8.
**Defect.** `beta` is, by the committed §3, the FWL slope of the Q0 residual on the residualised
`unexpected_time_within_rating`. C5 adds `0.02 * unexpected_time_within_rating` to
`quality_loss`, a term linear in the estimator's own regressor. Recovery follows from linear
algebra; the "within 30%" tolerance can only be missed by a code bug. A control that cannot fail
for a scientific reason does not establish that a real signal -- one that lives in raw time under
an expected-time model that is not T2R -- would be seen; it establishes that the code multiplies
correctly. So "if C5 fails, no negative verdict is informative" is true and empty, and §8's claim
that C5 makes `SKILL_ONLY` meaningful is not supported.
**Minimal repair.** Relabel C5 as an implementation check and delete the sentence that it gives a
negative result meaning, or add **C5b**: plant `0.02 * (Y - Yhat_GBT)`, the residual of the
already-fitted gradient-boosted comparator (or of T0P) -- a signal not defined through the
pipeline's own residual -- with pass condition "sign recovered and point estimate at least 50% of
the planted size". Fix the tree's library, version, hyperparameters and seed in §1 so C5b is
reproducible. C5b's shortfall is the measured attenuation of the pipeline against misspecification
and is reported as the factor by which real effects are understated; it is not an
`INVALID_EXPERIMENT` trigger.

### R12. C9 is under-specified, and its pass condition cannot detect the alternative it exists for
**Where:** `MODEL_SPEC.md` §9 row C9 ("same sign under both budgets"); `PREREGISTRATION.md` §2 A2,
A6 and §6.
**Defect.** (a) C9 does not say which period the 5,000 decisions come from, which seed draws them,
or whether the nuisance models are refitted on the subset at each budget or the frozen 60k-node
coefficients are applied to 150k-node features (whose scales differ: `final_depth`,
`eval_volatility`, `nodes_to_depth10`, and `voc_regret`'s shallow-to-deep gap all move with
budget). (b) Under A2, `beta` is positive at every budget and shrinks toward zero as difficulty is
measured better; "same sign" passes. The one quantity that discriminates A2 from H1 -- how much
`beta` and the Metric B gradient attenuate when the difficulty measurement improves -- is not
preregistered, so the design's own "central irreducible limitation" has no falsification handle.
**Minimal repair.** (a) The subset is drawn from VALIDATION (never the fitting period, never
FINAL) by the fixed `SEED`; every nuisance model is refitted on the subset at each budget with the
frozen recipe (knot rule, penalty grid, grouped CV); `beta` and the Metric B gradient are computed
within the subset under each budget. (b) Report `r_beta = beta(150k) / beta(60k)` and
`r_TAE = gradient(150k) / gradient(60k)` with player-bootstrap intervals, and preregister the
reading now: if the upper interval bound of `r_beta` is below **0.5**, the report must state that
the evidence favours A2 over H1 and level 3 and higher language is withheld. Whether that also
changes the verdict is the designers' choice, but the number and its threshold must exist before
FINAL is opened.

### R13. H2 is worded as a question this design cannot answer; narrow the claim
**Where:** `PREREGISTRATION.md` §1 (the boxed question: "better management of a common ...
process, rather than only a higher level of the quality outcome") and §9; `VERDICT_RULES.md` §2.5
label and §3 level 4 ("expertise systematically changes management of the process").
**Defect.** The strongest H2 signal is the within-band slope of time on engine-measured VoC. A
stronger player who merely *recognises* which positions are sharp -- pattern recall, chess
knowledge -- shows a steeper slope with an identical allocation policy, because a weaker player
cannot allocate time to high-VoC positions they cannot identify as high-VoC. "Management of the
process" and "better perception of the process's inputs" are not separable by any covariate in
this design, and the packet §3 already concedes that rating is a bundle. The design can support
"the time-VoC relation differs systematically with rating, net of matched position and clock
state". It cannot support "expertise changes management", and the label
`EXPERTISE_ADAPTATION_SUPPORTED` and level 4's sentence say the second thing.
**Minimal repair.** In §1 "What this experiment cannot do", state that no H2 metric distinguishes
a better allocation policy from better recognition of which positions require computation; add
"allocation skill", "time-management skill" and "manages time better" to §9 as forbidden causal
readings of a Metric B gradient; rewrite level 4 as the narrowed sentence above and define the
§2.5 label by it. No numeric rule changes. This is listed last because it changes words rather than
numbers, not because it is least important: it is the direct answer to the question of how a
positive result can appear if expertise means only stronger chess knowledge.

**On the count.** The thirteen do not collapse. R1 lost two sub-points to the committed revision
and kept two; R11 and R12 are both "a control that cannot fail" but through different mechanisms
(tautology versus an uninformative pass condition) and different repairs; R9 and R10 are both
exclusion/feature rules but close different channels (a pre-move predictor for H1; a class of
accounts for H2).

**Note on live edits during the review.** This review was written against the five documents at
commit `01f02d7`. While it was being written, uncommitted edits appeared on disk in
`MODEL_SPEC.md` and `VERDICT_RULES.md` that cite this review by number (R1a, R2, R3, R4a-e). As far
as the on-disk text shows, those edits implement R2 (condition 5 on the matched sample, without
`T = 0`, and within the lowest clock-pressure tercile), R3 (`TAE_FLOOR = 0.02`, absolute), R4
(parenthesised §2.2; §2.4 without band-shape; exactly-one-gate assertion; raw not shrunk; `ceil`;
minimum 5 bands; Metric C demoted) and the R1 addendum's TAE-gradient definition with the
`s(rating)` main effect. They do not, as of this writing, address R1(d), R5-R13, and `src/` (out
of my reading scope) has changed alongside. **The verdict is unchanged**: it is
`PASS_WITH_REQUIRED_CHANGES` until all thirteen are applied, the five documents are re-read once
against this list, and the hash is taken. The re-read is short; it is not optional, because a
repair applied under time pressure is exactly where a new defect gets in.

## 4. Recommended but not required

1. **Record the actual shallow depth.** `D_SHALLOW = 8` is a depth; when the 60k-node search
   completes only depth 9 in a wild position, the shallow-to-deep gap is one iteration, and in a
   quiet position it is four. `voc_regret` then conflates "value of computation" with "how far this
   engine got in this position", which is difficulty. Store `shallow_depth` and `final_depth` per
   row (both pre-move), report Metric B with the gap held fixed, and consider anchoring the shallow
   point at a node count rather than a depth.
2. **Censoring by band.** Censored `voc_regret` equals `gap1k` exactly. Report the censoring rate
   per band and Metric B on uncensored rows as a robustness.
3. **Player-first sampling.** Acceptance on `game_id || side` saturates the inclusion probability of
   heavy players (100 games on day 01 gives ~100 draws at `q_b`), so the sampled "independent
   players" are weighted by activity, and the heavy/casual mix differs by band. Hash on
   `player_hash` for player inclusion, then draw at most two sides. Record games-per-player-on-day
   as a covariate either way.
4. **Ingest stop rule.** The rule "stop at the first game whose `UTCDate` is not day 01" assumes the
   dump is strictly ordered by start time. Verify on DEVELOPMENT; if not strictly ordered, stop at
   the first game with `UTCDate >= day 03` and filter on `UTCDate == day 01`, recording the number
   of non-day-01 games skipped and the last `UTCTime` seen.
5. **Cost pilot provenance.** State that `q_b` and the per-band targets are computed from
   DEVELOPMENT header counts only, so no header of FINAL is read before Gate 2.
6. **Frozen-model calibration under shift.** On each evaluation period report the mean of
   `unexpected_time_within_rating` and of the Q0 residual by band. A frozen model applied to a
   different weekday will misfit in some region of feature space; where both residuals misfit
   together, the one-parameter `beta` picks up the shared misfit. Report a nuisance-refit `beta`
   beside the frozen one and require sign agreement (a robustness, not a verdict term).
7. **`k` sensitivity.** `shared/win-probability.ts` says the logistic constant was fitted on
   2300-rated games and is population-dependent. Recompute `quality_loss` and `voc_regret` with `k`
   halved and doubled (frozen now) and report signs.
8. **Clipping.** Report the share of `quality_loss` clipped at 0 per band and a robustness run with
   the clip removed; the clip is a nonlinearity that bites hardest where the engine is unstable.
9. **Reliability of `voc_z` from C9.** The 60k/150k pair on the C9 subset gives a per-band
   reliability estimate for `voc_z`; report it and a disattenuated Metric B gradient.
10. **Manifest completeness.** Add the design-matrix standardisation constants (column means and
    sds from DEVELOPMENT) and the null rule for `nodes_to_depth10` (impute 60,000 plus an
    indicator) to `results/model_manifest.json`; both are currently implementation freedom.
11. **Gradient-boosted comparator.** Fix library, version, hyperparameters and seed in
    `MODEL_SPEC.md` §1 (needed by C5b in R11 anyway).
12. **Level 5.** "C15 agreement across all three periods" counts DEVELOPMENT, which is in-sample.
    Require VALIDATION and FINAL (out-of-sample) plus `300+0`.
13. **Matched-cell retention in players.** "At least 20 decisions per retained band" can be one
    player. Add "at least 10 distinct players per retained band per cell".
14. **Define "materially inspected"** (§2.1 item 6) concretely: any read of FINAL bytes other than
    the ingest itself after Gate 2 is contamination; a judgment word inside a mechanical rule is a
    door.
15. **Post-holdout repair protocol.** Any repair under §4 "May" re-runs every control and reports the
    pre-repair verdict alongside the repaired one. B2's `merge_small` history is the precedent.
16. **`own_prev_think_s`** in T0 for H1 only, excluded from the Metric B nuisance set, with the role
    stated (see R9).
17. **Player-level analysis.** Define "player rating" for a player with two sides at different
    ratings (mean), and say whether the player bootstrap for §7 resamples within band or globally.
18. **C12-C14** say "sign agreement counted"; say counted toward what (the invariance table of the
    report), since nothing in `VERDICT_RULES.md` reads them except C14 via R2.
19. **Bootstrap replicates.** 400 percentile replicates put the 2.5th percentile on the 10th order
    statistic; with dot-product estimands the cost of 1,000 is trivial.
20. **`move_number`** is `ply // 2 + 1`; drop it from T0 (collinear with `ply`; harmless under
    ridge, pointless).

## 5. Disclosure-only observations for the final report

1. **A2 stands.** `beta` is, by the committed §3, the coefficient of `log(1 + T)` in a joint
   regression of `quality_loss` on the T2R feature set; the "unexpected time" framing is
   presentational. A positive `beta` is compatible with residual difficulty the engine did not
   measure, and R12's ratio is the only preregistered handle on it.
2. **Weekday composition.** 2026-02-01 is a Sunday, 2026-04-01 a Wednesday, 2026-06-01 a Monday.
   The frozen constants come from a weekend population and are applied to weekday ones; C15
   agreement is a sign test across differently composed days, not across months.
3. **Premoves.** A premoved decision has `T = 0` regardless of VoC and its quality was decided on
   the previous position. Premoving rises with rating and is indistinguishable from a fast decision
   in the dump. C17 is the only handle; report the `T = 0` share by band.
4. **Clock rounding and lag compensation.** Whole-second readings and Lichess lag compensation put
   about +/-1 s of error on `T`, which is large relative to the median blitz think time.
5. **Provisional and manipulated ratings** at the extremes (new accounts at 800-999, sandbagging).
   Rating deviation is not in the dump; this adds noise to the exposure, mostly attenuating.
6. **Units.** `quality_loss` is in the win-probability units of a 2300-rated population;
   `BETA_FLOOR` is absolute in those units, and a 100 cp error costs a 900-rated player less of
   their real winning chances than the curve says.
7. **Shared term, not just shared noise.** `voc_regret = wp1_before - wp_deep(best_shallow)` and
   `quality_loss = wp1_before - (1 - wp1_after)` share `wp1_before` exactly. The induced bias on
   `beta` is not sign-determined (it runs through the VoC coefficient in T2R); C9 is a sign check
   on it and nothing more.
8. **Ridge residuals** are not exactly orthogonal to the design, so `unexpected_time_*` carries a
   sliver of predictable time; negligible at this `n` and grid, but say so.
9. **Control accounting.** C1-C4 and C7 are code-correctness checks (a destroyed or absent signal
   cannot survive unless the code is wrong); they detect no confounding. Of the "eleven
   conditions", about five are independent scientific hurdles (H1 on FINAL; band agreement; Metric
   B with its floor and R2's three re-tests; the player-level regression; C15). Say so rather than
   letting the count do the persuading.
10. **The VoC proxy.** The `voc_*` features are the engine's iterative-deepening revisions between
    depth 8 and ~12; reading them as the value of *human* computation is the proxy assumption of
    the whole H2 design (see R13).
11. **Metric D** is a tail rate of a residual; between-band differences in it are between-band
    differences in residual variance as much as in "exposure".
12. **Sampling weights by activity** until recommendation 3 is adopted.
13. **`300+0`** receives knots, standardisation constants and coefficients from `180+0`; its
    failure is likely for reasons that say nothing about the hypothesis, and the rules already
    prevent it from changing the verdict.
14. **Engine lineage.** B3 scores with Stockfish 17.1 native; B2 used Stockfish 18 Lite WASM at
    depth 12. "Comparable difficulty scale" is approximate.
15. **`BLOCKED_BY_B2_REPRODUCIBILITY`** is a project rule, not a scientific one; it is stricter than
    B3's validity needs (a WASM-build hash mismatch would block a design it does not touch).
16. **Censored `voc_regret` is `gap1k`.** Stated in recommendation 2; the report should say it in
    the methods.

## 6. What was checked and found sound

* **Engine protocol.** Node-limited budget, `Threads 1`, hash reset before every search, fixed
  binary sha256, `MultiPV 4`, determinism measured rather than assumed, verification re-score as
  an `INVALID_EXPERIMENT` trigger.
* **Pre-move rule, structural half.** Provenance tags with `POST_MOVE` unreachable from any model's
  feature list; the forbidden list in §5 is the right list. (The empirical half is R7.)
* **VoC is not circular with respect to the human.** `voc_*` read one pre-move search and never the
  played move; the censoring rule has a fixed threshold (15%) that returns the design to Gate 1
  instead of patching after the fact.
* **Evaluation units.** Win probability for the side to move, mate mapped to +/-10000 cp, the
  accuracy threshold derived rather than chosen; `tau` and the `n_near` window now tied to a
  pre-existing repository constant rather than a free parameter.
* **Period discipline.** DEVELOPMENT fits, VALIDATION checks, FINAL is opened once by a mechanical
  script; every standardisation constant, knot, tercile, `q` and penalty is written to the manifest
  before VALIDATION is opened; the "may not" list after the holdout is explicit and includes the
  reviewer.
* **H1's estimator.** The committed FWL construction is explicit and correct: two frozen residuals
  and three dot products per replicate, no model choice on the evaluation period.
* **Uncertainty.** Player-level block bootstrap as the only interval type; move-level p-values
  refused on stated grounds; absolute `BETA_FLOOR` fixed from the outcome's practical scale before
  any estimate existed.
* **Player overlap.** The disjoint restricted estimate is preregistered, both branches are always
  reported, and the restricted branch is required to hold.
* **Sampling mechanics.** Deterministic hash acceptance, reservoir cap per player, ply-spaced cap
  per side, fixed seed, hashed usernames, every exclusion counted by name in the manifest.
* **Game filters.** Rated via `RatingDiff` presence (the lesson from B2's `Event`-string
  mislabelling), berserk detected from the first clock reading, `BOT` excluded, `Termination`
  filtered with `Time forfeit` kept for the stated reason, minimum length, full legality parse.
* **Opening book.** Built from 2026-03, disjoint from all three periods, membership on the pre-move
  FEN only, kept in the primary and removed in C11.
* **Positive/negative control architecture.** C6 (planted gradient) and C7 (null with the real
  covariate structure) are the right shape; C1-C4 are useful code checks.
* **Matched analysis and frontier.** Coarsened exact matching at frozen boundaries with balance
  reported; the frontier kept as a shape, not collapsed into a score.
* **Language rules.** §9's forbidden list, neutral residual names, and the ceiling phrase
  "cross-rating law-like regularity" are appropriate for an observational design.
* **The packet's candour.** §9 of the packet lists the design's soft spots before the reviewer
  looked, including the band-count softness (§9.6) that became R4(d).
