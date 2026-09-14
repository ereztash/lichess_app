# Licensing migration runbook

What is done, what is owner-only, and what is blocked on counsel.

**This document is a snapshot, not a live tracker, and that is deliberate.** It is committed into
the public GPL line as part of the transition that freezes that line. Everything that happens
*after* the freeze is recorded in the private repository, because recording it here would mean
continuing to commit to a line this document is the act of closing. Where a step's completion falls
after the freeze, the row says so and names where the record lives.

Against the three artefacts in `GPL_CUTOFF.md`:

```text
LAST_GPL_MAIN_PRODUCT_BASELINE   = 490aed07b0ec2e2d27ab7574eacdb7673a7d5666
PUBLIC_GPL_PRODUCT_DELTA         = 78baa67ff21734be0f4785229cb246eb033c4511  (PR #123, unmerged)
FINAL_GPL_MAIN_TRANSITION_STATE  = 1789294593dee5cfcca50a06ed2e1b535b7d1870
```

---

## Status at this commit

| # | Step | State |
| --- | --- | --- |
| 1 | Freeze the GPL line for first-party product development | **in force** — §1 |
| 2 | Immutable historical boundary, all three artefacts | **recorded** — `GPL_CUTOFF.md`; marker is §1a |
| 3 | Audit the rights chain | **done** — `IP_PROVENANCE_AUDIT.md`, no unresolved ownership conflict |
| 4 | New proprietary repository | **BLOCKED — OWNER ACTION.** Repository creation returned 403 to the session; §2 |
| 5 | Explicit component licence scope | **done** — `LICENSING.md` |
| 6 | Preserve and harden Stockfish compliance apparatus | **mechanically verified**, legal sufficiency pending — §5 |
| 7 | Keep the boundary narrow and visible | **verified** — `IP_PROVENANCE_AUDIT.md` §6 |
| 8 | Narrow legal determination | **BLOCKED ON COUNSEL** — `docs/legal/COUNSEL_BRIEF.md` |
| 9 | GPL-regression gate | **done** — `GATE-LICENSE-BOUNDARY`, seven detectors each proven |
| 10 | Protect the boundary operationally | **partial** — §3 |
| 11 | Separate product changes from the migration | **held** — §4 |
| 12 | Resume development under the new default | **not reached** — gated on step 4 |

---

## 1a. The marker. OWNER ACTION if the session cannot push it.

The marker is an annotated tag on `FINAL_GPL_MAIN_TRANSITION_STATE`:

```
gpl-main-cutoff-2026-09-14
```

**The name changed, and the reason is not cosmetic.** The earlier name was
`whole-repo-gpl-cutoff-2026-09-14`, on `490aed0`, meaning *"the last whole-project GPL state"*. That
sentence is false: `claude/ui-executes-architecture` carries 2,140 lines of first-party product code
published publicly under the same GPL-era repository, after `490aed0`, and it is not on `main`. A
marker claiming to be the last GPL publication would be contradicted by a branch anybody can fetch.
`gpl-main-cutoff` claims only what is true — **the final commit on the public GPL `main` development
line** — and `GPL_CUTOFF.md` §B names the delta it does not cover.

**Owner action**, from a checkout of the merge commit:

```
git fetch origin main
git tag -a gpl-main-cutoff-2026-09-14 origin/main \
  -m "Final commit on the public GPL main development line. See docs/licensing/GPL_CUTOFF.md.
Grants made under GPL remain. PR #123 (78baa67) is a separate public GPL artefact, unmerged."
git push origin gpl-main-cutoff-2026-09-14
```

**A session may not be able to push it, and that is a scope limit rather than a fault.** The earlier
attempt returned `HTTP 403` on `git push origin <tag>` while a `--dry-run` branch push to the same
remote in the same session succeeded: the credentials carry write access to `refs/heads/*` and not
to `refs/tags/*`, and the GitHub API surface available creates branches, files, pull requests and
repositories but has no create-tag operation.

**The boundary is fixed either way, and this is worth being precise about.** The transition state is
identified by a full SHA recorded in `GPL_CUTOFF.md`, in the private repository's
`SOURCE_PROVENANCE.md`, and by the merge itself. A SHA in a committed file is not weaker evidence
than a tag; it is the same commit, named the same way. What the tag adds is **discoverability** — a
reader browsing the repository finds the boundary without knowing the document exists. That is worth
having and it is not what makes the record true.

