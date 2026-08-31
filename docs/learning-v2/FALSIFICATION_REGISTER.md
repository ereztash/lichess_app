# Nineteen failure hypotheses

Each is stated as the **optimistic** claim a builder would want to be true, then attacked.
`CONFIDENCE` is about the verdict, not about the effect.

**H1–H16** were written against the architecture. **H17–H19** were added afterwards, against *this
research's own conclusion*, when an objection was raised to how much headroom RC-06 leaves. Two of
the three came back against the research rather than for it.

Sources are the rows of [`THEORY_EVIDENCE.md`](THEORY_EVIDENCE.md) (V1–V13).

---

### H1 — Better presentation alone meaningfully increases transfer
**Best support:** V3, feedback d = 0.48 overall.
**Best falsifier:** V3's own moderator analysis — the effect is carried by **information content**,
not delivery — and V5, where **redesigning the feedback layout changed nothing** while the
self-explanation prompt moved error correction and near transfer.
**VERDICT: REFUTED as stated**, for transfer. Presentation may still matter for attention and for
adherence, which are different objectives.
**CONFIDENCE: moderate-high.** One direct study, one large meta-analysis pointing the same way.
**Would change it:** a presentation manipulation that moves an *uncued* outcome.

### H2 — More explanation necessarily produces more learning
**Falsifier:** V9. Guidance that helps novices **degrades** higher-knowledge performance; redundant
explanation adds load. V3's heterogeneity says the same from the other side.
**VERDICT: REFUTED.** Monotone-more is wrong; so is monotone-less.
**CONFIDENCE: high.** **Would change it:** nothing plausible — the interaction is the finding.

### H3 — A player who can reconstruct a rule can apply it
**Falsifier:** V4 (learning ≠ performance, and the reverse), V8 (reconstruction is retrospective
memory; application needs prospective recognition — different processes). The repo's own
`recall-score.ts` docblock: *"It is not evidence that the rule was USED."*
**VERDICT: REFUTED**, and the repository already says so in the file that would be misread.
**CONFIDENCE: high.**

### H4 — Text retrieval is adequate rehearsal when the criterion is chess action
**Best support:** V1, retrieval transfers at d = 0.40.
**Best falsifier:** V1's **own** response-congruency moderator, plus V13 — the leading chess product
retrieves by **playing the move**, not by describing it.
**VERDICT: LIKELY FALSE**, but note the cost of testing it: the market has already converged, so a
confirmatory result buys little. See [`INTERVENTION_COMPARISON.md`](INTERVENTION_COMPARISON.md).
**CONFIDENCE: moderate.** **Would change it:** evidence that verbalisation aids *conditional*
recognition specifically, where congruency arguments would not apply.

### H5 — Spaced repetition of a rule increases useful transfer rather than merely memory
**Falsifier:** V11 — FSRS optimises retrievability and stability and **explicitly cannot assess
content**; V12 — Khan validates mastery against a *same-format cued* test. Neither system claims
transfer, and neither measures it.
**VERDICT: UNSUPPORTED for transfer.** Spacing is well-evidenced *for retention of the rehearsed
thing*. That is L3, not L5.
**CONFIDENCE: high** for the distinction; **low** about what spacing would do here.

### H6 — Repeating positive examples teaches conditional use
**Falsifier:** V2 — the interleaving advantage is largest where categories are **confusable**, which
is a statement about needing negatives. Conditional discrimination is defined by the negative case.
**VERDICT: REFUTED.** Positives alone cannot teach a boundary.
**CONFIDENCE: high.** This is the strongest theoretical result against the product's current shape,
which has **no negative items at all**.

### H7 — Training on the user's own errors transfers better than matched novel examples
**Support:** VOC — *"I like positions from my own games"* is a repeated preference signal.
**Falsifier:** none found either way. Own-error training confounds **content** with **motivation**,
and no verified source separates them. `docs/measurement/` further shows own-game items carry
uncontrolled covariates (SMD −0.49 to −0.72 on material balance).
**VERDICT: UNRESOLVED.** A preference is not a transfer claim.
**CONFIDENCE: low.** **Would change it:** a study matching own-error and novel items on difficulty.

### H8 — Personalization improves learning even when the diagnosis is noisy
**Falsifier:** `docs/measurement/` — the diagnosis **is** noisy here, refuted at the scoring
inference. Personalising on a noisy diagnosis distributes error rather than reducing it.
**VERDICT: REFUTED in this repository specifically.** Not a general claim about personalisation.
**CONFIDENCE: high**, locally.

