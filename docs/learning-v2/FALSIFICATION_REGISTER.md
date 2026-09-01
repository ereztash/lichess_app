# Twenty-three failure hypotheses

Each entry starts from an optimistic builder claim and records the strongest reason not to trust it.
`CONFIDENCE` refers to the verdict, not to the size of any effect.

H1–H16 were written against the initial architecture. H17–H19 were added after the first RC-06
headroom check. **H20–H21 are the reconciliation hypotheses introduced after the 15-class round:**
they are now the two pre-human gates. **H22–H23 were written against H18 and H19 themselves** and
refute them: the criterion those entries reason about is not a player parameter, and cannot be made
into one at this rule shape.

---

### H1 — Better presentation alone meaningfully increases transfer
**Falsifier:** feedback effects are heterogeneous and depend heavily on information/activity; the
direct 2024 analogue found that changing feedback layout did not move learning while scaffolded
self-explanation changed error correction/near transfer.
**VERDICT: REFUTED as a transfer claim.** Presentation can still matter for attention/adherence.
**CONFIDENCE: moderate-high.**

### H2 — More explanation necessarily produces more learning
**Falsifier:** guidance can become redundant with expertise; feedback effects are not monotone in
amount of explanation.
**VERDICT: REFUTED.**
**CONFIDENCE: high.**

### H3 — A player who can reconstruct a rule can apply it
**Falsifier:** retrospective reconstruction and prospective recognition/action are different
processes; `recall-score.ts` explicitly says lexical recall is not evidence the rule was used.
**VERDICT: REFUTED.**
**CONFIDENCE: high.**

### H4 — Text retrieval is adequate rehearsal when the criterion is chess action
**Support:** retrieval practice transfers in aggregate.
**Falsifier:** response congruency moderates transfer, and leading chess-learning products retrieve by
playing moves rather than only describing rules.
**VERDICT: LIKELY FALSE as the best default here, but not directly tested.**
**CONFIDENCE: moderate.**

### H5 — Spaced repetition of a rule increases useful transfer rather than merely memory
**Falsifier:** FSRS schedules retrievability/stability and explicitly does not assess content quality
or transfer.
**VERDICT: UNSUPPORTED for transfer; supported only for retention of the rehearsed object.**
**CONFIDENCE: high on the distinction.**

### H6 — Repeating positive examples teaches conditional use
**Falsifier:** conditional discrimination requires a boundary; interleaving evidence is strongest
where categories are confusable.
**VERDICT: REFUTED.** Positive-only training cannot establish when *not* to apply a policy.
**Correction:** trigger-negative items now exist in the **research corpus** for screened classes; they
still do not exist in the product's learning loop.
**CONFIDENCE: high.**

### H7 — Training on the user's own errors transfers better than matched novel examples
**Support:** repeated user preference for own-game material.
**Falsifier:** no verified causal evidence separating motivational relevance from learning benefit;
own-game items also carry uncontrolled difficulty/context differences.
**VERDICT: UNRESOLVED.**
**CONFIDENCE: low.**

### H8 — Personalisation improves learning even when the diagnosis is noisy
**Falsifier:** personalising on a noisy diagnosis distributes the error; the repo has already refuted
several scoring inferences that would otherwise become personalisation inputs.
**VERDICT: REFUTED locally.**
**CONFIDENCE: high for this repository.**

### H9 — Immediate feedback is always better than delayed
**Falsifier:** learning/performance literature includes feedback-timing reversals.
**VERDICT: REFUTED as “always”.** Direction here remains unknown.
**CONFIDENCE: moderate.**

### H10 — In-game coaching improves later independent play
**Falsifier:** system cues convert the target into cued retrieval and risk cue dependency; the
product's own decision protocol excludes reading feedback while evidence is being made.
**VERDICT: REFUTED for the target construct.**
**CONFIDENCE: high.**

### H11 — More practice opportunities monotonically improve learning
**Falsifier:** practice alone can raise apparent performance; the repo's negative controls generate
apparent d′ improvement with zero true learning effect.
**VERDICT: REFUTED.**
**CONFIDENCE: high.**

