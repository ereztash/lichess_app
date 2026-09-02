# THE REPOSITORY-NATIVE OPERATING SYSTEM

Reconstructed from `lichess_app` at `8c8b331a4336905bcc4f73e59764e32f42a2356b`, before any
consolidation. Baseline in [`BASELINE.md`](BASELINE.md); corpus in
[`PROCESS_CORPUS.md`](PROCESS_CORPUS.md) / [`.json`](PROCESS_CORPUS.json); commands in
[`EXECUTION_LOG.md`](EXECUTION_LOG.md).

---

## A. Executive conclusion

# `STRONG_REPO_NATIVE_OS`

A coherent in-house operating system exists. It is not a documentation convention and it is not a
restatement of ordinary engineering practice.

Three things decide it, and each was measured rather than read:

**1. It is enforced, not described.** 28 named gates run on every build, **28 of 28 green on the real
tree and 28 of 28 red against deliberately-broken fixtures** — both executed in this study. Every
gate carries a `rule` id pointing back to the document that states the rule it enforces. Four
scanners derive facts the documents claim (`test-level-scan`, `register-scan`, `said-once-scan`,
`two-hands-scan`), and one of them reddens when a *document* drifts from the tree.

**2. It was learned at a datable point, not declared at the start.** Scanning all 47 cycles of
`PRODUCTION_READINESS_LEDGER.md` for a positive-control mention: **7 of 29 before cycle 34, 14 of 14
from cycle 34 onward.** A style is uniform from the first page. This is a discipline that arrived,
and then held.

**3. Its strongest scientific artefact is a program, and the program reproduces.** `evaluate.py`,
run here in a fresh session, returns `INVALID_EXPERIMENT` from `analysis_final.json` and
`GENERAL_REGULARITY_ONLY` level 3 from `analysis_repaired.json` — matching both committed verdict
files exactly, including all seven failed H2 conditions.

The verdict is `STRONG` and not `PARTIAL` because there are **no incompatible process families**:
two clustering passes over 48 cases agree on four families at purity 0.50–0.71, and the two things
they disagree about (identity/provenance, supersession) turn out not to be families at all but
operations that run inside every family.

It is `STRONG` **with three live counterexamples** — two P1, one P2, none critical. Two are named by
the repository itself; the third was found by running it. All three are in
[`CONTRADICTIONS.md`](CONTRADICTIONS.md).

---

## B. The kernel

Four rules explain the corpus. Each covers 52–81% of the 48 cases on its own; together they cover
**48 of 48**, and each spans 9–12 of the 12 domains.

**The kernel is a logical grouping of the sixteen laws below, and only weakly supported by their
co-occurrence (within/between Jaccard 1.44×).** The adversary forced that sentence and it stays.
The eighteen laws are the operative units; the four rules are how they hang together.

> ### K1 · The record decides. Where it cannot answer, refuse rather than fabricate.
> *`L1` `L6` `L7` `L12` `L18` — 25/48 cases, 10/12 domains*
>
> ### K2 · Nothing gains authority until a step ran that could have taken it away, and the taking-away condition was written first.
> *`L2` `L3` `L4` `L15` `L16` — 31/48 cases, 12/12 domains*
>
> ### K3 · One current authority per question, with its lineage kept and its way of losing written down.
> *`L5` `L10` `L13` — 30/48 cases, 9/12 domains*
>
> ### K4 · A claim may not outrun its evidence, and the bound is measured rather than judged.
> *`L8` `L11` `L14` `L17` — 39/48 cases, 12/12 domains*

### The laws

Classified by the mission's rule (≥3 distinct domains, ≥2 operational instances, ≥1 failure
explained by violation), plus the adversary's added condition (≥1 supporting failure discovered by
a channel **other than authoring**). Domain counts are computed from the corpus, not asserted.

