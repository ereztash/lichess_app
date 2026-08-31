# Eight attacks on the learning claim

**The claim under attack**, stated so it can lose:

> A staged intervention — contrast, then self-explanation, then an if–then rule, then retrieval,
> then fading, then spacing — converts an evidence-backed insight into a decision policy that the
> player retrieves **unprompted** in a position they have not seen.

Each attack below is stated, then answered with what is actually in the tree or in the arithmetic.
Three of the eight needed no participant and no experiment: they are settled now. Four are inherited
from [`docs/measurement/FALSIFICATION_REGISTER.md`](../measurement/FALSIFICATION_REGISTER.md) and
carry forward unchanged. One is new, and it is the one that would make a *better* learning layer a
*worse* product.

| | attack | status |
| --- | --- | --- |
| [L1](#l1) | there is no teaching step, so there is nothing to improve on | **confirmed** — settled by reading the tree |
| [L2](#l2) | the instrument grades success at chance | **confirmed** — settled by arithmetic |
| [L3](#l3) | a graded "success" is not rule use | **confirmed** — settled by reading the scorer |
| [L4](#l4) | the outcome the study needs was refuted upstream | **inherited, live** — F3 |
| [L5](#l5) | practice explains any pre/post change | **inherited, live** — F8 |
| [L6](#l6) | the intervention *is* the measurement | **inherited, untested** — F7, D21 |
| [L7](#l7) | the design cannot be bought with the people available | **confirmed** — settled by arithmetic |
| [L8](#l8) | efficacy is not obviously good here | **new, unresolved, and it gates the rest** |

---

## L1 — There is no teaching step, so "improve the teaching" has no baseline {#l1}

**The attack.** You cannot run an A-versus-B on teaching if A does not exist. If the product goes
from *finding* straight to *test of the finding*, then any intervention arm is being compared
against nothing, and a positive result says only that doing something beats doing nothing.

**What the tree says.** The path is: `FindingCard` states what may be believed →
`LearningRuleComposer` collects the player's own `trigger` / `missed_signal` / `action_rule` /
`exception_rule` / `predicted_outcome` / `refutation_condition` → `formLearningRule` files it at
`grade: "hypothesis"` with `next_due_at` one day out → the queue withholds the rule and asks for it
back → `beginLearningTransfer` preregisters three positions.

**Between the composer and the queue there is no step that teaches anything.** The player writes the
rule and the product schedules a test of it. That is an authoring step and a measurement step, and
the space the brief is pointing at is the gap between them.

**Confirmed.** And it changes the shape of the first study: the comparison is not *better teaching
versus current teaching*. It is *one teaching component versus none*, which is a lower bar and a
weaker result, and calling it anything else would be inflating it.

---

## L2 — The transfer bar has no null model {#l2}

**The attack.** `TRANSFER_POSITION_COUNT = 3` and `TRANSFER_MINIMUM_SUCCESSES = 2`. Two of three is
a bar that a coin clears half the time. If the per-item success rate is high for reasons that have
nothing to do with learning, the grade `replicated` is not evidence of anything.

**The arithmetic** (`research/learning/transfer_bar.py`, which checks these constants against
`shared/learning-record.ts` and fails if they drift):

| per-item rate | P(graded `replicated`) |
| --- | --- |
| 0.30 | 0.216 |
| 0.50 | **0.500** |
| 0.70 | 0.784 |
| 0.80 | 0.896 |

And the per-item rate is itself a product of two things (see [L3](#l3)):

| P(recall floor) | P(accurate) | per-item | P(`replicated`) |
| --- | --- | --- | --- |
| 0.60 | 0.60 | 0.360 | 0.296 |
| 0.80 | 0.70 | 0.560 | **0.590** |
| 0.90 | 0.80 | 0.720 | **0.809** |

**Confirmed.** Across the plausible range the grade arrives **47–81%** of the time. Nothing in the
repository estimates the base rate, so nothing can subtract it. `docs/measurement/`'s own rule —
*accuracy may never be reported alone* — has an analogue here that was never applied: **a pass rate
may never be reported without the rate the same bar returns when nothing was learned.**

**What it does not mean.** That the schedule is wrong or that three positions is the wrong number.
Three positions with a *declared null* and a per-item rate estimated from the same player's untaught
items would be a defensible instrument. The defect is the missing comparison, not the size.

---

## L3 — A graded success is not rule use {#l3}

**The attack.** The construct is *did the rule control the act*. If the score is *did the player do
well*, then a player who plays well for unrelated reasons scores a success, and a player who applies
their rule correctly in a position where the rule is wrong scores a failure.

**What the scorer does.** `shared/record-service.ts`:

```
successes = count of positions where
  scoreRecall(recalled_rule, action_rule).clearedFloor    // word overlap
  AND accurateDecision(engine_eval_cp, cp_loss)           // the move was good
```

Neither term is the act the rule prescribes.

- The first is **documented in the repo as not a memory measure** — *"`scoreRecall` is word overlap
  and says so; it is a floor against unrelated text"*.
- The second is what an unaided player of that strength does anyway. It is the same substitution
  [`F3`](../measurement/FALSIFICATION_REGISTER.md#f3) refuted one level down, arriving here in a
  weaker form: that programme at least scored *the specific act the rule names*, and found even that
  insufficient because on **66.2%** of trigger-positive items the prescribed capture is also the
  engine's best move. Scoring *any* accurate move is further from rule use, not closer.

**And `applied_rule` — the player's own report that they used the rule — is collected and then not
counted.** It is written to the result and excluded from `successes`. Whatever its weaknesses as
self-report, it is the only term in the record that is *about the rule*, and it is the one term the
grade ignores.

**Confirmed.** The fix is not a better similarity metric. It is scoring on **diagnostic items** —
positions where the rule's prescribed act and ordinary good play come apart — which is what
[`EXPERIMENT.md`](EXPERIMENT.md) builds its outcome from.

---

## L4 — The outcome was refuted upstream {#l4}

**Inherited from [F3](../measurement/FALSIFICATION_REGISTER.md#f3), and live.** For the cleanest
rule class anyone found, `B = capture(designated target)` does not indicate use of the
discrimination: on **15.0%** of trigger-positive items the prescribed act loses ≥ 100 cp, and on
**22.8%** of trigger-negative items the scored false alarm is the engine's own best move.

**What that costs this study.** Of the six outcomes a learning study would want — rule
reconstruction, trigger sensitivity, false application, uncued transfer, retention, ecological
transfer — **trigger sensitivity and false application are the two the refutation lands on
directly**, because they are the *d′* and *c* of the refuted table. Retention inherits the status of
whatever it delays. Ecological transfer is [`L5`](../measurement/ECOLOGICAL_EXTRAPOLATION_GAP.md) on
a ladder where the instrument stands at L2.

**Exactly one of the six survives today, and it is the weakest: rule reconstruction**, because it is
scored against the player's own authored text rather than against an engine or a board predicate.

---

## L5 — Practice explains any pre/post change {#l5}

**Inherited from [F8](../measurement/FALSIFICATION_REGISTER.md#f8), and live.** Simulation with a
**zero true effect** produced **+0.2 *d′*** from practice alone.

**Which rules out the design shape the brief proposed.** Four arms, each measured before and after,
compared on improvement, is a design whose main effect is reproducible with no intervention at all.
[`EXPERIMENT.md`](EXPERIMENT.md) uses a staggered within-participant design instead, in which
untreated rules are concurrent controls in the same person on the same days — which is what makes
practice and maturation subtractable rather than assumed away.

---

## L6 — The intervention is the measurement {#l6}

**Inherited from [F7](../measurement/FALSIFICATION_REGISTER.md#f7), and untested.**

A self-explanation prompt asks the player to articulate what they would want to notice. That is the
intervention in mechanism 3 **and** it is an instrument reading. `docs/decisions/D21-feedback-exposure.md`
records that decisions taken after a player has seen feedback are pooled with decisions taken
before, and that **no field in the record can separate them**.

**So the study cannot ask the self-explanation question first.** Any arm containing a prompt
contaminates its own baseline, and the record cannot currently mark which side of the exposure a
decision fell on. This is why mechanism 3 is ranked fourth in [`PRIOR_ART.md`](PRIOR_ART.md) despite
having the most directly relevant published result.

---

## L7 — The design cannot be bought with the people available {#l7}

**The attack.** A four-arm between-subjects comparison, at a plausible effect, needs more
participants than the trial has by one to two orders of magnitude.

**The arithmetic**, on a *d′*-like score with SD 0.8, 80% power, two-sided α = .05:

| difference to detect | per group | four groups |
| --- | --- | --- |
| 0.2 | 251 | **1,004** |
| 0.3 | 112 | **446** |
| 0.5 | 40 | 161 |
| 0.8 | 16 | 63 |

The trial has **eight to thirty people**. Even the largest difference in that table is out of reach,
and 0.8 is not a plausible target for a single component.

**But the other currency is not scarce.** Within one participant, separating a per-item rate of 0.60
from 0.75 needs about **152 items per condition** — and the corpus scanned in
`research/measurement/` holds 11,752 trigger-positive items before any narrowing.

**Confirmed, and it is the finding that decides the design.** People are the binding constraint;
items are not. That is the situation single-case experimental designs exist for, and **WWC Single-Case
Design v5 is already adopted at tier A** in this repository's evidence manifest — so the standard
does not have to be imported, only applied.

---

## L8 — Efficacy is not obviously good here {#l8}

**The attack, and it is the one nothing in the tree answers.** The player authors the rule.
`formLearningRule` files it as `authored_by: "player"`, `grade: "hypothesis"`, with the first
retrieval due in one day. **The rehearsal schedule begins before the rule has been shown to be
true.**

Now suppose the intervention works. A contrast set, a self-explanation, an if–then rehearsal and a
spaced retrieval schedule are, together, a good way to make a rule automatic. Applied to a rule that
is **wrong**, they are a good way to make a mistake automatic — and the same corpus scan says wrong
rules are not rare: on **15.0%** of the items where the cleanest candidate rule says to act, acting
loses at least a pawn.

**The current layer is partly protected by its own weakness.** A teaching step that does not teach
cannot entrench an error either. Strengthening it removes that protection, and nothing in the
product currently gates rehearsal behind validation: `grade` moves to `replicated` or `refuted`
*after* retrieval has already been happening for up to 21 days.

**Consequences for the design, and they are not optional.**

1. The first study's outcome must be measured on rules whose prescribed act is **checkable**, so a
   rule that is wrong shows up as harm rather than as noise.
2. **Harm is a declared outcome, not an adverse event.** The study reports rule-consistent action on
   items where the rule is *wrong* as a separate series, and a rise there is a negative result even
   if the headline series rises too.
3. If the two rise together, the intervention taught compliance rather than discrimination — which
   is the same finding as [L6](#l6) arriving from the other side.

**Unresolved, and it gates the rest.** No literature search settles this: the implementation-intention
and retrieval literatures measure whether a plan is enacted, not whether enacting it was wise. This
is a property of a domain where the player's own rule can be false, and it needs its own answer
before a layer designed to make rules stick is built.

---

## What none of these attacks touched

The **spacing schedule**, the **withholding of the rule during retrieval**, and the **preregistration
of transfer positions** are all sound and are all doing what they claim. The rule is genuinely
hidden during the test; the positions genuinely are named in advance; the refutation condition
genuinely is written before the evidence. The defects above are in what is *scored* and in what is
*absent between authoring and testing* — not in the protocol discipline around them.
