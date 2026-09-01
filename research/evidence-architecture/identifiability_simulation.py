"""
CAN THE PROPOSED MEASUREMENT PROTOCOL TELL APART THE LEARNER STATES THAT WOULD NEED DIFFERENT
INTERVENTIONS?

THE GATE IS NOT CLASSIFICATION ACCURACY > X. It is DECISION-RELEVANT IDENTIFIABILITY: for each
pair of latent states that would send the programme to a DIFFERENT next intervention, can the
observations separate them well enough to change what the system does?

WHY THE CLASSIFIER IS AN ORACLE, AND WHY THAT IS THE ONLY HONEST CHOICE. Every comparison below is
scored by a Bayes-optimal likelihood-ratio test that is handed THE TRUE GENERATIVE MODEL of both
hypotheses. No real analysis can beat it. So a number here is an UPPER BOUND on identifiability,
and a pair the oracle cannot separate is one no estimator, no sample size within reason and no
cleverer model can separate either. A pair the oracle CAN separate is not thereby solved -- a real
analyst has to estimate what the oracle was given.

THE ITEM CHANCE RATES ARE MEASURED, NOT INVENTED. `rc06_item_chance_rates.json` holds the per-item
share of legal moves satisfying B for 2,000 items from each RC-06 cell, under both response
predicates:

    T+                     branching .302   as-stated .302   (same predicate)
    T-                     branching .104   as-stated .995

EVERY SIMULATION IS RUN TWICE, once per regime, because the difference between the two IS the
finding: the same learners, the same protocol, the same analysis, and one regime answers questions
the other cannot.

EVERY PAIR IS RATE-MATCHED ON THE PRIMARY OBSERVATION BEFORE IT IS TESTED, AND THIS IS THE WHOLE
DESIGN. Two learner types that produce DIFFERENT amounts of rule-consistent action are separable by
counting, which is not the question. The question is whether two MECHANISMS that produce the SAME
observable behaviour on the primary cell can be told apart. So for each pair, the second learner's
`p_act` is solved so that its expected P(B | T+, untimed) equals the first's, over the measured item
chance distribution. A first version of this file did not do that, and reported >= 0.93 separation
everywhere -- which was a fact about the parameters it had chosen, not about the protocol.

THE ONE FREE PARAMETER IS CALIBRATED, NOT CHOSEN. A player who is not applying the rule still
produces a B-move sometimes, at a rate above uniform because a real policy is concentrated on good
moves. That is `beta`: P(B | not applying) = min(1, beta * chance_rate). At beta = 2 the model
reproduces the OBSERVED trigger-negative rate under the shipped predicate -- 2 x .104 = .21 against
a measured .192-.200 -- so beta is pinned by data rather than picked. Sensitivity to beta is
reported.

    python identifiability_simulation.py --rates rc06_item_chance_rates.json \\
        --out identifiability_simulation.json
"""

from __future__ import annotations

import argparse
import json
import math
import random
from pathlib import Path

BETA_DEFAULT = 2.0


# --------------------------------------------------------------------- the learner types

class Learner:
    """
    A latent state, expressed as the four things that generate an observation.

    `recognise(cued, delayed, timed)`  P(the trigger is recognised on this item)
    `act_given_recognition`            P(the move satisfies B | recognised and acting)
    `apply_on_negative`                P(the rule is applied where the trigger is ABSENT)
    `seconds`                          the time distribution, as (mean, sd)
    """

    def __init__(self, key, label, intervention, p_rec, p_act, p_neg,
                 cue_gain=0.0, delay_loss=0.0, time_loss=0.0, secs=(18.0, 8.0),
                 generates_candidate=None):
        self.key, self.label, self.intervention = key, label, intervention
        self.p_rec, self.p_act, self.p_neg = p_rec, p_act, p_neg
        self.cue_gain, self.delay_loss, self.time_loss = cue_gain, delay_loss, time_loss
        self.secs = secs
        # P(the B-move is among the moves physically placed on the board), used only by the
        # `+candidates` observation set. None means "the same as p_rec", i.e. no extra information.
        self.generates_candidate = generates_candidate

    def recognise(self, cued=False, delayed=False, timed=False) -> float:
        p = self.p_rec
        if cued:
            p = min(1.0, p + self.cue_gain)
        if delayed:
            p = max(0.0, p - self.delay_loss)
        if timed:
            p = max(0.0, p - self.time_loss)
        return p

    def p_b_positive(self, chance, **cond) -> float:
        """P(move satisfies B | trigger present)."""
        r = self.recognise(**cond)
        return r * self.p_act + (1 - r) * min(1.0, BETA * chance)

    def p_b_negative(self, chance) -> float:
        """P(move satisfies B | trigger absent). Applying the rule here is a false application."""
        return self.p_neg * 1.0 + (1 - self.p_neg) * min(1.0, BETA * chance)

    def p_candidate(self) -> float:
        return self.p_rec if self.generates_candidate is None else self.generates_candidate


