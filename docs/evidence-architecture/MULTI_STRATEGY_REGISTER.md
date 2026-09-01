# The multiple-strategy register

**For every critical observation, what else could have produced it.** The register exists because the
programme's recurring failure mode is not a wrong number — it is a correct number read as evidence
of one mechanism when several produce it.

---

## Register 1 — `the move stops mate`

The observation `RC-06` is built on. Ten mechanisms that produce it:

| # | mechanism | how often it could be the whole story |
| --- | --- | --- |
| M1 | explicit mate-threat recognition, then a policy | unknown |
| M2 | calculation without any explicit classification | unknown; the Shogi protocol work shows experts read narrow-and-deep |
| M3 | a generic forcing-move heuristic that happens to stop it | unknown |
| M4 | familiarity with the pattern, no threat concept | unknown |
| M5 | coincidence — the move was chosen for something else | **bounded, and the bound is large** |
| M6 | it was the only plausible move | measurable: legal-move count is stored |
| M7 | prior exposure to this exact position | negligible in an unfiltered corpus |
| M8 | the experiment cue told them to look | zero in the corpus; **not** zero in Study D |
| M9 | response bias — plays defensive moves everywhere | this is what the T− cell is for |
| M10 | another tactical motive that shares the move | measurable via the action-set model |

**M5 is not speculative and its size is now known.** On trigger-**negative** items, **99.4% of legal
moves stop the opponent having mate in one**, and the engine's best move does so on 250 of 250
([`RECONCILIATION.md`](RECONCILIATION.md) §2.6a). Whatever a player does for whatever reason, the
observation appears. On trigger-**positive** items the permitted set is a median **29.7%** of legal
moves, so the coincidence rate there is roughly three in ten before any skill is involved.

**M9 is the one the design was built to exclude, and the exclusion does not work.** The T− cell is
supposed to be where response bias shows up. On `RC-06` it scores a different act, so a player who
performs `B` everywhere is not detected by it.

## Register 2 — `the player's stated read names the threat`

| # | mechanism |
| --- | --- |
| S1 | the read governed the move |
| S2 | post-hoc rationalisation of a move already committed |
| S3 | the label was the most available option in the interface |
| S4 | a correct read that did **not** govern the move |
| S5 | the read was produced *by* being asked |

**S3 is partly designed out and the design is on the record**: `statedPartsSchema` stores `tapped`
labels and `typed` text separately, so "the menu was enough" is itself the measurement, and
`CommitmentScreen` refuses pre-filled read chips. **S2 and S4 are not separable within one sitting**,
which is what makes MOVE-FIRST the clean observation and DETECT-FIRST a reactivity arm rather than a
better version of the same thing.

## Register 3 — `the engine's move was on the player's board and they played something else`

| # | mechanism |
| --- | --- |
| C1 | generated it, verified it, rejected it — **control failure** |
| C2 | generated it, never verified it — **verification absent** |
| C3 | placed it while exploring the board, never considered it |
| C4 | placed it to see the opponent's reply, i.e. it was an *opponent* move rehearsal |
| C5 | a slip |

C1 and C2 are the two M1 predicts and they prescribe **opposite** remedies. Nothing currently
separates them; the sharpest available separator is `time between placement and commit`, which is
derivable from data already stored if placement timestamps are kept, and is not today.

## Register 4 — `the player recalls the rule and plays accurately`

The shipped transfer success. Six mechanisms:

| # | mechanism |
| --- | --- |
| T1 | the rule was retrieved and controlled the move |
| T2 | lexical overlap cleared the floor on a paraphrase that means something else |
| T3 | the move was accurate for an unrelated reason |
| T4 | both, independently, from general strength |
| T5 | the drill cued the rule, so retrieval was not tested |
| T6 | base rate — three positions, two successes |

**T6 is measured**: `replicated` arrives 47–81% of the time in one sitting from plausible base
rates, and 9–65% across the two days the grade actually requires. **T2 is measured**: the recall
scorer is word overlap, and a review found a rule whose text it cannot see at all (`"f7 f2"`),
scoring 0/3 on perfect recall. **T5 is definitional.**

---

## The distinguishability matrix

For each pair of mechanisms that would lead to a **different next intervention**: is there an
observation that separates them?

| pair | different intervention? | separating observation | available? |
| --- | --- | --- | --- |
| M1 recognition vs M2 calculation | yes — contrast training vs calculation practice | timed vs untimed on matched items; explicit detection | `[L]` |
| M1 recognition vs M3 generic heuristic | yes — trigger training vs nothing | **false application on T−, same predicate** | **`[X]` — void on RC-06** |
| M1 recognition vs M9 response bias | yes — boundary items vs more T+ practice | **same** | **`[X]` — void on RC-06** |
| C1 control failure vs C2 no verification | yes — verification routine vs scaffolded self-explanation | placement→commit latency | `[P]` if timestamps kept |
| C1/C2 vs "never generated it" | yes — control vs candidate-generation practice | `chose-past-it` firing | **`[P]`, one-sided, base rate unmeasured** |
| untimed competence vs timed failure | yes — representative timed practice vs anything else | same items under both protocols | **`[P]`** |
| immediate vs delayed retrieval failure | yes — spacing vs initial acquisition | delayed uncued probe | `[X]` |
| S1 read governed vs S4 read did not | yes — recognition vs action selection | MOVE-FIRST/DETECT-FIRST order, twin-allocated | `[L]`, and reactive |
| T1 rule use vs T3 general strength | yes — everything vs nothing | matched items, strength covariate | `[R]`, blocked by exchangeability |

**Four of nine pairs have a separating observation that is available today**, and one of those four
(`chose-past-it`) is one-sided with an unmeasured base rate.

**The three pairs that matter most for choosing an intervention all reduce to the same missing
observation: false application on trigger-negative items, scored by the same response predicate.**
That is a single point of failure, and it is the one that failed.

---

## The rule this register produces

> **A rule class may not enter a human study unless at least one mechanism pair that would change
> the next intervention is separable by an observation that study will actually collect.**

`RC-06` under Study D as specified separates **none** of M1/M3/M9, because all three are separated
only by the T− cell and that cell scores a different act. **A study that cannot distinguish
"recognises the trigger" from "does this everywhere" cannot choose between "train the trigger" and
"train the boundary", which is the decision it exists to inform.**
