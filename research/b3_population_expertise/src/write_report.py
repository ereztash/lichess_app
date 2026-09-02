"""Generate `REPORT.md` from the analysis, the verdicts and the diagnostics.

Every number in the prose is interpolated from a JSON file in `results/`, so a figure in a sentence
cannot drift from the figure in the data. Where a number comes from a gate review's own independent
reconstruction rather than from this pipeline, the sentence says so.

The prose lives here, next to the numbers it carries, because the two have to be edited together.
Three sets of obligations are hard-wired below and cannot be forgotten:

  * Gate 2's language obligations (amendment A5 (a)-(e)): what may and may not be said about C7b,
    about A2, about C9's interval, about "law-like" at level 3, and about the raw-column C4.
  * Gate 3's interpretation downgrades (F-B1, F-N2, F-N3, F-N4, F-N5, F-O2, F-S1) and its list of
    sentences that are NOT licensed by these results.
  * Amendment A7: both verdicts, the C3 derivation, the drift-offset table, and the three-estimator
    columns, printed wherever the repaired verdict appears.

`FORBIDDEN` at the bottom is checked against the finished text before it is written. A report that
contains one of those strings is not written at all.
"""
from __future__ import annotations

import argparse
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Every phrase the preregistration (§9), Gate 2 (A5) or Gate 3 (§3.6, F-O2) forbids. Checked
# case-insensitively against the finished report.
FORBIDDEN = [
    "law of nature",
    "thinking longer causes",
    "rating causes cognitive efficiency",
    "we can measure intelligence",
    "unexpected time is confusion",
    "measures cognition directly",
    "a2 is bounded",
    "a2 is excluded",
    "allocation skill",
    "manages time better",
    "manage their time better",
    "the attenuation factor for every reported effect",
    "independent readings",
    "survives matching on position difficulty",
    "a null the instrument could have broken",
    "negative result on the headline claim",
    "do not concentrate their seconds",
    # Added after GATE 4. Each is a sentence the audit found in the first draft and ruled out.
    "no response to the clock",
    "does not respond to the resource",
    "does not respond to how much clock",
    "differs systematically with rating",   # VERDICT_RULES 3.1's level-4 definition (F1)
    "only post-holdout change in the study",
]


def iv(x, digits=5, scale=1.0):
    if not isinstance(x, dict) or "point" not in x:
        return "n/a"
    p, lo, hi = x["point"] * scale, x["lo"] * scale, x["hi"] * scale
    return f"{p:+.{digits}f} [{lo:+.{digits}f}, {hi:+.{digits}f}]"


