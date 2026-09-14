# Licensing scope

**This file is the canonical statement of what is licensed how.** Where any other file in this
repository appears to describe "the repository as a whole" as being under a single licence, this
file governs, component by component.

**Status of this revision.** As of `490aed07b0ec2e2d27ab7574eacdb7673a7d5666` the root `LICENSE`
places this repository under GPL-3.0-or-later, and **that has not changed and is not changed by
this file.** This repository is the historical GPL line. This file exists to make the component
boundary explicit *before* the proprietary line is created elsewhere, so that the boundary is
auditable rather than asserted. The migration itself is described in
`docs/licensing/MIGRATION_RUNBOOK.md`.

Read together with:

- `IP_PROVENANCE_AUDIT.md` — the rights chain, and what blocks what
- `THIRD_PARTY_NOTICES.md` — the notices that travel with a distribution
- `docs/licensing/GPL_CUTOFF.md` — the immutable historical boundary
- `docs/legal/COUNSEL_BRIEF.md` — the four questions not answered here

---

## 1. The component map

| Component | Paths | Copyright holder | Licence | Provenance | Boundary |
| --- | --- | --- | --- | --- | --- |
| Decision Lab application | `client/src/**` except §2 | Erez Tash | **historical: GPL-3.0-or-later · intended post-cutoff: proprietary** | first-party | may not contain copyleft source |
| Decision Lab domain and research logic | `shared/**` except §3 | Erez Tash | same | first-party | same |
| Decision Lab server | `server/**` | Erez Tash | same | first-party | does not execute Stockfish |
| Build, gate and research tooling | `scripts/**` except `sf-wasm.mjs` | Erez Tash | same | first-party | same |
| Tests | `tests/**` | Erez Tash | same | first-party | same |
| Documentation and research corpus | `docs/**`, `research/**` | Erez Tash | same | first-party | — |
| **Stockfish Worker bridge** | `client/src/lib/stockfish.ts` | Erez Tash | **first-party. Proprietary intent, subject to Question 4** | first-party, written against the UCI protocol | §5 |
| **Stockfish engine** | `node_modules/stockfish/**`, `dist/public/assets/stockfish-18-lite-single.*` | The Stockfish developers | **GPL-3.0-or-later** | npm `stockfish@18.0.8`, unmodified | §4 |
| **Stockfish stdio harness** | `scripts/sf-wasm.mjs` | Erez Tash | **GPL scope — see §6** | first-party, but loads the engine in-process | §6 |
| Stockfish licence text | `client/public/licenses/stockfish/COPYING.txt` | FSF (text) | GPL-3.0 text, conveyed verbatim | upstream | must not be removed |
| Generated datasets | `shared/anchor-set.ts`, `anchor-moves.ts`, `opening-book-keys.ts`, `opening-book-provenance.ts`, `phase-difficulty.ts`, `population-baseline.ts`, `sensitivity-reference.ts` | Erez Tash (the derivation) | proprietary intent, **conditional on §7** | generated from Lichess open databases | §7 |
| Fonts | `client/public/fonts/**` | respective foundries | SIL OFL 1.1 | vendored font files | notice only |
| Other third-party packages | `node_modules/**` | respective holders | MIT, BSD-2-Clause, Apache-2.0, ISC, Unlicense | npm | notice only |

**Nothing in this table describes "the repository as a whole".** That phrasing is what the
migration exists to remove, and reintroducing it is what `GATE-LICENSE-BOUNDARY` fails on.

---

## 2. What "proprietary intent" means, and what it does not

It means: **from the cutoff forward, new first-party code is authored under a proprietary default**,
in the repository described by the runbook, and is not offered under the GPL.

It does **not** mean:

- that anything already distributed under GPL-3.0-or-later stops being available under those terms.
  It does not. Those grants are perpetual and irrevocable, every recipient keeps them, and every
  fork taken under them remains lawful. `docs/licensing/GPL_CUTOFF.md` fixes the revision so this
  stays checkable rather than remembered.
- that the proprietary distribution model has been legally validated. It has not.
  `docs/legal/COUNSEL_BRIEF.md` Questions 2 and 4 are open, and until they are answered this
  boundary is a *design*, not a determination.

---

## 3. The permitted boundary, stated as rules

These are the rules `GATE-LICENSE-BOUNDARY` enforces. Each is a rule a future change could break by
accident, which is why it is mechanical rather than advisory.

1. **No copyleft source in proprietary directories.** No file under `client/src`, `server`,
   `shared`, or `scripts` may carry a GPL, AGPL, LGPL, SSPL, MPL, EPL or CDDL notice, except the
   paths this file allowlists in §6.
2. **No new copyleft dependency.** `stockfish` is the only copyleft package permitted in the
   resolved production tree. A second one is a boundary change and must be a decision, not a
   `npm install`.
3. **No whole-repository licence claim.** No root file and no package manifest may describe the
   product as a whole as GPL-licensed once the proprietary line exists.
4. **Stockfish compliance material may not be deleted.** The licence text, the notices, and the
   version and corresponding-source record must be present.
