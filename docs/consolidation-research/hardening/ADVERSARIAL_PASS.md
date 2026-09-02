# Adversarial pass — the case that this hardening is cosmetic

Ten attacks, in the mission's order. Each one measured rather than argued.

**Three landed.** They are stated first, because a review that buries its findings under its
clearances is a review that has decided its answer.

---

## What landed

### 1. The benchmark cannot see most of this work, and that is a finding about the benchmark

`Study v2`'s score has eight sub-dimensions. **Six of them read study artefacts, not repository
state**: `D2` and `D5` read `LAW_SUPPORT.json`, `D3` reads `CONTRADICTIONS.md`, `D6` reads the law
table, `D1a` and `D1b` are pinned to the baseline commit inside `d1b_population.py`.

Re-running the frozen programs against the hardened tree therefore returns **exactly `90.73`**,
because every input is unchanged. The mission's premise — improve the repository, re-run the
benchmark, watch the score move — does not hold for this instrument, and no amount of repository
improvement would make it hold.

**This is not an excuse and it is not repaired here.** Repairing it means changing the instrument,
which the mission forbids inside this pass for the reason it gives: changing both instrument and
subject destroys the comparison. It is reported as the primary result.

### 2. `D1a`'s population rule now sweeps in the study's own output, and the script refuses

Attempting to re-measure at `HEAD`:

```
d1b_population: governance population is 207, not the 169 PROCESS_CORPUS.md classified
                -- the path rule and the corpus have diverged
```

`docs/**` and `scripts/**` are the governance rule, and this mission added 31 study files, a
runtimes document and four scripts. Re-measuring would score the study for failing to classify its
own output, which is absurd; the alternative is redefining the population, which is a **denominator
definition change** and forbidden.

**The refusal is the correct behaviour** — `RNL-18`, and it was written into the script before this
question arose. It is also the sharpest evidence for finding 1.

### 3. Two of the five resolved authority questions are resolved by prose

`Q30` (runtimes) and `Q35` (accessibility target) are answered by `docs/SUPPORTED_RUNTIMES.md`.

For `Q30` this is defensible: every row names what already enforces it, and the file only writes
down a baseline the tree was already keeping. **For `Q35` it is weaker.** WCAG 2.2 AA is a
*commitment*, and no command holds the product to it. The file says so in its own words — *"a target
with partial enforcement is a target, not a conformance claim"* — but the attack stands: one of the
five is a document adopting a standard, and `GATE-AUTHORITY-RESOLVED` checks only that the document
exists.

**Not repaired.** The honest repair is an accessibility audit, which is outside this mission.

---

## What did not land

### 4. Did denominators shrink?

| denominator | before | after | |
| --- | ---: | ---: | --- |
| authority questions | 36 | **36** | the registry IS the denominator, and `AUTHORITY_QUESTIONS` may only grow |
| implementation files (`D1b`) | 204 | **204** | pinned to the baseline commit; see finding 2 |
| law candidates (`D5`) | 18 | 18 | untouched |
| contradictions (`D3`) | 26 | 26 | untouched |
| blocking CI steps | 10 | **12** | grew, and both new ones are controls |
| test files | 264 | **266** | grew |

**Nothing shrank.** The two denominators that moved, moved up.

### 5. Did an `UNKNOWN` disappear because the question was removed?

No question was removed. **`Q28` was deliberately left unresolved** and given its own resolution
kind (`PARTIAL_AUTHORITY`) precisely so it could not be read as answered: `schema.ts` says what the
record *can* hold, and the question asks what it *may* hold.

Naming both files as "the authority" would have taken the count to 31/36. It was not done.

### 6. Did research reconciliation whitelist the known defects?

**`X-16`: no.** Regenerated. The committed artefact now matches its generator, and the drift is
preserved in `git`, in `CONTRADICTIONS.md`, and in the fixture, which carries `delta 0.45` forever.

**`X-02`: this is the attack's strongest target**, because "mark it superseded" is exactly what a
whitelist looks like. Tested rather than argued — the successor's coverage was removed and the gate
re-run:

```
RED: amended_sha256.<doc> is superseded by …FINAL_HOLDOUT_SEALED.json document_sha256,
     which does not cover DATA_PROTOCOL.md
```

