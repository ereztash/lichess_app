# The licensing boundary, broken on purpose

`GATE-LICENSE-BOUNDARY`'s first positive-control fixture. Never imported by the application, never
scanned by the gate's real run — `scripts/license-boundary.ts` excepts this directory by name, with
the reason attached.

Each file here carries a violation that has actually happened to somebody, rather than an invented
one, because a control that only fails against an obviously absurd fixture has not been shown to
catch the thing that ships:

- `client/src/lib/pasted-helper.ts` — a helper pasted from a GPL project with its licence header
  intact, sitting in a proprietary directory.
- `scripts/ordinary-helper.mjs` — **the same paste, in `scripts/`, in a `.mjs` file.** Both halves
  of that sentence were blind spots: `scripts/**` was named as first-party by `LICENSING.md` §3
  rule 1 and was not in the scanned set, and the walk collected `.ts`/`.tsx` only.
- `scripts/sf-wasm.mjs` — **the file that must NOT be reported.** It carries the identical header
  to `ordinary-helper.mjs`, so the only difference between them is the exception list. This is the
  differential half of the control: an allowlist entry is only proven if the file beside it fires.
- `package.json` — the proprietary product declaring a copyleft licence, and a second copyleft
  dependency arriving beside the permitted engine.
- `package-lock.json` — the resolved tree, where the second copyleft package is actually visible,
  plus a weak-copyleft package nobody classified.
- a **missing** `LICENSING.md`, `THIRD_PARTY_NOTICES.md` and Stockfish `COPYING.txt`: the
  compliance record and the component map deleted in a refactor.

`stockfish` resolves here at a version the notices would not name — but the notices are gone, so the
version check cannot fire in this tree. That detector has its own fixture,
`tests/fixtures/licensing-stale-notices`, where the compliance files are present and stale. Two
fixtures rather than one because the two failures are mutually exclusive on the same file.

A control that finds nothing is not a red control, and a control that finds *six things at once* is
not proof that six detectors work. `scripts/license-boundary.ts` exports `REQUIRED_DETECTORS` and
`run_gates.ts` asserts each one fired by name, so adding a check without proving it is a failure
rather than a silence.
