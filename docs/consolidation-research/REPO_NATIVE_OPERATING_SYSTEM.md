# THE REPOSITORY-NATIVE OPERATING SYSTEM

Reconstructed from `lichess_app` at `8c8b331a4336905bcc4f73e59764e32f42a2356b`, before any
consolidation. Baseline in [`BASELINE.md`](BASELINE.md); corpus in
[`PROCESS_CORPUS.md`](PROCESS_CORPUS.md) / [`.json`](PROCESS_CORPUS.json); commands in
[`EXECUTION_LOG.md`](EXECUTION_LOG.md).

---

## A. Executive conclusion

# `PARTIAL_REPO_NATIVE_OS`

> **Study v2.** Study v1 published `STRONG_REPO_NATIVE_OS` at `97.78 / 100`. That verdict was
> attacked rather than defended, and it did not survive intact. The v1 record is preserved in
> [`AMENDMENT_CHAIN.md`](AMENDMENT_CHAIN.md), with the formulas that produced it and the six
> defects that moved it.

A coherent in-house operating system exists, it is enforced rather than described, and it covers
the surfaces this repository was built to care about. It does **not** cover the operational
surface at all, and the study can prove that only for the fraction of the tree it actually read.
`PARTIAL` names both limits.

**What is `STRONG`.** Three things decide it, and each was measured rather than read:

**1. It is enforced, not described.** 28 named gates run on every build, **28 of 28 green on the real
tree and 28 of 28 red against deliberately-broken fixtures** — both executed in this study. Every
gate carries a `rule` id pointing back to the document that states the rule it enforces. Four
scanners derive facts the documents claim (`test-level-scan`, `register-scan`, `said-once-scan`,
`two-hands-scan`), and one of them reddens when a *document* drifts from the tree.

**2. It was learned at a datable point, not declared at the start.** Scanning all **43 cycle sections** of
`PRODUCTION_READINESS_LEDGER.md` (cycles numbered 1–47; three headings cover ranges) for a
positive-control mention: **7 of 29 before cycle 34, 14 of 14 from cycle 34 onward.** A style is uniform from the first page. This is a discipline that arrived,
and then held.

**3. Its strongest scientific artefact is a program, and the program reproduces.** `evaluate.py`,
run here in a fresh session, returns `INVALID_EXPERIMENT` from `analysis_final.json` and
`GENERAL_REGULARITY_ONLY` level 3 from `analysis_repaired.json` — matching both committed verdict
files exactly, including all seven failed H2 conditions.

There are **no incompatible process families**: two clustering passes over 48 cases agree on four
families at purity 0.50–0.71, and the two things they disagree about (identity/provenance,
supersession) turn out not to be families at all but operations that run inside every family. That
was v1's whole argument for `STRONG`, and it still holds. It is not sufficient.

**What makes it `PARTIAL`.** Three things, and v1 could not see any of them because v1 never asked
a question it had not already answered:

**1. Six critical questions have no authority at all, and they cluster.** Two rounds of the
completeness attack ([`AUTHORITY_MAP_V2_ATTACK.md`](AUTHORITY_MAP_V2_ATTACK.md)) raised the
denominator from 24 to 32 and then to **36**. **Rollback, observability, retention, supported
runtimes, who may deploy, and dependency upgrades** have no answer anywhere in the tree — not a
weak answer, not a deferred one, *none*. That is not a random scatter: it is the entire operational
surface. An operating system with no rule for how a bad deploy is undone is partial by the ordinary
meaning of the word, however disciplined the rest of it is.

And the denominator is a **lower bound**. Round one found eight omissions; round two, run only
because the first enumeration came from the party being measured, found four more. `24 / 36` is not
a measurement of completeness — it is the best upper bound two attacks could establish.

And the repository has an idiom for *not yet* — `DEFER` with a written trigger, used on `D06` for
two years without embarrassment. It was not used here. These four are not deferred. They are
unnoticed.

**2. The study can vouch for a fraction of the tree.** `D1b` scores **2.34 / 6**: of the 204
implementation files the repository's own governance names, **26 were quoted**. The other 178 were
named and not reproduced, and 106 more are outside the governance corpus entirely. `STRONG` is a
claim about a repository; this study read a governance corpus in full and an implementation corpus
in part, and the corrected score is built to make that visible rather than to excuse it.