| law | statement | dom | op | fail | non-auth | class |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| **L1** | **Derive, don't declare** — and the direction is the opposite of GitOps: the *tree* is authoritative and the *declaration* is reconciled toward it. `register-scan.ts` is drift detection with no actuator, deliberately. | 7 | 7 | 5 | 8 | **REPO-NATIVE LAW** |
| **L2** | **Promote only after contradiction was possible.** | 7 | 5 | 4 | 9 | **REPO-NATIVE LAW** |
| **L3** | **Build the judge before the contender**, and put it where it can say no. | 7 | 4 | 2 | 7 | **REPO-NATIVE LAW** |
| **L4** | **A gate that has not demonstrated failure is not a gate** — same predicate, broken input, red *for its own reason*. Universal for gates since ledger cycle 34; sporadic before. | 4 | 5 | 4 | 9 | **REPO-NATIVE LAW** |
| **L5** | **One authority per **question**, not one source of truth for everything.** It is a rule about questions, not files: merging two documents that answer different questions destroys the property. | 5 | 5 | 4 | 7 | **REPO-NATIVE LAW** |
| **L6** | **Identity follows semantics, not labels.** | 4 | 4 | 3 | 3 | **REPO-NATIVE LAW** |
| **L7** | **Freeze refuses rather than silently repairs.** | 3 | 4 | 2 | 4 | **REPO-NATIVE LAW** |
| **L8** | **Evidence authority may never exceed evidence level.** | 10 | 6 | 3 | 8 | **REPO-NATIVE LAW** |
| **L9** | Derivation → shadow → ownership. | **2** | 4 | 2 | 1 | `DOMAIN LAW` — measurement surfaces |
| **L10** | **Failed history is provenance, not clutter** — kept unmodified, with an explicit and *scoped* replacement pointer. | 8 | 5 | 3 | 9 | **REPO-NATIVE LAW** |
| **L11** | **Do not change the intervention and the measuring instrument at the same time.** | 3 | 4 | 2 | **1** | **REPO-NATIVE LAW** — *weakest; see §I* |
| **L12** | A surface must read the record, not its private copy. | **2** | 3 | 3 | 5 | `DOMAIN LAW` — client surfaces |
| **L13** | **A claim must specify what would reverse it** — there is no `status: solved` without one, and a fired trigger must be evaluated and recorded, not left in the table. | 6 | 4 | 3 | 9 | **REPO-NATIVE LAW** |
| **L14** | **The level of reality in the test must match the level in the claim** — derived, with a severity floor. Higher is *not* always better. | 6 | 4 | 3 | 6 | **REPO-NATIVE LAW** |
| **L15** | **Declare the rejection rule before the run, and do not move it after** — even when the rule turns out to be the thing that was wrong. | 6 | 4 | 3 | 8 | **REPO-NATIVE LAW** |
| **L16** | **The adversary is scheduled, and may repair the *instrument* in either direction while only ever weakening a *claim*.** *(narrowed by execution — see §I)* | 3 | 4 | 3 | 4 | **REPO-NATIVE LAW** |
| **L17** | **Say what this does not establish**, in the same shape, every time. | 12 | 5 | 3 | 19 | **REPO-NATIVE LAW** |
| **L18** | **Refuse rather than skip** — `NOT-MEASURED` is not `PASS`. | 5 | 5 | 3 | 6 | **REPO-NATIVE LAW** |

**16 `REPO-NATIVE LAW` · 2 `DOMAIN LAW` · 0 `LOCAL PATTERN` · 0 `UNSUPPORTED GENERALIZATION`.**

### Compliance, counted rather than asserted

A law with a live counterexample is not "what the repository does"; it is what the repository has
decided and not finished.

| law | live counterexamples | where |
| --- | ---: | --- |
| `L1` | 2 | `LearningQueue.tsx:111` renders the stored grade (`X-01`); `results/selftest.json` declares a result its own code no longer produces (`X-16`) |
| `L7` | 1 | `PREREGISTRATION_FREEZE.json`'s amended hash is stale for `DATA_PROTOCOL.md` (`X-02`) |
| `L2` / `L4` | 1 | `npm run bundle:budget` is enforced and has no positive control (`G-02`) |
| `L14` | 1 | `L6` deployment rung is zero and the one run that found a defect does not re-run (`G-07`) |
| `L6` | 1 | two studies named "B3" on two refs (`X-15`) |
| every other law | 0 | — |

---

## C. Process primitives

The vocabulary the repository actually uses, with the definition it uses it under. Candidates from
the mission that the corpus **did not** support are listed and rejected at the end.

