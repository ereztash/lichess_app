# The cognitive evidence matrix

**Q-matrix validation logic, applied to observations this product could actually make.** A cell says
what an observation supports about a construct — not what it is *about*, which is a different and
much easier question.

**No intuitive checkmarks.** Every `DIRECTLY-SUPPORTED` cell carries a rationale, a competing
mechanism and a falsifier. A cell with a plausible story and no falsifier is `AMBIGUOUS` by
definition.

**Grades**

| grade | means |
| --- | --- |
| `DIRECTLY-SUPPORTED` | the observation cannot plausibly arise without the construct being involved |
| `AMBIGUOUS` | the observation arises from the construct **and** from at least one competing mechanism, and nothing in the observation separates them |
| `UNSUPPORTED` | no evidential link established; the mapping is a hope |
| `CONTRAINDICATED` | the observation is measured, and the measurement argues *against* reading it this way |

**Availability**

| mark | means |
| --- | --- |
| **[P]** | already collected in production |
| **[R]** | available in the research corpus |
| **[L]** | laboratory only |
| **[X]** | not collectible by any current instrument |

---

## The matrix

Columns abbreviated: **OR**ientation · **TR**igger recognition · **CD** conditional discrimination ·
**DX** diagnosis · **CG** candidate generation · **CA**lculation · **CT**rol/verification ·
**AS** action selection · **RB** response bias · **TE** timed execution · **RT** retrieval ·
**RN** retention · **TF** transfer

| observation | OR | TR | CD | DX | CG | CA | CT | AS | RB | TE | RT | RN | TF |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **explicit threat detection** [L] | A | **D** | A | A | U | U | U | U | A | U | U | U | U |
| **missed threat** (explicit, negative) [L] | A | **D** | A | A | U | U | U | U | A | U | U | U | U |
| **move ∈ B** [P][R] | U | A | **C** | A | A | A | U | A | A | U | U | U | U |
| **chosen-move regret** [P][R] | U | U | U | A | U | A | A | **D** | U | U | U | U | U |
| **candidate moves** (placed) [P] | A | A | U | U | **D** | A | U | U | U | U | U | U | U |
| **candidate ordering** (touch order) [P] | U | U | U | U | A | U | **D** | A | U | U | U | U | U |
| **time** [P] | U | U | U | U | A | A | A | U | U | **D** | U | U | U |
| **confidence** [P] | U | U | U | A | U | U | A | U | A | U | U | U | U |
| **revision after a generic cue** [X] | A | A | U | A | A | U | **D** | U | U | U | U | U | U |
| **false application on T−** [R] | U | U | **D** | A | U | U | U | A | **D** | U | U | U | U |
| **response after a generic cue** [X] | **D** | A | U | A | A | U | A | U | U | U | U | U | U |
| **response after a rule-specific cue** [P] | U | C | U | U | U | U | U | A | U | U | **D** | A | C |
| **delayed novel response, uncued** [X] | U | A | A | U | U | U | U | U | U | U | A | **D** | **D** |
| **timed response** [P] | U | U | U | U | U | U | A | U | U | **D** | U | U | A |
| **Blitz response** [P] | U | U | U | U | U | U | U | U | U | A | U | A | A |

`D` = DIRECTLY-SUPPORTED · `A` = AMBIGUOUS · `U` = UNSUPPORTED · `C` = CONTRAINDICATED

---

## Every `DIRECTLY-SUPPORTED` cell, with its falsifier

**explicit threat detection → TRIGGER RECOGNITION.**
*Rationale:* an accurate yes/no about a board relation, given before the move, is the closest thing
to a direct read of recognition, and it is the one link the chess literature actually validates —
check detection (Sheridan & Reingold 2014), mate detection (Kuchelmeister et al. 2024), threat
detection with expert fixation within three seconds.
*Competing mechanism:* guessing at the base rate; inference from the interface (a question is only
asked when there is something to find).
*Falsifier:* detection accuracy that does not exceed the per-item chance rate, or that survives
scrambling the board.
**Note the cost:** asking is an intervention. This cell is `[L]` — laboratory — precisely because
putting it in the product changes the task.

**missed threat → TRIGGER RECOGNITION.** Same rationale in the negative direction, and it is the
*more* informative half: a false negative on an explicit question is hard to produce any other way.
*Falsifier:* misses that track legal-move count rather than the trigger.

**chosen-move regret → ACTION SELECTION.** *Rationale:* regret is defined on the move that was
chosen against the best available, so it is by construction about selection.
*Competing mechanism:* regret is also produced by calculation depth and by not having generated the
better move at all — which is why `CG` and `CA` are `A` in that row rather than `U`.
*Falsifier:* regret that does not change when the candidate set demonstrably contained the better
move (`chose-past-it`), which would show selection is not where the loss occurs.

**candidate moves → CANDIDATE GENERATION.** *Rationale:* a move physically placed on the board was
generated. This is as close to direct as this matrix gets.
*Competing mechanism:* placing is not considering — a slip, board exploration, rehearsing the
opponent's reply.
*Falsifier:* a think-aloud subset in which placed moves are not among the verbalised candidates at a
materially better rate than unplaced ones.
**The asymmetry is definitional and is documented in `shared/reveal.ts`: presence is near-conclusive,
absence is uninformative.** So the cell supports `CG` **upward only**.

