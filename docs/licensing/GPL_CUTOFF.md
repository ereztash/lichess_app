# The whole-repository GPL cutoff

This file records the exact revision at which Decision Lab was last licensed, as a whole, under
GPL-3.0-or-later. It is a historical marker. **Nothing here revokes anything.**

---

## The revision

| | |
| --- | --- |
| commit | `490aed07b0ec2e2d27ab7574eacdb7673a7d5666` |
| short | `490aed0` |
| subject | Merge pull request #121 from ereztash/claude/learning-continuity |
| branch | `main` |
| date | 2026-09-14 |
| tag | `whole-repo-gpl-cutoff-2026-09-14` — **created, not yet pushed**; see `MIGRATION_RUNBOOK.md` §1a |
| repository | `github.com/ereztash/lichess_app` (public) |

**This history is never rewritten.** The tag is annotated and points at this commit permanently.
If the licensing architecture changes again, a *new* marker is added; this one is not edited.

## Licence state at the cutoff

| | |
| --- | --- |
| root `LICENSE` | GPL-3.0-or-later, whole project |
| `package.json` `license` | `GPL-3.0-or-later` |
| repository visibility | public |
| third-party notices | `THIRD_PARTY_NOTICES.md` |
| component map | `LICENSING.md` (added after the cutoff; see below) |

The root `LICENSE` at this revision states in its own preamble that whole-project GPL was adopted
as a **conservative compliance posture** rather than as a conclusion that the Worker-based
integration creates one combined work. That is worth preserving verbatim, because it is the
starting condition the migration acts on: the ambiguity was known and was closed by taking the
safer side, not by resolving it.

## Build state at the cutoff

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
| copyleft packages in the resolved production tree | **1** (`stockfish`) |

## What was granted, and remains granted

Every copy of Decision Lab distributed at or before this revision was distributed under
GPL-3.0-or-later. Those grants are **perpetual and irrevocable**. Every recipient keeps the right to
use, study, modify, fork and redistribute what they received, under those terms, without limit of
time.

The migration described in `docs/licensing/MIGRATION_RUNBOOK.md` is **prospective only**. It
governs first-party code written after this revision. It makes no claim over this revision or any
earlier one, and any statement that it does would be false.

## What lands after the cutoff, in this repository

The licensing-migration artefacts — this file, `IP_PROVENANCE_AUDIT.md`, `LICENSING.md`, the
counsel brief, the runbook, the licensing gate and its fixture, and `CODEOWNERS` — are committed
**after** the cutoff, into a repository whose root `LICENSE` is still GPL-3.0-or-later.

They are therefore GPL-licensed like everything else here, and that is stated rather than left to
inference. They are first-party work owned by the same holder, so carrying them into the
proprietary line later is the holder relicensing his own work, which he may do. No product
behaviour is changed by any of them.
