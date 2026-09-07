"""
Compare two replication runs AT THE LEVEL OF METHOD, not of pattern.

The question a replication answers is not "did the same region come back". If R** is genuinely
personal it should NOT come back, and a table that scored similarity would reward the wrong thing.
What is compared here is what the frozen pipeline was able to DECIDE on each player:

    did a recurring structure pass the judge?
    did it survive the held-out window?
    how much of it did the same-rating population explain?
    did anything survive that correction?
    which bounded class did the run end in?

    python compare_runs.py --run <dirA> --run <dirB> --out COMPARISON.md
"""
from __future__ import annotations

import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import contract  # noqa: E402


def load(run_dir: str) -> dict:
    state = json.load(open(os.path.join(run_dir, "report", "RESULT.json")))
    an = os.path.join(run_dir, "analysis")

    def maybe(name):
        p = os.path.join(an, name)
        return json.load(open(p)) if os.path.exists(p) else None
    return {"dir": run_dir, "state": state,
            "broad": maybe("discovery_OBS_%s.json" % contract.BROAD_TARGET),
            "resid_primary": maybe("discovery_POP_%s.json" % contract.RESIDUAL_TARGETS[0]),
            "resid_secondary": maybe("discovery_POP_%s.json" % contract.RESIDUAL_TARGETS[1]),
            "population": maybe("population.json"),
            "test": maybe("predict_test.json"),
            "stability": maybe("stability_loco.json")}


def pct(x):
    return "n/a" if x is None else f"{100 * float(x):.1f}%"


def pp(x):
    return "n/a" if x is None else f"{100 * float(x):+.1f} pp"


def z(x):
    return "n/a" if x is None else f"{float(x):.2f}"


def row_values(r: dict) -> dict:
    st, v = r["state"], (r["state"].get("verdict") or {})
    broad = v.get("broad_structure")
    resid = v.get("personal_residual")
    passing_broad = [f for f in ((r["broad"] or {}).get("frozen") or []) if (f.get("validate") or {}).get("pass")]
    test = ((r["test"] or {}).get("frames") or {}).get("TEST")
    popc = r["population"] or {}
    per = popc.get("per_side") or {}
    out = {
        "player": f"{(st.get('focal') or {}).get('platform')}/{(st.get('focal') or {}).get('username')}",
        "eligible_decisions": (st.get("corpus") or {}).get("eligible_decisions"),
        "games": (st.get("corpus") or {}).get("scorable"),
        "splits": st.get("splits") or {},
        "stable_structure": "yes" if broad else ("no" if r["broad"] else "not reached"),
        "broad_region": (broad or {}).get("region"),
        "broad_validate": (broad or {}).get("validate") or {},
        "n_broad_passing": len(passing_broad),
        "survives_holdout": None if not test else (
            "yes" if (test["region_contrast"]["z"] or 0) > 0 and test["shuffled_gain_p"] <= 0.05 else "no"),
        "test": test,
        "population_explains": None if not popc else pp((popc.get("population") or {}).get("raw", {}).get("diff")),
        "focal_percentile": per.get("focal_percentile"),
        "residual_remains": "yes" if resid else ("no" if r["resid_primary"] else "not reached"),
        "residual_region": (resid or {}).get("region"),
        "residual_target": (resid or {}).get("target"),
        "residual_validate": (resid or {}).get("validate") or {},
        "final_class": st.get("status"),
    }
    return out


def render(rows: list[dict]) -> str:
    names = [r["player"] for r in rows]
    L = ["# Method-level comparison", "",
         "Not a search for the same pattern in two people. If a personal residual is genuinely",
         "personal it should not recur, so recurrence is not the success criterion. What is compared",
         "is what the frozen pipeline could DECIDE for each player.", "",
         "| Dimension | " + " | ".join(names) + " |",
         "| --- | " + " | ".join("---" for _ in names) + " |"]

    def line(label, fn):
        L.append(f"| {label} | " + " | ".join(str(fn(r)) for r in rows) + " |")

    line("admissible games", lambda r: r["games"])
    line("eligible decisions", lambda r: r["eligible_decisions"])
    line("DERIVE / VALIDATE / TEST decisions",
         lambda r: f"{r['splits'].get('DERIVE_decisions')} / {r['splits'].get('VALIDATE_decisions')} / {r['splits'].get('TEST_decisions')}")
    line("stable structure found?", lambda r: r["stable_structure"])
    line("region", lambda r: f"`{r['broad_region']}`" if r["broad_region"] else "—")
    line("VALIDATE within-game", lambda r: pp(r["broad_validate"].get("wg_est")) if r["broad_validate"] else "—")
    line("VALIDATE residual z", lambda r: z(r["broad_validate"].get("resid_wg_z")) if r["broad_validate"] else "—")
    line("survives holdout (TEST)?", lambda r: r["survives_holdout"] or "not opened")
    line("TEST rate in / out",
         lambda r: f"{pct((r['test'] or {}).get('region_contrast', {}).get('p_in'))} / {pct((r['test'] or {}).get('region_contrast', {}).get('p_out'))}" if r["test"] else "—")
    line("TEST shuffled-label p", lambda r: (r["test"] or {}).get("shuffled_gain_p", "—"))
    line("explained by population?", lambda r: r["population_explains"] or "—")
    line("focal percentile among peers",
         lambda r: "—" if r["focal_percentile"] is None else f"{100 * r['focal_percentile']:.0f}th")
    line("residual remains?", lambda r: r["residual_remains"])
    line("residual region", lambda r: f"`{r['residual_region']}`" if r["residual_region"] else "—")
    line("residual target", lambda r: r["residual_target"] or "—")
    line("residual VALIDATE z", lambda r: z(r["residual_validate"].get("resid_wg_z")) if r["residual_validate"] else "—")
    line("**final class**", lambda r: f"`{r['final_class']}`")
    L += ["", "## What a difference in this table does and does not mean", "",
          "A different final class between two players is the pipeline working, not failing: the",
          "four classes exist precisely so that a player without a supported personal residual gets",
          "an honest answer instead of a manufactured one. A difference in corpus size is a",
          "difference in POWER, and a null on a small corpus is a statement about what this record",
          "can support, never about the player.", ""]
    return "\n".join(L)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", action="append", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    rows = [row_values(load(d)) for d in a.run]
    with open(a.out, "w") as f:
        f.write(render(rows))
    print(a.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
