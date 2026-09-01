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

---
---

# GATE 1 RE-REVIEW

PASS_WITH_REQUIRED_CHANGES

**Reviewer role:** the same independent adversary, in a fresh context. **Scope read, in full, as they
now stand on disk (uncommitted, after `01f02d7`):** `PREREGISTRATION.md`, `DATA_PROTOCOL.md`,
`FEATURE_SCHEMA.md`, `MODEL_SPEC.md`, `VERDICT_RULES.md`; the packet's ADDENDUM (treated as a claim,
not evidence); every file in `src/` and `tests/`; `FAILURES.md`, `README.md`, `REPRODUCIBILITY.md`,
`MODEL_LEDGER.md`, `results/pilot_development.json`; the lines *removed* from the five documents
since `01f02d7` (nothing was silently weakened). The test suite was run (39 passed). `evaluate()` was
additionally run on seven constructed inputs the tests do not construct, and two estimator questions
were checked numerically. No research code or document was edited; this section is the only write.
`data/` is empty: no period is scored, no decision-level statistic exists, FINAL has never been read.

## Summary

Twelve of the thirteen changes are genuinely applied in the documents, and the documents now say the
right things: the rating-spline main effect is frozen on DEVELOPMENT and threaded through every
estimator, control and the matched sample; condition 5 is a four-fold test with intervals; the TAE
floor is absolute; `opponent_rating` is in no model; one side per game; the suffix leakage test
covers the list §5 enforces; the open-choice list has one row; `opp_prev_think_s` is in T0; closed
accounts are excluded; C5 is an implementation check and C5b does the work; C9 reports a ratio with a
preregistered threshold; H2 is narrowed. The remaining defects are all in the *transcription* -- the
place I said a repair applied under time pressure would fail -- and three of them sit on quantities
the verdict reads: `estimands.py` computes Metric B per band and per player as an **uncentred** inner
product where `MODEL_SPEC.md` §4 specifies `cov/var` (the per-player version, which decides condition
6, is dominated by a pace-times-position-type term that is exactly the R1(a) mechanism at player
level); Metrics C and D are **not residualised on T1P** although §4 now names those frozen fits; and
`evaluate.py` lets an **absent or crashed required control pass silently** (an `analysis.json` with no
C5b, no C7 and no C1-C4 returns `EXPERTISE_ADAPTATION_SUPPORTED`). Beside those, `VERDICT_RULES.md`
§2.3 is still not a complement of the other gates (the code is exhaustive only because it makes
`SKILL_ONLY` the catch-all, which is not what §2.3 says), level 3 carries a "monotone enough" term the
code does not implement and which has no preregistered sign, C19 fits a model on the period it is read
from, the player-disjoint restriction is a placeholder that never runs, and the R10 exclusion is
counted in total rather than per band. None of these can produce a *false positive* today -- the
disjoint placeholder actually makes the top verdict unreachable -- but every one of them is a case of
the binding document and the code disagreeing, and the rule the designers wrote is that such a
disagreement is a defect. They are small; the largest is about thirty lines. The documents may not be
hashed until the four document items (N2, N3, N8, N9) are in; engine scoring of DEVELOPMENT may start
once N7 (two lines in `score.py`) is in; no `run.py` output may be read until N1, N4 and N5 are in;
N6 must exist before Gate 2.

## R1-R13: status

