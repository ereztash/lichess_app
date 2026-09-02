# ADVERSARIAL_REVIEW

A separate pass whose job is to prove the reconstructed operating model wrong. It may **downgrade or
narrow** a principle. It may not upgrade one. Every attack below was run against the draft model and
its verdict is recorded whether or not it changed anything.

Where the adversary wins, the change is applied to `REPO_NATIVE_OPERATING_SYSTEM.md` and said so
here.

---

## Attack 1 — "The patterns are documentation style, not process"

**The case.** This repository is **twelve days old**. `git log` on `main`: 328 commits, first
2026-08-22, last 2026-09-02. **262 of 328 commits are authored by `Claude <noreply@anthropic.com>`**
and 66 by the owner. Thirteen distinct session ids appear in the commit trailers. A single authoring
process wrote every domain in a fortnight. "Independent replication across domains" is a much weaker
guarantee here than in a repository with many hands over years: the same voice can produce the same
shape everywhere without any of it being a *process*.

**VERDICT: PARTIALLY CONCEDED — the strongest attack of the ten, and the independence criterion is
narrowed because of it.**

What survives the attack is what could not have been produced by writing:

| channel | what it discovered, which authoring did not |
| --- | --- |
| **executed controls** | 28 gates green and 28 controls red, run in this study, not read |
| **a real browser** | five shipped defects that 246 green test files were green through; a bucket label collapsed to one glyph per line; a signed gap with its minus on the wrong side |
| **a real clock** | `performance.now()` returns a double, so no blitz game had ever been persisted |
| **a real database** | `DrizzleRecordStore` had never executed a statement |
| **a review bot on a pull request** | `D09`'s trusted `validation_protocol`; `D20`'s precedence-instead-of-union |
| **the human owner** | a cold arrival could not reach a game; the writing surface at the end of an RTL reading line; the `VERIFIED` flag's default |
| **a different model in a fresh context** | four B3 gates; nine defects in the repairs to thirteen findings, then five more |
| **the passage of time** | `tests/LEVELS.md` says 246 files; the scan run in this study says 264, and nothing had to be edited |

**And there is a measured adoption curve, which documentation style does not have.** Scanning all
**43 ledger cycle sections** (cycles numbered 1–47) for a positive-control mention:

| cycles | mention a control |
| --- | --- |
| 1–33 | **7 / 29 = 24%** |
| 34–47 | **14 / 14 = 100%** |

A style is uniform from the first page. This is a discipline that was **learned at a datable point**
and then held. That is the single strongest piece of evidence in this study that the operating
system is real.

**Applied change.** The independence bar in `REPO_NATIVE_OPERATING_SYSTEM.md` §B is restated: a law
is repo-wide when it meets the mission's count **and** at least one of its supporting failures was
discovered by a channel other than authoring.

The added condition was then computed rather than assumed. **30 of the 48 corpus cases (62%) carry a
non-authoring discovery channel**, and **all eighteen candidate laws have at least one.** So the
condition downgrades nothing on its own — what it establishes is the *distribution*, and the
distribution is uneven: `RNL-17` has 19 such cases, `RNL-02` and `RNL-13` have 9 each, and **`RNL-11` has exactly
one** (`C30`, an executed control that came back green — a case that supports four other laws more
centrally). `RNL-11` is therefore flagged as the weakest repo-wide law, on measured grounds rather than
on a feeling (see Attack 2).

---

## Attack 2 — "The principles are not independent of each other"

**The case.** Two clustering passes were run over the corpus — Pass A by the kind of question, Pass
B by the transition structure. If the principles were independent dimensions, the two passes would
agree. They do not:

```
Adjusted Rand Index      0.125
Normalised Mutual Info   0.314
best 1:1 alignment       23 / 48 cases = 48%
```

And the five-kernel grouping is barely supported by co-occurrence:

```
mean within-kernel Jaccard   0.145
mean between-kernel Jaccard  0.092
ratio                        1.58×
```

