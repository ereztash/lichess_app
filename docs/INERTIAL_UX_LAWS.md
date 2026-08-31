# The inertial laws

**Twelve laws of Decision Lab. Not twelve claims about product design.**

Every one of them is stated because this repository violates it somewhere, and the violation is
cited. A law with no violation behind it is a preference; a law whose violation is named is a
defect with a rule attached, and that is the only kind written down here.

## What "inertial" means, and what it does not

The target is not a simpler app. It is:

> **at every moment, the state the player is in nearly dictates the next action, without their
> having to understand Decision Lab's architecture.**

They should be thinking *what is my move?* — not *is this a moment for Record, Game Review, a drill,
the learning queue, an analysis, or another game?*

**And it is not the same thing as removing friction.** Some of this product's friction IS the
instrument: the confidence question, the sampled reads, the counterfactual probe. Those are held
apart in LAW 9 and may not be touched by this work at all. The rule that makes the whole programme
safe is a scheduling rule:

> **We do not change what the player does and what we measure at the same time.**
>
> First remove friction with no measurement value. Then build orchestration. Only then, separately
> and behind an experiment, touch friction that is part of the instrument.

## The pattern behind most of these

Three of the twelve are already implemented **for one case each**, correctly, with the reasoning
written out — and were never generalised. That is worth naming, because it means the laws are not
new opinions being imported; they are rules this codebase already discovered and applied locally.

| law | already argued at | never generalised to |
| --- | --- | --- |
| 1 | `Home.tsx`, the `silentGame` branch | every other deciding state |
| 6 | `PostGame`, `RevealPanel` | — this one holds; do not break it |
| 10 | `CommitmentScreen`, move vs. multi-select | — this one holds |

---

## LAW 1 — Measurement before intervention

> While the player is producing evidence, the product may not show them prior evidence that could
> influence the decision being recorded.

In `DECIDE`, `COMMIT`, `ANSWER_INSTRUMENT` and `COUNTERFACTUAL`, none of these may be on screen:
the claim panel, the learning queue, a pattern already found, a recommendation about their weakness,
game review, or any engine insight outside the protocol.

**The violation.** `client/src/pages/Home.tsx` renders `<ClaimPanel>` and `<LearningQueue>` on the
`deciding` branch — and `deciding` is `stage === "deciding" || stage === "committing"`, so both are
on screen through the commit as well.

**And the argument against it is already in that file, one branch above.** The `silentGame` case
says, in as many words:

> REPLACES the claim panel and the learning queue for the duration, rather than joining them. Both
> of those are readings of the record, and a screen that offers readings while promising the engine
> is silent is offering the player a way around the condition they chose.

Exactly right, and it was applied to the one condition where a player had explicitly asked for
silence. The general case — every decision this product measures — kept the panels.

**Why P0 rather than a nicety.** It is friction *and* a validity problem. A calibration gap is
`confidence − accuracy`, and the confidence is stated while a panel describing the player's
calibration is visible. That is not a measurement of what they believed; it is a measurement of what
they believed after being told.

**Gate:** `GATE-DECISION-FOCUS`.

---

## LAW 2 — One primary action

> Every interaction state has exactly one primary action.

Permitted alongside it: one escape or navigation control at lower weight, and details behind a
disclosure. Forbidden: "here is the thing worth doing" beside three more buttons at the same visual
weight.

**The violation.** `PostGame` renders a `FindingCard` whose action the reading chose, and beneath it
a permanent `משחק חדש`. When the reading's action *is* "play another game", the screen offers the
same act twice under two different labels.

**Gate:** `GATE-ONE-PRIMARY-ACTION`, `GATE-NO-DUPLICATE-ACTION`.

---

## LAW 3 — State decides, screen renders

`PostGame` does not decide what comes next. Neither does `ResumeScreen`, nor `ClaimPanel`. One
function does:

```ts
nextAction(productState)
```

Screens render its answer. They do not compute their own.

**Why this is the structural law and the rest are its consequences.** Today the visual architecture
is the code architecture — Record, Home, Blitz, Claim, Drill, Learning, Game Review — and the player
has to know that map to get anywhere. Once state is the source of truth for "what now", most of what
looks like copy and layout stops being copy and layout.

