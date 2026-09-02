# LOCAL_SOLUTION_GAPS — where this repository already contains a stronger solution than the one it uses elsewhere

The shape being looked for:

```
Problem P exists in several places.
One location contains a strong solution S.
Other locations still contain weaker variants of P.
```

Nothing here is implemented. This file identifies and ranks; the ranking's inputs are defined
before the table so the numbers are not preferences with decimal points.

## The ranking formula, defined before it is used

```
ExpectedBenefit = Reach × FailureSeverity × EvidenceStrength × Generalizability
```

| term | definition | source of the number |
| --- | --- | --- |
| **Reach** `R` | how many distinct places currently carry the **weaker** variant | a count over the tree, listed per row |
| **FailureSeverity** `S` | `P0 = 3`, `P1 = 2`, `P2 = 1`, unclassified `= 0.5` | the repository's own severity scale, defined in `docs/MASTER_PRODUCT_DEBT.md`: *P0 — a claim or a record can be lost or made wrong; P1 — the record cannot be trusted to mean what it says; P2 — real, bounded, not blocking* |
| **EvidenceStrength** `E` | `1.00` direct executable · `0.90` direct authored · `0.75` multiple converging indirect · `0.50` single indirect · `0.25` inference | the mission's own scale, applied to the evidence that the gap exists |
| **Generalizability** `G` | (number of the 12 corpus domains in which the **strong solution's mechanism** is already demonstrated) ÷ 12 | counted from `PROCESS_CORPUS.json`; a low `G` means *not yet shown to transfer*, which is a real cost |

`G` deliberately punishes a strong solution that has only ever worked in one place. A mechanism
proven in six domains is a safer thing to propagate than one proven in one, even when the one is
more elegant.

## Ranked

| rank | id | strong solution, and where it already is | weaker variants still in the tree | R | S | E | G | **EB** |
| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | **G-04** | `scripts/register-scan.ts` — a scan holding a register's claims **about things outside itself** (a path, a constant, a gate id, another register's table) against the tree, with a control fixture of the drifts it actually had | the research registers and generated artefacts are not scanned: `docs/measurement/FALSIFICATION_REGISTER.md`, `docs/learning/FALSIFICATION_REGISTER.md`, `docs/learning-v2/FALSIFICATION_REGISTER.md`, `docs/evidence-architecture/FALSIFICATION_REGISTER.md`, both `STRONGEST_PERMITTED_CLAIM.json`, `PREREGISTRATION_FREEZE.json`, `FINAL_HOLDOUT_SEALED.json` | 8 | 2 | 1.00 | 0.333 | **5.33** |
| 2 | **G-02** | the gate runner's two-mode contract — the same predicate over a deliberately-broken input, which must go red; **28/28 verified red in this study** | `npm run bundle:budget` is an enforced, blocking check with **no positive control**; the deployment verification (Cycle 34's headers, Cycle 19's addendum) was run once and does not re-run | 2 | 2 | 1.00 | 0.500 | **2.00** |
| 3= | **G-01** | `gradeFromRecord` derives a learning rule's grade before anything is decided, and the write path is guarded in the store | `LearningQueue.tsx:111` renders the stored `rule.grade`; `:42` computes due-ness from stored `next_due_at` | 2 | 2 | 1.00 | 0.417 | **1.67** |
| 3= | **G-05** | `research/b3_population_expertise/src/run.py` `require_seal()` — the holdout is **mechanically** unreadable until the seal file exists, because *"a study that asks its author to remember not to look has not sealed anything"* | four other preregistrations (`ACCOUNT_BRIDGE`, `ACCOUNT_BRIDGE_FULL`, `TIME_REPRESENTATION`, `ENGINE_PARITY`, `BLITZ_COMPUTATION`) and the N-of-1 pilot rely on the author not looking | 5 | 2 | 1.00 | 0.167 | **1.67** |
| 5 | **G-09** | the six-field block in `docs/design-council/00-REPO-NATIVE-CONSTITUTION.md` — SOURCE / EVIDENCE TYPE / WHAT IT ESTABLISHES / WHAT IT IMPLIES / WHAT IT FORBIDS / **WHAT IT DOES NOT ESTABLISH** — used on every row, and the falsification registers' required shape | `MASTER_PRODUCT_DEBT.md` rows and `PRODUCTION_READINESS_LEDGER.md` cycles carry a gate and a fix but no *does-not-establish* line | 2 | 1 | 0.90 | 0.583 | **1.05** |
| 6 | **G-07** | a standing test at the rung the claim needs — `tests/layout/*` refuses to skip, `content-security-policy.layout.test.ts` serves `dist/public` under `vercel.json`'s exact policy | `RNL-06 = 0`; the run that found the CSP/worker defect was a throwaway script and *"does not re-run"* | 1 | 2 | 1.00 | 0.500 | **1.00** |
| 7 | **G-06** | `shared/evidence-policy.ts` — one table, one authority, one version, deciding which observations each analysis may read, with a test that reddens on deleting any cell | the five research programmes have no equivalent: which prior result may be cited by which later one is decided per document, in prose, at the top of each file | 5 | 1 | 0.75 | 0.250 | **0.94** |
| 8 | **G-10** | the gate controls again, this time as an absence: `npm run gates:controls` proves 28 checks can fail | `npm test` — 2,900+ tests — has no systematic control. The repository has recorded **at least five** cases of a test passing *because of* a defect (Cycles 7, 13 twice, 39, 40) | 1 | 2 | 0.90 | 0.500 | **0.90** |
| 9= | **G-08** | `basis: verified | asserted` in `MASTER_PRODUCT_DEBT.md`, the field its own preamble calls *"the one that makes the rest usable"* | no other register distinguishes read-in-the-tree from believed: four falsification registers, three audits, the adversarial review register | 8 | 1 | 0.90 | 0.083 | **0.60** |
| 9= | **G-03** | `hypothesis_id = SHA256(canonicalJson(manifest))`, plus the freeze/seal hash records and `research/b2/as-published-75/`'s preserved evidence hash | filename identity elsewhere: two studies named "B3" on two refs; `docs/decisions/` addresses nodes by a number series with gaps | 2 | 1 | 0.90 | 0.333 | **0.60** |

