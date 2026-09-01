# The criterion channel: is it a fact about the player, or about the predicate?

[H18](FALSIFICATION_REGISTER.md) found that most of the rating-band improvement in RC-06 behaviour
is **criterion** rather than sensitivity. [H19](FALSIFICATION_REGISTER.md) built a harm argument on
top of it: an intervention that shifts the criterion would raise the trigger-positive hit rate while
raising false application too, and false application is expensive.

Both treated *c* as a property of the **player** — a willingness, a readiness, a bias.

**It mostly is not.** This file is the check, and it comes back against the research that prompted
it. Arithmetic: [`research/learning/criterion_channel.py`](../../research/learning/criterion_channel.py),
which re-derives every number below from the screen's raw results and the shipped rule-class
definitions, and fails if either moves.

---

## 1. RC-06's two cells do not score the same act

`_threat_satisfies` is **the only predicate of the twelve that branches on the trigger**:

| cell | what `B` asks |
| --- | --- |
| **T+** | after your move, does the opponent still have **mate in one**? |
| **T−** | after your move, does the opponent still have **any check at all**? |

A *hit* and a *false alarm* are therefore **different behaviours**. Signal-detection theory's entire
content is that **one** response is scored against two states of the world; that is not what is
happening here, so the (*d′*, *c*) pair is not a sensitivity/bias decomposition of anything.

`rule_classes.py` documents exactly why it branches, and is right to: the symmetric version made the
noise cell degenerate — `P(B | T−)` ran near 1, because "the opponent has no mate in one" is
trivially true when they never had one. **The branch is a good fix for a real problem.** What was
never drawn is its consequence for the criterion.

This was verified against the shipped predicate on an independent set of positions — random-walk
boards rather than the Lichess corpus, and a different `python-chess` build than the pinned 1.11.2,
so it tests the predicate's *shape* rather than reproducing a rate. B covers **~.35** of legal moves
on T+ and **~.09** on T−, reproducing the screen's .317 / .101. **The asymmetry is a property of the
predicate pair, not of the corpus.**

## 2. A move-blind agent scores *d′* = 0.80 and *c* = +0.88 on RC-06

Pick uniformly among legal moves. Know nothing, discriminate nothing. The measured prescription
sizes **are** your hit and false-alarm rates:

```
H = .3173  →  z = −0.4752
F = .1010  →  z = −1.2758
d′ = 0.8005      c = +0.8755
```

**More than half of the bottom rating band's *d′* of 1.180 is available without any knowledge of
chess.** Corrected for that floor the band span is 0.380 → 0.866 — still monotone, still real, and
**2.3×** across bands rather than the 1.41× the raw numbers suggest.

`negative-controls.ts::itemDifficultyConfound` is already in the repository as a *committed
executable failure* — "a control the current design DOES NOT PASS". It is cited in the docs as a
caveat about item matching. **Nobody had computed what the floor actually is for the rule class the
product would be built on.**

## 3. Across twelve rule classes, geometry predicts half the criterion

| | correlation with the move-blind value | variance explained |
| --- | --- | --- |
| **observed *c*** | **r = +0.72** | **52%** |
| observed *d′* | r = +0.56 | 31% |

Half the variance in a quantity read as a psychological bias is predicted by **how restrictive `B`
is on each cell**, with no player in the model at all.

## 4. The controlled experiment was already in the data

`RC-09` and `RC-11` were built to share a trigger, a corpus and a noise cell and to differ in **one**
thing — whether `B` names an **outcome** ("the threat is gone") or a **method** ("move the piece").
Identical item counts on both cells, confirmed rather than assumed.

| | observed *c* | move-blind *c* | chance-corrected *c* |
| --- | --- | --- | --- |
| **RC-09** outcome | −0.175 | +0.949 | −1.124 |
| **RC-11** method | +0.349 | +1.321 | −0.972 |
| **difference** | **+0.524** | +0.372 | **+0.152** |

**Same players. Same positions. Same trigger. The criterion moves by 0.52 — larger than the entire
rating-band shift H18 was about — and the only thing that changed is how the sentence is written.**

Predicate geometry accounts for **71%** of that shift.

## 5. What survives, and the correction that partly works

Two things H18 could have been wrong about, and was not:

- **The equal-variance assumption is not carrying it.** Non-parametric *A′* rises monotonically
  (.806 → .873) and Donaldson's *B″_D* falls monotonically (+.406 → −.196), agreeing with the
  parametric pair.
- **The ordering is not sampling noise.** Bootstrapping the four 2×2 tables (20,000 draws):
  sensitivity term **+0.081** [+0.044, +0.118], criterion term **+0.123** [+0.087, +0.160],
  **P(criterion > sensitivity) = 1.000**. H18 published no interval; this is it.

Neither repairs the branching predicate, and nothing computed from those two cells can.

**The constructive half.** Subtracting the move-blind criterion gives a chance-corrected bias, and
the RC-09/RC-11 pair is the one place it can be *tested* — same players, same decisions, so a real
player parameter must come out the same under both predicates. Raw, the two disagree by **0.524**.
Corrected, by **0.152** — **3.4× more consistent, and not zero.** A chance-corrected criterion is
better behaved than a raw one and is still not a clean player parameter.