| primitive | definition, as the repository uses it |
| --- | --- |
| **OBSERVE** | record what happened, never the conclusion hoped for from it |
| **DERIVE** | compute from the record or the tree; a wrong value cannot be written by hand |
| **BOUND** | state the ceiling on what may be said, before saying anything |
| **DECLARE-AND-GUARD** | assert a value that cannot be derived, name it as such, and guard it at the layer that owns the race |
| **FREEZE** | commit, refusing anything that cannot be committed to |
| **HASH** | give the commitment an identity that changes when it changes |
| **SEAL** | make the next step mechanically impossible until an independent gate passes |
| **REPRODUCE** | re-run and difference against a recorded artefact |
| **FALSIFY** | write what would reverse this, before the evidence |
| **CONTROL⁻** | a negative control — shuffle, permute, or null the signal; the pipeline must go quiet |
| **CONTROL⁺** | a positive control — a deliberately broken input; the check must go red, for its own reason |
| **GATE** | an enforced check with a proven-red control, asserting that nothing *has become* wrong |
| **SHADOW** | run a derivation beside the current authority and record disagreement, owning nothing |
| **PROMOTE** | raise what a thing is permitted to become, only after `CONTROL⁺` and `FALSIFY` were satisfied |
| **DEFER** | not now, with the trigger written down |
| **REJECT** | measured and refused, with the measurement kept |
| **NARROW** | keep the claim, shrink its scope, and say which sentence is withdrawn |
| **SUPERSEDE** | name the replacement relationship and its **scope**; keep the loser |
| **REVERSE** | a stated condition fired; evaluate it and record the outcome, even when the condition was itself wrong |
| **RECONCILE** | hold a register's claims about the outside world against the outside world |
| **PRESERVE** | keep a failure byte-identical, with its own hash |
| **AMEND** | change a frozen document through a declared channel, with an adversary on it |

**Rejected as primitives.** `ASSERT` — the corpus has no case where a bare assertion is a legitimate
step; every declaration is either verified or explicitly marked unverified. `ARCHIVE` — nothing in
this repository is archived; it is preserved *in place* with a pointer, which is `PRESERVE` +
`SUPERSEDE`, and the difference is load-bearing (`X-11`).

---

## D. State transition model

The states the corpus actually supports. `E0–E6` is the vocabulary
`docs/decisions/README.md` already uses; the transitions are what the 48 cases actually did.

```
                        ┌──────────────────────────────────────────────────┐
                        │                                                  │
   idea (E0) ──OBSERVE──> candidate (E1) ──REPRODUCE──> reproduced (E2)     │
       │                       │                             │             │
       │                    REJECT                        FALSIFY          │
       │                       │                             ▼             │
       │                       ▼                    CONTROL⁻ + CONTROL⁺    │
       │                   rejected ◄────────────────────┐    │            │
       │                  (measurement kept)             │    ▼            │
       │                                                 │  passes (E3)    │
       └──DEFER──> deferred ──trigger fires──────────────┘    │            │
                  (trigger written)                        SHADOW          │
                                                              │            │
                                                              ▼            │
                                                        shadowed (E4)      │
                                                              │            │
                                                          PROMOTE          │
                                                              ▼            │
                                                    user-visible (E5)      │
                                                              │            │
                                                       prospective         │
                                                          evidence         │
                                                              ▼            │
                                                     authority (E6) ───────┘
                                                              │
                                                        REVERSE / NARROW
                                                              ▼
                                                        superseded
                                                    (preserved, pointer, scope)
```

**Four transitions carry the whole design, and each is refused somewhere in the corpus:**

| transition | the gate on it | a case where it was refused |
| --- | --- | --- |
| `candidate → reproduced` | difference against the reference | `D02`: the clustered estimator was worse in 82 of 84 cells |
| `reproduced → passes` | a declared rejection rule, then one run | `D05`: rejected twice, and the second rejection is about the candidate |
| `passes → shadowed` | the shadow must have real inputs | `D22`: two of three shadow inputs were fabricated |
| `shadowed → authority` | prospective evidence that could have failed | `D08`: still not wired in, at 8.2% caught for 6.69% withheld |

**`rejected` and `superseded` are terminal and are never deleted.** `refuted` is the *strongest*
evidence this repository produces, and it points the other way.

**Two operations run inside every state rather than being states:** `HASH`/identity, and
`SUPERSEDE`. That is why the two clustering passes disagreed (ARI 0.125): Pass A saw them as
question-types and Pass B saw them as structures, and they are neither.

---

## E. Authority model

Full map in [`AUTHORITY_MAP.md`](AUTHORITY_MAP.md). In one paragraph:

