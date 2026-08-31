# The interpretation/use argument, written before the evidence was collected

**Frozen:** 2026-08-31, against `main` at `68d61c216c6932455cc61bbe33eb65e7042a6bd7`.
**Framework:** AERA/APA/NCME *Standards for Educational and Psychological Testing* (2014) and
Kane's argument-based validation, in the operational form given by Cook et al. (2015).
**Status of this document:** the claim, frozen. What happened when it was attacked is in
[`FALSIFICATION_REGISTER.md`](FALSIFICATION_REGISTER.md); what was decided is in
[`CONSTRUCT_DECISION.md`](CONSTRUCT_DECISION.md).

---

## The proposed interpretation and use

> A matched T+/T− choose-a-move task measures **rule-specific conditional behavioural
> discrimination** in chess, and a change in that discrimination after an intervention is evidence
> of rule-specific learning.

With the candidate rule class: **unprotected-piece capture discrimination.**

Under the *Standards*, validity is not a property of the task. It is the degree to which evidence
supports **that sentence**. So the sentence is broken into the inferences it actually requires, and
each is stated with what would refute it — before any supporting evidence was looked for. This
ordering is the point. Freezing the claim first is what makes the subsequent search a test rather
than a collection.

**The rule this document is bound by:** *no higher inference may be marked `supported` while a
lower one it depends on is `unresolved` or `refuted`.* A supported extrapolation resting on an
unresolved scoring inference is not a partial result; it is a category error.

---

## Notation

Let **S** be a position, **T** its trigger state, **B** the observed behaviour.

- **T+** — the board condition the rule class names is present.
- **T−** — it is absent, but a superficially similar opportunity is present.
- **B** — `1` if the player captured the designated target, `0` otherwise.

---

# Inference 0 — Domain

**Claim.** The behaviour we ultimately care about is: *during ordinary chess, when an opponent
piece is capturable and undefended, the player notices that relationship and lets it govern the
move actually played — and does not play the corresponding capture when the relationship is
absent.*

**Assumptions.**
- A0.1 This behaviour is a real, separable component of chess skill, not a re-description of
  overall strength.
- A0.2 It is a thing that can be taught in isolation.
- A0.3 It matters enough to a player's results to be worth targeting.

**Evidence required.** Chess-cognition evidence that loose-piece detection is a distinguishable
perceptual/decision component; evidence that it varies across players beyond what rating already
explains.

**Strongest falsifier.** The behaviour is fully explained by general chess strength — no residual
variance once rating is conditioned on. Then there is nothing rule-specific to teach or measure.

**Current evidence.** Partial and indirect. Sheridan & Reingold's work establishes that experts
detect relevant configurations faster and fixate them earlier; the practitioner heuristic *"loose
pieces drop off"* asserts A0.3 but is tier F. **Nothing found establishes A0.2 for this rule in
adults who already play chess.** Our own corpus scan shows the behaviour varies with rating
(hit rate .751 → .820 across five bands) — but so does everything.

**Status: `unresolved`.**

---

# Inference 1 — Scoring

**Claim.** The recorded observation `B = the player captured the designated target, or did not`
indicates use of the intended discrimination.

**Assumptions.**
- A1.1 T is assigned before the behaviour is seen, from the board alone.
- A1.2 On a T+ item, capturing the target is the act the rule prescribes.
- A1.3 On a T− item, capturing the designated target is the error the rule prevents.
- A1.4 B is observable without ambiguity — exactly one designated target, one scored act.
- A1.5 No oracle used to *interpret* the item is allowed to *define* it.

**Every alternative causal pathway that can produce B = 1 on a T+ item.** This list is the
substance of the scoring inference; it was written before the corpus was scanned.

| # | pathway | does it involve the taught discrimination? |
| --- | --- | --- |
| 1 | the intended one: sees "capturable ∧ undefended", takes | **yes** |
| 2 | tactical calculation: takes because a concrete line was calculated to a good end | no |
| 3 | pre-existing expertise: the pattern was automatic years ago | no — *knowledge already present*, not knowledge newly controlling action |
| 4 | another motif dominates: the capture is also a fork, a discovered attack, a check, a mate | no |
| 5 | chance: any move had to be chosen and this was one | no |
| 6 | a general "capture loose material" heuristic not tied to this rule class | **ambiguous — and this is the hardest case.** If the rule class *is* that heuristic, teaching it is teaching a policy, not a discrimination |
| 7 | position-specific memorisation from an earlier exposure | no |
| 8 | engine-like calculation unrelated to the rule | no |
| 9 | **response bias**: this player takes whenever a capture exists | no |
| 10 | the capture is the only non-losing move; every alternative hangs something | no |
| 11 | mouse economy / the target square is where the cursor already was | no |

