# Candidate player processes, and the ones this lane refused to implement

The mission names six candidate processes and asks that none be implemented mechanically. Each was
put against the same three questions before anything was built:

1. **What does it promise?** and is that promise reachable under the frozen evidence ceiling?
2. **What is its state when no personal pattern is ever found?** The telos requires the process to
   work there.
3. **What is its unit of progress, and is that unit rating?** Rating is forbidden as a progress unit.

Epistemic integrity is a **gate**, not a column that a high score elsewhere can outweigh. A
candidate that fails question 1, 2 or 3 is out regardless of how well it reads.

---

## A. The progress bar

`1500 → 1850, 43% complete`.

**Refused at question 1.** The denominator does not exist. `CAUSALITY`, `INTERVENTION` and `OUTCOME`
are unreachable by the discovery pipeline under any sample size, so there is no quantity of which
43% is a share. The repository already legislates this: a gate rejects a goal rendered in the same
element as a count where the reader would supply the arithmetic.

**Refused again at question 3.** Its unit is rating.

Nothing here is a close call. It is the clearest case in the set, and it is also the one the mentor
signal most directly invites, which is why it is listed first.

## B. Goal → Diagnose → Practice

**Refused at question 2.** Diagnose has no output when the detector returns `not-separable`, which
is its state on the owner's own 2,209-game record. The process then has no second step, and a player
who arrives at an empty Diagnose reads it as a fact about themselves. That is exactly case C5.

Partially salvageable: the *order* is fine. What fails is treating Diagnose as a stage that
terminates rather than as an instrument that can honestly return nothing.

## C. Pattern → Retry → Transfer

**Refused at question 2**, harder than B. It requires a found pattern as its entry condition, so in
the no-pattern state it does not start at all. It also collapses the C6 distinction: "Transfer"
here means prompted retry on a named pattern, which the research separates from unprompted play.

## D. "Managed effort"

The mentor's own framing: sell and manage the effort to move from X toward Y rather than guarantee Y.

**Survives question 1** — it is explicitly not an outcome promise, and that is its strength.
**Fails question 3 as stated.** X and Y are rating in every natural reading, so managing the
distance between them reintroduces rating as the denominator through the back door. The paired run
reached the same place on C8: retain the goal-oriented framing, represent a negotiated target,
current state, next checkpoint and reversal condition, but not percent-to-rating.

Kept as a **constraint on tone**, not as a process. This lane builds nothing that prices effort.

## E. The current learning ledger

Shipped in the previous lane: nine stages, each with a construct, a count and a denominator, or an
explicit "not established".

**Passes all three questions.** Its unit is decisions and sittings, never rating; it renders "not
established" rather than a number it cannot support; it has a defined state when nothing separates.

**Not re-implemented, and not the answer to this mission either.** It is a legible record of what
the instrument has, which is a different thing from a path a player would take. Left exactly as it
is.

## F. The current state machine and the five-question reasoning model

Both re-examined in `PAIRED_REASONING_TEST.md` and in the live run. The five questions survive as an
audit surface and fail as a *product* process, because a player does not experience five prompts.
The state machine survives as machinery. Neither was changed.

---

## The four hypotheses this lane actually raced

Frozen in `DR_PLAN_1.md` before the run, with **H-1 favoured**.

| | claim type | authority before the run | disposition after |
| --- | --- | --- | --- |
| **H-1** entry frame carrying the aspiration and the personal-inference promise | orientation and payoff | `OWNER_SIGNAL` only | **content refuted**, question re-opened |
| **H-2** time-to-value: first session's payoff too small against 60 decisions | accumulation | `FIELD_REQUIRED` | premise found unpriced, then falsified at REPO |
| **H-3** the import screen's visual claim outranks its textual one | perception and trust | relayed repository observation | **promoted out of the race**: already-supported defect, `REPO` + `OWNER`, no field debt |
| **H-4** build nothing; only FIELD can move this | — | — | **partially refuted**: the import contradiction does not need FIELD to establish |

### Why the favoured hypothesis lost

H-1's payload was "the personal-inference promise". Stated plainly, that promises the player that
something recurring **specifically in their decisions** will be found.

- Question 1: unreachable. The instrument cannot guarantee it under any sample size.
- Question 2: it is *false advertising precisely in the state the telos says must work*.

Its second component, the aspiration frame, fails question 3 by a route the plan did not name: a
chess player's stated aspiration is overwhelmingly rating-shaped, so an entry frame built around it
is the most likely path by which rating re-enters as a silent denominator.

The run's instruction was explicit:

> Do not build the entry frame with the personal-inference promise in it under any of these outcomes.

### The substitute, which was already in the repository and unrendered

> An import cannot produce a calibration gap, because old games carry no confidence stated before the
> engine spoke.

This is a statement about a **kind of evidence**, not a prediction of a result. It is true on the
first decision and on the thousandth; it stays true when no personal pattern is ever found; and it
is the actual separation from Chess.com analysis, Lichess analysis, puzzles and Aimchess. It needs
no field permission to be honest, because it asserts nothing about what the player will find.

It existed in the codebase **twice, as a caveat both times**, and never once as a reason to act.
That is what this lane changed.

### Why H-2's premise turned out to be unpriced

H-2 assumes the first session has no payoff, because 60 revealed decisions precede any claim. But a
single committed decision already yields, at n=1 and with no claim attached, the distance between
what the player said they believed and what was on the board.

Whether that is surfaced after commit is a `REPO` question, answerable without field work, and it
splits H-1 from H-2 directly. It was checked. It **is** surfaced, and it is already labelled by
evidence kind:

```
process: יצא ממה שנרשם לפני שהמנוע דיבר. ניתוח משחק רגיל לא מחזיק את זה.
engine:  יצא מהשוואה למנוע בלבד. לזה גם ניתוח משחק רגיל היה מגיע.
```

So H-2's premise is weaker than stated. The front-half gap is about **naming an existing payoff**,
not manufacturing a new one, which bounds the size of any front-half build to roughly a sentence.
That bound is what this lane's build respects.