**candidate ordering → CONTROL.** *Rationale:* `keepTouchOrder` preserves whether the engine's move
was touched **first and abandoned** or **last and rejected**. Those are opposite events and the
repository says so: *"One is 'you had it and talked yourself out of it'; the other is 'you weighed it
and decided against it' — and the two bodies of literature on move choice prescribe opposite
remedies."*
*Competing mechanism:* order reflects board geometry and mouse path, not deliberation.
*Falsifier:* touch order that predicts nothing about the chosen move once distance-on-board is
controlled.

**time → TIMED EXECUTION.** *Rationale:* it is the quantity. *Competing mechanism:* everything —
difficulty, interface, interruption, legal-move count. *Falsifier:* time that does not separate
blitz from untimed on the same items. **Only under a fixed protocol**: `measurement-protocol.ts`
exists because a duration means different things under different reveal timings.

**revision after a generic cue → CONTROL.** *Rationale:* a cue with no rule content cannot supply the
policy, so a changed move after one is a check that was available and not run.
*Competing mechanism:* the cue signals *"something is wrong here"* and induces a general search, not
a verification. *Falsifier:* revision rates identical on items where nothing is wrong.
**`[X]` — not collectible today.** This is the cheapest missing observation in the programme and the
sharpest M0/M1 discriminator ([`MODEL_COMPARISON.md`](MODEL_COMPARISON.md) obs. 5).

**false application on T− → CONDITIONAL DISCRIMINATION and RESPONSE BIAS.** *Rationale:* performing
the action when the trigger is absent is the only direct evidence that the action is *conditional*
on anything. **This is the cell the entire programme turns on.**
*Competing mechanism:* the action is right for another reason on that item.
*Falsifier:* **the one that fired.** If the response predicate on T− scores a different act, the cell
is void — and on `RC-06` it does ([`RECONCILIATION.md`](RECONCILIATION.md) §2.6a). The two
`D` grades in this row are conditional on a `BehavioralTransferSpec` with **one** response
predicate, which no eligible rule class currently has.

**response after a generic cue → ORIENTATION.** *Rationale:* a contentless cue can only redirect
attention. *Competing mechanism:* it also signals that this item is unusual.
*Falsifier:* the same effect from a cue delivered on a random item. **`[X]`.**

**response after a rule-specific cue → RETRIEVAL.** *Rationale:* the rule is named, so what is
measured is whether it can be brought back and applied. *Competing mechanism:* the cue contains the
answer. *Falsifier:* the same response rate from players who never authored the rule.
**This is what the shipped drill measures**, and it is `C` for `TRANSFER` — see below.

**delayed novel response, uncued → RETENTION and TRANSFER.** *Rationale:* delay plus novelty plus
absence of a cue is the definition of the target construct. *Competing mechanism:* the novel item is
easier; general improvement over the interval. *Falsifier:* the same rate in a group that never
received the intervention. **`[X]` — nothing in the repository measures this.** D24's table says so:
*"Nothing in the repository measures L5–L6, which is the target."*

**timed response → TIMED EXECUTION.** As above, under a protocol.

---

## The `CONTRAINDICATED` cells, which are the point of the exercise

**`move ∈ B` → CONDITIONAL DISCRIMINATION: `CONTRAINDICATED`.**
Not merely unproven — **measured, and the measurement argues against it.** On `RC-06`, the only
class ever found eligible, **99.4% of legal moves satisfy the rule as written on trigger-negative
items**, and the engine's best move satisfies it on **250 of 250** (§2.6a). An observation that is
true of nearly everything when the trigger is absent cannot indicate that behaviour is conditional
on the trigger. The published .200 that suggested otherwise is a *different predicate's* rate.

Separately, `B` is broad where it matters: `RC-06` permits a median **29.7%** of legal moves, of
which **28.6%** are safe, and on **84.7%** of positive items some permitted move loses ≥100 cp. **A
player who answers the mate threat and loses a rook scores a hit.**

**`response after a rule-specific cue` → TRIGGER RECOGNITION: `CONTRAINDICATED`.** The cue *is* the
recognition. Naming the rule and then measuring whether the player applies it removes the thing being
measured. `docs/learning/` reaches this independently: the drill is L4 *"and only if the act is
rule-specific"*, because the rule under test is explicitly cued.

**`response after a rule-specific cue` → TRANSFER: `CONTRAINDICATED`.** Same reason, one level
harder. Cued retrieval is the definitional opposite of uncued transfer, and `docs/learning/` already
carries the finding that the shipped conjunction — lexical recall floor **and** move accuracy —
reaches `replicated` 47–81% of the time in one sitting from base rates alone.

---

## What the matrix shows as a whole

1. **Two columns have no `DIRECTLY-SUPPORTED` cell from any production observation: `DIAGNOSIS` and
   `POLICY ACTIVATION`.** Every candidate route to them is `[L]` or `[X]`. These are the two stages
   that distinguish M1 from M0.
2. **The one column with a production-available `D` cell that the programme has never used is
   `CANDIDATE GENERATION`** — `candidate_moves_considered` is collected, disclosed to the player, and
   its base rate has never been measured.
3. **The `CONDITIONAL DISCRIMINATION` column is the whole construct, and its only observation is
   `CONTRAINDICATED`.**
4. **Three of the sharpest cells are `[X]`** — generic-cue response, generic-cue revision, delayed
   uncued response — and two of the three need no laboratory, only a randomised arm the product does
   not have.
