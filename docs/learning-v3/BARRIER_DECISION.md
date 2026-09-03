# Which barrier is first — and the one that turned out to be first is not in the chain

**Verdict for `RC-05 safe-promotion`, the only class that passed both gates:**

```text
INSUFFICIENT_OPPORTUNITIES
```

**The rule is true, safe, and governed by its trigger. It is not worth teaching**, because the
behaviour it would change is rare, and where it occurs, declining to follow it is usually free.

**A frozen falsifier fired.** `F-E5-c`, written in `FALSIFICATION_REGISTER.md` before the repository
was read and marked as one of only three executable without participants, said:

> *"Natural opportunities are so rare that `P(Y|X)` cannot be estimated at any feasible N →
> **E5's endpoint is unmeasurable in this product.** Stop condition `INSUFFICIENT_OPPORTUNITIES`."*

It fired, for this class, on evidence gathered after it was frozen.

---

## 1. What the barrier chain looked like coming in, and what moved

`BARRIER_MODEL.md`'s eleven barriers, with the status this cycle derived rather than assumed:

| # | barrier | before | after |
| --- | --- | --- | --- |
| 1 | valid insight → attention | product concern | unchanged |
| 2 | comprehension → representation | plausible, not next | unchanged |
| 3 | representation → **content validity** | *"real architectural gate. Missing in the product."* | **this is where it stopped.** §3 |
| **4** | content validity → **action-model validity** | *"the first unresolved pre-human barrier"* | **RESOLVED** for `RC-05`. Gate A |
| **5** | action-model validity → **item exchangeability** | second unresolved | **RESOLVED** for `RC-05`. Gate B, `B-PASS` |
| 6 | → trigger recognition | plausible, not isolable | **now isolable, and not reached** |
| 7 | → action selection | highest-value human question | not reached |
| 8 | → conditional discrimination | measurable in research, absent from the loop | not reached |
| 9–11 | memory, time pressure, ecological transfer | later | not reached |

Two barriers fell. The programme did not advance to barrier 6, because a question that is not on the
chain answered first: **is there enough of this behaviour, and does it cost enough, for a change in
it to matter?**

---

## 2. The measurement that decided it

`played_move_cost.py`, on all 370 trigger-positive `RC-05` items with a recorded human move. 557
engine searches, and **183 evaluations reused from the cache** rather than re-searched.

The question: of the players who did **not** promote to a safe square when they could, how many lost
anything?

| | followed the rule | **declined the rule** |
| --- | --- | --- |
| n | 222 | **148** |
| **expected score** | | |
| median regret | 0.0000 | **0.0000** |
| p90 regret | 0.0000 | **0.0000** |
| share costing nothing | .969 | **.912** |
| share costing ≥ 0.10 | .005 | **.054** |
| **centipawns**, on the third of items where cp means anything | | |
| items scorable in cp | 62 | 69 |
| median regret | 37 | **37** |
| p75 | 80 | **98** |
| p90 | 169 | **178** |
| **share losing ≥ 100 cp** | **.210** | **.232** |

> **The centipawn half of this table was wrong in the first version of this file, and the correction
> makes the verdict stronger rather than weaker.** It read `.041` against `.203` and said *"in
> material, declining is a real error — five times the rate among those who followed"*. That was an
> artefact of a mate-score guard written as `abs(cp) >= MATE_SCORE`, which never fires:
> python-chess returns `mate_score - n` for a mate in n, so mate encodings walked into the
> centipawn quantiles. **239 of 370 items have a mate on one side** — they are promotion positions
> — so cp is meaningful on barely a third of them, and on that third the two groups sit within .022
> of each other. Found by chasing a review bot's finding about cache scoping. See
> `ADVERSARIAL_PASS.md` A-9.

### Both scales now say the same thing

**Declining a safe promotion costs almost nothing, on either scale.** 91.2% of declines cost nothing
at all in expected score and only 5.4% cost 0.10 or more; on the third of items where centipawns
mean anything, declining blunders at **.232** against **.210** for following.

**The reconciliation is in the positions.** `V*` on `RC-05`'s trigger-positive cell:

```text
median 1.000     83.0% of items are already won (V* >= 0.95)
p10    0.000     15.9% are already lost (V* <= 0.50)
```

A player with a pawn on the seventh and a safe promotion square is usually winning several ways at
once. Dropping a rook in a won position is a real mistake in material and often not one in result.

**`action_set.py`'s own docstring predicted this shape** before any of it was measured:

> *"A rule class with `regret_B` = 0 on every item and advantage = 0 on every item is perfectly safe
> and teaches nothing — it permits the best move and so does everything else."*

`RC-05` is not quite that. It is close enough that the distinction stops mattering for a product.

---

## 3. The yield, worked through

The quantity a learning intervention is worth is the rate at which it changes a decision that
changes something.

```text
trigger fires                            370 / 180,000 sampled positions   = 0.206%
player declines                                                   1 - .575 = 42.5%
declining costs >= 0.10 expected score                                     =  5.4%
--------------------------------------------------------------------------------
game-result-relevant opportunity per sampled position                      ~ 4.7e-5
```

Roughly **one per 21,000 sampled positions**. At the corpus's three sampled plies per game that is
one per seven thousand games; scanning every ply of a real game raises the denominator without
raising the rate per game much, because the trigger fires in a narrow window near promotion.

**An intervention that worked perfectly — every decline converted — would change a game outcome
about once every few hundred games at best**, and to *measure* that change with a trigger-negative
control requires many multiples of that.

`ANCHOR_REBUILD.md` already listed *"that `RC-05`'s base rate of 0.22% permits a within-person
study"* among the things it does **not** establish. This run reproduces the base rate at **0.206%**
and answers the open question: it does not.