---

## What this costs H18 and H19

**H18 stands as arithmetic and falls as interpretation.** The criterion term really is larger than
the sensitivity term, robustly. But "criterion" here is not *willingness to play the mate-answering
move* — the two cells score different acts, so the quantity has no such reading. What the numbers
support is narrower: **the ratio between stopping mate threats and leaving the opponent checkless
rises with rating.** That is a fact, and it is not a fact about bias.

**H19 loses its mechanism.** Its harm argument required hits and false alarms to be **the same act**,
so that raising one necessarily raises the other. They are not. An intervention that teaches
mate-threat answering has no particular reason to make players leave the opponent checkless more
often on unrelated positions. The 34.0% / ≥100 cp cost is real for *following the rule* on T− items;
it is not the cost of *this* false-alarm cell.

The **caution** H19 argued for survives on other grounds — reporting a trigger-positive series alone
is still bad practice, and `itemDifficultyConfound` still fails — but the specific coupling it
asserted does not follow, and **I asserted it.**

## One consequence outside this workstream

[`docs/measurement/ANALYSIS_PLAN.md`](../measurement/ANALYSIS_PLAN.md) §1.2 preregisters the
criterion as a reported quantity, and gives a reason:

> *"Report both, alongside the criterion c by band, **because the corpus audit found the criterion
> gradient cleaner than the sensitivity one**."*

**That rationale is what this file undermines.** The criterion gradient looks cleaner in part
*because* it is reading predicate geometry, which is smooth and systematic where a skill signal is
noisy — so "cleaner" was evidence of contamination being mistaken for evidence of quality. The
requirement to report *c* is still right; the reason given for trusting it is not.

**This file does not edit that document.** `ANALYSIS_PLAN.md` belongs to the measurement workstream,
which has an open PR touching these same rule-class definitions, and a cross-branch edit to another
workstream's preregistration is exactly the kind of thing that should be proposed rather than
performed. **Flagged here for its owner.**

## What is now measurable, and what is not

- **Not measurable on RC-06:** any bias parameter. Not with a better estimator, not with more
  participants. The two cells are not comparable, and that is a property of the definition.
- **Not fixable by symmetrising RC-06 either.** For a rule of the form *"if THREAT, act so that
  THREAT is gone"*, `B` is automatically satisfied whenever the threat is absent — so a symmetric
  predicate makes the noise cell degenerate and an asymmetric one makes the criterion
  uninterpretable. **On outcome-shaped defensive rules you can measure sensitivity or criterion, not
  both.** This is a structural claim about the rule *shape*, and it predicts that method-shaped
  rules (`RC-11`) do not have the problem — which is why the pair in §4 is the right test of it.
- **Measurable today, on data already collected:** the chance-corrected criterion across the eleven
  non-branching rule classes. No new corpus, no participants, no product change.

## What this does not say

That the rule-class screen is wrong. `B_valid` is adjudicated by an **engine against the rule**,
never by SDT, and **the eligibility gates never read *c* at all** — so RC-06's eligibility, its
.968/.200 separation, its 242/242 engine agreement and its 2.9% harm rate are all untouched.

That players do not differ. They plainly do: corrected for the move-blind floor, sensitivity still
orders the rating bands and still has headroom ([H17](FALSIFICATION_REGISTER.md)).

Only that **the criterion, as measured here, is not clean enough to carry an argument about what an
intervention would do to a player's willingness** — which is exactly the weight H18 and H19 put
on it.

## Limits of this pass

- The **item-level records are not on disk** (496,432 of them, rebuildable from the manifest; the
  corpus PGN is not vendored). So the alternative explanation that **T− composition differs by
  rating band** — stronger players' games containing structurally different noise positions —
  **could not be tested**, only bounded: fully explaining the observed criterion shift that way
  needs the T− chance rate to rise from .101 to ~.296, which is implausibly large, but explaining
  *part* of it needs only a modest drift. It is not ruled out.
- The independent predicate check ran on **random-walk positions**, which are not representative
  chess. It establishes the asymmetry is definitional, not its exact magnitude in play.
- `r = +0.72` is across **twelve** rule classes that are not independent draws — they share corpora,
  and the severity ladder shares one noise cell. It is a description of this set, not an estimate
  of a population.
- **The set is growing.** The measurement workstream has an open PR adding five more rule classes to
  the same screen. Every count in this file — "twelve", "the only one of the twelve", `r = +0.72` —
  is scoped to the screen as it stood, and
  [`criterion_channel.py`](../../research/learning/criterion_channel.py) prints its own `n` and
  warns on stderr if a second predicate starts branching. **Re-run it before quoting these numbers
  after that PR lands.** The script hard-asserts only what the argument depends on — that RC-06
  branches, and that RC-09/RC-11 still share both cells — so a new rule class is not a failure of
  this file.
- The mutation control on the branching detector **failed on its first version**, which accepted a
  bare `state ==` comparison and so survived having the trigger call removed. The detector now
  requires a `_trigger(` call. Recorded because a control that is written after the fact and passes
  first time has usually not been tested.