**3. The study broke its own laws about itself.** `X-17` … `X-26`: ten contradictions, eight of
them inside the study's own artefacts, in a study whose subject is reconciliation. It violated
`RNL-01` (published counts it did not derive), `RNL-05` (no authority for its own numbers) and
`RNL-06` (reused one law id for two things). A reconstruction that cannot hold itself to the
operating system it reconstructs has not finished demonstrating that the operating system
generalises.

It is `PARTIAL` **with three live counterexamples in the repository** — two P1, one P2, none
critical — and **eight in the study**, all now repaired. Two of the repository's three are named by
the repository itself; the third was found by running it. All are in
[`CONTRADICTIONS.md`](CONTRADICTIONS.md).

**What `PARTIAL` does not mean.** It does not mean the operating system is weak, unenforced or
unreal. Every measurement in §M that tests *whether the model is right* came back at or near
ceiling: `κ = 1.000`, separation `1.000`, admissibility `1.000`, 26 of 26 contradictions
classified, 16 of 16 repo-wide laws with executed enforcement. The points were lost on **coverage**
and **authority completeness** — on how much of the repository the study can speak for, and on how
many questions the repository has answers to. Those are the two honest limits, and they are the
verdict.

---

## B. The kernel

Four rules explain the corpus. Each covers 48–81% of the 48 cases on its own; together they cover
**48 of 48**, and each spans 9–12 of the 12 domains. **Both domain laws sit outside the kernel** —
Study v1 left `RNL-12` inside `K1` while excluding `RNL-09`, which `selfcheck.py` caught (`X-26`).

**The kernel is a logical grouping of the sixteen laws below, and only weakly supported by their
co-occurrence (within/between Jaccard **1.39×**).**

> **Four is a judgement, not a result.** Study v2's Attack 18 measured whether the corpus forces
> four rules. It does not: **`K1+K2+K3` covers 48/48 and so does `K1+K2+K4`**, so two different
> triples already explain every case and coverage cannot even say which rule to drop. The weakest
> seam is `K2`–`K4` at pairwise Jaccard `0.628`, against `K1`–`K2` at `0.200`. Four rules stand on
> the claim that *promotion* (`K2`) and *scope* (`K4`) are different things, which is a reading,
> not a measurement. `SCORING_METHOD_V2.md` §2 declines to score parsimony and says why; this is
> what declining costs. The adversary forced that sentence and it stays,
and the figure fell again in Study v2 when a domain law was removed from `K1` — 1.58× (five-rule
draft) → 1.44× (four-rule v1) → **1.39×** (four-rule v2). Every revision made it worse and every
revision published the worse number.
The eighteen laws are the operative units; the four rules are how they hang together.

> ### K1 · The record decides. Where it cannot answer, refuse rather than fabricate.
> *`RNL-01` `RNL-06` `RNL-07` `RNL-18` — 23/48 cases, 10/12 domains*
>
> ### K2 · Nothing gains authority until a step ran that could have taken it away, and the taking-away condition was written first.
> *`RNL-02` `RNL-03` `RNL-04` `RNL-15` `RNL-16` — 31/48 cases, 12/12 domains*
>
> ### K3 · One current authority per question, with its lineage kept and its way of losing written down.
> *`RNL-05` `RNL-10` `RNL-13` — 30/48 cases, 9/12 domains*
>
> ### K4 · A claim may not outrun its evidence, and the bound is measured rather than judged.
> *`RNL-08` `RNL-11` `RNL-14` `RNL-17` — 39/48 cases, 12/12 domains*

### The laws

Classified by the mission's rule (≥3 distinct domains, ≥2 operational instances, ≥1 failure
explained by violation), plus the adversary's added condition (≥1 supporting failure discovered by
a channel **other than authoring**). Domain counts are computed from the corpus, not asserted.