**Failure to push a tag is not permission to continue developing product code publicly.** The freeze
in §1 is independent of it.

---

## 1. The freeze, and what it does and does not cover

From `FINAL_GPL_MAIN_TRANSITION_STATE` forward, **no new first-party product functionality is merged
into this GPL-governed line.** The freeze covers `main` and every product branch targeting it.

**What landed between `490aed0` and the transition, and why it is not a breach:** the migration
artefacts themselves — the audit, the component map, this runbook, the cutoff record, the counsel
brief, the licensing gate and its two fixtures, `CODEOWNERS`, and the register corrections the gate
forced. No product behaviour changes: no component renders differently, no derivation changes, no
route, no schema, no engine call.

**The gate script is the one item that is genuinely arguable**, and it is better to say so than to
let it pass unexamined. The freeze excepts *documentation* necessary to perform the transition, and
`scripts/license-boundary.ts` is a program, not a document. It is included because it is transition
apparatus rather than product functionality, and because a boundary with no enforcement is the
condition the migration exists to leave. If that reading is not accepted, the remedy is to carry the
file to the proprietary repository and drop it here — it is standalone and has one call site.

**PR #123 is the case the freeze exists for, and it is not merged.** 2,140 insertions of first-party
architecture→UI work, pushed publicly before the cutover. `GPL_CUTOFF.md` §B records it as
`PUBLIC_GPL_PRODUCT_DELTA`. It is closed unmerged once the private line reproduces it; its branch
and head SHA stay as evidence, and its public GPL publication is not retracted, because it happened.

Everything added here is GPL-licensed like the rest of this repository, is owned by the same holder,
and can therefore be carried into the proprietary line by that holder relicensing his own work.

---

## 2. Step 4 — the proprietary repository

**The decision is not purely an engineering one**, and that has not changed: whether to split into a
private repository, or to relicense in place and make this repository private, or to keep a public
GPL mirror alongside a private line, has commercial and legal consequences that Question 2 in the
counsel brief bears on directly. The sequence below implements the mission's chosen architecture; if
counsel's answer to Question 2 is that the works are separable, a simpler arrangement may become
available.

### Step 4 is blocked on an owner action, and it is a permission rather than a decision

Creating a repository is refused to the automation that prepared this migration:

```
POST https://api.github.com/user/repos  ->  403 Resource not accessible by integration
```

That is a missing `administration: write` permission on the GitHub App, not a transient failure and
not a policy judgement about the name. **Until the private repository exists, no first-party product
development happens anywhere** — and in particular it does not fall back to this repository, which is
the whole point of the freeze. The sequence below is what to run once it exists.

### The sequence

1. **Create the private repository.** Empty. Do not fork, and do not `git push` this history into it
   — a fork or a history import carries the GPL root `LICENSE` in as the new repository's own
   default, which is the one outcome the non-negotiable rule forbids.

2. **First commit establishes the regime, before any product code.** A proprietary `LICENSE`,
   `LICENSING.md` (carried over with §1's "historical: GPL / intended: proprietary" column collapsed
   to proprietary), `THIRD_PARTY_NOTICES.md`, the Stockfish licence material, `CODEOWNERS`,
   `scripts/license-boundary.ts` with both fixtures, and a `package.json` whose `license` field is
   **not** a copyleft identifier and which carries `"decisionLabLicenseScope": "proprietary"` — the
   field `GATE-LICENSE-BOUNDARY` check 4 keys on. Nothing else.

3. **Then migrate first-party source as a SNAPSHOT**, in a commit that changes no behaviour, with
   `SOURCE_PROVENANCE.md` recording all three public SHAs, and carrying nothing from §7 of
   `LICENSING.md` that counsel has not cleared.

4. **Then port `PUBLIC_GPL_PRODUCT_DELTA`** and re-derive its load-bearing decisions there rather
   than inheriting them, because a green pipeline on a public branch is not a review.

5. **This repository stays public and stays GPL**, as the historical line. Its root `LICENSE` is
   **not** edited: the grants it made are real and the file is the record of them. It stops being
   the development authority; it does not stop being true.

### Do not

- Do not fork, mirror or import this repository's history to seed the new one.
- Do not copy the root `LICENSE` across.
- Do not delete this repository or make it private to "clean up". Recipients hold GPL rights in what
  they already have; removing the public copy does not revoke them and does look like an attempt to.