**24 critical questions, 24 with exactly one current authority, 24 with a known lineage, 15 (63%)
mechanically verifiable, 0 with an unscoped competitor.** No file is the source of truth for
everything, and the one register that owns "what is open" explicitly disclaims every other question
in its own supersedes table. The mechanism that keeps this true is `GATE-REGISTER-RECONCILED`, which
does not check that documents agree in prose — it checks the claims a register makes about things
**outside itself**, *"because those are the claims that rot without anybody touching them"*.

---

## F. Evidence model

Full analysis in [`EVIDENCE_MODEL.md`](EVIDENCE_MODEL.md). The six ladders are **orthogonal
dimensions**, tested pairwise:

```
E-level     what action is permitted            E0 … E6
L-level     how much reality the test touched   L1 … L6      (product runtime)
L-eco       how far the task is from a game     L0 … L5      (research task)
P-level     what breaks if it is wrong          P0 · P1 · P2
authority   where in its lifecycle a claim is   one-event · recurred · hypothesis · tested · refuted
provenance  where an external claim came from   tier A/B/C, corpus manifest, engine sha256, freeze commit
```

Every pair is orthogonal except (L-level, P-level), which is a **floor** relation (`P0 → L4`,
`P1 → L2`) and not an identity. Verdict labels (`STOP-B1`, `CONSTRUCT-UNDERIDENTIFIED`,
`GENERAL_REGULARITY_ONLY`, `VACANT`/`SATURATED`/`MEASURABLE`) are not a seventh dimension: they are
the **output** of applying the other six, defined before each run.

**Do not unify them.** A single scale would have to place `refuted` somewhere, and there is nowhere
correct — the repository has already paid to learn this, in `shared/evidence-authority.ts`.

**One genuine defect: the two `L` ladders share a label and are different dimensions.**

---

## G. Generalization opportunities

Ranked in [`LOCAL_SOLUTION_GAPS.md`](LOCAL_SOLUTION_GAPS.md) by
`Reach × FailureSeverity × EvidenceStrength × Generalizability`, all four defined before use.

| rank | gap | EB |
| ---: | --- | ---: |
| 1 | **`register-scan.ts` has never been pointed at `research/`.** Eight research registers make claims about hashes, paths and other registers, and nothing checks them. **`X-02` and `X-16` are two verified instances of exactly the failure it exists to catch**, in two different programmes, found by two different methods. | **5.33** |
| 2 | **Two enforced checks have no positive control**: the bundle budget (fixable — a fixture is buildable) and the deployment verification (not fixable by fixture — needs a standing run, which is rank 6). | 2.00 |
| 3= | **`LearningQueue` reads the stored grade** while `gradeFromRecord` ships beside it. | 1.67 |
| 3= | **`require_seal()` exists in one study.** Four other preregistrations and the N-of-1 pilot rely on the author not looking. | 1.67 |
| 5 | The six-field shape (including *what it does not establish*) governs the design and research documents and not the debt register or the ledger. | 1.05 |

**From outside** ([`EXTERNAL_CROSSWALK.md`](EXTERNAL_CROSSWALK.md)): one capability the repository
never discovered — **W3C PROV `wasRevisionOf` / RO-Crate**. Every supersession chain here is correct,
complete, and readable only by a person. Making them edges is rank 1 with a standard vocabulary
attached. And one honest ceiling to write down: **nothing in this repository can reach ACM
`Results Replicated`** — every independent review reads this repository's own artifacts, so `E6`
is not the top of the ladder, it is the top of what a single-repository study can reach.

---

## H. Non-generalizable knowledge

| stays domain-specific | why |
| --- | --- |
| `L9` derivation → shadow → ownership | 2 domains. It costs a measured **+16.1 kB raw / +5.1 kB gzipped** on two hot routes and a ledger nobody reads. It is for a derivation that would change **what a person is sent to** — not for one that answers a question about the repository. `register-scan` and `test-level-scan` correctly took ownership on day one. |
| `L12` a surface must read the record | 2 domains, both client-side. It is a rule about the *read path and its key*, not about caching. |
| `L16` the scheduled adversary | Costs a full independent context per gate — B3 spent four plus three re-reads. Spend it where a result will be believed and is expensive to redo. It is not a repository-wide rule. |
| `E0–E6` | A ladder for **research promotion**. Product defects legitimately have no E-level; extending it to debt rows would manufacture a claim. |
| The `L0–L5` ecological ladder | A property of a *research task*, not of a test. |

---

## I. Contradictions