And the pathways producing **B = 0 on a T+ item** that are *not* failures of the discrimination:

| # | pathway |
| --- | --- |
| 12 | the player saw it and correctly rejected it — a stronger move exists (mate, larger capture, a winning attack) |
| 13 | the player saw it and correctly rejected it — the capture is refuted by a counter-tactic SEE cannot see |
| 14 | time pressure truncated the search |

**Evidence required.** That pathways 2–14 are rare, or measurable and separable.

**Strongest falsifier.** A substantial share of T+ items admit a competing explanation, or a
substantial share of T− items make the "false alarm" the correct move. Either one makes `B` a
label about the item rather than about the player.

**Current evidence — this inference is where the construct broke.**
- In 60,000 unfiltered rated games, **13.5%** of T+ items carry a competing explanation from the
  narrow flag set alone (larger capture elsewhere 7.4%, capture also gives check 5.6%, mate-in-1
  available 1.5%).
- Among Lichess puzzle positions the frozen predicate calls T+, the curated solution is to capture
  the loose target in only **42.6%** of cases. In a corpus where an independent source has already
  established what the right move is, `capture(target)` is the right move **less than half the
  time**.
- **37.1%** of T− items are captures SEE calls materially sound. A third of the scored false alarms
  are not errors.
- A1.5 is violated the moment `hangingPiece` is used to define T: read from
  `lichess-puzzler/tagger/cook.py`, that theme is computed from the **solution move**.

**Status: `refuted` as stated.** Narrowing is examined in
[`CONSTRUCT_DECISION.md`](CONSTRUCT_DECISION.md).

---

# Inference 2 — Generalisation

**Claim.** Performance across the sampled items represents the rule class, not this item bank.

**Assumptions.**
- A2.1 Items are sampled from the population of positions the rule class covers.
- A2.2 T+ and T− items are exchangeable on everything except the trigger.
- A2.3 Enough items per person for a stable estimate.
- A2.4 Item-level variance is not larger than person-level variance.

**Evidence required.** Covariate balance between T+ and T−; parallel-form or split-half stability;
a variance decomposition separating item from person.

**Strongest falsifier.** T+ and T− differ systematically on properties that predict capturing
independently of the trigger. Then *d′* measures the difference between two item sets.

**Current evidence.** T+ and T− are **not** exchangeable, on both corpora, before any participant
is recruited (standardised mean differences, T+ − T−):

| covariate | games | puzzles |
| --- | --- | --- |
| material balance (actor POV) | **−0.487** | **−0.724** |
| legal moves available | −0.486 | −0.348 |
| attackers on the target | **+0.475** | — |
| total material on board | −0.393 | −0.215 |
| piece count | −0.312 | −0.127 |
| number of capturable targets | +0.288 | +0.297 |
| target piece value | +0.204 | −0.222 |
| **puzzle rating (difficulty)** | — | **−0.239** |

The last row is the item-difficulty confound in its purest form: **T+ puzzles are ~125 Elo points
easier than T− puzzles.** `negative-controls.ts::itemDifficultyConfound` shows what that does to a
*d′* computed from a participant with zero discrimination ability. Exact matching on six covariates
left residual imbalances of +0.402 (attacker count), −0.393 (material balance) and −0.350 (legal
moves) and moved *d′* by 0.04.

**Status: `refuted` as stated.** A2.2 fails and matching did not repair it.

---

# Inference 3 — Explanation

**Claim.** The discrimination reflects the target knowledge rather than chess strength, visual
search skill, tactical vigilance, response bias or item difficulty.

**Assumptions.**
- A3.1 *d′* is not driven by criterion.
- A3.2 The measure separates skill groups in the direction theory predicts (known-groups).
- A3.3 It correlates with rating *less* than a general chess measure would — otherwise it is
  a chess test with extra steps.

**Evidence required.** *d′* and *c* reported separately by skill band; convergence with a reference
task; divergence from irrelevant variables.

**Strongest falsifier.** Skill differences appear in *c* rather than *d′*; or *d′* fails to order
skill groups; or *d′* tracks rating as tightly as a general accuracy measure.

**Current evidence — mixed, and the mix is unfavourable.** Across five rating bands
(11,752 T+ / 45,752 T− decisions from real games):