BETA = BETA_DEFAULT


def solve_p_act(target: float, p_rec: float, baseline: float) -> float:
    """
    The p_act that makes this learner's expected P(B | T+, untimed) equal `target`.

    target = p_rec * p_act + (1 - p_rec) * baseline
    """
    if p_rec <= 0:
        return 0.0
    return min(1.0, max(0.0, (target - (1 - p_rec) * baseline) / p_rec))


def learners(baseline_plus: float) -> dict[str, Learner]:
    """
    Seven latent states, ALL RATE-MATCHED to the same expected P(B | T+, untimed).

    `TARGET` is the pooled trigger-positive rule-consistent action rate the repository measured on
    historical players -- .716 [.696, .735] -- so the synthetic learners behave, on the primary
    observation, like the population a study would actually recruit from.
    """
    TARGET = 0.716
    mk = lambda key, label, iv, p_rec, p_neg, **kw: Learner(  # noqa: E731
        key, label, iv, p_rec, solve_p_act(TARGET, p_rec, baseline_plus), p_neg, **kw)
    return {
        "L1": mk("L1", "recognises T, weak action selection",
                 "action selection / if-then compilation",
                 0.95, 0.05, secs=(22.0, 9.0), generates_candidate=0.85),
        "L2": mk("L2", "does not recognise T, baseline policy often produces B",
                 "trigger recognition / contrastive examples",
                 0.30, 0.05, secs=(22.0, 9.0), generates_candidate=0.30),
        "L3": mk("L3", "recognises T but overgeneralises into T-",
                 "boundary / T- discrimination, hard negatives",
                 0.95, 0.55, secs=(22.0, 9.0), generates_candidate=0.85),
        "L4": mk("L4", "correct untimed, fails under time pressure",
                 "representative timed practice",
                 0.95, 0.05, time_loss=0.55, secs=(22.0, 9.0), generates_candidate=0.85),
        # THE SAME weak recognition as L2, and the ONLY difference is that a contentless cue
        # repairs it. That is the pair a generic-cue arm exists to separate.
        "L5": mk("L5", "weak initial state, strongly cue-responsive",
                 "orientation, worked examples with fading",
                 0.30, 0.05, cue_gain=0.55, secs=(22.0, 9.0), generates_candidate=0.30),
        "L6": mk("L6", "competent immediately, poor delayed retrieval",
                 "spacing and retrieval practice",
                 0.95, 0.05, delay_loss=0.55, secs=(22.0, 9.0), generates_candidate=0.85),
        # SAME MOVES, SAME CONDITIONALITY, DIFFERENT MECHANISM: reaches the move by calculating
        # rather than by recognising. Identical on every cell by construction; the only thing that
        # can possibly separate it is how long it takes.
        "L7": mk("L7", "alternative strategy producing the same move (calculation, not recognition)",
                 "none -- the construct does not apply to this player",
                 0.95, 0.05, secs=(34.0, 12.0), generates_candidate=0.85),
    }


# ------------------------------------------------------------------- the observation sets

def bern_ll(x: int, p: float) -> float:
    p = min(max(p, 1e-9), 1 - 1e-9)
    return math.log(p) if x else math.log(1 - p)


def normal_ll(x: float, mu: float, sd: float) -> float:
    return -0.5 * ((x - mu) / sd) ** 2 - math.log(sd * math.sqrt(2 * math.pi))


CONDITIONS = {
    # name              (cell,      cued,  delayed, timed)
    "T+ untimed": ("positive", False, False, False),
    "T- untimed": ("negative", False, False, False),
    "T+ timed": ("positive", False, False, True),
    "T+ delayed": ("positive", False, True, False),
    "T+ generic cue": ("positive", True, False, False),
}


