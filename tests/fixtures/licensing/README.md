# The licensing boundary, broken on purpose

`GATE-LICENSE-BOUNDARY`'s positive control. Never imported by the application, never scanned by the
gate's real run.

Each file here carries a violation that has actually happened to somebody, rather than an invented
one, because a control that only fails against an obviously absurd fixture has not been shown to
catch the thing that ships:

- `client/src/lib/pasted-helper.ts` — a helper pasted from a GPL project with its licence header
  intact, sitting in a proprietary directory.
- `package.json` — the proprietary product declaring a copyleft licence, and a second copyleft
  dependency arriving beside the permitted engine.
- `package-lock.json` — the resolved tree, where the second copyleft package is actually visible.
- a **missing** `LICENSING.md` and `THIRD_PARTY_NOTICES.md`, and a missing Stockfish `COPYING.txt`:
  the compliance record deleted in a refactor.
- `stockfish` resolved at a version the notices would not name, had the notices survived.

A control that finds nothing is not a red control. `run_gates.ts` asserts the finding count is
above zero as well as asserting the real run is clean, so deleting this directory turns the gate
red rather than green.
