"""Is the SDT criterion on a rule class a fact about the PLAYER, or about the PREDICATE?

WHY THIS FILE EXISTS. [H18](../../docs/learning-v2/FALSIFICATION_REGISTER.md) reported that most of
the rating-band improvement in RC-06 behaviour is criterion rather than sensitivity, and
[H19](../../docs/learning-v2/FALSIFICATION_REGISTER.md) built a harm argument on top of that: an
intervention that shifts the criterion would raise the trigger-positive hit rate while raising false
application too, and false application is expensive. Both entries treated *c* as a property of the
player -- a willingness, a readiness, a bias.

THIS FILE ASKS WHETHER IT IS ONE, and the answer is mostly no.

    1. RC-06'S TWO CELLS DO NOT SCORE THE SAME ACT. `_threat_satisfies` is the only predicate of the
       seventeen screened that BRANCHES ON THE TRIGGER -- it was the only one of twelve when this
       was written, and stayed the only one when five more landed. On T+ it asks "does the
       opponent still have mate in
       one"; on T- it asks "does the opponent still have ANY CHECK". A hit and a false alarm are
       therefore different behaviours, and signal-detection theory -- whose whole content is that
       one response is scored against two states of the world -- does not apply to that pair.
       `rule_classes.py` documents WHY it branches (the symmetric version made the noise cell
       degenerate, P(B|T-) near 1) and is right to. What was never drawn is the consequence for the
       criterion.

    2. A MOVE-BLIND AGENT SCORES d' = 0.80 AND c = +0.88 ON RC-06. Pick uniformly among legal moves,
       know nothing, discriminate nothing: the measured prescription sizes (.317 on T+, .101 on T-)
       are hit and false-alarm rates on their own. More than half of the bottom rating band's d' of
       1.180 is available without any knowledge of chess.

    3. ACROSS THE RULE CLASSES, MOVE-BLIND c PREDICTS OBSERVED c AT r = +0.50 on the 17-class
       screen -- a quarter of the variance in a quantity read as a psychological bias, from
       geometry with no player in it. IT WAS +0.72 ON THE 12-CLASS SCREEN, and the drop when five
       classes landed is recorded rather than smoothed over: this is the weakest of the three legs
       and the only one that moved. The other two -- the branching predicate and the controlled
       pair below -- are unchanged, because neither depends on which OTHER rule classes exist.

    4. AND THE REPOSITORY ALREADY CONTAINS THE CONTROLLED EXPERIMENT. `RC-09` and `RC-11` were built
       to share a trigger, a corpus and a noise cell and to differ in ONE thing: whether B names an
       OUTCOME ("the threat is gone") or a METHOD ("move the piece"). Same players, same positions.
       The criterion moves by 0.52 -- larger than the entire rating-band shift H18 was about --
       and predicate geometry predicts most of it.

WHAT THIS DOES NOT SAY. That the rule-class screen is wrong: `B_valid` is adjudicated by an engine
against the rule, never by SDT, and the eligibility gates do not read *c* at all. That players do
not differ: they plainly do, and `d'` corrected for the move-blind floor still orders the bands.
Only that **the criterion, as measured here, is not clean enough to carry an argument about what an
intervention would do to a player's willingness** -- which is exactly the weight H18 and H19 put on
it.

NOTHING HERE TOUCHES THE PRODUCT. It imports nothing from `shared/`, is on no build path, and reads
one results file plus the rule-class definitions, both asserted against below.
"""

from __future__ import annotations

import inspect
import json
import sys
from math import sqrt
from pathlib import Path
from statistics import NormalDist, mean

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "research/measurement/results/rule_class_screen_raw.json"
sys.path.insert(0, str(ROOT / "research/measurement"))

NORMAL = NormalDist()

#: The pair `RC-11` exists to create: same trigger, same corpus, same noise cell, and B written as a
#: METHOD instead of an OUTCOME. Named here so the comparison is declared rather than discovered.
SHAPE_PAIR = ("RC-09", "RC-11")
BOOTSTRAP = 20_000
SEED = 20260901