**Gate:** `GATE-NEXT-ACTION-RESOLVES-BLOCKER`, plus the shadow-mode comparison that precedes
handing ownership over.

### What the first application of this law found

The law's narrow form — *a screen reads the record, it does not keep its own copy of it* — was
applied to `Blitz.tsx` when the analysis moved to a queue. `PostGame` had been rendering from the
record the screen assembled in component state; it now reads the record back through
`useStoredBlitzRecord`.

The screen immediately went blank after every game in a real browser, and the reason was not the
change:

> `performance.now()` returns a double. `commit()` froze the think time as `nowMs - turnStartedAtMs`,
> so a real browser produced `3947.6999999999998`, and `storedBlitzRecordSchema` requires
> `z.number().int()`. **Every blitz game ever played in a browser was refused on its way to the
> record.** The screen showed a complete post-game reading anyway, because it was reading its own
> copy — and the sentence beside it said `המשחק עצמו נשמר`.

Three layers of testing were green throughout. The jsdom suites mock `performance.now()` to whole
milliseconds, because a test that means "four seconds" writes `4000`. The browser audit asserted a
post-game **card**, which the screen rendered from its own copy either way. So the single property
that separated every fixture from a real browser was the single property the schema checked.

The fix is `shared/measured-duration.ts` — two clock readings become a stored duration in one place
— and the three tests that now hold it: `tests/shared/a-clock-that-does-not-tick-in-whole-
milliseconds.test.ts`, a fractional clock in `tests/client/the-tab-closed-during-the-analysis.test.tsx`,
and a `localStorage` assertion in `tests/layout/every-blitz-state.layout.test.ts` that reads the
record rather than the screen.

**The general lesson, which is the law itself:** a screen holding its own copy of the record cannot
report that the record refused it. Every such copy is a place where the product can be confidently
wrong, and no amount of testing *the screen* can find it — the tests and the screen share the copy.

---

## LAW 4 — Never navigate away from unfinished truth

> No call to action may cause something that already happened in the world to be lost, or left
> permanently half-recorded.

**The violation.** A blitz game can be `pending`; `PostGame` offers "play another game"; and the
analysis that would move it to `complete` lives in a `useEffect` inside `Blitz.tsx`, so it depends on
that component staying mounted. R-02 fixed the half of this that lost the game itself — the record is
written before the engine runs — and left the analysis tied to the screen.

**Gate:** `GATE-PENDING-WORK-LIVENESS`.

---

## LAW 5 — Focus mode hides the laboratory

> While performing an act, the player does not see every instrument around it.

`DECIDE`, `INSTRUMENT`, `PROBE`, `DRILL` and `TRANSFER` get focus. The toolbox exists in exactly one
mode: `EXPLORE`.

**Gate:** `GATE-TOOLBOX-OUTSIDE-FOCUS`.

---

## LAW 6 — Details never carry the main meaning

The player must not have to open *"why are we saying this?"* to learn what happened and what to do.
Engine version, depth, cp-loss, `n` and protocol stay there — and stay there.

**This one is already right.** `PostGame` and `RevealPanel` both put the instrumentation behind a
closed disclosure and the meaning in front of it. The law exists to stop that being undone, not to
introduce it.

---

## LAW 7 — Do not ask twice for a decision already made

A player who chose `3+0` should not be asked to choose among four time controls before the next
game. A player who chose White, depth 4, per-decision reveal should not fill in all three again.

**The violation.** `NewGameSetup` takes colour, depth and reveal timing on every opening.
`Blitz.tsx` offers the same four controls every time.

The default becomes **play again with the last settings**, with the full form behind it.

**The exception, and it is not decorative:** a randomised assignment in an experiment. There, asking
again — or rather, assigning again — is the protocol, and remembering would break it.

**Gate:** `GATE-REUSE-CONFIG`.

---

## LAW 8 — Never fabricate measured input

Nothing is pre-selected to save a click: not a confidence, not a known or unknown read, not a
mechanism, not a yes/no on a process question.

`CommitmentScreen` already refuses to pre-select answers. **Inertia is not data fabrication**, and
this law exists so that a later reading of LAW 7 cannot be stretched into one.

