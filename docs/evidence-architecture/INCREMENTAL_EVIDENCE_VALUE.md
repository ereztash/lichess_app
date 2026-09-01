# Incremental evidence value

**The question for every observation is one question, and it is not whether the observation is
interesting.**

> Does this observation let us distinguish a **decision-relevant latent state** that the cheaper
> evidence could not distinguish?

If the answer is no, it comes out of the proposed architecture. This file is the complexity control.

Numbers are the Bayes-optimal separations from
[`IDENTIFIABILITY_SIMULATION.md`](IDENTIFIABILITY_SIMULATION.md), read as **deltas** rather than as
levels.

---

## First, what the product already collects

This is the largest correction the audit makes to the shape of the question, and it changes which
rungs are actually "additions". `DecisionAtom` (`shared/decision-atom.ts`) already stores, per
decision, **before any reveal**:

| already shipped | field |
| --- | --- |
| position | `entry_state.fen`, `ply`, `phase`, `clock_ms_remaining` |
| move | `decision` |
| time | `bounded_action.seconds_taken` |
| **confidence** | `bounded_action.confidence`, with `confidence_scale` and `confidence_grid_version` so an old row still asserts what the player said |
| **candidate set** | `bounded_action.candidate_moves_considered` — every distinct move physically placed on the board |
| **candidate order** | the same array, in **touch order** (`keepTouchOrder`) |
| **a randomised probe arm** | `probe.assignment` / `legal_moves` / `answered` / `alternative` / `alternative_cp_loss`, present on unprobed decisions too so the arm has a denominator |

**So the ladder does not start at `position + move + time`. It starts four rungs up**, and three of
the "expensive additions" a Learning-UX proposal would ask for are already in the record, collected
without prompting, with the reactivity question already thought through (`CommitmentScreen` discloses
that candidates are recorded and deliberately does not count, target, or praise them).

---

## The ladder, priced

Each row: what it costs, what it buys, and the verdict. **`Δ` is the change in Bayes-optimal
separation on the pair it is supposed to serve.**

| # | observation | cost | Δ, and on which distinction | verdict |
| --- | --- | --- | --- | --- |
| 0 | position + move | — | baseline; separates nothing but A/B, and that at **.863** | baseline |
| 1 | **the trigger-negative cell** | corpus work, no new instrument | **+.48 on C/D** — .500 → .983 — **but only if the response predicate does not saturate** | **KEEP. It is the single highest-value observation in the programme** |
| 2 | time | already shipped | +.02 on A/B; **+.29 on L7** (.500 → .786) | KEEP — it is free and it is the only handle on calculation-vs-recognition |
| 3 | confidence | already shipped | **not tested here.** It is a report *about* the decision, produced after it, and asked non-randomly (`confidence-asked.ts`) | **KEEP, do not add.** Already collected; not to be added to a study as a new prompt |
| 4 | **candidate set** | already shipped | **+.010 on A/B (.990 → 1.000), within noise on all five others** | **KEEP, and read it narrowly** |
| 5 | candidate order | already shipped | not separately tested; the register says it is the only handle on C1-vs-C2 | KEEP |
| 6 | **a timed condition** | one arm | **+.30 on E/F** — .500 → .797. **Nothing else moves it** | **ADD when a study runs** |
| 7 | **a delayed condition** | one session | **+.30 on G/H** — .500 → .795. **Nothing else moves it** | **ADD when a study runs** |
| 8 | **a generic-cue arm** | one arm, no rule content | **+.44 on the cue pair** — .500 → .940. **Nothing else moves it** | **ADD; it is also the M0/M1 discriminator** |
| 9 | revision after a cue | derivable from 8 + candidate order | not separately tested | keep as a derived quantity |
| 10 | think-aloud coding | laboratory, two coders, reliability statistics | **0.000 on C/D under the valid predicate** | **REMOVE from the proposed architecture** |
| 11 | mouse trace | instrumentation + `mousetrap` | as above | **REMOVE** |
| 12 | gaze | WebGazer far below the required precision; lab hardware otherwise | as above | **REMOVE** |
| 13 | autoconfrontation | laboratory, video, per-participant hours | as above | **REMOVE** |

---

## The four results this table contains

**1. The most valuable observation in the programme is the cheapest one, and it is a corpus
property, not an instrument.** A trigger-negative cell scored by the *same response predicate* is
worth **+.48** on the distinction the whole construct rests on. It needs no participant, no
hardware, and no prompt. **It is also the one the programme does not have** — which is why every row
below it is worth so little today.

**2. Rows 10–13 are removed on evidence, not on cost.** This is the point of the exercise. Under the
valid response predicate, `C/D` sits at **exactly .500** with move, both cells, time, a timed
condition, a delayed condition, a generic cue **and** the candidate set. **Adding think-aloud,
mouse traces, gaze or autoconfrontation to a saturated noise cell distinguishes nothing**, because
the states are observationally equivalent in the *response*, and no amount of measuring the *process*
changes what the response means.

> **This is the finding that keeps Execution 2 shut.** Process evidence is not the answer to a
> degenerate noise cell. It is the answer to a *different* problem — one the programme has not
> reached, because it is downstream of having a contrast worth explaining.

**3. Three of the highest-value remaining items are experimental *conditions*, not measurements.**
Rows 6, 7 and 8 each move exactly one distinction off chance, and nothing else moves it. A timed
condition is not the same as recording seconds; a delayed condition is not the same as a longer
session. **What the architecture is short of is arms, not sensors.**

**4. The candidate set earns its place, and only on one distinction.** +.010 on A/B, noise
everywhere else. That is a narrow claim, and it matches the array's documented one-sidedness
(presence near-conclusive, absence uninformative) and the Shogi protocol finding that **experts
generate fewer candidates** — so nothing built on this array may be monotone in its length.

---

## What comes out of the proposed architecture

**Removed:** think-aloud coding, mouse-trajectory capture, gaze, autoconfrontation. Not because they
are expensive — because they are worth **zero** on the distinction that matters, at any price, while
the noise cell is saturated.

**Kept and already free:** time, confidence, candidate set, candidate order, the probe arm.

**Queued behind a valid rule class:** the trigger-negative cell, and the three conditions (timed,
delayed, generic cue).

**The one measurement worth making before anything else**, and it uses only data already stored:

> **The `chose-past-it` base rate.** `shared/reveal.ts` says it in as many words — *"None of which
> matters if it fires on three decisions in a hundred. That number has never been measured."* It is
> the only production support M1 has over M0, it is a query over the existing record, and it needs
> no participant, no arm and no new field.