#: A rule class is left out of the sensitivity cut when its behaviour sits on the response floor,
#: where d' and c are carried by the Hautus correction rather than by anything a player did.
#: POST HOC, AND SAID SO. The order was: the correlation dropped when the screen grew, RC-13 was
#: found to be the largest outlier, and only then was this rule written. It also removes RC-14,
#: which nobody had looked at. That is why `main()` prints the filtered AND unfiltered figures
#: rather than the better one.
FLOOR_MIN_ITEMS = 250
FLOOR_RATE = 0.02


def z(p: float) -> float:
    return NORMAL.inv_cdf(min(max(p, 1e-6), 1 - 1e-6))


def sdt(hit: float, false_alarm: float) -> tuple[float, float]:
    """(d', c) from two rates, the same definitions `research/measurement/sdt.py` uses."""
    return z(hit) - z(false_alarm), -(z(hit) + z(false_alarm)) / 2


def rates(d_prime: float, criterion: float) -> tuple[float, float]:
    """The inverse. Exact: the two equations leave no freedom."""
    return NORMAL.cdf(d_prime / 2 - criterion), NORMAL.cdf(-d_prime / 2 - criterion)


def loglinear(hits: int, n_signal: int, false_alarms: int, n_noise: int) -> tuple[float, float]:
    """Hautus (1995), as `sdt.py::_loglinear` applies it."""
    return (hits + 0.5) / (n_signal + 1.0), (false_alarms + 0.5) / (n_noise + 1.0)


def a_prime(hit: float, false_alarm: float) -> float:
    """Non-parametric sensitivity.

    HERE BECAUSE d' AND c ASSUME EQUAL-VARIANCE GAUSSIAN DISTRIBUTIONS and one (H, F) point per
    cell cannot test that assumption. A' makes no distributional assumption, so agreement between
    the two is evidence the parametric pair is not being carried by its assumptions. It is NOT a
    fix for the branching predicate -- nothing computed from these two cells is.
    """
    if hit >= false_alarm:
        return 0.5 + ((hit - false_alarm) * (1 + hit - false_alarm)) / (4 * hit * (1 - false_alarm))
    return 0.5 - ((false_alarm - hit) * (1 + false_alarm - hit)) / (4 * false_alarm * (1 - hit))


def b_double_prime_d(hit: float, false_alarm: float) -> float:
    """Donaldson's non-parametric bias, on [-1, 1]. Positive is conservative, as c is."""
    num = (1 - hit) * (1 - false_alarm) - hit * false_alarm
    den = (1 - hit) * (1 - false_alarm) + hit * false_alarm
    return num / den if den else 0.0


def pearson(a: list[float], b: list[float]) -> float:
    ma, mb = mean(a), mean(b)
    num = sum((x - ma) * (y - mb) for x, y in zip(a, b))
    den = sqrt(sum((x - ma) ** 2 for x in a) * sum((y - mb) ** 2 for y in b))
    return num / den if den else float("nan")


def load() -> dict:
    return json.loads(RAW.read_text(encoding="utf-8"))["rule_classes"]


def branching_predicates() -> dict[str, bool]:
    """Which rule classes recompute the trigger inside `satisfies`.

    READ FROM THE SOURCE OF THE SHIPPED PREDICATE, not from a list maintained here, so a rule class
    that starts or stops branching shows up as a changed table rather than as a stale claim.
    """
    from rule_classes import RULE_CLASSES  # noqa: PLC0415 - path set above

    out = {}
    for rule in RULE_CLASSES:
        source = inspect.getsource(rule.satisfies)
        # THE DEFINING PROPERTY IS RECOMPUTING THE TRIGGER, not mentioning a variable called
        # `state`. An earlier version of this function also accepted `"state ==" in source`, and a
        # mutation control caught it: blanking the trigger call left the comparison behind and the
        # predicate still scored as branching. A detector that survives its own mutation is not a
        # detector.
        out[rule.id] = "_trigger(" in source
    return out


