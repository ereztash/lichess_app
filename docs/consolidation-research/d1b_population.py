#!/usr/bin/env python3
"""
D1b's population and its QUOTED subset, both derived from the tree.

    python3 docs/consolidation-research/d1b_population.py

Repair for Defect G. v2's first definition of "load-bearing" was every implementation file the
STUDY named as evidence, so the study chose its own denominator and a thinner study would have
scored higher. The population is now a property of the repository:

    every implementation file whose path is named by at least one of the 169 governance files
    at the baseline commit

and the QUOTED numerator is derived too, rather than counted by hand:

    a file is QUOTED when the study cites a line number in it (`path:NNN`), or reproduces
    >= 40 consecutive characters drawn from a LINE that occurs in no other file

The distinctiveness clause is not decoration. The first implementation of this script tested only
for 40 consecutive characters, and it counted 55 of 167 files as quoted on windows like

    'urn 0 if __name__ == "__main__": sys.exi'
    '"" from __future__ import annotations im'
    '----------------------------------------'

which are boilerplate present in dozens of files and evidence about none of them. A window counts
only when it appears in exactly one file of the population, which is what "reproduces a passage of
the file" was always meant to say.

Both sides are computed here so neither can be chosen after the fact. Nothing is read from a
constant. If git cannot be reached the script REFUSES rather than falling back to a stale number
(`RNL-18`: NOT-MEASURED is not PASS).
"""
from __future__ import annotations
import json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
BASELINE = "8c8b331a4336905bcc4f73e59764e32f42a2356b"
QUOTE_LEN = 40
STEP = 10          # window stride; every offset would be 4x the work for the same answer


def git(*args: str) -> str:
    r = subprocess.run(["git", "-C", REPO, *args], capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"d1b_population: git {' '.join(args)} failed: {r.stderr.strip()}")
    return r.stdout


def is_governance(p: str) -> bool:
    """SCORING_METHOD_V2.md D1a's population, by path."""
    return (p.startswith("docs/")
            or p in ("README.md", "VERCEL_DEPLOYMENT.md", "tests/LEVELS.md")
            or (p.startswith("research/") and p.endswith(".md"))
            or p.startswith(".github/workflows/")
            or p.startswith("scripts/")
            or p.startswith(".claude/agents/"))


def is_implementation(p: str) -> bool:
    """SCORING_METHOD_V2.md D1b's population, by path."""
    return ((p.startswith(("shared/", "client/src/", "server/", "api/", "drizzle/"))
             and p.endswith((".ts", ".tsx", ".sql")))
            or (p.startswith("research/") and p.endswith((".py", ".ts", ".mjs", ".sh"))))


def is_substantive(w: str) -> bool:
    """A 40-character window that is mostly rules, pipes and punctuation is not a quotation.

    Markdown horizontal rules and table separators produce long runs of `-` and `|` that are
    unique to a file only by accident of length, and match a document's own formatting rather
    than its content. Nor is a window that is mostly a file path: a source comment naming the
    document that governs it matches the study naming the same document, and neither party has
    read the other.
    """
    letters = sum(c.isalnum() for c in w)
    words = [t for t in re.split(r"[^A-Za-z0-9_]+", w) if len(t) > 1]
    if letters < QUOTE_LEN // 2 or len(words) < 4:
        return False
    # A window that is mostly a file path is not a quotation of the file either. Source comments
    # cite the documents that govern them, and the study cites the same documents; matching on
    # `docs/measurement/FALSIFICATION_REGISTER.md` credits the study for reading a path.
    paths = re.findall(r"[\w.\-/]+/[\w.\-]+\.(?:md|ts|tsx|py|json|sql|yml)", w)
    return sum(len(t) for t in paths) <= QUOTE_LEN // 2


def named_forms(path: str) -> list[str]:
    """The path, and every suffix of it that is still at least two segments long.

    `src/evaluate.py` names `research/b3_population_expertise/src/evaluate.py` when the document
    is talking about that directory. A bare basename does not: `index.ts` would match anything.
    """
    parts = path.split("/")
    return ["/".join(parts[i:]) for i in range(len(parts) - 1)]