---

## 4. Why this is not a failure of Gate A or Gate B

Both gates asked measurement questions and both were answered:

* **Gate A** — is the final action a valid observation of rule use? For `RC-05`, yes. Obeying costs
  +0.0383, its permitted set is the only one in the corpus whose ninetieth-percentile member costs
  nothing, and its `T−` cell prescribes something that can be wrong.
* **Gate B** — can a behavioural difference be attributed to the trigger? For `RC-05`, yes. Against a
  matched sham that does not flip the trigger, advantage **+0.1812** [+0.1431, +0.2192].

**A valid instrument pointed at a phenomenon that is too small to be worth instrumenting.** That is a
different finding from an invalid instrument, and collapsing the two would lose the thing this cycle
actually learned.

**It also is not a failure of `WHEN X → DO Y`.** The unit was never tested. `F-E1-c` — *the unit
cannot be expressed for any validated rule class* — did **not** fire: `RC-05` expresses it cleanly,
with a board-only cue and a move-property action. What fired is the endpoint's feasibility, not the
packet's form.

---

## 5. The barrier that is actually first, named properly

Not a human barrier. Barrier **3**, content validity, in a sense `BARRIER_MODEL.md` states and this
cycle can now quantify:

> *"the rule is memorable and wrong, overbroad or **underdetermined by chess**"*

`RC-05` is none of memorable-and-wrong or overbroad. It is **underdetermined by consequence**: the
chess fact is true, the action is safe, and doing something else is usually just as good. The
repository's existing gate for this — `mayPrescribe`, true only at `tested` — is the right mechanism
and would have refused the packet anyway; what it lacked was a number saying *why*.

**The missing screen, and it is free.** Between `C11` (does the negative cell carry information?) and
Gate A (is the permitted set safe?) there is no criterion asking:

```text
C12   among the players who did NOT follow the rule, what did it cost them?
      no engine beyond one search per item, no participants, no new corpus
```

For `RC-05` it answers **.926 nothing / .054 at least 0.10 expected score**, and that is the number
that decided this cycle. It is proposed, not adopted: `ACTION_SET_AUDIT.md`'s revision is the
measurement model this cycle changed, and adding a criterion mid-programme is exactly what `C11` did,
so the bar for it is a separate decision with its own evidence.

---

## 6. Which packet type, if the barrier had been human

Recorded because the question was asked and the answer is derivable, and marked as unreached.

Study D distinguishes recognition failure from action-selection failure. **For `RC-05` it is not
worth running**, per §3. Had it run, the packet type would have followed:

| Study D result | packet |
| --- | --- |
| State 1 dominates — X occurred, the player did not detect it | **Type B**: `X vs X'` boundary, then `WHEN → DO` |
| State 2 dominates — detected X, chose non-Y | **Type A**: `WHEN X → DO Y` |
| State 3 — Y rises under X and ¬X alike | **Type C**: `X → Y`, `not-X → do not invoke Y`, contrastive |
| State 4 — asking about X changes the move | **no packet.** The instrument is the intervention; fix the instrument |

**None of these is chosen.** `INTERVENTION_EXPERIMENT.md` is `NOT ADMISSIBLE` and says so.

---

## 7. What to do instead, in order

1. **Run `C12` over all seventeen classes.** One search per trigger-positive item with a recorded
   move, roughly 4,000 searches — a fifteenth of what this cycle spent — and it would rank every
   class by *the thing that decided this one*. `RC-02 recapture` is the obvious first look: `C11`
   MEASURABLE, base rate **12.2%** (sixty times `RC-05`'s), unaided human rate **.769**.
2. **Build twin banks for `RC-02`, `RC-03`, `RC-04`.** Construction is engine-free; scoring is ~4,500
   searches each. This also tests whether §6 of `EXCHANGEABILITY_AUDIT.md` generalises — that natural
   separation understates classes with local triggers — or is a fact about promotions.
3. **Measure the true opportunity rate per game**, scanning every ply rather than three per game. No
   engine, no participants, and no field protocol can size itself without it.
4. **Only then** ask which class is worth a human study, and only then Study D.

**Do not** search for rule class eighteen before (1). The register's own failure ontology says four
of its five recurring mechanisms are checkable with no engine at all, and `C11` alone would have
retired ten of these seventeen before a search ran.

---

## 8. Falsifier dispositions

From `FALSIFICATION_REGISTER.md`, frozen before the audit:

| id | disposition |
| --- | --- |
| **`F-E5-c`** | **EXECUTED — REFUTED, for `RC-05`.** Opportunities are too rare and too cheap; `E5`'s endpoint is unmeasurable on this class. **Not** a refutation of `E5` in general: `RC-02`'s base rate is 12.2% |
| `F-E1-c` | **EXECUTED — NOT REFUTED.** `WHEN X → DO Y` is expressible for a validated class: `RC-05` has a board-only cue and a move-property action |
| `F-E3-b` | **EXECUTED — NOT REFUTED.** `RC-05`'s cue needs no engine quantity. `_promote_trigger` is a legal-move scan and an attacker lookup |
| `F-E1-a`, `F-E1-b`, `F-E2-a/b/c`, `F-E3-a`, `F-E4-a/b/c`, `F-E5-a/b` | **NOT EXECUTABLE.** Every one needs participants, and zero remains the correct cost |
| `F-C-a`, `F-C-b`, `F-C-c` | **NOT EXECUTABLE.** All three are about which packet is minimal, and no packet reached a player |

**Three of the three executable falsifiers ran. One fired.** That is the register doing its job
without a single participant, which is what it was written for.