#: Between-participant SD of baseline thinking time, in seconds.
#:
#: WITHOUT THIS THE SIMULATION FLATTERS LATENCY. A first version drew every participant's time from
#: the same mean, so a 12-second mechanism difference was detected at 1.000 -- which is a statement
#: about people being identical, not about the observation. People differ in baseline speed by more
#: than most mechanism effects, and an analyst does not know a given player's baseline. The offset
#: is drawn once per simulated participant and added to every one of their decisions; the oracle's
#: likelihood widens by the same amount, which is the correct representation of "their own baseline
#: is unknown".
PERSON_TIME_SD = 8.0


def draw(learner: Learner, cond: str, chance: float, rng: random.Random, obs: set[str],
         person_offset: float = 0.0) -> dict:
    cell, cued, delayed, timed = CONDITIONS[cond]
    if cell == "positive":
        p = learner.p_b_positive(chance, cued=cued, delayed=delayed, timed=timed)
    else:
        p = learner.p_b_negative(chance)
    row = {"b": 1 if rng.random() < p else 0}
    if "time" in obs:
        mu, sd = learner.secs
        scale = 0.4 if timed else 1.0
        row["t"] = rng.gauss(mu * scale + person_offset * scale, sd * scale)
    if "candidates" in obs:
        row["c"] = 1 if rng.random() < learner.p_candidate() else 0
    return row


def loglik(learner: Learner, cond: str, chance: float, row: dict, obs: set[str]) -> float:
    cell, cued, delayed, timed = CONDITIONS[cond]
    if cell == "positive":
        p = learner.p_b_positive(chance, cued=cued, delayed=delayed, timed=timed)
    else:
        p = learner.p_b_negative(chance)
    ll = bern_ll(row["b"], p)
    if "time" in obs and "t" in row:
        mu, sd = learner.secs
        scale = 0.4 if timed else 1.0
        widened = math.sqrt((sd * scale) ** 2 + (PERSON_TIME_SD * scale) ** 2)
        ll += normal_ll(row["t"], mu * scale, widened)
    if "candidates" in obs and "c" in row:
        ll += bern_ll(row["c"], learner.p_candidate())
    return ll


def separate(a: Learner, b: Learner, rates: dict, conds: list[str], obs: set[str],
             regime: str, n_items: int, trials: int, seed: int) -> float:
    """Bayes-optimal two-hypothesis accuracy, given the true generative model of both."""
    rng = random.Random(seed)
    correct = 0
    for t in range(trials):
        truth = a if t % 2 == 0 else b
        person_offset = rng.gauss(0.0, PERSON_TIME_SD)
        la = lb = 0.0
        for cond in conds:
            cell = CONDITIONS[cond][0]
            pool = rates[cell][regime]
            for _ in range(n_items):
                chance = pool[rng.randrange(len(pool))]
                row = draw(truth, cond, chance, rng, obs, person_offset)
                la += loglik(a, cond, chance, row, obs)
                lb += loglik(b, cond, chance, row, obs)
        pick = a if la > lb else b
        correct += pick is truth
    return correct / trials


# ------------------------------------------------------------------------------ the pairs

MANDATORY = [
    ("L1", "L2", "A/B"),
    ("L1", "L3", "C/D"),
    ("L1", "L4", "E/F"),
    ("L1", "L6", "G/H"),
    ("L2", "L5", "cue"),
    ("L1", "L7", "L7"),
]

PAIR_MEANING = {
    "A/B": "recognises T + weak action selection   vs   does not recognise T, baseline produces B",
    "C/D": "correct conditional discrimination   vs   response bias / perform-B-everywhere",
    "E/F": "untimed competence   vs   time-pressure execution failure",
    "G/H": "immediate availability   vs   delayed retrieval failure",
    "cue": "weak recognition, cue does not help   vs   weak recognition a generic cue repairs",
    "L7": "the construct applies   vs   an alternative strategy producing the same move",
}