### H9 — Immediate feedback is always better than delayed
**Falsifier:** V4 — the class of manipulations with opposite short- and long-term effects includes
feedback timing.
**VERDICT: REFUTED as "always".** Direction here is unknown.
**CONFIDENCE: moderate.** No chess-specific evidence found.

### H10 — In-game coaching improves later independent play
**Falsifier:** V8 — a system-supplied cue makes retrieval **cued**, which is the opposite of the
target construct; and cue dependency is the predicted failure. This is also barred by the product's
own LAW 1 (no reading of the record while evidence is being made) and by D21.
**VERDICT: REFUTED for the target**, and structurally excluded here.
**CONFIDENCE: high.**

### H11 — More practice opportunities monotonically improve learning
**Falsifier:** V4; and `docs/measurement/` F8 — **+0.2 d′ from practice alone with a zero true
effect**. More opportunities produce more apparent improvement without more learning.
**VERDICT: REFUTED**, and it is the single most dangerous confound for any pre/post design here.
**CONFIDENCE: high.**

### H12 — Blitz is an efficient teaching environment
**Support:** V7 — >90% of player time is already there, so it is where attention is.
**Falsifier:** V7's own comparison (3.61× for deliberate-practice-aligned activity, **observational**);
V8 — under time pressure, strategic monitoring for a nonfocal cue will not occur.
**VERDICT: REFUTED as a teacher; STRONGLY SUPPORTED as an ecological test surface.** See §7 in
[`INTERVENTION_COMPARISON.md`](INTERVENTION_COMPARISON.md).
**CONFIDENCE: moderate-high** for the role split; **low** for any magnitude.

### H13 — A rule should be taught before its content has been independently validated
**Falsifier:** V11 (schedulers are content-blind); `docs/measurement/` (15.0% of prescribed acts
lose ≥100cp); and the repository's own `mayPrescribe`, which gates prescription at `tested` — **and
is enforced on one line of card copy, never on rehearsal.**
**VERDICT: REFUTED — and V14 sharpens it rather than softening it.** For `RC-06`, an
**expert-screened** rule class, following the rule loses ≥100 cp on only **2.9%**, so the harm
channel there is small. But nine of ten candidate rule classes — *designed by a researcher* — scored
below a rule class already known to be uninterpretable. The product does not screen: it accepts
whatever a novice types. **The gap between 2.9% and 15% is the value of screening, and the product
performs none.**
**CONFIDENCE: high.** This remains the finding that reorders the architecture.

### H14 — A "valid" rule has a single observable behavioural signature
**Falsifier:** `docs/measurement/` F3 — for the cleanest rule class found, `capture(target)` does
not imply rule use: **66.2%** of the time it is also the engine's best move.
**VERDICT: REFUTED as a general claim, RESOLVED for one rule class.** V14 found `RC-06`, where the
prescribed act is the engine's best move on 242/242 trigger-positive items and `B_valid` falls from
.968 to .200 when the trigger is removed. **A signature exists.** It does not exist for arbitrary
player-authored rules, and it was found by screening ten candidates, of which nine failed.
**CONFIDENCE: high.** **This is the update that moved the verdict from MEASUREMENT-BLOCKED to
NARROW**, and it arrived from another workstream after the first draft of this register.

### H15 — Mechanisms that maximise transfer also maximise engagement
**Falsifier:** V4 — desirable difficulties reduce immediate performance and perceived learning.
VOC: *"training is boring / I would rather play"*, review-backlog complaints.
**VERDICT: REFUTED.** The two objectives must be modelled separately; see
[`VOICE_OF_CUSTOMER.md`](VOICE_OF_CUSTOMER.md).
**CONFIDENCE: high.**

### H16 — The intervention can strengthen correct behaviour without strengthening false application
**Support:** none found.
**Falsifier:** V6 measures **enactment**, not appropriateness. V2 implies the boundary needs
negatives to be learned. The product has none.
**VERDICT: UNRESOLVED, AND NOW MEASURABLE.** V14's screen is built on a trigger-negative cell —
`B_valid | T−` = .200 for RC-06 — so trigger-absent items **exist in the corpus**, and false
application has a baseline to be measured against. They do not exist **in the product**: no screen
ever shows a player a position where their rule does not apply.
**CONFIDENCE: high** that it is now measurable in principle; **unknown** about the effect. The
[experiment](EXPERIMENT.md) carries it as its harm series.

