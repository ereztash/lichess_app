# EVIDENCE_MODEL — are the ladders one schema, or several dimensions?

This repository carries at least six vocabularies that look like they grade evidence:

| ladder | where it is defined | values |
| --- | --- | --- |
| **E0–E6** | `docs/decisions/README.md` | idea → external implementation → reproduced → passes null+planted → port equivalent → prospective validation → measured behavioural effect |
| **L1–L6 (test)** | `tests/LEVELS.md` | pure · contract · render · store · browser · deployment |
| **L0–L5 (ecological)** | `docs/measurement/ECOLOGICAL_EXTRAPOLATION_GAP.md` | a separate ladder, task → game |
| **P0/P1/P2** | `docs/MASTER_PRODUCT_DEBT.md` | a record can be lost or made wrong · the record cannot be trusted to mean what it says · real, bounded, not blocking |
| **evidence authority** | `shared/evidence-authority.ts` | one-event · recurred · hypothesis · tested · refuted |
| **source tier A/B/C** and **tier 4/5/6** | `docs/measurement/EVIDENCE_MANIFEST.json`, `docs/learning-v2/COMPETITOR_MECHANISM_AUDIT.md` | where an external claim came from |
| **verdict labels** | per programme | `STOP-A…G`, `MEASUREMENT-BLOCKED`, `CONSTRUCT-UNDERIDENTIFIED`, `NARROW`, `RESEARCH ONLY`, `VACANT`/`SATURATED`/`MEASURABLE`, `REPO-CLEAR`/`FIELD-REQUIRED`/`OWNER-REQUIRED` |

The question the mission poses: are these (A) competing schemas, (B) orthogonal dimensions,
(C) partially redundant, or (D) different views of one model?

## Answer: (B), with one genuine redundancy and one genuine hierarchy

### The test

Two ladders are **the same dimension** if fixing one value constrains the other. They are
**orthogonal** if every combination is reachable and at least two combinations actually occur in the
repository. This is checkable against the corpus rather than argued.

| pair | can a case sit at any combination? | evidence |
| --- | --- | --- |
| E-level × L-level | **yes** | `D09` is `E2` proven at `L1/L2` (SHA-256 differenced against `node:crypto`). `D04` is `E3` proven only in simulation — no `L` rung applies, because the ladder is about the *product's* runtime. `R-19` is a P0 defect at `L5` with no E-level at all. |
| E-level × severity | **yes** | `D25` is `E1` and its consequence was a **P0** (a `VERIFIED` surface shipping default-on). `D02` is `E3` and its consequence is `P2`-or-nothing (a measurement that reads nothing). |
| L-level × severity | **constrained in one direction only** | `tests/LEVELS.md` sets a **floor**: `P0 → L4`, `P1 → L2`. A P0 may be proven at `L5` (four are). A P2 carries no floor. So severity implies a minimum rung and nothing more. |
| evidence authority × E-level | **yes** | `refuted` is the *strongest* evidence the product produces and it is the end of a claim's life; `E5` is a promotion. The two run in different directions by design. |
| source tier × everything | **yes** | a tier-A external source (`AERA/APA/NCME Standards`) licenses a *method*, and `GATE-EXTERNAL` makes it a compile error for it to raise a *claim's* grade. |

**Every pair is orthogonal except (L-level, severity), which is a floor relation and not an
identity.** That is dimension, not redundancy.

### What each dimension actually asks

The repository's own sentences, not a synthesis:

```
E-level          WHAT ACTION IS PERMITTED           "what a piece of work is allowed to become,
                                                     given what is known about it"
                                                     -- docs/decisions/README.md

L-level (test)   HOW MUCH REALITY THE TEST TOUCHED  "a way to ask WHICH rung a claim needs"
                                                     -- tests/LEVELS.md

L-level (eco)    HOW FAR THE TASK IS FROM A GAME    "a ladder whose rungs are separately
                                                     measurable" -- ECOLOGICAL_EXTRAPOLATION_GAP.md

P-level          WHAT BREAKS IF IT IS WRONG          "a claim or a record can be lost or made
                                                     wrong" -- MASTER_PRODUCT_DEBT.md

authority        WHERE IN ITS LIFECYCLE A CLAIM IS   "named for lifecycle rather than for rank"
                                                     -- shared/evidence-authority.ts

source tier      WHERE AN EXTERNAL CLAIM CAME FROM   EVIDENCE_MANIFEST.json

verdict label    WHAT THIS PARTICULAR RUN CONCLUDED  per programme
```