The draft's 1.58× separation is not a discovered structure. It is a plausible grouping laid over a
corpus. (Study v2 later removed a domain law from `K1` and the figure fell again, to **1.39×**,
which is what the authority now publishes. Every revision has made it worse.)

**VERDICT: CONCEDED. The kernel is a logical grouping, not an empirical clustering, and it is now
published as one.**

**Applied changes.**
1. §B states plainly that the kernel is **derived by argument from the eighteen laws, and is only
   weakly supported by their co-occurrence in the corpus**. The v1 four-rule kernel measured 1.44×
   (the 1.58× above is the five-rule draft's figure, and it is the better-looking of the two);
   Study v2's corrected kernel measures **1.39×**, and that is the published figure.
2. **The draft's fifth kernel is dissolved.** It covered 11/48 cases across 5 domains — half the
   reach of the next weakest — and one of its three members (`RNL-09 derivation → shadow → ownership`)
   is a **DOMAIN LAW** with only 2 domains. `RNL-07` moves to `K1` (it is the refusal clause of *the
   record decides*), `RNL-11` moves to `K4` (changing the instrument and the intervention together
   licenses no claim), and `RNL-09` is published outside the kernel as a domain law. The kernel is
   **four rules**, covering 48/48 cases, each spanning 9–12 of the 12 domains — and its within/between
   separation was **1.44×** in v1, slightly worse than the five-rule draft's 1.58×, which is reported
   rather than the flattering number. Study v2 corrected `K1`'s membership (`X-26`) and it fell
   again, to the published **1.39×**.
3. **`RNL-11` is flagged as the weakest repo-wide law.** It meets the mission's stated bar (3 domains,
   4 operational instances, 2 failures) and it has **exactly one** case whose failure was found
   outside authoring, against `RNL-17`'s nineteen. The draft said every failure supporting it was found by an audit
   rather than by a runtime, a browser, a control, a bot, the owner or another model.** It is the
   only one of the sixteen with that property. The exact evidence that would strengthen it is named
   in §I.

What survives: the two passes do agree on **four** pairs at purity 0.50–0.71 —
`A1↔B1`, `A3↔B2`, `A4↔B6`, `A6↔B3`. Those four are real process families. What the disagreement
shows is that **two of the semantic groups are not families at all**: identity/provenance and
supersession are *cross-cutting operations* that appear inside every family. That is a finding, and
it is now stated in §D rather than hidden.

---

## Attack 3 — "The examples were cherry-picked"

**The case.** 48 cases were chosen by a reader looking for patterns. Six of 43 ledger cycle sections
were read in full. A selection made while holding a hypothesis will find it.

**VERDICT: PARTIALLY CONCEDED, and mitigated mechanically rather than argued away.**

The mitigation is that the two strongest claims in this study were checked by **scanning every
instance**, not by sampling:

- the control-adoption curve above scans **all 43 cycle sections**, not the six that were read;
- the corpus-coverage table classifies **all 169 governing files**, not the ones that produced cases;
- the gate claim was **executed** over all 28 gates and all 28 controls.

Two of those three scans produced results the sampled reading had not predicted: the 24%→100%
adoption curve, and the fact that **22 of 43 cycle sections carry no control mention at all**. A
cherry-picked corpus would not have surfaced either.

**Applied change.** §B's claim about `RNL-04` is bounded in time: *universal for gates since cycle 34;
sporadic before*.

---

## Attack 4 — "The principles contradict existing code"

**The case.** `RNL-01 derive, don't declare` is contradicted by `LearningQueue.tsx:111`, which renders
the stored grade. `RNL-07 freeze refuses` is contradicted by `PREREGISTRATION_FREEZE.json`, whose
amended hash set is stale for `DATA_PROTOCOL.md`.

**VERDICT: UPHELD, and both are already published as `REAL_CONTRADICTION`.**