### H12 — Blitz is an efficient teaching environment
**Support:** most player time is spent playing.
**Falsifier:** longitudinal chess evidence associates deliberate-practice-aligned activity with much
higher learning efficiency than gameplay, and time pressure is hostile to strategic monitoring of
nonfocal cues.
**VERDICT: REFUTED as primary teacher; supported as ecological sampling/test surface.**
**CONFIDENCE: moderate-high on the role split, not on a causal coefficient.**

### H13 — A rule should be taught before its content has been independently validated
**Falsifier:** schedulers are content-blind; the repository already has `mayPrescribe` authority but
does not route it into rehearsal.
**Repo stress test:** under the current binary rule-class screen, **14 of 15** researcher-designed
candidate classes fail eligibility. RC-06 is unusually safe on its T+ cell; that does not license
rehearsing arbitrary player-authored free text.
**VERDICT: REFUTED.**
**CONFIDENCE: high.**

### H14 — A valid chess rule has one observable behavioural signature
**Falsifier:** many true board relations do not determine one unique best move. The original
loose-piece class failed, and round 3 adds a stronger example: `RC-21 push-the-unstoppable-passer`
represents genuine, exactly defined chess knowledge while the named act is the engine's best on only
16.4% of T+ items.
**Positive evidence:** RC-06 remains the sole eligible class under the current binary screen.
**VERDICT: REFUTED as a general claim; PROVISIONAL for RC-06 under the current binary signature.**
**Reopened by H20.**
**CONFIDENCE: high on the general refutation; incomplete on RC-06.**

### H15 — Mechanisms that maximise transfer also maximise engagement
**Falsifier:** desirable difficulties can lower immediate performance/perceived learning; user
feedback repeatedly prefers play over effortful training.
**VERDICT: REFUTED.** Learning utility and adherence must remain separate objectives.
**CONFIDENCE: high.**

### H16 — The intervention can strengthen correct behaviour without strengthening false application
**Support:** none established.
**Falsifier:** a criterion shift raises T+ action and T− false application together.
**Update:** a trigger-negative baseline is now measurable for RC-06 in research, so this is no longer
structurally unmeasurable; it remains absent from the shipped learning loop.
**VERDICT: UNRESOLVED, NOW MEASURABLE IN PRINCIPLE FOR A SCREENED CLASS.**
**CONFIDENCE: high about measurability, unknown about intervention effects.**

### H17 — RC-06 has enough learner headroom to study
**Falsifier:** players may already answer mate threats almost perfectly.
**Evidence:** historical player moves yield pooled rule-consistent T+ action `.716` [.696, .735],
approximately `.63 → .83` across rating bands.
**VERDICT: NOT REFUTED.** Headroom exists, more at 1200–1600 than at the high end.
**Important change:** this is only a recruitment consideration **after H20/H21 pass**; it is no longer
permission to recruit immediately.
**CONFIDENCE: high on the arithmetic.**