| law | statement | dom | op | fail | non-auth | class |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| **RNL-01** | **Derive, don't declare** — and the direction is the opposite of GitOps: the *tree* is authoritative and the *declaration* is reconciled toward it. `register-scan.ts` is drift detection with no actuator, deliberately. | 7 | 7 | 5 | 8 | **REPO-NATIVE LAW** |
| **RNL-02** | **Promote only after contradiction was possible.** | 7 | 5 | 4 | 9 | **REPO-NATIVE LAW** |
| **RNL-03** | **Build the judge before the contender**, and put it where it can say no. | 7 | 4 | 2 | 7 | **REPO-NATIVE LAW** |
| **RNL-04** | **A gate that has not demonstrated failure is not a gate** — same predicate, broken input, red *for its own reason*. Universal for gates since ledger cycle 34; sporadic before. | 4 | 5 | 4 | 9 | **REPO-NATIVE LAW** |
| **RNL-05** | **One authority per **question**, not one source of truth for everything.** It is a rule about questions, not files: merging two documents that answer different questions destroys the property. | 5 | 5 | 4 | 7 | **REPO-NATIVE LAW** |
| **RNL-06** | **Identity follows semantics, not labels.** | 4 | 4 | 3 | 3 | **REPO-NATIVE LAW** |
| **RNL-07** | **Freeze refuses rather than silently repairs.** | 3 | 4 | 2 | 4 | **REPO-NATIVE LAW** |
| **RNL-08** | **Evidence authority may never exceed evidence level.** | 10 | 6 | 3 | 8 | **REPO-NATIVE LAW** |
| **RNL-09** | Derivation → shadow → ownership. | **2** | 4 | 2 | 1 | `DOMAIN LAW` — measurement surfaces |
| **RNL-10** | **Failed history is provenance, not clutter** — kept unmodified, with an explicit and *scoped* replacement pointer. | 8 | 5 | 3 | 9 | **REPO-NATIVE LAW** |
| **RNL-11** | **Do not change the intervention and the measuring instrument at the same time.** | 3 | 4 | 2 | **1** | **REPO-NATIVE LAW** — *weakest; see §I* |
| **RNL-12** | A surface must read the record, not its private copy. | **2** | 3 | 3 | 5 | `DOMAIN LAW` — client surfaces |
| **RNL-13** | **A claim must specify what would reverse it** — there is no `status: solved` without one, and a fired trigger must be evaluated and recorded, not left in the table. | 6 | 4 | 3 | 9 | **REPO-NATIVE LAW** |
| **RNL-14** | **The level of reality in the test must match the level in the claim** — derived, with a severity floor. Higher is *not* always better. | 6 | 4 | 3 | 6 | **REPO-NATIVE LAW** |
| **RNL-15** | **Declare the rejection rule before the run, and do not move it after** — even when the rule turns out to be the thing that was wrong. | 6 | 4 | 3 | 8 | **REPO-NATIVE LAW** |
| **RNL-16** | **The adversary is scheduled, and may repair the *instrument* in either direction while only ever weakening a *claim*.** *(narrowed by execution — see §I)* | 3 | 4 | 3 | 4 | **REPO-NATIVE LAW** |
| **RNL-17** | **Say what this does not establish**, in the same shape, every time. | 12 | 5 | 3 | 19 | **REPO-NATIVE LAW** |
| **RNL-18** | **Refuse rather than skip** — `NOT-MEASURED` is not `PASS`. | 5 | 5 | 3 | 6 | **REPO-NATIVE LAW** |

**16 `REPO-NATIVE LAW` · 2 `DOMAIN LAW` · 0 `LOCAL PATTERN` · 0 `UNSUPPORTED GENERALIZATION`.**

> **Three of the sixteen sit exactly on the bar.** `RNL-07`, `RNL-11` and `RNL-16` each carry
> **3 domains** against a threshold of 3; a single domain miscount demotes each to `DOMAIN LAW`,
> taking the model to 13 + 5 and removing a member from `K1`, `K2` and `K4`. Study v2's Attack 19
> re-examined all three and downgraded none, which is a weaker result than it sounds: the
> classification is correct **if the mapping is correct**, and κ cannot see a wrong count because
> the bar reads the same numbers the study assigned. The mapping now ships as
> [`LAW_SUPPORT.json`](LAW_SUPPORT.json) so a second reader can recount all 48 cases against all 18
> laws. That is the model's sharpest remaining fragility.

### Compliance, counted rather than asserted

A law with a live counterexample is not "what the repository does"; it is what the repository has
decided and not finished.

| law | live counterexamples | where |
| --- | ---: | --- |
| `RNL-01` | 2 | `LearningQueue.tsx:111` renders the stored grade (`X-01`); `results/selftest.json` declares a result its own code no longer produces (`X-16`) |
| `RNL-07` | 1 | `PREREGISTRATION_FREEZE.json`'s amended hash is stale for `DATA_PROTOCOL.md` (`X-02`) |
| `RNL-02` / `RNL-04` | 1 | `npm run bundle:budget` is enforced and has no positive control (`G-02`) |
| `RNL-14` | 1 | `L6` deployment rung is zero and the one run that found a defect does not re-run (`G-07`) |
| `RNL-06` | 1 | two studies named "B3" on two refs (`X-15`) |
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
| `RNL-09` derivation → shadow → ownership | 2 domains. It costs a measured **+16.1 kB raw / +5.1 kB gzipped** on two hot routes and a ledger nobody reads. It is for a derivation that would change **what a person is sent to** — not for one that answers a question about the repository. `register-scan` and `test-level-scan` correctly took ownership on day one. |
| `RNL-12` a surface must read the record | 2 domains, both client-side. It is a rule about the *read path and its key*, not about caching. |
| `RNL-16` the scheduled adversary | Costs a full independent context per gate — B3 spent four plus three re-reads. Spend it where a result will be believed and is expensive to redo. It is not a repository-wide rule. |
| `E0–E6` | A ladder for **research promotion**. Product defects legitimately have no E-level; extending it to debt rows would manufacture a claim. |
| The `L0–L5` ecological ladder | A property of a *research task*, not of a test. |