def band_counts(player: dict) -> dict[str, dict[str, int]]:
    """Recover integer hit and false-alarm counts per rating band.

    THE STORED RATE IS HAUTUS-CORRECTED, so inverting it must land on a whole number. It does, on
    every band, which is what licenses treating these as counts and bootstrapping them.
    """
    out = {}
    for band, values in player["by_rating_band"].items():
        hit, false_alarm = rates(values["d_prime"], values["criterion_c"])
        n_p, n_m = values["n_t_plus"], values["n_t_minus"]
        h = hit * (n_p + 1) - 0.5
        f = false_alarm * (n_m + 1) - 0.5
        assert abs(h - round(h)) < 1e-3, (band, h)
        assert abs(f - round(f)) < 1e-3, (band, f)
        out[band] = {"hits": round(h), "n_t_plus": n_p, "false_alarms": round(f), "n_t_minus": n_m}
    return out


def decomposition_uncertainty(counts: dict[str, dict[str, int]], pooled: tuple[float, float]) -> dict:
    """H18's decomposition, with the interval it was published without.

    H18 reported +12.3 points of hit-rate gain attributable to the criterion against +8.1 to
    sensitivity, and gave no uncertainty at all. The claim that survives or fails is the ORDER, so
    what is reported is P(criterion term > sensitivity term) under resampling of the four 2x2
    tables, not a p-value against zero.
    """
    rng = np.random.default_rng(SEED)
    keys = list(counts)
    low, high = counts[keys[0]], counts[keys[-1]]
    pooled_d, pooled_c = pooled

    def draw(cell: dict) -> tuple[float, float]:
        h = rng.binomial(cell["n_t_plus"], cell["hits"] / cell["n_t_plus"], BOOTSTRAP)
        f = rng.binomial(cell["n_t_minus"], cell["false_alarms"] / cell["n_t_minus"], BOOTSTRAP)
        hit = (h + 0.5) / (cell["n_t_plus"] + 1.0)
        fa = (f + 0.5) / (cell["n_t_minus"] + 1.0)
        return hit, fa

    def zz(p):  # vectorised probit
        from scipy.special import ndtri  # noqa: PLC0415

        return ndtri(p)

    def phi(x):
        from scipy.special import ndtr  # noqa: PLC0415

        return ndtr(x)

    h_lo, f_lo = draw(low)
    h_hi, f_hi = draw(high)
    d_lo, c_lo = zz(h_lo) - zz(f_lo), -(zz(h_lo) + zz(f_lo)) / 2
    d_hi, c_hi = zz(h_hi) - zz(f_hi), -(zz(h_hi) + zz(f_hi)) / 2

    sensitivity = phi(d_hi / 2 - pooled_c) - phi(d_lo / 2 - pooled_c)
    criterion = phi(pooled_d / 2 - c_hi) - phi(pooled_d / 2 - c_lo)
    return {
        "sensitivity_mean": float(sensitivity.mean()),
        "sensitivity_ci": [float(np.percentile(sensitivity, 2.5)), float(np.percentile(sensitivity, 97.5))],
        "criterion_mean": float(criterion.mean()),
        "criterion_ci": [float(np.percentile(criterion, 2.5)), float(np.percentile(criterion, 97.5))],
        "p_criterion_larger": float((criterion > sensitivity).mean()),
    }


def check() -> None:
    """Fail loudly if what this file reads has moved under it.

    NOT VACUOUS, and that was verified the way this repository verifies a control: each assertion
    was made to fail on a deliberately mutated source before being relied on.
    """
    classes = load()
    branching = branching_predicates()

    # WHAT THE ARGUMENT DEPENDS ON, asserted hard. RC-06's branch is the first finding; without it
    # there is no §1 and no H20.
    assert branching.get("RC-06") is True, "RC-06's predicate no longer branches on the trigger"

    # WHAT THE ARGUMENT DOES NOT DEPEND ON, deliberately not asserted. The severity ladder is an
    # open workstream and more rule classes are landing; a hard "exactly one brancher" here would
    # turn somebody else's new rule into a failure of this file. The count is REPORTED instead, and
    # the document scopes its claim to the classes present when it was written, so growth shows up
    # as a number that moved rather than as a stale sentence nobody re-read.
    others = sorted(k for k, v in branching.items() if v and k != "RC-06")
    if others:
        print(
            f"NOTE: {len(others)} rule class(es) besides RC-06 now branch on the trigger: {others}. "
            "The document's 'only branching predicate' claim needs re-reading against this list. "
            "and needs re-reading against this list.",
            file=sys.stderr,
        )

    # The controlled pair is only controlled while it really shares both cells.
    a = classes[SHAPE_PAIR[0]]["player_behaviour_secondary"]
    b = classes[SHAPE_PAIR[1]]["player_behaviour_secondary"]
    assert a["n_t_plus"] == b["n_t_plus"] and a["n_t_minus"] == b["n_t_minus"], (
        "RC-09 and RC-11 no longer share their item cells; the outcome-vs-method comparison is void"
    )


