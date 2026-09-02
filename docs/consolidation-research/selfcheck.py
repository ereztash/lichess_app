#!/usr/bin/env python3
"""
The study, held against its own authority.

WHY THIS EXISTS.  Study v1 published eighteen laws, four kernel rules, twenty-five contradiction
entries, ten ranked gaps and two scores across fifteen files, and named no authority for any of
them.  Seven drifts followed, inside one authoring pass -- X-17 through X-23 in
`CONTRADICTIONS.md`.  That is the study failing `RNL-05` (one authority per question) about itself,
and `LOCAL_SOLUTION_GAPS.md` G-04 -- a register whose external claims nothing reconciles -- applied
to the study rather than to `research/`.

THE AUTHORITY, DECLARED.  `REPO_NATIVE_OPERATING_SYSTEM.md` section B is the authority for law id,
law statement, law classification and kernel membership.  `PROCESS_CORPUS.json` is the authority
for the corpus.  `SCORING_METHOD_V2.md` is the authority for the formulas.
`AUTHORITY_MAP_V2_ATTACK.md` is the authority for the authority-question count.  This file derives
every cross-file claim from those four and fails on disagreement.

TWO MODES, and the second is the point:

    python3 selfcheck.py                     -- hold the study against its authority.  Any
                                                disagreement exits non-zero.
    python3 selfcheck.py --positive-controls -- run every predicate against a fixture in which
                                                X-17, X-18, X-20, X-21, X-22 and X-23 have been
                                                re-injected.  Every predicate MUST go red.  A
                                                checker that has not demonstrated failure is not
                                                a checker (`RNL-04`).

A predicate that cannot run reports NOT-MEASURED, which is distinct from PASS and is never counted
as success (`RNL-18`).
"""
from __future__ import annotations
import json, os, re, subprocess, sys, tempfile, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
AUTHORITY = "REPO_NATIVE_OPERATING_SYSTEM.md"
STUDY_MD = lambda root: sorted(f for f in os.listdir(root) if f.endswith(".md"))

PASS, FAIL, NOT_MEASURED = "PASS", "FAIL", "NOT-MEASURED"

# Words carried by ordinary prose rather than by a law's statement.
STOPWORDS = {"a", "an", "the", "and", "or", "of", "in", "is", "it", "to", "that", "this", "as",
             "at", "on", "for", "with", "which", "its", "than", "not", "be", "by"}


def _fenced(src: str) -> list[tuple[int, int]]:
    """Character spans inside ``` fences. Text there is a transcript, not a claim."""
    spans, open_at = [], None
    for m in re.finditer(r"^```", src, re.M):
        if open_at is None:
            open_at = m.end()
        else:
            spans.append((open_at, m.start())); open_at = None
    return spans


def quoted(src: str, at: int) -> bool:
    """True when the offset sits inside a fence or an italic quotation *"…"* on its own line.

    Quoted text is EVIDENCE that a drift existed. A register that could not quote the defect it
    records would have to delete it, which is the one thing `RNL-10` forbids.
    """
    for a, b in _fenced(src):
        if a <= at <= b:
            return True
    ls = src.rfind("\n", 0, at) + 1
    le = src.find("\n", at)
    line = src[ls: le if le != -1 else len(src)]
    off = at - ls
    for m in re.finditer(r'\*"[^"]*"\*', line):
        if m.start() <= off <= m.end():
            return True
    return False


def read(root: str, name: str) -> str:
    with open(os.path.join(root, name), encoding="utf-8") as fh:
        return fh.read()


# ---------------------------------------------------------------- the authority, parsed

LAW_ROW = re.compile(
    r"^\|\s*\*\*(RNL-\d\d)\*\*\s*\|\s*(.+?)\s*\|\s*\*{0,2}(\d+)\*{0,2}\s*\|\s*\*{0,2}(\d+)\*{0,2}\s*\|"
    r"\s*\*{0,2}(\d+)\*{0,2}\s*\|\s*\*{0,2}(\d+)\*{0,2}\s*\|\s*(.+?)\s*\|\s*$",
    re.M,
)
KERNEL_MEMBERS = re.compile(r"^>\s*\*((?:`RNL-\d\d`\s*)+)—\s*(\d+)/48 cases, (\d+)/12 domains\*", re.M)
KERNEL_HEAD = re.compile(r"^> ### (K\d) · (.+)$", re.M)