LADDER = [
    ("move only", ["T+ untimed"], set()),
    ("move, both cells", ["T+ untimed", "T- untimed"], set()),
    ("+ time", ["T+ untimed", "T- untimed"], {"time"}),
    ("+ timed condition", ["T+ untimed", "T- untimed", "T+ timed"], {"time"}),
    ("+ delayed condition", ["T+ untimed", "T- untimed", "T+ timed", "T+ delayed"], {"time"}),
    ("+ generic cue", ["T+ untimed", "T- untimed", "T+ timed", "T+ delayed", "T+ generic cue"], {"time"}),
    ("+ candidate set", ["T+ untimed", "T- untimed", "T+ timed", "T+ delayed", "T+ generic cue"],
     {"time", "candidates"}),
]


def main() -> None:
    global BETA
    ap = argparse.ArgumentParser()
    ap.add_argument("--rates", required=True)
    ap.add_argument("--items", type=int, default=20, help="items per condition per participant")
    ap.add_argument("--trials", type=int, default=4000)
    ap.add_argument("--seed", type=int, default=20260831)
    ap.add_argument("--beta", type=float, default=BETA_DEFAULT)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    BETA = a.beta

    rates = json.load(open(a.rates))
    # the expected baseline B-rate on T+ over the MEASURED item chance distribution
    plus = rates["positive"]["branching"]
    baseline_plus = sum(min(1.0, BETA * c) for c in plus) / len(plus)
    L = learners(baseline_plus)

    results = {}
    for regime in ("branching", "symmetric"):
        rows = {}
        for name, conds, obs in LADDER:
            per_pair = {}
            for x, y, label in MANDATORY:
                per_pair[label] = round(
                    separate(L[x], L[y], rates, conds, obs, regime, a.items, a.trials, a.seed), 3)
            rows[name] = per_pair
        results[regime] = rows

    # sensitivity of the headline pair to the one free parameter
    sens = {}
    for beta in (1.0, 1.5, 2.0, 2.5, 3.0):
        BETA = beta
        Lb = learners(sum(min(1.0, beta * c) for c in plus) / len(plus))
        sens[str(beta)] = {
            r: round(separate(Lb["L1"], Lb["L3"], rates,
                              ["T+ untimed", "T- untimed"], {"time"}, r,
                              a.items, 2000, a.seed), 3)
            for r in ("branching", "symmetric")
        }
    BETA = a.beta

    out = {
        "version": "1.0.0",
        "gate": (
            "decision-relevant identifiability: all distinctions required for the intended "
            "downstream decision are separable enough to change what the system would do next"
        ),
        "classifier": (
            "Bayes-optimal likelihood ratio, handed the true generative model of both hypotheses. "
            "An UPPER BOUND: no real estimator beats it."
        ),
        "beta": a.beta,
        "person_time_sd_seconds": PERSON_TIME_SD,
        "beta_calibration": (
            "P(B | not applying) = min(1, beta * per-item chance rate). At beta = 2 the model "
            "reproduces the observed RC-06 trigger-negative rate under the shipped predicate "
            "(2 x .104 = .21 against a measured .192-.200)."
        ),
        "items_per_condition": a.items,
        "trials": a.trials,
        "chance": 0.5,
        "rate_matched_to": 0.716,
        "rate_match_note": (
            "every learner's p_act is solved so its expected P(B | T+, untimed) equals .716, the "
            "pooled trigger-positive rule-consistent action rate measured on historical players. "
            "Pairs therefore differ in MECHANISM at equal primary behaviour."
        ),
        "baseline_b_rate_on_t_plus_without_applying": round(baseline_plus, 4),
        "pairs": PAIR_MEANING,
        "learners": {k: {"label": v.label, "next_intervention": v.intervention,
                         "p_recognise": v.p_rec, "p_act_solved": round(v.p_act, 4),
                         "p_false_application": v.p_neg}
                     for k, v in L.items()},
        "results": results,
        "beta_sensitivity_on_C_vs_D": sens,
    }
    Path(a.out).write_text(json.dumps(out, indent=2) + "\n")

    for regime in ("branching", "symmetric"):
        print(f"\n===== regime: {regime} " + "=" * 40)
        pairs = [lbl for _, _, lbl in MANDATORY]
        print(f"{'observation set':22}" + "".join(f"{p:>8}" for p in pairs))
        for name, _, _ in LADDER:
            print(f"{name:22}" + "".join(
                f"{results[regime][name][p]:>8.3f}" for p in pairs))
    print("\nbeta sensitivity, C vs D, move+time both cells:", json.dumps(sens))


if __name__ == "__main__":
    main()