### H18 — Rating-band d′ ordering shows stronger players simply see the threat better
**Falsifier:** response criterion moves materially too; false-alarm rate rises across the bands.
**VERDICT: OVERSTATED — and the correction was itself overstated.** Sensitivity changes, and the
behavioural difference cannot be read as pure recognition improvement. But the criterion term is not
a *bias* either: [H22](#h22) shows RC-06's two cells score different acts, so no response criterion
is identified. **What the numbers support is narrower** — the ratio between stopping mate threats and
leaving the opponent checkless rises with rating.
**CONFIDENCE: high on the decomposition direction** — bootstrapped, P(criterion term > sensitivity
term) = **1.000**, with non-parametric *A′* and *B″_D* agreeing. **The interpretive claim is
withdrawn.**

### H19 — Raising rule-consistent action on T+ is necessarily an improvement
**Falsifier:** criterion shift can increase both T+ hits and T− false applications; historical RC-06
T− rule-following can be costly.
**VERDICT: REFUTED — but not by the mechanism first given.** Hits and false applications must be
reported separately and action regret/harm is primary: that stands, and stands on its own.
**The coupling argument does not.** It required hits and false alarms to be the same act so that
raising one raised the other; [H22](#h22) shows they are not, on RC-06. **The 34.0% / ≥100 cp figure
is the cost of *following the rule* on T− items, not the cost of that false-alarm cell**, and the
first version of this entry used it as though it were the second.
**CONFIDENCE: high that the stated mechanism is void; high on the reporting rule, which survives on
its own; unknown whether a real coupling exists on a rule class where the cells are comparable.**

---

## H20 — `engine best move ∈ B` is an adequate domain model of rule validity

**Support:** it is objective, reproducible and allowed the programme to find RC-06.

**Falsifier:** chess can contain multiple near-equivalent good actions, and a true knowledge state
need not make one action uniquely best. A binary top-move label can therefore create both false
negatives and false positives about whether B is useful/diagnostic.

**Required test (Gate A):** evaluate the **action set**, not only the top move:

```text
V_B(s)    = best utility among B-actions
V_notB(s) = best utility among non-B actions
A_B(s)    = V_B(s) - V_notB(s)
R_B(s)    = V*(s) - V_B(s)
```

Also inspect regret across all legal B-actions so one excellent B-action does not hide an unsafe set.
Use WDL/expected score as the primary utility representation and centipawns as a secondary diagnostic.

**VERDICT: UNRESOLVED AND NOW THE FIRST PRE-HUMAN GATE.**
**Would change it:** RC-06 remains exceptional and safe under the set-valued analysis; or the
eligible set changes, proving the binary screen was the bottleneck.

---

## H21 — RC-06 T+ and T− items are comparable enough to support a human learner inference

**Support:** both cells come from the same large unfiltered corpus and the existing programme records
covariates.

**Falsifier:** max |SMD| is **0.573**; the repo already demonstrates that item imbalance can generate
large apparent discrimination for an agent with no true discrimination.

**Required test (Gate B):** natural matching followed by Sheridan/Reingold-style minimal functional
twins where a small chess-valid transformation flips T and the action-set contrast from H20 changes
in the predicted direction.

**VERDICT: REFUTED for the current unmatched item sets; UNRESOLVED whether a defensible paired item
bank can be constructed.**
**CONFIDENCE: high that current exchangeability is insufficient.**

---

## H22 — The SDT criterion on a rule class measures something about the player
<a id="h22"></a>

**Support:** it is what *c* means everywhere else it is used, and `ANALYSIS_PLAN.md` §1.2 not only
requires it be reported but gives a reason to trust it — *"the corpus audit found the criterion
gradient cleaner than the sensitivity one."*

**Falsifier:** a criterion is only a bias if **one** response is scored against two states of the
world. Three measurements, all from data already collected:

1. **RC-06's predicate branches on the trigger** — the only one of the **seventeen** screened to do
   so, and it stayed the only one when five more rule classes landed. On T+, `B` asks *"does the
   opponent still have mate in one"*; on T−, *"does the opponent still have **any check at all**"*.
   A hit and a false alarm are different behaviours.
2. **A move-blind agent** — picking uniformly among legal moves, discriminating nothing — scores
   *d′* = **0.80** and *c* = **+0.88** on RC-06, from the predicate sizes alone. **More than half of
   the lowest band's measured 1.180 needs no knowledge of chess.**
3. **Across the rule classes, move-blind *c* predicts observed *c* at r = +0.50** — **25%** of the
   variance in a supposed psychological bias, from geometry with no player in the model.
   **This leg weakened when the screen grew:** it was **+0.72 (52%)** on twelve classes and fell to
   +0.50 on seventeen. Part of the drop is two classes on the response floor, where *c* is carried
   by the loglinear correction — dropping them gives **+0.66 (43%)** on fifteen. All three cuts are
   reported and none is privileged; **"a substantial share" survives them all, "half the variance"
   does not.** It is the only one of the three legs that moved — points 1 and 2 do not depend on
   which *other* rule classes exist, and neither does the controlled pair below.

**And the controlled experiment was already in the data.** `RC-09` and `RC-11` were built to share a
trigger, a corpus and a noise cell and to differ only in whether `B` names an **outcome** or a
**method**. Same players, same positions: **the criterion moves +0.524**, larger than the entire
rating-band shift H18 was about. Geometry accounts for **71%** of it.

**VERDICT: REFUTED.** The criterion, as measured here, is a property of the sentence the rule is
written in at least as much as of the person reading it. That "cleaner gradient" was contamination
being mistaken for quality.

**Consequence for [Gate B](PRE_HUMAN_GATES.md).** B2's minimal functional twins are the right
instrument and this is a **precondition on them**: a twin that flips T while `B` is defined
differently on the two sides measures the predicate change, not the trigger change. **Gate B must
hold the predicate fixed across the flip, or it cannot be interpreted** — which on RC-06 means Gate B
cannot be run as specified at all (see [H23](#h23)).

**CONFIDENCE: high.** A chance-corrected criterion (subtracting the move-blind value) is **3.4×** more
consistent across the RC-09/RC-11 pair — **and not zero**, so even corrected it is not clean. What
could **not** be tested is whether T− composition differs by rating band: the item-level records are
not on disk. Fully explaining the shift that way needs the T− chance rate to rise **.101 → .296
(2.9×)**, which is implausible — but part of it needs only a modest drift, and part is enough.
**Not ruled out.**

Arithmetic: [`research/learning/criterion_channel.py`](../../research/learning/criterion_channel.py).
Full pass: [`CRITERION_CHANNEL.md`](CRITERION_CHANNEL.md).

---

## H23 — RC-06's predicate could be symmetrised, and then the criterion would mean something
<a id="h23"></a>

**Support:** the branch is the whole problem, so removing it looks like the whole fix — and
`rule_classes.py` says an earlier version *was* symmetric.

**Falsifier:** it also says why that version was abandoned. `P(B | T−)` ran near **1**, because *"the
opponent has no mate in one"* is trivially true when they never had one. **That is not an accident of
this rule.** For any rule of the form *"if THREAT, act so that THREAT is gone"*, `B` is automatically
satisfied whenever the threat is absent.

**VERDICT: REFUTED, and the reason generalises.** On **outcome-shaped defensive rules** a symmetric
predicate makes the noise cell degenerate and an asymmetric one makes the criterion uninterpretable:
**you can measure sensitivity or criterion, not both.** The branch is a correct fix for a real
problem and it costs the criterion. There is no third option at this rule shape.

**CONFIDENCE: high**, and it carries a prediction: **method-shaped rules should not have the
problem**, because `B` is a property of the move rather than of the threat's survival. `RC-11` is
method-shaped, does not branch, and is one half of the pair in H22 — which is what makes that pair a
test rather than a coincidence.

**The practical consequence, and it is cheap:** the chance-corrected criterion is measurable **today**
across the eleven non-branching rule classes, from data already collected — no corpus, no
participants, no product change. It is simply not measurable on the one rule class the product would
be built on.

---

# What the register adds up to

The key correction is not a new learning mechanism. It is a reordered dependency chain:

```text
H22/H23 is the response predicate even the same act on both cells?
    ↓
H20 action-model validity
    ↓
H21 exchangeability / minimal twins   (twins must hold the predicate fixed)
    ↓
H17/H18 human detection → action + reactivity
    ↓
H13 content safety for player-authored rules
    ↓
choose among H4/H6/etc. learning interventions
    ↓
H16 conditional transfer
    ↓
uncued / ecological transfer
```

**H22/H23 sit above the gates because they are definitional rather than empirical** — no amount of
item matching repairs a response that means two different things, so Gate B's twins are
uninterpretable until the predicate is held fixed, and on RC-06 it cannot be.

The strongest negative that is now available is also clear: if H20 or H21 cannot be rescued, **final
move is not sufficiently diagnostic of rule use under the current paradigm**. The next research
object is process evidence, not candidate 16 and not a more elaborate learning UI.