def authority(root: str) -> dict:
    src = read(root, AUTHORITY)
    laws = {}
    for m in LAW_ROW.finditer(src):
        rid, statement, dom, op, fail, nonauth, cls = m.groups()
        laws[rid] = {
            "statement": statement,
            "domains": int(dom), "operational": int(op),
            "failures": int(fail), "nonauth": int(nonauth),
            "class": re.sub(r"[*`]", "", cls).strip(),
        }
    kernels = []
    for head, members in zip(KERNEL_HEAD.finditer(src), KERNEL_MEMBERS.finditer(src)):
        kernels.append({
            "id": head.group(1), "title": head.group(2),
            "members": re.findall(r"RNL-\d\d", members.group(1)),
            "cases": int(members.group(2)), "domains": int(members.group(3)),
        })
    return {"laws": laws, "kernels": kernels, "src": src}


# ---------------------------------------------------------------- predicates
# Each returns (status, detail).  Every one reads the authority and one or more other artefacts.

def p_law_table_parses(root, A):
    if len(A["laws"]) != 18:
        return FAIL, f"section B's law table yields {len(A['laws'])} laws, not 18"
    missing = [f"RNL-{i:02d}" for i in range(1, 19) if f"RNL-{i:02d}" not in A["laws"]]
    if missing:
        return FAIL, f"ids absent from the authority: {', '.join(missing)}"
    return PASS, "18 laws, RNL-01 … RNL-18, parsed from section B"


def p_kernel_partition(root, A):
    if len(A["kernels"]) != 4:
        return FAIL, f"{len(A['kernels'])} kernel rules parsed, not 4"
    seen = [m for k in A["kernels"] for m in k["members"]]
    dupes = {m for m in seen if seen.count(m) > 1}
    if dupes:
        return FAIL, f"law in more than one kernel: {', '.join(sorted(dupes))}"
    repo_wide = {r for r, v in A["laws"].items() if v["class"].startswith("REPO-NATIVE LAW")}
    domain = {r for r, v in A["laws"].items() if v["class"].startswith("DOMAIN LAW")}
    unclassified = set(A["laws"]) - repo_wide - domain
    if unclassified:
        return FAIL, f"law with no recognised class: {', '.join(sorted(unclassified))}"
    if not repo_wide <= set(seen):
        return FAIL, f"repo-wide law outside every kernel: {', '.join(sorted(repo_wide - set(seen)))}"
    if domain & set(seen):
        return FAIL, f"domain law inside a kernel: {', '.join(sorted(domain & set(seen)))}"
    return PASS, f"4 kernels partition {len(repo_wide)} repo-wide laws; {len(domain)} domain laws outside"


def p_kernel_count_agrees(root, A):
    """No study file may say the kernel is any size but the authority's."""
    n = len(A["kernels"])
    words = {3: "three", 4: "four", 5: "five", 6: "six"}
    wrong = []
    for f in STUDY_MD(root):
        src = read(root, f)
        for m in re.finditer(r"\b(three|four|five|six)\s+kernel\s+rules?\b", src, re.I):
            if words[n] != m.group(1).lower() and not quoted(src, m.start()):
                wrong.append(f"{f}: '{m.group(0)}' (authority says {words[n]})")
    return (FAIL, "; ".join(wrong)) if wrong else (PASS, f"every file that names a kernel size says {words[n]}")


HISTORICAL_LABEL = re.compile(
    r"draft|five-rule|rather than the flattering|\bv1\b|Study v1|fell again|historical"
    r"|previous|superseded|\bwas\b|rose from", re.I)


