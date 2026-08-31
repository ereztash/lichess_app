# The gap between what a task can show and what a player does

**Claim this document refuses:** that a change measured in a choose-a-move task is a change in
chess behaviour.

Those are two claims, and collapsing them is the single most common failure in learning-technology
evidence. This file keeps them apart by force: a **ladder** whose rungs are separately measurable,
and a statement of what each rung does and does not license.

Framework: Barnett & Ceci (2002) for transfer distance, Brunswik's representative design (Dhami,
Hertwig & Hoffrage 2004) for whether the items resemble the world, and the prospective-memory
monitoring/spontaneous-retrieval distinction (Einstein & McDaniel 2005) for what "uncued" has to
mean.

---

## The ladder

Each level is a **separate evidence claim**. A score at one level is not a discounted version of the
level above; it is a different quantity. **They are never summed, averaged, or reported as one
number.**

| level | what is measured | how the player is cued | what a positive result licenses | what it does **not** license |
| --- | --- | --- | --- | --- |
| **L0** | explicit recognition | the rule is named and shown | "they can state it" | anything about doing it |
| **L1** | cued application | "apply the rule you just learned to this position" | "they can execute it on demand" | that it happens when nobody asks |
| **L2** | uncued application, constructed position | a position built to contain the trigger; no rule named | "the condition can control the act in a purpose-built board" | that it survives a board with other things going on |
| **L3** | uncued application, representative choose-a-move | a position **sampled from real games**; no rule named | "the condition controls the act in positions like the ones that occur" | that it happens while a game is being played |
| **L4** | prospective opportunity in ordinary game review | the player reviews their own game; the trigger is present; nothing points at it | "they notice it in their own material" | that they noticed it *at the time* |
| **L5** | behaviour during natural blitz play | the game supplies the cue; the product says nothing | **the target claim** | that the intervention caused it — that is a separate design question |

**A lower level can be valid while extrapolation fails, and that is a real result, not a
consolation.** L2 improving while L3 does not is informative: it says the knowledge exists and does
not survive competition from the rest of the board.

---

## Where the current design sits

**L2, aspiring to L3, and it does not reach L3 today.**

The obstacle is measured rather than assumed. The Lichess puzzle bank — the obvious source of items
— is selected by `generator.py::is_valid_attack`, which keeps a candidate only when the engine's
best move beats its second-best by **more than 0.7 in win-chance**, or is the unique winning move,
or is a valid mate-in-one. In representative-design terms that is a severe restriction of range on
the exact dimension that makes a decision hard. A bank drawn from it can support an L2 claim. It
cannot support an L3 claim, because "positions where one move is overwhelmingly best" is not the
population of positions in ordinary play.

The unfiltered game corpus scanned here **is** a representative frame, and the same scan shows why
that does not immediately solve the problem: in that frame, 13.5% of T+ items carry a competing
tactical explanation and 37.1% of T− items are captures SEE calls sound. **Representativeness and
interpretability trade against each other here**, and every design choice in this program is
somewhere on that trade.

---

## The four gaps between L3 and L5, each with what it would take to close it

**Gap 1 — the opportunity has to be found prospectively.**
In a task, the item *is* the opportunity. In a game, nobody knows an opportunity occurred until
afterwards. An ecological study must detect trigger states prospectively from the game record, with
a predicate frozen in advance, and must count the ones the player *missed* — which no puzzle
paradigm ever has to do. `predicates.py` can do this: it runs on any position, and the scan over
60,000 real games is exactly that operation. The base rate is high — **20.4% of classifiable
positions** — so opportunities are not scarce.

**Gap 2 — the cue must come from the game, never from the product.**
This is the prospective-memory distinction, and it is not a UI preference. Einstein & McDaniel's
central finding is that telling a participant a cue is coming converts spontaneous retrieval into
monitoring — *a different process*. A product that says "watch for loose pieces this game" has
measured monitoring and may report it as learning. The requirement is absolute: **no screen, prompt,
badge, colour, ordering, or post-game summary may indicate that this rule class is under
measurement while measurement is running.**

**Gap 3 — behaviour during play is confounded by everything.**
Clock, opponent, tilt, pre-move, stakes, and the fact that a player who is losing faces different
positions. This is not hypothetical: in the game corpus, T+ items arise when the actor is **behind
by 1.8 pawns on average** and T− items when the material is level (SMD −0.487). **Trigger states are
not randomly distributed across game states.** In blitz they will be worse, not better.

**Gap 4 — measurement reactivity is unquantified.**
See [F7](FALSIFICATION_REGISTER.md#f7). Whatever the answer, an L5 claim built on players who have
just done forty T+/T− trials is a claim about players who have just done forty T+/T− trials.

---

## The two things an ecological study must never do

1. **Tell the player what is being measured.** Gap 2. The game supplies the cue; the measurement UI
   supplies nothing.
2. **Score only the opportunities the player took.** Detecting trigger states from moves that *were*
   captures selects on the outcome and guarantees a hit rate near 1. Trigger states are found from
   **positions**, before the move is read. `scan_games.py` does this and the ordering is visible in
   the code: `classify(board)` runs, then `observed_action(board, move, cls)`.

---

## Distance, in Barnett & Ceci's terms

From the task to natural blitz, along their dimensions:

| dimension | task | natural blitz | distance |
| --- | --- | --- | --- |
| knowledge domain | chess | chess | **none** |
| physical context | same screen | same screen | **none** |
| temporal context | minutes later | days–weeks later | **moderate** |
| functional context | "solve this" | "win this game" | **large** |
| social context | alone, unevaluated | alone, rated, opponent waiting | **large** |
| modality | click a move | click a move | **none** |
| specificity of skill | one rule | the whole game | **large** |
| memory demands | cue is on screen | must be retrieved spontaneously | **large** |
| performance change vs learned skill | same act | same act | **none** |

Five dimensions match exactly and four differ substantially — and the four that differ are the four
Barnett & Ceci identify as where transfer fails. **This is near transfer on surface features and far
transfer on function.** That combination is the one most likely to produce a good L2 result and no
L5 result, which is precisely the outcome this ladder exists to be able to report as a finding
rather than as a disappointment.

---

## What would have to be true before an L5 study is worth running

1. A construct that survives [`CONSTRUCT_DECISION.md`](CONSTRUCT_DECISION.md). *(Not met.)*
2. A trigger predicate frozen and versioned, runnable prospectively over game records.
   *(Met: `predicates.py` v1.0.0.)*
3. A measured estimate of reactivity. *(Not met.)*
4. Evidence at L2 and L3 that the discrimination is real and not an item effect. *(Not met — [F2](FALSIFICATION_REGISTER.md#f2).)*
5. A causal design that meets WWC SCD v5. *(Specified in [`ANALYSIS_PLAN.md`](ANALYSIS_PLAN.md), not run.)*

**One of five.**
