# The external model, against what this repository already had

The mission arrived with a candidate model called **User Loop Integrity** — ten properties and four
feedback layers `F0`–`F3` — produced by a cross-cultural triangulation outside this repository. It
is a frozen input, not an authority. This file classifies it.

## Verdict

# `ALREADY_REPO_NATIVE`

Not a new law, not a composition that needed naming, and not an external requirement. **Every one of
the ten properties already has a repo-native authority**, and the defects this mission found are
failures to generalise rules the repository had already written down and, in two cases, already
implemented correctly somewhere else.

The decisive evidence is not that the ideas rhyme. It is that for each defect there is a document or
a file in this tree that states the rule and names the case it was applied to:

| defect found | the rule this repository already held | where it was already applied |
| --- | --- | --- |
| the board played moves for both sides after the commit | *"The board does not need a twin; it needs a MODE"* | **`Blitz.tsx`**, four props deep, since the second board was removed |
| — the same, historically | *"A game meant playing both colours yourself at one commit-and-reveal cycle per half-move"* | `docs/FINDINGS.md`, closed by giving the **live** game an opponent |
| the reveal described a position the board had left | section 4.3 / `GATE-STALE`: *"a result rendered against an input it was not computed for is marked stale"* | `EvaluationBar`, which derives it *"so a caller cannot forget to mark it"*; `AnalysisPanel` |
| the continuation destroyed the rest of a loaded game | LAW 4: *"No call to action may cause something that already happened in the world to be lost"* | `GATE-PENDING-WORK-LIVENESS`, for the analysis queue |
| the continuation handed over the opponent's turn, and stored the answer | `docs/FINDINGS.md`: *"the app asked the player to decide for that side too"* | the **live** game, which was given an opponent; the front door's handoff was not |
| the note said the engine was computing after it had answered | `RNL-01` derive, don't declare | `EvaluationBar`'s `is-stale`, again |

This is the repository's own recurring shape, and `docs/INERTIAL_UX_LAWS.md` names it in a table:
*"already argued at … never generalised to …"*. The mission's finding is one more row of that table.

## The ten properties, crosswalked

| candidate | repo-native analogue | current authority | evidence | contradiction? | missing capability? | class | action taken |
| --- | --- | --- | --- | --- | --- | --- | --- |
| action acknowledgment | LAW 2's perceptual half; `VISUAL_ARCHITECTURE_AUDIT.md` | `docs/INERTIAL_UX_LAWS.md` | measured: read chips, confidence, submit, continue all give a delta | **partly** — one *false* acknowledgment | no | `ALREADY_REPO_NATIVE` | the note now says what is true |
| state legibility | `MODE_CONTRACT.central`, one per mode | `shared/interaction-mode.ts` | mode contract exists; screen does not read it | **yes** | no | `ALREADY_REPO_NATIVE` | board authority now derived |
| authority boundary | `GATE-TWO-HANDS`, but **chromatic only** | `docs/DESIGN_SYSTEM.md` | the hues are correct; the behaviour was not | **yes** | **yes** — no behavioural half existed | `ALREADY_REPO_NATIVE`, incomplete | `shared/board-authority.ts` + `GATE-BOARD-AUTHORITY` |
| commitment boundary | `DECISION_STAGES`, `makingEvidence`, `engineMayRun` | `shared/decision-stage.ts` | the record's boundary held; the **board's** did not | **yes** | no | `ALREADY_REPO_NATIVE` | the board refuses from `committing` on |
| outcome discernibility | `theOneThing`, `ONE_THING_EVIDENCE`, `silenceBasis` | `shared/reveal.ts` | four branches + two silences, each distinguished | no | no | `ALREADY_REPO_NATIVE` | none |
| outcome integration | `revealFen`, `isStale`, section 4.3 | `GATE-STALE` | the reveal was the one result not marked | **yes** | no | `ALREADY_REPO_NATIVE` | `.reveal-elsewhere` |
| UI ↔ real-state truth | `RNL-12` a surface reads the record, not its private copy | `REPO_NATIVE_OPERATING_SYSTEM.md` §H | the record was right throughout; the **board** was the private copy | **yes** | no | `DOMAIN LAW`, already stated | board authority |
| recovery | LAW 4; `RevealFailure`; `GATE-ENGINE-FAILURE-DISTINCT` | `docs/INERTIAL_UX_LAWS.md` | a loaded game was destroyed by the continuation | **yes** | no | `ALREADY_REPO_NATIVE` | the continuation advances instead of forking |
| next-action clarity | `deriveNextAction`, `PRIMARY_ACTIONS`, `D22` | `shared/next-action.ts` | derivation exists, owns nothing | **yes** — D22's reversal condition 1 | no | `ALREADY_REPO_NATIVE` | **not taken** — see below |
| value accumulation | the acquisition chain `promise → expectation → first action → unique payoff → continuation` | `docs/ACQUISITION_EVIDENCE.md` | the continue row says *"board accepts the next move"* and does not say **whose**; the front door's continuation passed the turn to the side nobody plays | **yes** | no | `ALREADY_REPO_NATIVE` | the control is offered only where it can be taken |

