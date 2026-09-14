# The architecture→UI boundary, broken on purpose

Positive controls for `GATE-CANONICAL-ACTION-REACHABLE`, `GATE-SEMANTIC-PRESERVATION` and
`GATE-NO-LOCAL-PRODUCT-POLICY`. Never imported by the application.

Each violation here is one that actually shipped, rather than one invented to be caught:

- `silent-policy.tsx` — a surface picking its own act from its own state, which is what
  `postGameWords` did unconditionally and what `resume-reading.ts`'s two-kind table did on the
  front door.
- `renaming-presenter.ts` — a presenter that rewords an act and quietly renames it, which is the
  one thing the `SurfaceOffer` contract exists to forbid.
- `thin-presenter.ts` — a presenter that renders almost nothing, so `GATE-CANONICAL-ACTION-REACHABLE`
  is exercised against a surface set that leaves canonical kinds with no renderer.
