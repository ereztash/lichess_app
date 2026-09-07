# The observation / learning boundary

Where the evidence stops being mutable, what may be said on each side of it, and what a single
observation is allowed to become.

Companion to `docs/INERTIAL_UX_LAWS.md` (which owns the state laws) and `shared/reveal.ts` (which
owns what the reveal may say). This document adds one thing neither has: **the exact event after
which the evidence is fixed**, and the three contracts that hang off it.

---

## 1. Evidence production phase

**What the system is trying to preserve:** a record of how this player decided, taken under
conditions where nothing the product said could have produced it.

Six fields are produced here and every one is a claim the player makes before the machine has an
opinion:

| field | where it is written | what would spoil it |
| --- | --- | --- |
| `decision` (the move) | the board | any engine output, any suggestion |
| `known` / `known_parts` | the read chips and the free text | a menu that directs attention; a prior finding about this player |
| `unknown` / `unknown_parts` | the same | the same |
| `bounded_action.confidence` | the seven-button scale | a reading of this player's calibration; a question about the confidence just stated |
| `bounded_action.candidate_moves_considered` | placing moves on the board | knowing that placements are counted |
| `bounded_action.seconds_taken` | the clock on the panel | any surface that appears conditionally on speed |
| `probe.alternative` | the board, at `committed` | the engine, or the reveal |

`seconds_taken` deserves its own line because it is the field most easily forgotten. It is a
detector axis -- `fast-under-45s` is a bucket the product's worked example is written about -- and
**anything that appears on screen, at any point, changes it.** `declared-tensions.ts` records that
one of its own rules once fired only on drafts under ten seconds old and had to be deleted for
exactly this reason.

---

## 2. Evidence closure condition

> **The evidence window closes when `runReveal` is entered with every field of the decision
> already written.**

Stated as code, in `client/src/pages/Home.tsx`:

```
onCommit
  ├─ buildCommitEvent(...)                 the atom is assembled
  ├─ await commitDecision.mutateAsync()    ← the atom is now immutable
  ├─ recordTrialEvent("decision_committed")
  ├─ if (event.probe.assignment === "probed")
  │     setStage(PROBE_STAGE)              ← still mutable: probe.alternative
  │     return
  └─ runReveal(...)                        ← CLOSED (unprobed arm)

onAnswerProbe
  ├─ recordCounterfactual(...)             ← probe.alternative is now immutable
  └─ runReveal(...)                        ← CLOSED (probed arm)
```

### The commit is not the boundary

On roughly **35% of eligible decisions** -- `PROBE_PROBABILITY = 0.35` in `shared/counterfactual.ts`,
eligible meaning `MIN_LEGAL_MOVES_TO_ASK = 2` -- the window extends past the commit into
`PROBE_STAGE`, which is the stage string `"committed"`. `MODE_OF_STAGE` maps it to `DECIDE`, not
`REVEAL`, and `makingEvidence("committed")` is `true`. That mapping is correct and
`docs/INERTIAL_UX_LAWS.md` records the defect it fixed: the analysis column used to branch on
`deciding`, so at `committed` the whole reveal column rendered and the product asked *"what would
you have played instead?"* beside a dashboard of the player's own accuracy rates.

**So there are two closures, not one, and which applies is decided by a draw:**

| arm | share of eligible decisions | closes at |
| --- | --- | --- |
| `not-probed` / `ineligible` | ~65% | the commit write returning |
| `probed` | ~35% | the counterfactual answer being written |

### Two closures that are not the reveal

- **A refused commit does not close it.** On a write failure `Home.tsx` sets `stage` back to
  `deciding` and shows `.commitment-error`. The evidence is still mutable and `makingEvidence` is
  still true. `"blocked"` maps to `DECIDE` for the same reason.