- Do not carry `scripts/sf-wasm.mjs` into proprietary directories (`LICENSING.md` §6).

---

## 3. Step 10 — what is protected, and what is not

**Done:** `.github/CODEOWNERS` names an owner for every file that holds the boundary — the licence
documents, both package manifests, the Stockfish bridge and harness, the served licence texts, and
the gate with its fixtures.

**Not done in this tree, and it is the half with teeth:** CODEOWNERS is **inert without a branch
protection rule**, and branch protection lives in repository settings rather than in a file. Review
is routed, not required. This is not a new observation — `TARGET_2_AUTHORITY_CLOSURE.md` `Q34` made
exactly this point before `CODEOWNERS` existed, and adding the file turned that record stale and
reddened `GATE-AUTHORITY-RESOLVED`. It is recorded as `PARTIAL_AUTHORITY` rather than resolved,
which is the honest state.

**Owner action:** on each repository, protect the default branch and require review from code
owners. On this one, that protection is also the freeze's enforcement: see §3a.

### 3a. Freezing the public line operationally

A freeze stated in a document is a convention. These make it mechanical, and each is a repository
setting rather than a file, so each is owner action:

| Control | Effect |
| --- | --- |
| Branch protection on `main`, no direct pushes | a product commit cannot bypass review |
| Require the `Verify` status check | a stale product PR cannot merge green-by-omission |
| Require review from code owners | `CODEOWNERS` stops being advisory |
| Restrict who may merge | the freeze survives a moment of convenience |
| Close, do not merge, open product PRs | #123 and #112 do not drift back into the line |

**Do not archive the repository** without checking first: archiving makes it read-only, which would
break anything currently depending on it — the deployment, and any downstream fetching a ref. The
freeze is about *first-party product development*, not about taking the public record away.

**Inbound rights — the item with the longest tail.** The rights chain in `IP_PROVENANCE_AUDIT.md`
§3.2 is clean *because no external contribution has ever been accepted*. The first one changes that
permanently and cannot be undone retroactively: a contributor who did not sign an inbound agreement
holds copyright in their contribution, and relicensing it later needs their consent. Establish a CLA
or equivalent, approved by counsel, **before** accepting any material external contribution.

---

## 4. Step 11 — behaviour neutrality

No product behaviour was changed. The changes are: five documents, one gate predicate and its
registration, two control fixtures, `CODEOWNERS`, a hardened notices table, and the register
corrections the gate demanded. No component, derivation, route, schema or engine call was touched.
`npm run verify` is the check, and the migration is not merged unless it is green.

Do not combine this cutover with the architecture→UI migration, FIELD changes, redesign, new chess
functionality or engine changes.

---

## 5. Stockfish: two statuses, not one

Conflating these is the commonest way an engineering artefact gets quoted as a legal conclusion, so
they are kept apart by name:

```text
STOCKFISH_COMPLIANCE_APPARATUS:  MECHANICALLY_VERIFIED
LEGAL_SUFFICIENCY:               PENDING_COUNSEL
```

**What `MECHANICALLY_VERIFIED` covers**, and every item is a measurement in this repository:

- the licence text is present and served at `/licenses/stockfish/COPYING.txt`;
- `THIRD_PARTY_NOTICES.md` names the component, holder, version and licence;
- the distributed `.js` and `.wasm` are **hash-identical** to the published package contents;
- `GATE-LICENSE-BOUNDARY` fails if the pinned version and the recorded version diverge, and that
  detector is proven by its own fixture;
- the bridge emits a chunk containing **zero** engine linkage markers, against a detector proven
  live by finding 49 in the `.wasm`.

**What `PENDING_COUNSEL` covers**, and none of it is answerable by measurement:

- whether a repository URL plus a version tag discharges GPL §6's *corresponding source* obligation,
  or whether a pinned upstream commit is required;
- whether the Worker/UCI boundary makes `client/src/lib/stockfish.ts` an independent work or a
  derivative of Stockfish (Question 4);
- whether the arrangement as a whole permits proprietary licensing of the surrounding application
  (Question 2).

**Nothing in this repository may say Stockfish compliance is legally validated.** It says the
apparatus is present and measured. Those are different sentences and only the second is earned.

---

## 6. What blocks external proprietary distribution