## Notes on the top three

**G-04 is the highest-value gap, and there are now two verified instances of its failure mode rather
than one.** `CONTRADICTIONS.md` **X-16** — found by *running* the oracle — is a generated artefact
under `research/` that disagrees with the code committed beside it in the same commit. And X-02 is
exactly the failure a research-side register scan would have caught: `PREREGISTRATION_FREEZE.json`'s
`amended_sha256` says `DATA_PROTOCOL.md` is `cf263394…` and the file is `6560f3d7…`. That is a claim
one register makes about something outside itself — a hash of a file at a path — which is the
literal class `register-scan.ts` was written for. The mechanism exists, its control fixture exists,
and it has never been pointed at `research/`.

**G-02's two halves are different in kind.** The bundle budget is a check that *could* have a
control and does not — a fixture with a deliberately oversized entry graph is buildable. The
deployment verification is a check that *cannot* have a fabricated control, because the control is
the world; there the honest form is a standing run, which is G-07.

**G-05 is ranked equal-third on a low `G` and that is the honest result.** `require_seal()` is the
strongest anti-peeking mechanism in the repository and it exists in exactly one place, so nothing
yet shows it transfers to a study whose data arrives from a live API rather than a public dump.
Propagating it is high value and unproven, and the formula says so rather than hiding it.

## Two things that look like gaps and are not

| looks like a gap | why it is not |
| --- | --- |
| shadow-before-ownership (`RNL-09`) exists for `next-action` and `interaction-mode` and nowhere else | the two places that took ownership immediately are argued: `gradeFromRecord` because the stored grade was **actively** causing a preregistration on a refuted rule, and the scanners because they own a claim *about the repository*, not a decision a player meets. A shadow costs a measured **+16.1 kB raw on two hot routes**. |
| the `E0–E6` ladder governs `docs/decisions/` and nothing else | it is a ladder for *research promotion*. Product defects legitimately have no E-level, and `EVIDENCE_MODEL.md` shows the tuple's holes are load-bearing. Extending E-levels to defect rows would manufacture a claim. |