- **A deferred game never opens a reveal at all.** When `mayShowVerdictNow(timing)` is false --
  the per-game arm -- `runReveal` scores the decision, stores it, plays the move, and returns the
  player to `deciding` with `ההחלטה נרשמה. העמדה הבאה.` The window closes on that decision and
  immediately reopens on the next one, and the learning window for the whole game does not open
  until the game ends. **A deferred game is a session-length production phase with no reveal in it**,
  and every surface in the ledger is on screen for all of it.

### What closure does and does not mean

Closure is about **this decision's** evidence. It is not about the record. Decision *n+1* is
produced after the player has seen reveal *n*, and `docs/decisions/D21-feedback-exposure.md`
establishes that the record cannot separate a decision taken after 199 reveals from the first one:
*"Decision #1 and decision #200 are one population."* That is a real limit on what accumulation may
claim and section 5 is bounded by it.

---

## 3. Reveal phase

**What becomes permitted the moment the window closes**, and it is exactly the complement:
`engineMayRun(stage) === !makingEvidence(stage)`, asserted in
`tests/client/nothing-to-read-while-you-decide.test.tsx` over every stage.

| forbidden before | permitted after | why the reason for hiding it has expired |
| --- | --- | --- |
| the engine's evaluation, best move, PV | `.reveal-secondary`, `EvaluationBar`, the suggested-move arrow | it can no longer change the recorded move |
| the calibration reading | `.reveal-one-thing`'s `confident-and-wrong` branch | the confidence is written |
| the candidate list read back as a finding | `chose-past-it` | the candidates are written |
| every reading of the record | `ControlRail`, `RecordExplorer` behind `.explore-toggle`, `.context-loop-goto` | nothing on screen can alter a stored decision |

**This is the Lichess precedent, arrived at independently.** `lichess-org/lila` conceals computer
lines while `retro.isSolving()` and reveals them after: issue #18162 was *"Bf4 was best"* spoiling
a position the user was meant to calculate, fixed by `7f844c6` *"dont spoil learn from your
mistakes"*; issue #14213 was the inverse -- variations still hidden after the user had solved --
fixed by narrowing concealment to the solving state rather than the whole learning mode. The same
information is contamination before and value after. Decision Lab's `makingEvidence` is that
predicate, and the fact that it is the exact negation of `engineMayRun` is what makes it one rule
rather than two that can drift.

**What the reveal must not become when the gate opens.** `docs/INERTIAL_UX_LAWS.md` LAW 2 records
that the reveal column once rendered nine sections at once. "Permitted" is not "due".

---

## 4. Accumulation phase

One decision is one observation. The record is the only thing that can turn *this happened* into
*this happens*, and it has thresholds: `MIN_BUCKET_N = 30` per side, `SEPARABILITY_K = 3.75`
standard errors, both set by the shuffled-label control rather than by taste.

What exists today:

- `revealAccumulation(kind, mix)` in `shared/reveal.ts` produces a **count of the same kind so
  far** -- `"X — הופיע ב-k מתוך n ההחלטות שהמנוע ענה עליהן עד עכשיו"` -- and suppresses the balance
  line entirely while `mix.n < 2`.
- `ACCUMULATION_LEAD` is a constant: `"החלטה אחת אינה דפוס. מה שהיא כן עושה הוא להזיז את מאזן הראיות."`
- `inferenceLimits` puts `"זו החלטה אחת שנרשמה. שום דבר כאן אינו דפוס"` first, before any number.
- `ACCUMULATION_NEXT` names what another decision is for, without a countdown, a streak or a digit.

What does not exist: any link from **this** observation to **which** distinction it belongs to
across decisions. `ACCUMULATION_KIND_LABEL` gives five kinds; the count is per kind; a player who
receives `chose-past-it` twice on materially different positions is told it happened twice, and is
not told what the two have in common, because the record does not hold that and the detector's
buckets are clock, phase and time rather than anything the player said.