Neither is hidden. `CONTRADICTIONS.md` X-01 and X-02 carry them with direct evidence, and both are
**named by the repository itself** — X-01 in the ledger's own *"Still open and stated plainly"*, X-02
implicitly via `POST_FREEZE_AMENDMENTS.md`, which exists to carry exactly this class of change.

**But the adversary wins a narrowing.** `RNL-01` and `RNL-07` each carry a live counterexample, and
in a twelve-day-old
repository is not "the repository does this". It is "the repository has decided this and has not
finished". §B now states each law's **compliance**, counted, rather than asserting the law holds.

---

## Attack 5 — "Generalising this would create more bureaucracy than value"

**The case.** `RNL-16` costs a full independent review context per gate — B3 spent four, plus three
re-reads. `RNL-09` costs a measured **+16.1 kB raw / +5.1 kB gzipped** on two hot routes. `RNL-04` doubles
the CI's gate work. `RNL-15` requires a written rule before every measurement. Applied to a bug fix,
each is absurd.

**VERDICT: UPHELD, and it is why every law in §B carries a stated boundary.**

The repository has already refused each of these once, with a number:
- `D22` refused instrumenting two more surfaces **because of the 16.1 kB**, not out of caution;
- `GATE-CLAIM-ANCHOR` began as a ratchet rather than a bar, because *"a gate red on the day it is
  written, with seven pieces of unplanned work between it and green, gets deleted rather than met"*;
- `RNL-13`'s own boundary excludes defect repairs, whose reversal condition is a red test.

**Applied change.** §H (non-generalisable knowledge) is expanded: `RNL-16` and `RNL-09` are explicitly
**not** repository-wide operating rules. They are expensive instruments to be spent where a result
will be believed and is costly to redo.

---

## Attack 6 — "This renames ordinary engineering practice"

**The case.** `RNL-04` is mutation testing. `RNL-13` is an ADR. `RNL-15` is preregistration. `RNL-14` is the test
pyramid with different labels. `RNL-10` is `git log`. Strip the prose and there is nothing here a
competent team does not already do.

**VERDICT: PARTIALLY CONCEDED on the individual laws; REJECTED on three of them and on the
combination.**

Conceded: `RNL-13` ≈ ADR + reversal condition; `RNL-15` ≈ preregistration; `RNL-16` ≈ artifact evaluation.
These have standard names and `EXTERNAL_CROSSWALK.md` says so.

Rejected on three:
- **`RNL-14` is not the test pyramid.** The pyramid prescribes proportions. `tests/LEVELS.md` explicitly
  refuses to: *"a ladder is not a promise that higher is always better — it is a way to ask which
  rung a claim needs"*, and defect 5 needed **L3 asking a better question**, not L5. No standard
  found has this.
- **`RNL-04` is stronger than mutation testing as normally practised.** Mutation testing perturbs the
  *code under test*. Here the gate and its control run **the same predicate over different input**,
  and a control red *for the wrong reason* is treated as a defect — which is why
  `GATE-NO-DUPLICATE-ACTION` had to be split out of `GATE-ONE-PRIMARY-ACTION`.
- **`RNL-08` has no standard analogue at all.** ISO/IEC 25010:2023 names nine quality characteristics
  and none of them is *what a claim is permitted to become given what was done to it*.

And the combination is not ordinary: **28 enforced checks each with a proven-red control, in a
product whose test suite exists to be distrusted, in a repository whose own registers are scanned
for drift.** No OSS project examined in `docs/design-council/SOURCES.md` or in this crosswalk pairs
those three.

---

## Attack 7 — "An external standard would solve this better"

**The case.** SLSA solves provenance. W3C PROV solves supersession. OpenSSF Scorecard solves supply
chain. Adopt them and delete the local vocabulary.

**VERDICT: PARTIALLY UPHELD — one real gap, and one inversion the attack gets wrong.**

Upheld: **W3C PROV / RO-Crate is a genuine capability the repository never discovered.** Every
supersession chain here is prose. `wasRevisionOf` would make them machine-readable, which is
`LOCAL_SOLUTION_GAPS.md` G-04 with a standard vocabulary. This is recorded in §G as the strongest
external contribution.