### H17 — RC-06's trigger is worth teaching, because players do not already answer it
**Support:** the rule class passed every gate in the screen, and its prescribed act is the engine's
best move on 242/242 trigger-positive items.
**Falsifier:** *"answer the mate threat"* is the first thing anyone checks. If unaided players
already do it, the rule class is measurable and unteachable, and Study D has a ceiling instead of a
result. **The screen already measured this and nobody read it that way:**
`screen_rule_classes.py::_player_sdt` scores the move the player ACTUALLY PLAYED against `B`, over
2,080 trigger-positive positions.
**VERDICT: NOT REFUTED — there is headroom, and less of it than the rule class's other numbers
suggest.** Pooled hit rate **.716** [.696, .735]. By band it runs **.63 → .83**; against a chance
rate of **.317** that is **46%** of the available range realised at 1200–1400 and **75%** at 1800+.
**CONFIDENCE: high** on the arithmetic, which is
[`research/learning/headroom.py`](../../research/learning/headroom.py) and re-derived from the raw
screen results on every run. **The objection is real at the top of the range and wrong at the
bottom**, which is a recruiting constraint on Study D rather than a reason not to run it.

### H18 — The rating-band *d′* ordering shows the rule class captures a skill that improves
**Support:** `RULE_CLASS_SEARCH` reports *d′* monotone across four bands, 1.180 → 1.666, span 0.49,
and calls it *"the first time sensitivity has moved in the right order at all."*
**Falsifier:** *d′* is half of the pair. The criterion moves too — **+0.257 → −0.113** — and the
same document says so in one sentence without quantifying it. Quantified, the hedge is **larger
than the headline**: of the **+19.8** points of hit rate between the bottom and top bands, freezing
*c* reproduces **+8.1** and freezing *d′* reproduces **+12.3**. The ordering holds at all three
anchor choices. Read from the other side, the **false-alarm rate rises** across the bands, .199 →
.236, rather than falling.
**VERDICT: OVERSTATED, NOT REFUTED.** Sensitivity does improve and the monotonicity is real; it is
simply the smaller of the two terms behind the behaviour. The screen's claim is about *d′* and is
true as written. **The claim that does not survive is the one a reader supplies — that the band
ordering shows stronger players *see* it better.** Mostly they are readier to play it.
**CONFIDENCE: high.** The decomposition is a convenience, not a variance partition — hit rate is
nonlinear in the pair and the terms do not sum to the whole — but the ORDER is what is load-bearing
and it is anchor-invariant.

### H19 — An intervention that raises rule-consistent action on trigger-positive items is an improvement
**Support:** it is the outcome any obvious study would report, and the one the product would build
toward.
**Falsifier:** H18 supplies the mechanism. A pure criterion shift raises the T+ hit rate **and the
T− false-alarm rate together**, and the screen measured what the second one costs: on
trigger-negative items, following the rule loses **≥100 cp on 34.0%** of them, median **+49 cp**.
**The natural design is the dangerous one** — repeated exposure to trigger-positive examples with
the defensive move rewarded is a criterion-shifting procedure, not a discrimination-training one.
**VERDICT: REFUTED as stated.** A trigger-positive-only outcome cannot distinguish the intervention
that teaches from the one that merely biases, and it scores the harmful one as the larger success.
**CONFIDENCE: high** on the direction; **unknown** on how much any real intervention moves each
term, which is not measurable without running one.
**Study D already survives this** — its OUTCOME reports hits and false alarms separately with *c*
beside any *d′*, and its item set carries the T− cell — but it survives by construction rather than
by having been checked, and this entry is the check.

---

## What the nineteen add up to

Nine refuted, one likely false, three unresolved, one supported-with-inversion (H12), and **two
(H14, H16) that were the architecture blockers and have since moved.**

**Three more (H17–H19) were added after the rest, from an objection raised against this research
rather than by it:** if answering a mate threat is something players already do, RC-06 is
measurable and unteachable. Chasing it down found the headroom (**real, and band-dependent**), and
then found a second thing nobody was looking for — **most of the rating-band improvement in this
behaviour is criterion, not sensitivity**, which makes the obvious intervention and the obvious
outcome measure both wrong in the same direction.

**They moved because another workstream landed while this was being written.** `RULE_CLASS_SEARCH`
found a rule class with a real signature and a measured trigger-negative cell, which is exactly what
H14 and H16 said did not exist. The verdict changed accordingly — see
[D24](../decisions/D24-learning-architecture.md) — and the fact that it changed within an hour of
being written is itself worth recording: **the blocker was a property of the item definition, not of
the domain**, which is what the earlier draft predicted a null result would mean.

What did **not** move: the target is still *uncued* transfer, RC-06's signature is a *cued* one, and
V15 reports that no validated paradigm measures whether detection governs the move.
