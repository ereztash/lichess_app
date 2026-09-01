"""Join the published screen's separations with the C11 grades, so the ranking can be read
against the grade of the cell it was computed from."""
import json, sys
pub = json.load(open(sys.argv[1]))
c11 = json.load(open(sys.argv[2]))
rows = []
for cid, v in pub["rule_classes"].items():
    c4 = v.get("c4_prescriptive_validity", {})
    tp, tm = c4.get("t_plus", {}), c4.get("t_minus", {})
    bp = tp.get("b_valid", {}).get("p"); bm = tm.get("b_valid", {}).get("p")
    if bp is None or bm is None: continue
    g = c11["classes"].get(cid, {})
    neg = g.get("cells", {}).get("negative", {})
    rows.append({
        "id": cid, "name": v["name"], "role": v["role"],
        "b_plus": bp, "b_minus": bm, "sep": bp - bm,
        "grade": g.get("c11_grade", "?"),
        "graded_on": g.get("graded_on"),
        "psz_minus_shipped": neg.get("prescription_size_shipped"),
        "psz_minus_stated": neg.get("prescription_size_as_stated"),
        "empty_minus_stated": neg.get("no_legal_move_as_stated"),
        "empty_minus_shipped": neg.get("no_legal_move_shipped"),
        "substitutes": g.get("substitutes_the_antecedent_on_T_minus"),
    })
rows.sort(key=lambda r: -r["sep"])
print(f"{'id':7}{'name':30}{'role':17}{'sep':>8}{'psz|T- ship':>13}{'psz|T- stated':>15}{'empty|T-':>10}  grade")
for r in rows:
    st = "  --  " if r["psz_minus_stated"] is None else f"{r['psz_minus_stated']:.3f}"
    em = r["empty_minus_stated"] if r["substitutes"] else r["empty_minus_shipped"]
    print(f"{r['id']:7}{r['name'][:29]:30}{r['role']:17}{r['sep']:8.3f}"
          f"{r['psz_minus_shipped']:13.3f}{st:>15}{(em if em is not None else 0):10.3f}  {r['grade']}")
print()
meas = [r for r in rows if r["grade"] == "MEASURABLE" and r["role"] == "candidate"]
print("MEASURABLE candidates, best separation first:")
for r in meas:
    print(f"  {r['id']} {r['name']:28} sep {r['sep']:+.3f}")
print()
print("published ranking, top five, with grades:")
for r in rows[:5]:
    print(f"  {r['id']} {r['name']:28} sep {r['sep']:+.3f}  {r['role']:17} {r['grade']}")
json.dump(rows, open(sys.argv[3], "w"), indent=2)