---

## I. Contradictions

Full register in [`CONTRADICTIONS.md`](CONTRADICTIONS.md): **26 entries: 11 `REAL_CONTRADICTION` · 6
`DIFFERENT_SCOPE` · 4 `HISTORICAL_SUPERSESSION` · 5 `NOMINAL_ONLY` · 0 `UNRESOLVED` · 0 critical.**
Ten of the twenty-six were added in Study v2, and **eight of those ten are inside the study
itself** — one of them found by a machine rather than by a reader.

The three live ones:

**`X-01`** — `LearningQueue.tsx:111` renders the stored grade while `record-service.ts` derives it.
P1, bounded to a wasted click, and named by the repository in the ledger's own *"Still open and
stated plainly"*.

**`X-02`** — `PREREGISTRATION_FREEZE.json`'s `amended_sha256` says `DATA_PROTOCOL.md` is `cf263394…`;
the file is `6560f3d7…`, and `FINAL_HOLDOUT_SEALED.json` records the correct value. Verified against
git in this study: the change landed in the seal commit itself. It is `RNL-05` violated inside a
mechanism built to enforce `RNL-06`.

**`X-16`** — found by **running** the oracle, not by reading it. `results/selftest.json` records the
plant `one-game-only` at `delta 0.45, passes: false`, with a `plants_off_target` entry;
`oracle/worlds.py:419` at this commit declares `0.22`, and a re-run passes with that list empty. Both
files were last written in the **same commit**. P2 — nothing cites the disputed number — but it is
the **second verified instance** of the same failure mode as `X-02`, in a different programme, found
by a different method. Together they are what makes gap rank 1 the highest-value move in §G.

### Two narrowings this study made, and where they came from

**`RNL-01` was inverted by an external framing and had to be stated with its direction.** OpenGitOps'
*continuously reconciled* holds the declaration authoritative and converges the world. This
repository does the opposite. Importing the framing would reverse the law.

**`RNL-16` was too strong, and execution proved it.** Running `evaluate.py` in this session on both
committed analyses showed Gate 3's repair moved the verdict **up** — `INVALID_EXPERIMENT` →
`GENERAL_REGULARITY_ONLY` level 3. The repository runs two adversarial roles and the draft had
collapsed them: an **instrument adversary**, which may move a number in either direction under a
pinned diff, and a **claim adversary** (Gate 4), whose fifteen required changes were *"every one a
weakening or a qualification"*.

### The weakest law, named

**`RNL-11`** meets the stated bar (3 domains, 4 operational instances, 2 failures) but has **one**
non-authoring case against `RNL-17`'s nineteen. Everything supporting it was found by an audit, except
`C30`, whose green positive control supports four other laws more centrally. **What would strengthen
it:** a measured case where a protocol version bump and an interface change happened in the same
step and a later comparison was demonstrably wrong because of it. No such case exists in the tree.

---

## J. Proposed consolidation implications — high level only

**Consolidation governed by this operating system is not a merge.**

`RNL-05` (one authority per question) reads like a licence to merge and is not one — it is a rule about
*questions*. `RNL-10` (failed history is provenance) is its other half, and a consolidation that reads
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

> ### THIS SCORE EVALUATES THE RECONSTRUCTION STUDY.
> ### IT IS NOT A SCORE OF THE APPLICATION.
>
> It says how well this repository's operating system was reconstructed. It says nothing about
> whether the product is production-ready, whether the science is valid, whether the code is
> maintainable, or whether consolidation is safe on any axis this study did not measure.
> [`SCORING_METHOD_V2.md`](SCORING_METHOD_V2.md) §7 lists what is knowingly outside it.