Full register in [`CONTRADICTIONS.md`](CONTRADICTIONS.md): **16 entries: 3 `REAL_CONTRADICTION` · 6
`DIFFERENT_SCOPE` · 4 `HISTORICAL_SUPERSESSION` · 3 `NOMINAL_ONLY` · 0 `UNRESOLVED` · 0 critical.**

The three live ones:

**`X-01`** — `LearningQueue.tsx:111` renders the stored grade while `record-service.ts` derives it.
P1, bounded to a wasted click, and named by the repository in the ledger's own *"Still open and
stated plainly"*.

**`X-02`** — `PREREGISTRATION_FREEZE.json`'s `amended_sha256` says `DATA_PROTOCOL.md` is `cf263394…`;
the file is `6560f3d7…`, and `FINAL_HOLDOUT_SEALED.json` records the correct value. Verified against
git in this study: the change landed in the seal commit itself. It is `L5` violated inside a
mechanism built to enforce `L6`.

**`X-16`** — found by **running** the oracle, not by reading it. `results/selftest.json` records the
plant `one-game-only` at `delta 0.45, passes: false`, with a `plants_off_target` entry;
`oracle/worlds.py:419` at this commit declares `0.22`, and a re-run passes with that list empty. Both
files were last written in the **same commit**. P2 — nothing cites the disputed number — but it is
the **second verified instance** of the same failure mode as `X-02`, in a different programme, found
by a different method. Together they are what makes gap rank 1 the highest-value move in §G.

### Two narrowings this study made, and where they came from

**`L1` was inverted by an external framing and had to be stated with its direction.** OpenGitOps'
*continuously reconciled* holds the declaration authoritative and converges the world. This
repository does the opposite. Importing the framing would reverse the law.

**`L16` was too strong, and execution proved it.** Running `evaluate.py` in this session on both
committed analyses showed Gate 3's repair moved the verdict **up** — `INVALID_EXPERIMENT` →
`GENERAL_REGULARITY_ONLY` level 3. The repository runs two adversarial roles and the draft had
collapsed them: an **instrument adversary**, which may move a number in either direction under a
pinned diff, and a **claim adversary** (Gate 4), whose fifteen required changes were *"every one a
weakening or a qualification"*.

### The weakest law, named

**`L11`** meets the stated bar (3 domains, 4 operational instances, 2 failures) but has **one**
non-authoring case against `L17`'s nineteen. Everything supporting it was found by an audit, except
`C30`, whose green positive control supports four other laws more centrally. **What would strengthen
it:** a measured case where a protocol version bump and an interface change happened in the same
step and a later comparison was demonstrably wrong because of it. No such case exists in the tree.

---

## J. Proposed consolidation implications — high level only

**Consolidation governed by this operating system is not a merge.**

`L5` (one authority per question) reads like a licence to merge and is not one — it is a rule about
*questions*. `L10` (failed history is provenance) is its other half, and a consolidation that reads
one without the other destroys the repository's strongest property. What consolidation becomes
under this model is four steps, none of which is a file move:

1. **Name the questions.** `AUTHORITY_MAP.md` has 24; the real number is larger. A question with no
   named authority is the finding, not the file that answers it twice.
2. **Name each question's current authority, and derive it where you can.** 63% are mechanically
   verifiable today. The gap between that and 100% is the work.
3. **Add the supersession pointer wherever one is missing, with its scope.** The model already
   exists in the tree: `"supersedes … for the claims it contradicts only"`.
4. **Leave the history where it is.** Every superseded artefact keeps its path, its bytes and its
   hash.

**Three moves that would look like consolidation and are forbidden by this model:** merging two
documents that answer different questions; deleting a superseded artefact because a newer one exists;
and renaming anything whose identity is content-addressed.

**The one structural change the model actively recommends** is not a merge either: point
`register-scan.ts` at `research/`, so the research registers get the same drift check the product
registers already have.

---

## K. What not to change

An itemised do-not-touch list. Each is load-bearing, and for each, *what would be lost*.

