# The probes behind the surface ledger

Not part of the build, not part of `npm test`, not a gate. They are the instrument, kept whole so
the numbers in [`../PRE_EVIDENCE_SURFACE_LEDGER.md`](../PRE_EVIDENCE_SURFACE_LEDGER.md) can be
re-measured rather than believed. Same standard as [`docs/neta/harness/`](../../../docs/neta/harness/README.md),
and the same reason: several of those numbers came from exploratory runs and one of them was wrong.

```bash
npm run build                 # they serve dist/public, so they measure the built artefact
node research/ux-measurement/probes/pre-evidence-surfaces.mjs probed
node research/ux-measurement/probes/pre-evidence-surfaces.mjs unprobed
node research/ux-measurement/probes/tension-and-disclosure.mjs
```

| file | what it measures |
| --- | --- |
| `pre-evidence-surfaces.mjs` | every element that paints its own text or takes a press, at nine states from the front door to the reveal, with class, geometry, type size and weight. Writes `out/surfaces-<arm>.json` |
| `tension-and-disclosure.mjs` | two questions the source cannot answer: whether `.context-why`'s body is painted while closed, and what `.commitment-tension` renders and where relative to the submit |

## Two properties of the instrument, and both of them earned their place

### The counterfactual arm is pinned, not drawn

`assignProbe` takes its `draw` as an argument and `client/src/lib/decision-session.ts` defaults it
to `Math.random`, so a walk that simply answers the counterfactual when it appears silently selects
between two code paths: `onCommit` calls `runReveal` in its own closure on one arm and
`onAnswerProbe` calls a later one on the other. `docs/neta/harness/README.md` records two passes
that read the resulting disagreement as a race.

Both probes here `addInitScript` a pinned `Math.random` before any page script runs, take the arm
as `argv[2]`, and print which one they pinned. Both arms are walked.

### Visibility is `checkVisibility()`, not the bounding rect

The first version of `pre-evidence-surfaces.mjs` filtered on `getBoundingClientRect()` plus
`display` and `visibility`, and reported the context ribbon's disclosure body as painted during
`DECIDE`. That would have been a serious finding: the screen naming the detector's own measured
variables to a player producing measurements of exactly those variables.

It is not painted. Measured:

```
details.context-why   open: false
small                 rect h=390   display: block   visibility: visible
                      checkVisibility(): FALSE
.context-ribbon innerText: does not contain the sentence
after clicking למה?   innerText: contains it
```

A closed `<details>` gives its children `content-visibility: hidden`; they keep the geometry of
their last layout and still report `display: block` and `visibility: visible`. `checkVisibility()`
agrees with `innerText`, which is what a person reads.

**The refuted finding is kept in `../CURRENT_STATE.md` as D4**, because the artefact is more likely
to recur than the finding was.

## What these can and cannot establish

They are DOM and geometry facts on the real application path at R3. They establish **what the
screen is doing**, which is the only half a repository can own. They establish nothing about what a
person notices, reads, or is changed by. Every row in the ledger that depends on a person is marked
`FIELD` and is not answered here.
