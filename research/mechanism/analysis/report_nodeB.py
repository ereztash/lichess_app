"""Render a Node B result file as a markdown table for the ledger."""
import json, sys

def render(path):
    r = json.load(open(path))
    lines = [f"Design: residual={r['residual']} vocab={r['vocab']} k={r['design']['k']} min_n_validate={r['design']['min_n_validate']} size {r['design']['min_size']}–{r['design']['max_size']}", ""]
    for s in r["sweeps"]:
        lines.append(f"**depth {s['depth']}**")
        lines.append("| world | delta | reps | validated | on-target (J≥0.60) | median best J | top validated regions |")
        lines.append("| --- | --- | --- | --- | --- | --- | --- |")
        for w in s["worlds"]:
            top = "; ".join(f"{k} ({v})" for k, v in w["top_regions"][:2]) if w["top_regions"] else "—"
            mj = "—" if w["median_best_jaccard"] is None else f"{w['median_best_jaccard']:.2f}"
            lines.append(f"| {w['world']} | {w['delta']:+.2f} | {w['reps']} | {w['validated_rate']:.2f} | {w['on_target_rate']:.2f} | {mj} | {top} |")
        lines.append("")
    return "\n".join(lines)

if __name__ == "__main__":
    for p in sys.argv[1:]:
        print(f"### {p}\n"); print(render(p))