Computed by [`SCORING_METHOD_V2.md`](SCORING_METHOD_V2.md), which was written before the numbers,
by [`score_v2.py`](score_v2.py), which reads its inputs out of the published artefacts rather than
taking them by hand. Study v1's score and its method are preserved unchanged in
[`SCORING_METHOD.md`](SCORING_METHOD.md) and [`AMENDMENT_CHAIN.md`](AMENDMENT_CHAIN.md).

| dimension | formula input | score |
| --- | --- | ---: |
| 1a · Governance coverage | 169 / 169 governing files classified; every mandatory document present | **10.00** / 10 |
| 1b · Implementation evidence | **26 of 204** files the governance corpus names are `QUOTED`; the rest `NAMED` | **2.34** / 6 |
| 1c · Support evidence | 2,928 / 2,954 tests executed; 19 / 19 migrations applied in CI | **3.98** / 4 |
| 2 · Classification quality | separation 1.000 · κ 1.000 · falsification 0.944 · admissibility 1.000 | **19.83** / 20 |
| 3 · Contradiction resolution | 26 / 26 classified with direct evidence; 0 `UNRESOLVED`; 0 critical | **15.00** / 15 |
| 4 · Authority resolution | **25 / 36** after two rounds of the completeness attack | **10.42** / 15 |
| 5 · Falsifiability | 17 / 18 laws carry a counterexample search, a failure condition and a boundary | **14.17** / 15 |
| 6 · Operational grounding | 16 / 16 repo-wide laws with ≥2 executable enforcements, **executed** | **15.00** / 15 |

# 90.73 / 100 — target > 95 NOT MET

**Study v1 published 97.78 and it was wrong.** Where the 7.05 points went:

```
D4  authority resolution         −4.58   25/36, after twelve omitted questions were found
D1b implementation evidence      −3.67   26 of the 204 files governance names are quoted
D5  falsifiability               −0.83   RNL-17 carries no counterexample search at all
D1c support evidence             −0.02   26 tests present and not executed
D2  classification quality       +2.06   the corrected formula scores the analysis HIGHER
                                 ─────
                                 −7.05
```

**Both losses are denominators the study used to choose.** `D1b` and `D4` account for `−8.25`;
everything else nets `+1.20`.

**The dimension rebuilt to remove a bias gave the study more credit, not less.** Once `D2` measured
discrimination instead of generosity, it rose from 17.78 to 19.83. The score fell on **coverage**
and **authority completeness** — where the study was actually weak. That is the shape of a
correction rather than of a punishment.

**The additional requirements for a score above 95 are not all met**, and the two that fail are
named rather than argued away:

| requirement | met |
| --- | --- |
| no critical corpus gap | **no** — 178 of the 204 implementation files the governance corpus names were never quoted |
| no unresolved P0 contradiction | yes — 0 of 26 |
| every repo-wide law operationally grounded | yes — 16 / 16, enforcement executed |
| the authority map complete against a denominator that survived a completeness attack | **no** — 11 of 36 unresolved, 6 with no authority at all, and the denominator is a lower bound |
| at least one falsification attempt per law | **no** — `RNL-17` has none |
| `selfcheck.py` green on the study, every injected drift red on its fixture | yes — 11 / 11 and 6 / 6 |

**`RNL-17`'s missing counterexample search is left standing.** It costs `D5` 0.83 points and `D2`
0.17. Writing one now, after the score is known, is the move
[`SCORING_METHOD_V2.md`](SCORING_METHOD_V2.md) exists to forbid.

**94.6 was not rounded to 95, and 90.73 was not rounded to anything.** The threshold failed. The
threshold was not moved.

---

## N. Final evidential support

**Renamed.** v1 called this *evidential confidence* and reported `96.35 %`. It is not a confidence.
Defect C, [`SCORING_METHOD_V2.md`](SCORING_METHOD_V2.md) §0-C.

83 weighted conclusions, weights and strengths per `SCORING_METHOD_V2.md` §5, computed by
[`wes_v2.py`](wes_v2.py).

```
Σ weight              = 144
Σ (weight × strength) = 139.30

WEIGHTED_EVIDENCE_SUPPORT = 139.30 / 144 × 100 = 96.74
WES₉₀ (share of weight at strength ≥ 0.90)     = 100.00 %
```

# 96.74 `WES` — target > 95.5 % MET