| artefact | why it is load-bearing |
| --- | --- |
| `research/b2/as-published-75/` | the evidence for a result stated in public, with its own sha256. Its README says it is not a backup. Deleting it makes the correction unreadable. |
| `results/verdict.json` **and** `results/verdict_repaired.json` | both reproduce, in this session, from their own analysis files. Collapsing them deletes a reproducible failure. |
| `results/analysis_final.json` beside `analysis_repaired.json` | the byte-identity assertion outside the `C3` block is what makes the repair auditable. |
| `results/PREREGISTRATION_FREEZE.json`, `FINAL_HOLDOUT_SEALED.json`, `POST_FREEZE_AMENDMENTS.md` | the freeze, the seal, and the declared amendment channel. `X-02` is a reason to *reconcile* them, never to merge them. |
| `research/b3_population_expertise/FAILURES.md` | twelve failures with the reason each mattered. *"A defect that is repaired without a note is a defect that will be reintroduced."* |
| `research/b3_population_expertise/reviews/**` | four independent gate reviews and their packets, including the nine defects found **in the repairs**. |
| `docs/measurement/`'s four rounds + `docs/evidence-architecture/` as a fifth | `D25` says explicitly: *no repair of `RC-06`; preserve the failure; add a round rather than rewriting them.* |
| `docs/decisions/D23` and `D24`, superseded and undeleted | `D24` corrects two of `D23`'s numbers **in place**; `D25` *"amends rather than erases"*. |
| every `FALSIFICATION_REGISTER.md` | four of them, in four programmes. `docs/evidence-architecture/`'s says: *"Nothing earlier is edited or deleted; the register records how beliefs changed."* |
| `docs/MASTER_PRODUCT_DEBT.md`'s **Refuted** section | measured, found wrong, recorded so it is not reopened. |
| `docs/design-council/04-ADVERSARIAL-REVIEW.md` | records findings that were **not** acted on. *"A register that lists only what was fixed is a register that makes the pass look better than it was."* |
| `docs/MEASUREMENTS.md`'s history sections | figures produced by an engine the product does not ship, labelled as history on purpose. |
| `tests/fixtures/**` | the 28 positive controls. Every one is a *deliberately broken* artefact and looks like a defect to a cleanup. |
| `docs/evidence-architecture/CURRENT_STATE.md`'s PR labels | *"left in place rather than swept, because what each claim was checked against is a fact about the check."* |
| every `reversal_condition`, every fired-and-evaluated trigger, every `FIELD-REQUIRED` / `OWNER-REQUIRED` / `MEASUREMENT-BLOCKED` marker | these are the repository's record of what it does **not** know. They are the first thing a tidy-up deletes and the last thing it can rebuild. |
| `experiment/n-of-1-timing-policy` | one commit, one file, frozen before the first prospective game, on no other ref. Deleting the branch deletes a preregistration. |

**One naming hazard to fix before any merge**, not after: `research/b3/` and
`research/b3_population_expertise/` are two different studies sharing a label (`X-15`). If that
branch is ever merged, every citation of "B3" becomes ambiguous.

---

## L. Benchmark implications

The benchmark this repository deserves measures **whether it follows its own strongest proven
rules**, and only secondarily whether it satisfies an external standard. Derived from the model, in
priority order:

| # | what to measure | how, using what already exists |
| --: | --- | --- |
| 1 | **Do all enforced checks have a proven-red control?** | `npm run gates:controls` already answers it for 28. Extend the count to *every* blocking CI step; today the bundle budget is the one that fails. |
| 2 | **Does any register claim something the tree contradicts?** | `register-scan` over four registers today. The metric is *registers scanned / registers that make external claims* — currently 4 / 12. |
| 3 | **Does any claim outrun its proof?** | `GATE-CLAIM-ANCHOR` — 0 rows today, and it is a bar rather than a ratchet. Extend to research claims, whose rung is currently prose. |
| 4 | **Is state derived where derivation is available?** | count `DECLARED_UNVERIFIED` states for which a derivation exists. Today: **1** (`X-01`). |
| 5 | **Does every current claim have exactly one authority and a lineage?** | `AUTHORITY_MAP.md`: 24/24, 63% mechanically verifiable. The metric is the 63%. |
| 6 | **Do published verdicts reproduce?** | executed here for both B3 verdicts. The metric is *reproducible verdicts / published verdicts* — currently 2/2 for B3 and unmeasured for the other four studies. |
| 7 | **Is every fired reversal condition evaluated and recorded?** | today: yes, and two are struck through with their outcomes. |

Not to measure: test count, coverage percentage, document count, or anything that improves when a
control is deleted.

---

## M. Final score

Computed by [`SCORING_METHOD.md`](SCORING_METHOD.md), which was written before the numbers.