def labelled_as_provenance(src: str, offset: int, pattern: re.Pattern = HISTORICAL_LABEL) -> bool:
    """Is the figure at `offset` labelled with which study it belongs to?

    A label is a label wherever markdown puts it, and markdown puts it in three places:

      1. on the line itself                      "v1 published 97.78 and it was wrong"
      2. in the nearest preceding heading         "### Study v1"
      3. in the header cell of the figure's OWN COLUMN, when the line is a table row

    Case 3 is column-indexed on purpose. A table headed `| field | Study v1 | Study v2 |` must not
    exempt the v2 column just because the word "v1" appears somewhere in the header, or the check
    would wave through exactly the drift it exists to catch.
    """
    lines = src.splitlines()
    idx = src[:offset].count("\n")
    line = lines[idx] if idx < len(lines) else ""

    if pattern.search(line):
        return True

    for i in range(idx - 1, -1, -1):                          # nearest preceding heading
        if lines[i].startswith("#"):
            if pattern.search(lines[i]):
                return True
            break                                             # an unlabelled heading is not a veto

    if line.lstrip().startswith("|"):                          # the figure's own column header
        start = idx
        while start > 0 and lines[start - 1].lstrip().startswith("|"):
            start -= 1
        header = [c.strip() for c in lines[start].strip().strip("|").split("|")]
        col_start = src.rindex("\n", 0, offset) + 1 if "\n" in src[:offset] else 0
        before = src[col_start:offset]
        col = before.count("|") - 1                            # leading pipe is not a separator
        if 0 <= col < len(header):
            return bool(pattern.search(header[col]))
    return False


def p_separation_number(root, A):
    """The published within/between separation is the four-rule figure, not the draft's."""
    m = re.search(r"within/between Jaccard \*{0,2}(\d\.\d\d)×", A["src"])
    if not m:
        return NOT_MEASURED, "section B states no separation figure"
    published = m.group(1)
    wrong = []
    for f in STUDY_MD(root):
        src = read(root, f)
        for hit in re.finditer(r"(\d\.\d\d)×", src):
            v = hit.group(1)
            if v == published:
                continue
            line = src[: hit.start()].count("\n") + 1
            ctx = src.splitlines()[line - 1]
            if quoted(src, hit.start()):
                continue          # a transcript or a quotation is evidence, not a claim
            if labelled_as_provenance(src, hit.start()):
                continue          # a figure explicitly labelled as the draft's is provenance
            wrong.append(f"{f}:{line} {v}× unlabelled (authority publishes {published}×)")
    return (FAIL, "; ".join(wrong)) if wrong else (PASS, f"{published}× is the only unlabelled separation figure")


def p_law_statements_agree(root, A):
    """A law's headline words in any file must match the authority's statement."""
    head = {}
    for rid, v in A["laws"].items():
        first = re.sub(r"[*`]", "", v["statement"]).split("—")[0].split(" - ")[0]
        head[rid] = re.sub(r"[^a-z ]", "", first.lower()).split()
    wrong = []
    for f in STUDY_MD(root):
        if f == AUTHORITY:
            continue
        src = read(root, f)
        for m in re.finditer(r"(RNL-\d\d)\s+([A-Za-z][^|`*\n]{8,90})", src):
            rid, text = m.group(1), m.group(2)
            if rid not in head:
                continue
            words = re.sub(r"[^a-z ]", "", text.lower()).split()
            if len(words) < 2 or not head[rid]:
                continue
            if words[0] not in head[rid]:
                continue          # prose ABOUT a law, not a restatement OF it
            # A restatement may be truncated (a backtick, a table cell). What it may not do is say
            # something the authority does not say: every word it uses must be the authority's.
            # No stray words at all. A restatement may be SHORTER than the authority's sentence
            # (a backtick, a table cell); it may not contain a word the authority does not use.
            # `weaken` where the authority says `weakening` is exactly the drift X-17 was.
            stray = [w for w in words[:9] if w not in head[rid] and w not in STOPWORDS]
            if stray:
                line = src[: m.start()].count("\n") + 1
                lines = src.splitlines()
                window = " ".join(lines[max(0, line - 4): line + 5])
                # A refuted wording quoted WITH its refutation is evidence, not a claim. The
                # refutation has to travel with it -- that is the whole difference between
                # ADVERSARIAL_REVIEW's quotation of the old RNL-16 and EXTERNAL_CROSSWALK's,
                # which is what X-17 was.
                if re.search(r"refut|is false|contradicted|too strong|pre-narrowing|superseded|"
                             r"old wording|the drift|said the adversary|narrowed|still reads|"
                             r"REAL_CONTRADICTION|carries the pre", window, re.I):
                    continue
                wrong.append(f"{f}:{line} {rid} stated as “{text.strip()[:56]}…”")
    return (FAIL, "; ".join(wrong[:6])) if wrong else (PASS, "every restated law agrees with section B")


