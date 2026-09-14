# IP provenance audit

**Audited revision:** `490aed07b0ec2e2d27ab7574eacdb7673a7d5666` (`main`, 2026-09-14), recorded in
`docs/licensing/GPL_CUTOFF.md` as `LAST_GPL_MAIN_PRODUCT_BASELINE`. Two further public GPL artefacts
exist and are **not** covered by this revision: `PUBLIC_GPL_PRODUCT_DELTA` (`78baa67`, PR #123,
first-party product code published publicly and unmerged) and `FINAL_GPL_MAIN_TRANSITION_STATE` (the
merge of PR #122, unknown until it happens). §B of the cutoff record is why one SHA is no longer a
sufficient description of the public GPL line.
**Purpose:** establish whether the rights chain over Decision Lab first-party source is clean
enough to relicense it under proprietary terms, and to identify every component that is not
first-party and therefore cannot be relicensed.

**This document is engineering evidence, not a legal opinion.** It records what the repository
contains and where each part came from. Whether those facts permit proprietary distribution is the
question put to counsel in `docs/legal/COUNSEL_BRIEF.md`, and it is not answered here.

---

## 0. Classification scheme

| Class | Meaning | Effect on relicensing |
| --- | --- | --- |
| `FIRST-PARTY` | authored for this repository, no external provenance | relicensable by the copyright holder |
| `PERMISSIVE-3P` | third-party, permissive licence, not copyleft | usable under proprietary distribution, notice obligations only |
| `COPYLEFT-3P` | third-party, copyleft licence | **cannot** be relicensed; must stay in its own scope |
| `GENERATED` | produced by a committed generator from a named source | class follows the source and the generator |
| `UNCERTAIN` | provenance cannot be demonstrated from the tree | **blocks proprietary distribution** until resolved |

The rule this audit is held to: an `UNCERTAIN` item blocks proprietary distribution until it is
resolved, replaced, or isolated. Nothing is promoted out of `UNCERTAIN` by plausibility.

---

## 1. Result

| Class | Count | Blocks distribution |
| --- | --- | --- |
| `FIRST-PARTY` | 5 source families (~134,600 lines), 203 docs | no |
| `PERMISSIVE-3P` | 27 production packages + 2 font families | no |
| `COPYLEFT-3P` | **strong:** 1 package (Stockfish). **weak, file-level:** 13 packages (`axe-core` and 12 `lightningcss` builds, all MPL-2.0), classified in `LICENSING.md` §1a | Stockfish: yes, by design — it stays GPL. Weak: no, subject to §4.2 |
| `GENERATED` | 7 modules from 2 upstream datasets | no, subject to §5 |
| `UNCERTAIN` | **0 source families** | — |

**No unresolved material ownership conflict was found in first-party source.**

Two items are `RESOLVED-WITH-CONDITION` rather than simply clean, and both are recorded in full
below because a conditional pass that is not written down is an `UNCERTAIN` in disguise:

- **§3.2 — AI-authored commits.** 256 of 444 commits are authored `Claude <noreply@anthropic.com>`.
  Ownership of the output is a contractual question, and *copyrightability* of AI-generated
  material is an open question in some jurisdictions. Neither blocks proprietary licensing; both
  are material to how strong the resulting copyright claim is. Question 1 in the counsel brief.
- **§5 — Lichess-derived datasets.** Two generated modules derive from `database.lichess.org`.
  The upstream terms are stated by the publisher and have **not been verified from primary sources
  by this audit**. Verify before proprietary distribution.

---

## 2. Method, and what it cannot see

Evidence used: the git history of this repository, `package-lock.json` (the resolved tree, not the
declared ranges), the built artifacts in `dist/`, the committed generator scripts, and a header
scan of every first-party source file.

**What this method cannot establish**, stated so it is not mistaken for a clean bill:

- It cannot prove a *negative* about copying. A snippet retyped from an external source with no
  header, no comment and no distinctive formatting is invisible to a header scan. What the scan
  can say is that nothing in the tree *claims* foreign copyright, which is a weaker statement.
- **GitHub contributor history is evidence of authorship, not proof of copyright ownership.**
  It records who pushed a commit. It does not record employment status, contractor agreements,
  prior assignments, or work done under another party's terms. §3 uses it as evidence and says so.
- It cannot see rights granted or encumbered outside the repository.

---

## 3. First-party source and the rights chain

### 3.1 The source families

| Family | Files | Lines | Class |
| --- | --- | --- | --- |
| `client/src` | 127 | 25,451 | `FIRST-PARTY` |
| `shared` | 98 | 22,902 | `FIRST-PARTY` (7 modules `GENERATED`, see §5) |
| `server` | 19 | 3,544 | `FIRST-PARTY` |
| `scripts` | 44 | 12,711 | `FIRST-PARTY` (one boundary note, see §4.3) |
| `tests` | 409 | 69,958 | `FIRST-PARTY` |
| `docs` | 203 | — | `FIRST-PARTY` |

Header scan over `client/src`, `server`, `shared`, `scripts` for `Copyright (c)`,
`SPDX-License-Identifier`, `@license` and `Licensed under`, excluding Decision Lab's own:
**zero matches.** No first-party file asserts foreign copyright or a foreign licence.

Vendored-code scan: no `vendor/`, `vendored/`, `third_party/` or `third-party/` directory exists
under any first-party path. No `*.min.js` or `*.bundle.js` is committed to source. Third-party code
enters this repository **only** through `package.json`, which is what makes §4's inventory complete
rather than indicative.

### 3.2 Who holds the copyright

All-time commit authorship, 444 commits:

| Author identity | Commits | Reading |
| --- | --- | --- |
| `Claude <noreply@anthropic.com>` | 256 | AI-authored through Claude Code, on Erez Tash's account |
| `ereztash <erez2812345@gmail.com>` | 122 | Erez Tash |
| `Erez <Erez2812345@gmail.com>` | 46 | Erez Tash — same address, different display name |
| `Erez Tal-Shir <erez2812345@gmail.com>` | 18 | Erez Tash — same address, different display name |
| `dependabot[bot]` | 2 | mechanical dependency version bumps |

**The single most important finding of this audit: there is no third-party human contributor.**
Three of the five identities resolve to one address, `erez2812345@gmail.com`. The remaining two are
an AI coding tool operating on that account and a dependency bot. No outside party's consent is
needed to relicense first-party source, because no outside party contributed any.

`dependabot[bot]`'s two commits are version-number edits to dependency manifests. They carry no
creative authorship and are treated as de minimis.

**The AI-authored commits are the condition on this finding, and they are a real one.** 256 of 444
commits, and by line count the majority of the tree, were authored by Claude. Two distinct
questions follow, and they have different answers:

1. *Who owns the output?* A contractual question, governed by the terms under which the tool was
   used. Under Anthropic's commercial terms the customer owns outputs. This audit records the
   question; it does not interpret the contract.
2. *Is the output copyrightable at all?* An open question. Some jurisdictions — the United States
   among them — require human authorship for copyright to subsist, and material generated without
   sufficient human authorship may fall outside copyright entirely.

Neither question blocks the migration, and the reason is worth stating plainly: **proprietary
distribution does not require a copyright claim to succeed.** Source that is not published cannot
be copied from, and distribution can be governed by contract regardless of what copyright does or
does not subsist. What question 2 affects is the *strength of the remedy* if someone copies
published code — which is a commercial risk to weigh, not a compliance blocker. It is Question 1 in
the counsel brief for that reason.

### 3.3 What has already been granted, and is not being taken back

This repository is public and has been licensed GPL-3.0-or-later at the root. Every copy already
distributed under those terms **remains licensed under them, permanently and irrevocably.** Anyone
who received a copy may use, modify, fork and redistribute it under the GPL. That is not a defect
of the migration; it is the correct and honest outcome, and no part of this work attempts to
narrow it.

The migration is prospective only. It governs first-party code written *after* the transition. All
three public GPL artefacts are recorded by SHA in `docs/licensing/GPL_CUTOFF.md`, including the
product delta published on a branch that was never merged — because a record that named only `main`
would have been quietly incomplete on exactly the point that matters. A discoverable marker on the
transition commit is owner action and is **not** in place; the SHAs do not depend on it.

---

## 4. Third-party components

### 4.1 Production dependencies

Resolved from `package-lock.json`. 28 production packages; **27 permissive, 1 copyleft.**

| Licence | Packages |
| --- | --- |
| MIT | `@radix-ui/react-slot`, `@tailwindcss/vite`, `@tanstack/react-query`, `@trpc/client`, `@trpc/react-query`, `@trpc/server`, `@vitejs/plugin-react`, `clsx`, `cookie`, `express`, `jose`, `mysql2`, `react`, `react-dom`, `recharts`, `superjson`, `tailwind-merge`, `tailwindcss`, `tw-animate-css`, `vite`, `zod` |
| BSD-2-Clause | `chess.js@1.4.0` |
| Apache-2.0 | `class-variance-authority`, `drizzle-orm` |
| ISC | `lucide-react` |
| Unlicense | `wouter` |
| **GPL-3.0** | **`stockfish@18.0.8`** |

A scan of the **entire** resolved tree — every transitive package, not only direct dependencies —
for `GPL`, `AGPL`, `LGPL` and `SSPL` returns exactly one result: `stockfish@18.0.8`.

This is the finding that makes the migration tractable. The copyleft surface of this product is
**one package**, it is an engine behind a message-passing boundary, and it is the one component
nobody proposes to relicense.

### 4.2 Weak-copyleft packages — thirteen, not one, and absence was never measured

The first revision of this section said *"one weak-copyleft item"*. The resolved tree carries
**thirteen**: `axe-core@4.13.0` and twelve `lightningcss` entries — the CSS transform plus its
eleven optional native platform builds — all MPL-2.0. Only `axe-core` is flagged `dev` in the
lockfile; all twelve `lightningcss` entries are not. A reading that filtered on that flag therefore
saw one package and reported one.

MPL-2.0 is file-level copyleft: it reaches modified MPL-covered *files* and does not propagate to
code that merely uses the library (§3.3 of the licence permits a Larger Work under other terms).

**What was NOT established, and was previously implied.** The gate decided these packages were not
conveyed by searching emitted chunks for their npm package names and treating absence of the string
as evidence of absence of the code. A bundler makes no undertaking to preserve package-name strings.
That mechanism is now labelled `DRIFT_HEURISTIC`, is positive-evidence-only, and permits nothing.

What replaces it is a classification in `LICENSING.md` §1a that a person wrote: for each package, the
claim is that **no first-party module imports it and its role is to transform build input**, which is
checkable by reading `client/src/**`. That is a weaker claim than bundle provenance and is written
as the weaker claim on purpose. Not a constraint on distribution on the present classification; a
change to any row is a licensing change.

### 4.3 The one first-party file that loads Stockfish in-process

`scripts/sf-wasm.mjs` calls `require("stockfish")` and drives the engine over stdio inside a Node
process. Every other first-party reference to Stockfish is a Vite `?url` import, which yields a
*path string* and links no engine code (§6).

This file is:

- a **research harness wrapper**, not application code;
- **not distributed** — it is absent from `dist/` and is reachable only from the research corpus;
- nonetheless **in-process linkage**, which is a materially different relationship from the Worker
  boundary the rest of the product uses.

It is called out here because an audit that reported "the product only ever talks to Stockfish over
UCI messages" would be overstating a true fact by one file. The correct statement is: *the
distributed product* talks to Stockfish only over UCI messages through a Worker; *one
non-distributed research script* loads it in-process.

**Recommended isolation:** this file belongs on the GPL side of the boundary. It is listed in
`LICENSING.md` as GPL-scope first-party code and is allowlisted in the licensing gate, so that
moving it into proprietary directories fails the build rather than passing quietly.

### 4.4 Fonts

Noto Sans Hebrew and DM Mono, both SIL Open Font Licence 1.1. Licence texts are served from the
build at `/licenses/fonts/`. `PERMISSIVE-3P`.

---

## 5. Generated modules and their upstream data

Seven `shared/` modules are machine-generated from committed generators and carry
`GENERATED … Do not edit by hand` headers: `anchor-set.ts`, `anchor-moves.ts`,
`opening-book-keys.ts`, `opening-book-provenance.ts`, `phase-difficulty.ts`,
`population-baseline.ts`, `sensitivity-reference.ts`.

Two upstream datasets, both from the Lichess open database:

| Dataset | Used for | Recorded in |
| --- | --- | --- |
| `lichess_db_standard_rated_2026-03.pgn.zst` | the opening book — 833 position keys at ≥0.10% frequency over 73,279 games | `BOOK_PROVENANCE` in `shared/opening-book-provenance.ts` |
| `lichess_db_puzzle.csv.zst` | the anchor position bank | `scripts/build_anchor_set.ts` |

**What is committed is not the source data.** The opening book is 833 32-bit FNV-1a hashes derived
from aggregate position-frequency statistics. It reproduces no games, no moves and no puzzle text.
Aggregate frequency facts are, in most jurisdictions, not copyrightable subject matter at all.

**`RESOLVED-WITH-CONDITION`, and the condition is not cosmetic.** Lichess publishes these databases
under public-domain terms. **This audit did not verify that from primary sources**, and a dataset's
terms are a fact about the publisher's page on a given date, not something to be recalled. Before
proprietary distribution:

1. retrieve the current terms for both databases from `database.lichess.org`;
2. record the terms, the retrieval date and the exact dataset filename in `LICENSING.md`;
3. if the terms are anything other than a public-domain dedication or a permissive licence,
   re-classify and re-derive.

This is a verification step, not a suspicion. It is written as a blocking condition because the
rule this audit is held to does not have a "probably fine" class.

**No Lichess software is present.** `package.json` names no Lichess package — in particular no
`@lichess-org/chessground`. Lichess's own codebase is AGPL-3.0; none of it is here. The runtime
integration in `client/src/lib/lichess-public.ts` is HTTP calls to a public API, which is use of a
service, not incorporation of code.

---

## 6. The Stockfish boundary, as built

This section records mechanically verified facts, because the boundary is the subject of Questions
2 and 4 in the counsel brief and those questions deserve measurements rather than description.

### 6.1 How the engine is referenced

```
client/src/lib/stockfish.ts:17  import engineJsUrl   from "stockfish/bin/stockfish-18-lite-single.js?url";
client/src/lib/stockfish.ts:18  import engineWasmUrl from "stockfish/bin/stockfish-18-lite-single.wasm?url";
client/src/lib/stockfish.ts:72  return new Worker(`${ENGINE_JS}#${encodeURIComponent(ENGINE_WASM)}`)
```

The `?url` suffix is a Vite **URL import**: it emits the asset into the build and evaluates to a
*string path*. No engine code is imported into the application module graph. The same form is used
by `engine-identity.ts` and `SelfCheck.tsx`. `scripts/sf-wasm.mjs` is the one exception (§4.3).

### 6.2 Verified separation in the built output

| Chunk | Size | Contents |
| --- | --- | --- |
| `stockfish-18-lite-single-BRScAmIT.wasm` | 7,295,411 B | the engine |
| `stockfish-18-lite-single-C33k20Al.js` | 21,429 B | the engine's own loader shim |
| `stockfish-18-lite-single-D4m-Htj1.js` | 77 B | emitted URL constant |
| `stockfish-CynMhxUs.js` | 3,974 B | **first-party** adapter — `client/src/lib/stockfish.ts` |
| `index-Btwx40s9.js` | ~685 kB | first-party application entry |

Scanned every emitted `.js` chunk for engine linkage markers (`_ZN8Stockfish`, `asmLibraryArg`,
`wasmMemory`, `NNUE evaluation`): **zero occurrences in any chunk.**

That zero is a measurement rather than an absence, because the same detector was run against the
`.wasm` as a positive control and returned **49 matches**. A detector that cannot go red proves
nothing, so it was made to go red first.

The only textual occurrences of "Stockfish" in first-party chunks are the display strings
`"Stockfish 18"`, `"Stockfish 18 מקומי"` and `"Stockfish 18 מוכן"` — the engine's *name* shown to
the player, not its code.

### 6.3 The distributed artifacts are unmodified

| Artifact | SHA-256 |
| --- | --- |
| `stockfish-18-lite-single.js` (npm) | `5243fd9b276cab7dfe3ad1d43ab9ead73568fac76468c614242977a210c4a391` |
| `…-C33k20Al.js` (distributed) | `5243fd9b276cab7dfe3ad1d43ab9ead73568fac76468c614242977a210c4a391` |
| `stockfish-18-lite-single.wasm` (npm) | `a8fbc05ec6920b56d7485826dcb02c5ffd2826bcbf751cf973046f237a9096f1` |
| `…-BRScAmIT.wasm` (distributed) | `a8fbc05ec6920b56d7485826dcb02c5ffd2826bcbf751cf973046f237a9096f1` |

The distributed bytes are **identical** to the published package contents. Decision Lab modifies
nothing in Stockfish, so GPL-3.0 §5's obligations on modified works are not engaged. Only §4
(conveying verbatim copies, licence and notices intact) and §6 (corresponding source for object
code) apply, and both are addressed in `LICENSING.md` §4.

Package identity: `stockfish@18.0.8`, resolved from
`https://registry.npmjs.org/stockfish/-/stockfish-18.0.8.tgz`, integrity
`sha512-z+f2UMPXLylDBGjv9e9zU8QulY7hUl8MYHesLRrdddewlOXjJrUSmtNmbtID1/F72EPhq0CCkCNxgWS5MQVWtQ==`.

**One discrepancy, recorded rather than smoothed over:** the npm package metadata declares
`GPL-3.0`; the shipped `COPYING.txt` is the GPLv3 text; upstream Stockfish releases under
**GPL-3.0-or-later**. `THIRD_PARTY_NOTICES.md` states `GPL-3.0-or-later`. The three are consistent
in practice — "or later" is a superset of the bare version — but the exact upstream grant should be
confirmed against the upstream `Copying.txt` when the corresponding-source mapping in `LICENSING.md`
§4 is tightened to a pinned commit.

### 6.4 The server does not execute Stockfish

Grep over `server/` for `stockfish` / `Stockfish`: **zero matches.** Engine execution is
client-side only. The server-side analysis path stores and reads results; it does not produce them.

---

## 7. What blocks what

| Item | Blocks private development | Blocks proprietary external distribution |
| --- | --- | --- |
| First-party ownership chain (§3.2) | no | no |
| AI-authorship / copyrightability (§3.2) | no | no — affects remedy strength, not permission |
| Lichess dataset terms (§5) | no | **yes, until verified** |
| Stockfish boundary determination (§6) | no | **yes, until counsel answers Q2 and Q4** |
| Stockfish compliance **apparatus** (§6.3) | no | no — `MECHANICALLY_VERIFIED`: texts present, notices current, bytes hash-identical, gate detector proven |
| Stockfish compliance **legal sufficiency** | no | **yes, until counsel answers** — `PENDING_COUNSEL`; whether a repository URL plus a version tag discharges GPL §6 is not a measurement |
| Weak-copyleft classification (§4.2) | no | no, on the present classification — but it rests on a reviewed statement, not on bundle provenance |
| `scripts/sf-wasm.mjs` in-process linkage (§4.3) | no | no, provided it stays on the GPL side |

Three conditions gate external proprietary distribution — the dataset terms, the boundary
determination, and the compliance record's legal sufficiency. All are resolvable, none requires code
changes, and none is discovered by this audit to be a defect — they are open questions that were
previously hidden behind a blanket whole-repository GPL notice, which is precisely what the
migration exists to surface.

---

## 8. Recommendations

1. Verify the Lichess dataset terms from primary sources and record them (§5). Cheapest open item.
2. Put Questions 1, 2, 3 and 4 from `docs/legal/COUNSEL_BRIEF.md` to counsel with this audit and
   `LICENSING.md` attached. Do not ask for a general opinion.
3. Keep `scripts/sf-wasm.mjs` on the GPL side of the boundary and hold it there with the gate.
4. Tighten the Stockfish corresponding-source pointer from a repository URL to a pinned upstream
   commit plus the build relationship (`LICENSING.md` §4, open item).
5. Establish an inbound-rights mechanism **before** accepting any external contribution. The rights
   chain is clean today precisely because there has never been one; the first outside contributor
   changes that permanently.
