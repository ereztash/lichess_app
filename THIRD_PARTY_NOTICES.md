# Third-party notices

This build **conveys** other people's software to whoever loads it: a chess engine compiled to
WebAssembly and two typeface families, shipped as nine font files and a 7.3 MB binary in
`dist/public/`. Conveying them carries
obligations, and until this file existed the build met none of them — no licence text travelled
with the binaries, and nothing named their authors.

Every component below is listed with the version actually installed, the licence it is under, the
copy of that licence this build serves, and where its source can be obtained. The served copies are
static files, so they reach the person who receives the binaries rather than only the person who
reads this repository.

`scripts/run_gates.ts` checks this file against the tree on every `npm run verify`: a font added
without a notice, or an engine version bumped without updating this file, is a red gate.

---

## Stockfish 18.0.8 — GNU General Public License v3.0

| | |
| --- | --- |
| conveyed as | `dist/public/assets/stockfish-18-lite-single-*.wasm` (7.3 MB) and its loader `.js` |
| package | [`stockfish`](https://www.npmjs.com/package/stockfish) 18.0.8 |
| copyright | The Stockfish developers (see AUTHORS in the upstream source) |
| licence | GPL-3.0-or-later |
| licence text served at | [`/licenses/stockfish/COPYING.txt`](client/public/licenses/stockfish/COPYING.txt) |
| corresponding source | <https://github.com/nmrugg/stockfish.js> — the WebAssembly build, at the tag matching 18.0.8 |
| upstream engine source | <https://github.com/official-stockfish/Stockfish> |

GPL-3.0 §4 requires the licence to be conveyed with the work and its notices kept intact; §6
requires the corresponding source of conveyed object code to be available. Both are satisfied by
the two rows above: the licence text is served from this build, and the source is a public
repository at a pinned version, at no charge.

Nothing in this repository modifies Stockfish. It is installed from npm and shipped unaltered, and
the application talks to it over UCI messages through a Web Worker rather than linking it into its
own bundle.

That separation is checked, though **not by anything whose purpose is licensing**, and it is worth
being exact about which: GATE-COMMIT proves the engine module is absent from the initial import
graph, and `scripts/check_bundle_budget.ts` fails the build if `index.html` preloads it. Both exist
to enforce R3 — the engine must not speak before a decision is recorded — and neither was written
to answer the question below. They are evidence about how the two programs are combined, not a
finding that the combination is settled.

> **Settled by the owner, and settled the conservative way.** Whether shipping a GPL-3.0 engine
> alongside this application makes the application itself a work that must be offered under the GPL
> is a question about *how* the two are combined, and reasonable readings differ on message-passing
> to a separate program. This file used to record that the repository had **no `LICENSE` at all** —
> all rights reserved by copyright default — and that the two facts sat badly together.
>
> The project is now **[GPL-3.0-or-later](LICENSE)**, the same terms as the engine it conveys.
> That does not answer the combination question; it makes the answer stop mattering, because this
> distribution complies under either reading. Nothing above depended on it either way.

---

## Noto Sans Hebrew — SIL Open Font License 1.1

| | |
| --- | --- |
| conveyed as | `dist/public/fonts/noto-sans-hebrew-{400,600,700,800}-{hebrew,latin}.woff2` |
| copyright | Copyright 2022 The Noto Project Authors (<https://github.com/notofonts/hebrew>) |
| licence text served at | [`/licenses/fonts/noto-sans-hebrew/OFL.txt`](client/public/licenses/fonts/noto-sans-hebrew/OFL.txt) |
| source | <https://github.com/notofonts/hebrew> |

## DM Mono — SIL Open Font License 1.1

| | |
| --- | --- |
| conveyed as | `dist/public/fonts/dm-mono-400-latin.woff2` |
| copyright | Copyright 2020 The DM Mono Project Authors (<https://www.github.com/googlefonts/dm-mono>) |
| licence text served at | [`/licenses/fonts/dm-mono/OFL.txt`](client/public/licenses/fonts/dm-mono/OFL.txt) |
| source | <https://github.com/google/fonts/tree/main/ofl/dmmono> |

The OFL requires the copyright notice and the licence to travel with the font files whenever they
are redistributed. Each family's own `OFL.txt` is served verbatim, copyright line included, rather
than one shared copy — the notice is part of what the licence asks to be preserved.

---

## Not conveyed

Everything under `node_modules` that exists only to build or test this repository — TypeScript,
Vite, vitest, Drizzle, React and the rest — is not shipped to anyone and is not listed here. The
line this file draws is **what a person receives when they load the page**, not what a person
installs when they clone the repository. `package-lock.json` is the record of the second.
