# The public GPL line: three artefacts, not one

This file records the boundary between the public GPL development line and the private proprietary
one. It is a historical marker. **Nothing here revokes anything.**

---

## Why this file no longer names a single commit

Its first revision said it recorded *"the last whole-project GPL state"*. That sentence is no longer
true of any single SHA, and pretending otherwise would misdescribe the public record.

Three different things happened, at three different commits, and only naming all three is honest:

| Artefact | What it is |
| --- | --- |
| `LAST_GPL_MAIN_PRODUCT_BASELINE` | the last **product** state that reached public `main` before the licensing transition began |
| `PUBLIC_GPL_PRODUCT_DELTA` | first-party product work **published publicly**, under the GPL-era repository, on a branch that was never merged |
| `FINAL_GPL_MAIN_TRANSITION_STATE` | the merge after which public `main` receives no further first-party code |

The middle row is the one a single-SHA record would have hidden. Product work was pushed to this
public repository while its root `LICENSE` was in force, on a branch reachable by anybody. It is a
public GPL artefact whether or not it is ever merged, and a record that named only `main` would have
been quietly incomplete on exactly the point that matters.

---

## A. `LAST_GPL_MAIN_PRODUCT_BASELINE`

| | |
| --- | --- |
| commit | `490aed07b0ec2e2d27ab7574eacdb7673a7d5666` |
| short | `490aed0` |
| subject | Merge pull request #121 from ereztash/claude/learning-continuity |
| ref | `main` |
| date | 2026-09-14 |
| repository | `github.com/ereztash/lichess_app` (public) |

This is the state the private line's product baseline is taken from. It is **not** "the last GPL
commit on `main`" — the licensing transition itself lands after it, on `main`, under the GPL, and
that is stated in §D below rather than glossed.

## B. `PUBLIC_GPL_PRODUCT_DELTA`

| | |
| --- | --- |
| commit | `78baa67ff21734be0f4785229cb246eb033c4511` |
| short | `78baa67` |
| subject | Make the UI execute the architecture instead of arguing with it |
| ref | `claude/ui-executes-architecture`, pull request #123 |
| date | 2026-09-14 |
| merged into `main` | **no, and it will not be** |
| repository | `github.com/ereztash/lichess_app` (public) |

**2,140 insertions across 34 files of first-party product code, published publicly under the
GPL-era repository.** This is the architecture→UI migration. It was pushed to this public
repository before the proprietary cutover existed, and PR #123 was open and readable.

Three things follow, and all three are recorded rather than chosen between:

1. **It is not merged and will not be.** Merging it would add product functionality to the frozen
   GPL line after the freeze, which the freeze exists to prevent.
2. **Its public GPL publication is a fact and is not retracted.** Anyone who took a copy of this
   branch while the repository's root `LICENSE` was GPL-3.0-or-later took it under those terms.
   Closing the pull request does not change that and is not an attempt to.
3. **It is a migration source, not a place to keep working.** The private line ports its changes
   and re-derives its two load-bearing decisions independently. The branch stays as evidence.

## C. `FINAL_GPL_MAIN_TRANSITION_STATE`

| | |
| --- | --- |
| commit | **`UNKNOWN UNTIL PR #122 IS MERGED`** |
| will be | the merge commit of pull request #122 into `main` |
| ref | `main` |
| marker | `gpl-main-cutoff-2026-09-14`, created on that commit — see `MIGRATION_RUNBOOK.md` §1a |

**This row cannot be filled in by the commit it describes.** The merge SHA does not exist until the
merge happens, and this file is inside the merge. Writing a plausible-looking SHA here would put a
fabricated identifier into the one document whose whole job is to be checkable, so the row says
`UNKNOWN` and the actual value is recorded in two places that come *after* the merge and can
therefore be true: the annotated marker `gpl-main-cutoff-2026-09-14`, which points at it, and
`SOURCE_PROVENANCE.md` in the private repository, which records it by SHA.

The merge of the licensing transition itself. **After that commit, public `main` receives no further
first-party product code.** The repository stays public, its root `LICENSE` stays GPL, and the line
stops being a development authority without ceasing to be true.

