"""
SIGNAL DETECTION THEORY, AS PUBLISHED, WITH THE CORRECTION NAMED.

F5 is the falsification that says an apparent improvement in discrimination is a shift in
response criterion: a player who simply captures more often raises the hit rate AND the
false-alarm rate, and accuracy alone cannot tell the two apart. The defence is not to argue that
this will not happen. It is to never report accuracy without the two rates that produced it.

FORMULAE ARE FROM Stanislaw, H., & Todorov, N. (1999), "Calculation of signal detection theory
measures", Behavior Research Methods, Instruments, & Computers 31(1), 137-149. Nothing here is
invented; `tests/research/sdt.test.ts` pins the worked examples from that paper's tables so a
later edit that "simplifies" one of these formulae goes red.

WHAT THIS FILE CANNOT DO, stated here because it is the thing most likely to be forgotten:
d' does not repair a confounded item set. If T+ items are systematically easier than T- items,
then a participant with no discrimination ability whatsoever will still produce a hit rate above
its false-alarm rate, and d' will be positive and stable and completely uninterpretable.
`negative_controls.py::item_difficulty_confound` exists to make that failure visible.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, asdict

from scipy.stats import norm

SDT_VERSION = "1.0.0"


@dataclass(frozen=True)
class Counts:
    hits: int
    misses: int
    false_alarms: int
    correct_rejections: int

    @property
    def signal_trials(self) -> int:
        return self.hits + self.misses

    @property
    def noise_trials(self) -> int:
        return self.false_alarms + self.correct_rejections


@dataclass(frozen=True)
class Sdt:
    hit_rate: float
    false_alarm_rate: float
    d_prime: float
    criterion_c: float
    beta: float
    a_prime: float
    b_double_prime_d: float
    correction: str
    signal_trials: int
    noise_trials: int
    hits: int
    false_alarms: int

    def as_dict(self) -> dict:
        return asdict(self)


def _loglinear(counts: Counts) -> tuple[float, float]:
    """
    Hautus (1995) loglinear correction: add 0.5 to hits and false alarms, 1 to each trial total.

    APPLIED ALWAYS, NOT ONLY AT THE EXTREMES, and that choice matters. Correcting only the cells
    that came out 0 or 1 makes the correction itself depend on the data, which biases the
    corrected estimates in a direction that varies with the true rate. Hautus's comparison of
    corrections is the reason this is the default rather than the 1/(2N) rule; applying it
    uniformly is what that recommendation actually is.
    """
    h = (counts.hits + 0.5) / (counts.signal_trials + 1.0)
    f = (counts.false_alarms + 0.5) / (counts.noise_trials + 1.0)
    return h, f


def compute(counts: Counts, correction: str = "loglinear") -> Sdt:
    """
    d', c, beta, A' and B''_D from one 2x2 table.

    `correction="none"` is available and will raise on a degenerate table rather than return
    infinity, because an infinite d' reported as a number is how a ceiling effect gets published
    as a large effect.
    """
    if correction == "loglinear":
        h, f = _loglinear(counts)
    elif correction == "none":
        if counts.signal_trials == 0 or counts.noise_trials == 0:
            raise ValueError("no trials of one type; d' is undefined, not infinite")
        h = counts.hits / counts.signal_trials
        f = counts.false_alarms / counts.noise_trials
        if h in (0.0, 1.0) or f in (0.0, 1.0):
            raise ValueError(
                "extreme rate with correction='none'; z(0) and z(1) are infinite. "
                "Choose a correction and say which one you chose."
            )
    else:
        raise ValueError(f"unknown correction {correction!r}")

    zh, zf = norm.ppf(h), norm.ppf(f)
    d = zh - zf
    c = -0.5 * (zh + zf)
    # beta as the likelihood ratio at the criterion (S&T eq. for the equal-variance model).
    beta = math.exp((zf * zf - zh * zh) / 2.0)

    # A' and B''_D: the nonparametric pair. Reported BESIDE d', never instead of it, because
    # they make a different (weaker) assumption and can disagree -- and when they disagree, the
    # equal-variance assumption is what is being called into question.
    if h >= f:
        a_prime = 0.5 + ((h - f) * (1 + h - f)) / (4 * h * (1 - f))
    else:
        a_prime = 0.5 - ((f - h) * (1 + f - h)) / (4 * f * (1 - h))

    num = h * (1 - h) - f * (1 - f)
    den = h * (1 - h) + f * (1 - f)
    b_dd = num / den if den != 0 else 0.0

    return Sdt(
        hit_rate=h,
        false_alarm_rate=f,
        d_prime=d,
        criterion_c=c,
        beta=beta,
        a_prime=a_prime,
        b_double_prime_d=b_dd,
        correction=correction,
        signal_trials=counts.signal_trials,
        noise_trials=counts.noise_trials,
        hits=counts.hits,
        false_alarms=counts.false_alarms,
    )


def from_trials(trials) -> Counts:
    """
    Fold an iterable of (trigger_state, behaviour) into a 2x2 table.

    `trigger_state` must be "positive" or "negative" and `behaviour` must be 0 or 1. Anything
    else raises. An UNKNOWN item reaching a scoring function is a bug in the item bank, and the
    right response to it is a crash rather than a quietly smaller denominator.
    """
    h = m = fa = cr = 0
    for state, behaviour in trials:
        if behaviour not in (0, 1):
            raise ValueError(f"behaviour must be 0 or 1, got {behaviour!r}")
        if state == "positive":
            h += behaviour
            m += 1 - behaviour
        elif state == "negative":
            fa += behaviour
            cr += 1 - behaviour
        else:
            raise ValueError(
                f"trigger_state {state!r} may not be scored; UNKNOWN items are excluded "
                "by the item bank, not by the scorer"
            )
    return Counts(hits=h, misses=m, false_alarms=fa, correct_rejections=cr)


def wilson_interval(successes: int, trials: int, z: float = 1.96) -> tuple[float, float]:
    """
    Wilson score interval for a proportion.

    WILSON RATHER THAN WALD because the rates here go near 0 and 1 by design -- a strong player's
    false-alarm rate is supposed to be small -- and the Wald interval is known to have coverage
    far below nominal there and to produce bounds outside [0, 1]. Brown, Cai & DasGupta (2001).
    """
    if trials == 0:
        return (float("nan"), float("nan"))
    p = successes / trials
    denom = 1 + z * z / trials
    centre = (p + z * z / (2 * trials)) / denom
    half = (z * math.sqrt(p * (1 - p) / trials + z * z / (4 * trials * trials))) / denom
    return (max(0.0, centre - half), min(1.0, centre + half))


def standardized_mean_difference(a, b) -> float:
    """
    Cohen's d on two samples, used for F2's covariate balance rather than for an effect.

    A convention this program does NOT adopt: that |d| < 0.1 means "balanced". That number is a
    what-works-clearinghouse baseline-equivalence convention for a different design; whether it
    is the right bar here has not been established, so the number is REPORTED and the reader is
    told what it is not.
    """
    import statistics

    a, b = list(a), list(b)
    if len(a) < 2 or len(b) < 2:
        return float("nan")
    va, vb = statistics.variance(a), statistics.variance(b)
    pooled = math.sqrt(((len(a) - 1) * va + (len(b) - 1) * vb) / (len(a) + len(b) - 2))
    if pooled == 0:
        return 0.0
    return (statistics.mean(a) - statistics.mean(b)) / pooled
