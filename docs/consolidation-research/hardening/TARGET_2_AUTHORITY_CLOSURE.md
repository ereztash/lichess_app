# TARGET 2 — authority closure

| metric | before | after |
| --- | ---: | ---: |
| questions enumerated | 36 | **36** (unchanged; may only grow) |
| with exactly one current authority | 25 | **30** |
| with no authority at all | 6 | **5**, each a checked capability gap |
| **mechanically verified authority** | **0 / 36** | **36 / 36** |

**The denominator did not move.** Every question round one and round two found is still in the
registry, and `AUTHORITY_QUESTIONS` is the denominator — a question removed to improve a ratio is
the defect that made Study v1 report `24 / 24`.

---

## 1. Classification first, files second

The mission's rule, and the reason this target produced one scanner rather than six markdown files:

> A document cannot become authority over a capability that does not exist.

Every unresolved question was classified before anything was written.

| # | question | class | what was done |
| --- | --- | --- | --- |
| `Q25` | what defines the database schema? | `MULTIPLE_COMPETING_AUTHORITIES` | **resolved.** Column-by-column comparison proved the stray `drizzle/0001_verified_learning.sql` creates all three tables **identically** to `drizzle/migrations/0000_cold_titanium_man.sql`. Not a rival schema, a leftover that reads like one. Scoped with a header, not deleted |
| `Q26` | how is a bad deployment rolled back? | **`CAPABILITY_GAP`** | recorded as an absence with a trigger. No `docs/ROLLBACK.md` was written, because it would describe a rollback nobody can perform |
| `Q27` | where do runtime errors go? | **`CAPABILITY_GAP`** | as above. `/api/health` answers liveness and nothing else exists |
| `Q28` | what may the product record about a person? | `DERIVABLE_BUT_NOT_DERIVED` | **left unresolved, deliberately.** `ACQUISITION_EVIDENCE.md` is a real authority for the ledger; `schema.ts` says what the record *can* hold, which is a different question from what it *may* hold. Recorded as `PARTIAL_AUTHORITY` so it cannot be read as resolved |
| `Q29` | how long is a record kept? | **`CAPABILITY_GAP`** | recorded with its trigger: the first record belonging to somebody who is not the author |
| `Q30` | which browsers and runtimes are supported? | `DERIVABLE_BUT_NOT_DERIVED` | **resolved.** `docs/SUPPORTED_RUNTIMES.md` states the baseline and names what enforces each line |
| `Q31` | what is the release identity? | `DERIVABLE_BUT_NOT_DERIVED` | **resolved.** `shared/build-identity.ts` + `scripts/write-build-identity.ts`, generated at build time |
| `Q32` | who is authoritative for the study's own numbers? | — | **resolved during Study v2, not by this mission.** Disclosed separately below |
| `Q34` | who may deploy? | **`CAPABILITY_GAP`** | a `CODEOWNERS` file alone would be inert without a branch protection rule, which lives in repository settings rather than in this tree. Recorded with that as the trigger |
| `Q35` | what accessibility conformance target? | `DOCUMENTATION_GAP` | **resolved.** WCAG 2.2 AA was already being assessed against in two documents and adopted by none |
| `Q36` | how is a dependency upgraded? | **`CAPABILITY_GAP`** | `npm audit` is blocking and prescribes no response |

## 2. Where the +5 came from, and which of it this mission caused

| question | baseline | now | caused by |
| --- | --- | --- | --- |
| `Q25` schema | contested | one authority | **this mission** — the stray migration scoped, and a predicate that reddens on the next one |
| `Q30` runtimes | no authority | one authority | **this mission** |
| `Q31` release identity | partial | one authority | **this mission** |
| `Q35` accessibility | partial | one authority | **this mission** |
| `Q32` study numbers | no authority | one authority | **Study v2, before this mission.** Counted unresolved in the frozen baseline because that is what the baseline published |

**Four of the five are this mission's. The fifth is disclosed rather than absorbed**, because a
reclassification that arrives with the score is indistinguishable from an improvement unless
somebody says which is which.

## 3. The capability gaps are checked, not asserted

This is the part that makes the classification worth more than a table.

```ts
{ kind: "CAPABILITY_GAP", absent: [...], trigger: "..." }
```

`findClosedCapabilityGaps` reddens **if any named artefact appears**. A gap that has become a
capability makes the record the stale one, and the gate says so.

It keeps the classification honest in both directions:

- the repository cannot keep saying it has no rollback long after somebody writes the script;
- a reader who adds `docs/ROLLBACK.md` cannot believe the question answered while the record says
  otherwise.

**A gap you cannot claim without evidence is a gap that cannot be used to look finished.** That is
the whole reason a `CAPABILITY_GAP` is admissible as a resolution at all.

## 4. Derived, not hand-maintained

The mission's constraint was explicit: *do not make `AUTHORITY_MAP.md` another hand-maintained
source of truth.* So the registry lives in `scripts/authority-scan.ts` and three predicates run
against the tree on every gate run:

| predicate | catches |
| --- | --- |
| `findBrokenAuthorities` | a named authority that is no longer in the tree, and a scoped competitor that lost its marker |
| `findClosedCapabilityGaps` | a gap that quietly became a capability |
| `findUnscopedMigrations` | a `.sql` outside `drizzle/migrations/`, which CI never applies, not saying what superseded it |

**What is deliberately not checked:** whether the *right* file was chosen as an authority. That is a
judgement, and pinning a judgement to a string teaches the next editor to edit the scanner with it —
`register-scan.ts`'s stated reason for not scanning prose.

## 5. The control

`tests/fixtures/authority/` stubs every authority path the registry names, so only the four injected
drifts fire: an authority deleted, a competitor unscoped, a capability gap closed, an unscoped
migration.

```
npm run gates            30 gates: 30 pass, 0 fail, 0 not-measured
npm run gates:controls   30 gates: 0 pass, 30 fail -- all controls went red
```

The stubs are generated from the registry, so a question added without a stub leaves the fixture red
for one more reason. A control that must be red staying red is the correct failure mode.

## 6. What this does not establish

- **That the six remaining questions are answered.** Five are capability gaps and one is partial.
  What changed is that each is now a *checked* claim about an absence rather than a silence.
- **That 36 is the complete denominator.** Two attacks found twelve omissions between them and the
  second found four after the first had finished. It is a lower bound, and `AUTHORITY_QUESTIONS`
  is written so it can only grow.
- **That `WCAG 2.2 AA` is met.** `docs/SUPPORTED_RUNTIMES.md` states the target and names what is
  enforced against parts of it. A target with partial enforcement is a target, not a conformance
  claim, and the file says so in its own words.
- **That the release identity is served by the deployed build.** It is generated at build time;
  proving the deployed origin serves it is `TARGET 3`.
