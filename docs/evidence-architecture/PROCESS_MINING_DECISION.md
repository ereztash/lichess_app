# Process mining

# Verdict: `DEFER`, with one thing worth doing first that is not process mining

---

## The one genuine event log this product has

`bounded_action.candidate_moves_considered` is an **ordered sequence of events with a timestamped
terminal event** — every distinct move physically placed on the board while deciding, in touch order
(`keepTouchOrder`), ending in the committed move. That is the shape PM4Py consumes.

**It is also the only one.** Nothing else in `DecisionAtom` is a sequence.

## Why `DEFER` rather than `ADOPT`

**1. Process mining discovers a model of a process; it does not validate what the events mean.**
Conformance checking would tell you that players who place the engine's move first and commit last
follow a different trace than those who do not. It cannot tell you whether placing a move is
considering it.

**2. The array's asymmetry is fatal to trace completeness, and is documented.** A move is in the log
**only if it was physically placed**. A player who weighed four moves in their head and touched one
leaves a trace of length one. **A process model built on systematically truncated traces models the
interface, not the deliberation.**

**3. Imported games have empty logs**, so any analysis runs only on live decisions — and the count of
those has never been measured.

**4. Licence.** PM4Py is GPL-3.0, compatible with this GPL-3.0 repository. **Not a blocker**, and
recorded so the decision is not attributed to one.

## What to do instead, and it costs one query

> **Measure the `chose-past-it` base rate.**

`shared/reveal.ts` states the gap in its own words: *"None of which matters if it fires on three
decisions in a hundred. That number has never been measured."*

It is the only production observation that supports M1 over M0
([`MODEL_COMPARISON.md`](MODEL_COMPARISON.md)), the only one that separates *"generated it and
rejected it"* from *"never generated it"*, and it needs no participant, no arm, no new field and no
library. **If it fires rarely, every process-mining question about this log is moot.** If it fires
often, the log is worth modelling and PM4Py becomes the right tool.

**That measurement is ranked first in [`ROADMAP.md`](ROADMAP.md) among items needing no humans.**