| band | H | F | *d′* | *c* |
| --- | --- | --- | --- | --- |
| <1200 | .751 | .196 | 1.533 | **+0.089** |
| 1200–1400 | .744 | .219 | **1.430** | +0.059 |
| 1400–1600 | .774 | .227 | 1.500 | −0.001 |
| 1600–1800 | .802 | .222 | 1.613 | −0.042 |
| 1800+ | .820 | .216 | 1.698 | −0.065 |

**The criterion is monotone across all five bands. Sensitivity is not** — the weakest band
outperforms the second-weakest. Total *d′* span is 0.27; total *c* span is 0.15 on a monotone
trajectory. A measure whose cleanest skill signal is *where the player puts their criterion* is
measuring willingness to capture at least as much as ability to discriminate.

**Status: `unresolved`, leaning `refuted`.** A3.1 is not established; A3.2 fails monotonicity.

---

# Inference 4 — Extrapolation

**Claim.** Performance in the task says something about uncued decision-making in ordinary chess.

**Assumptions.**
- A4.1 The task does not cue the rule.
- A4.2 Items are representative of positions in which the rule matters (Brunswik).
- A4.3 The measurement does not itself train the behaviour.

**Evidence required.** No rule-specific cue anywhere in the UI; representative item sampling;
a measurement-only control arm quantifying reactivity.

**Strongest falsifier.** Discrimination improves in a measurement-only arm; or the task's items are
drawn from a curated bank whose selection rule has no counterpart in real play.

**Current evidence.**
- A4.2 is **already violated by any puzzle-derived bank.** `lichess-puzzler/generator.py::
  is_valid_attack` keeps a candidate only when the best move beats the second-best by more than
  0.7 in win-chance (or is a unique winning move or a valid mate-in-1). That is a severe
  restriction of range with no counterpart in ordinary play.
- A4.3 is **untested.** The question-behaviour literature reports a small effect for single
  questions (SMD ≈ 0.09); a T+/T− block is dozens of exposures to the exact contrast being taught,
  and no published estimate covers that.
- A4.1 is a design property this program can hold, and [`ITEM_BANK_PROTOCOL.md`](ITEM_BANK_PROTOCOL.md)
  states how.

**Status: `unresolved`.** And it is barred from being anything else while Inferences 1–3 stand as
they do.

---

# Inference 5 — Utilization

**Claim.** This measurement would justify a product decision: whether a Decision Lab intervention
changed rule-specific behaviour, and therefore whether to keep, change or remove it.

**Assumptions.**
- A5.1 The measure is sensitive to change over the interval a product can act in.
- A5.2 A change is attributable to the intervention rather than to practice, regression or drift.
- A5.3 The decision it informs is one the product would actually take differently.

**Evidence required.** Test-retest stability; a design meeting an accepted causal framework
(WWC SCD v5: systematic manipulation, ≥ 3 demonstrations at 3 different points in time, baseline
stability, immediacy, consistency); a stated decision rule fixed in advance.

**Strongest falsifier.** The measure is unstable across parallel forms; or the only feasible design
is pre/post, which cannot support a causal claim.

**Current evidence.** None. Nothing here has been measured on a human. `measurementOnlyImprovement`
in `negative-controls.ts` demonstrates that a pre/post contrast reports an effect of **+0.4 *d′***
from practice alone, on data where the intervention effect is zero by construction.

**Status: `unresolved`, and formally blocked** — Inferences 1, 2 and 3 must be resolved first.

---

## The chain, as it now stands

| # | inference | status | blocked by |
| --- | --- | --- | --- |
| 0 | Domain | `unresolved` | — |
| 1 | Scoring | **`refuted`** as stated | — |
| 2 | Generalisation | **`refuted`** as stated | — |
| 3 | Explanation | `unresolved`, leaning refuted | 1, 2 |
| 4 | Extrapolation | `unresolved` | 1, 2, 3 |
| 5 | Utilization | `unresolved` (blocked) | 1, 2, 3, 4 |

**Two inferences are refuted and the four above them are therefore unavailable.** Not "promising
but early" — unavailable, because the rule at the top of this document says so.

The one thing that is *not* refuted: the frozen board predicate fires at a stable, well-estimated
rate in a corpus that was never selected by any tactical label (20.4% of classifiable game
positions; 22.6% of puzzle positions), and it is robust to the main alternative definition of
"unprotected" (0.64% flip rate under Lichess's ray-defence rule). **The detector works. What was
refuted is that its output is a measurement of a person.**