def p_no_bare_law_token(root, A):
    """`L<n>` may name a rung or an SLSA level. It may never name one of this study's laws."""
    lawish = re.compile(
        r"\bL(1[0-8]|[1-9])\b\s*[`'\"]?\s*(derive|promote only|build the judge|a gate that|one authority|"
        r"identity follows|freeze refuses|evidence authority|derivation, then|failed history|"
        r"do not change|a surface must|a claim must|the level of reality|declare the rejection|"
        r"the adversary is|say what this|refuse rather)", re.I)
    wrong = []
    for f in STUDY_MD(root):
        src = read(root, f)
        for m in lawish.finditer(src):
            line = src[: m.start()].count("\n") + 1
            if re.search(r"X-21|the study reuses|← L6|forbids", src.splitlines()[line - 1]):
                continue          # X-21's own evidence block quotes the defect
            wrong.append(f"{f}:{line} '{m.group(0)[:40]}'")
    return (FAIL, "; ".join(wrong[:6])) if wrong else (PASS, "no bare L-token names a law")


def p_cross_references_resolve(root, A):
    defined_x = set()
    defined_g = set()
    for f in STUDY_MD(root):
        src = read(root, f)
        defined_x |= set(re.findall(r"^#{1,3} (X-\d\d)", src, re.M))
        defined_g |= set(re.findall(r"\*\*(G-\d\d)\*\*", src))
    dangling = []
    for f in STUDY_MD(root):
        src = read(root, f)
        for ref in set(re.findall(r"\b(X-\d\d)\b", src)) - defined_x:
            dangling.append(f"{f}: {ref} referenced, never defined")
        for ref in set(re.findall(r"\b(G-\d\d)\b", src)) - defined_g:
            dangling.append(f"{f}: {ref} referenced, never defined")
    if not defined_x or not defined_g:
        return NOT_MEASURED, "no X- or G- definitions found to resolve against"
    return (FAIL, "; ".join(sorted(dangling)[:6])) if dangling else \
           (PASS, f"{len(defined_x)} X- and {len(defined_g)} G- ids, all references resolve")


def p_contradiction_count(root, A):
    src = read(root, "CONTRADICTIONS.md")
    n = len(re.findall(r"^## (X-\d\d) ", src, re.M))
    claimed = re.findall(r"\*\*(\d+) entries", read(root, AUTHORITY))
    if not claimed:
        return NOT_MEASURED, "the authority states no contradiction count"
    if int(claimed[0]) != n:
        return FAIL, f"authority says {claimed[0]} entries; CONTRADICTIONS.md defines {n}"
    return PASS, f"{n} contradiction entries, and the authority agrees"


def p_ledger_cycle_count(root, A):
    """43 sections, numbered to 47. Re-derived, never quoted."""
    path = os.path.join(REPO, "docs", "PRODUCTION_READINESS_LEDGER.md")
    if not os.path.exists(path):
        return NOT_MEASURED, "PRODUCTION_READINESS_LEDGER.md not present"
    t = open(path, encoding="utf-8").read()
    parts = [p for p in re.split(r"\n(?=## )", t) if p.startswith("## Cycle")]
    ctl = [p for p in parts if re.search(r"(?i)positive control|control(s)? (red|green)|went red|reddens", p)]
    num = lambda p: int(re.match(r"## Cycles? (\d+)", p).group(1))
    lo = [p for p in parts if num(p) < 34]
    hi = [p for p in parts if num(p) >= 34]
    derived = (len(parts), sum(1 for p in lo if p in ctl), len(lo), sum(1 for p in hi if p in ctl), len(hi))
    wrong = []
    for f in STUDY_MD(root):
        src = read(root, f)
        # up to three tokens may sit between the count and the noun -- "all 47
        # `PRODUCTION_READINESS_LEDGER.md` cycle sections" slipped past the tight form
        for m in re.finditer(r"(\d+)\s+(?:(?!\d+\s)\S+\s+){0,3}?(?:ledger )?cycle sections?", src):
            if int(m.group(1)) != derived[0]:
                wrong.append(f"{f}: says {m.group(1)} cycle sections; derived {derived[0]}")
        for m in re.finditer(r"all (\d+) (?:ledger )?cycles\b", src):
            if int(m.group(1)) != derived[0] and not quoted(src, m.start()):
                wrong.append(f"{f}: says 'all {m.group(1)} cycles'; there are {derived[0]} sections")
    detail = f"{derived[0]} sections; <34 {derived[1]}/{derived[2]}, >=34 {derived[3]}/{derived[4]}"
    return (FAIL, "; ".join(wrong[:6]) + f" [derived: {detail}]") if wrong else (PASS, detail)