| # | Status | What settles it |
|---|---|---|
| R1 | **APPLIED in the documents; PARTIALLY APPLIED in code** | (a) `MODEL_SPEC.md` §4 "Continuous form, with the main effect it needs"; `VERDICT_RULES.md` §1 "TAE gradient" now defines `eV x rating_c` in `eY ~ s(rating) + eV + eV x rating_c`; `analysis.gradient_with_main_effect` builds `[rating_block, x, x*rating_c, 1]`; `analysis.RatingBasis` is constructed once in `run.py` (line 126, DEVELOPMENT) and passed through `analyse_period -> estimate / matching.matched_estimates / controls.run -> _rerun / C8 / strata`. Knot rule matches `models.KNOTS_5` (7 quantile knots). (b) §4 preamble "frozen nuisance, few-parameter re-estimate". (c) §4 Metric B paragraph; `fits["partial_voc"]` (`voc_z ~ T1P`, same penalty as T1P). (d) §4 "`corr(eY, eV | band b)`... not `gamma_b * sd(voc_z) / sd(Y)`". **Code deviation:** `estimands.estimate` computes `tae_by_band`, the condition-5 `spread`, `tae_partial_correlation_by_band` and `metric_a_time_vs_rating` as uncentred `<a,b>/<b,b>` (`analysis.slope`, "already-centred" per its docstring, which is true on DEVELOPMENT only), and `estimands.player_level` computes the per-player `TAE_p` the same way. See N1. |
| R2 | **APPLIED** | `VERDICT_RULES.md` §2.5.5 (matched sample, `T = 0` removed, lowest `clock_pressure` tercile, each with an interval excluding 0); `MODEL_SPEC.md` §4 table of the three routes; `evaluate.py` `h2_tae_matched` (`analysis["matched"]["final"]`), `h2_tae_no_zero_time` (`C17_no_zero_time`), `h2_tae_low_clock_pressure` (`C14_clock_pressure_t0`), all `signed(..., +1)`. `clock_pressure = -log(clock_frac + 0.01)` and `np.digitize` at DEVELOPMENT terciles, so `t0` is the fullest-clock tercile: correct. The matched gradient (`matching.matched_estimates`) uses the frozen basis and CEM weights; its intercept column is unweighted, which I measured as inconsequential (see Recommended 1). |
| R3 | **APPLIED** | `VERDICT_RULES.md` §1 `TAE_FLOOR = 0.02`, absolute, with the reason; `evaluate.TAE_FLOOR = 0.02`; `h2_tae_spread = excludes_zero(spread) and point >= TAE_FLOOR`; `estimands` `tae_spread_low_to_high` is `slope(high band) - slope(low band)` over `powered[0]`, `powered[-1]` with a player-bootstrap interval; `tae_by_band` (hence `TAE(lowest)`) in every table (`make_report` table 09); `test_an_absolute_tae_floor_cannot_be_passed_by_a_near_zero_base`. |
| R4 | **PARTIALLY APPLIED** | (a) §2.2 parenthesised; `evaluate.py` line 197-200 matches. (c) §1 "raw, not shrunk"; `sign_agreement` and `estimands` Spearman read `["point"]` of the raw band table. (d) §1 `ceil`, `MIN_POWERED_BANDS = 5`, `h2_enough_bands`, `h1_band_agreement = band_shape and enough_bands`. (e) §2.5.4 "Metric B, and at least one of Metric A and Metric D"; `evaluate.metric_specs` contains A, B, D only; `test_metric_c_alone_cannot_supply_the_second_metric`. **(b) not finished:** §2.4 no longer requires band shape (the hole I named is closed), but §2.3 `SKILL_ONLY` still has conjunctive conditions ("rating predicts quality_loss ... **and** fewer than two H2 metrics meet §2.5"), so the document still has cases with no gate; the code fires `SKILL_ONLY` as the complement of the other four and never reads `rating_on_quality`. Demonstrated: beta = 0.0005, gain = 0.02, all H2 metrics passing -> document: no gate; code: `SKILL_ONLY`. Same input with `rating_on_quality` containing 0 -> code still `SKILL_ONLY`. The `assert len(fired) == 1` is satisfied by construction, not by enumeration. See N2. Also the doc's condition 4 requires each counted metric to be `monotone enough`, but no per-band Metric A exists in `estimands`, so `evaluate` exempts A (`rho is None -> True`). See N4(iv). |
| R5 | **APPLIED** | `models.T0_NUMERIC` carries `rating_diff`, not `opponent_rating`; `ALL_MODEL_FEATURES` excludes it; `controls` C3 recomputes `rating_diff` after the player-level shuffle; `models.gbt_columns()` and `run.tree_comparator` use `SPECS["T2R"]`; `MODEL_SPEC.md` §1 boxed note; `FEATURE_SCHEMA.md` §7. Stale text survives in `PREREGISTRATION.md` §2 A3 ("opponent rating as a covariate") and A5 ("Opponent rating is a covariate in T0/T1/T2 and in the quality model"), which is now false. See N9. |
| R6 | **APPLIED** | `ingest.Sampler.offer`: when both sides clear the hash, the side with the smaller `unit_hash(SEED, game_id, side)` is kept and `"second side of the same game"` is counted; `DATA_PROTOCOL.md` §4.3; `PREREGISTRATION.md` A10 re-justified with the reason the "Yes" was false. Interaction with the caps and rates: the per-player reservoir cap runs after the one-side rule, so a player's two sides are two games; the rule does make within-band inclusion depend on the *opponent's* band rate (a `q = 1` side is displaced with probability `q_opp / 2`), which skews the `rating_diff` composition in opposite directions at the two extreme bands. `rating_diff` is in T1P, so eY and eV are purged of it; second order, but see Observation 3 and Recommended 5 (the cost pilot on disk predates the rule and must be re-run). |
| R7 | **APPLIED** | `tests/test_suffix_leakage.py`: replaces every move after the decision, every `%clk` from `clk[i]` on, `Termination` and `Result`; asserts `board_features + clock_features` bit-identical, `clock_ms_self/opp`, `opp_prev_think_s`, `own_prev_think_s`, `legal_moves`, `in_check`, `move_uci` unchanged, and that `seconds_taken` **did** move so the fixture cannot prove nothing; both colours parametrised. `PREREGISTRATION.md` §5 item 2 states both perturbations and the exemption for `seconds_taken`/`log_time`. Engine features read only `fen_before`, and the move-swap test covers that path against the real binary. `termination` is written to the row but is in neither `PRE_MOVE` nor any model. |
| R8 | **APPLIED** | `PREREGISTRATION.md` §3: "model-family exploration" and "freezing the final specification" are gone; the one-row open-choice table (ridge penalty, grouped CV, frozen grid, DEVELOPMENT) and "Anything not on it is closed". `models.RIDGE_GRID`, `choose_penalty` (GroupKFold, 5 folds) match. `sklearn` in `.venv-b3` is 1.9.0 as pinned. |
| R9 | **APPLIED** | `clock.opponent_previous_think` (`clk[i-3] - clk[i-1] + inc`, `None` below ply 3); `models.T0_NUMERIC` has `opp_prev_think_s`, `T0_CATEGORICAL` has `opp_prev_think_missing`; `dataset.apply_frozen` imputes the DEVELOPMENT median; `own_prev_think_s` recorded, excluded from every primary spec, used only by `T2R_C19`; `FEATURE_SCHEMA.md` §6; A12. **But the C19 control the repair added fits `T2R_C19` on the period being analysed** (`controls.run`: `dev_like = scored`, i.e. FINAL when FINAL is analysed) and computes a marginal, non-FWL slope. See N5. |
| R10 | **PARTIALLY APPLIED** | `account_status.lookup` (`POST /api/users`, 300 per call), `excluded` (`disabled` or `tosViolation`; unknown counts as *not* excluded and is counted); `score.py` runs it after `finalise()` and before any engine work, records `account_status_lookup_date` and `account_exclusions` in the manifest; `DATA_PROTOCOL.md` §4.6; A11 with the snapshot limitation in both directions. **The count is a single total** (`account_exclusions["closed_or_tos"]`, `sampler.excluded[...] += 1`); `DATA_PROTOCOL.md` §4.6 says "counted per band", and the per-band count is the whole point of the rule (the top-band contrast). See N7. On whether the exclusion itself induces a gradient: see Observation 4. |
| R11 | **APPLIED** | `MODEL_SPEC.md` §9 C5 relabelled "an implementation check"; §9 closing paragraphs corrected; `PREREGISTRATION.md` §8 withdraws the claim; C5b row; `FEATURE_SCHEMA.md` §1 pins the comparator (library, version, hyperparameters, seed); `models.GBT_SPEC` / `fit_gbt` match the pin; `controls` C5b plants `0.02 * ut_gbt` with `ut_gbt = log_time - gbt_predict`; `recovered_fraction = (beta_planted - beta_unplanted) / 0.02`; `evaluate.C5B_RECOVERY_FLOOR = 0.5`. On whether `recovered_fraction` is well defined and whether INVALID is right: see Observation 5 (yes, and yes, with one over-reading to remove -- N9). `evaluate.py` skips the check when C5b is absent: see N4. |
| R12 | **APPLIED** | `MODEL_SPEC.md` §9 C9 (VALIDATION subset, `unit_hash(SEED, "c9", game_id, ply)`, nuisance refitted per budget with the frozen recipe, `r_beta` and `r_TAE` with player-bootstrap intervals, reading fixed); `VERDICT_RULES.md` §2.5c; `rescore.py` (seeded draw, not the first N); `c9.py` (`fit_all` on each budget's subset, common-decision alignment, `PlayerBootstrap`, `favours_difficulty_proxy = upper < 0.5`); `evaluate.py` caps the level at 2 when it fires; `test_c9_budget_reading_caps_the_level`. On estimability at 5,000: estimable, but it detects only attenuation of roughly two-thirds or more -- see Observation 6 and N8. |
| R13 | **APPLIED** | `PREREGISTRATION.md` §1 boxed question narrowed; the recognition-versus-allocation paragraph; §9 adds "allocation skill", "time-management skill", "manages time better", "spends time more wisely", "expertise changes how players manage the process"; `VERDICT_RULES.md` §3 level 4 rewritten and §3.1 added; `evaluate.py` `label_means`. The label is kept for the mission plan and is defined by the narrowed sentence. |

## New required changes

Ordered by how directly each one can put a wrong number under a gate. N1, N4 and N5 are code; N2,
N3, N8 and N9 are document text and must precede the hash; N6 and N7 are code that must exist before
the period they serve is read.

### N1. The few-parameter re-estimates in `estimands.py` are not the ones `MODEL_SPEC.md` §4 specifies
**Where:** `estimands.estimate` (`tae_by_band`, `spread`, `tae_partial_correlation_by_band`,
`metric_a_time_vs_rating`, `allocation_loss_vs_rating`, `extreme_ut_vs_rating`);
`estimands.player_level` (`tae`); `analysis.fit_all`; `make_report.py` player figure.
**Defects.**
(a) **Uncentred where the document says `cov/var`.** §4 defines `gamma_b(P) = cov(eY, eV | b) /
var(eV | b)` and the partial correlation as `corr(eY, eV | b)`. The code computes `<eY, eV> /
<eV, eV>` and `<eY, eV> / sqrt(<eY,eY><eV,eV>)` inside the band. Frozen ridge residuals have mean
zero on DEVELOPMENT as a whole, not within a band and not on another period, so the code's slope
contains `n * mean(eY|b) * mean(eV|b) / <eV,eV>` -- a product of two frozen-model misfits with no
allocation content and no determined sign. Measured on synthetic residuals with the true slope 0.098
in every band: a band misfit of 0.08 log-seconds in `eY` and 0.12 sd in `eV` moves the code's band
slope to 0.084 or 0.107 depending on the signs, i.e. by 0.009-0.013 against `TAE_FLOOR = 0.02`. That
is the condition-5 spread. (b) **The same at player level, where it is larger.** `player_level`
computes `TAE_p = <v, y> / <v, v>` per player. A player's mean `y_resid_T1` is their pace relative to
the frozen model (Metric A predicts it trends with rating) and their mean `voc_resid` is the kind of
positions they reach; with 20-120 decisions per player the product term is of the same order as the
allocation slope itself. Condition 6 then reads a rating trend in `pace x position-type` as a
player-level allocation gradient -- the R1(a) mechanism reintroduced one level down.
(c) **Metrics C and D are not residualised.** §4 step 1 names the frozen fits `allocation_loss ~
T1P` and `extreme_ut ~ T1P`; `fit_all` has neither, and `estimate` regresses the raw (centred)
indicator on `rating_resid`. By FWL that equals the partial coefficient only where `rating_resid` is
orthogonal to the T1P column space -- DEVELOPMENT, approximately -- and not on FINAL, where
condition 4 reads Metric D.
**Minimal repair.** In every band-, player- and matched-level statistic, centre both residual vectors
on the set being estimated before the inner product (equivalently, add an intercept to the
one-parameter re-estimate; `gradient_with_main_effect` already carries one). Add `partial_allocation`
(`allocation_loss ~ T1P`) and `partial_extreme` (`extreme_ut ~ T1P`) to `fit_all` after `ut_q95`
exists (`run.py` computes `ut_q95` after the first `fit_all`, so the two fits must follow it), attach
their residuals in `residualise`, and use them in `estimate`. Add a per-band Metric A table and
Spearman or amend condition 4 (see N4(iv)). `MODEL_SPEC.md` needs no change for (a) and (c): the
document is already right; the code is not.

### N2. `VERDICT_RULES.md` §2.3 is not a complement, and the code's `SKILL_ONLY` is not the document's
**Where:** `VERDICT_RULES.md` §2.3; `evaluate.py` lines 196-212.
**Defect.** R4(b) asked for the remaining cases to be enumerated so that exactly one gate fires. The
document closed the §2.4 hole and left §2.3 conjunctive. Two cases the document does not cover, both
run through `evaluate()`: (i) `beta` fails §2.2's bar, `Q1 - Q0 >= 0.001`, rating predicts quality,
**and all of B, A, D pass** -> no document gate; code prints `SKILL_ONLY`; (ii) the same with
`rating_on_quality` containing 0 -> §2.3's first clause is false; code prints `SKILL_ONLY` because it
never reads `rating_on_quality`. The `assert len(fired) == 1` cannot fail because `SKILL_ONLY` is
defined as `not any(gates.values())`; the assertion is a tautology, not the enumeration R4(b)
required. Case (i) is a live outcome (a Metric B gradient with no H1) and the label `SKILL_ONLY`
would be wrong for it.
**Minimal repair (document, no numeric change).** Write §2.3 as the residual gate: "`SKILL_ONLY`:
none of §2.1, §2.2, §2.4, §2.5 fires. Reported beside it, as facts and not conditions: whether the
rating coefficient on `quality_loss` has an interval excluding 0 with the expected sign, and which H2
metrics met §2.5.4's bar." If the designers want case (i) named, add a verdict
`ADAPTATION_WITHOUT_REGULARITY` for "§2.5.4 met, H1 fails" and give it a level (it is not level 4;
condition 1 fails). Then make `evaluate.py` read `rating_on_quality` and the H2 count into `notes`,
and add cases (i) and (ii) to `test_verdict_rules.py`.

### N3. Level 3's "monotone enough shape" is undefined for `beta` and is not what the code checks
**Where:** `VERDICT_RULES.md` §3 level 3 ("and a `monotone enough` shape"); `evaluate.py` lines
228-231; `estimands.estimate` (`("beta", ..., +1)` in the Spearman loop).
**Defect.** `monotone enough` is defined as "Spearman rho ... at least 0.6 with the preregistered
sign", and no sign is preregistered for `beta` across bands -- level 3 is an *invariance* claim, for
which the natural shape is flat. `estimands` assigns `+1` to it arbitrarily. The code awards level 3
on sign agreement plus a merely *finite* Spearman: an input with 100% sign agreement and
`beta_band_spearman = -0.9` returns `GENERAL_REGULARITY_ONLY, level 3`. So the hashed rule would say
one thing, the code another, on the rule that licenses "cross-rating law-like regularity".
**Minimal repair.** Delete "and a `monotone enough` shape" from level 3 (level 3 = `ceil(80%)` sign
agreement of the raw band `beta` over at least 5 adequately powered bands); report the band Spearman
of `beta` descriptively with no expected sign; remove the `isfinite` clause from `evaluate.py` or
leave it as a data-presence check with that name.

### N4. `evaluate.py` passes inputs the tests never construct
**Where:** `evaluate.py` §2.1 block (lines 73-100) and `metric_specs`.
**Defects, each demonstrated.** (i) An `analysis.json` **without** `C5b_planted_foreign_residual`
and `C7_no_effect_synthetic` returns `EXPERTISE_ADAPTATION_SUPPORTED` with reasons "conditions that
failed: none": C5b is checked only `if recovered is not None`, C7 only `if c7`. (ii) C7 present but
malformed (`{"note": "not computable"}`, the shape `controls.py` writes when a control raises) and
C1-C4 absent -> `EXPERTISE_ADAPTATION_SUPPORTED`. A required control that did not run cannot pass.
(iii) §2.1.7 says censoring "exceeds 15% of **DEVELOPMENT** decisions"; the code reads
`final["censored_voc_share"]`: DEVELOPMENT at 20% and FINAL at 5% is not invalid. (iv) §9 says C3
fails if "every H2 rating gradient" is disturbed and C7 if "every H2 gradient" is non-null; the code
checks `tae_rating_gradient` (and `beta` for C7) only, though `controls.py` writes A, C and D too.
Condition 4 requires each counted metric to be `monotone enough`; Metric A has no band table, so it is
exempt in code.
**Minimal repair.** For every control named in §2.1 (C1-C4, C5, C5b, C6, C7): absent, malformed, or
non-finite interval -> `INVALID_EXPERIMENT` with the control named. Check `voc_regret_censored` on
DEVELOPMENT (the Gate-1 return trigger) and report FINAL's beside it. Check `metric_a_time_vs_rating`
and `extreme_ut_vs_rating` for C3 and C7 as §9 says. Either compute Metric A by band (N1) or amend
§2.5.4 to "Metric B and D monotone enough; Metric A directional" -- one or the other, stated. Add
each case to `test_verdict_rules.py`.

### N5. C19 fits a model on the period it is read from, and its `beta` is not the FWL coefficient
**Where:** `controls.run`, C19 block (`dev_like = scored`; `m.fit_frozen(dev_like, "T2R_C19", ...)`;
`beta = <q_resid, ut> / <ut, ut>`).
**Defect.** `controls.run` is called per period with that period's frame, so on FINAL `T2R_C19` is
fitted on FINAL. `MODEL_SPEC.md` §0: "No period the result is read from is ever a period a model was
fitted on"; `controls.py` docstring: "None of them refits anything". Both false here. The slope
also pairs the frozen Q0 residual with an unpurged residual, so it is a marginal coefficient, not the
"re-estimated `beta`" §9 C19 describes. C19 is reported only, so this cannot change the verdict; it is
a violation of a hashed invariant introduced by a repair, and it is what a later reader will cite.
**Minimal repair.** Fit `T2R_C19`, `Q0_C19` (`quality_loss ~ T2R_C19`) and `partial_ut_C19` in
`fit_all` on DEVELOPMENT; attach `q_resid_c19`, `ut_resid_c19` in `residualise`; C19 `beta` is their
slope with the player bootstrap, centred per N1.

### N6. The player-disjoint restriction and the secondary time control are not implemented
**Where:** `run.py` line 158 (`seen = ... # placeholder, filled below` -- it is not filled;
`analysis["player_disjoint_final"]` is never written); `run.py` `wanted["secondary"]` (the same three
periods; no `300+0` path); `evaluate.py` `player_disjoint_holds` and `secondary_time_control`.
**Defect.** `PREREGISTRATION.md` §3 promises the H1 estimate "twice"; `VERDICT_RULES.md` §2.5 requires
the restriction to satisfy conditions 1 and 5. As the code stands the key is absent, the check fails,
and `EXPERTISE_ADAPTATION_SUPPORTED` is unreachable on any data (demonstrated). Conservative, but a
pipeline that cannot deliver the design's own top verdict is not a transcription of it. Also, the code
checks only `beta` and the pooled gradient of the disjoint set, while §2.5 says "conditions 1 and 5"
(five Metric B quantities).
**Minimal repair.** Before Gate 2: compute the DEVELOPMENT+VALIDATION player-hash set, restrict FINAL,
run `estimate` on the restriction with the frozen basis, write `player_disjoint_final` with `beta`,
`tae_rating_gradient`, and either the three extra condition-5 quantities and the spread or an
amendment to §2.5 saying "conditions 1 and the pooled gradient of 5" -- one or the other. Implement
the `300+0` stage or delete §2.6/level 5 from the hashed rules; a rule with no implementation is
licence.

### N7. The R10 exclusion is counted in total, not per band
**Where:** `score.py` lines 153-168; `DATA_PROTOCOL.md` §4.6 ("excluded and counted per band").
**Repair.** Count `closed_or_tos` and `unknown_to_endpoint` by `side["band"]` (the record carries it)
and write both dictionaries to the manifest. Two lines, before DEVELOPMENT is ingested, since the
usernames are dropped after this step and the count cannot be recovered without re-ingesting.

### N8. State what C9 can detect at n = 5,000
**Where:** `MODEL_SPEC.md` §9 C9; `VERDICT_RULES.md` §2.5c.
**Defect.** The ratio is estimable, but with `beta ~ 0.005`, `sd(q_resid) ~ 0.06`, `sd(ut_resid) ~
0.6`, 5,000 decisions give a per-budget standard error near 0.0014, and with the two budgets' estimates
correlated at roughly 0.8 the 95% interval on `r_beta` spans about `[0.7 r, 1.4 r]`. The trigger
(`upper < 0.5`) therefore fires only for `r` below about 0.35 -- attenuation of two-thirds or more. A
realistic A2 (difficulty measurement improving from depth ~12 to ~14) attenuates by perhaps 10-30% and
is invisible to it. A non-firing C9 will be read as exoneration of A2 unless the document forbids
that reading now.
**Minimal repair (document).** Add to §2.5c: "A C9 that does not fire is not evidence against A2 for
attenuation smaller than the realised interval can exclude; the report must state the attenuation the
interval excludes, computed from its width, beside the ratio." Add "C9 did not fire, therefore
unmeasured difficulty is excluded" to §9's forbidden readings. See Recommended 4 for the cheap fix to
the power itself.

### N9. Text that would be hashed as false or over-reaching
**Where and what.** (i) `PREREGISTRATION.md` §2 A3 "opponent rating as a covariate" and A5 "Opponent
rating is a covariate in T0/T1/T2 and in the quality model" -> `rating_diff`, per R5. (ii)
`PREREGISTRATION.md` §4 "excluded from the 80% agreement rule in VERDICT_RULES.md §4.2" -> there is
no §4.2; cite §1 and §2.5.2. (iii) `MODEL_SPEC.md` §9 rows C14 ("reported, sign agreement counted") and
C17 ("same sign, `beta` interval excludes 0") do not say that `VERDICT_RULES.md` §2.5.5 makes their
Metric B gradient a verdict condition; add it to both rows. (iv) `MODEL_SPEC.md` §9 C5b and
`PREREGISTRATION.md` §8: `recovered_fraction` is "the attenuation factor every reported effect should
be read against" -> it is the attenuation of a signal *shaped like the comparator's residual*, and
`beta` or a Metric B gradient may not be divided by it; say "an attenuation estimate for signals of
that shape, reported beside the effects, never used to rescale them". (v) `MODEL_SPEC.md` §4 step 1
lists five nuisance fits; after N1 the code will have them -- until then the list is aspirational.

## Recommended, not required

1. **Matched-sample intercept.** `matching.matched_estimates` weights `y`, `v` and the spline block
   by `sqrt(w)` but hands `gradient_with_main_effect` an unweighted column of ones. I measured the
   consequence on synthetic CEM-like weights (0.5 vs 4.0 by band): correct WLS 0.0308, the code's form
   0.0308, unchanged under a +0.5 offset. Inconsequential; pass `sw` as the intercept column anyway so
   the estimator is the textbook one.
2. **Centre `beta` too.** §3's `<q_resid, ut_resid> / <ut_resid, ut_resid>` is the document's own
   definition and I am not asking for it to change on my say-so, but the same misfit product enters it
   on FINAL: with mean Q0 residual 0.003 and mean `ut_resid` 0.03 it is ~0.00025, an eighth of
   `BETA_FLOOR`. An intercept in the one-parameter re-estimate costs nothing and the designers should
   decide now, in the document, whether the evaluation-period residuals are centred before the slope.
3. **Fail loudly on a missing basis.** `estimands.estimate` and `matching.matched_estimates` refit
   `RatingBasis` on the evaluation frame when `rating_basis is None`. Every caller passes it today;
   raise instead of refitting, so a future caller cannot fit the main effect on FINAL by omission.
4. **C9 at 20,000 decisions.** Four times the subset halves the interval width and makes 30-40%
   attenuation detectable; at 150k nodes and two searches that is roughly two hours on four workers.
   Also make `rescore.py` assert `period == "validation"` on every row rather than trusting `--from`.
5. **Re-run the cost pilot.** `results/pilot_development.json` was written at 21:02; the one-side rule
   entered `ingest.py` at 21:36. Its per-band supply counts both sides of a game. Re-run (167 s), set
   `q_b` from the post-R6 supply, and write `per_band_targets` and the resulting expected players and
   decisions per band to the manifest, as R4(d) and `VERDICT_RULES.md` §1 require.
6. **One comparator.** `run.tree_comparator` fits a second `HistGradientBoostingRegressor` with
   `random_state=0`; `FEATURE_SCHEMA.md` §1 pins one comparator with seed 20260901. Use
   `models.fit_gbt` in both places. Note for the report that with `early_stopping="auto"` and
   n > 10,000 the pinned tree holds out 10% of DEVELOPMENT, so its DEVELOPMENT residual is 90%
   in-sample; C5b on FINAL (what the verdict reads) is unaffected.
7. **Displacement accounting for R6.** Count "second side of the same game" by (band, opponent band)
   and report the `rating_diff` distribution by band, so the composition effect in Observation 3 is
   visible. If it is material, the uniform alternative is: designate one side per game by hash first,
   then apply that side's `q_b` -- inclusion `q_b / 2` for everyone, at a yield cost the pilot can price.
8. **`tae_pooled` is the slope at 1600**, not "at mean rating" (`rating_c` is centred at a fixed 1600).
   Label it so.
9. **`make_report.player_figure`** plots the raw per-player slope under the name `tae_shrunk`.

## Observations for the report

1. **State of the experiment, precisely.** `data/` is empty and only the cost pilot has been computed,
   but `FAILURES.md` F3-F5 and the addendum show that a DEVELOPMENT *smoke sample* (5,827 sides) was
   ingested and some of it engine-scored, including the post-move search, for implementation checks;
   `AMBIGUITY_TAU` was changed after inspecting its feature distributions (F4, disclosed). No statistic
   relating a feature to an outcome is claimed to have been computed and nothing on disk contradicts
   that. The report should say exactly this rather than "no decision has existed".
2. **What was checked and found sound this time.** The frozen rating basis is built once in `run.py`
   and reaches every estimator, control, stratum and the matched sample; C9 refits it by design. The
   removed-line diff of all five documents shows only the claimed repairs; no threshold moved except
   the two R3/R4 replacements. `test_suffix_leakage` genuinely perturbs `clk[i]` onward, the
   continuation, the termination and the result. `t0` is the lowest-pressure tercile. `ceil`, raw
   estimates, `MIN_POWERED_BANDS = 5`, `TAE_FLOOR = 0.02`, `C5B_RECOVERY_FLOOR = 0.5`,
   `R_BETA_THRESHOLD = 0.5` are literals matching the documents. `sklearn` is 1.9.0. Both leakage
   tests and the determinism test run against the real binary. C3 shuffles whole players and
   recomputes `rating_diff` and `rating_band` consistently.
3. **One side per game and composition.** Under the rule as coded, a side in a `q = 1` band is
   displaced with probability `q_opp / 2`, so the top band is enriched for sides facing opponents in
   lower-`q` or out-of-range bands and the bottom band for the mirror case. This is a sampling skew
   in `rating_diff` that differs by band. It is adjusted linearly and by spline through T1P; residual
   heterogeneity of the allocation slope in `rating_diff` would remain. Report it.
4. **Does the account-status exclusion induce a gradient?** It removes accounts non-randomly, but not
   in the hypothesis's direction: engine-assisted accounts (upper bands) are the ones with anomalously
   steep time-on-VoC slopes, and removing them *lowers* `TAE(highest)`; sandbagging and churn
   concentrate in lower bands and mostly add exposure noise there, so their removal raises low-band
   slopes if anything. The asymmetry that matters is the **lookup lag**: DEVELOPMENT games (February)
   will have had months longer for Lichess to close accounts than FINAL games (June) by the time FINAL
   is ingested after Gate 2, so FINAL's top band is the least cleaned of the three. Record the lag per
   period, report the per-band exclusion rate per period (N7), and if the top-band rate differs
   materially between periods, report condition 5 with the top band dropped, as R10's fallback said.
   The 5.5% measured on the smoke sample is large enough that this table will be read.
5. **C5b's `recovered_fraction` is well defined.** Because Q0 is frozen, planting `0.02 * ut_gbt`
   shifts `beta` by exactly `0.02 * <ut_gbt, ut_resid> / <ut_resid, ut_resid>`, so the fraction is the
   regression slope of the tree residual on the linear residual, which equals one minus the share of
   the linear residual variance the tree additionally explains. It lies in (0, 1] in practice and is
   not a "fraction of every real signal" -- it is the attenuation of a signal of that shape (N9(iv)).
   Making `< 0.5` an `INVALID_EXPERIMENT` trigger is right: it means the linear expected-time model
   misses more than half of what a tree can predict from the same pre-move features, and then
   "unexpected time" is not what the design says it is. The trigger can only remove a verdict, never
   manufacture one. It should be read on FINAL (out of sample), which is what `evaluate.py` does.
6. **C9 is a weak handle and should be presented as one.** See N8 for the arithmetic. `r_TAE` has no
   threshold and is descriptive; say so.
7. **A2 still stands** as the central limitation; nothing in the repairs changes that, and the
   narrowed H2 wording (R13) is the right frame for the report.
8. **`SKILL_ONLY` as a label.** After N2 it is the residual gate; the report must not describe it as
   "rating predicts quality and nothing else does" unless `rating_on_quality` was in fact reported
   with the expected sign.
9. **Two GBTs** exist in the code until Recommended 6 is taken; the report should cite the pinned one.
10. **The cost pilot on disk is pre-R6** (Recommended 5) and must not be cited as the supply table.

## Verdict, stated plainly

`PASS_WITH_REQUIRED_CHANGES`. The design is sound and twelve of thirteen repairs are genuinely in the
documents; the defects above are transcription defects, all small, three of them on verdict quantities
(N1, N4, N6) and four of them in text that is about to be hashed (N2, N3, N8, N9). The five documents
may be hashed and frozen once N2, N3, N8 and N9 are applied and this table is re-read against them
once more (it is short). Engine scoring of DEVELOPMENT may begin once N7 is in `score.py`; no output
of `run.py` may be read until N1, N4 and N5 are in; N6 must exist before Gate 2 is convened. Nothing
here requires a new period, a new feature, a new threshold, or a change to any model family.
