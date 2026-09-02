# AUTHORITY_MAP — the completeness attack, and the corrected denominator

**Study v2.** `AUTHORITY_MAP.md` (v1) is preserved unchanged as the v1 record. This file is the
adversarial attack on its denominator and the corrected count. Where the two disagree, **this file
is the authority for the authority-question count**; v1 remains the authority for the wording of
the 24 rows it enumerated.

---

## The attack

v1 reported **24 / 24 critical questions with exactly one current authority**. That is a ratio whose
numerator and denominator were chosen by the same reader in the same pass. A question omitted from
the denominator makes the ratio cosmetically perfect, and the study never tested its own list for
completeness.

The test the mission specifies: *could a knowledgeable newcomer ask an important "what is
authoritative?" question that is not represented?*

**Yes. Eight of them.** Each was checked against the tree, not guessed.

---

## The eight omitted questions

| # | question | what the tree actually says | verdict |
| --- | --- | --- | --- |
| **Q25** | **What defines the database schema?** | Three artefacts. `drizzle/migrations/*.sql` — 19 files, applied **in order** by CI, and the workflow states the rule: *"Schema from the generated SQL, not from a hand-written file that can drift from schema.ts."* `drizzle/schema.ts` — 608 lines, the drizzle-kit source. And **`drizzle/0001_verified_learning.sql`, a hand-numbered migration sitting outside `drizzle/migrations/`**, which CI's glob never reaches. It is not byte-identical to any migration inside; its closest relative is `0012_redundant_sally_floyd.sql` at 0.78 similarity. | **NOT RESOLVED** — CI names one authority, and a third artefact answers the same question with nothing scoping it. Carried as `X-24`. |
| **Q26** | **How is a bad deployment rolled back?** | Nothing in the repository. Vercel exposes `isRollbackCandidate` as a platform affordance; no document, script or gate names a rollback procedure. | **NO AUTHORITY** |
| **Q27** | **Where do runtime errors go, and what is observable in production?** | `/api/health` answers liveness (`select 1` under a 3 s deadline) and deliberately cannot distinguish "no database configured" from "database reachable". Beyond that: no error sink, no log destination, no `sentry`/observability reference anywhere in `docs/`, `server/` or `client/src`. | **NO AUTHORITY** |
| **Q28** | **What may the product record about a person, and what may it never record?** | `docs/ACQUISITION_EVIDENCE.md` carries a per-event `privacy` column — *"opaque id + enums + a counter. No FEN, no move, no confidence value, no typed text"* — and that is a real authority **for the acquisition ledger**. The decision record itself carries FENs, moves, confidences and free text, and `scripts/read_vocabulary.ts` states a rule locally (*"it prints what people TYPED, which is the one thing the self-check drawer promises it never hands over — so it does not go there"*). | **PARTIAL** — one authority for one ledger, a local rule in one script, nothing for the record as a whole. Counts as not resolved. |
| **Q29** | **How long is a record kept, and how is it deleted?** | No retention statement, no deletion path, no erasure procedure. The only `retention` hits in the tree are the retrieval-interval literature in `docs/learning-v2/` and `docs/evidence-architecture/`, which is a different sense of the word. | **NO AUTHORITY** |
| **Q30** | **Which browsers and runtimes are supported?** | No `browserslist`, no baseline statement. The tree carries *consequences* of a baseline — a 44 px tap floor, 200 % zoom, `forced-colors`, `prefers-reduced-motion` — with nothing stating the baseline they are consequences of. | **NO AUTHORITY** |
| **Q31** | **What is the release identity, and what changed between two deployments?** | `package.json` is frozen at `"version": "1.0.0"`. No `CHANGELOG`, no `RELEASE` file, no tags. | **PARTIAL** — the deployed commit SHA is a real and derivable identity (v1's row "what code is deployed?"), and it is the *only* one. There is no artefact that says what changed. Counts as not resolved for the second half. |
| **Q32** | **Who is authoritative for this study's own numbers?** | **Nothing.** `PROCESS_CORPUS.md` names its JSON authoritative for the corpus, and `README.md` repeats it. No file claims authority over the law table, the classifications, the kernel count, the contradiction count or the two scores. | **NO AUTHORITY** — and this is the *cause* of `X-17` … `X-23`. Carried as `X-25`. |

---

## The corrected count

```
v1 denominator                                  24
omitted questions found by the attack           + 8
                                                ────
v2 denominator                                    32

resolved with exactly one current authority
and a known lineage:
   v1's 24 rows, re-checked                       24
   of the 8 new: fully resolved                    0
                 partial (Q28, Q31)                0
                 no authority (Q26, Q27, Q29, Q30) 0
                 contested (Q25)                   0
                                                ────
                                                   24

AUTHORITY RESOLUTION  =  24 / 32  =  0.750
```

**Not 24 / 24. Not 100 %. 75 %.**

The eight new rows are not padding. Four of them (`Q26`, `Q27`, `Q29`, `Q30`) are questions any
reviewer preparing this product for real users would ask on the first day, and the repository has
no answer to any of them. One (`Q25`) is a genuine second claimant found in the tree. One (`Q32`)
is the study's own failure, and it produced seven measurable drifts.

## What this does and does not mean

**It does not mean the v1 rows were wrong.** All 24 were re-checked in this pass and all 24 still
hold: one current authority, known lineage, no unscoped competitor.

**It does mean the v1 ratio measured the wrong thing.** `24 / 24` measured *"of the questions I
chose to ask, how many have an authority"*, which is close to a tautology, because a reader
enumerating questions naturally enumerates the ones they have just found answers to. The honest
denominator is the set of questions a newcomer would ask, and it is larger.

**And it means the repository has a real, previously unnamed gap.** Four questions with no
authority at all, clustered in exactly one place: **the operational surface** — rollback,
observability, retention, supported runtimes. That cluster is not random. It is what a repository
optimised for *evidence discipline* rather than *operations* looks like, and the study's own §H
never named it because §H was derived from what the repository writes about, not from what a
newcomer would ask.