Two items, both resolvable, neither requiring code changes:

1. **Counsel's answers to Questions 2, 3 and 4.** Until then the proprietary distribution model is a
   design, not a determination, and must not be represented as validated.
2. **Lichess dataset terms** (`IP_PROVENANCE_AUDIT.md` §5, `LICENSING.md` §7). Retrieve the current
   terms for `lichess_db_standard_rated_2026-03.pgn.zst` and `lichess_db_puzzle.csv.zst` from
   `database.lichess.org`, record them with the retrieval date, and re-classify if they are not a
   public-domain dedication or a permissive licence. This one is discharged without anybody's help
   and should be done first because it is the cheapest.

Private development under a proprietary default may proceed while both are open.

---

## 7. Success condition, one denominator

**Every condition is a visible row.** The previous revision scored *"six of ten"* over a table whose
visible rows implied seven, while the prose named four outstanding items — the tag push, branch
protection, the private repository and counsel — of which only two had rows at all. A denominator
assembled partly from a table and partly from a sentence is not a score, it is an impression.

State at this commit. `owner` means it needs a repository setting or a decision no session can take.

| # | Condition | State | Whose |
| --- | --- | --- | --- |
| 1 | An exact commit identifies the last GPL **product baseline** on `main` | **met** — `GPL_CUTOFF.md` §A | — |
| 2 | The public GPL **product delta** outside `main` is recorded, not hidden | **met** — §B, PR #123 head | — |
| 3 | The final public-GPL transition commit is identified | **met** — `17892945`, recorded in `GPL_CUTOFF.md` §C | — |
| 4 | A discoverable marker exists on the transition commit | **not met** — tag created, push returned 403; the branch dry-run to the same remote succeeded, so it is scope | owner |
| 5 | Historical GPL rights not falsely revoked | **met** — asserted nowhere, denied explicitly | — |
| 6 | Rights chain carries no unresolved material ownership conflict | **met**, two conditions recorded | — |
| 7 | A CI gate prevents GPL-scope regression | **met** — seven detectors, each proven individually | — |
| 8 | The gate covers every first-party source family the map claims | **met** — `client/src`, `server`, `shared`, `scripts`, `tests` | — |
| 9 | No product behaviour changed to perform the cutover | **met** — §4 | — |
| 10 | Stockfish compliance **apparatus** present and measured | **met** — §5 | — |
| 11 | Stockfish **legal sufficiency** determined | **not met** | counsel |
| 12 | The proprietary/engine interface is identifiable and auditable | **met** — `LICENSING.md` §5 | — |
| 13 | Weak-copyleft dependencies classified by a person, not by a string search | **met** — `LICENSING.md` §1a | — |
| 14 | Public `main` frozen **mechanically**, not by convention | **not met** — stated at repository level in `README.md`; branch protection is a setting, and a notice is not a mechanism | owner |
| 15 | Open public product PRs cannot drift back into the frozen line | **pending** — closed once the private line reproduces them | — |
| 16 | A private repository exists with a proprietary default | **after the freeze** — recorded in that repository | — |
| 17 | The proprietary codebase has an explicit first-party licence | **after the freeze** — same | — |
| 18 | New first-party code no longer enters a GPL-defaulted repository | **after the freeze** — same | — |
| 19 | Lichess dataset terms verified from primary sources | **not met** | owner |
| 20 | External proprietary distribution cleared | **not met** — §6 | counsel |

**Met: 11 of 20.** The other nine, counted so the four states add up to the denominator rather
than being summarised into one:

| State | Count | Rows |
| --- | --- | --- |
| met | 11 | 1, 2, 3, 5, 6, 7, 8, 9, 10, 12, 13 |
| not met | 5 | 4, 11, 14, 19, 20 |
| pending, and resolves without a decision | 1 | 15 (follows the private line) |
| after the freeze, recorded elsewhere | 3 | 16, 17, 18 |

Rows 16 to 18 are not scored *met* or *not met* because their evidence lives in a repository this
document cannot cite without continuing to write to the line it closes. Counting them as met would
be a claim this file cannot support; counting them as failures would be false. They are named, and
their record is named.

Of the five not met: three are owner actions (4 the marker, 14 branch protection, 19 the dataset
terms) and two are counsel's (11, 20). **Not one of the five is blocked on engineering in this
repository.**