Upheld, at low severity: SLSA L1's requirement that provenance be **platform-generated, not
author-generated** is exactly what `CONTRADICTIONS.md` X-02 violates. Branch protection is off and
actions are pinned by tag.

**Rejected, and this is where the attack inverts a law.** OpenGitOps' *continuously reconciled*
looks like `RNL-01` and is its opposite: GitOps holds the **declaration** authoritative and converges the
world; this repository holds the **world** authoritative and converges the declaration.
`register-scan.ts` is drift detection with no actuator, deliberately. Importing GitOps' framing
would reverse the law's direction.

**Applied change.** `RNL-01` is now stated **with its direction** in §B.

---

## Attack 8 — "The model deletes useful domain distinctions"

**The case.** Compressing eighteen laws into four kernel rules loses the distinctions the repository
paid to learn — the difference between an E-level and an L-level, between `refuted` and `hypothesis`,
between `REPO-CLEAR` and `FIELD-REQUIRED`.

**VERDICT: UPHELD as a risk, and answered by publishing both layers.**

`EVIDENCE_MODEL.md` tests the six ladders pairwise and finds them **orthogonal**, with one floor
relation and one label collision. It concludes explicitly: *do not unify the ladders*. The kernel is
published as an explanation of the eighteen laws, **not as a replacement for them**, and §C keeps the
full primitive vocabulary.

**Applied change.** §B publishes all eighteen laws with their classifications; the four kernel rules
appear as a *reading* of them, with the published separation caveat attached (1.44× in v1,
**1.39×** after `X-26`).

---

## Attack 9 — "'Derive, don't declare' has important exceptions"

**The case.** Four states in this repository cannot be derived and must not be: a player's act of
retiring a rule; a frozen threshold; an owner's identity preference; a ratchet.

**VERDICT: UPHELD IN FULL, and the exceptions are the law's boundary rather than counterexamples.**

The repository already handles each, and each handling is different:
- `retired` — declared, guarded in the **store** because a service check loses the same race, never
  re-derived;
- a frozen threshold — declared and **hashed**, so that changing it changes the identity;
- an owner preference — declared and **ranked last**, at level 12 of a twelve-level authority order,
  named as taste wherever it decided anything;
- a ratchet — declared, and the declaration is the mechanism.

**Applied change.** `RNL-01`'s boundary in §B names all four, and `DERIVATION_AUDIT.md` records that
**none of the five `DECLARED_UNVERIFIED` states is a place where a derivation was available and a
declaration was chosen.**

---

## Attack 10 — "Consolidation under this model could damage scientific provenance"

**The case.** The model's own `RNL-05` (one authority per question) is a licence to merge. Applied
carelessly it would delete `research/b2/as-published-75/`, collapse `verdict.json` into
`verdict_repaired.json`, merge the two `STRONGEST_PERMITTED_CLAIM` files, tidy `POST_FREEZE_AMENDMENTS.md`
into the freeze record, and delete `docs/measurement/`'s superseded rounds — every one of which is
a **load-bearing** artifact.

**VERDICT: UPHELD, and it is the most dangerous finding in this study.**

`RNL-05` and `RNL-10` are in tension by construction, and the tension is the whole design: **one current
answer, every previous answer kept.** A consolidation that reads `RNL-05` without `RNL-10` destroys the
repository's strongest property.

**Applied changes.**
1. §K (*what not to change*) is written as an explicit, itemised **do-not-touch list** with the
   reason each item is load-bearing.
2. §B restates `RNL-05` as *"one authority per **question**"*, with the note that it is a rule about
   questions and **not** about files, and that merging two documents which answer different
   questions destroys the property it is trying to create — the repository's own words.
3. §J states that consolidation governed by this model is **not a merge**. It is: name the question,
   name its current authority, add the supersession pointer where one is missing, and leave the
   history where it is.

---

## Summary of what the adversary changed