def main() -> int:
    check()
    classes = load()
    branching = branching_predicates()
    lines: list[str] = []

    # ---------------------------------------------------------------- 1. the predicate asymmetry
    lines.append("1. WHICH PREDICATES SCORE THE SAME ACT ON BOTH CELLS")
    lines.append("")
    branchers = sorted(k for k, v in branching.items() if v)
    lines.append(f"   rule classes whose `satisfies` recomputes the trigger: {branchers or 'none'}")
    lines.append(f"   ...out of {len(branching)} measured.")
    lines.append("")
    lines.append("   On RC-06 a HIT means 'the opponent no longer has mate in one' and a FALSE ALARM")
    lines.append("   means 'the opponent no longer has ANY CHECK'. Those are different acts, so the")
    lines.append("   pair is not a signal-detection contrast and c is not a response bias.")
    lines.append("")

    # ---------------------------------------------------------------- 2/3. the move-blind anchor
    lines.append("2. WHAT AN AGENT THAT PICKS UNIFORMLY AMONG LEGAL MOVES SCORES")
    lines.append("")
    lines.append(
        f"   {'id':6} {'name':28} {'sz T+':>7} {'sz T-':>7} {'blind d':>8} {'blind c':>8} "
        f"{'obs d':>8} {'obs c':>8} {'corr c':>9} {'branch':>7}"
    )
    rows = []
    for key, rule in classes.items():
        player = rule.get("player_behaviour_secondary")
        valid = rule.get("c4_prescriptive_validity")
        if not player or "error" in player or not valid:
            continue
        size_p = valid["t_plus"].get("prescription_size_mean")
        size_m = valid["t_minus"].get("prescription_size_mean")
        if size_p is None or size_m is None:
            continue
        blind_d, blind_c = sdt(size_p, size_m)
        rows.append(
            {
                "id": key,
                "name": rule["name"],
                "size_t_plus": size_p,
                "size_t_minus": size_m,
                "blind_d_prime": blind_d,
                "blind_c": blind_c,
                "observed_d_prime": player["d_prime"],
                "observed_c": player["criterion_c"],
                # THE CORRECTION THIS FILE PROPOSES: subtract the criterion a move-blind agent
                # would score on this rule class's own predicate sizes. What is left is the part
                # of the bias that is not the predicate's shape.
                "corrected_c": player["criterion_c"] - blind_c,
                "observed_hit": player["hit_rate"],
                "observed_n_t_plus": player["n_t_plus"],
                "observed_false_alarm": player["false_alarm_rate"],
                "branches": branching.get(key),
            }
        )
        lines.append(
            f"   {key:6} {rule['name']:28} {size_p:7.4f} {size_m:7.4f} {blind_d:8.4f} {blind_c:8.4f} "
            f"{player['d_prime']:8.4f} {player['criterion_c']:8.4f} "
            f"{player['criterion_c'] - blind_c:9.4f} {'YES' if branching.get(key) else '-':>7}"
        )

    r_c = pearson([r["blind_c"] for r in rows], [r["observed_c"] for r in rows])
    r_d = pearson([r["blind_d_prime"] for r in rows], [r["observed_d_prime"] for r in rows])
    lines.append("")
    lines.append(f"   n = {len(rows)} rule classes")
    lines.append(f"   r(move-blind c, observed c)       = {r_c:+.4f}   -> {r_c**2:.0%} of the variance")
    lines.append(f"   r(move-blind d', observed d')     = {r_d:+.4f}   -> {r_d**2:.0%} of the variance")

    # SENSITIVITY, BECAUSE ONE CUT IS A CHOICE AND THREE ARE A RANGE. Two of the newer classes sit
    # on the response floor -- `RC-13 underpromote-to-knight` has a hit rate of .007 on 67 items --
    # and SDT estimates there are carried by the loglinear correction rather than by behaviour.
    # Dropping them RAISES r, so reporting only the full set would understate the effect and
    # reporting only the filtered set would overstate it. Both are printed, and neither is "the"
    # number.
    usable = [
        r for r in rows
        if r["observed_n_t_plus"] >= FLOOR_MIN_ITEMS and FLOOR_RATE < r["observed_hit"] < 1 - FLOOR_RATE
    ]
    excluded = sorted(r["id"] for r in rows if r not in usable)
    if excluded:
        r_usable = pearson([r["blind_c"] for r in usable], [r["observed_c"] for r in usable])
        lines.append("")
        lines.append(
            f"   dropping {len(excluded)} class(es) on the response floor {excluded}:"
        )
        lines.append(
            f"   r(move-blind c, observed c)       = {r_usable:+.4f}   -> {r_usable**2:.0%} "
            f"of the variance, on n = {len(usable)}"
        )
    else:
        r_usable = r_c
    lines.append("")

    # ---------------------------------------------------------------- 4. the controlled pair
    lines.append("3. THE CONTROLLED PAIR ALREADY IN THE DATA: OUTCOME vs METHOD")
    lines.append("")
    pair = {r["id"]: r for r in rows if r["id"] in SHAPE_PAIR}
    shape = None
    if len(pair) == 2:
        a, b = pair[SHAPE_PAIR[0]], pair[SHAPE_PAIR[1]]
        same_items = (
            classes[SHAPE_PAIR[0]]["player_behaviour_secondary"]["n_t_plus"]
            == classes[SHAPE_PAIR[1]]["player_behaviour_secondary"]["n_t_plus"]
            and classes[SHAPE_PAIR[0]]["player_behaviour_secondary"]["n_t_minus"]
            == classes[SHAPE_PAIR[1]]["player_behaviour_secondary"]["n_t_minus"]
        )
        lines.append(f"   {a['id']} {a['name']:28} B names an OUTCOME")
        lines.append(f"   {b['id']} {b['name']:28} B names a METHOD")
        lines.append(f"   identical item counts on both cells: {same_items}")
        lines.append("")
        d_obs = b["observed_c"] - a["observed_c"]
        d_blind = b["blind_c"] - a["blind_c"]
        lines.append(f"   observed c    {a['observed_c']:+.4f} -> {b['observed_c']:+.4f}   = {d_obs:+.4f}")
        lines.append(f"   move-blind c  {a['blind_c']:+.4f} -> {b['blind_c']:+.4f}   = {d_blind:+.4f}")
        lines.append(f"   predicate geometry accounts for {d_blind / d_obs:.0%} of the shift")
        lines.append("")
        lines.append("   SAME PLAYERS, SAME POSITIONS, SAME TRIGGER, SAME NOISE CELL. The only thing")
        lines.append("   that changed is how the prescription is written, and the criterion moved by")
        lines.append(f"   {abs(d_obs):.2f} -- larger than the whole rating-band shift H18 was about.")
        # DOES THE CORRECTION ACTUALLY IDENTIFY ANYTHING? This pair is the only place it can be
        # tested: the same players making the same decisions on the same positions, scored by two
        # differently-shaped predicates. A criterion that is a property OF THE PLAYER must come out
        # the same on both. Raw, it does not. Corrected, it comes much closer -- and not all the way,
        # which is the honest limit of the correction rather than a rounding error.
        d_corr = b["corrected_c"] - a["corrected_c"]
        lines.append(f"   corrected c   {a['corrected_c']:+.4f} -> {b['corrected_c']:+.4f}   = {d_corr:+.4f}")
        lines.append("")
        lines.append(
            f"   THE CORRECTION'S OWN TEST: raw disagreement {abs(d_obs):.4f}, corrected "
            f"{abs(d_corr):.4f} -- {abs(d_obs) / abs(d_corr):.1f}x more consistent."
        )
        lines.append("   It does not reach zero. A chance-corrected criterion is better behaved than a")
        lines.append("   raw one and is still not a clean player parameter.")
        shape = {
            "observed_delta_c": d_obs,
            "blind_delta_c": d_blind,
            "corrected_delta_c": d_corr,
            "consistency_gain": abs(d_obs) / abs(d_corr),
            "share_explained": d_blind / d_obs,
            "same_items": same_items,
        }
    lines.append("")

    # ---------------------------------------------------------------- 5. non-parametric check
    lines.append("4. DOES RC-06's BAND PATTERN SURVIVE DROPPING THE EQUAL-VARIANCE ASSUMPTION?")
    lines.append("")
    rc06 = classes["RC-06"]["player_behaviour_secondary"]
    counts = band_counts(rc06)
    lines.append(
        f"   {'band':12} {'hits':>6}/{'n':<6} {'FA':>6}/{'n':<7} {'d prime':>8} {'c':>8} "
        f"{'A prime':>8} {'Bpp D':>8}"
    )
    nonparam = {}
    for band, cell in counts.items():
        hit, false_alarm = loglinear(cell["hits"], cell["n_t_plus"], cell["false_alarms"], cell["n_t_minus"])
        d_p, c_p = sdt(hit, false_alarm)
        ap, bd = a_prime(hit, false_alarm), b_double_prime_d(hit, false_alarm)
        nonparam[band] = {"a_prime": ap, "b_double_prime_d": bd, "d_prime": d_p, "criterion_c": c_p}
        lines.append(
            f"   {band:12} {cell['hits']:>6}/{cell['n_t_plus']:<6} {cell['false_alarms']:>6}/"
            f"{cell['n_t_minus']:<7} {d_p:8.4f} {c_p:8.4f} {ap:8.4f} {bd:8.4f}"
        )
    a_vals = [v["a_prime"] for v in nonparam.values()]
    b_vals = [v["b_double_prime_d"] for v in nonparam.values()]
    a_mono = all(y >= x for x, y in zip(a_vals, a_vals[1:]))
    b_mono = all(y <= x for x, y in zip(b_vals, b_vals[1:]))
    lines.append("")
    lines.append(f"   A' rises monotonically with rating:  {a_mono}   ({a_vals[0]:.4f} -> {a_vals[-1]:.4f})")
    lines.append(f"   B''D falls monotonically with rating: {b_mono}   ({b_vals[0]:+.4f} -> {b_vals[-1]:+.4f})")
    lines.append("   Both agree with the parametric pair, so the equal-variance assumption is not what")
    lines.append("   is carrying H18. The BRANCHING PREDICATE still is, and no measure computed from")
    lines.append("   these two cells can repair that.")
    lines.append("")

    # ---------------------------------------------------------------- 6. the missing interval
    lines.append("5. THE INTERVAL H18 WAS PUBLISHED WITHOUT")
    lines.append("")
    unc = decomposition_uncertainty(counts, (rc06["d_prime"], rc06["criterion_c"]))
    lines.append(
        f"   sensitivity term  {unc['sensitivity_mean']:+.4f}  95% [{unc['sensitivity_ci'][0]:+.4f}, "
        f"{unc['sensitivity_ci'][1]:+.4f}]"
    )
    lines.append(
        f"   criterion term    {unc['criterion_mean']:+.4f}  95% [{unc['criterion_ci'][0]:+.4f}, "
        f"{unc['criterion_ci'][1]:+.4f}]"
    )
    lines.append(f"   P(criterion term > sensitivity term) = {unc['p_criterion_larger']:.4f}   ({BOOTSTRAP:,} draws)")
    lines.append("")
    lines.append("   The ORDER H18 asserted is well supported by the sampling. That was never the weak")
    lines.append("   part of H18; the weak part is what the criterion MEANS, which no amount of")
    lines.append("   resampling touches.")
    lines.append("")

    # ------------------------------------------------- 6. how much drift would explain it away
    lines.append("6. THE ALTERNATIVE THIS PASS CANNOT RULE OUT, BOUNDED")
    lines.append("")
    lines.append("   If stronger players' games contain structurally different T- positions, their")
    lines.append("   move-blind criterion differs too, and part of the observed shift is composition")
    lines.append("   rather than anything psychological. The item-level records are not on disk, so")
    lines.append("   this cannot be tested -- only bounded, by asking how much the chance rates would")
    lines.append("   have to move to produce the whole shift on their own.")
    lines.append("")
    blind = next(r for r in rows if r["id"] == "RC-06")
    bands = list(counts)
    c_lo = rc06["by_rating_band"][bands[0]]["criterion_c"]
    c_hi = rc06["by_rating_band"][bands[-1]]["criterion_c"]
    observed_shift = c_hi - c_lo
    size_p, size_m = blind["size_t_plus"], blind["size_t_minus"]
    # c_blind = -(z(p_plus) + z(p_minus)) / 2, so producing a shift of `observed_shift` needs the
    # sum of the two probits to rise by twice its magnitude. Two extremes are reported because the
    # truth is somewhere between and neither endpoint is privileged.
    need = -2 * observed_shift
    only_minus = NORMAL.cdf(z(size_m) + need)
    both_p = NORMAL.cdf(z(size_p) + need / 2)
    both_m = NORMAL.cdf(z(size_m) + need / 2)
    lines.append(f"   observed criterion shift, {bands[0]} -> {bands[-1]}: {observed_shift:+.4f}")
    lines.append("")
    lines.append(f"   if ONLY the T- chance rate drifts:  {size_m:.4f} -> {only_minus:.4f}  "
                 f"({only_minus / size_m:.2f}x)")
    lines.append(f"   if BOTH drift equally:              T+ {size_p:.4f} -> {both_p:.4f}  "
                 f"({both_p / size_p:.2f}x),  T- {size_m:.4f} -> {both_m:.4f} ({both_m / size_m:.2f}x)")
    lines.append("")
    lines.append("   Those are large. Explaining the WHOLE shift by composition is implausible;")
    lines.append("   explaining PART of it needs only a modest drift, and part is all it takes to")
    lines.append("   make the remainder uninterpretable. NOT RULED OUT.")
    lines.append("")
    drift = {
        "observed_criterion_shift": observed_shift,
        "t_minus_only": {"from": size_m, "to": only_minus, "ratio": only_minus / size_m},
        "both_equally": {
            "t_plus": {"from": size_p, "to": both_p, "ratio": both_p / size_p},
            "t_minus": {"from": size_m, "to": both_m, "ratio": both_m / size_m},
        },
    }

    # ---------------------------------------------------------------- verdict
    lines.append("VERDICT")
    lines.append("")
    lines.append(
        f"   RC-06's move-blind floor is d' = {blind['blind_d_prime']:.4f}, against a measured "
        f"{rc06['by_rating_band'][list(rc06['by_rating_band'])[0]]['d_prime']:.4f} in the lowest band."
    )
    lines.append("   Sensitivity above that floor still orders the rating bands and still has room to")
    lines.append("   grow. The CRITERION does not survive as a player parameter: RC-06's two cells")
    lines.append(
        f"   score different acts, and across the {len(rows)} rule classes {r_c**2:.0%} of the "
        "variance in c is"
    )
    lines.append("   predicted by predicate geometry alone.")
    lines.append("")
    non_branching = sum(1 for v in branching.values() if not v)
    lines.append("   So the criterion channel is not a thing to intervene on here. It is a thing to")
    lines.append("   MEASURE PROPERLY FIRST, on a rule class whose predicate does not branch -- of")
    lines.append(f"   which this screen already contains {non_branching}.")

    text = "\n".join(lines) + "\n"
    out = Path(__file__).resolve().parent / "results"
    out.mkdir(exist_ok=True)
    (out / "criterion_channel.txt").write_text(text, encoding="utf-8")
    (out / "criterion_channel.json").write_text(
        json.dumps(
            {
                "branching_predicates": branching,
                "rule_classes": rows,
                "r_blind_c_observed_c": r_c,
                "r_blind_c_observed_c_off_floor": r_usable,
                "floor_excluded": excluded,
                "r_blind_d_observed_d": r_d,
                "shape_pair": shape,
                "rc06_bands_nonparametric": nonparam,
                "decomposition_uncertainty": unc,
                "composition_drift_bound": drift,
                "bootstrap_draws": BOOTSTRAP,
                "seed": SEED,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