---

## LAW 9 — Instrument friction is research-gated

Three things look like bad UX and may not be changed because they are annoying:

1. the confidence question,
2. the sampled known/unknown reads,
3. the counterfactual probe.

The repository already records why each is shaped as it is: the reads appear only on sampled
decisions because asking on every move stopped players finishing games, and the probe fires on about
35% of eligible decisions by research design.

These change through an experiment or they do not change. See **What is on hold** below.

---

## LAW 10 — Automate only when the next state is deterministic

Good: analysis finished → show the result. Bad: the player picked one item from a multi-select →
assume they are done.

**This one is already right.** `CommitmentScreen` auto-advances after a move, which is a single act,
and does not after `known` or `unknown`, which are multi-select. Preserve it.

---

## LAW 11 — One board, one story

Within one flow, the product does not show a board at the final position and a second board at move
23 of the same game. It changes the board it already has: `FINAL → REVIEW(move 23) → BACK`.

**The violation.** `Blitz.tsx` renders a second `<ChessBoard>` in a `.blitz-review` section beneath
the finished game's board.

**Gate:** `GATE-ONE-BOARD-ONE-STORY`.

---

## LAW 12 — Feedback exposure is evidence context

> A decision made after the player has already seen feedback about a pattern is not automatically
> comparable with a decision made before that feedback.

This is the law that connects the UX work to the measurement, and it is the reason the audit comes
before D04 rather than after.

**It is a question, not yet an answer.** Before Discovery widens, `DecisionAtom`, `evidence-policy`,
`discovery` and `validation` are read to establish whether decisions taken after a reveal, a claim
or a learning intervention are pooled with decisions taken before one. If they are, a contract is
needed — an exposure epoch, a flag, a count — and **this document does not choose which.** Choosing
a schema before the audit is exactly the blind change the audit exists to prevent.

**Gate:** `GATE-EXPOSURE-CONTEXT`.

---

## What is on hold, and why holding is the decision

Three things are deliberately not touched. Each is held because changing it would change the
instrument, and none of them has the evidence that would justify that.

| held | why | what would release it |
| --- | --- | --- |
| the 1–7 confidence scale in blitz | replacing it with words could move latency, the distribution and the meaning of the scale itself | a preregistered UX/measurement experiment |
| the sampled known/unknown reads | they already fire only where they produce a complete observation | completion by step, abandonment, time per step, refusal — measured first |
| the counterfactual probe at ~35% | a skip button produces self-selection, which the repo already documents | a burden/reactivity study |

**Holding is not deferral by another name.** Each of these has a named release condition that is a
measurement rather than a judgement, in the same shape as the reversal conditions in
`docs/decisions/`.

---

## Success is not fewer clicks

Fewer clicks can mean less engagement, or automation that guessed. What is measured instead:

| metric | what it asks |
| --- | --- |
| `time_to_next_correct_action` | from the screen appearing to the action the state machine called correct |
| `wrong_turn_rate` | how often a player enters a surface that is not the next action |
| `backtrack_rate` | how often they come back because the path was wrong |
| `idle_before_action` | how long they stand still |
| `abandonment_by_state` | which interaction mode they leave from |
| `help_open_rate` | not bad on its own — but a state that opens help five times as often as the others is not self-evident |

**And beside every one of them, the validity metrics**, on any change that touches the instrument:
decision time, completion, move quality, next-move behaviour, attrition, response distribution. So
that we never buy better UX with a different measurement.

---

## Definition of done

The inertia work is not closed until all of these hold:

- every state that is not a measurement question scores **≤ 2/10 on brake score**; measurement
  states may score higher and must say why;
- **at most one primary action per state**;
- **zero feedback surfaces during `DECIDE` / `INSTRUMENT` / `PROBE`**;
- **no navigation path can destroy pending evidence**;
- a returning player is not asked to re-choose a configuration that has not changed;
- a player can answer *what happened / what does it mean / what now* within seconds, without reading
  a paragraph;
- and the player never needs to know what `ClaimPanel`, `RecordDashboard`, a drill, a transfer or
  discovery are in order to reach the next thing.