| # | change |
| --: | --- |
| 1 | The independence bar now requires one failure discovered outside authoring. |
| 2 | The kernel is published as a **logical** grouping with its weak empirical support stated — the v1 draft's 1.58×, then 1.44×, and **1.39×** after `X-26`. |
| 3 | **The fifth kernel rule is dissolved**; the kernel is four rules, and the worse separation number is the one published at every step (v1 draft 1.58× → v1 1.44× → v2 **1.39×**). |
| 4 | **`RNL-09` and `RNL-12` are `DOMAIN LAW`** (2 domains each), not repo-wide. |
| 5 | **`RNL-11` is flagged as the weakest repo-wide law** — one non-authoring case against `RNL-17`'s nineteen. |
| 6 | `RNL-04`'s claim is bounded in time: universal for gates since cycle 34, sporadic before. |
| 7 | `RNL-01` is restated **with its direction**, against the GitOps inversion. |
| 8 | `RNL-05` is restated as a rule about **questions**, not files. |
| 9 | `RNL-16` and `RNL-09` are named as **expensive instruments, not repository-wide rules**. |
| 10 | §K is written as an itemised do-not-touch list. |

**Nothing was upgraded.**

---

## Attack 11 — added after execution: "'The adversary may only weaken' is false"

**Raised by running the repository rather than reading it.** `src/evaluate.py` was executed in this
study against both committed analyses:

```
python3 src/evaluate.py --analysis results/analysis_final.json     -> INVALID_EXPERIMENT,        level null
python3 src/evaluate.py --analysis results/analysis_repaired.json  -> GENERAL_REGULARITY_ONLY,   level 3
```

Both reproduce their committed verdict files exactly, including all seven failed H2 conditions.

**The case.** Gate 3's adversary pinned a one-line repair to control `C3`'s null construction, and
the verdict moved **from `INVALID_EXPERIMENT` to `GENERAL_REGULARITY_ONLY` at level 3**. That is not
a weakening. The published law `RNL-16 the adversary is scheduled, and it may only weaken` is
contradicted by the repository's own strongest scientific artefact.

**VERDICT: UPHELD. The law is narrowed.**

`RNL-16` is restated as:

> **The adversary is scheduled, and may repair the *instrument* in either direction while only ever
> weakening a *claim*.**

The distinction is the repository's own and it is enforced by four things visible in the diff:
the repair was **pinned** (`src/repair_c3.py` asserts byte-identity outside the `C3` block and
*refuses to write otherwise*), the **shipped `C3` block is kept beside the repaired one**,
`evaluate.py` was run **unmodified** on both, and **both verdicts are published**. Gate 4 — the
claim audit — then produced twenty-four findings of which fifteen were required, and
`MODEL_LEDGER.md` records that *"no verdict, level, threshold or estimate changed"*: every one a
weakening or a qualification.

So the repository runs two different adversarial roles and the draft model had collapsed them:
an **instrument adversary**, which may move a number in either direction under a pinned diff, and a
**claim adversary**, which may only weaken. Reading them as one rule would either forbid the C3
repair or license Gate 4 to strengthen a sentence.

**Applied change.** `RNL-16`'s statement in §B is replaced with the two-role form above, and §I records
that the narrowing was found by execution rather than by reading — which is the same channel that
produced most of the evidence this whole model rests on.

---

# Study v2 — the second adversarial pass

Attacks 1–11 attacked the **model**. Attacks 12–19 attack the **repairs**, on the mission's own
principle applied one level up: *nothing gains authority until a step ran that could have taken it
away.* A corrected score has not earned authority until something tried to break the correction.

Two of the eight found defects. Both are recorded in `SCORING_METHOD_V2.md` §0 with the frozen
pre-repair number beside them, and both **lowered** the result.

---

## Attack 12 · The corrected `D2` still cannot see a wrong evidence count

**Claim under attack.** `D2 = 19.83 / 20` on separation `1.000` and κ `1.000`, so the
classification is excellent.

