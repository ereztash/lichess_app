# SCORING_METHOD

Written **before** the final score and the final confidence were computed, and not revised after
seeing them. Every formula below is arithmetic over counts that already exist in
`PROCESS_CORPUS.json`, `CONTRADICTIONS.md`, `AUTHORITY_MAP.md`, the law-support matrix, and the
commands run in this study. Nothing in the final numbers is a judgement expressed as a decimal.

The arithmetic is executed by `scripts/score.py` in this directory's scratch record and reproduced
verbatim in `REPO_NATIVE_OPERATING_SYSTEM.md` §M–§N.

---

## Part 1 — Methodological score, out of 100

### Dimension 1 — Corpus coverage, 20 points

The *relevant authored repository* is the **governing subset**: every file that can state, enforce
or record a rule. Defined by path, reproducibly:
`docs/**`, `README.md`, `VERCEL_DEPLOYMENT.md`, `tests/LEVELS.md`, `research/**/*.md`,
`.github/workflows/**`, `scripts/**`, `.claude/**`. That set is **169 files**.

```
coverage      = classified_governing_files / governing_files
D1            = 20 × min(1, coverage / 0.95)          # 95% earns full marks
```

**Mandatory, and each is a hard zero for the dimension if unmet:**
- every `docs/decisions/D*.md` file that exists, read and represented in the corpus;
- `MASTER_PRODUCT_DEBT.md`, `PRODUCTION_READINESS_LEDGER.md`, `FINDINGS.md`, `ACTION_PLAN.md`,
  `INERTIAL_UX_LAWS.md`, `INTERACTION_GEOMETRY.md`, `VALUE_CLARITY.md`,
  `VALUE_CLARITY_FIELD_PROTOCOL.md`, `ACQUISITION_EVIDENCE.md`, `MEASUREMENTS.md`,
  `tests/LEVELS.md`, all seven `docs/design-council/` files, `.github/workflows/verify-build.yml`,
  `scripts/run_gates.ts`.

Numbering gaps in the decision series (`D06`, `D07`, `D10`–`D19` do not exist as files) are
**not** corpus gaps and do not reduce the score; they are recorded in `PROCESS_CORPUS.md` §2.

### Dimension 2 — Cross-domain replication, 20 points

A candidate law **replicates** when it meets the mission's independence bar, computed from the
law→case matrix rather than asserted:

```
replicates(L)  =  domains(L) ≥ 3
              AND operational_instances(L) ≥ 2
              AND failures_explained_by_violation(L) ≥ 1
              AND no UNRESOLVED contradiction invalidates it

D2             = 20 × (repo_native_laws / candidate_laws)
```

`domains(L)` is counted from the corpus domains of the cases that support `L`, **not** from a
hand-written list. A candidate failing the bar is downgraded to `DOMAIN LAW` or `LOCAL PATTERN`; it
still counts in the denominator. A method that promoted everything would score the same as one that
promoted nothing, so the dimension also carries a **kernel-parsimony penalty**:

```
penalty        = 2 points if the published kernel has more than 7 rules
D2             = max(0, D2 − penalty)
```

### Dimension 3 — Contradiction resolution, 15 points

```
classified     = contradictions with a class AND direct cited evidence
D3_raw         = 15 × classified / total_contradictions
D3             = 0 if any UNRESOLVED contradiction is critical (P0),
                 else D3_raw − 3 × (non-critical UNRESOLVED count)
```

A contradiction is **critical** if it is P0 by the repository's own severity scale — *a claim or a
record can be lost or made wrong*.

### Dimension 4 — Authority resolution, 15 points

```
D4 = 15 × (critical_questions_with_one_current_authority_and_known_lineage
           / critical_questions_enumerated)
```

"Known lineage" means the entry names what it superseded, or `—` for an original. A question with
two unscoped claimants counts as 0 for that row.

### Dimension 5 — Falsifiability, 15 points

A law is falsifiable-as-published when all three are present:
a **counterexample search** (hits or a recorded null), a **failure condition**, and a
**domain boundary**.

```
D5 = 15 × laws_with_all_three / total_laws
```

### Dimension 6 — Operational grounding, 15 points

```
grounded(L)    = L has ≥ 2 instances enforced by EXECUTABLE behaviour
                 (a gate, a type, a scanner, a runtime refusal) — prose does not count
D6_raw         = 15 × grounded_repo_wide_laws / repo_wide_laws
D6             = D6_raw, but capped at 12 unless at least one enforcement
                 was EXECUTED during this study rather than read
```

### The >95 bar

A total above 95 additionally requires **all** of:
- no critical corpus gap;
- no unresolved P0 contradiction;
- every repo-wide law operationally grounded;
- the authority map complete for every critical question;
- at least one falsification attempt for every law.

If any is unmet the total is reported as computed and the bar is reported as unmet. **94.6 is not
rounded to 95.**

---

## Part 2 — Evidential confidence, as a percentage

### Evidence strength, per the mission's scale

| support | strength |
| --- | ---: |
| `DIRECT_EXECUTABLE_EVIDENCE` — a command run in this study, or a type that will not compile | 1.00 |
| `DIRECT_AUTHORED_EVIDENCE` — a sentence read in the repository at a cited path | 0.90 |
| `MULTIPLE_CONVERGING_INDIRECT` — three or more independent authored sources agreeing | 0.75 |
| `SINGLE_INDIRECT` | 0.50 |
| `INFERENCE` | 0.25 |
| `UNKNOWN` | 0.00 |

### Conclusion weights

Larger weights go to conclusions that would govern repository-wide operating rules:

| weight | class of conclusion |
| ---: | --- |
| 5 | the executive verdict (does a coherent OS exist) |
| 4 | a kernel law |
| 3 | the authority model; the evidence model; the state-transition model |
| 2 | a non-kernel repo-native law; a top-3 local-solution gap; a `REAL_CONTRADICTION` classification |
| 1 | a domain law; a lower-ranked gap; a non-critical contradiction classification |

### The calculation

```
Confidence = Σ(weight_i × strength_i) / Σ(weight_i) × 100
```

### Ceilings, applied after the calculation and taking the minimum

| condition | ceiling |
| --- | ---: |
| any unresolved critical contradiction | 90% |
| incomplete core process corpus | 92% |
| any repo-wide law supported by only one domain | 90% |
| current authority unknown for any critical scientific claim | 90% |
| inability to distinguish current from historical evidence | 85% |

### Target

`> 95.5%`. If it is not reached, the actual value is reported together with the exact additional
evidence that would raise it, and the mission terminates with
`IN-HOUSE OPERATING SYSTEM NOT YET RESOLVED`.

---

## What this method cannot do

It cannot detect a domain that was never looked at — coverage is measured over the files that
exist, and a process that lives only in a maintainer's head is invisible to it. It cannot tell a
law that is followed from a law that is merely *documented as followed*, except through Dimension 6,
which is why Dimension 6 requires execution rather than reading. And it will over-reward a
repository that writes well: much of the evidence here is authored prose at strength 0.90, and prose
that is wrong reads exactly like prose that is right. Dimension 6 and the executed commands are the
only defence against that, and they cover **28 gates, 28 controls, and one derivation scan** — not
the whole corpus.