def num(x, digits=5):
    return f"{x:+.{digits}f}"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--analysis", default=os.path.join(ROOT, "results", "analysis_repaired.json"))
    ap.add_argument("--verdict", default=os.path.join(ROOT, "results", "verdict_repaired.json"))
    ap.add_argument("--shipped-verdict", default=os.path.join(ROOT, "results", "verdict.json"))
    ap.add_argument("--diagnostics", default=os.path.join(ROOT, "results",
                                                          "report_diagnostics.json"))
    ap.add_argument("--repair-diff", default=os.path.join(ROOT, "results", "c3_repair_diff.json"))
    ap.add_argument("--c9", default=os.path.join(ROOT, "results", "c9.json"))
    ap.add_argument("--out", default=os.path.join(ROOT, "REPORT.md"))
    args = ap.parse_args()

    A = json.load(open(args.analysis))
    V = json.load(open(args.verdict))
    S = json.load(open(args.shipped_verdict))
    G = json.load(open(args.diagnostics))
    RD = json.load(open(args.repair_diff))

    F, D, Va = A["periods"]["final"], A["periods"]["development"], A["periods"]["validation"]
    CF = A["controls"]["final"]
    MF, PF = A["matched"]["final"], A["player_level"]["final"]
    gf, gd, gv = G["final"], G["development"], G["validation"]
    # The C9 file is the authority: the copy embedded in the analysis was written before the
    # budget-agreement block existed. The estimates in the two are identical.
    c9 = json.load(open(args.c9)) if os.path.exists(args.c9) else A.get("c9", {})
    ba = c9.get("budget_agreement", {})
    sec = A.get("secondary_time_control", {})
    dj = A.get("player_disjoint_final", {})
    mc = A["model_comparison"]["final"]
    ladder = mc["beta_ladder"]
    b = F["beta"]
    c7b = CF["C7b_omitted_difficulty_simulation"]["beta_manufactured"]
    ratio = b["point"] / c7b["point"] if c7b["point"] else float("nan")

    out = []
    w = out.append

    # ================= 1. the answer, and what it is allowed to mean =========================
    w("# B3 -- Population Expertise x Decision Dynamics\n")
    w("**Run label:** *B3, C3 null construction repaired after the holdout (amendment A7).*\n")
    w("```")
    w(f"MECHANICAL VERDICT, AS THE CODE SHIPPED:  {S['verdict']}")
    w(f"VERDICT AFTER THE PINNED C3 REPAIR:       {V['verdict']}")
    w(f"SCIENTIFIC LEVEL:                         {V['level']} after the repair; none as shipped")
    w("SECONDARY TIME CONTROL:                   not evaluable (see section 9)")
    w("```\n")
    w("Both verdicts are the output of `evaluate.py`, run unmodified, on the same estimates. The "
      "only difference between them is the construction of one destructive control's null, which "
      "the Gate 3 adversary derived analytically, predicted to Monte-Carlo precision on all three "
      "periods, and repaired in one line. The repair changed no estimate, and the seven failed "
      "conditions of the strongest verdict are identical before and after it. Section 2 is that "
      "story in full; nothing in this report rests on the reader taking it on trust.\n")
    # GATE 4 F1. `evaluate.py` writes `label_means` unconditionally and its text is the
    # VERDICT_RULES.md 3.1 definition of EXPERTISE_ADAPTATION_SUPPORTED -- the H2 proposition this
    # study did not support. It may not be printed as the meaning of GENERAL_REGULARITY_ONLY.
    w("**What the repaired verdict label means.** `GENERAL_REGULARITY_ONLY`: H1 holds on FINAL "
      "(`beta` > 0, interval excluding 0, above `BETA_FLOOR`) and the conditions of "
      "`VERDICT_RULES.md` §2.5 were not all met. It asserts nothing about whether the time / "
      "value-of-computation relation varies with rating. The sentence in §3.1 defines what "
      "`EXPERTISE_ADAPTATION_SUPPORTED` would have meant; that verdict was not reached, and the "
      "mechanical verdict as shipped is `INVALID_EXPERIMENT`.\n")
    w("---\n")

    # ---- the paragraph -------------------------------------------------------------------
    w("## 1. The one-paragraph answer\n")
    w(f"Across {F['n_decisions']:,} natural blitz decisions by {F['n_players']:,} independent "
      f"players rated {F['rating_range'][0]}-{F['rating_range'][1]}, a decision that took unusually "
      f"long **for that position, that clock state and that skill level** predicts a worse move: "
      f"`beta` = {iv(b)} of win probability per unit of `log(1 + seconds)`. It holds in "
      f"{V['band_sign_agreement']['agree']} of {V['band_sign_agreement']['of']} adequately powered "
      f"rating bands, in every stratum of phase, standing and clock pressure, within a single "
      f"player's own decisions and within a single game, and it is reproduced out of sample in "
      f"the two later months (three periods in all, the first being the period every nuisance "
      f"model was fitted on). Its interpretation is narrower than it looks: about three quarters of "
      f"it is carried by outright blunders, and about a seventh of it is present even on the "
      f"decisions where the player found the engine's own move. Section 4 is that decomposition.\n")
    w(f"The expertise claim the study was built to test was not supported. Time Allocation "
      f"Efficiency -- whether stronger players put their extra seconds where further calculation "
      f"changes the preferred move -- shows a rating gradient of {iv(F['tae_rating_gradient'])} per "
      f"100 Elo, an interval on zero. **That is a null of the preregistered instrument, and this "
      f"report does not read it as a fact about players.** The instrument has a "
      f"{gf['zero_regret_share']:.1%} point mass at zero, a partial correlation with residual "
      f"thinking time of {gf['tae_partial_correlation']:.3f}, no detectable response to the clock, "
      f"and a "
      f"construction under which a live positive gradient would have produced this same reading. "
      f"Section 5 is that analysis, and it is the most important section in the report.\n")
    w("---\n")

    # ================= 2. the repair =========================================================
    w("## 2. The control that failed, and why the verdict was recomputed\n")
    w("A study that repairs a control after seeing the holdout owes the reader the whole "
      "derivation, not a summary. This is it.\n")
    w("**What the shipped control computed.** C3 permutes each player's rating across players and "
      "asks whether the rating-dependent metrics survive. It formed the permuted regressor as "
      "`perm_rating - ratinghat`, where `ratinghat` is the DEVELOPMENT-frozen ridge prediction of "
      "rating from the difficulty features.\n")
    w("**Why that carries a deterministic term.** With `cov` and `var` over rows, "
      "`slope(y, perm - h) = [cov(y, perm) - cov(y, h)] / var(perm - h)`. A uniform permutation of "
      "player ratings gives `E[perm_i] = R_bar` for every row, so `E[cov(y, perm)] = 0` and "
      "`E[cov(perm, h)] = 0` exactly. What survives in expectation is not zero:\n")
    w("```")
    w("E[C3 -> Metric A]  ~=  -100 x cov(y_resid, ratinghat) / [ var(rating) + var(ratinghat) ]")
    w("```")
    w("`cov(y_resid, ratinghat)` vanishes only where the residual is orthogonal to the feature "
      "column space -- that is, on the period the model was fitted on. On any later period the "
      "frozen fit's misfit has a component along `ratinghat`, and the null inherits it.\n")
    w("**The prediction, against the shipped numbers.** Deterministic seeds, 200 permutations:\n")
    w("| period | shipped null | predicted by the formula | MC SE | `cov(ratinghat, rating_resid)` |")
    w("|---|---|---|---|---|")
    w("| DEVELOPMENT | +0.000025 (sd 0.000439) | -0.000001 | 0.000031 | +130 |")
    w("| VALIDATION | -0.000157 (sd 0.000491) | -0.000138 | 0.000035 | -1,403 |")
    w("| **FINAL** | **-0.001145** (sd 0.000457, 2.51 null SDs) | **-0.001094** | 0.000032 | **-5,311** |")
    w("")
    w("The last column is the freeze made visible. On DEVELOPMENT the frozen partial of rating is "
      "orthogonal to its own residual; four months later it is not.\n")
    w("**The repair, in full.** One line: \"one construction, no variants\", \"pinned by the "
      "adversary, not chosen by the researchers\" (Gate 3 §1.6, §1.9), applied to all three "
      "slope-based C3 fields whether or not each had failed:\n")
    w("```python")
    w("# controls.py, C3 block")
    w("perm_resid = perm_rating          # was: perm_rating - ratinghat")
    w("```")
    w("`slope()` centres, so each frozen residual is now regressed on the permuted rating minus its "
      "mean: the partial of `perm_rating` under the null, where `ratinghat(x)` is the partial of "
      "the *real* rating, not of the permuted one. It is the same principle as the pre-holdout C4 "
      "repair. Every block of the analysis outside C3 is byte-identical before and after "
      f"(sha256 `{A['_repair']['everything_else_sha256'][:16]}...`), the shipped C3 block is "
      "retained beside the repaired one, and `evaluate.py` was run unmodified on both.\n")
    w("**The diff.**\n")
    w("| FINAL null | as shipped | repaired |")
    w("|---|---|---|")
    for field, label in (("metric_a_time_vs_rating", "C3 -> Metric A"),
                         ("extreme_ut_vs_rating", "C3 -> Metric D"),
                         ("allocation_loss_vs_rating", "C3 -> Metric C"),
                         ("tae_rating_gradient", "C3 -> Metric B (untouched)")):
        cell = RD["final"][field]
        w(f"| {label} | {iv(cell['shipped'], 6)} | {iv(cell['repaired'], 6)} |")
    w("")
    w("**What the repair is not.** It does not touch `beta`, which C3 never tested. It does not "
      "serve the expertise hypothesis, which fails identically before and after -- the same seven "
      "conditions, the same intervals. It is not a choice among variants: the construction was "
      "pinned in the review, in advance, with the results of applying it stated there. And the "
      "corrected estimate is *not* substituted for the reported one: Metric A's verdict value "
      "remains the frozen one.\n")
    w("**The corrected explanation.** The Gate 3 packet attributed the offset to permuting over "
      "players rather than over rows. That was wrong and is withdrawn here. The mechanism is the "
      "**denominator**: the packet's diagnostic quantity divides by `var(ratinghat)` where the null "
      "divides by `var(rating) + var(ratinghat)`, and the ratio 61,676 / 298,552 = 0.207 on FINAL "
      "is the discrepancy the packet could not explain. The same dilution explains the raw-column "
      "C4 null; one mechanism, two controls.\n")
    w("**The drift is in the controls, not in the estimates.** Each headline quantity under three "
      "estimators on FINAL -- the frozen one this study reports, a three-parameter regression that "
      "lets the frozen predictions carry their own coefficients, and the whole recipe refitted on "
      "FINAL itself:\n")
    w("| quantity | frozen (reported) | three-parameter | refit on FINAL |")
    w("|---|---|---|---|")
    rf = gf.get("refit_on_this_period", {})
    w(f"| `beta` | {num(gf['beta_frozen'])} | {num(gf['beta_3param'])} | "
      f"{num(rf.get('beta', float('nan')))} |")
    w(f"| Metric A | {num(gf['metric_a_frozen'])} | {num(gf['metric_a_3param'])} | "
      f"{num(rf.get('metric_a', float('nan')))} |")
    w(f"| Metric B gradient | {num(F['tae_rating_gradient']['point'])} | -- | "
      f"{num(rf.get('tae_rating_gradient', float('nan')))} |")
    w("")
    w("The estimator shares the null's ingredient and cancels it, because its regressor is "
      "`rating - ratinghat` with the two correlated; the null's `perm_rating` is uncorrelated with "
      "`ratinghat` and nothing cancels. That is why the control moved 2.5 null SDs while the "
      "estimate it guards moved about 2%.\n")
    w("**The miss this report is required to record**, in the reviewer's own words:\n")
    w("> The class was characterised before the holdout was opened: the Gate 2 review derived C1's "
      "null as `-slope(Qhat0, ut_resid)`, called it 'the fingerprint of the freeze', and stated "
      "that the amended rule 'can only fail when the estimator's bias under the null exceeds about "
      "two null SDs'. C3's Metric A null on FINAL is that prediction realised at 2.5. That the same "
      "reviewer -- me -- endorsed the C3 construction in the same document without applying the "
      "derivation to it is a miss the report must record, not a reason to fail the study for it.\n")
    w("---\n")

    # ================= 3. dataset ============================================================
    w("## 3. Dataset\n")
    w("| | DEVELOPMENT 2026-02-01 | VALIDATION 2026-04-01 | **FINAL 2026-06-01** |")
    w("|---|---|---|---|")
    for label, key, fmt in [("decisions", "n_decisions", "{:,}"), ("players", "n_players", "{:,}"),
                            ("games", "n_games", "{:,}"),
                            ("mean quality loss", "mean_quality_loss", "{:.4f}"),
                            ("median seconds", "median_seconds", "{:.0f}"),
                            ("accurate rate", "accurate_rate", "{:.3f}"),
                            ("VoC censoring", "censored_voc_share", "{:.1%}"),
                            ("`T = 0` share", "zero_time_share", "{:.1%}")]:
        w(f"| {label} | {fmt.format(D[key])} | {fmt.format(Va[key])} | {fmt.format(F[key])} |")
    w(f"| adequately powered bands | {len(D['powered_bands'])}/9 | {len(Va['powered_bands'])}/9 | "
      f"{len(F['powered_bands'])}/9 |")
    w("\nRated Standard `180+0` on lichess.org, one analysed side per game, at most two games per "
      "player, rating at game time, three non-overlapping calendar days. Every exclusion is counted "
      "in `results/tables/04_exclusions.csv`; the FINAL period was sealed before it was opened and "
      "the seal is in `results/FINAL_HOLDOUT_SEALED.json`.\n")
    w("---\n")

    # ================= 4. H1 ==================================================================
    w("## 4. The main regularity, and what carries it\n")
    w("| | DEVELOPMENT | VALIDATION | **FINAL** |")
    w("|---|---|---|---|")
    w(f"| `beta` | {iv(D['beta'])} | {iv(Va['beta'])} | **{iv(b)}** |")
    w(f"| band sign agreement | {D['beta_sign_agreement']:.0%} | {Va['beta_sign_agreement']:.0%} | "
      f"{F['beta_sign_agreement']:.0%} |")
    w(f"| `beta` x rating, per 100 Elo | {iv(D['beta_rating_interaction'])} | "
      f"{iv(Va['beta_rating_interaction'])} | {iv(F['beta_rating_interaction'])} |")
    w(f"| recomputed inside coarsened cells | {iv(A['matched']['development']['beta'])} | "
      f"{iv(A['matched']['validation']['beta'])} | {iv(MF['beta'])} |")
    w(f"| top band dropped | {iv(D['beta_excluding_top_band'])} | "
      f"{iv(Va['beta_excluding_top_band'])} | {iv(F['beta_excluding_top_band'])} |")
    w(f"| Q1 - Q0 held-out R2 | {A['model_comparison']['development']['q1_minus_q0_r2']:.5f} | "
      f"{A['model_comparison']['validation']['q1_minus_q0_r2']:.5f} | {mc['q1_minus_q0_r2']:.5f} |")
    w("")
    w("### 4.1 Where the regularity lives\n")
    w(f"Centring both residuals **within a player**, `beta` is {num(gf['beta_within_player'])}; "
      f"**within a game**, {num(gf['beta_within_game'])}; the slope of player means against each "
      f"other -- the purely between-player part -- is {num(gf['beta_between_players'])} (point "
      f"estimates; no interval was computed for the within-player and within-game forms). The "
      f"association is inside a single player's own decisions, so \"slower players are weaker "
      f"players\" does not account for it.\n")
    w("### 4.2 It is a blunder regularity\n")
    w("The outcome is unbounded above at the top of the loss scale, and that is where the "
      "association is concentrated. `beta` with the outcome capped, regressed on the same frozen "
      "time residual:\n")
    w("| outcome capped at | DEVELOPMENT | VALIDATION | **FINAL** |")
    w("|---|---|---|---|")
    for cap in ("0.05", "0.1", "0.2", "0.5"):
        key = f"beta_capped_{cap}"
        if key in gf:
            w(f"| {cap} | {num(gd[key])} | {num(gv[key])} | **{num(gf[key])}** |")
    w(f"| uncapped | {num(gd['beta_frozen'])} | {num(gv['beta_frozen'])} | "
      f"**{num(gf['beta_frozen'])}** |")
    w("")
    w(f"Losses above 0.05 -- about twice the accuracy threshold -- carry roughly three quarters of "
      f"`beta`, and losses above 0.1, which are {gf['share_loss_above_0.1']:.1%} of decisions, "
      f"carry about half. The two extreme deciles of unexpected time supply "
      f"{gf['numerator_share_extreme_ut_deciles']:.0%} of the numerator. **The licensed sentence "
      f"is that unusually long thinks predict blunders**, not that they predict a uniformly worse "
      f"move; the mean is a mean over a tail.\n")
    w("### 4.3 A seventh of it is present when the engine's own move was played\n")
    w(f"On the {gf['share_played_engine_best']:.1%} of decisions where the played move is the "
      f"pre-move search's first line, `beta` is {iv(gf['beta_when_engine_move_played'])}; on the "
      f"rest, {iv(gf['beta_when_engine_move_not_played'])}. When the played move *is* the engine's "
      f"best, the measured loss is depth asymmetry between two searches and carries nothing about "
      f"the human's choice, so a positive slope there is engine noise that grows with residual "
      f"position sharpness. It is unmeasured, engine-measurable difficulty seen directly, in the "
      f"one place the design can see it. The rate of finding the engine's move falls from "
      f"{gf['engine_best_rate_fastest_ut_decile']:.2f} in the fastest decile of unexpected time to "
      f"{gf['engine_best_rate_slowest_ut_decile']:.2f} in the slowest; holding that indicator "
      f"fixed, `beta` is {num(gf['beta_holding_engine_best_fixed'])}. This is a diagnostic on a "
      f"post-move variable and cannot enter the primary specification.\n")
    w("### 4.4 The variation across standings is the outcome's scale, not behaviour\n")
    w("| standing | `beta` | sd of the quality residual | ratio |")
    w("|---|---|---|---|")
    for label in ("winning", "level", "losing"):
        cell = gf["beta_by_standing"].get(label)
        if cell:
            w(f"| {label} | {num(cell['beta'])} | {cell['sd_q_resid']:.3f} | {cell['ratio']:.2f} |")
    w("")
    w("`quality_loss` is bounded by the win probability before the move, so a unit of win "
      "probability is not one unit across standings. \"The association is strongest when winning\" "
      "is a statement about the scale, and this report does not make it as a behavioural claim.\n")
    w(f"**Practical magnitude.** Mean quality loss on FINAL is {F['mean_quality_loss']:.4f} win "
      f"probability. A decision whose `1 + seconds` is e times what the model expects -- about "
      f"4.4 seconds where it expected 1 -- is associated with {b['point']:.4f} more, about "
      f"{100 * b['point'] / F['mean_quality_loss']:.0f}% of a typical error, concentrated as 4.2 "
      f"describes. It is an adjusted association in an observational sample.\n")
    w("---\n")

    # ================= 5. H2 ==================================================================
    w("## 5. The expertise results\n")
    w("| Metric | expected | DEVELOPMENT | VALIDATION | **FINAL** | counts? |")
    w("|---|---|---|---|---|---|")
    for label, key, sign, counts in [
        ("A: matched-difficulty time, per 100 Elo", "metric_a_time_vs_rating", "negative",
         "yes, directional only"),
        ("**B: time allocation efficiency**", "tae_rating_gradient", "positive", "**required**"),
        ("C: allocation loss", "allocation_loss_vs_rating", "negative", "no, a transform of B"),
        ("D: extreme unexpected-time exposure", "extreme_ut_vs_rating", "negative", "yes"),
    ]:
        w(f"| {label} | {sign} | {iv(D[key])} | {iv(Va[key])} | {iv(F[key])} | {counts} |")
    w(f"| B: spread, lowest to highest band | >= 0.02 | {iv(D['tae_spread_low_to_high'])} | "
      f"{iv(Va['tae_spread_low_to_high'])} | {iv(F['tae_spread_low_to_high'])} | required |")
    w(f"| B: inside coarsened cells | positive | "
      f"{iv(A['matched']['development']['tae_rating_gradient'])} | "
      f"{iv(A['matched']['validation']['tae_rating_gradient'])} | {iv(MF['tae_rating_gradient'])} | "
      f"required |")
    w(f"| B: per player | positive | "
      f"{iv(A['player_level']['development']['tae_vs_rating_per_100elo'])} | "
      f"{iv(A['player_level']['validation']['tae_vs_rating_per_100elo'])} | "
      f"{iv(PF.get('tae_vs_rating_per_100elo', {}))} | required |")
    w(f"| B: top band dropped | positive | {iv(D['tae_rating_gradient_excluding_top_band'])} | "
      f"{iv(Va['tae_rating_gradient_excluding_top_band'])} | "
      f"{iv(F['tae_rating_gradient_excluding_top_band'])} | reported |")
    w("")
    w("### 5.1 Metric A holds, with its own qualification\n")
    w(f"Stronger players take less time on positions matched for measured difficulty: "
      f"{iv(F['metric_a_time_vs_rating'])} log-seconds per 100 Elo. Two qualifications travel with "
      f"it. First, {F['zero_time_share']:.1%} of FINAL decisions have `T = 0` -- under a second on "
      f"a whole-second clock, which includes premoves, decided on the previous position, in a share "
      f"the dump does not record -- and that share rises from "
      f"{gf['zero_time_share_by_band']['800-999']:.1%} in the lowest band to "
      f"{gf['zero_time_share_by_band']['2400-2599']:.1%} in the highest. Remove those rows and "
      f"Metric A is {num(gf['metric_a_no_zero_time'])}: two fifths of the metric rests on them. "
      f"Second, Metric A is a directional check only; it was never a sufficient condition for "
      f"anything, and it is not evidence about allocation.\n")
    w("### 5.2 Metric B: what the instrument is\n")
    w("This is the primary metric and it returned a null. Before reading the null, the instrument "
      "has to be described, because its properties determine what a null can mean.\n")
    w(f"* **A point mass.** `voc_regret` is exactly zero on {gf['zero_regret_share']:.1%} of "
      f"decisions: the engine's shallow first choice is also its deep first choice, so there is "
      f"nothing to gain from further calculation, by construction. On those rows the standardised "
      f"value is the constant {gf['voc_z_on_zero_rows']:.3f}, the frozen residual has standard "
      f"deviation {gf['sd_voc_resid_zero_rows']:.3f} against "
      f"{gf['sd_voc_resid_other_rows']:.3f} elsewhere, and they still supply "
      f"{gf['regressor_ss_share_zero_rows']:.1%} of the regressor's sum of squares.")
    w(f"* **A weak base relation.** The pooled slope of residual thinking time on value of "
      f"computation is {iv(gf['tae_pooled_slope'], 4)} log-seconds per DEVELOPMENT standard "
      f"deviation -- a partial correlation of {gf['tae_partial_correlation']:.4f}. The slope on the "
      f"bare indicator `regret > 0` is {num(gf['ey_on_regret_positive_indicator'], 4)} and on "
      f"`voc_switch` {num(gf['ey_on_voc_switch'], 4)}: to within noise, the whole signal is "
      f"\"the engine changed its mind between the shallow and the deep search, and the human spent "
      f"about one percent longer\".")
    tercile = gf.get("tae_pooled_by_clock_tercile", {})
    order = ("fullest", "middle", "emptiest")
    if tercile:
        # GATE 4 F3. The FINAL intervals each hide a doubling and the point ordering differs on
        # every period, so the licensed statement is "undetectable", not "does not respond".
        def terciles(block):
            return ", ".join(f"{block[k]['point']:+.4f}" for k in order if k in block)

        others = "; ".join(
            f"{name} ({terciles(block)})"
            for name, block in (("DEVELOPMENT", gd.get("tae_pooled_by_clock_tercile", {})),
                                ("VALIDATION", gv.get("tae_pooled_by_clock_tercile", {})))
            if block)
        w(f"* **Its response to the resource is undetectable.** An allocation instrument should "
          f"react to how much clock is left. On FINAL the pooled relation by clock tercile is "
          + ", ".join(f"{iv(tercile[k], 4)} ({k})" for k in order if k in tercile)
          + f": not detectably different, but each interval is wide enough to hide a doubling, and "
            f"the point ordering differs by period -- {others}, against fullest, middle, emptiest. "
            f"The design cannot tell whether the instrument responds to the clock.")
    w(f"* **Reliability.** Across engine budgets on the C9 subset, the residual instrument "
      f"correlates {ba.get('corr_voc_resid', float('nan')):.2f} and raw regret "
      f"{ba.get('corr_voc_regret', float('nan')):.2f}. Its validity against anything a human "
      f"perceives is unmeasured; no such measurement exists in this design.\n")
    w("A null from an instrument with these properties is a null of the instrument. It is not a "
      "measurement of what players do.\n")
    w("### 5.3 The gradient is a cancellation of two opposite components\n")
    w(f"On a zero-regret row the standardised value is a constant, so the preregistered regressor "
      f"is exactly *minus the position-predicted* value of computation. On "
      f"{gf['zero_regret_share']:.0%} of rows, therefore, Metric B is reading a different quantity "
      f"with its sign flipped -- and that quantity carries a large, replicated rating-dependent "
      f"structure.\n")
    w("| gradient per 100 Elo | DEVELOPMENT | VALIDATION | **FINAL** |")
    w("|---|---|---|---|")
    for label, key in (("residual time on **predicted** VoC x rating, all rows",
                        "ey_on_predicted_voc_x_rating"),
                       ("Metric B gradient, zero-regret rows", "tae_gradient_zero_regret_rows"),
                       ("residual time on **minus predicted** VoC x rating, zero-regret rows",
                        "ey_on_minus_predicted_voc_x_rating_zero_rows"),
                       ("Metric B gradient, rows where the regressor varies",
                        "tae_gradient_varying_rows"),
                       ("Metric B gradient, all rows (**the preregistered estimand**)",
                        "tae_gradient_all_rows"),
                       ("residual time on **raw** VoC x rating", "ey_on_raw_voc_x_rating")):
        # One row is a point identity, not an estimate: it has no interval, and printing "n/a"
        # for it would hide the very thing it is in the table to let the reader check.
        cell = lambda blk: (iv(blk[key], 5) if isinstance(blk[key], dict)  # noqa: E731
                            else f"{blk[key]:+.5f} (point identity)")
        w(f"| {label} | {cell(gd)} | {cell(gv)} | {cell(gf)} |")
    w("")
    w("The second and third rows are equal to the digit, which is the algebra: on those rows the "
      "preregistered regressor *is* minus the predicted value, so the metric reads that channel "
      "backwards. The first row is the same channel measured over all rows. The preregistered estimand is a mixture of a large replicated "
      "negative component that says nothing about how a player responds to residual value of "
      "computation -- there is no residual value of computation on those rows -- and a small "
      "positive component on the rows where the regressor actually varies.\n")
    w("**Two things follow, and only two.** First, the composite could not have shown the "
      "rows-with-variation gradient whatever it was, so the null does not license a claim about "
      "players. Second, the positive first row is **not** support for the hypothesis: it is not a "
      "preregistered estimand, and it is confounded by construction -- a player who merely "
      "*recognises* that a position is sharp produces it exactly as a player who *allocates* better "
      "does, and predicted value of computation loads on clock and phase features whose handling "
      "may itself vary with rating. It is recorded as the lead for the next experiment and as "
      "nothing else.\n")
    w("### 5.4 The floor, and the spread the design could actually detect\n")
    w(f"`TAE_FLOOR = 0.02` was fixed at Gate 1 as a fraction of the gradient the planted-signal "
      f"control injects, before any data existed. The instrument's entire pooled signal is "
      f"{gf['tae_pooled_slope']['point']:.4f}, so the spread condition asked the top band to exceed "
      f"the bottom by about twice everything the instrument measures. The FINAL gradient's "
      f"bootstrap standard error is {gf['tae_gradient_se_per_100elo']:.5f} per 100 Elo, which puts "
      f"the smallest spread detectable at 80% power at "
      f"{gf['tae_spread_detectable_at_80pct_power']:.3f} -- above the floor itself. The observed "
      f"spread is {iv(V['tae_spread'], 4)}.\n")
    w("The spread condition was therefore unreachable by any plausible real gradient. **Its failure "
      "is a fact about the design, and this report does not present it as a finding about "
      "players.**\n")
    w("### 5.5 The matched form of the condition was structurally negative\n")
    mdiag = gf.get("matched", {})
    if mdiag and "retained_share" in mdiag:
        w(f"Coarsened exact matching retains {mdiag['retained_share']:.0%} of decisions, and its "
          f"cells include the value-of-computation tercile -- so it selects the point mass. The "
          f"matched sample is {mdiag['zero_regret_share_matched']:.1%} zero-regret against "
          f"{mdiag['zero_regret_share_full']:.1%} overall, "
          f"{mdiag['opening_share_matched']:.0%} opening against "
          f"{mdiag['opening_share_full']:.0%}, and {mdiag['book_share_matched']:.1%} book against "
          f"{mdiag['book_share_full']:.1%}. Inside it the zero rows give "
          f"{num(mdiag['gradient_zero_regret_rows'])} and the rows with variation "
          f"{num(mdiag['gradient_varying_rows'])}; the weights are not the cause (unweighted "
          f"{num(mdiag['gradient_unweighted'])}, largest weight {mdiag['max_weight']:.2f}).\n")
    bal = A["matched"]["final"]["balance"]["balance_lowest_vs_highest_band"]
    w("Balance between the extreme bands moved the **wrong way** on the variables that matter:\n")
    w("| variable | SMD before | SMD after |")
    w("|---|---|---|")
    for key in ("voc_z", "gap12", "eval_volatility", "ambiguity_entropy", "clock_pressure", "ply"):
        if key in bal:
            w(f"| `{key}` | {bal[key]['smd_before']:+.3f} | {bal[key]['smd_after']:+.3f} |")
    w("")
    w("So the matched clause of the strongest verdict could not have been met by any allocation "
      "behaviour, and the matched value of `beta` in section 4 is reported as \"recomputed inside "
      "coarsened cells\" rather than as a difficulty control. And the pooled, `T = 0`-removed, "
      "low-clock-pressure and player-level clauses are **one instrument read four ways on "
      "overlapping rows**, plus the degenerate matched form -- not five independent tests.\n")
    w("### 5.6 What the null does and does not license\n")
    w("**Licensed.** The preregistered Time Allocation Efficiency gradient is not detectably "
      "different from zero on FINAL, in any of its readings; the strongest verdict of H2 was not "
      "reached; and the instrument's construction, floor and power are such that a rating gradient "
      "of the size a real allocation difference would produce would also have returned this "
      "result.\n")
    w("**Not licensed.** That the gradient is absent in the world. That this is a negative finding "
      "about how strong players use their time. That the instrument had a fair chance and took it. "
      "That the un-preregistered positive gradients in 5.3 support the hypothesis. The repaired "
      "verdict label is correct because it asserts only that the conditions were not met.\n")
    w("---\n")

    # ================= 6. controls ===========================================================
    w("## 6. Controls\n")
    w("Every destructive control is a permutation test over 200 draws; the interval is the "
      "2.5/97.5 percentile **across permutations**, and each null's distance from zero is given in "
      "units of its own standard deviation.\n")
    w("| Control | FINAL | null SDs from 0 | passes |")
    w("|---|---|---|---|")
    for key, field, label in [
        ("C1_shuffled_quality", "beta", "C1 quality permuted"),
        ("C2_shuffled_time", "beta", "C2 thinking time permuted"),
        ("C3_shuffled_rating", "tae_rating_gradient", "C3 rating permuted -> Metric B"),
        ("C3_shuffled_rating", "metric_a_time_vs_rating", "C3 -> Metric A (repaired)"),
        ("C3_shuffled_rating", "extreme_ut_vs_rating", "C3 -> Metric D (repaired)"),
        ("C4_shuffled_voc", "tae_rating_gradient", "C4 value of computation permuted"),
        ("C7_no_effect_synthetic", "beta", "C7 nothing planted -> beta"),
        ("C7_no_effect_synthetic", "tae_rating_gradient", "C7 -> Metric B"),
    ]:
        cell = CF[key][field]
        ok = cell["lo"] <= 0 <= cell["hi"]
        w(f"| {label} | {iv(cell)} | {cell.get('sd_units_from_zero', float('nan')):.1f} | "
          f"{'yes' if ok else '**NO**'} |")
    w(f"| C5 implementation check (unplanted + 0.02) | {iv(CF['C5_planted_regularity']['beta'])} | "
      f"-- | recovered |")
    w(f"| C5b recovers a foreign signal (floor 0.5) | "
      f"{CF['C5b_planted_foreign_residual']['recovered_fraction']:.3f} | -- | yes |")
    w(f"| C6 planted gradient, pooled (planted 0.00278) | "
      f"{iv(CF['C6_planted_expertise']['tae_rating_gradient'])} | -- | recovered |")
    w(f"| C6 through the player-level estimator | "
      f"{iv(CF['C6_planted_expertise']['player_level_gradient'])} | -- | recovered |")
    c8 = CF["C8_player_influence"]
    w(f"| C8 drop the busiest 1% of players | {iv(c8['beta_without_busiest_1pct'])} | -- | "
      f"{c8['relative_change']:.2%} change |")
    w(f"| C8 largest single-player influence | {c8['max_single_player_relative_shift']:.2%} | -- | "
      f"limit 20% |")
    w("")
    w("### 6.1 What a passing destructive control is evidence of\n")
    w("After the C3 repair, **every destructive null in this study is a code check**. With the "
      "outcome generated from the frozen prediction plus independent noise, or with the regressor "
      "the estimator uses permuted, zero is what linear algebra requires; these controls can fail "
      "only on a defect in the code that computes them. That they pass means the arithmetic is "
      "intact. It is not independent evidence that any estimate is causal, and this report does not "
      "read it as such. The controls that could still have failed for a scientific reason are C5b, "
      "C6, C8 and C9.\n")
    w("### 6.2 C6, precisely\n")
    w("C6 rebuilds thinking time with a rating gradient planted **in the instrument's own units**, "
      "at five to ten times the level the instrument actually measures, and requires the pipeline "
      "to recover it. It does: through the pooled estimator and through the per-player estimator "
      "the verdict reads. What that demonstrates is that the estimator's algebra works at that "
      "scale. It does not demonstrate that a realistic gradient would have been detected -- section "
      "5.4 gives the size that would have been -- and because the signal is planted in the "
      "instrument's units it is silent on whether the instrument measures allocation at all.\n")
    w("### 6.3 The FINAL nulls' offsets from zero, as shipped\n")
    w("The frozen models were fitted in February and applied in June. Their misfit shows up in the "
      "C3 nulls as an offset from zero that grows from April to June (Metric A 0.32 -> 2.51 null "
      "SDs; Metric C 0.50 -> 1.52; Metric D 0.18 -> 0.84), and the \"contains zero\" pass rule "
      "tolerates it up to about two null standard deviations. The C1 and C2 offsets are of similar "
      "size on both periods (C1 -0.00044 in April, +0.00031 in June; C2 -0.00022, -0.00026). The "
      "raw-column C4 value is in the table for completeness but is not drift: it is -0.00115 "
      "(3.3 null SDs) on DEVELOPMENT itself, the deterministic recognition-channel term of section "
      "5.3 diluted by the permutation variance. The C3 -> Metric B, pass-condition C4 and C7 nulls "
      "sit within 0.1 null SD of zero on FINAL. As shipped:\n")
    w("| control | FINAL null | offset (null SDs) |")
    w("|---|---|---|")
    w("| C1 (destroyed outcome, `beta`) | +0.00031 | 0.64 |")
    w("| C2 (destroyed time, `beta`) | -0.00026 | 0.88 |")
    w("| C3 -> Metric D | -0.00012 | 0.84 |")
    w("| C3 -> Metric C | -0.00036 | 1.52 |")
    w("| C4 raw column | -0.00081 | 2.10 |")
    w("| C3 -> Metric A | -0.00115 | 2.51 |")
    w("")
    w("The passes recorded in this study are passes of **offset** nulls, not of centred ones. Two "
      "of the six exclude zero; the verdict-bearing one, C3 -> Metric A, is the one section 2 is "
      "about; the raw-column C4 is discussed below and is not a pass condition.\n")
    raw_c4 = CF["C4_shuffled_voc"].get("tae_rating_gradient_raw_column_permuted")
    if raw_c4:
        w(f"**The raw-column form of C4** -- permuting the raw value-of-computation column rather "
          f"than the residual the estimator uses -- gives {iv(raw_c4)}. It is not the pass "
          f"condition, because it leaves the frozen fit's deterministic part in place, and its "
          f"magnitude is that part diluted by the permutation variance rather than the part itself. "
          f"The deterministic part is the response of residual time to *predicted* value of "
          f"computation interacted with rating; if that channel is to be described, the number to "
          f"quote is the direct one in section 5.3 "
          f"({iv(gf['ey_on_predicted_voc_x_rating'], 5)} on FINAL), with both of its readings.\n")
    w("---\n")

    # ================= 7. A2 =================================================================
    w("## 7. How much of this could be unmeasured difficulty\n")
    w("This is the study's central limitation, and it has three measurements rather than a "
      "paragraph. None of them addresses the form that matters most.\n")
    w(f"**C7b, a simulation.** An unobserved factor, independent of everything measured, added to "
      f"both thinking time and move quality with strengths calibrated to a factor the study does "
      f"measure -- the engine-difficulty block. It manufactures `beta` = {iv(c7b)} on FINAL when "
      f"the true value is zero.\n")
    # GATE 4 F2. The first version wrote `sqrt(ratio)` here. That is not amendment A5(a)'s
    # algebra: `beta_manufactured = (b / a) x f` with `f = a^2 / (a^2 + var(ut_resid))`, and
    # scaling a and b together leaves `b / a` fixed -- so on FINAL, where the engine block's
    # quality-per-time ratio is below `beta`, no factor "k times the block on both axes"
    # reproduces `beta` at any k. The DEVELOPMENT figure A5(a) quotes is derived here, not typed.
    def single_factor_multiple(block, target, var_resid):
        """How many times the engine block, on both axes, one factor would have to be."""
        a_block = block["factor_strength_on_log_time"]
        share = target / (block["factor_strength_on_quality"] / a_block)
        if not 0.0 < share < 1.0:
            return float("nan")
        return ((share * var_resid / (1.0 - share)) ** 0.5) / a_block

    c7b_block = CF["C7b_omitted_difficulty_simulation"]
    exchange = (c7b_block["factor_strength_on_quality"]
                / c7b_block["factor_strength_on_log_time"])
    var_ut = gf["var_ut_resid"]
    needed_all = b["point"] / exchange
    dev_multiple = single_factor_multiple(
        A["controls"]["development"]["C7b_omitted_difficulty_simulation"],
        D["beta"]["point"], gd["var_ut_resid"])
    w(f"The observed `beta` is {ratio:.0f} times that. **That does not mean the alternative needs "
      f"{ratio:.0f} unmeasured factors, and it does not mean one factor a few times the engine "
      f"block would do.** The manufactured value is an exchange rate -- the factor's "
      f"quality-per-time ratio times its share of residual time variance -- and scaling a factor "
      f"up on both axes leaves that ratio unchanged. On FINAL the engine block's ratio is "
      f"{exchange:.4f} win probability per log-second, below `beta` = {b['point']:.4f}, so a "
      f"single factor with the block's own ratio cannot reproduce `beta` at any strength. What the "
      f"alternative requires is a latent factor whose quality-per-time ratio is at least "
      f"{needed_all:.1f} times the engine block's -- and that only if it explained nearly all of "
      f"the residual time variance ({var_ut:.3f}) -- or, for example, {needed_all / 0.2:.1f} times "
      f"the block's ratio while explaining a fifth of it. On DEVELOPMENT, where the block's ratio "
      f"is higher, the same arithmetic gives one factor about {dev_multiple:.1f} times the block on "
      f"both axes (amendment A5(a)). A single dominant latent, *how hard this position actually "
      f"was for this human*, is the natural form of the alternative, not many independent small "
      f"ones. The anchor is weak by this study's own numbers: the measured engine-difficulty block "
      f"explains about 3% of log-time variance, so multiples of it sound larger than they are.\n")
    w("**The nuisance ladder, a direct measurement.** `beta` under three nested adjustments, each "
      "fitted on DEVELOPMENT and frozen:\n")
    w("| nuisance set | FINAL `beta` |")
    w("|---|---|")
    w(f"| context only | {ladder['T0R_context_only']:.5f} |")
    w(f"| + the whole fourteen-feature engine-difficulty block | "
      f"{ladder['T1R_plus_engine_difficulty']:.5f} |")
    w(f"| + value of computation (the reported specification) | "
      f"{ladder['T2R_plus_value_of_computation']:.5f} |")
    w("")
    w("Two readings are admissible and this report does not choose between them: either `beta` is "
      "robust to measured difficulty, or a search at this depth captures so little of what makes a "
      "human slow **and** wrong that its failure to move `beta` says little about what would.\n")
    if c9:
        w(f"**C9, the engine budget.** {c9['n_common_decisions']:,} VALIDATION decisions re-scored "
          f"at 150,000 nodes, 2.5 times the primary budget, every nuisance model refitted per "
          f"budget: `beta`(60k) = {c9['beta_60k']:.5f}, `beta`(150k) = {c9['beta_150k']:.5f}, ratio "
          f"{iv(c9['r_beta'], 3)}.\n")
        w(f"The lower bound {c9['r_beta']['lo']:.3f} excludes attenuation greater than "
          f"{100 * (1 - c9['r_beta']['lo']):.1f}% for the re-measurement this budget change "
          f"produced, and the preregistration's own reading applies: a C9 that does not fire is "
          f"not evidence against unmeasured difficulty (`VERDICT_RULES.md` §2.5c); at "
          f"n = {c9['n_common_decisions']:,} the trigger could only have fired for attenuation of "
          f"roughly two-thirds or more.\n")
        w("What actually changed between the budgets, and what did not:\n")
        w("| quantity | agreement across budgets |")
        w("|---|---|")
        for label, key, fmt in (("median depth", None, None),
                                ("`quality_loss`", "corr_quality_loss", "r = {:.2f}"),
                                ("the quality residual", "corr_q_resid", "r = {:.2f}"),
                                ("the time residual", "corr_ut_resid", "r = {:.3f}"),
                                ("`voc_regret`", "corr_voc_regret", "r = {:.2f}"),
                                ("`voc_rank`", "corr_voc_rank", "r = {:.2f}"),
                                ("the residual instrument", "corr_voc_resid", "r = {:.2f}"),
                                ("the engine's own best move", "same_best_move_share",
                                 "identical on {:.0%} of decisions")):
            if key is None:
                w(f"| {label} | {ba.get('median_depth_60k', float('nan')):.0f} -> "
                  f"{ba.get('median_depth_150k', float('nan')):.0f} |")
            elif key in ba:
                w(f"| {label} | {fmt.format(ba[key])} |")
        w("")
        w("The value-of-computation features moved substantially between budgets; the outcome and "
          "the time residual barely moved at all. The ratio's interval is tight because the two "
          "estimates move **together** under player resampling, not because the design gained "
          "information about difficulty, and this report does not present it as a stronger "
          "statement than the design was entitled to expect.\n")
    w("**What may be concluded, and what may not.** The *engine-measurable* form of unmeasured "
      "difficulty is constrained by these three measurements. The *human-perceived* form -- a "
      "position that is hard for a person in a way a search at this depth does not register -- is "
      "exactly where the preregistration put it: **cannot be excluded**. Section 4.3 is the closest "
      "this design comes to seeing unmeasured difficulty at all, and what is visible there is its "
      "engine-measurable form -- evaluation instability the frozen features did not capture, "
      "tracked by residual time. The human-perceived form is touched by no measurement here.\n")
    w("---\n")

    # ================= 8. replication ========================================================
    w("## 8. Replication across periods\n")
    w("| | `beta` | Metric B gradient |")
    w("|---|---|---|")
    for name, block in (("DEVELOPMENT 2026-02", D), ("VALIDATION 2026-04", Va),
                        ("**FINAL 2026-06**", F)):
        w(f"| {name} | {iv(block['beta'])} | {iv(block['tae_rating_gradient'])} |")
    if dj and "beta" in dj:
        w(f"| FINAL, players absent from the other two | {iv(dj['beta'])} | "
          f"{iv(dj.get('tae_rating_gradient', {}))} |")
    w("")
    if dj:
        w(f"{dj.get('overlapping_players', 0):,} of {dj.get('final_players', 0):,} FINAL players "
          f"also appear in an earlier period. Both the full and the restricted estimate are "
          f"reported; neither was chosen after seeing them. The restricted Metric B readings -- "
          f"pooled gradient, matched, `T = 0` removed, low clock pressure, spread -- are what fail "
          f"the `player_disjoint_holds` condition, on the same instrument section 5 describes; the "
          f"restricted `beta` passes.\n")
    w("---\n")

    # ================= 9. secondary ==========================================================
    w("## 9. The secondary time control: not evaluable\n")
    w("`300+0` was preregistered as a cross-context replication. **Through the frozen pipeline it "
      "supports nothing**, and the block is reported as a failure of the design, not as a result.\n")
    if sec:
        w(f"The frozen time models were fitted on `180+0` clocks and extrapolate badly to five "
          f"minutes: about two thirds of `300+0` decisions sit outside the frozen knot range, the "
          f"frozen prediction of log-time runs down to about -7.35 where log-time is non-negative "
          f"by construction, and the residual standard deviation is roughly five times FINAL's. "
          f"The consequence is decisive: the destroyed-outcome null on the secondary sits at about "
          f"+0.0114 against the block's apparent `beta` of {iv(sec.get('beta', {}))}. The number "
          f"the block reports is, to three decimals, its own null. The slope of *raw* quality loss "
          f"on the same frozen time residual is about -0.00005.\n")
    w("The explanation offered in the Gate 3 packet -- that `beta` survives at `300+0` because it "
      "is a slope of one residual on another while a level shift is not -- is **withdrawn**: the "
      "level shift on the clock scale enters both residuals and manufactures the slope. Metric A, "
      "Metric D and every band value in that block are artefacts of the same extrapolation. No "
      "destructive control was run on the secondary period, so the pipeline's own C1 -- which "
      "would have failed at roughly a hundred null standard deviations -- never had the chance to "
      "say so. That omission is recorded as a process failure.\n")
    w("Preregistered condition §2.6 is therefore **not evaluable** -- and it could not have "
      "applied in any case: §2.6 is reachable only from `EXPERTISE_ADAPTATION_SUPPORTED`, which "
      "neither verdict reached, so the secondary block's failure cost the study no verdict. No "
      "cross-context claim of any kind is made from this data.\n")
    w("As an **exploratory, non-preregistered** check, and labelled as such wherever it is quoted: "
      "with the nuisance models refitted on the secondary period itself, the Gate 3 adversary's "
      "reconstruction gives `beta` = +0.01245 [+0.01131, +0.01358] and Metric A = -0.01079 "
      "[-0.01273, -0.00886], against the primary's +0.01342 and -0.01069, and a refitted Metric B "
      "gradient of +0.00007 [-0.00132, +0.00153]. Restricting the frozen pipeline to in-range "
      "clocks gives `beta` +0.00836 [+0.00631, +0.01083]. These suggest the *signs* probably hold "
      "at five minutes with nuisance models fitted on the same data. That is not the test the "
      "preregistration defined, and it does not become one by being reported. The top of the "
      "rating range is unpowered there in any case (149, 128 and 61 players in the top three "
      "bands).\n")
    w("---\n")

    # ================= 10. what failed =======================================================
    w("## 10. What failed\n")
    w("Recorded here rather than in an appendix, because a study that reports only what worked is "
      "not reporting.\n")
    for name, detail in sorted(V.get("metrics", {}).items()):
        if "passes" in detail:
            letter, _, rest = name.partition("_")
            pretty = f"{letter} ({rest.replace('_', ' ')})"
            w(f"* **Metric {pretty}** -- {'met' if detail['passes'] else 'did **not** meet'} its "
              f"conditions: {iv(detail['interval'])}, expected sign "
              f"{'positive' if detail['expected_sign'] > 0 else 'negative'}"
              + (f", band Spearman {detail['band_spearman']:+.2f} against a required "
                 f"{0.6 * detail['expected_sign']:+.1f} (expected direction "
                 f"{'positive' if detail['expected_sign'] > 0 else 'negative'})"
                 if detail.get("band_spearman") is not None else "") + ".")
    w("")
    if V.get("failed_conditions"):
        w("Conditions of the strongest verdict that were not met: `"
          + "`, `".join(V["failed_conditions"]) + "`.\n")
    w("Five of those seven are the same instrument read on overlapping rows (section 5.5); the "
      "spread condition was unreachable by design (5.4); the matched condition was structurally "
      "negative (5.5). The study registered the expertise hypothesis as the interesting half and "
      "reports it as the half that was not supported -- and, on the evidence in section 5, as the "
      "half it was not equipped to test.\n")
    w("A second failure belongs here: the C3 null construction, which shipped with a deterministic "
      "term that the Gate 2 audit had already characterised in another control and did not apply "
      "to this one. It was caught by the Gate 3 adversary, after the holdout was open, in the "
      "period where it mattered.\n")
    w("A third: the secondary time control, designed and executed without a check that the frozen "
      "models were in range, and shipped without its own destructive controls.\n")
    w("---\n")

    # ================= 11. band residual means ===============================================
    w("## 11. The frozen models' misfit by band\n")
    w("Gate 1's sixth recommendation asked for this table so a reader can see the freeze's "
      "residual structure directly. Every slope in this report is centred inside the set being "
      "estimated, so none of these means enters a reported coefficient; they are printed because a "
      "reader is entitled to check that.\n")
    w("| band | n | mean time residual | mean rating residual (Elo) | mean quality residual |")
    w("|---|---|---|---|---|")
    for band, cell in gf["band_residual_means"].items():
        w(f"| {band} | {cell['n']:,} | {cell['mean_y_resid_T1']:+.3f} | "
          f"{cell['mean_rating_resid']:+.1f} | {cell['mean_q_resid']:+.4f} |")
    w("")
    w("---\n")

    # ================= 12. limitations =======================================================
    w("## 12. Limitations\n")
    w("1. **Observational.** Nothing here identifies a causal effect of thinking time on move "
      "quality. `beta` is an adjusted association.")
    w("2. **Unmeasured difficulty.** Constrained in its engine-measurable form; not excluded in "
      "its human-perceived form. Section 7.")
    w("3. **The primary instrument does not measure what its name says.** Time Allocation "
      "Efficiency is built on an engine-derived value of computation with a large point mass, a "
      "1.7% partial correlation with residual time, no detectable response to the clock, and no "
      "validation against human perception. Section 5.2.")
    w("4. **Allocation versus recognition.** No metric here separates a better allocation policy "
      "from better recognition of which positions deserve computation. This matters most for "
      "reading the null: whichever of the two would have produced a gradient, the composite "
      "estimand could not have shown it.")
    w(f"5. **Whole-second clocks.** The dumps write clocks to the second, so `T = 0` means \"under "
      f"a second\" and covers {F['zero_time_share']:.0%} of decisions, unevenly across bands. "
      f"Control C17 repeats everything without them and section 5.1 gives Metric A both ways.")
    w("6. **One engine, one budget, median depth about 12.** C9 varies the budget by 2.5x and "
      "finds the outcome and the time residual almost unchanged, which is a weak test.")
    w("7. **One calendar day per period** -- a complete diurnal cycle, but one day's player mix.")
    w("8. **The win-probability curve is population-dependent.** It was fitted by Lichess on "
      "2300-rated games and is applied here from 800 to 2600; section 4.4 shows the scale "
      "consequence.")
    w("9. **The account-status lookup is a snapshot** whose lag differs by period, leaving FINAL's "
      "top band the least cleaned -- a direction that favours the hypothesis. `beta` and the "
      "primary Metric B gradient are therefore also reported with the top band dropped (sections 4 "
      "and 5).")
    w("10. **Frozen models drift.** Four months after the fit, the C3 nulls carry a visible drift "
      "offset and one crossed its tolerance. Section 6.3.")
    w("11. **`unexpected_time` is a regression residual of a clock difference.** It is not "
      "confusion, hesitation, indecision or any cognitive state, and it is named neutrally "
      "everywhere in this repository for that reason.\n")
    w("---\n")

    # ================= 13. not supported =====================================================
    w("## 13. Claims this study does NOT support\n")
    w("* That thinking for longer produces worse moves. The direction of the association is not "
      "identified.")
    w("* That rating causes anything measured here, or that anything measured here is cognition.")
    w("* That stronger players are better or worse at deciding where to spend their seconds. The "
      "primary instrument was not capable of answering that, and section 5 says why.")
    w("* That the absence of a Metric B gradient is a property of players.")
    w("* That unmeasured difficulty has been ruled out in the form that matters.")
    w("* That anything here replicates at a different time control.")
    w("* Any prediction of a player's rating from these behavioural metrics.\n")
    bands = F["beta_by_band"]
    powered = [x for x in V["adequately_powered_bands"] if x in bands]
    lo_band, hi_band = powered[0], powered[-1]
    biggest = max(powered, key=lambda x: bands[x]["point"])
    at_centre = F["beta_at_mean_rating"]
    per_100 = F["beta_rating_interaction"]["point"]
    at_800, at_2600 = at_centre + per_100 * -8.0, at_centre + per_100 * 10.0
    w("Under the repaired verdict -- the mechanical verdict as shipped is `INVALID_EXPERIMENT` "
      "(section 2) and licenses no level language at all -- the strongest phrasing the "
      "preregistration permits for what *was* found is a **cross-rating law-like regularity**, and "
      "it carries its own qualification in the same breath: the `beta` x rating interaction on "
      f"FINAL is {iv(F['beta_rating_interaction'])} per 100 Elo; the raw band values run from "
      f"{bands[biggest]['point']:.4f} ({biggest}) to {bands[hi_band]['point']:.4f} ({hi_band}), the "
      f"lowest band is {bands[lo_band]['point']:.4f}, and the fitted interaction implies a fall of "
      f"about a quarter across 800-2600 ({at_800:.4f} to {at_2600:.4f}). It is invariant in sign "
      f"({V['band_sign_agreement']['agree']} of {V['band_sign_agreement']['of']} bands) and both "
      "halves of its dose-response are positive (section 4). It is not invariant in size.\n")
    w("---\n")

    # ================= 14. next experiment ===================================================
    w("## 14. NEXT_EXPERIMENT\n")
    w("**B4 -- the time-allocation gradient with a validated, non-degenerate instrument.** Same "
      "population and the same freeze discipline; a different instrument and a different floor. "
      "Specified by the Gate 3 adversary and recorded here unchanged, because ideas that arrive "
      "after a holdout is open may only ever be next experiments:\n")
    w("1. **Instrument.** A value-of-computation measure with no point mass -- the expected regret "
      "of the shallow candidate distribution, `sum_k p_shallow(k) x [wp_deep(best) - wp_deep(k)]` "
      "with `p_shallow` a softmax over the shallow evaluations at the accuracy temperature -- "
      "validated on DEVELOPMENT before the freeze by two pre-specified checks the current "
      "instrument fails or has never had: test-retest reliability of its residual across engine "
      "budgets at or above 0.8, and a pooled response to it that is larger in the fullest clock "
      "tercile than in the emptiest, with an interval excluding zero. An instrument failing either "
      "check returns to the design gate.")
    w("2. **Estimands.** The rating gradient of the time response reported as two named quantities "
      "-- the response to the residual component and to the predicted component -- so the channel "
      "observed here at +0.007 to +0.010 per 100 Elo, un-preregistered and confounded by "
      "construction (section 5.3), becomes a preregistered quantity with its "
      "recognition/allocation ambiguity stated, instead of a contaminant entering the primary "
      "metric with its sign flipped.")
    w("3. **Floor and power.** The floor fixed at freeze as a *relative* change in the DEVELOPMENT "
      "pooled level, converted to an absolute number from DEVELOPMENT only, with N set by the pilot "
      "to give 80% power for it -- about three times this study's per-period decisions, or a "
      "preregistered pooled read across three periods.")
    w("4. **Matching.** Cells on difficulty, clock, phase, standing and ply only -- never on the "
      "instrument whose response is the estimand -- with improved balance on every cell variable as "
      "a condition of using the matched estimate.")
    w("5. **Replication arm.** A second time control with its own development day, its own frozen "
      "fits, and its own destructive controls.\n")
    w("---\n")

    # ================= 15. provenance ========================================================
    w("## 15. Provenance\n")
    w("| | |")
    w("|---|---|")
    w(f"| preregistration frozen | `results/PREREGISTRATION_FREEZE.json` |")
    w(f"| post-freeze amendments | `results/POST_FREEZE_AMENDMENTS.md` (A0-A7) |")
    w(f"| holdout seal | `results/FINAL_HOLDOUT_SEALED.json` |")
    w(f"| gate reviews | `reviews/FABLE_GATE_{{1,2,3}}_*.md` |")
    w(f"| analysis as shipped | `results/analysis_final.json` (FINAL stage), "
      f"`results/analysis_secondary.json` (that run plus the secondary block), verdict "
      f"`results/verdict.json` |")
    w(f"| analysis after the C3 repair | `results/analysis_repaired.json`, verdict "
      f"`results/verdict_repaired.json`. It is `analysis_secondary.json` with the C3 blocks "
      f"recomputed; the only other differences are the added "
      f"`tae_pooled_slope_at_centre`, the retained `C3_shuffled_rating_as_shipped`, and a "
      f"`_repair` provenance stanza |")
    w(f"| the repair itself | `src/repair_c3.py`, diff in `results/c3_repair_diff.json` |")
    w(f"| diagnostics in this report | `results/report_diagnostics.json`, from "
      f"`src/report_diagnostics.py` |")
    w(f"| leakage tests | passed: {A.get('leakage_tests_passed')} |")
    w(f"| engine determinism re-score | non-determinism detected: "
      f"{A.get('engine_nondeterminism_detected')} |")
    w("")
    w("**Numbers that come from a gate review rather than from this pipeline**, all from "
      "`reviews/FABLE_GATE_3_RESULT_ADVERSARY.md`, which was produced independently and read-only "
      "against this repository:\n")
    w("* Section 2: the analytic predictions of the C3 null and their Monte-Carlo standard errors, "
      "the `cov(ratinghat, rating_resid)` column, and the ratio 61,676 / 298,552.")
    w("* Section 6.3: the drift-offset table (the FINAL nulls and their offsets in null SDs; the "
      "VALIDATION and DEVELOPMENT comparisons in the paragraph above it are from "
      "`analysis_repaired.json`).")
    w("* Section 9: every extrapolation diagnostic on the secondary period -- the -7.35 floor of "
      "the frozen prediction, the two-thirds out-of-range share, the fivefold residual standard "
      "deviation, the +0.0114 destroyed-outcome null, the -0.00005 raw slope, the \"about a "
      "hundred null standard deviations\", the refit estimates, and the top-band player counts.")
    w("")
    w("Every other number is interpolated from the JSON files above by `src/write_report.py`. The "
      "three-estimator table in section 2 is this pipeline's own recomputation and agrees with "
      "amendment A7.5's independent reconstruction to the fourth decimal. The `label_means` field "
      "in both verdict files holds `VERDICT_RULES.md` §3.1's definition of "
      "`EXPERTISE_ADAPTATION_SUPPORTED`, which `evaluate.py` writes whichever gate fires; it is "
      "not the meaning of the verdict either file records, and this report does not print it.\n")

    text = "\n".join(out) + "\n"
    lowered = text.lower()
    hits = [phrase for phrase in FORBIDDEN if phrase in lowered]
    if hits:
        raise SystemExit("REFUSING to write the report; forbidden language present: "
                         + "; ".join(hits))
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    open(args.out, "w").write(text)
    print(f"wrote {args.out} ({len(out)} lines, {len(text):,} characters)")


if __name__ == "__main__":
    main()
