# Licensing migration runbook

What is done, what is owner-only, and what is blocked on counsel. Against
`490aed07b0ec2e2d27ab7574eacdb7673a7d5666`.

**The migration is not complete.** This runbook exists so that what remains is a list rather than
an impression.

---

## Status

| # | Step | State |
| --- | --- | --- |
| 1 | Freeze the GPL line | **in force** — see §1 |
| 2 | Immutable historical boundary | **recorded in tree; tag created locally, PUSH BLOCKED** — §1a |
| 3 | Audit the rights chain | **done** — `IP_PROVENANCE_AUDIT.md`, no unresolved ownership conflict |
| 4 | New proprietary repository | **OWNER ONLY — not started** — §2 |
| 5 | Explicit component licence scope | **done** — `LICENSING.md` |
| 6 | Preserve and harden Stockfish compliance | **done**, one open item — `THIRD_PARTY_NOTICES.md` |
| 7 | Keep the boundary narrow and visible | **verified** — `IP_PROVENANCE_AUDIT.md` §6 |
| 8 | Narrow legal determination | **BLOCKED ON COUNSEL** — `docs/legal/COUNSEL_BRIEF.md` |
| 9 | GPL-regression gate | **done** — `GATE-LICENSE-BOUNDARY`, control red |
| 10 | Protect the boundary operationally | **half done** — §3 |
| 11 | Separate product changes from the migration | **held** — §4 |
| 12 | Resume development under the new default | **not reached** — gated on step 4 |

---

## 1a. The tag: created, not pushed. OWNER ACTION.

The annotated tag exists locally and **could not be pushed from the session that created it**:

```
git push origin whole-repo-gpl-cutoff-2026-09-14
  → error: RPC failed; HTTP 403
```

This is a credential scope limit, not a transient failure and not a proxy fault: a `--dry-run`
branch push to the same remote in the same session succeeded. The credentials carry write access to
`refs/heads/*` and not to `refs/tags/*`, and the GitHub API surface available to that session
creates branches, files, pull requests and repositories but has no create-tag operation. There is no
workaround from inside; reporting it is the correct outcome.

**Owner action**, from a checkout of `490aed0`:

```
git tag -a whole-repo-gpl-cutoff-2026-09-14 490aed07b0ec2e2d27ab7574eacdb7673a7d5666 \
  -m "Last whole-project GPL state. See docs/licensing/GPL_CUTOFF.md. Grants made under GPL remain."
git push origin whole-repo-gpl-cutoff-2026-09-14
```

**The boundary is fixed in the meantime, and this is worth being precise about.** The cutoff is
identified by a full SHA recorded in `docs/licensing/GPL_CUTOFF.md`, committed to this repository
and reachable from its history. A SHA in a committed file is not weaker evidence than a tag; it is
the same commit, named the same way. What the tag adds is **discoverability** — a reader browsing
the repository finds the boundary without knowing the document exists. That is worth having and it
is not what makes the record true.

---

## 1. The freeze, and what it does and does not cover

From `490aed0` forward, no new first-party **product functionality** is merged into this
GPL-governed line. That freeze is in force now.

**What landed after the cutoff in this repository, and why it is not a breach:** the migration
artefacts themselves — the audit, the component map, this runbook, the cutoff record, the counsel
brief, the licensing gate and its fixture, `CODEOWNERS`, and the two register corrections the gate
forced. No product behaviour changes: no component renders differently, no derivation changes, no
route, no schema, no engine call.

**The gate script is the one item that is genuinely arguable**, and it is better to say so than to
let it pass unexamined. The freeze excepts *documentation* necessary to perform the transition, and
`scripts/license-boundary.ts` is a program, not a document. It is included because it is transition
apparatus rather than product functionality, and because a boundary with no enforcement is the
condition the migration exists to leave. If that reading is not accepted, the remedy is to carry
the file to the proprietary repository and drop it here — it is standalone and has one call site.

Everything added here is GPL-licensed like the rest of this repository, is owned by the same
holder, and can therefore be carried into the proprietary line by that holder relicensing his own
work. `docs/licensing/GPL_CUTOFF.md` says this in the same terms.

---

## 2. Step 4 — the proprietary repository. OWNER ONLY.

**Not done, and not doable from here.** This session's GitHub access is scoped to
`ereztash/lichess_app`. Creating a repository is also a structural decision with consequences that
outlast the migration, and it should be made deliberately rather than as a side effect.

More than that: **the decision itself is not an engineering one.** Whether to split into a private
repository, or to relicense in place and make this repository private, or to keep a public GPL
mirror alongside a private line, has commercial and legal consequences that Question 2 in the
counsel brief bears on directly. The runbook below assumes the mission's preferred architecture; if
counsel's answer to Question 2 is that the works are separable, a simpler arrangement may be
available.

### The sequence, when it is taken

1. **Push the cutoff tag first** — see §1a for the commands and why it is outstanding. Never move
   or delete it once pushed. A later change adds a new marker; it does not edit this one.