Six questions, six answers. **They must not be unified**, and the repository is right about that:
`shared/evidence-authority.ts` says in as many words that `AUTHORITY_ORDER` is *"NOT A STRENGTH
LADDER"* and that *"a UI that sorted by confidence would bury the one result that actually closes a
question."* A unified scale would have to put `refuted` somewhere on it, and there is nowhere
correct.

### The one genuine redundancy

**The two `L` ladders share a name and nothing else.** `tests/LEVELS.md`'s `L1–L6` is about how much
of the *product's runtime* a test meets. `ECOLOGICAL_EXTRAPOLATION_GAP.md`'s `L0–L5` is about how
far a *research task* is from ordinary play. They are different dimensions with colliding labels —
the same class of hazard as `CONTRADICTIONS.md` X-15 (two studies called B3), and worth naming in
any consolidation.

### The one genuine hierarchy

**Verdict labels are not a seventh dimension; they are the *output* of applying the other six.**
`STOP-B1` is what happens when a measured Δ exceeds a preregistered T2. `CONSTRUCT-UNDERIDENTIFIED`
is what happens when the response predicate destroys the distinction. `MEASUREMENT-BLOCKED` is what
happens when no admissible instrument exists. Each is a named terminal state of one programme's
decision procedure, and each one is *defined before the run* by that programme's own rules file.

## The minimal common representation

Not a merge. A **tuple**, and the claim is that the tuple is lossless:

```
                    ┌ permitted action        E0 … E6            (may this ship / be searched /
                    │                                             be shadowed / be said aloud?)
                    │
                    ├ proof reality           L1 … L6            (what did the check meet?)
                    │                         L0 … L5 eco        (how far is the task from a game?)
a claim  =          │
                    ├ consequence             P0 · P1 · P2       (what breaks if it is wrong?)
                    │
                    ├ lifecycle position      one-event · recurred · hypothesis · tested · refuted
                    │
                    ├ provenance              source tier · corpus manifest · engine sha256 · frozen commit
                    │
                    └ terminal verdict        the programme's own label, defined before the run
```

**Lossless test.** Take any three claims from different programmes and check that the tuple
reconstructs what each document says:

| claim | E | proof | P | lifecycle | provenance | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| "a candidate search recovers `fast AND endgame`" | E3 | simulation only | — | hypothesis | `q7_candidate_search.json`, seeded | *measured, not rejected* |
| "no blitz game was ever stored in a browser" | — | L5 | P0 | one-event → fixed | a real browser, a real clock | `fixed` |
| "expertise adaptation is not supported" | E1 | population dumps + pinned engine | — | tested (prospectively, on a sealed holdout) | manifest + engine sha256 + freeze commit | `GENERAL_REGULARITY_ONLY` level 3 |

Each row is fully reconstructed and no cell is forced. **The mapping is lossless in the direction
that matters** (tuple → document). It is *not* lossless in the other direction: several documents
carry a verdict with no E-level (product defects) or an E-level with no P-level (research nodes), so
the tuple has legitimate holes and a schema that required all six would be wrong.

## What this means for consolidation

1. **Do not unify the ladders.** Six dimensions, and the repository has already paid to learn that
   `refuted` has no place on a confidence scale.
2. **Do rename one of the two `L` ladders.** They are different dimensions sharing a label, which is
   exactly what `L6 identity follows semantics, not labels` forbids.
3. **The tuple is a reading aid, not a schema to impose.** Its holes are load-bearing: a product
   defect legitimately has no E-level, and forcing one would manufacture a claim.
4. **The one place a machine-readable form already exists** —
   `STRONGEST_PERMITTED_CLAIM.json`, in two programmes — is the model for how this should be
   carried if it ever is: per claim, versioned, with an explicit `supersedes` scope, and
   authoritative over its own prose.