**That is the honest state and it is also the moat's location.** `README.md` puts it plainly: the
product's distinction is not a better engine explanation, it is a record of how this player decides
that can be tested for what recurs. The gap between `revealAccumulation`'s count and a
*transferable distinction* is the thing Phase 14 is about, and it is bounded by D21: until exposure
is recorded, an accumulation across decisions is an accumulation across a population that mixes
naive and informed decisions.

---

## 5. The three contracts

### Production Contract

> While the player is producing evidence, the product may not leak the answer and may not coach the
> process being measured, **unless the intervention is explicitly the thing the experiment is
> measuring.**

The carve-out is not a loophole; it is used exactly three times in the whole window, and the ledger
names all three: a drill's `refutation_condition`, which R5 requires visible throughout, and the
transfer check's two pre-reveal questions, which exist to measure whether a player-authored rule is
being applied.

What the contract adds to LAW 1, which it does not replace:

| LAW 1 forbids | this contract also forbids |
| --- | --- |
| a reading of the record, on screen | a **string** derived from the record that is a finding rather than a position in the loop |
| the engine's output | a prompt that changes how the player thinks about this position |
| -- | a surface that appears **conditionally on a measured variable**, at any weight, in any state |

The third row is the one with a scar. `declared-tensions.ts` had a rule that fired only on drafts
under ten seconds old, which applied a treatment to one arm of a detector bucket and recorded the
exposure nowhere.

**A test that discriminates this contract**, which the repository does not yet have: no surface
inside `makingEvidence` may take `secondsTaken`, `phase` or `clockMsRemaining` as an input.
`declaredTensions` now takes no clock **by rule**, stated in its module comment; nothing enforces
it. That is a proposed gate, not a claim about today.

### Reveal Contract

> Information that was forbidden before closure becomes available once it can no longer contaminate
> the measurement and now contributes to understanding.

Three riders, all of which the repository already holds somewhere:

1. **Available is not automatic.** Nine sections at once was the previous defect.
2. **A statement carries its evidence class.** `ONE_THING_EVIDENCE` labels each branch `process` or
   `engine`, and `docs/VALUE_CLARITY.md` requires the labelling to be proved by ablation rather
   than restated: strip `candidatesConsidered` and `confidence`, and every `process` branch must
   stop firing while every `engine` branch is unchanged.
3. **Silence is a result.** `theOneThing` returns null and the screen says
   `"זו תוצאה תקינה, לא מסך ריק"` with the basis that produced the silence.

### Accumulation Contract

> One observation is an observation. A pattern requires repeated evidence.

Operationally, and every clause is already a number somewhere in the repository:

| clause | enforced by |
| --- | --- |
| no balance line at `n < 2` | `revealAccumulation` |
| no claim below `MIN_BUCKET_N` per side, or `PREREGISTERED_THRESHOLDS.minBucketN` when the bucket was named in advance | `shared/detector.ts` |
| no bucket reported unless it is `SEPARABILITY_K` standard errors from the rest | `shared/detector.ts`, calibrated on the shuffled-label control |
| every claim renders at its grade with its `n` | `GATE-GRADE` |
| a predictive pattern is not automatically a personal one | the population baseline, `README.md`'s R\* / R\*\* distinction |
| no countdown, streak, unlock or digit as a reason to continue | `docs/VALUE_CLARITY.md` Lens 5, and its invariance test |

**And one clause the repository does not yet enforce**, carried here as an open item rather than a
rule: an accumulation may not pool decisions taken before and after the player saw a finding, until
exposure is recorded. `GATE-EXPOSURE-CONTEXT` is deliberately unregistered for this reason and
`docs/decisions/D21-feedback-exposure.md` records the three candidate schemas without choosing one.

---

## 6. What this boundary does not settle

- Whether any of the surfaces the Production Contract permits actually changes what is produced.
  That is reactivity, and it is an experiment.
- Whether the reveal produces a distinction a player can carry. That is transfer, and it is FIELD.
- Which exposure schema the Accumulation Contract's missing clause should use. That is D21's
  decision and it is deliberately open.