## The four feedback layers

`F0`/`F1`/`F2`/`F3` **map onto machinery this repository already has**, under different names, and the
mapping is exact enough to be useful as vocabulary and not as law:

| layer | this repository's name for it | where |
| --- | --- | --- |
| `F0` operational acknowledgment | the board note, `role="status"`, the live region, `aria-pressed` | `ChessBoard`, `Home.tsx`'s `notice` |
| `F1` local decision outcome | `theOneThing`'s four branches, and the two `silenceBasis` sentences | `shared/reveal.ts` |
| `F2` process interpretation | `ONE_THING_EVIDENCE` / `EVIDENCE_LABEL` — *"could an engine have told me this?"* | `shared/reveal.ts` |
| `F3` aggregated inference | the detector, `MIN_BUCKET_N`, `evidence-authority.ts`, claim grades | `shared/detector.ts`, `GATE-GRADE` |

**The candidate principle — "`F2`/`F3` silence must not automatically erase `F0`/`F1`" — is already
implemented, and was tested rather than assumed.** When `theOneThing` returns null, the panel does
not go blank: `silenceBasis` picks between two distinct sentences, one of which names the
centipawn cost, and `RevealPanel` renders it under the heading *"מה קרה כאן"*. The chosen move and
its cost are additionally in the disclosure, where LAW 6 puts instrumentation on purpose.

So the external principle is **not a new requirement here**. What this mission adds is one measured
qualification, and it is a geometry finding rather than a semantic one: at 390x844 the whole reveal —
`F1` and `F2` together — begins at y=893 of an 844px viewport. Not erased; below the fold. That is
recorded as `FIELD-REQUIRED` in `FALSIFICATION_REGISTER.md` and was **not** fixed by moving blocks
around, because `RevealPanel`'s order is declared non-negotiable and no evidence in this mission
licenses moving it.

## What the external model did NOT do

It did not identify anything this repository had never discovered. Its useful contribution was
**one vocabulary distinction**: separating *the acknowledgment of an action* (`F0`) from *the outcome
of the decision* (`F1`), which made it possible to state precisely why a board that lights up an
opponent's piece is a defect even though nothing downstream is wrong — the acknowledgment is real
and the authority behind it is not.

## Ownership: the thing this mission deliberately did not take

`shared/interaction-mode.ts` says *"IT DECIDES NOTHING YET"* and `shared/next-action.ts` says
*"IT DECIDES NOTHING YET"*. `D22` defers ownership and names as its first reversal condition:

> A surface's screen and the derivation disagree on a state, in a walk over the built app.

**That condition has now fired**, and it is recorded in `CONTRADICTIONS.md` as `ULI-X-01`. This
mission did **not** hand either derivation the screen, and the reason is `RNL-09` plus D22's own
argument: the two conditions the decision names — the blind inputs closing, and a person disagreeing
with a proposal a test called correct — have not been met, and neither is met by anything measured
here. What this mission did instead is narrower and is the move `RNL-09` allows on day one: a
**new** derivation, over a question neither module answers, given ownership immediately because it
refuses an action rather than routing a person to one.
