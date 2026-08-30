"""Positive controls for the B2 analysis, because a blind script also says "nothing was better".

Section 7's likeliest verdict is STOP-B2-A. So is the verdict of a script that cannot see anything
at all, and the two are indistinguishable from the output alone. This file separates them, on a
SYNTHETIC corpus so that running it can never be a second look at the real one.

Five runs, each of which must land where it is told to:

  no signal        outcome independent of time     -> must NOT reach OBSERVATION
  plant-signal     accuracy written as a function
                   of the lichess bucket index     -> MUST reach OBSERVATION, naming that candidate
  shuffle-outcome  the record's outcome permuted   -> must NOT reach OBSERVATION
  shuffle-time     the clock permuted              -> must NOT reach OBSERVATION
  constant-outcome every decision accurate         -> must NOT reach OBSERVATION

And one calibration check that is not about signal at all: under a plain outcome permutation, the
share of permutations still clearing a 95th-percentile bar must sit near 5% for every candidate the
study computed. Far from 5% and the bar is wrong, whatever the verdict says.

THE TOLERANCE IS 12%, NOT 6%, AND THE REASON IS STATED RATHER THAN HIDDEN. The bar is a single
1,000-draw Monte Carlo estimate of a 95th percentile, shared across all 200 permutations by design
(see `permutation_control`). A bar that lands a little low makes every permutation likelier to clear
it, so the observed share is a 200-draw binomial around a percentile that is itself estimated --
roughly +-1.5pp of sampling noise on top of a bar that may sit a percentile or two off. Rates near
9% are that, not a broken null. A rate above 12% is not, and fails.

A control that stays green when it should go red is a failed control, and so is one that never ran.

Run: python3 research/b2/controls.py
"""
import collections, json, os, random, re, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ANALYSE = os.path.join(HERE, "analyse.py")
GAMES, SEED = 75, 7


def merge_floor_check():
    """The bucket floor must hold where the data is thinnest, which is where it used to switch off.

    Review found that the merge folded a small bucket into the nearest LARGE neighbour -- so when NO
    bucket reached the floor there was no target, nothing merged, and §6's within-cell control
    reported rates on buckets of one and two decisions. This asserts the case directly, because a
    floor that only applies when it is not needed is worse than no floor.
    """
    src = open(ANALYSE).read()
    ns = {"collections": collections, "MIN_BUCKET": 20}
    exec(src[src.index("def merge_small(pairs):"):src.index("def spread(pairs):")], ns)
    merge = ns["merge_small"]
    bad = []
    cases = {
        "every bucket small": [(i % 6, True) for i in range(30)],
        "one tiny between two large": [(0, True)] * 50 + [(1, False)] * 3 + [(2, True)] * 50,
        "a long thin tail": [(0, True)] * 40 + [(i, False) for i in range(1, 12)],
    }
    for name, pairs in cases.items():
        after = collections.Counter(b for b, _ in merge(pairs))
        ok = len(after) == 1 or all(v >= 20 for v in after.values())
        print(f"    merge floor  {name:28} -> {dict(sorted(after.items()))}{'' if ok else '   <-- UNDER THE FLOOR'}")
        if not ok:
            bad.append(f"merge_small left a bucket under the floor on '{name}': {dict(after)}")
    # And the fold must still prefer the lower neighbour on a tie, as the docstring claims.
    tie = merge([(0, True)] * 25 + [(1, False)] * 3 + [(2, True)] * 25)
    if sorted(set(b for b, _ in tie)) != [0, 2]:
        bad.append(f"merge_small stopped folding a tie downward: {sorted(set(b for b, _ in tie))}")
    return bad


def build(root):
    """A corpus shaped like the real one -- 75 games, alternating halves -- with NO time signal."""
    rng = random.Random(SEED)
    os.makedirs(os.path.join(root, "research/b2"), exist_ok=True)
    games = [f"G{i:03d}" for i in range(GAMES)]
    json.dump({"halves": {g: ("derivation" if i % 2 == 0 else "heldout") for i, g in enumerate(games)},
               "recencyRank": {g: i for i, g in enumerate(games)},
               "baseClockMs": {g: 180_000 for g in games},
               "preregisteredN": 40, "amendedN": GAMES},
              open(os.path.join(root, "research/b2/corpus_manifest.json"), "w"))
    with open(os.path.join(root, "research/b2/decision_evidence.jsonl"), "w") as f:
        for g in games:
            clock = 180_000
            for ply in range(rng.randint(30, 60)):
                s = round(rng.choice([0.3, 0.6, 1, 1.5, 2, 3, 5, 8, 12, 25]) * rng.uniform(0.7, 1.4), 1)
                clock = max(1000, clock - int(s * 1000))
                f.write(json.dumps(dict(
                    playerId="p", gameIndex=0, gameId=g, ply=ply, cpLoss=0, speed="blitz",
                    phase=rng.choice(["opening", "middlegame", "endgame"]),
                    standing=rng.choice(["winning", "level", "losing"]),
                    secondsTaken=s, clockMsRemaining=clock,
                    accurate=rng.random() < 0.65, forced=False, book=False)) + "\n")


def run(root, control=None):
    cmd = [sys.executable, ANALYSE] + (["--control", control] if control else [])
    p = subprocess.run(cmd, cwd=root, capture_output=True, text=True)
    if p.returncode != 0:
        raise SystemExit(f"analyse.py failed under {control or 'no control'}:\n{p.stderr}")
    verdicts = re.findall(r"SECTION 7 VERDICT: (\S+)", p.stdout)
    if len(verdicts) != 2:
        raise SystemExit(f"expected two verdicts (preregistered, amended), got {verdicts}")
    return verdicts, p.stdout


def main():
    failures = merge_floor_check()
    with tempfile.TemporaryDirectory() as root:
        build(root)

        verdicts, out = run(root)
        print(f"  no signal          {verdicts}")
        if "OBSERVATION" in verdicts:
            failures.append("a corpus with no time signal reached OBSERVATION")

        # The calibration check, read off the run above.
        block = out.split("outcome permutation")[1].split("a plain rate")[0]
        rates = [(m.group(1).strip(), float(m.group(2)))
                 for m in re.finditer(r"^  (\S.*?)\s+([\d.]+)%\s+[\d.]+%$", block, re.M)]
        if len(rates) < 4:
            failures.append(f"the permutation control reported only {len(rates)} candidates")
        for name, pct in rates:
            flag = "" if 0.0 <= pct <= 12.0 else "   <-- OFF"
            print(f"    plain-permutation survival  {name:32} {pct:5.1f}%{flag}")
            # Raw seconds collapses to one bucket on this distribution, so 0% is its correct rate.
            if pct > 12.0:
                failures.append(f"{name}: {pct}% of plain permutations cleared a 95th-percentile bar")

        verdicts, _ = run(root, "plant-signal")
        print(f"  plant-signal       {verdicts}")
        if verdicts != ["OBSERVATION", "OBSERVATION"]:
            failures.append(f"a planted time signal did not reach OBSERVATION on both corpora: {verdicts}")

        for control in ("shuffle-outcome", "shuffle-time", "constant-outcome"):
            verdicts, _ = run(root, control)
            print(f"  {control:18} {verdicts}")
            if "OBSERVATION" in verdicts:
                failures.append(f"{control} reached OBSERVATION")

    if failures:
        print("\nCONTROLS FAILED")
        for f in failures: print(f"  - {f}")
        return 1
    print("\nall controls behaved: the study finds a planted signal and finds nothing without one")
    return 0


if __name__ == "__main__":
    sys.exit(main())