def p_corpus_counts(root, A):
    path = os.path.join(root, "PROCESS_CORPUS.json")
    if not os.path.exists(path):
        return NOT_MEASURED, "PROCESS_CORPUS.json not present"
    cases = json.load(open(path, encoding="utf-8"))
    n, d = len(cases), len({c["domain"] for c in cases})
    wrong = []
    for f in STUDY_MD(root):
        src = read(root, f)
        for m in re.finditer(r"(?<![/\d])(\d+) cases across (\d+) domains", src):
            if (int(m.group(1)), int(m.group(2))) != (n, d):
                wrong.append(f"{f}: {m.group(0)}; corpus holds {n}/{d}")
        for m in re.finditer(r"(\d+)/(\d+) cases", src):
            if int(m.group(2)) != n:
                wrong.append(f"{f}: denominator {m.group(2)}; corpus holds {n}")
    return (FAIL, "; ".join(sorted(set(wrong))[:6])) if wrong else (PASS, f"{n} cases, {d} domains, agreed everywhere")


def p_scores_single_sourced(root, A):
    """Every score printed anywhere must be one the authority publishes, or be labelled v1."""
    published = set(re.findall(r"#\s*(\d\d\.\d\d) ?/ ?100", A["src"])) | \
                set(re.findall(r"#\s*(\d\d\.\d\d) ?%", A["src"])) | \
                set(re.findall(r"#\s*(\d\d\.\d\d)\s*`?WES", A["src"]))
    if not published:
        return NOT_MEASURED, "the authority publishes no headline score"
    wrong = []
    for f in STUDY_MD(root):
        src = read(root, f)
        for m in re.finditer(r"\b(9[0-9]\.\d\d)\s*(?:/\s*100|%)", src):
            v = m.group(1)
            if v in published:
                continue
            line = src[: m.start()].count("\n") + 1
            if labelled_as_provenance(src, m.start()):
                continue
            wrong.append(f"{f}:{line} {v} unlabelled")
    return (FAIL, "; ".join(wrong[:6])) if wrong else (PASS, f"published: {', '.join(sorted(published))}; every other figure labelled")


PREDICATES = [
    ("SC-01 law table parses", p_law_table_parses),
    ("SC-02 kernel partitions the repo-wide laws", p_kernel_partition),
    ("SC-03 kernel size agrees everywhere", p_kernel_count_agrees),
    ("SC-04 one unlabelled separation figure", p_separation_number),
    ("SC-05 restated laws agree with the authority", p_law_statements_agree),
    ("SC-06 no bare L-token names a law", p_no_bare_law_token),
    ("SC-07 every X-/G- reference resolves", p_cross_references_resolve),
    ("SC-08 contradiction count agrees", p_contradiction_count),
    ("SC-09 ledger cycle count is derived", p_ledger_cycle_count),
    ("SC-10 corpus counts agree", p_corpus_counts),
    ("SC-11 scores are single-sourced", p_scores_single_sourced),
]

# ---------------------------------------------------------------- the positive control
# The same predicates over a fixture with the drifts re-injected. Every one must go red.