**The attack.** Cohen's κ compares two raters. Here rater two is `bar()`, a deterministic function
of `domains`, `operational`, `failures` and `non-authoring` — **the same four numbers the study
assigned**. κ therefore measures whether the study applied its own bar to its own counts
consistently. It cannot see a wrong count. A study that quietly recorded `RNL-11` at four domains
instead of three would score κ `1.000` and be wrong.

**What was measured instead.** How close each classification sits to flipping:

| law | domains | margin to the nearest boundary | a −1 miscount would make it |
| --- | ---: | ---: | --- |
| `RNL-07` | **3** | **0** | `DOMAIN LAW` |
| `RNL-11` | **3** | **0** | `DOMAIN LAW` |
| `RNL-16` | **3** | **0** | `DOMAIN LAW` |
| `RNL-04` `RNL-06` | 4 | 1 | unchanged (another count binds first) |
| `RNL-03` | 7 | 1 on *failures* | unchanged |
| the other twelve | 4–12 | ≥ 2 | unchanged |

**VERDICT: UPHELD, and not repaired.** **Three of the sixteen repository-wide laws sit exactly on
the bar**, and a single domain miscount demotes each. Under that worst case the model is 13
repository-wide and 5 domain laws, and `K1`, `K2` and `K4` each lose a member.

The repair would be an independent re-derivation of the domain sets by a reader who did not write
them, and this study cannot supply one — it is a single reader. What it can supply is the
**mapping**, now published in [`LAW_SUPPORT.json`](LAW_SUPPORT.json), so the next reader can
recount all 48 cases against all 18 laws and this attack becomes checkable rather than
hypothetical. `D2` is not reduced for it, because reducing a dimension after seeing its score is
the defect `SCORING_METHOD_V2.md` exists to prevent. It is published as the model's sharpest
remaining fragility instead.

---

## Attack 13 · `D1b`'s denominator was chosen by the study — a defect, found and repaired

**Claim under attack.** `D1` was split (Defect B) so coverage could no longer be defined as the
subset already read.

**The attack.** `D1a`'s population is a path rule. `D1b`'s was *"every implementation file named as
evidence by a corpus case, an authority-map row, or a law's operational-instance list"* — three
study artefacts. **Cite 85 files and quote 16 → `2.59 / 6`. Cite only the 16 you quoted →
`6.00 / 6`.** Nothing else in the score falls far enough to pay for the narrowing.

**VERDICT: UPHELD. Defect G**, `SCORING_METHOD_V2.md` §0-G. The repair for Defect B introduced it:
one denominator was fixed and its neighbour left self-chosen.

**Applied change.** The population is now every implementation file that **at least one of the 169
governance files names** — a property of the tree. `quoted` is derived too, by
[`d1b_population.py`](d1b_population.py), through five wrong detectors published in §0-G. Result:
**204 files, 26 quoted, `D1b` 2.335 / 6**, and the total fell from `91.82` to `91.56`; round two of Attack 15 then took it to `90.73`.

---

## Attack 14 · `WES` passes its threshold on self-assigned strengths

**Claim under attack.** `WES = 96.74 > 95.5`, with `WES₉₀ = 100 %`.

**The attack.** Every conclusion sits at `1.00` or `0.90`, so

```
WES = 90 + 10 × (share of weight at 1.00)
```

and `WES > 95.5` is exactly the claim **"more than 55 % of published consequence is backed by a
command that was run"**. The current share is 74 %. Nothing external audits which conclusions
earned `1.00`; `EXECUTION_LOG.md` names the command behind each, and a reader must check.

**Worse, the metric rose three times in this pass while the score fell twice.** Publishing Defect E
moved it `96.46 → 96.52`; Defect G, `→ 96.57`; the round-two authority questions and this pass's
own findings, `→ 96.74`. **Every well-evidenced thing the study says about its own failures raises
its evidence-support figure.**