5. **A Stockfish version change invalidates the compliance record.** Changing the pinned version
   without updating the hashes and provenance in `THIRD_PARTY_NOTICES.md` fails.
6. **This file must exist.** Removing the component map restores the ambiguity the map replaced.

---

## 4. Stockfish: what is owed and how it is met

Decision Lab **conveys** Stockfish: the engine ships in the build and is served from the
deployment. That triggers obligations, and they are met as follows.

| GPL-3.0 clause | Obligation | How it is met |
| --- | --- | --- |
| §4 — verbatim conveyance | keep the licence and notices intact, give recipients a copy of the licence | `COPYING.txt` served at `/licenses/stockfish/COPYING.txt`; `THIRD_PARTY_NOTICES.md` names the component, holder, version and licence |
| §6 — corresponding source | offer the source of conveyed object code | public upstream repository at the matching version, at no charge |
| §5 — modified works | publish modifications under the GPL | **not engaged**: nothing is modified |

**§5 is not engaged, and that is verified rather than assumed.** The distributed `.js` and `.wasm`
are byte-identical to the published package contents. SHA-256 for both, and the package integrity
hash, are recorded in `IP_PROVENANCE_AUDIT.md` §6.3 and in `THIRD_PARTY_NOTICES.md`.

**Open item, and it is a real weakness in the current record.** The corresponding-source pointer is
a *repository URL*, not a pinned commit. GPL §6 asks for the source *corresponding to* the object
code conveyed. A repository URL plus a version tag is the ordinary practice and is very likely
sufficient; an exact upstream commit plus the build relationship between that commit and these two
artifact hashes would be materially stronger. Tightening it is recommendation 4 of the audit.

**If Stockfish is ever modified**, the modifications belong to Stockfish, remain GPL-3.0-or-later,
and must be published as the licence requires. There is no version of this migration in which a
modified engine becomes proprietary.

---

## 5. The bridge, and why it is named separately

`client/src/lib/stockfish.ts` is first-party code that starts a Web Worker and exchanges UCI
strings with it. It is listed as its own component because it is the **only** first-party file
whose licence status depends on a question this repository cannot answer for itself.

What is mechanically true about it (`IP_PROVENANCE_AUDIT.md` §6):

- it imports the engine as a **URL string** via Vite's `?url`, not as a module;
- it emits a 3,974-byte chunk containing **zero** engine linkage markers, against a detector proven
  live by finding 49 in the `.wasm`;
- it communicates only by `postMessage` with UCI text, across a Worker's separate global scope;
- it contains no Stockfish algorithm, no transcribed Stockfish source, and no Stockfish header.

What is **not** established: whether those facts make it an independent work that communicates with
Stockfish, or a derivative of it. That is Question 4 for counsel. Until it is answered the bridge
is marked proprietary-intent **subject to that question**, and a determination that it is
derivative would move this one file to the GPL side without disturbing anything else — which is the
entire point of naming it separately rather than folding it into the application.

---

## 6. `scripts/sf-wasm.mjs` — first-party code held on the GPL side

This file calls `require("stockfish")` and drives the engine **in-process**. That is a different
relationship from the Worker boundary, and this file is the only first-party code in the repository
that has it.

It is a research harness wrapper, it is not distributed, and it is absent from `dist/`. It is
nonetheless placed on the **GPL side** of the boundary and allowlisted in the gate, so that moving
it — or code like it — into a proprietary directory fails the build.

This is a deliberately conservative placement. Holding one non-distributed script on the GPL side
costs nothing; discovering later that in-process engine linkage had drifted into proprietary
directories would cost a great deal.

---

## 7. Generated datasets — conditional

The seven generated `shared/` modules derive from two Lichess open databases. What is committed is
derived aggregate data — position-frequency hashes and sampled position identifiers — not the
source games or puzzle text.

**Condition, and it must be discharged before proprietary distribution:** the upstream terms of
`lichess_db_standard_rated_2026-03.pgn.zst` and `lichess_db_puzzle.csv.zst` have **not been
verified from primary sources** by the audit. Retrieve the current terms, record them and the
retrieval date here, and re-classify if they are not a public-domain dedication or a permissive
licence.

No Lichess **software** is present in this repository. Lichess's own codebase is AGPL-3.0 and none
of it is here; `package.json` names no Lichess package. The runtime integration calls a public HTTP
API, which is use of a service and not incorporation of code.

---

## 8. Changing this file

This file, `THIRD_PARTY_NOTICES.md`, the root `LICENSE`, the `license` field of `package.json`, the
Stockfish preparation paths and the Worker boundary are owned under `.github/CODEOWNERS`. A change
to any of them is a licensing change and is reviewed as one.

External contributions must not silently acquire power over future relicensing. **Before accepting
any material external contribution**, an inbound-rights mechanism — a CLA or equivalent, approved
by counsel — must be in place. The rights chain in `IP_PROVENANCE_AUDIT.md` §3.2 is clean today
precisely because no external contribution has ever been accepted; the first one changes that
permanently and cannot be undone retroactively.