2. **Create the private repository.** Empty. Do not fork, and do not `git push` this history into
   it — a fork or a history import carries the GPL root `LICENSE` in as the new repository's own
   default, which is the one outcome the non-negotiable rule forbids.

3. **First commit establishes the regime, before any product code.** It contains a proprietary
   `LICENSE`, `LICENSING.md` (carried over and with §1's "historical: GPL / intended: proprietary"
   column collapsed to proprietary), `THIRD_PARTY_NOTICES.md`, the Stockfish licence material,
   `CODEOWNERS`, `scripts/license-boundary.ts` with its fixture, and a `package.json` whose
   `license` field is **not** a copyleft identifier and which carries
   `"decisionLabLicenseScope": "proprietary"` — the field `GATE-LICENSE-BOUNDARY` check 3 keys on.
   Nothing else.

4. **Then migrate first-party source**, in a commit that changes no behaviour, carrying nothing
   from §5 of `LICENSING.md` that counsel has not cleared.

5. **This repository stays public and stays GPL**, as the historical line. Its root `LICENSE` is
   **not** edited: the grants it made are real and the file is the record of them. It stops being
   the development authority; it does not stop being true.

### Do not

- Do not fork, mirror or import this repository's history to seed the new one.
- Do not copy the root `LICENSE` across.
- Do not delete this repository or make it private to "clean up". Recipients hold GPL rights in
  what they already have; removing the public copy does not revoke them and does look like an
  attempt to.
- Do not carry `scripts/sf-wasm.mjs` into proprietary directories (`LICENSING.md` §6).

---

## 3. Step 10 — what is protected, and what is not

**Done:** `.github/CODEOWNERS` names an owner for every file that holds the boundary — the licence
documents, both package manifests, the Stockfish bridge and harness, the served licence texts, and
the gate with its fixture.

**Not done, and it is the half that has teeth:** CODEOWNERS is **inert without a branch protection
rule**, and branch protection lives in repository settings rather than in this tree. Review is
routed, not required. This is not a new observation — `TARGET_2_AUTHORITY_CLOSURE.md` `Q34` made
exactly this point before `CODEOWNERS` existed, and adding the file turned that record stale and
reddened `GATE-AUTHORITY-RESOLVED`. It is now recorded as `PARTIAL_AUTHORITY` rather than resolved,
which is the honest state.

**Owner action:** on each repository, protect the default branch and require review from code
owners. Until then the boundary is held by a convention.

**Inbound rights — the item with the longest tail.** The rights chain in `IP_PROVENANCE_AUDIT.md`
§3.2 is clean *because no external contribution has ever been accepted*. The first one changes that
permanently and cannot be undone retroactively: a contributor who did not sign an inbound agreement
holds copyright in their contribution, and relicensing it later needs their consent. Establish a
CLA or equivalent, approved by counsel, **before** accepting any material external contribution.

---

## 4. Step 11 — behaviour neutrality

No product behaviour was changed. The changes are: five new documents, one gate predicate and its
registration, one control fixture, `CODEOWNERS`, a hardened notices table, and two register
corrections the gate demanded. No component, derivation, route, schema or engine call was touched.
`npm run verify` is the check, and the migration is not merged unless it is green.

Do not combine this cutover with the architecture→UI migration, FIELD changes, redesign, new chess
functionality or engine changes.

---

## 5. What blocks external proprietary distribution

Two items, both resolvable, neither requiring code changes:

1. **Counsel's answers to Questions 2, 3 and 4.** Until then the proprietary distribution model is
   a design, not a determination, and must not be represented as validated.
2. **Lichess dataset terms** (`IP_PROVENANCE_AUDIT.md` §5, `LICENSING.md` §7). Retrieve the current
   terms for `lichess_db_standard_rated_2026-03.pgn.zst` and `lichess_db_puzzle.csv.zst` from
   `database.lichess.org`, record them with the retrieval date, and re-classify if they are not a
   public-domain dedication or a permissive licence. This one is discharged without anybody's help
   and should be done first because it is the cheapest.

Private development under a proprietary default may proceed while both are open.

---

## 6. Success condition, scored honestly

| Condition | State |
| --- | --- |
| New first-party code no longer under a whole-repository GPL notice | **not yet** — needs step 4 |
| An exact commit identifies the last whole-project GPL state | **done** in `GPL_CUTOFF.md`; tag push outstanding (§1a) |
| Historical GPL rights not falsely revoked | **done** — asserted nowhere, denied explicitly |
| The proprietary codebase has an explicit first-party licence | **not yet** — needs step 4 |
| Stockfish remains explicitly GPL and compliant | **done** |
| The interface between proprietary code and Stockfish is identifiable and auditable | **done** |
| No unresolved material ownership conflict in the rights chain | **done**, two conditions recorded |
| A CI gate prevents accidental GPL-scope regression | **done**, control red |
| No product behaviour changed to perform the cutover | **done** |
| Legal uncertainty reduced to a concrete reviewed determination | **not yet** — brief written, not answered |

**Six of ten.** The four outstanding are step 4 (owner), the tag push (owner), branch protection
(owner) and counsel's determination. None is blocked on engineering.