**VERDICT: UPHELD, unrepairable inside this study, and published rather than smoothed.** It is why
the metric was renamed. A reader who wants to know whether the model is right should read `D2`,
`D5` and the contradiction register, not `WES`.

---

## Attack 15 · The completeness attack was itself incomplete

**Claim under attack.** `AUTHORITY_MAP_V2_ATTACK.md` corrected `24 / 24` to `24 / 32` by finding
eight omitted questions, and `D4` is now honest.

**The attack.** The round-one enumeration was produced by the same reader whose enumeration had
just been shown too small. Running the same test again found **four more**: the licence (`Q33`,
resolved), **who may deploy or approve a merge** (`Q34`, no authority — `.github/` holds one
workflow, no `CODEOWNERS`, `main` unprotected), the accessibility conformance target (`Q35`,
partial — criteria without a target), and **dependency upgrade policy** (`Q36`, no authority — no
`dependabot`, no `renovate`, and `npm audit` blocking with no prescribed response).

**VERDICT: UPHELD.** `D4` falls from `11.25` to `10.42` and the total from `91.56` to `90.73`.

**And the deeper finding.** Two attacks found twelve omissions between them, the second finding
four after the first had finished. **`D4` is an upper bound, not a measurement.** The published
claim is now the weaker and true one: *at least 36 critical questions exist, at most 25 have one
current authority, and a further attack can only lower the ratio.*

Six questions now have no authority at all — rollback, observability, retention, supported
runtimes, who may deploy, dependency upgrades — and **all six are operational**. The cluster round
one found did not merely hold. It grew.

---

## Attack 16 · Self-consistency is checked by a program the study wrote about itself

**Claim under attack.** `selfcheck.py` holds every study file against `REPO_NATIVE_OPERATING_SYSTEM.md`
§B, 11 / 11 green.

**The attack, and what it produced.** The checker was written by the party it checks, so the
question is not whether it passes but **whether it can fail**. It was tested by writing new files
and watching:

- `AMENDMENT_CHAIN.md`, written in this pass, immediately turned `SC-04` and `SC-11` red. The
  predicates read only the line a figure sits on and could not see a `### Study v1` heading or a
  `| field | Study v1 | Study v2 |` column header. **The predicates were widened** — to the nearest
  preceding heading and to the figure's own column, column-indexed so a `v1` header cannot exempt
  the `v2` column — and **two injections were added** so the widened paths have themselves
  demonstrated failure.
- `SC-09` was then found to have missed a live drift: `EXECUTION_LOG.md` said *"all 47 cycle
  sections"* where there are **43 numbered 1–47**, and the pattern required the count to sit next
  to the noun. Widening it introduced a false positive on *"22 of 43 cycle sections"*, which was
  excluded before either fix was published.

**VERDICT: PARTIALLY UPHELD.** The checker is real — it caught `X-26` and two fresh drifts nothing
else would have — and it is not complete. It cannot see a claim it has no predicate for, and both
gaps found in this pass were of exactly that kind. The fixture now carries **eight** injected
drifts rather than six, and every predicate covering one goes red.

---

## Attack 17 · Does `PARTIAL` follow, or is it a compromise between `STRONG` and the score?

**The attack.** A downgrade published beside a fallen score looks like the verdict tracking the
number. Both remaining labels were tested against the evidence rather than against the total.

**Could it still be `STRONG`?** No. v1's argument was *no incompatible process families*, which
still holds — but it answers "is the model coherent?", not "does the operating system cover the
repository?". Six critical questions with **no authority at all**, all operational, is a coverage
failure the coherence argument does not touch. And the repository's own idiom for *not yet* —
`DEFER` with a written trigger, used on `D06` — was not used for any of the six. They are not
deferred; they are unnoticed.

**Could it be `WEAK` or "no OS"?** No, and this is the harder half. Every measurement that tests
whether the model is *right* came back at ceiling: κ `1.000`, separation `1.000`, admissibility
`1.000`, 26 of 26 contradictions classified with 0 unresolved and 0 critical, 16 of 16
repository-wide laws with executed enforcement, 28 gates green and 28 controls red, both B3
verdicts byte-identical on re-run. A weak operating system does not produce those.

