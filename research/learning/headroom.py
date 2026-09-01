"""What an UNAIDED player already does on RC-06, and what is therefore left to teach.

WHY THIS FILE EXISTS. `docs/learning-v2/EXPERIMENT.md` proposes Study D on RC-06 items and states
three baselines: the per-item chance rate (.317), the trigger-negative validity cell (.200), and the
harm rate (2.9%). It does not state the one baseline an intervention actually has to beat -- **what
players already do on these positions with no help at all.**

That number was measured. `research/measurement/screen_rule_classes.py::_player_sdt` reads the move
the player ACTUALLY PLAYED in the real game and asks whether it satisfies `B`, over 2,080
trigger-positive and 80,332 trigger-negative positions. It is reported in
`docs/measurement/RULE_CLASS_SEARCH.md` only as a *d'* table, and a *d'* with a moving criterion
does not tell you the hit rate. This file converts it back.

TWO THINGS COME OUT, AND THE SECOND IS THE ONE THAT CHANGES A DESIGN.

    1. THE HEADROOM. Pooled hit rate .716. By rating band it runs .63 -> .83. Against a chance
       rate of .317 the bottom band has realised 46% of the available range and the top band 75%.
       There is room to teach, and there is much less of it at 1800+ than at 1200-1400.

    2. THE DECOMPOSITION. `RULE_CLASS_SEARCH` reports *d'* monotone across bands and hedges, in one
       sentence, that "the criterion moves too, so this is not a clean sensitivity-only story."
       Quantified, the hedge is larger than the headline: of the +19.8 points of hit rate between
       the bottom and top bands, holding *c* fixed reproduces +8.1 and holding *d'* fixed
       reproduces +12.3. **Most of the behavioural gain that comes with rating is criterion, not
       sensitivity.**

    (2) WAS THEN CHECKED AND THE CHECK CAME BACK AGAINST IT. This file's first version read the
       criterion term as a WILLINGNESS -- players readier to play the mate-answering move -- and
       argued that an intervention moving it would raise the T+ hit rate while costing >=100 cp on
       34.0% of trigger-negative items. `criterion_channel.py` refutes that reading:
       `_threat_satisfies` is the only predicate of the twelve that BRANCHES ON THE TRIGGER, so a
       hit ("no mate in one") and a false alarm ("no check at all") are different acts and no bias
       parameter is identified. The arithmetic below stands; the interpretation is withdrawn, and
       the withdrawal is recorded here rather than edited away.

WHAT THIS FILE IS STILL FOR. The hit rates in (1). They are what an intervention has to beat, they
were absent from Study D's design, and nothing in the criterion finding touches them: they are
directly observed rates on trigger-positive items, where the predicate is well defined.

THE DECOMPOSITION IN (2) IS ALSO STILL SOUND AS ARITHMETIC -- bootstrapped at
P(criterion > sensitivity) = 1.000, and agreeing with non-parametric A' and B"D. What it may no
longer be called is a bias. See `docs/learning-v2/CRITERION_CHANNEL.md`.

NOTHING HERE TOUCHES THE PRODUCT. It imports nothing from `shared/`, is on no build path, and reads
one results file plus one source file, both asserted against below.
"""

from __future__ import annotations

import json
import re
from math import sqrt
from pathlib import Path
from statistics import NormalDist

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "research/measurement/results/rule_class_screen_raw.json"
SCREEN = ROOT / "research/measurement/screen_rule_classes.py"

NORMAL = NormalDist()

#: Transcribed from `docs/measurement/RULE_CLASS_SEARCH.md`, checked against the raw results below.
#: The share of legal moves satisfying B on a trigger-positive item -- what picking a permitted move
#: at random scores, and therefore the floor the hit rate is measured against.
CHANCE_RATE_T_PLUS = 0.317


def rates(d_prime: float, criterion: float) -> tuple[float, float]:
    """Back out (hit, false-alarm) from the SDT pair the screen reports.

    THE INVERSE OF `sdt.py::compute`, and exact rather than approximate: that function defines
    d' = z(H) - z(F) and c = -(z(H) + z(F))/2, so the two equations solve for z(H) and z(F) with no
    freedom left. The rates recovered are the Hautus loglinear-corrected ones, which is what the
    screen stored; `check()` confirms the round trip on the pooled cell, where the raw rates are
    also on file.
    """
    z_hit = d_prime / 2 - criterion
    z_false = -d_prime / 2 - criterion
    return NORMAL.cdf(z_hit), NORMAL.cdf(z_false)