def compute() -> dict:
    tree = git("ls-tree", "-r", "--name-only", BASELINE).strip().split("\n")
    governance = [p for p in tree if is_governance(p)]
    implementation = [p for p in tree if is_implementation(p)]
    if len(governance) != 169:
        sys.exit(f"d1b_population: governance population is {len(governance)}, not the 169 "
                 f"PROCESS_CORPUS.md classified — the path rule and the corpus have diverged")

    gov_text = "\n".join(git("show", f"{BASELINE}:{p}") for p in governance)

    # A bare basename counts as naming a file when it is unique among implementation files.
    # `PRODUCTION_READINESS_LEDGER.md` writes "`LearningQueue.tsx` renders `rule.grade`", never
    # the full path, and a rule that cannot see that reads the repository less well than the
    # repository writes.
    unique_base = {}
    for p in implementation:
        unique_base[os.path.basename(p)] = unique_base.get(os.path.basename(p), 0) + 1

    def is_named(p: str) -> bool:
        forms = list(named_forms(p))
        if unique_base[os.path.basename(p)] == 1:
            forms.append(os.path.basename(p))
        return any(f in gov_text for f in forms)

    population = [p for p in implementation if is_named(p)]

    # The study's PROSE and DATA. Its own .py files are excluded on purpose: they share
    # `os.path.dirname(os.path.abspath(__file__))` and `if __name__ == "__main__"` with the
    # repository's Python, and counting that as a quotation credited the study for boilerplate
    # it never read. Evidence is quoted in prose.
    # ... and not this script's own audit trail, which records the windows it matched last time.
    # Leaving it in makes the detector read its own output: `research/b2/controls.py` counted as
    # QUOTED on a window that appeared nowhere but in `d1b_population.json`'s `quoted_evidence`.
    study = "\n".join(open(os.path.join(HERE, f), encoding="utf-8").read()
                      for f in sorted(os.listdir(HERE))
                      if f.endswith((".md", ".json")) and f != "d1b_population.json")

    study_flat = " ".join(study.split())

    # every file's normalised body, once
    bodies = {p: " ".join(git("show", f"{BASELINE}:{p}").split()) for p in population}

    # Distinctiveness is judged on the LINE a window comes from, not on the window.
    #
    # Window-level uniqueness was not enough. `if __name__ == "__main__": sys.exit(main())` is in
    # dozens of files, but the 40-character window starting at an arbitrary offset inside it
    # differs between them, so each file "owned" its own slice of a shared idiom. Worse, the two
    # windows that survived were matched because SCORING_METHOD_V2.md section 0-G QUOTES THEM as
    # examples of false positives: the detector was reading the study's documentation of itself.
    # A line that appears in more than one file of the population is boilerplate however the
    # window happens to fall across it.
    raw_lines = {p: git("show", f"{BASELINE}:{p}").splitlines() for p in population}
    line_owners: dict[str, int] = {}
    for p, lines in raw_lines.items():
        for ln in {" ".join(l.split()) for l in lines if len(" ".join(l.split())) >= QUOTE_LEN}:
            line_owners[ln] = line_owners.get(ln, 0) + 1

    def distinctive_windows(p: str):
        """40-character windows drawn only from lines unique to this file."""
        for l in raw_lines[p]:
            ln = " ".join(l.split())
            if len(ln) < QUOTE_LEN or line_owners.get(ln, 0) != 1:
                continue
            for i in range(0, len(ln) - QUOTE_LEN + 1, STEP):
                yield ln[i:i + QUOTE_LEN]
            yield ln[-QUOTE_LEN:]

    # A bare basename is allowed for a LINE CITATION when it is unique in the population.
    # The study writes `LearningQueue.tsx:111`, not the full path, and refusing to see that
    # undercounts the study rather than the repository.
    basenames: dict[str, int] = {}
    for p in population:
        basenames[os.path.basename(p)] = basenames.get(os.path.basename(p), 0) + 1

    quoted, how = [], {}
    for p in population:
        forms = list(named_forms(p))
        if basenames[os.path.basename(p)] == 1:
            forms.append(os.path.basename(p))
        cited = next((f for f in forms
                      if any(f"{f}:{d}" in study for d in "0123456789")), None)
        if cited:
            quoted.append(p); how[p] = f"line citation `{cited}:N`"; continue
        hit = next((w for w in distinctive_windows(p)
                    if is_substantive(w) and w in study_flat), None)
        if hit:
            quoted.append(p); how[p] = f"distinctive passage {hit!r}"

    return {"governance": len(governance), "implementation": len(implementation),
            "population": population, "quoted": quoted, "how": how}


def write_cache(r: dict) -> str:
    """Publish the audit trail beside the script, so a reader can check the sets without git."""
    out = os.path.join(HERE, "d1b_population.json")
    json.dump({"_what": "D1b's population and QUOTED subset, derived from the tree at the baseline "
                        "commit by d1b_population.py. Regenerate with: python3 "
                        "docs/consolidation-research/d1b_population.py",
               "baseline": BASELINE,
               "governance": r["governance"], "implementation": r["implementation"],
               "population": len(r["population"]), "quoted": len(r["quoted"]),
               "population_files": r["population"], "quoted_files": r["quoted"],
               "quoted_evidence": r["how"]},
              open(out, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    return out


def main() -> int:
    r = compute()
    pop, q = len(r["population"]), len(r["quoted"])
    print(f"governance files at {BASELINE[:7]}          {r['governance']}")
    print(f"implementation files                       {r['implementation']}")
    print(f"D1b population — named by governance       {pop}  ({pop/r['implementation']*100:.1f}% of the corpus)")
    print(f"  of those, QUOTED by the study            {q}  ({q/pop*100:.1f}%)")
    print(f"\nD1b = 6 * (0.7 * {q}/{pop} + 0.3) = {6*(0.7*q/pop+0.3):.3f} / 6")
    print(f"\naudit trail written to {write_cache(r)}")
    print("\nQUOTED files, and what made each one count:")
    for p in r["quoted"]:
        print(f"    {p}\n        {r['how'][p][:110]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