**VERDICT: `PARTIAL_REPO_NATIVE_OS` UPHELD, on evidence that points in both directions at once.**
The model is right about what it covers, and what it covers is not the whole repository.

---

## Attack 18 · Four kernel rules are not forced by the data

**Claim under attack.** Four rules explain the corpus; together they cover 48 / 48.

**The attack.** If four is the right compression, no three should reach 48. Measured over
`LAW_SUPPORT.json`:

| subset | cases covered | missing |
| --- | ---: | --- |
| `K1+K2+K3` | **48 / 48** | — |
| `K1+K2+K4` | **48 / 48** | — |
| `K1+K3+K4` | 47 / 48 | `C29` derived grade vs stored grade |
| `K2+K3+K4` | 47 / 48 | `C31` cross-user leak and the cache that outlived it |

**Two different triples already cover everything.** Coverage cannot choose the taxonomy — it does
not even choose which rule to drop. The pairwise overlap says where the seam is weakest:
`K2`–`K4` at Jaccard **0.628**, against `K1`–`K2` at **0.200**.

**VERDICT: UPHELD as stated, and the claim is weakened.** Four rules are a **judgement** that
`K2` (*nothing gains authority until a step ran that could have taken it away*) and `K4` (*a claim
may not outrun its evidence*) say different things — one about promotion, one about scope — not a
result the corpus forces. `SCORING_METHOD_V2.md` §2 already declines to score parsimony, with the
reason; this attack supplies the number that declining costs. §B carries it.

---

## Attack 19 · Should any repository-wide law be downgraded?

**The attack.** Attack 12 found three laws on the bar. Each was re-examined for whether the
published class survives its own evidence.

| law | why it is at the bar | verdict |
| --- | --- | --- |
| `RNL-07` freeze refuses rather than silently repairs | 3 domains, 2 failures | **HELD.** The three are `research-b3`, `research-discovery` and `testing`, and the enforcement is executable in all three (`run.py`'s seal, `freeze()` throwing, the freeze-refusal tests run in this study) |
| `RNL-11` do not change intervention and instrument together | 3 domains, **1 non-authoring case** — the joint minimum in the model | **HELD, and already flagged.** §B marks it *weakest* and §I explains why; no case in the tree shows the failure it forbids, only the discipline that avoids it. It is the one law supported mainly by the repository's own practice rather than by a scar |
| `RNL-16` the scheduled adversary | 3 domains, narrowed by Attack 11 | **HELD.** It was already weakened once in this study by execution, and the narrowed form is what the diff supports |

**VERDICT: NO DOWNGRADES, and that is a weaker result than it sounds.** All three hold on the
counts as published, and all three would flip on a single miscount. The classification is correct
if the mapping is correct, and the mapping now ships with the study so a second reader can decide
whether it is.

---

## What the second pass changed

| | |
| --- | --- |
| defects found | **2** — `G` (`D1b`'s self-chosen denominator) and the round-two incompleteness of `D4`'s |
| score | `91.82` → `91.56` → **`90.73`** |
| `WES` | `96.46` → **`96.74`**, rising as the score fell, which is the metric's declared limitation demonstrating itself |
| authority questions | `32` → **`36`**, resolved `24` → **`25`**, and now published as a **lower bound** |
| laws downgraded | **0**, with three shown to be one miscount from demotion |
| kernel rules | **4**, with the coverage argument for four shown not to exist |
| verdict | `PARTIAL_REPO_NATIVE_OS` **upheld** against both neighbours |
| new predicates and controls | `SC-04`, `SC-09` and `SC-11` widened; injections `6` → **`8`** |

**Nothing was repaired by moving a threshold, a weight or a formula toward a number.** Both
repairs were written before the figure they changed, both lowered it, and the frozen pre-repair
totals are recorded beside each.