> **This metric is not `P(the model is correct)`.**
>
> It has no calibration model and no reference class. It measures the evidence behind what was
> **published**, not the chance that what was published is true. It cannot fall when a conclusion
> is omitted rather than published — and, as this study demonstrated on itself, **publishing one
> more well-evidenced conclusion raises it**: publishing Defect E moved it `96.46 → 96.52`,
> Defect G `→ 96.57`, and the second adversarial pass's own findings `→ 96.74` — rising three times
> in the pass in which the score fell twice.
> A reader who wants a confidence will not find one here.

Read it as: *draw one published conclusion at random, weighted by consequence; the expected
evidence strength of that draw is 0.965.* Strength distribution: **51 conclusions at 1.00**
(`DIRECT_EXECUTABLE_EVIDENCE`) and **32 at 0.90** (`DIRECT_AUTHORED_EVIDENCE`). Nothing below 0.90
entered, because nothing that could not be traced to a run or a cited path was published.

**Why it did not fall when the score did.** The score measures how much of the repository the study
can speak for and how complete its questions were. `WES` measures how well-evidenced the things it
did say are. Those are different quantities, and the study's failure mode was **saying too little
about too little**, not saying it on thin evidence. A metric that fell in sympathy would be
measuring nothing.

**Ceilings, each computed from a published artefact rather than asserted** (Defect E repair):

| ceiling | condition | applies | measured |
| ---: | --- | --- | --- |
| 90% | an unresolved critical contradiction | no | 0 `UNRESOLVED`, 0 at P0 |
| 92% | incomplete core process corpus | no | governance 169 / 169 |
| 90% | a repo-wide law supported by only one domain | no | weakest is `RNL-07` at 3 domains |
| 90% | current authority unknown for a critical scientific claim | no | 11 unresolved, none scientific; `Q32` repaired by `LAW_SUPPORT.json` + `selfcheck.py` |
| 85% | cannot distinguish current from historical evidence | no | 3 items carry an explicit `HISTORICAL` label |

### What would raise it further, exactly

| conclusion | at | what would make it 1.00 |
| --- | ---: | --- |
| the executive verdict | 0.90 | an independent reader reproducing this reconstruction from the corpus alone |
| `RNL-17` say what this does not establish | 0.90 | execute `src/write_report.py`'s forbidden-phrase check and observe it refuse to write |
| `RNL-11` do not change intervention and instrument together | 0.90 | a measured case in the tree where a version bump and a stimulus change in one step invalidated a later comparison — none exists |
| `RNL-16` the scheduled adversary | 0.90 | an independently-dispatched review in this session, reproducing a gate's findings |
| authority / evidence / transition models | 0.90 | a scanner that derives the authority of each question from the tree, which does not exist |
| `Q26` `Q27` `Q29` `Q30` `Q35` | 0.90 | nothing this study can run — the repository has no artefact to execute |
| `X-03`–`X-06`, `X-08`–`X-10`, `X-13` | 0.90 | these are supersession scopes stated in prose; W3C PROV edges (§G) would make them executable |

---

## Final statement

`REPO-NATIVE OS PARTIALLY VALIDATED — the model holds and its enforcement reproduces, but the study
can vouch for only 26 of the 204 implementation files its own governance names, and at least 11
of at least 36 critical questions have no single current authority, 6 of them no authority at
all.`

**Study v2 score 90.73 / 100 — target > 95 NOT MET.**
**Weighted evidence support 96.74 (`WES₉₀` 100.00 %) — target > 95.5 MET.**
**Verdict `PARTIAL_REPO_NATIVE_OS`, downgraded from `STRONG_REPO_NATIVE_OS`.**

Study v1 published `97.78 / 100`, `96.35 %` and `STRONG_REPO_NATIVE_OS`. Seven methodological defects
moved all three. Every v1 figure, formula and classification is preserved — `SCORING_METHOD.md`
unchanged, `AUTHORITY_MAP.md` unchanged, the chain in
[`AMENDMENT_CHAIN.md`](AMENDMENT_CHAIN.md) — because the repository's own `RNL-10` says failed
history is provenance, and a study that quietly replaces its own numbers cannot be audited.

**The number fell because the instrument was repaired, not because the repository changed.** No
file outside `docs/consolidation-research/` differs between the two scores.

Nothing in the repository was moved, renamed, deleted, merged, reformatted or rewritten by either
pass. The additions are the twenty-four files in `docs/consolidation-research/`. One tracked file —
`research/discovery-oracle/results/selftest.json` — was overwritten by running the oracle's own
self-test during Study v1 and was restored immediately with `git checkout --`; the incident, and
the finding its diff produced, are recorded in `BASELINE.md` Amendment 1 and `CONTRADICTIONS.md`
`X-16`.