INJECTIONS = [
    (AUTHORITY, "within/between Jaccard **1.39×**", "within/between Jaccard **1.58×**"),
    ("EXTERNAL_CROSSWALK.md",
     "**RNL-16 the adversary is scheduled, and may repair the *instrument* in either direction while only ever weakening a *claim***",
     "**RNL-16 the adversary is scheduled and may only weaken**"),
    ("ADVERSARIAL_REVIEW.md", "into four kernel rules loses", "into five kernel rules loses"),
    ("CONTRADICTIONS.md", "as `G-02` rather than here", "as `G-99` rather than here"),
    ("ADVERSARIAL_REVIEW.md", "**43 ledger cycle sections** (cycles numbered 1–47)", "all 47 ledger cycles"),
    (AUTHORITY, "| **RNL-06** | **Identity follows semantics, not labels.**",
                "| **RNL-06** | **L6 identity follows semantics, not labels.**"),
    # SC-11, the plain path: a score on an unlabelled line, in no table, under no v1 heading
    ("README.md", "**Study v2 score 91.82 / 100 — target > 95 NOT MET.**",
                  "**Study v2 score 93.40 / 100 — target > 95 NOT MET.**"),
    # SC-11, the column path: strip the column header that labels v1's figures as v1's
    ("AMENDMENT_CHAIN.md", "| field | Study v1 | Study v2 | Δ |",
                           "| field | column A | column B | Δ |"),
]


def build_fixture(dest: str) -> list[str]:
    applied = []
    for f in os.listdir(HERE):
        if f.endswith((".md", ".json")):
            shutil.copy(os.path.join(HERE, f), os.path.join(dest, f))
    for name, old, new in INJECTIONS:
        p = os.path.join(dest, name)
        s = open(p, encoding="utf-8").read()
        if old in s:
            open(p, "w", encoding="utf-8").write(s.replace(old, new, 1))
            applied.append(f"{name}: {old[:44]}…")
    return applied


def run(root: str, label: str, expect_red: bool) -> int:
    print(f"\n{label}\n{'-' * len(label)}")
    A = authority(root)
    bad = 0
    for name, fn in PREDICATES:
        try:
            status, detail = fn(root, A)
        except Exception as exc:                      # a predicate that cannot run says so
            status, detail = NOT_MEASURED, f"{type(exc).__name__}: {exc}"
        print(f"{status:<13} {name:<46} {detail[:104]}")
        if expect_red:
            if status != FAIL:
                bad += 1
        else:
            if status != PASS:
                bad += 1
    return bad


def main() -> int:
    controls = "--positive-controls" in sys.argv
    if not controls:
        bad = run(HERE, "Study self-check -- the study against its own authority", expect_red=False)
        print(f"\n{len(PREDICATES)} predicates: {len(PREDICATES) - bad} pass, {bad} not passing.")
        return 1 if bad else 0

    with tempfile.TemporaryDirectory() as tmp:
        applied = build_fixture(tmp)
        print("Injected drifts:")
        for a in applied:
            print(f"  {a}")
        if len(applied) != len(INJECTIONS):
            print(f"\nHARNESS ERROR: {len(applied)} of {len(INJECTIONS)} injections applied.")
            return 2
        bad = run(tmp, "Positive controls -- every predicate that covers an injected drift must go RED",
                  expect_red=True)
        covered = len(PREDICATES) - bad
        print(f"\n{covered} of {len(PREDICATES)} predicates went red on the injected fixture.")
        # Not every predicate has an injection; the ones that must go red are named here.
        MUST = {"SC-03 kernel size agrees everywhere", "SC-04 one unlabelled separation figure",
                "SC-05 restated laws agree with the authority", "SC-06 no bare L-token names a law",
                "SC-07 every X-/G- reference resolves", "SC-09 ledger cycle count is derived",
                "SC-11 scores are single-sourced"}
        A = authority(tmp)
        unproven = []
        for name, fn in PREDICATES:
            if name not in MUST:
                continue
            try:
                status, _ = fn(tmp, A)
            except Exception:
                status = NOT_MEASURED
            if status != FAIL:
                unproven.append(name)
        if unproven:
            print("PREDICATES WITH AN INJECTION THAT DID NOT GO RED: " + "; ".join(unproven))
            return 1
        print("Every predicate with an injected drift went red.")
        return 0


if __name__ == "__main__":
    sys.exit(main())