`findOrphanedSupersessions` requires the successor to **exist**, to be a `CURRENT` checked relation,
to **cover the same five documents**, and to be **named in the artefact's own text**. Break any one
and the gate fails. A whitelist has none of those properties.

### 7. Did an `L6` test touch too little reality for its claim?

The suite makes **seven** assertions and refuses before any of them if the origin cannot name its
build. Its first real run against production returned `5 passed | 2 failed`, and the two failures
were the identity checks — production serves `8c8b331`, which predates the identity.

**The claims are narrow and labelled**: headers, MIME types, SPA routing, asset delivery, and that
the served document is this application's shell. The file states that it licenses *nothing* about
product behaviour and that no write is ever made.

**Where the attack half-lands:** `L6` is 1 file of 266, and "L6 is non-zero" is a much weaker
statement than "the deployment is verified". The licensing decision below is made on the narrow
reading.

### 8. Did deriving state change semantics rather than remove duplication?

Tested with a third fixture case written for this attack: **a rule whose stored projection is
already correct comes back identical.** So behaviour changes only where the stored value was wrong,
which is the definition of a repair.

The opposite error is guarded too: `retired` is preserved, because no fold produces it.

### 9. Were positive controls made red for irrelevant reasons?

Every fixture finding was enumerated and matched to the drift it was built for:

| fixture | findings | all deliberate |
| --- | ---: | --- |
| `tests/fixtures/research` | 5 | yes — 4 drifts, one of which produces two findings (two superseded blocks, neither naming a successor) |
| `tests/fixtures/authority` | 4 | yes — one per predicate path |
| `tests/fixtures/falsification` | 3 | yes — one unclassified step, two missing mechanisms |
| `deployed-origin.control` | 3 | yes — identity, shell and CSP, all against `example.com` |
| `check:control` | `TS2322` | yes — on the intended line |
| `bundle:budget:control` | 2 | yes — the ceiling **and** the eager-engine rule |

**No control fires for an incidental reason.**

### 10. Was historical evidence rewritten?

| file | change |
| --- | --- |
| `PREREGISTRATION_FREEZE.json` | **+4 lines, 0 values changed.** Two keys appended |
| `drizzle/0001_verified_learning.sql` | **+20 header lines, 0 SQL changed** |
| `research/discovery-oracle/results/selftest.json` | **regenerated.** `passed`, `plants` and `plants_off_target` changed; `nulls`, `null_leaks`, `seed`, `max_z`, `games_per_record` and `records_per_world` all unchanged |
| every Study v2 artefact | **untouched.** `git diff` over `docs/consolidation-research/*.{md,json,py}` shows only the new `hardening/` subdirectory |

### 11. Did any scientific verdict, denominator or result change?

Both B3 verdicts re-derived from the committed analyses in this tree:

```
results/verdict.json           IDENTICAL
results/verdict_repaired.json  IDENTICAL
```

No preregistration, seal, population, protocol, threshold or estimate was modified. The only
scientific artefact whose content moved is `selftest.json`, and it moved to agree with the code
committed beside it.

### 12. Did the hardening add more complexity than it removed?

| | |
| --- | ---: |
| lines added, scanners and tests | ~1,700 |
| lines added, documentation | ~1,100 |
| **manual reconciliation steps removed** | **44 hash claims + 36 authority questions + 12 blocking checks + 4 read sites = 96** |
| new commands a contributor must remember | **0** — every check runs inside `npm run gates`, which `verify` already ran |

The three scanners are the same shape as `register-scan.ts`, which the repository already had and
already trusted, so the cost is length rather than a new idea to learn.

**Where it half-lands:** `AUTHORITY_QUESTIONS` is 36 hand-written rows. It is checked, but it is
still a list somebody must extend when a new question is asked, and nothing derives the *questions*
from the tree. That is the honest limit of this design.

---

## Verdict of the pass

**The hardening is not cosmetic.** Nothing shrank, no question vanished, no history was rewritten,
no verdict moved, and the one repair that looks like a whitelist was tested and is not one.

**And the score movement is smaller than the work**, for a reason that is the mission's most useful
finding: the benchmark measures the reconstruction study, not the repository, and six of its eight
sub-dimensions cannot see repository state at all.
