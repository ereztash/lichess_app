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
