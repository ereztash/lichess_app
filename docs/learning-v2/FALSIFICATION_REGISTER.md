# Twenty-one failure hypotheses

Each entry starts from an optimistic builder claim and records the strongest reason not to trust it.
`CONFIDENCE` refers to the verdict, not to the size of any effect.

H1–H16 were written against the initial architecture. H17–H19 were added after the first RC-06
headroom check. **H20–H21 are the reconciliation hypotheses introduced after the 15-class round:**
they are now the two pre-human gates.

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
**VERDICT: OVERSTATED, NOT REFUTED.** Sensitivity changes, but the behavioural difference cannot be
read as pure recognition improvement.
**CONFIDENCE: high on the decomposition direction.**

### H19 — Raising rule-consistent action on T+ is necessarily an improvement
**Falsifier:** criterion shift can increase both T+ hits and T− false applications; historical RC-06
T− rule-following can be costly.
**VERDICT: REFUTED.** Hits and false applications must be reported separately; action regret/harm is
primary.
**CONFIDENCE: high on the logic, unknown on real intervention magnitude.**

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

# What the register adds up to

The key correction is not a new learning mechanism. It is a reordered dependency chain:

```text
H20 action-model validity
    ↓
H21 exchangeability / minimal twins
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

The strongest negative that is now available is also clear: if H20 or H21 cannot be rescued, **final
move is not sufficiently diagnostic of rule use under the current paradigm**. The next research
object is process evidence, not candidate 16 and not a more elaborate learning UI.