The marker's name is deliberately `gpl-main-cutoff` and not "the last GPL product code ever
published". §B is why: it would be false.

---

## D. Licence state across all three

| | |
| --- | --- |
| root `LICENSE` | GPL-3.0-or-later, whole project, **unchanged at every one of the three** |
| `package.json` `license` | `GPL-3.0-or-later`, unchanged |
| repository visibility | public, unchanged |
| third-party notices | `THIRD_PARTY_NOTICES.md` |
| component map | `LICENSING.md` (added between A and C; see below) |

The root `LICENSE` states in its own preamble that whole-project GPL was adopted as a
**conservative compliance posture** rather than as a conclusion that the Worker-based integration
creates one combined work. That is worth preserving verbatim, because it is the starting condition
the migration acts on: the ambiguity was known and was closed by taking the safer side, not by
resolving it.

## Build state at `LAST_GPL_MAIN_PRODUCT_BASELINE`

| | |
| --- | --- |
| Stockfish package | `stockfish@18.0.8` |
| resolved from | `https://registry.npmjs.org/stockfish/-/stockfish-18.0.8.tgz` |
| npm integrity | `sha512-z+f2UMPXLylDBGjv9e9zU8QulY7hUl8MYHesLRrdddewlOXjJrUSmtNmbtID1/F72EPhq0CCkCNxgWS5MQVWtQ==` |
| engine loader SHA-256 | `5243fd9b276cab7dfe3ad1d43ab9ead73568fac76468c614242977a210c4a391` |
| engine WASM SHA-256 | `a8fbc05ec6920b56d7485826dcb02c5ffd2826bcbf751cf973046f237a9096f1` |
| engine licence | GPL-3.0-or-later (upstream); npm metadata declares `GPL-3.0` |
| upstream engine source | https://github.com/official-stockfish/Stockfish |
| WASM build source | https://github.com/nmrugg/stockfish.js |
| modified by Decision Lab | **no** — distributed bytes are identical to the package contents |
| strong-copyleft packages in the resolved tree | **1** (`stockfish`) |

## What was granted, and remains granted

Every copy of Decision Lab distributed at or before `FINAL_GPL_MAIN_TRANSITION_STATE` — from `main`,
from `claude/ui-executes-architecture`, or from any other public ref — was distributed under
GPL-3.0-or-later. Those grants are **perpetual and irrevocable**. Every recipient keeps the right to
use, study, modify, fork and redistribute what they received, under those terms, without limit of
time.

The migration described in `docs/licensing/MIGRATION_RUNBOOK.md` is **prospective only**. It governs
first-party code written after the transition. It makes no claim over any of the three artefacts
above or anything earlier, and any statement that it does would be false.

## What lands between A and C, in this repository

The licensing-migration artefacts — this file, `IP_PROVENANCE_AUDIT.md`, `LICENSING.md`, the counsel
brief, the runbook, the licensing gate and its two fixtures, and `CODEOWNERS` — are committed
**after** `LAST_GPL_MAIN_PRODUCT_BASELINE`, into a repository whose root `LICENSE` is still
GPL-3.0-or-later.

They are therefore GPL-licensed like everything else here, and that is stated rather than left to
inference. They are first-party work owned by the same holder, so carrying them into the proprietary
line later is the holder relicensing his own work, which he may do. No product behaviour is changed
by any of them.

## Machine-readable summary

```text
LAST_GPL_MAIN_PRODUCT_BASELINE
= 490aed07b0ec2e2d27ab7574eacdb7673a7d5666

PUBLIC_GPL_PRODUCT_DELTA
= 78baa67ff21734be0f4785229cb246eb033c4511  (PR #123, claude/ui-executes-architecture, unmerged)

FINAL_GPL_MAIN_TRANSITION_STATE
= UNKNOWN UNTIL PR #122 IS MERGED
```

## This history is never rewritten

The marker is annotated and points at `FINAL_GPL_MAIN_TRANSITION_STATE` permanently. If the
licensing architecture changes again, a *new* marker is added; this one is not edited, moved or
deleted. Nor is `claude/ui-executes-architecture`: its head SHA is recorded above precisely so that
the public delta remains checkable rather than remembered.