def realised(hit: float, chance: float = CHANCE_RATE_T_PLUS) -> float:
    """Share of the range between chance and 1.0 that the player has already covered.

    A HIT RATE ALONE OVERSTATES SKILL when a third of legal moves satisfy the predicate by accident.
    This is the guessing correction: (H - chance) / (1 - chance).
    """
    return (hit - chance) / (1 - chance)


def wilson(successes: float, n: int, z: float = 1.96) -> tuple[float, float]:
    """Interval for a proportion. Wilson, for the reason every other study here gives: the rates
    sit near an end, where the symmetric interval runs past it."""
    if n == 0:
        return (0.0, 1.0)
    p = successes / n
    denom = 1 + z * z / n
    centre = p + z * z / (2 * n)
    half = z * sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return ((centre - half) / denom, (centre + half) / denom)


def load() -> dict:
    raw = json.loads(RAW.read_text(encoding="utf-8"))
    return raw["rule_classes"]["RC-06"]["player_behaviour_secondary"]


def decompose(player: dict) -> dict:
    """How much of the bottom-to-top-band hit-rate gain is sensitivity and how much is criterion.

    NEITHER PART IS A CAUSAL CLAIM and the two do not sum to the whole: hit rate is a nonlinear
    function of the pair, so holding one at its pooled value and moving the other is a
    decomposition of convenience, not a variance partition. It is reported because the ORDER of the
    two is what matters here, and the order is robust to which one is held.
    """
    bands = player["by_rating_band"]
    keys = list(bands)
    low, high = bands[keys[0]], bands[keys[-1]]
    pooled_d, pooled_c = player["d_prime"], player["criterion_c"]

    hit_low, _ = rates(low["d_prime"], low["criterion_c"])
    hit_high, _ = rates(high["d_prime"], high["criterion_c"])

    # criterion frozen at the pooled value; only sensitivity moves
    sens_low, _ = rates(low["d_prime"], pooled_c)
    sens_high, _ = rates(high["d_prime"], pooled_c)
    # sensitivity frozen; only the criterion moves
    crit_low, _ = rates(pooled_d, low["criterion_c"])
    crit_high, _ = rates(pooled_d, high["criterion_c"])

    # ROBUSTNESS, because the choice of anchor is arbitrary and the conclusion must not depend on
    # it. The same two differences are recomputed holding the frozen term at the low band's value
    # and at the high band's, and the ORDER is reported for all three.
    anchors = {
        "pooled": (pooled_d, pooled_c),
        "low_band": (low["d_prime"], low["criterion_c"]),
        "high_band": (high["d_prime"], high["criterion_c"]),
    }
    order = {}
    for name, (anchor_d, anchor_c) in anchors.items():
        sensitivity = rates(high["d_prime"], anchor_c)[0] - rates(low["d_prime"], anchor_c)[0]
        criterion = rates(anchor_d, high["criterion_c"])[0] - rates(anchor_d, low["criterion_c"])[0]
        order[name] = {
            "sensitivity": sensitivity,
            "criterion": criterion,
            "criterion_larger": criterion > sensitivity,
        }

    return {
        "low_band": keys[0],
        "high_band": keys[-1],
        "observed_gain": hit_high - hit_low,
        "sensitivity_only": sens_high - sens_low,
        "criterion_only": crit_high - crit_low,
        "criterion_exceeds_sensitivity": (crit_high - crit_low) > (sens_high - sens_low),
        "by_anchor": order,
        "robust": all(row["criterion_larger"] for row in order.values()),
    }


def check() -> None:
    """Fail loudly if the source this file reads has moved under it."""
    player = load()
    hit, false_alarm = rates(player["d_prime"], player["criterion_c"])
    # The pooled cell stores its rates directly, so the inversion can be checked rather than trusted.
    assert abs(hit - player["hit_rate"]) < 5e-4, (hit, player["hit_rate"])
    assert abs(false_alarm - player["false_alarm_rate"]) < 5e-4

    # STRONGER THAN THE TOLERANCE ABOVE. The stored rate is Hautus-corrected, (h + 0.5) / (n + 1),
    # so inverting it must return an INTEGER hit count if the inversion is right. It returns
    # 1489.00 on 2,080 trigger-positive items. A wrong inversion would not land on a whole number.
    implied = player["hit_rate"] * (player["n_t_plus"] + 1) - 0.5
    assert abs(implied - round(implied)) < 1e-6, f"inversion did not recover an integer: {implied}"
    # ...and the correction is negligible at this n, so the Wilson interval on the corrected rate is
    # not doing anything the raw count would not: 0.715865 raw against 0.715762 corrected.
    assert abs(round(implied) / player["n_t_plus"] - player["hit_rate"]) < 1e-3

    source = SCREEN.read_text(encoding="utf-8")
    # The hit cell must still be the PLAYED move, or this file is measuring something else entirely.
    assert 'b = r["observable_action"]' in source, "the screen no longer scores the played move"
    assert 'if r["trigger_state"] == "positive":' in source

    doc = (ROOT / "docs/measurement/RULE_CLASS_SEARCH.md").read_text(encoding="utf-8")
    assert f"| {CHANCE_RATE_T_PLUS} |".replace("0.", ".") in doc or ".317" in doc, "chance rate moved"


