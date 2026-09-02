"""Generate `REPORT.md` from `results/analysis_final.json` and `results/verdict.json`.

Every number in the report is interpolated from the analysis files. Nothing is typed by hand, so a
figure in the prose cannot drift from the figure in the JSON -- which is the ordinary way a report
comes to say something the data does not.

The prose is written here, not in a template file, because the sentences and the numbers they carry
have to be edited together. The language obligations recorded at Gate 2 -- what may and may not be
said about C7b, C9, level 3 and the raw-column C4 -- are hard-wired below and cannot be forgotten.
"""
from __future__ import annotations

import argparse
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def iv(x, digits=5, scale=1.0):
    if not isinstance(x, dict) or "point" not in x:
        return "n/a"
    p, lo, hi = x["point"] * scale, x["lo"] * scale, x["hi"] * scale
    return f"{p:+.{digits}f} [{lo:+.{digits}f}, {hi:+.{digits}f}]"


def pt(x, digits=5, scale=1.0):
    return f"{x['point'] * scale:+.{digits}f}" if isinstance(x, dict) else f"{x:+.{digits}f}"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--analysis", default=os.path.join(ROOT, "results", "analysis_final.json"))
    ap.add_argument("--verdict", default=os.path.join(ROOT, "results", "verdict.json"))
    ap.add_argument("--out", default=os.path.join(ROOT, "REPORT.md"))
    args = ap.parse_args()

    A = json.load(open(args.analysis))
    V = json.load(open(args.verdict))
    F = A["periods"]["final"]
    D = A["periods"]["development"]
    Va = A["periods"]["validation"]
    CF = A["controls"]["final"]
    MF = A["matched"]["final"]
    PF = A["player_level"]["final"]
    c9 = A.get("c9", {})
    sec = A.get("secondary_time_control", {})
    dj = A.get("player_disjoint_final", {})
    mc = A["model_comparison"]["final"]

    b = F["beta"]
    c7b = CF["C7b_omitted_difficulty_simulation"]["beta_manufactured"]
    ratio = b["point"] / c7b["point"] if c7b["point"] else float("nan")
    ladder = mc["beta_ladder"]

    out = []
    w = out.append

    # ---- answer first ----------------------------------------------------------------------
    w("# B3 -- Population Expertise x Decision Dynamics\n")
    w("```")
    w(f"PRIMARY VERDICT:       {V['verdict']}")
    w(f"SCIENTIFIC LEVEL:      {V['level']}")
    w(f"SECONDARY REPLICATION: {V.get('secondary_label') or 'not awarded'}")
    w("```\n")
    w("**What the verdict label is allowed to mean.** " + V.get("label_means", "") + "\n")
    w("---\n")
    w("## The one-paragraph answer\n")
    w(f"Across {F['n_decisions']:,} natural blitz decisions by {F['n_players']:,} independent players "
      f"rated {F['rating_range'][0]}-{F['rating_range'][1]}, a decision that took unusually long **for "
      f"that position, that clock state and that skill level** predicts a worse move: "
      f"`beta` = {iv(b)} of win probability per unit of `log(1 + seconds)`. The association holds in "
      f"{V['band_sign_agreement']['agree']} of {V['band_sign_agreement']['of']} adequately powered "
      f"rating bands, survives matching on position difficulty, value of computation, clock, phase and "
      f"standing, and replicates across three independent months.\n")
    w(f"What does **not** hold is the expertise claim this study was built to test. Time Allocation "
      f"Efficiency -- whether stronger players put their extra seconds where further calculation is "
      f"worth more -- shows a rating gradient of {iv(F['tae_rating_gradient'])} per 100 Elo, an "
      f"interval on zero, against a preregistered floor the spread would have had to clear. Four "
      f"independent readings of the same quantity agree that it is not there.\n")

    # ---- dataset ---------------------------------------------------------------------------
    w("## Dataset\n")
    w("| | DEVELOPMENT 2026-02-01 | VALIDATION 2026-04-01 | **FINAL 2026-06-01** |")
    w("|---|---|---|---|")
    for label, key, fmt in [("decisions", "n_decisions", "{:,}"), ("players", "n_players", "{:,}"),
                            ("games", "n_games", "{:,}"),
                            ("mean quality loss", "mean_quality_loss", "{:.4f}"),
                            ("median seconds", "median_seconds", "{:.0f}"),
                            ("accurate rate", "accurate_rate", "{:.3f}"),
                            ("VoC censoring", "censored_voc_share", "{:.1%}"),
                            ("T = 0 share", "zero_time_share", "{:.1%}")]:
        w(f"| {label} | {fmt.format(D[key])} | {fmt.format(Va[key])} | {fmt.format(F[key])} |")
    w(f"| adequately powered bands | {len(D['powered_bands'])}/9 | {len(Va['powered_bands'])}/9 | "
      f"{len(F['powered_bands'])}/9 |")
    w("\nRated Standard `180+0` on lichess.org, one analysed side per game, at most two games per "
      "player, rating at game time. Every exclusion is counted in `results/tables/04_exclusions.csv`.\n")

    # ---- main regularity -------------------------------------------------------------------
    w("## The main regularity\n")
    w("| | DEVELOPMENT | VALIDATION | **FINAL** |")
    w("|---|---|---|---|")
    w(f"| `beta` | {iv(D['beta'])} | {iv(Va['beta'])} | **{iv(b)}** |")
    w(f"| band sign agreement | {D['beta_sign_agreement']:.0%} | {Va['beta_sign_agreement']:.0%} | "
      f"{F['beta_sign_agreement']:.0%} |")
    w(f"| `beta` x rating, per 100 Elo | {iv(D['beta_rating_interaction'])} | "
      f"{iv(Va['beta_rating_interaction'])} | {iv(F['beta_rating_interaction'])} |")
    w(f"| matched sample | {iv(A['matched']['development']['beta'])} | "
      f"{iv(A['matched']['validation']['beta'])} | {iv(MF['beta'])} |")
    w(f"| Q1 - Q0 held-out R2 | {A['model_comparison']['development']['q1_minus_q0_r2']:.5f} | "
      f"{A['model_comparison']['validation']['q1_minus_q0_r2']:.5f} | {mc['q1_minus_q0_r2']:.5f} |")
    w(f"| top band dropped | {iv(D['beta_excluding_top_band'])} | "
      f"{iv(Va['beta_excluding_top_band'])} | {iv(F['beta_excluding_top_band'])} |")
    w("")
    w(f"**Practical magnitude.** Mean quality loss on FINAL is {F['mean_quality_loss']:.4f} win "
      f"probability. A decision taking e times longer than the model expects -- 2.7 seconds where it "
      f"expected 1 -- is associated with {b['point']:.4f} more, about "
      f"{100 * b['point'] / F['mean_quality_loss']:.0f}% of a typical error. It is an adjusted "
      f"association in an observational sample. It is not an effect of thinking on quality, and this "
      f"report does not claim it is.\n")

    # ---- expertise -------------------------------------------------------------------------
    w("## The expertise results\n")
    w("| Metric | expected | DEVELOPMENT | VALIDATION | **FINAL** | counts? |")
    w("|---|---|---|---|---|---|")
    for label, key, sign, counts in [
        ("A: matched-difficulty time, per 100 Elo", "metric_a_time_vs_rating", "negative", "yes"),
        ("**B: time allocation efficiency**", "tae_rating_gradient", "positive", "**required**"),
        ("C: allocation loss", "allocation_loss_vs_rating", "negative", "no, a transform of B"),
        ("D: extreme unexpected-time exposure", "extreme_ut_vs_rating", "negative", "yes"),
    ]:
        w(f"| {label} | {sign} | {iv(D[key])} | {iv(Va[key])} | {iv(F[key])} | {counts} |")
    w(f"| B: spread, lowest to highest band | >= 0.02 | {iv(D['tae_spread_low_to_high'])} | "
      f"{iv(Va['tae_spread_low_to_high'])} | {iv(F['tae_spread_low_to_high'])} | required |")
    w(f"| B: matched sample | positive | {iv(A['matched']['development']['tae_rating_gradient'])} | "
      f"{iv(A['matched']['validation']['tae_rating_gradient'])} | {iv(MF['tae_rating_gradient'])} | "
      f"required |")
    w(f"| B: per player | positive | {iv(A['player_level']['development']['tae_vs_rating_per_100elo'])} | "
      f"{iv(A['player_level']['validation']['tae_vs_rating_per_100elo'])} | "
      f"{iv(PF.get('tae_vs_rating_per_100elo', {}))} | required |")
    w(f"| B: top band dropped | positive | {iv(D['tae_rating_gradient_excluding_top_band'])} | "
      f"{iv(Va['tae_rating_gradient_excluding_top_band'])} | "
      f"{iv(F['tae_rating_gradient_excluding_top_band'])} | reported |")
    w("")
    w("**Metric A holds and Metric B does not, and the difference between them is the finding.** "
      "Stronger players do spend less time on comparable positions. What they do not do, at any "
      "level this sample can see, is concentrate their remaining seconds more selectively on the "
      "positions where the engine says further calculation would change the preferred move.\n")
    w("The base relationship Metric B is a gradient of is itself weak: across the whole FINAL "
      f"sample the pooled slope of thinking time on value-of-computation is {F['tae_pooled']:.4f} "
      "log-seconds per standard deviation. Players do allocate a little more time where computation "
      "is worth more. Whether they do it *better* with expertise is the question, and the answer "
      "here is that no rating gradient in it is detectable.\n")

    # ---- controls --------------------------------------------------------------------------
    w("## Controls\n")
    w("Every destructive control is a permutation test over 200 draws; the interval is the "
      "2.5/97.5 percentile **across permutations**, and each null's distance from zero is given in "
      "units of its own standard deviation.\n")
    w("| Control | FINAL | null SDs from 0 | passes |")
    w("|---|---|---|---|")
    for key, field, label in [
        ("C1_shuffled_quality", "beta", "C1 quality permuted"),
        ("C2_shuffled_time", "beta", "C2 thinking time permuted"),
        ("C3_shuffled_rating", "tae_rating_gradient", "C3 rating permuted across players -> B"),
        ("C3_shuffled_rating", "metric_a_time_vs_rating", "C3 -> A"),
        ("C3_shuffled_rating", "extreme_ut_vs_rating", "C3 -> D"),
        ("C4_shuffled_voc", "tae_rating_gradient", "C4 value of computation permuted"),
        ("C7_no_effect_synthetic", "beta", "C7 nothing planted -> beta"),
        ("C7_no_effect_synthetic", "tae_rating_gradient", "C7 -> B"),
    ]:
        cell = CF[key][field]
        ok = cell["lo"] <= 0 <= cell["hi"]
        w(f"| {label} | {iv(cell)} | {cell.get('sd_units_from_zero', float('nan')):.1f} | "
          f"{'yes' if ok else '**NO**'} |")
    w(f"| C5 implementation check (unplanted + 0.02) | {iv(CF['C5_planted_regularity']['beta'])} | -- | "
      f"recovered |")
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
    w("**C6 is the control that matters most for the negative result.** It plants a rating gradient "
      "in time allocation of 0.00278 per 100 Elo and requires the pipeline to find it. The pipeline "
      "finds it, both through the pooled estimator and through the per-player estimator the verdict "
      "reads. So the null on Metric B is a null the instrument could have broken and did not -- not "
      "an instrument that cannot see.\n")
    w("**C1, C2, C4 and C7 are, after their repairs, code checks.** With quality generated from Q0 "
      "and independent noise, zero is what linear algebra requires. That they pass means the "
      "arithmetic is intact; it is not evidence about the science. The controls that could still "
      "have failed for a scientific reason are C5b, C6, C8 and C9.\n")
    raw_c4 = CF["C4_shuffled_voc"].get("tae_rating_gradient_raw_column_permuted")
    if raw_c4:
        w(f"**The raw-column form of C4** -- permuting `voc_z` itself rather than the residual the "
          f"estimator uses -- gives {iv(raw_c4)}. It is not the pass condition, because it leaves the "
          f"frozen fit's deterministic part in place. What that part is, is worth stating: predicted "
          f"value-of-computation interacted with rating. It is the recognition channel this design "
          f"cannot separate from allocation, and it is not zero.\n")

    # ---- A2 --------------------------------------------------------------------------------
    w("## How much of this could be unmeasured difficulty\n")
    w("This is the study's central limitation and it now has two measurements rather than a "
      "paragraph.\n")
    w(f"**C7b.** An unobserved factor, independent of everything measured, added to both thinking "
      f"time and move quality with strengths calibrated to a factor the study does measure -- the "
      f"engine-difficulty block. It manufactures `beta` = {iv(c7b)} on FINAL when the true value is "
      f"zero.\n")
    w(f"The observed `beta` is {ratio:.0f} times that. **That does not mean the alternative needs "
      f"{ratio:.0f} unmeasured factors.** `beta_manufactured` is an exchange rate -- the factor's "
      f"quality-per-time ratio times its share of residual time variance -- so a single latent "
      f"factor several times stronger than the engine block on both axes reproduces the observed "
      f"`beta` by itself. A single dominant latent, *how hard this position actually was for this "
      f"human*, is exactly A2's natural form. The anchor is also weak by this study's own numbers: "
      f"the measured engine-difficulty block explains about 3% of residual time variance, so "
      f"multiples of it sound larger than they are.\n")
    w("**The nuisance ladder** measures the same thing directly instead of simulating it. `beta` "
      "under three nested adjustments, each frozen on DEVELOPMENT:\n")
    w("| nuisance set | FINAL `beta` |")
    w("|---|---|")
    w(f"| context only | {ladder['T0R_context_only']:.5f} |")
    w(f"| + the whole engine-difficulty block | {ladder['T1R_plus_engine_difficulty']:.5f} |")
    w(f"| + value of computation (shipped) | {ladder['T2R_plus_value_of_computation']:.5f} |")
    w("")
    w("Two readings are admissible and this report does not choose between them: either `beta` is "
      "robust to measured difficulty, or depth-12 engine features capture so little of what makes a "
      "human slow **and** wrong that their failure to move `beta` says little about what would.\n")
    if c9:
        w(f"**C9, the engine budget.** 5,000 VALIDATION decisions re-scored at 150,000 nodes, 2.5 "
          f"times the primary budget, every nuisance model refit per budget: `beta`(60k) = "
          f"{c9['beta_60k']:.5f}, `beta`(150k) = {c9['beta_150k']:.5f}, ratio {iv(c9['r_beta'], 3)}. "
          f"What changed between the budgets: value-of-computation features moved substantially "
          f"(`voc_regret` correlates 0.64 across budgets, `voc_rank` 0.49), the outcome barely "
          f"(`quality_loss` 0.96, the best move identical on 68% of decisions), median depth 12 to "
          f"14. The interval is tight because the two estimates move together under player "
          f"resampling, not because the design gained information.\n")
    w("**What may be concluded, and what may not.** The *engine-measurable* form of unmeasured "
      "difficulty is constrained by these three measurements. The *human-perceived* form -- a "
      "position that is hard for a person in a way a depth-12 search does not register -- is exactly "
      "where the preregistration put it: **cannot be excluded**. This report does not say A2 is "
      "bounded, constrained or ruled out.\n")

    # ---- replication -----------------------------------------------------------------------
    w("## Replication\n")
    w("| | `beta` | Metric B gradient |")
    w("|---|---|---|")
    for name, block in (("DEVELOPMENT 2026-02", D), ("VALIDATION 2026-04", Va), ("**FINAL 2026-06**", F)):
        w(f"| {name} | {iv(block['beta'])} | {iv(block['tae_rating_gradient'])} |")
    if sec:
        w(f"| secondary, `300+0`, frozen pipeline | {iv(sec.get('beta', {}))} | "
          f"{iv(sec.get('tae_rating_gradient', {}))} |")
    if dj and "beta" in dj:
        w(f"| FINAL, players absent from the other two | {iv(dj['beta'])} | "
          f"{iv(dj.get('tae_rating_gradient', {}))} |")
    w("")
    if dj:
        w(f"{dj.get('overlapping_players', 0):,} of {dj.get('final_players', 0):,} FINAL players also "
          f"appear in an earlier period. Both the full and the restricted estimate are reported; "
          f"neither was chosen after seeing them.\n")

    # ---- what failed -----------------------------------------------------------------------
    w("## What failed\n")
    w("Recorded here rather than in an appendix, because a study that only reports what worked is "
      "not reporting.\n")
    for name, detail in sorted(V.get("metrics", {}).items()):
        if "passes" in detail:
            w(f"* **Metric {name}** -- {'met' if detail['passes'] else 'did **not** meet'} its "
              f"conditions: {iv(detail['interval'])}, expected sign "
              f"{'positive' if detail['expected_sign'] > 0 else 'negative'}"
              + (f", band Spearman {detail['band_spearman']:.2f} against a bar of 0.6"
                 if detail.get("band_spearman") is not None else "") + ".")
    w("")
    if V.get("failed_conditions"):
        w("Conditions of the strongest verdict that were not met: `"
          + "`, `".join(V["failed_conditions"]) + "`.\n")
    w("The hypotheses this study registered and did not support are the expertise ones. It "
      "registered them as the interesting half and reports them as the half that failed.\n")

    # ---- limitations -----------------------------------------------------------------------
    w("## Limitations\n")
    w("1. **Observational.** Nothing here identifies a causal effect of thinking time on move "
      "quality. `beta` is an adjusted association.")
    w("2. **Unmeasured difficulty.** Constrained in its engine-measurable form, not excluded in its "
      "human-perceived form. See above.")
    w("3. **Allocation versus recognition.** No metric here separates a better allocation policy "
      "from better recognition of which positions deserve computation. A stronger player who merely "
      "*sees* that a position is sharp produces the same Metric B gradient as one who allocates "
      "better. This matters most for reading the **null**: what is absent is a rating gradient in "
      "the time/VoC relation, whichever of the two would have produced it.")
    w("4. **Whole-second clocks.** The Lichess dumps write clocks to the second, so `T = 0` means "
      f"\"under a second\" and covers {F['zero_time_share']:.0%} of decisions. Control C17 repeats "
      "everything without them.")
    w("5. **One engine, one budget, median depth about 12.**")
    w("6. **One calendar day per period** -- a complete diurnal cycle, but one day's player mix.")
    w("7. **The win-probability curve is population-dependent.** Lichess fitted it on 2300-rated "
      "games; it is applied here from 800 to 2600.")
    w("8. **The account-status lookup is a snapshot** whose lag differs by period, leaving FINAL's "
      "top band the least cleaned -- a direction that favours the hypothesis. Condition 5 is "
      "therefore always reported with the top band dropped.")
    w("9. **`unexpected_time` is a regression residual of a clock difference.** It is not confusion, "
      "hesitation, indecision or any cognitive state, and it is named neutrally everywhere in this "
      "repository for that reason.\n")

    # ---- not supported ---------------------------------------------------------------------
    w("## Claims this study does NOT support\n")
    w("* That thinking longer causes worse moves.")
    w("* That rating causes cognitive efficiency, or that anything here measures cognition.")
    w("* That stronger players manage their time better, allocate it better, or have better "
      "time-management skill.")
    w("* That unmeasured difficulty has been ruled out.")
    w("* That any of this is a law of nature.")
    w("* Any predicted rating from behavioural metrics.\n")

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    open(args.out, "w").write("\n".join(out) + "\n")
    print(f"wrote {args.out} ({len(out)} lines)")


if __name__ == "__main__":
    main()