| dimension | formula input | score |
| --- | --- | ---: |
| 1 · Corpus coverage | 169 / 169 governing files classified = 100%; every mandatory document present | **20.00** / 20 |
| 2 · Cross-domain replication | 16 repo-native of 18 candidates = 0.889; kernel = 4 rules, no parsimony penalty | **17.78** / 20 |
| 3 · Contradiction resolution | 16 / 16 classified with direct evidence; 0 `UNRESOLVED`; 0 critical | **15.00** / 15 |
| 4 · Authority resolution | 24 / 24 with one current authority and a known lineage | **15.00** / 15 |
| 5 · Falsifiability | 18 / 18 laws carry a counterexample search, a failure condition and a boundary | **15.00** / 15 |
| 6 · Operational grounding | 16 / 16 repo-wide laws have ≥2 executable enforcements; the 12-point cap does not apply because enforcements were **executed** (`EXECUTION_LOG.md`) | **15.00** / 15 |

# 97.78 / 100

The additional requirements for a score above 95 are each met: no critical corpus gap; no unresolved
P0 contradiction; every repo-wide law operationally grounded; the authority map complete for every
critical question; at least one falsification attempt per law. **The 2.22 points lost are entirely
Dimension 2**, and they are the two candidate laws that were **downgraded** to `DOMAIN LAW`.

---

## N. Final evidential confidence

52 weighted conclusions, weights and strengths assigned per `SCORING_METHOD.md` Part 2.

```
Σ weight              = 96
Σ (weight × strength) = 92.50

Confidence = 92.50 / 96 × 100 = 96.35 %
```

Strength distribution: **30 conclusions at 1.00** (`DIRECT_EXECUTABLE_EVIDENCE`) and **22 at 0.90**
(`DIRECT_AUTHORED_EVIDENCE`). Nothing below 0.90 entered the calculation, because nothing that
could not be traced to a run or a cited path was published as a conclusion.

**The figure rose from 95.21% to 96.35% during the study, and it rose by gathering evidence rather
than by re-weighting.** The first calculation was made after reading; nine conclusions were then
upgraded by running things that had only been read — the oracle self-test, the freeze-refusal tests,
the B3 pytest modules, and `evaluate.py` on both committed analyses. `EXECUTION_LOG.md` lists which
command upgraded which conclusion.

**Ceilings, all checked and none applied:**

| ceiling | condition | applies |
| ---: | --- | --- |
| 90% | an unresolved critical contradiction | no — 0 `UNRESOLVED`, 0 critical |
| 92% | incomplete core process corpus | no — 169/169 |
| 90% | a repo-wide law supported by only one domain | no — minimum is 3 |
| 90% | current authority unknown for a critical scientific claim | no — 24/24 |
| 85% | cannot distinguish current from historical evidence | no — 3 `HISTORICAL` items, each labelled by the repository itself |

# 96.35 % — target > 95.5 % MET

### What would raise it further, exactly

| conclusion | at | what would make it 1.00 |
| --- | ---: | --- |
| `L17` say what this does not establish | 0.90 | execute `src/write_report.py`'s forbidden-phrase check and observe it refuse to write |
| `L11` do not change intervention and instrument together | 0.90 | a measured case in the tree where a version bump and a stimulus change in one step invalidated a later comparison — none exists |
| `L16` the scheduled adversary | 0.90 | an independently-dispatched review in this session, reproducing a gate's findings |
| authority / evidence / transition models | 0.90 | a scanner that derives the authority of each question from the tree, which does not exist |
| `X-03`–`X-06`, `X-08`–`X-10`, `X-13` | 0.90 | these are supersession scopes stated in prose; W3C PROV edges (§G) would make them executable |
| the executive verdict | 0.90 | an independent reader reproducing this reconstruction from the corpus alone |

---

## Final statement

`REPO-NATIVE OS RESOLVED — READY TO DESIGN CONSOLIDATION`

**Score 97.78 / 100. Confidence 96.35 %.**

Nothing in the repository was moved, renamed, deleted, merged, reformatted or rewritten by this
mission. The only additions are the fourteen files in `docs/consolidation-research/`. One tracked
file — `research/discovery-oracle/results/selftest.json` — was overwritten by running the oracle's
own self-test and was restored immediately with `git checkout --`; the incident, and the finding its
diff produced, are recorded in `BASELINE.md` Amendment 1 and `CONTRADICTIONS.md` X-16.