def main() -> int:
    check()
    player = load()
    lines: list[str] = []

    hit, false_alarm = rates(player["d_prime"], player["criterion_c"])
    n_plus, n_minus = player["n_t_plus"], player["n_t_minus"]
    lo, hi = wilson(hit * n_plus, n_plus)
    lines.append("RC-06 answer-the-mate-threat: what an UNAIDED player already does")
    lines.append("")
    lines.append(
        f"pooled hit rate      {hit:.4f}  95% CI [{lo:.4f}, {hi:.4f}]   n(T+) = {n_plus}"
    )
    lines.append(f"pooled false alarms  {false_alarm:.4f}                          n(T-) = {n_minus}")
    lines.append(f"chance rate on T+    {CHANCE_RATE_T_PLUS:.4f}   (share of legal moves satisfying B)")
    lines.append(
        f"realised range       {realised(hit):.4f}   ((H - chance) / (1 - chance))"
    )
    lines.append("")
    lines.append(
        f"{'band':12} {'d-prime':>8} {'c':>8} {'hit':>8} {'false':>8} {'n T+':>7} "
        f"{'realised':>9} {'left':>7}"
    )
    for band, values in player["by_rating_band"].items():
        band_hit, band_false = rates(values["d_prime"], values["criterion_c"])
        lines.append(
            f"{band:12} {values['d_prime']:>8.4f} {values['criterion_c']:>8.4f} "
            f"{band_hit:>8.4f} {band_false:>8.4f} {values['n_t_plus']:>7} "
            f"{realised(band_hit):>9.4f} {1 - band_hit:>7.4f}"
        )

    parts = decompose(player)
    lines.append("")
    lines.append(f"hit-rate gain, {parts['low_band']} -> {parts['high_band']}")
    lines.append(f"  observed                         {parts['observed_gain']:+.4f}")
    lines.append(f"  with the criterion held fixed    {parts['sensitivity_only']:+.4f}   (sensitivity)")
    lines.append(f"  with sensitivity held fixed      {parts['criterion_only']:+.4f}   (criterion)")
    lines.append("")
    lines.append(f"{'anchor':12} {'sensitivity':>12} {'criterion':>10}   larger")
    for name, row in parts["by_anchor"].items():
        lines.append(
            f"{name:12} {row['sensitivity']:>+12.4f} {row['criterion']:>+10.4f}   "
            f"{'criterion' if row['criterion_larger'] else 'SENSITIVITY'}"
        )
    lines.append(
        f"  -> the ordering is {'ROBUST' if parts['robust'] else 'NOT robust'} to the anchor choice"
    )
    lines.append("")
    if parts["criterion_exceeds_sensitivity"]:
        lines.append(
            "THE CRITERION TERM IS THE LARGER ONE, and the false-alarm rate rises across the bands"
        )
        lines.append(
            "rather than falling, which is the same fact from the other side."
        )
        lines.append("")
        lines.append(
            "DO NOT READ THAT AS A WILLINGNESS. `criterion_channel.py` shows RC-06's two cells score"
        )
        lines.append(
            "different acts -- a hit is 'no mate in one', a false alarm is 'no check at all' -- so no"
        )
        lines.append(
            "bias parameter is identified here. What the numbers support is narrower: the RATIO"
        )
        lines.append(
            "between stopping mate threats and leaving the opponent checkless rises with rating."
        )
    else:
        lines.append("The sensitivity term is the larger one.")

    text = "\n".join(lines) + "\n"
    out = Path(__file__).resolve().parent / "results"
    out.mkdir(exist_ok=True)
    (out / "headroom.txt").write_text(text, encoding="utf-8")
    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
