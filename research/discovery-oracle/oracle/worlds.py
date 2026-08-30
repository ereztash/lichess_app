"""Simulated records whose truth is known, because nothing else can grade this product.

WHY SIMULATION AT ALL. The four questions in `docs/discovery-v2/M0_AUDIT.md` are about the rate at
which a chain of steps emits a claim that is not true. That rate cannot be read off a record: a
real record does not come with a label saying whether the player really is worse in the endgame.
It can only be measured where the answer is fixed in advance, which means generated worlds.

THE ONE PROPERTY THAT MATTERS, and the first version of this file got it wrong. A null world is
not a world where nothing varies. Confidence varies by phase and by think time, accuracy varies
with both, everything varies by game -- all of that is realism and all of it is here. A null world
is one where the CALIBRATION GAP does not vary with any feature the detector can read.

THAT IS CONSTRUCTED, NOT HOPED FOR, AND THE ORDER IS THE WHOLE OF IT:

    stated   is drawn from the features and a game-level latent, onto the product's grid
    p        is then set to  stated - gap - tilt_g          (never the other way round)
    accurate ~ Bernoulli(p)

so gap_i = stated_i - accurate_i has E[gap_i | anything the features determine] = gap + tilt_g,
EXACTLY, with no appeal to a large sample and no dependence on the grid. Drawing p from the
features first and rounding a confidence onto the grid afterwards -- the obvious way round -- makes
the quantisation error a function of the features, and `shared/confidence.ts` measures that error
at up to 0.6 points of gap across difficulty streams. That is a tenth of the weakest effect this
harness plants, in every "null" world, for free.

NOTHING IS CLIPPED, and that is a constraint on the parameters rather than a line of code. The
first version clipped p into (0.02, 0.98) and the self-test caught it: a clip is a systematic
shift that bites hardest where confidence is extreme, and confidence is a function of phase, so
the clip WAS a phase effect. The stated confidence is therefore confined to the middle levels of
the grid, and `tilt_g` to three standard deviations, so that p lands in range on its own. The
assertion in the loop is what keeps that a fact rather than an intention.

WHY tilt_g EXISTS. Without a game-level term in the GAP, the residuals are conditionally
independent and clustering can make no difference -- the Moulton factor is 1 + (m-1)·rho_x·rho_e
and rho_e would be zero. A world built that way would answer Q1 "clustering does not matter" by
construction rather than by measurement. tilt_g is the player who was tilted for a whole game: it
is the most ordinary thing in the domain, and it is what makes the question live.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field, replace

import numpy as np

# The stated-confidence grid. Present so a LEVEL can be chosen; the level is what crosses to
# TypeScript, and `normaliseConfidence` there is the only authority on what a level asserts.
# Duplicated deliberately and asserted against the product in `tests/research/oracle-parity`.
CONFIDENCE_GRID = np.array([0.05, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95])

OPENING = 0
MIDDLEGAME = 1
ENDGAME = 2


@dataclass(frozen=True)
class WorldSpec:
    """One world: the parameters, and nothing about what is planted in it."""

    name: str
    #: Standard deviation of the game-level GAP shift. This is the term clustering exists for.
    sigma_tilt: float = 0.06
    #: Game-level shift of how confident the player is, on the latent scale.
    sigma_conf: float = 0.35
    #: Game-level shift of how fast the player moves, on the log-seconds scale.
    sigma_pace: float = 0.45
    #: Within-game noise of the latent confidence.
    sigma_conf_noise: float = 0.55
    #: Within-game noise of log seconds.
    sigma_time: float = 0.75
    #: The player's constant miscalibration. Positive = says more than comes out, everywhere.
    gap: float = 0.10
    #: Where the player's stated confidence sits, and the band it is confined to.
    #:
    #: THE BAND IS A CONSTRAINT, NOT A PREFERENCE. `p = stated - gap - tilt` has to land inside
    #: (0, 1) without being clipped, and a clip is a feature-dependent bias -- see the module
    #: docstring. floor - gap - 3*sigma_tilt > 0 and ceiling - gap + 3*sigma_tilt < 1 are what
    #: these three numbers are for, and the assertion in the loop is what enforces them.
    confidence_centre: float = 0.66
    confidence_floor: float = 0.50
    confidence_ceiling: float = 0.80
    #: Mean of the player's decisions per game, and the shape of the spread.
    game_length_mean: float = 26.0
    game_length_dispersion: float = 0.22
    #: Probability that a whole game carries no clock readings at all (an import).
    clockless_game_rate: float = 0.0
    #: Probability that one decision's clock reading is missing, given the game has clocks.
    clock_missing_rate: float = 0.0
    #: When true, a decision's clock is more likely to be missing the faster it was taken.
    missingness_informative: bool = False
    #: When true, the clock reading is very nearly a function of the think time (a near-duplicate).
    clock_duplicates_time: bool = False
    #: Total drift in the player's overall gap across the whole record. Global, never by bucket.
    gap_drift_total: float = 0.0
    #: Mixture weight of a second population of games with different marginals.
    imported_share: float = 0.0
    #: Time controls drawn per game, as (initial_ms, increment_ms, weight).
    #:
    #: SPREAD ACROSS FOUR ORDERS OF PACE ON PURPOSE. The think-time budget below is derived from
    #: the control, so a three-minute game is a game where every decision is inside
    #: `fast-under-45s` and the late ones are inside `clock-under-1m`, and a thirty-minute game is
    #: a game where most are inside neither. That is where the within-game correlation of BUCKET
    #: MEMBERSHIP comes from, and without it the clustered and unclustered errors would agree by
    #: construction rather than by measurement.
    time_controls: tuple[tuple[int, int, float], ...] = (
        (180_000, 0, 0.30),
        (300_000, 3_000, 0.20),
        (600_000, 0, 0.25),
        (1_800_000, 0, 0.25),
    )


@dataclass(frozen=True)
class Plant:
    """A real effect, and where it lives. `None` everywhere is a null world."""

    name: str
    #: How much the gap moves inside the region. Positive = more overconfident there.
    delta: float
    #: A predicate over the per-decision frame. Returns a boolean mask.
    region: object = field(repr=False)
    #: Which bucket key a correct recovery would name, or None where no bucket can express it.
    expressible_as: str | None = None


def _draw_time_controls(rng: np.random.Generator, spec: WorldSpec, games: int) -> np.ndarray:
    weights = np.array([w for _, _, w in spec.time_controls], dtype=float)
    picked = rng.choice(len(spec.time_controls), size=games, p=weights / weights.sum())
    return np.array([[spec.time_controls[i][0], spec.time_controls[i][1]] for i in picked])


def _game_lengths(rng: np.random.Generator, spec: WorldSpec, games: int) -> np.ndarray:
    """Negative-binomial-ish lengths, floored so a game is long enough to have three phases.

    A floor rather than a resample: resampling until long enough would truncate the left tail and
    quietly remove the short games, and NULL-6 exists specifically to ask what variable game
    lengths do to a detector that counts decisions.
    """
    mean = spec.game_length_mean
    shape = 1.0 / max(spec.game_length_dispersion, 1e-6)
    draws = rng.gamma(shape, mean / shape, size=games)
    return np.clip(np.round(draws), 12, 200).astype(int)


def _stochastic_round(rng: np.random.Generator, value: float) -> int:
    """Put a probability on the product's confidence grid WITHOUT a systematic rounding bias.

    Nearest-level rounding is deterministic and biased: `grid[l] + 0.07` is nearer to `grid[l]`
    than to the level above, so a planted effect of seven points of gap would round away to
    nothing and the harness would report the detector missing an effect that was never there.
    Choosing between the two neighbours with probability proportional to the distance makes the
    EXPECTED stated confidence exactly `value`, which is what both the null construction and the
    planted deltas depend on.
    """
    if value <= CONFIDENCE_GRID[0]:
        return 0
    if value >= CONFIDENCE_GRID[-1]:
        return len(CONFIDENCE_GRID) - 1
    upper = int(np.searchsorted(CONFIDENCE_GRID, value))
    lower = upper - 1
    span = CONFIDENCE_GRID[upper] - CONFIDENCE_GRID[lower]
    return upper if rng.random() < (value - CONFIDENCE_GRID[lower]) / span else lower


def feasibility(spec: WorldSpec) -> str | None:
    """Whether `p = stated - gap - drift - tilt` can land inside (0, 1) without being clipped.

    A CHECK RATHER THAN A CLAMP, and the difference is the point. Clipping would keep the run
    going and put a systematic, feature-dependent bias into a world that must have none -- which
    is exactly the defect the self-test caught in the first version of this file. Refusing the
    parameters says which knob has to move.

    It has already earned its keep: the Q1 sweep asked for a game-level gap component of 0.20,
    which the seven-level grid cannot carry, and the assertion below fired 5,600 records into the
    run. This says so before the first record.
    """
    low = spec.confidence_floor - spec.gap - spec.gap_drift_total - 3 * spec.sigma_tilt
    high = spec.confidence_ceiling - spec.gap + 3 * spec.sigma_tilt
    if low <= 0:
        return (
            f"{spec.name}: the least confident decision would need an accuracy probability of "
            f"{low:.3f}. Raise confidence_floor, or lower gap / gap_drift_total / sigma_tilt."
        )
    if high >= 1:
        return (
            f"{spec.name}: the most confident decision would need an accuracy probability of "
            f"{high:.3f}. Lower confidence_ceiling or sigma_tilt."
        )
    return None


def generate_record(
    rng: np.random.Generator,
    spec: WorldSpec,
    games: int,
    plant: Plant | None = None,
) -> dict:
    """One player's record: `games` games, columnar, ready for the TypeScript bridge."""
    problem = feasibility(spec)
    if problem is not None:
        raise ValueError(problem)
    lengths = _game_lengths(rng, spec, games)
    controls = _draw_time_controls(rng, spec, games)
    imported = rng.random(games) < spec.imported_share
    clockless = rng.random(games) < spec.clockless_game_rate

    # CLAMPED AT THREE SIGMA, so the accuracy probability below cannot leave (0, 1) and therefore
    # never has to be clipped. An unclamped tail would be rare and would bias exactly the games
    # that are furthest from the mean, which is the worst place to put an artefact.
    tilt = np.clip(rng.normal(0.0, spec.sigma_tilt, size=games), -3 * spec.sigma_tilt, 3 * spec.sigma_tilt)
    conf_shift = rng.normal(0.0, spec.sigma_conf, size=games)
    pace = rng.normal(0.0, spec.sigma_pace, size=games)

    g: list[int] = []
    ph: list[int] = []
    st: list[float | None] = []
    cl: list[int | None] = []
    cf: list[int] = []
    ac: list[int] = []
    #: Kept for the planted-world bookkeeping and for the self-test; never crosses to TypeScript.
    truth_gap: list[float] = []
    #: Whether this decision is INSIDE the planted region. The one place the region is decided, so
    #: the self-test and the recall scorer cannot disagree about where the effect was put.
    planted: list[int] = []

    for game in range(games):
        length = int(lengths[game])
        initial, increment = int(controls[game][0]), int(controls[game][1])
        opening_len = min(10, length // 3)
        endgame_len = min(12, max(2, length // 4))
        # An imported game is somebody else's afternoon: longer thinks, and a different pace.
        pace_here = pace[game] + (0.35 if imported[game] else 0.0)
        # Drift is a fraction of the whole record, not a step per game, so a long record and a
        # short one describe the same player rather than one whose gap runs off the scale.
        drift = spec.gap_drift_total * (game / max(games - 1, 1))
        clock_ms = float(initial)
        # What one decision may cost if the clock is to last the game. 30 of the player's moves is
        # the conventional planning horizon and is what makes the derived pace defensible.
        budget = max(initial / 1000.0 / 30.0, 1.5)
        for j in range(length):
            if j < opening_len:
                phase = OPENING
            elif j >= length - endgame_len:
                phase = ENDGAME
            else:
                phase = MIDDLEGAME

            # Think time: lognormal around a budget DERIVED FROM THE CLOCK, so a player in a
            # three-minute game is not modelled as thinking for a minute a move. The alternative
            # -- one think-time distribution for every control -- makes clock and think time
            # nearly independent, and the two features the detector cares most about would then
            # have no within-game structure to cluster on.
            mu = math.log(budget * {OPENING: 0.45, MIDDLEGAME: 1.40, ENDGAME: 0.90}[phase])
            seconds = float(np.exp(mu + pace_here + rng.normal(0.0, spec.sigma_time)))
            seconds = min(seconds, 900.0)

            clock_ms = max(0.0, clock_ms - seconds * 1000.0 + increment)
            if spec.clock_duplicates_time:
                # A near-duplicate feature: the clock reading carries almost the same information
                # as the think time. NULL-8 asks what two names for one thing do to a scan.
                clock_ms = max(0.0, 240_000.0 - seconds * 2_000.0 + rng.normal(0.0, 2_000.0))

            missing = clockless[game]
            if not missing and spec.clock_missing_rate > 0:
                rate = spec.clock_missing_rate
                if spec.missingness_informative:
                    # Missing more often where the decision was fast: the pattern an import
                    # actually has, because a first move has no previous reading to subtract.
                    rate = spec.clock_missing_rate * (2.0 if seconds < 45 else 0.3)
                missing = bool(rng.random() < min(rate, 0.95))

            # WHAT THE PLAYER SAYS, from the features and the game -- never from the outcome.
            # Confined to the middle of the grid so that `p` below lands in range unclipped.
            latent = float(
                np.clip(
                    spec.confidence_centre
                    + {OPENING: 0.06, MIDDLEGAME: -0.03, ENDGAME: -0.04}[phase]
                    + conf_shift[game]
                    - 0.05 * math.tanh((seconds - 60.0) / 60.0)
                    + rng.normal(0.0, spec.sigma_conf_noise),
                    spec.confidence_floor,
                    spec.confidence_ceiling,
                )
            )
            base_level = _stochastic_round(rng, latent)
            base_stated = float(CONFIDENCE_GRID[base_level])

            planted_flag = False
            if plant is not None:
                planted_flag = bool(
                    plant.region(
                        {
                            "phase": phase,
                            "seconds": seconds,
                            "clock_ms": None if missing else clock_ms,
                            "game": game,
                            "ply": j,
                            "games": games,
                        }
                    )
                )

            # THE OUTCOME FOLLOWS THE STATEMENT. This is the line the whole construction rests on.
            p = base_stated - spec.gap - drift - float(tilt[game])
            assert 0.0 < p < 1.0, f"accuracy probability left (0,1): {p}"
            accurate = int(rng.random() < p)

            # A PLANTED EFFECT MOVES WHAT THE PLAYER SAYS, not what comes out, and the difference
            # matters: shifting `p` instead would push it out of range for the larger deltas and
            # bring back the clip this construction exists to avoid.
            level = (
                base_level
                if not planted_flag
                else _stochastic_round(rng, min(base_stated + plant.delta, float(CONFIDENCE_GRID[-1])))
            )

            g.append(game)
            ph.append(phase)
            st.append(round(seconds, 3))
            cl.append(None if missing else int(clock_ms))
            cf.append(level + 1)
            ac.append(accurate)
            truth_gap.append(float(CONFIDENCE_GRID[level]) - p)
            planted.append(1 if planted_flag else 0)

    return {
        "g": g,
        "ph": ph,
        "st": st,
        "cl": cl,
        "cf": cf,
        "ac": ac,
        "truth_gap": truth_gap,
        "planted": planted,
        "games": games,
    }


def split_at_game(record: dict, derivation_games: int) -> int:
    """The index where the prospective half begins -- ALWAYS on a game boundary.

    A split inside a game would put two halves of one sitting on both sides of the wall the whole
    experiment exists to enforce: the same tilt, the same opponent, the same clock, counted once
    as the evidence that suggested a claim and once as the evidence that confirmed it.
    """
    g = record["g"]
    for index, game in enumerate(g):
        if game >= derivation_games:
            return index
    return len(g)


# ---------------------------------------------------------------------------------------------
# The worlds themselves.
# ---------------------------------------------------------------------------------------------

BASE = WorldSpec(name="base")

NULL_WORLDS: tuple[WorldSpec, ...] = (
    replace(BASE, name="NULL-1-independent", sigma_tilt=0.0, sigma_conf=0.0, sigma_pace=0.0),
    replace(BASE, name="NULL-2-within-game-correlated"),
    replace(BASE, name="NULL-3-skewed-features", sigma_time=1.35),
    replace(BASE, name="NULL-4-correlated-predictors", sigma_pace=0.85, sigma_conf=0.55),
    replace(
        BASE,
        name="NULL-5-informative-missingness",
        clock_missing_rate=0.25,
        missingness_informative=True,
    ),
    replace(BASE, name="NULL-6-variable-game-lengths", game_length_dispersion=0.85),
    replace(BASE, name="NULL-7-clockless-games", clockless_game_rate=0.35),
    replace(BASE, name="NULL-8-duplicated-features", clock_duplicates_time=True),
    replace(BASE, name="NULL-9-temporal-drift", gap_drift_total=0.06),
    replace(BASE, name="NULL-10-imported-live-mixture", imported_share=0.4, clockless_game_rate=0.2),
)


def _region_middlegame(row: dict) -> bool:
    return row["phase"] == MIDDLEGAME


def _region_fast(row: dict) -> bool:
    return row["seconds"] < 45


def _region_interaction(row: dict) -> bool:
    return row["seconds"] < 45 and row["phase"] == ENDGAME


def _region_low_clock(row: dict) -> bool:
    return row["clock_ms"] is not None and row["clock_ms"] < 60_000


def _region_one_game(row: dict) -> bool:
    return row["game"] == 0


def _region_every_game_first_moves(row: dict) -> bool:
    return row["ply"] < 4


def _region_proxy(row: dict) -> bool:
    """A latent region that NO bucket names exactly, but which the fast bucket half-covers.

    The question this world asks is not whether the detector finds something -- it is whether what
    it finds is the region or its proxy, and `wrong_proxy_rate` in the scorecard is the answer.
    """
    return row["seconds"] < 25 or (row["seconds"] < 70 and row["phase"] == MIDDLEGAME)


PLANTS: tuple[Plant, ...] = (
    Plant("clean-middlegame", 0.18, _region_middlegame, "phase-middlegame"),
    Plant("weak-middlegame", 0.07, _region_middlegame, "phase-middlegame"),
    Plant("clean-fast", 0.18, _region_fast, "fast-under-45s"),
    Plant("weak-fast", 0.07, _region_fast, "fast-under-45s"),
    Plant("interaction-only", 0.22, _region_interaction, None),
    Plant("sparse-low-clock", 0.22, _region_low_clock, "clock-under-1m"),
    Plant("one-game-only", 0.22, _region_one_game, None),
    Plant("every-game-first-moves", 0.20, _region_every_game_first_moves, None),
    Plant("proxy-correlated", 0.20, _region_proxy, None),
)
